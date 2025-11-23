import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('\n🔍 Checking latest job error details...\n');
    
    // Get the most recent failed job
    const jobRes = await pool.query(`
      SELECT 
        j.id,
        j.status,
        j.error_message,
        j.error_code,
        j.created_at,
        o.id as outbox_id,
        o.status as outbox_status,
        o.attempts,
        o.payload
      FROM ai_enhancement_jobs j
      LEFT JOIN outbox o ON o.job_id = j.id
      WHERE j.status = 'failed'
      ORDER BY j.created_at DESC
      LIMIT 1
    `);
    
    if (jobRes.rows.length === 0) {
      console.log('❌ No failed jobs found');
      await pool.end();
      process.exit(0);
    }
    
    const job = jobRes.rows[0];
    console.log('📋 Latest Failed Job:');
    console.log(`  Job ID: ${job.id}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Error Message: ${job.error_message || 'None'}`);
    console.log(`  Error Code: ${job.error_code || 'None'}`);
    console.log(`  Created: ${job.created_at}`);
    console.log(`  Outbox Status: ${job.outbox_status || 'None'}`);
    console.log(`  Outbox Attempts: ${job.attempts || 0}`);
    
    if (job.payload) {
      const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
      console.log('\n📦 Outbox Payload Preview:');
      console.log(`  Job ID: ${payload.jobId}`);
      console.log(`  Mode: ${payload.mode || payload.options?.mode || 'None'}`);
      console.log(`  Image URL: ${payload.imageUrl ? payload.imageUrl.substring(0, 80) + '...' : 'None'}`);
      console.log(`  Composite URL: ${payload.compositeImageUrl ? 'Set' : 'Not set'}`);
      console.log(`  Masks Count: ${payload.masks?.length || 0}`);
      console.log(`  Callback URL: ${payload.callbackUrl || 'None'}`);
    }
    
    await pool.end();
    process.exit(0);
  } catch (e: any) {
    console.error('❌ Error:', e.message);
    console.error(e);
    await pool.end();
    process.exit(1);
  }
})();

