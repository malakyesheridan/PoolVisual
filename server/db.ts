// Use Neon serverless driver for Vercel, regular pg Pool for local development
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

let sql: ReturnType<typeof neon> | null = null;
let db: NeonHttpDatabase | null = null;

function createConnection(): ReturnType<typeof neon> | null {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    if (process.env.NO_DB_MODE === 'true') {
      console.log('[DB] Running in no-DB mode');
      return null;
    }
    throw new Error("DATABASE_URL not set");
  }

  try {
    // Use Neon serverless driver for better Vercel compatibility
    const neonClient = neon(cs);
    console.log('[DB] Neon client created successfully');
    // Type assertion needed due to Neon's strict generic types
    return neonClient as ReturnType<typeof neon>;
  } catch (error: any) {
    console.error('[DB] Failed to create Neon client:', error?.message || String(error));
    throw error;
  }
}

// Initialize connection lazily (not at module load time for better serverless compatibility)
function getSql(): ReturnType<typeof neon> | null {
  if (!sql) {
    sql = createConnection();
  }
  return sql;
}

function getDb() {
  // Ensure sql is initialized first
  if (!sql) {
    sql = getSql();
  }
  if (!db && sql) {
    db = drizzle(sql);
  }
  return db;
}

export async function checkDb() {
  if (!process.env.DATABASE_URL || process.env.NO_DB_MODE === 'true') {
    return { ok: false as const, reason: 'no-db' };
  }
  
  try {
    const client = getSql();
    if (!client) {
      return { ok: false as const, reason: 'no-db' };
    }
    // Neon client uses tagged template literals
    await client`SELECT 1`;
    return { ok: true as const };
  } catch (e: any) {
    console.error('[DB] Connection check failed:', e?.message || String(e));
    return { ok: false as const, reason: 'connect-failed', error: e?.message || String(e) };
  }
}

// Export db for use in storage.ts
export function getDatabase() {
  return getDb();
}

// Export sql client for direct queries if needed
export { getSql };
