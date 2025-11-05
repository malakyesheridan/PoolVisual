import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    await pool.query('ALTER TABLE ai_enhancement_jobs ADD COLUMN IF NOT EXISTS normalized_cache_key TEXT');
    await pool.query('ALTER TABLE ai_enhancement_jobs ADD COLUMN IF NOT EXISTS provider_idempotency_key TEXT');
    await pool.query('ALTER TABLE ai_enhancement_jobs ADD COLUMN IF NOT EXISTS reserved_cost_micros INTEGER');
    console.log('✅ Fixed');
    await pool.end();
  } catch (e: any) {
    console.error(e.message);
    await pool.end();
    process.exit(1);
  }
})();

