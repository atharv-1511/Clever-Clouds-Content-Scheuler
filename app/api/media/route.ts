import {
  authorize,
  db,
  fail,
  json,
  runtime,
  sameOrigin,
  AppError,
} from '@/lib/server';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await authorize();
    const size = Number(request.headers.get('content-length') || 0);
    if (!size || size > 21 * 1024 * 1024)
      throw new AppError('Choose a file smaller than 20 MB.', 413);
    const data = await request.formData();
    const file = data.get('file');
    if (
      !(file instanceof File) ||
      file.size > 20 * 1024 * 1024 ||
      file.size === 0 ||
      !['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(
        file.type,
      )
    )
      throw new AppError('Use a JPG, PNG, WebP, or MP4 file under 20 MB.');
    const id = crypto.randomUUID();
    await runtime().MEDIA.put(id, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    try {
      await db()
        .prepare('INSERT INTO media(id,name,type,size) VALUES(?,?,?,?)')
        .bind(id, file.name.slice(0, 200), file.type, file.size)
        .run();
    } catch (e) {
      await runtime().MEDIA.delete(id);
      throw e;
    }
    return json({ id, name: file.name, type: file.type });
  } catch (e) {
    return fail(e);
  }
}
export async function GET(request: Request) {
  try {
    await authorize();
    const id = new URL(request.url).searchParams.get('id');
    if (!id || !/^[-a-f0-9]{36}$/.test(id))
      throw new AppError('File not found.', 404);
    const file = await runtime().MEDIA.get(id);
    if (!file) throw new AppError('File not found.', 404);
    return new Response(file.body, {
      headers: {
        'Content-Type':
          file.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return fail(e);
  }
}
