import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, {
  max: 1, prepare: false, ssl: 'require', connect_timeout: 10,
});

try {
  const tables = await sql`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `;
  console.log('Tables in database:');
  tables.forEach(t => console.log(' -', t.tablename));

  const buckets = await sql`
    SELECT id, name, public FROM storage.buckets;
  `;
  console.log('\nStorage buckets:');
  buckets.forEach(b => console.log(` - ${b.name} (public: ${b.public})`));
} catch (err) {
  console.error('Check failed:', err.message);
} finally {
  await sql.end();
}
