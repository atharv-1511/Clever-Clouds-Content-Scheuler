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
  let delivery: string | null = null;
  try {
    sameOrigin(request);
    await authorize();
    const b = await body(request);
    const p = await db()
      .prepare('SELECT * FROM posts WHERE id=?')
      .bind(text(b.postId, 80))
      .first<any>();
    const a = await db()
      .prepare('SELECT * FROM accounts WHERE id=?')
      .bind(text(b.accountId, 512))
      .first<Account>();
    if (!p || !a) throw new AppError('Post or account was not found.');
    if (p.version !== b.version)
      throw new AppError('This post changed. Reload before publishing.', 409);
    if (!JSON.parse(p.platforms).includes(a.platform))
      throw new AppError('This account is not a selected post channel.');
    if (!['Facebook', 'LinkedIn', 'X'].includes(a.platform))
      throw new AppError(
        'Direct publishing for this platform is not available in this version.',
      );
    if (p.media_id)
      throw new AppError(
        'Direct publishing currently supports text posts only. Download the attachment and publish media in the platform.',
      );
    const caption = JSON.parse(p.variants)[a.platform] || p.content;
    const token = await access(a);
    delivery = p.id + '|' + a.id;
    const inserted = await db()
      .prepare(
        "INSERT OR IGNORE INTO deliveries(id,post_id,account_id,status,updated) VALUES(?,?,?,'sending',?)",
      )
      .bind(delivery, p.id, a.id, new Date().toISOString())
      .run();
    if (!inserted.meta.changes) {
      delivery = null;
      throw new AppError(
        'This post has already been sent or attempted for that account. Check delivery history before taking further action.',
        409,
      );
    }
    const locked = await db()
      .prepare(
        "UPDATE posts SET status='partial',version=version+1,updated=? WHERE id=? AND version=?",
      )
      .bind(new Date().toISOString(), p.id, p.version)
      .run();
    if (!locked.meta.changes)
      throw new AppError(
        'This post changed before delivery. No post was sent.',
        409,
      );
    let external: string = '';
    if (a.platform === 'X') {
      const r = await api('https://api.x.com/2/tweets', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: caption }),
      });
      external = r.data?.id || '';
    } else if (a.platform === 'Facebook') {
      const r = await api(
        `https://graph.facebook.com/v23.0/${encodeURIComponent(a.external_id)}/feed`,
        token,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: caption }),
        },
      );
      external = r.id || '';
    } else {
      const r = await api('https://api.linkedin.com/v2/ugcPosts', token, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author: 'urn:li:person:' + a.external_id,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: caption },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }),
      });
      external = r.id || '';
    }
    await db().batch([
      db()
        .prepare(
          "UPDATE deliveries SET status='published',external_id=?,updated=? WHERE id=?",
        )
        .bind(external, new Date().toISOString(), delivery),
      db()
        .prepare(
          "UPDATE posts SET status='partial',updated=?,version=version+1 WHERE id=?",
        )
        .bind(new Date().toISOString(), p.id),
    ]);
    return json({ ok: true, externalId: external });
  } catch (e) {
    if (delivery)
      await db()
        .prepare(
          "UPDATE deliveries SET status='check_required',error=?,updated=? WHERE id=?",
        )
        .bind(
          'Delivery was not confirmed. Check the social account before retrying.',
          new Date().toISOString(),
          delivery,
        )
        .run();
    return fail(e);
  }
}
