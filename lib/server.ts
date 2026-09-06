import { cookies } from 'next/headers';
import postgres from 'postgres';
export const runtime = () => process.env;
let connection: ReturnType<typeof postgres> | undefined;
function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new AppError('Database has not been configured.', 503);
  return connection ??= postgres(url, {
    max: 5, prepare: false, idle_timeout: 20, connect_timeout: 10,
    ssl: 'require',
  });
}
function statement(query: string, values: unknown[] = []) {
  let index = 0;
  // Application queries are static; skip quoted SQL strings and identifiers.
  const sqlText = query.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g,
    (token) => token === '?' ? `$${++index}` : token);
  const execute = () => database().unsafe(sqlText, values as never[]);
  return {
    sqlText, values,
    bind(...parameters: unknown[]) { return statement(query, parameters); },
    async first<T = Record<string, unknown>>() {
      const rows = await execute();
      return (rows[0] as T | undefined) ?? null;
    },
    async all<T = Record<string, unknown>>() {
      return { results: await execute() as unknown as T[] };
    },
    async run() {
      const rows = await execute();
      return { meta: { changes: rows.count } };
    },
  };
}
export const db = () => ({
  prepare: statement,
  async batch(statements: ReturnType<typeof statement>[]) {
    return database().begin(async (transaction) => {
      const results = [];
      for (const item of statements) {
        const rows = await transaction.unsafe(item.sqlText, item.values as never[]);
        results.push({ meta: { changes: rows.count } });
      }
      return results;
    });
  },
});
export const EMAIL = 'ads.cleverclouds.in@gmail.com';
const encoder = new TextEncoder();
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
export const fail = (e: unknown) =>
  json(
    {
      error:
        e instanceof AppError
          ? e.message
          : 'Something went wrong. Please try again.',
    },
    e instanceof AppError ? e.status : 500,
  );
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin)
    throw new AppError('This request must come from the workspace.', 403);
}
export async function body(request: Request) {
  if (Number(request.headers.get('content-length') || 0) > 65536)
    throw new AppError('Request too large.', 413);
  const raw = await request.text();
  if (raw.length > 65536) throw new AppError('Request too large.', 413);
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError('Invalid request.');
  }
}
export const hex = (data: ArrayBuffer) =>
  Array.from(new Uint8Array(data), (v) => v.toString(16).padStart(2, '0')).join(
    '',
  );
export async function digest(value: string) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}
export async function session() {
  const token = (await cookies()).get('cc_session')?.value;
  if (!token) return null;
  const id = await digest(token);
  return await db()
    .prepare('SELECT id FROM sessions WHERE id=? AND expires>?')
    .bind(id, Date.now())
    .first<{ id: string }>();
}
export async function authorize() {
  const s = await session();
  if (!s) throw new AppError('Please sign in to your workspace.', 401);
  return s;
}
export async function passwordMatches(password: string) {
  const e = runtime();
  if (!e.APP_PASSWORD_HASH || !e.APP_PASSWORD_SALT)
    throw new AppError('Workspace sign-in has not been configured.', 503);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const hash = hex(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(e.APP_PASSWORD_SALT),
        iterations: 100000,
        hash: 'SHA-256',
      },
      key,
      256,
    ),
  );
  let diff = hash.length ^ e.APP_PASSWORD_HASH.length;
  for (let i = 0; i < hash.length; i++)
    diff |= hash.charCodeAt(i) ^ e.APP_PASSWORD_HASH.charCodeAt(i);
  return diff === 0;
}
async function encryptionKey() {
  const raw = runtime().APP_ENCRYPTION_KEY;
  if (!raw)
    throw new AppError('Credential storage has not been configured.', 503);
  return crypto.subtle.importKey(
    'raw',
    Uint8Array.from(Buffer.from(raw, 'base64')),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}
export async function seal(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(),
    encoder.encode(JSON.stringify(value)),
  );
  return (
    btoa(String.fromCharCode(...iv)) +
    '.' +
    btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  );
}
export async function unseal<T>(value: string): Promise<T> {
  const [iv, cipher] = value.split('.');
  const data = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Uint8Array.from(atob(iv), (c) => c.charCodeAt(0)) },
    await encryptionKey(),
    Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0)),
  );
  return JSON.parse(new TextDecoder().decode(data));
}
export function text(value: unknown, max: number, required = true) {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new AppError('Please check the required fields and their lengths.');
  return value.trim();
}
