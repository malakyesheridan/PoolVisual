import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('\n🔍 Checking outbox processing status and recent errors...\n');
    
    // Get recent outbox events with their processing history
    const eventsRes = await pool.query(`
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
        j.error_code,
        j.created_at as job_created_at
      FROM outbox o
      LEFT JOIN ai_enhancement_jobs j ON j.id = o.job_id
      WHERE o.created_at > NOW() - INTERVAL '1 hour'
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    
    console.log(`📋 Found ${eventsRes.rows.length} recent outbox events:\n`);
    
    for (const ev of eventsRes.rows) {
      const age = new Date().getTime() - new Date(ev.created_at).getTime();
      const ageSeconds = Math.floor(age / 1000);
      const ageMinutes = Math.floor(ageSeconds / 60);
      
      console.log(`📦 Event ${ev.id.substring(0, 8)}...`);
      console.log(`   Job: ${ev.job_id.substring(0, 8)}... - Status: ${ev.job_status}`);
      console.log(`   Outbox Status: ${ev.status} (attempts: ${ev.attempts})`);
      console.log(`   Age: ${ageMinutes}m ${ageSeconds % 60}s`);
      
      if (ev.status === 'failed') {
        console.log(`   ❌ FAILED: ${ev.error_message || 'No error message'}`);
        console.log(`   Error Code: ${ev.error_code || 'None'}`);
      } else if (ev.status === 'processing') {
        console.log(`   ⚠️  STUCK IN PROCESSING (${ageMinutes} minutes old)`);
      } else if (ev.status === 'pending') {
        if (ev.next_retry_at) {
          const retryTime = new Date(ev.next_retry_at).getTime();
          const now = Date.now();
          if (retryTime > now) {
            const waitSeconds = Math.floor((retryTime - now) / 1000);
            console.log(`   ⏳ Pending retry in ${waitSeconds} seconds`);
          } else {
            console.log(`   ✅ Ready to process (retry time passed)`);
          }
        } else {
          console.log(`   ✅ Ready to process`);
        }
      } else if (ev.status === 'completed') {
        console.log(`   ✅ COMPLETED at ${ev.processed_at}`);
      }
      console.log('');
    }
    
    // Check if outbox processor is working
    const pendingCount = await pool.query(`SELECT COUNT(*) as count FROM outbox WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW())`);
    const processingCount = await pool.query(`SELECT COUNT(*) as count FROM outbox WHERE status = 'processing'`);
    const stuckCount = await pool.query(`SELECT COUNT(*) as count FROM outbox WHERE status = 'processing' AND created_at < NOW() - INTERVAL '5 minutes'`);
    
    console.log('📊 Processing Status:');
    console.log(`   Ready to process: ${pendingCount.rows[0].count}`);
    console.log(`   Currently processing: ${processingCount.rows[0].count}`);
    console.log(`   Stuck (>5 min): ${stuckCount.rows[0].count}`);
    
    if (parseInt(stuckCount.rows[0].count) > 0) {
      console.log('\n⚠️  WARNING: There are stuck processing events!');
      console.log('   Run: npx tsx scripts/resetStuckOutbox.ts');
    }
    
    if (parseInt(pendingCount.rows[0].count) > 0 && parseInt(processingCount.rows[0].count) === 0) {
      console.log('\n⚠️  WARNING: Events are pending but nothing is processing!');
      console.log('   The outbox processor may not be running.');
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

