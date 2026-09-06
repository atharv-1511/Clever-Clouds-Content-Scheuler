import postgres from 'postgres';
import { readFile } from 'node:fs/promises';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env.local.');
const sql = postgres(process.env.DATABASE_URL, {
  max: 1, prepare: false, ssl: 'verify-full', connect_timeout: 10,
});
try {
  const migration = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  await sql.begin(async (transaction) => {
    await transaction.unsafe(migration);
  });
  console.log('Supabase schema and private media bucket configured.');
} catch {
  console.error('Migration failed. Check database connectivity, permissions, and existing schema. No credentials are printed.');
  process.exitCode = 1;
} finally {
  await sql.end();
}
