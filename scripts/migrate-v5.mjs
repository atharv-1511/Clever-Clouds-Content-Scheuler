import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));

const url = 'postgresql://postgres.gtvuxlnrnnkanqkjinhw:Rainwalk%4019.ar@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const sql = postgres(url, { max: 1, prepare: false, ssl: 'require', connect_timeout: 20 });

try {
  const migration = await readFile(join(__dirname, '../supabase/migrate_v5.sql'), 'utf8');
  await sql.unsafe(migration);
  console.log('✅ Migration v5 applied successfully.');
} catch (e) {
  console.error('❌ Migration failed:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
