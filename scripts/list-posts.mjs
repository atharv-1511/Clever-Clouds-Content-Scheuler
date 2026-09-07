import postgres from 'postgres';
const url = 'postgresql://postgres.gtvuxlnrnnkanqkjinhw:Rainwalk%4019.ar@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const sql = postgres(url, { max: 1, ssl: 'require' });

async function run() {
  const result = await sql`SELECT id, title, status FROM posts ORDER BY created DESC LIMIT 20`;
  console.log(result);
  await sql.end();
}
run().catch(console.error);
