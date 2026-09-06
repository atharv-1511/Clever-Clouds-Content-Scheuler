import {
  authorize,
  body,
  db,
  fail,
  json,
  sameOrigin,
  text,
  AppError,
} from '@/lib/server';
import { platforms } from '@/lib/catalog';
export async function GET() {
  try {
    await authorize();
    const r = await db()
      .prepare('SELECT * FROM posts ORDER BY updated DESC')
      .all();
    return json(
      r.results.map((p: any) => ({
        ...p,
        platforms: JSON.parse(p.platforms),
        variants: JSON.parse(p.variants),
      })),
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await authorize();
    const b = await body(request);
    const title = text(b.title, 120);
    const content = text(b.content, 5000, false);
    if (
      !Array.isArray(b.platforms) ||
      !b.platforms.length ||
      b.platforms.length > 5 ||
      b.platforms.some((p: unknown) => !platforms.includes(p as any))
    )
      throw new AppError('Choose at least one supported platform.');
    const variants: Record<string, string> = {};
    for (const p of b.platforms) {
      variants[p] =
        typeof b.variants?.[p] === 'string'
          ? text(b.variants[p], 5000, false)
          : '';
      const value = variants[p] || content;
      if (!value) throw new AppError(`Add a caption for ${p}.`);
      const limit =
        p === 'X'
          ? 280
          : p === 'Instagram'
            ? 2200
            : p === 'LinkedIn'
              ? 3000
              : 5000;
      if (Array.from(value).length > limit)
        throw new AppError(`${p} caption exceeds ${limit} characters.`);
    }
    const status = b.status === 'planned' ? 'planned' : 'draft';
    let when: string | null = null;
    if (b.scheduled_at) {
      const d = new Date(b.scheduled_at);
      if (!Number.isFinite(d.getTime()))
        throw new AppError('Choose a valid date and time.');
      when = d.toISOString();
    }
    if (
      status === 'planned' &&
      (!when || new Date(when).getTime() <= Date.now())
    )
      throw new AppError('Choose a future date and time.');
    if (
      b.media_id &&
      !(await db()
        .prepare('SELECT id FROM media WHERE id=?')
        .bind(b.media_id)
        .first())
    )
      throw new AppError('Attachment was not found.');
    const id = b.id ? text(b.id, 80) : crypto.randomUUID();
    const now = new Date().toISOString();
    if (b.id) {
      const r = await db()
        .prepare(
          "UPDATE posts SET title=?,content=?,platforms=?,variants=?,scheduled_at=?,status=?,media_id=?,updated=?,version=version+1 WHERE id=? AND version=? AND status IN ('draft','planned')",
        )
        .bind(
          title,
          content,
          JSON.stringify([...new Set(b.platforms)]),
          JSON.stringify(variants),
          when,
          status,
          b.media_id || null,
          now,
          id,
          b.version,
        )
        .run();
      if (!r.meta.changes)
        throw new AppError(
          'This post changed or was published. Reload before editing.',
          409,
        );
    } else
      await db()
        .prepare(
          'INSERT INTO posts(id,title,content,platforms,variants,scheduled_at,status,media_id,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)',
        )
        .bind(
          id,
          title,
          content,
          JSON.stringify([...new Set(b.platforms)]),
          JSON.stringify(variants),
          when,
          status,
          b.media_id || null,
          now,
          now,
        )
        .run();
    return json({ id, status });
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    await authorize();
    const b = await body(request);
    const r = await db()
      .prepare(
        "DELETE FROM posts WHERE id=? AND version=? AND status IN ('draft','planned')",
      )
      .bind(text(b.id, 80), b.version)
      .run();
    if (!r.meta.changes)
      throw new AppError(
        'Post changed or cannot be deleted. Reload and try again.',
        409,
      );
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
