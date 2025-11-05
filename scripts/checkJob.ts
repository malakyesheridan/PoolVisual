import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const res = await pool.query(`
      SELECT id, status, progress_stage, progress_percent, created_at 
      FROM ai_enhancement_jobs 
      WHERE id = $1
    `, [process.argv[2] || '45a3f4b1-32d8-441a-aa75-302175513740']);
    
    console.log(JSON.stringify(res.rows, null, 2));
    
    const outboxRes = await pool.query(`
      SELECT job_id, status, attempts, created_at
      FROM outbox 
      WHERE job_id = $1
      ORDER BY created_at DESC
      LIMIT 3
    `, [process.argv[2] || '45a3f4b1-32d8-441a-aa75-302175513740']);
    
    console.log('\nOutbox:', JSON.stringify(outboxRes.rows, null, 2));
    
    await pool.end();
  } catch (e: any) {
    console.error(e.message);
    await pool.end();
  }
})();

