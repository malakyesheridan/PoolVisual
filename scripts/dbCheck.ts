#!/usr/bin/env tsx
// Database connectivity probe script
import { Pool } from 'pg';

async function checkDatabase() {
  const cs = process.env.DATABASE_URL;
  
  if (!cs) {
    console.log('PG FAIL: No DATABASE_URL');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
  });

  try {
    await pool.query('SELECT 1');
    await pool.end();
    console.log('PG OK');
    process.exit(0);
  } catch (error: any) {
    await pool.end();
    console.log(`PG FAIL: ${error.message}`);
    process.exit(1);
  }
}

checkDatabase();
