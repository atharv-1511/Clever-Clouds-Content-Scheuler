import {
  authorize,
  db,
  fail,
  json,
  sameOrigin,
  AppError,
} from '@/lib/server';
import { supabaseAdmin } from '@/lib/supabase';
const bucket=()=>process.env.SUPABASE_STORAGE_BUCKET||'clever-clouds-media';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await authorize();
    const data = await request.formData();
    const file = data.get('file');
    if (
      !(file instanceof File) ||
      file.size > 200 * 1024 * 1024 ||
      file.size === 0 ||
      !['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'].includes(
        file.type,
      )
    )
      throw new AppError('Use a JPG, PNG, WebP, or MP4/MOV/AVI/WebM video under 200 MB.');
    const id = crypto.randomUUID();
    const uploaded = await supabaseAdmin().storage.from(bucket()).upload(
      id,
      Buffer.from(await file.arrayBuffer()),
      { contentType: file.type, upsert: false }
    );
    if (uploaded.error) throw new AppError(`Storage upload failed: ${uploaded.error.message}`);
    try {
      await db()
        .prepare('INSERT INTO media(id,name,type,size) VALUES(?,?,?,?)')
        .bind(id, file.name.slice(0, 200), file.type, file.size)
        .run();
    } catch (e) {
      await supabaseAdmin().storage.from(bucket()).remove([id]);
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
    const downloaded=await supabaseAdmin().storage.from(bucket()).download(id);
    if(downloaded.error||!downloaded.data) throw new AppError('File not found.',404);
    return new Response(downloaded.data.stream(), {
      headers: {
        'Content-Type':
          downloaded.data.type || 'application/octet-stream',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return fail(e);
  }
}
