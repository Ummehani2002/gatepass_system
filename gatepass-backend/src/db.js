import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const useSsl = String(process.env.PGSSL || '').toLowerCase() === 'true';

export const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'acacia_gatepass',
        ssl: useSsl ? { rejectUnauthorized: false } : false,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err);
});

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
