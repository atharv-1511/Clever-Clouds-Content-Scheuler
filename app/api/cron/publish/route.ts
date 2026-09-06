import { db, fail, json, AppError } from '@/lib/server';
import { publishPost } from '@/lib/publish';
import type { Account } from '@/lib/oauth';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      throw new AppError('Unauthorized cron request', 401);
    }

    const now = new Date().toISOString();

    // 1. Find all planned posts whose time has come
    const posts = await db()
      .prepare("SELECT * FROM posts WHERE status = 'planned' AND scheduled_at <= ?")
      .bind(now)
      .all<any>();

    if (!posts.results.length) {
      return json({ ok: true, message: 'No scheduled posts to publish.' });
    }

    // 2. Load all connected accounts
    const accountsResult = await db().prepare('SELECT * FROM accounts').all<Account>();
    const allAccounts = accountsResult.results;

    const results = [];

    // 3. Publish each post
    for (const post of posts.results) {
      let version = post.version;
      const platforms = JSON.parse(post.platforms);
      const targetAccounts = allAccounts.filter(a => platforms.includes(a.platform));
      
      const postResults = [];

      for (const account of targetAccounts) {
        try {
          // Check if this delivery already exists to avoid duplicate sends
          // publishPost does this internally, but it's good to be aware.
          const res = await publishPost(post.id, account.id, version);
          version = res.newVersion ?? version + 1;
          postResults.push({ account: account.name, platform: account.platform, success: true, externalId: res.externalId });
        } catch (err: any) {
          // If a post fails to publish for one account, we log it but continue to other accounts
          postResults.push({ account: account.name, platform: account.platform, success: false, error: err.message });
          // Note: if publishPost fails before updating the version, version shouldn't increment.
          // BUT publishPost might have locked and updated the version BEFORE failing the API call (e.g. if the network request fails).
          // Let's re-fetch the version to be absolutely safe for the next iteration.
          const updatedPost = await db().prepare('SELECT version FROM posts WHERE id=?').bind(post.id).first<{version: number}>();
          if (updatedPost) version = updatedPost.version;
        }
      }

      // Mark post as 'published' when all accounts succeeded so the cron won't re-attempt it
      const allSucceeded = postResults.every(r => r.success);
      await db()
        .prepare("UPDATE posts SET status=?, version=version+1, updated=? WHERE id=?")
        .bind(allSucceeded ? 'published' : 'partial', new Date().toISOString(), post.id)
        .run();

      results.push({ postId: post.id, title: post.title, deliveries: postResults });
    }

    return json({ ok: true, published: results });
  } catch (e) {
    return fail(e);
  }
}
