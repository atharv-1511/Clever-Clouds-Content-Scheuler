import {
  authorize,
  body,
  db,
  digest,
  EMAIL,
  fail,
  json,
  passwordMatches,
  sameOrigin,
  session,
  AppError,
} from '@/lib/server';
export async function GET() {
  try {
    return json({ authenticated: !!(await session()), email: EMAIL });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const b = await body(request);
    const ip = await digest(
      process.env.VERCEL === '1'
        ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || 'unknown'
        : 'local',
    );
    const now = Date.now();
    const a = await db()
      .prepare(
        'INSERT INTO attempts(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN attempts.expires<? THEN 1 ELSE attempts.count+1 END,expires=CASE WHEN attempts.expires<? THEN ? ELSE attempts.expires END RETURNING count',
      )
      .bind(ip, now + 900000, now, now, now + 900000)
      .first<{ count: number }>();
    if ((a?.count || 0) > 10)
      throw new AppError(
        'Too many sign-in attempts. Please try again in 15 minutes.',
        429,
      );
    if (
      typeof b.password !== 'string' ||
      b.password.length > 256 ||
      typeof b.email !== 'string'
    )
      throw new AppError('Email or password is incorrect.', 401);
    const valid = await passwordMatches(b.password);
    if (b.email.trim().toLowerCase() !== EMAIL || !valid)
      throw new AppError('Email or password is incorrect.', 401);
    const token = crypto.randomUUID() + crypto.randomUUID();
    await db().batch([
      db()
        .prepare('INSERT INTO sessions(id,expires) VALUES(?,?)')
        .bind(await digest(token), now + 604800000),
      db()
        .prepare('DELETE FROM attempts WHERE id=? OR expires<?')
        .bind(ip, now),
      db().prepare('DELETE FROM sessions WHERE expires<?').bind(now),
    ]);
    const r = json({ authenticated: true, email: EMAIL });
    r.headers.set(
      'Set-Cookie',
      `cc_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
    );
    return r;
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const s = await authorize();
    await db().prepare('DELETE FROM sessions WHERE id=?').bind(s.id).run();
    const r = json({ ok: true });
    r.headers.set(
      'Set-Cookie',
      'cc_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure',
    );
    return r;
  } catch (e) {
    return fail(e);
  }
}
