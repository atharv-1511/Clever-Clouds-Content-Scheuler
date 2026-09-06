import {
  authorize,
  body,
  db,
  fail,
  json,
  sameOrigin,
  seal,
  unseal,
  text,
  AppError,
  runtime,
} from '@/lib/server';
import { validProvider } from '@/lib/catalog';
export type Credentials = { clientId: string; clientSecret: string };
export async function GET() {
  try {
    await authorize();
    const rows = await db()
      .prepare('SELECT id,secret,updated FROM integrations')
      .all<{ id: string; secret: string; updated: string }>();
    const configured = await Promise.all(
      rows.results.map(async (r) => {
        const c = await unseal<Credentials>(r.secret);
        return {
          id: r.id,
          clientIdHint: '••••' + c.clientId.slice(-4),
          updated: r.updated,
        };
      }),
    );
    const accounts = await db()
      .prepare(
        'SELECT id,provider,platform,name,external_id,updated FROM accounts ORDER BY name',
      )
      .all();
    return json({
      configured,
      accounts: accounts.results,
      origin: runtime().APP_ORIGIN,
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await authorize();
    const b = await body(request);
    if (!validProvider(b.provider)) throw new AppError('Unknown integration.');
    const existing = await db()
      .prepare('SELECT secret FROM integrations WHERE id=?')
      .bind(b.provider)
      .first<{ secret: string }>();
    const old = existing ? await unseal<Credentials>(existing.secret) : null;
    const clientId = b.clientId ? text(b.clientId, 512) : old?.clientId;
    const clientSecret = b.clientSecret
      ? text(b.clientSecret, 4096)
      : old?.clientSecret;
    if (!clientId || !clientSecret)
      throw new AppError('Enter the client ID and client secret.');
    const changed =
      !!old && (old.clientId !== clientId || old.clientSecret !== clientSecret);
    const statements = [
      db()
        .prepare(
          'INSERT INTO integrations(id,secret,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET secret=excluded.secret,updated=excluded.updated',
        )
        .bind(
          b.provider,
          await seal({ clientId, clientSecret }),
          new Date().toISOString(),
        ),
    ];
    if (changed)
      statements.push(
        db().prepare('DELETE FROM accounts WHERE provider=?').bind(b.provider),
        db()
          .prepare('DELETE FROM oauth_states WHERE provider=?')
          .bind(b.provider),
      );
    await db().batch(statements);
    return json({ ok: true, reconnect: changed });
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    await authorize();
    const b = await body(request);
    if (!validProvider(b.provider)) throw new AppError('Unknown integration.');
    await db().batch([
      db().prepare('DELETE FROM integrations WHERE id=?').bind(b.provider),
      db().prepare('DELETE FROM accounts WHERE provider=?').bind(b.provider),
      db()
        .prepare('DELETE FROM oauth_states WHERE provider=?')
        .bind(b.provider),
    ]);
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
