import { AppError, db, runtime, seal, unseal } from './server';
import { providers, type ProviderId } from './catalog';
type Credentials = { clientId: string; clientSecret: string };
export type Tokens = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  scope?: string;
};
export type Account = {
  id: string;
  provider: ProviderId;
  platform: string;
  name: string;
  external_id: string;
  token: string;
};
export async function credentials(provider: string) {
  const row = await db()
    .prepare('SELECT secret FROM integrations WHERE id=?')
    .bind(provider)
    .first<{ secret: string }>();
  if (!row)
    throw new AppError(
      'Save the app credentials before connecting an account.',
    );
  return unseal<Credentials>(row.secret);
}
export const callback = (provider: string) =>
  `${runtime().APP_ORIGIN}/api/oauth/${provider}`;
const endpoints = {
  meta: [
    'https://www.facebook.com/v23.0/dialog/oauth',
    'https://graph.facebook.com/v23.0/oauth/access_token',
  ],
  youtube: [
    'https://accounts.google.com/o/oauth2/v2/auth',
    'https://oauth2.googleapis.com/token',
  ],
  gbp: [
    'https://accounts.google.com/o/oauth2/v2/auth',
    'https://oauth2.googleapis.com/token',
  ],
  linkedin: [
    'https://www.linkedin.com/oauth/v2/authorization',
    'https://www.linkedin.com/oauth/v2/accessToken',
  ],
  x: ['https://x.com/i/oauth2/authorize', 'https://api.x.com/2/oauth2/token'],
};
export async function authUrl(
  provider: ProviderId,
  state: string,
  verifier: string,
) {
  const c = await credentials(provider);
  const url = new URL(endpoints[provider][0]);
  const p = providers.find((p) => p.id === provider)!;
  for (const [k, v] of Object.entries({
    client_id: c.clientId,
    redirect_uri: callback(provider),
    response_type: 'code',
    state,
    scope: p.scopes,
  }))
    url.searchParams.set(k, v);
  if (provider === 'youtube' || provider === 'gbp') {
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
  }
  if (provider === 'x') {
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(verifier),
    );
    url.searchParams.set(
      'code_challenge',
      btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, ''),
    );
    url.searchParams.set('code_challenge_method', 'S256');
  }
  return url.toString();
}
export async function api(url: string, token: string, init: RequestInit = {}) {
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok)
    throw new AppError(
      `The platform returned ${r.status}. Check app permissions and reconnect the account.`,
      502,
    );
  if (r.status === 204) return {};
  const raw = await r.text();
  return raw ? JSON.parse(raw) : {};
}
async function exchange(provider: ProviderId, params: Record<string, string>) {
  const c = await credentials(provider);
  const data = new URLSearchParams({ ...params, client_id: c.clientId });
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (provider === 'x')
    headers.Authorization =
      'Basic ' +
      btoa(
        encodeURIComponent(c.clientId) +
          ':' +
          encodeURIComponent(c.clientSecret),
      );
  else data.set('client_secret', c.clientSecret);
  const response = await fetch(endpoints[provider][1], {
    method: 'POST',
    headers,
    body: data,
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok)
    throw new AppError(
      'The platform could not authorize this app. Check the credentials, callback URL, and approved permissions.',
      502,
    );
  const t: any = await response.json();
  if (!t.access_token) throw new AppError('No access token was returned.', 502);
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    scope: t.scope,
    expires_at: t.expires_in ? Date.now() + t.expires_in * 1000 : undefined,
  } as Tokens;
}
export const exchangeCode = (
  provider: ProviderId,
  code: string,
  verifier: string,
) =>
  exchange(provider, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: callback(provider),
    ...(provider === 'x' ? { code_verifier: verifier } : {}),
  });
export async function access(account: Account) {
  let t = await unseal<Tokens>(account.token);
  if (t.expires_at && t.expires_at < Date.now() + 60000) {
    if (!t.refresh_token)
      throw new AppError(
        'This connection expired. Reconnect the account.',
        409,
      );
    const next = await exchange(account.provider, {
      grant_type: 'refresh_token',
      refresh_token: t.refresh_token,
    });
    t = { ...next, refresh_token: next.refresh_token || t.refresh_token };
    await db()
      .prepare('UPDATE accounts SET token=?,updated=? WHERE id=?')
      .bind(await seal(t), new Date().toISOString(), account.id)
      .run();
  }
  return t.access_token;
}
export async function discover(provider: ProviderId, t: Tokens) {
  const found: {
    external: string;
    name: string;
    platform: string;
    tokens: Tokens;
  }[] = [];
  if (provider === 'meta') {
    const r = await api(
      'https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100',
      t.access_token,
    );
    for (const p of r.data || []) {
      found.push({
        external: p.id,
        name: p.name,
        platform: 'Facebook',
        tokens: { access_token: p.access_token },
      });
      if (p.instagram_business_account)
        found.push({
          external: p.instagram_business_account.id,
          name: p.instagram_business_account.username || p.name,
          platform: 'Instagram',
          tokens: { access_token: p.access_token },
        });
    }
  } else if (provider === 'youtube') {
    const r = await api(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=50',
      t.access_token,
    );
    for (const p of r.items || [])
      found.push({
        external: p.id,
        name: p.snippet.title,
        platform: 'YouTube',
        tokens: t,
      });
  } else if (provider === 'gbp') {
    const r = await api(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20',
      t.access_token,
    );
    for (const a of r.accounts || []) {
      const l = await api(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title&pageSize=100`,
        t.access_token,
      );
      for (const p of l.locations || [])
        found.push({
          external: `${a.name}/${p.name}`,
          name: p.title,
          platform: 'Google Business Profile',
          tokens: t,
        });
    }
  } else if (provider === 'linkedin') {
    const p = await api('https://api.linkedin.com/v2/userinfo', t.access_token);
    found.push({
      external: p.sub,
      name: p.name || 'LinkedIn profile',
      platform: 'LinkedIn',
      tokens: t,
    });
  } else {
    const p = await api('https://api.x.com/2/users/me', t.access_token);
    found.push({
      external: p.data.id,
      name: '@' + p.data.username,
      platform: 'X',
      tokens: t,
    });
  }
  if (!found.length)
    throw new AppError(
      'No eligible accounts were returned. Check app access and account ownership.',
    );
  const now = new Date().toISOString();
  const statements = [];
  for (const p of found) {
    const id = `${provider}:${p.platform}:${p.external}`;
    statements.push(
      db()
        .prepare(
          'INSERT INTO accounts(id,provider,platform,name,external_id,token,updated) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,token=excluded.token,updated=excluded.updated',
        )
        .bind(
          id,
          provider,
          p.platform,
          p.name,
          p.external,
          await seal(p.tokens),
          now,
        ),
    );
  }
  await db().batch(statements);
  return found.length;
}
