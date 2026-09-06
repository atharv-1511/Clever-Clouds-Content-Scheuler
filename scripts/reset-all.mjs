import postgres from 'postgres';

const sql = postgres('postgresql://postgres.gtvuxlnrnnkanqkjinhw:Rainwalk%4019.ar@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', {
  ssl: 'require',
});

async function run() {
  // Delete ALL failed deliveries
  const del = await sql`DELETE FROM deliveries WHERE status IN ('check_required', 'sending')`;
  console.log(`Deleted ${del.count} failed/stuck deliveries.`);

  // Reset all partial posts back to planned so the cron can pick them up fresh
  const upd = await sql`UPDATE posts SET status = 'planned', version = version + 1 WHERE status = 'partial'`;
  console.log(`Reset ${upd.count} partial posts to planned.`);

  process.exit(0);
}

run();
