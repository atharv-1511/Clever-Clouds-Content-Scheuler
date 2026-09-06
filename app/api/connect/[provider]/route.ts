import { authorize, db, fail, json, sameOrigin, AppError } from '@/lib/server';
import { validProvider } from '@/lib/catalog';
import { authUrl } from '@/lib/oauth';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    sameOrigin(request);
    const s = await authorize();
    const { provider } = await params;
    if (!validProvider(provider)) throw new AppError('Unknown platform.');
    const state = crypto.randomUUID();
    const verifier = crypto.randomUUID() + crypto.randomUUID();
    const url = await authUrl(provider, state, verifier);
    await db().batch([
      db().prepare('DELETE FROM oauth_states WHERE expires<?').bind(Date.now()),
      db()
        .prepare(
          'INSERT INTO oauth_states(id,provider,session,verifier,expires) VALUES(?,?,?,?,?)',
        )
        .bind(state, provider, s.id, verifier, Date.now() + 600000),
    ]);
    return json({ url });
  } catch (e) {
    return fail(e);
  }
}
