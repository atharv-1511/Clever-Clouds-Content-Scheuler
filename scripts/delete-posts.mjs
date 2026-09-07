import postgres from 'postgres';
const url = 'postgresql://postgres.gtvuxlnrnnkanqkjinhw:Rainwalk%4019.ar@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const sql = postgres(url, { max: 1, ssl: 'require' });

async function run() {
  const titles = ['dfs', 'fds', 'Test', 'Testestset'];
  const result = await sql`DELETE FROM posts WHERE title IN ${sql(titles)}`;
  console.log(`Deleted ${result.count} posts.`);
  await sql.end();
}
run().catch(console.error);
