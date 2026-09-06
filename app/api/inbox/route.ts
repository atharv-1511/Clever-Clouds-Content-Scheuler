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
async function account(id: string) {
  const a = await db()
    .prepare('SELECT * FROM accounts WHERE id=?')
    .bind(id)
    .first<Account>();
  if (!a) throw new AppError('Connect an account first.');
  return a;
}
export async function GET(request: Request) {
  try {
    await authorize();
    const url = new URL(request.url);
    const a = await account(text(url.searchParams.get('account'), 512));
    const token = await access(a);
    const cursor = url.searchParams.get('cursor') || '';
    if (cursor.length > 2048) throw new AppError('Invalid page.');
    if (a.provider === 'gbp') {
      const r = await api(
        `https://mybusiness.googleapis.com/v4/${a.external_id}/reviews?pageSize=50${cursor ? '&pageToken=' + encodeURIComponent(cursor) : ''}`,
        token,
      );
      return json({
        items: (r.reviews || []).map((r: any) => ({
          id: r.reviewId,
          author: r.reviewer?.displayName || 'Google reviewer',
          text: r.comment || 'Rating only',
          rating: r.starRating,
          date: r.updateTime,
          reply: r.reviewReply?.comment || '',
          recipient: null,
        })),
        cursor: r.nextPageToken || null,
        type: 'reviews',
      });
    }
    if (a.platform === 'Facebook' || a.platform === 'Instagram') {
      const r = await api(
        `https://graph.facebook.com/v23.0/${encodeURIComponent(a.external_id)}/conversations?fields=id,participants,messages.limit(10){message,from,created_time}&limit=25${a.platform === 'Instagram' ? '&platform=instagram' : ''}${cursor ? '&after=' + encodeURIComponent(cursor) : ''}`,
        token,
      );
      return json({
        items: (r.data || []).map((c: any) => {
          const recipient = c.participants?.data?.find(
            (p: any) => p.id !== a.external_id,
          );
          return {
            id: c.id,
            author: recipient?.name || recipient?.username || 'Conversation',
            recipient: recipient?.id,
            text: (c.messages?.data || [])
              .map(
                (m: any) =>
                  `${m.from?.name || 'Message'}: ${m.message || '[Attachment]'}`,
              )
              .join('\n'),
            date: c.messages?.data?.[0]?.created_time,
            reply: '',
          };
        }),
        cursor: r.paging?.next ? r.paging?.cursors?.after : null,
        type: 'messages',
      });
    }
    throw new AppError(
      'This account does not support the inbox in this version.',
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
    const a = await account(text(b.account, 512));
    const message = text(b.message, 2000);
    const token = await access(a);
    if (a.provider === 'gbp') {
      const id = text(b.id, 512);
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new AppError('Invalid review.');
      await api(
        `https://mybusiness.googleapis.com/v4/${a.external_id}/reviews/${id}/reply`,
        token,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: message }),
        },
      );
    } else if (a.platform === 'Facebook' || a.platform === 'Instagram') {
      const recipient = text(b.recipient, 100);
      if (!/^\d+$/.test(recipient))
        throw new AppError(
          'This conversation does not have a supported recipient.',
        );
      await api(
        `https://graph.facebook.com/v23.0/${encodeURIComponent(a.external_id)}/messages`,
        token,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: recipient },
            message: { text: message },
            ...(a.platform === 'Facebook'
              ? { messaging_type: 'RESPONSE' }
              : {}),
          }),
        },
      );
    } else throw new AppError('Replies are unavailable for this platform.');
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
