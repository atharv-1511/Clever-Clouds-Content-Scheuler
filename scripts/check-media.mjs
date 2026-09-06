import postgres from 'postgres';

const sql = postgres('postgresql://postgres.gtvuxlnrnnkanqkjinhw:Rainwalk%4019.ar@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', {
  ssl: 'require',
});

async function run() {
  // Check if media table exists
  try {
    const media = await sql`SELECT id, name, type, size FROM media ORDER BY id LIMIT 10`;
    console.log('Media table records:', media.length);
    media.forEach(m => console.log(` - ${m.id} | ${m.name} | ${m.type} | ${m.size} bytes`));
  } catch (e) {
    console.error('Media table error:', e.message);
  }
  process.exit(0);
}

run();
