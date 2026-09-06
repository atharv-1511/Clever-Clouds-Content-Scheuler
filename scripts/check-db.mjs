import postgres from 'postgres';

const sql = postgres('postgresql://postgres.gtvuxlnrnnkanqkjinhw:Rainwalk%4019.ar@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', {
  ssl: 'require',
});

async function run() {
  const deliveries = await sql`SELECT * FROM deliveries ORDER BY updated DESC LIMIT 5`;
  console.log('Deliveries:');
  console.dir(deliveries, { depth: null });
  
  const posts = await sql`SELECT * FROM posts ORDER BY updated DESC LIMIT 5`;
  console.log('\nPosts:');
  console.dir(posts, { depth: null });
  process.exit(0);
}

run();
