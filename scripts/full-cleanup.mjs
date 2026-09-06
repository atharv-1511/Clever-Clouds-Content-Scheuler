import postgres from 'postgres';

const sql = postgres('postgresql://postgres.gtvuxlnrnnkanqkjinhw:Rainwalk%4019.ar@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', {
  ssl: 'require',
});

async function run() {
  // 1. Delete ALL deliveries (all are failed/ghost)
  const del = await sql`DELETE FROM deliveries`;
  console.log(`Deleted ${del.count} deliveries.`);

  // 2. Delete all posts that have no media_id and are targeted at YouTube
  // (these are the junk test posts with no video attached)
  const delPosts = await sql`DELETE FROM posts WHERE media_id IS NULL AND platforms::text LIKE '%YouTube%'`;
  console.log(`Deleted ${delPosts.count} YouTube posts with no media.`);

  // 3. Reset any remaining partial/published posts back to planned
  const reset = await sql`UPDATE posts SET status = 'planned', version = version + 1 WHERE status IN ('partial', 'published') AND platforms::text NOT LIKE '%Instagram%'`;
  console.log(`Reset ${reset.count} posts back to planned.`);

  // 4. Show what's left
  const remaining = await sql`SELECT id, title, status, platforms, media_id, scheduled_at FROM posts ORDER BY created DESC`;
  console.log('\nRemaining posts:');
  remaining.forEach(p => console.log(` - [${p.status}] ${p.title} | platforms: ${p.platforms} | media: ${p.media_id || 'none'} | scheduled: ${p.scheduled_at}`));

  process.exit(0);
}

run();
