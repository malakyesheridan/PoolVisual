import { Pool } from "pg";
import { drizzle } from 'drizzle-orm/node-postgres';

let pool: Pool | null = null;

function createPool() {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    if (process.env.NO_DB_MODE === 'true') {
      console.log('[DB] Running in no-DB mode');
      return null;
    }
    throw new Error("DATABASE_URL not set");
  }

  return new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

if (!(global as any).__pgPool) {
  (global as any).__pgPool = createPool();
}
pool = (global as any).__pgPool as Pool | null;

// Create drizzle db instance
const db = pool ? drizzle(pool) : null;

export async function checkDb() {
  if (!pool) {
    return { ok: false as const, reason: 'no-db' };
  }
  
  try {
    await pool.query("SELECT 1");
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, reason: 'connect-failed', error: e?.message || String(e) };
  }
}

export { pool, db };
