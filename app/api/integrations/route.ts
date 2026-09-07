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
      .prepare('SELECT id,label,provider_type,secret,updated FROM integrations ORDER BY provider_type,label,updated')
      .all<{ id: string; label: string; provider_type: string; secret: string; updated: string }>();
    const configured = await Promise.all(
      rows.results.map(async (r) => {
        const c = await unseal<Credentials>(r.secret);
        return {
          id: r.id,
          label: r.label || r.provider_type || r.id,
          provider: r.provider_type || r.id,
          clientIdHint: '••••' + c.clientId.slice(-4),
          updated: r.updated,
        };
      }),
    );
    const accounts = await db()
      .prepare(
        'SELECT id,integration_id,provider,platform,name,external_id,updated FROM accounts ORDER BY name',
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

    // b.integrationId = existing integration to edit, or absent to create new
    const isEdit = !!b.integrationId;

    if (!validProvider(b.provider)) throw new AppError('Unknown integration.');

    let integrationId = isEdit ? text(b.integrationId, 512) : crypto.randomUUID();

    const existing = isEdit
      ? await db()
          .prepare('SELECT secret FROM integrations WHERE id=?')
          .bind(integrationId)
          .first<{ secret: string }>()
      : null;

    const old = existing ? await unseal<Credentials>(existing.secret) : null;
    const clientId = b.clientId ? text(b.clientId, 512) : old?.clientId;
    const clientSecret = b.clientSecret ? text(b.clientSecret, 4096) : old?.clientSecret;
    if (!clientId || !clientSecret)
      throw new AppError('Enter the client ID and client secret.');

    const label = b.label ? text(b.label, 100) : '';
    const changed = !!old && (old.clientId !== clientId || old.clientSecret !== clientSecret);

    const statements = [
      db()
        .prepare(
          'INSERT INTO integrations(id,label,provider_type,secret,updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,secret=excluded.secret,updated=excluded.updated',
        )
        .bind(
          integrationId,
          label,
          b.provider,
          await seal({ clientId, clientSecret }),
          new Date().toISOString(),
        ),
    ];
    if (changed) {
      statements.push(
        db().prepare('DELETE FROM accounts WHERE integration_id=?').bind(integrationId),
        db().prepare('DELETE FROM oauth_states WHERE integration_id=?').bind(integrationId),
      );
    }
    await db().batch(statements);
    return json({ ok: true, reconnect: changed, integrationId });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    await authorize();
    const b = await body(request);
    const integrationId = text(b.integrationId, 512);
    await db().batch([
      db().prepare('DELETE FROM integrations WHERE id=?').bind(integrationId),
      db().prepare('DELETE FROM accounts WHERE integration_id=?').bind(integrationId),
      db().prepare('DELETE FROM oauth_states WHERE integration_id=?').bind(integrationId),
    ]);
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
