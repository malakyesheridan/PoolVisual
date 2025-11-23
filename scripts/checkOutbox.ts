import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('\n🔍 Checking outbox events for recent enhancement jobs...\n');
    
    // Get recent jobs
    const jobsRes = await pool.query(`
      SELECT id, status, created_at, updated_at
      FROM ai_enhancement_jobs 
      WHERE created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`📋 Found ${jobsRes.rows.length} recent jobs:\n`);
    jobsRes.rows.forEach((job, i) => {
      console.log(`  ${i + 1}. Job ${job.id.substring(0, 8)}... - Status: ${job.status} - Created: ${job.created_at}`);
    });
    
    if (jobsRes.rows.length === 0) {
      console.log('❌ No recent jobs found');
      await pool.end();
      process.exit(0);
    }
    
    // Check outbox for each job
    console.log('\n📦 Checking outbox events:\n');
    for (const job of jobsRes.rows) {
      const outboxRes = await pool.query(`
        SELECT id, event_type, status, attempts, created_at, next_retry_at, processed_at
        FROM outbox 
        WHERE job_id = $1 
        ORDER BY created_at DESC
      `, [job.id]);
      
      if (outboxRes.rows.length === 0) {
        console.log(`  ❌ Job ${job.id.substring(0, 8)}... - NO OUTBOX EVENT FOUND`);
      } else {
        outboxRes.rows.forEach((ev) => {
          console.log(`  ✅ Job ${job.id.substring(0, 8)}... - Outbox: ${ev.status} (attempts: ${ev.attempts})`);
          console.log(`     Event ID: ${ev.id.substring(0, 8)}... - Type: ${ev.event_type}`);
          console.log(`     Created: ${ev.created_at} - Processed: ${ev.processed_at || 'NOT YET'}`);
          if (ev.next_retry_at) {
            console.log(`     Next retry: ${ev.next_retry_at}`);
          }
        });
      }
    }
    
    // Check pending events
    const pendingRes = await pool.query(`
      SELECT COUNT(*) as count
      FROM outbox
      WHERE status = 'pending'
    `);
    
    const processingRes = await pool.query(`
      SELECT COUNT(*) as count
      FROM outbox
      WHERE status = 'processing'
    `);
    
    const failedRes = await pool.query(`
      SELECT COUNT(*) as count
      FROM outbox
      WHERE status = 'failed'
    `);
    
    console.log('\n📊 Outbox Summary:');
    console.log(`  Pending: ${pendingRes.rows[0].count}`);
    console.log(`  Processing: ${processingRes.rows[0].count}`);
    console.log(`  Failed: ${failedRes.rows[0].count}`);
    
    // Check environment
    console.log('\n🔧 Environment Check:');
    console.log(`  N8N_WEBHOOK_URL: ${process.env.N8N_WEBHOOK_URL ? '✅ SET' : '❌ NOT SET'}`);
    if (process.env.N8N_WEBHOOK_URL) {
      console.log(`  URL: ${process.env.N8N_WEBHOOK_URL.substring(0, 50)}...`);
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

