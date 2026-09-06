import postgres from 'postgres';
import { readFile } from 'node:fs/promises';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env.local.');

console.log('Connecting to Supabase...');

// Try with ssl: 'require' instead of 'verify-full' for Supabase direct connections
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  prepare: false,
  ssl: 'require',
  connect_timeout: 20,
});

try {
  const migration = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  console.log('Schema loaded, applying...');
  await sql.begin(async (transaction) => {
    await transaction.unsafe(migration);
  });
  console.log('✅ Supabase schema and private media bucket configured.');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  if (err.code) console.error('Error code:', err.code);
  process.exitCode = 1;
} finally {
  await sql.end();
}
