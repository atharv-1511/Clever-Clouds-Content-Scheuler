import postgres from 'postgres';

// URL provided by user
// They said: postgresql://postgres.gtvuxlnrnnkanqkjinhw:Rainwalk%40@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
// Wait, the previous password was Rainwalk@19.ar -> Rainwalk%4019.ar
// Let's test their exact URL, and also the corrected one if that fails.

async function testConnection(url) {
  console.log(`Testing URL: ${url.replace(/:[^:@]*@/, ':***@')}`);
  const sql = postgres(url, {
    max: 1, prepare: false, ssl: 'require', connect_timeout: 10,
  });
  
  try {
    const result = await sql`SELECT 1 as test;`;
    console.log('✅ Connection successful!');
    return true;
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    return false;
  } finally {
    await sql.end();
  }
}

async function main() {
  const url1 = 'postgresql://postgres.gtvuxlnrnnkanqkjinhw:Rainwalk%40@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
  const url2 = 'postgresql://postgres.gtvuxlnrnnkanqkjinhw:Rainwalk%4019.ar@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
  
  console.log('--- Test 1 (User provided) ---');
  await testConnection(url1);
  
  console.log('\n--- Test 2 (Assuming full password) ---');
  await testConnection(url2);
}

main();
