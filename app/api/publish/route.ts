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
import { access, api, type Account } from '@/lib/oauth';
import { publishPost } from '@/lib/publish';
export async function GET() {
  try {
    await authorize();
    const r = await db()
      .prepare(
        'SELECT id,post_id,account_id,status,external_id,error,updated FROM deliveries ORDER BY updated DESC',
      )
      .all();
    return json(r.results);
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await authorize();
    const b = await body(request);
    const result = await publishPost(b.postId, b.accountId, b.version);
    return json(result);
  } catch (e) {
    return fail(e);
  }
}
