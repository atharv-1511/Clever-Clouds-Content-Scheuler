import {
  authorize,
  body,
  db,
  fail,
  json,
  sameOrigin,
  text,
} from '@/lib/server';
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    await authorize();
    const b = await body(request);
    await db()
      .prepare('DELETE FROM accounts WHERE id=?')
      .bind(text(b.id, 512))
      .run();
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
