import { authorize, db, runtime, AppError } from '@/lib/server';
import { validProvider } from '@/lib/catalog';
import { discover, exchangeCode } from '@/lib/oauth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const target = new URL('/', runtime().APP_ORIGIN);
  try {
    const s = await authorize();
    const { provider } = await params;
    if (!validProvider(provider)) throw new AppError('Unknown integration.');
    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    const row = await db()
      .prepare(
        'DELETE FROM oauth_states WHERE id=? AND provider=? AND session=? AND expires>? RETURNING verifier,integration_id',
      )
      .bind(state || '', provider, s.id, Date.now())
      .first<{ verifier: string; integration_id: string }>();
    if (!row)
      throw new AppError(
        'Connection request expired. Start again from Social accounts.',
      );
    if (url.searchParams.has('error'))
      throw new AppError('Account connection was cancelled or denied.');
    const code = url.searchParams.get('code');
    if (!code)
      throw new AppError('The platform did not return an authorization code.');
    const integrationId = row.integration_id;
    const t = await exchangeCode(integrationId, provider, code, row.verifier);
    const count = await discover(integrationId, provider, t);
    target.searchParams.set('connected', String(count));
  } catch (e) {
    target.searchParams.set(
      'connection_error',
      e instanceof AppError
        ? e.message
        : 'Connection failed. Check credentials and try again.',
    );
  }
  return Response.redirect(target.toString(), 303);
}
