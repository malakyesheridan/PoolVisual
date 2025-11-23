import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('\n🔍 Checking failed outbox events for error details...\n');
    
    // Get failed events with their payloads
    const failedRes = await pool.query(`
      SELECT 
        o.id,
        o.job_id,
        o.event_type,
        o.status,
        o.attempts,
        o.created_at,
        o.next_retry_at,
        o.processed_at,
        j.status as job_status,
        j.error_message,
        j.error_code
      FROM outbox o
      LEFT JOIN ai_enhancement_jobs j ON j.id = o.job_id
      WHERE o.status = 'failed'
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    
    console.log(`📋 Found ${failedRes.rows.length} failed events:\n`);
    failedRes.rows.forEach((ev, i) => {
      console.log(`  ${i + 1}. Event ${ev.id.substring(0, 8)}...`);
      console.log(`     Job: ${ev.job_id.substring(0, 8)}... - Status: ${ev.job_status}`);
      console.log(`     Attempts: ${ev.attempts}`);
      console.log(`     Job Error: ${ev.error_message || 'None'}`);
      console.log(`     Error Code: ${ev.error_code || 'None'}`);
      console.log('');
    });
    
    // Get stuck processing events
    const stuckRes = await pool.query(`
      SELECT 
        o.id,
        o.job_id,
        o.event_type,
        o.attempts,
        o.created_at,
        j.status as job_status
      FROM outbox o
      LEFT JOIN ai_enhancement_jobs j ON j.id = o.job_id
      WHERE o.status = 'processing'
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    
    console.log(`\n⚠️  Found ${stuckRes.rows.length} events stuck in 'processing' status:\n`);
    stuckRes.rows.forEach((ev, i) => {
      const age = new Date().getTime() - new Date(ev.created_at).getTime();
      const ageMinutes = Math.floor(age / 60000);
      console.log(`  ${i + 1}. Event ${ev.id.substring(0, 8)}...`);
      console.log(`     Job: ${ev.job_id.substring(0, 8)}... - Status: ${ev.job_status}`);
      console.log(`     Attempts: ${ev.attempts} - Age: ${ageMinutes} minutes`);
      console.log('');
    });
    
    await pool.end();
    process.exit(0);
  } catch (e: any) {
    console.error('❌ Error:', e.message);
    console.error(e);
    await pool.end();
    process.exit(1);
  }
})();

