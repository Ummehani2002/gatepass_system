import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from '../src/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = await readFile(join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  console.log('Applying schema…');
  await pool.query(sql);
  console.log('✓ Schema created.');
  await pool.end();
}

main().catch(err => { console.error('Setup failed:', err.message); process.exit(1); });
