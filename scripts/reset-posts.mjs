import postgres from 'postgres';

const sql = postgres('postgresql://postgres.gtvuxlnrnnkanqkjinhw:Rainwalk%4019.ar@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', {
  ssl: 'require',
});

async function run() {
  await sql`DELETE FROM deliveries WHERE post_id IN ('d0140ccb-3507-49f0-967f-bbed1c23feb9', '3ee06966-012d-470e-bfbf-8669131b5053')`;
  await sql`UPDATE posts SET status = 'planned', version = version + 1 WHERE id IN ('d0140ccb-3507-49f0-967f-bbed1c23feb9', '3ee06966-012d-470e-bfbf-8669131b5053')`;
  console.log('Posts reset.');
  process.exit(0);
}

run();
