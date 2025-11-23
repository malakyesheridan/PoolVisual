import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('\n🔄 Resetting stuck "processing" events...\n');
    
    // Reset stuck processing events
    const resetRes = await pool.query(`
      UPDATE outbox
      SET status = 'pending', next_retry_at = NOW()
      WHERE status = 'processing' 
        AND created_at < NOW() - INTERVAL '5 minutes'
      RETURNING id, job_id, created_at
    `);
    
    console.log(`✅ Reset ${resetRes.rows.length} stuck events back to "pending":\n`);
    resetRes.rows.forEach((ev, i) => {
      const age = new Date().getTime() - new Date(ev.created_at).getTime();
      const ageMinutes = Math.floor(age / 60000);
      console.log(`  ${i + 1}. Event ${ev.id.substring(0, 8)}... - Job ${ev.job_id.substring(0, 8)}... - Age: ${ageMinutes} minutes`);
    });
    
    // Check current status
    const pendingRes = await pool.query(`SELECT COUNT(*) as count FROM outbox WHERE status = 'pending'`);
    const processingRes = await pool.query(`SELECT COUNT(*) as count FROM outbox WHERE status = 'processing'`);
    const failedRes = await pool.query(`SELECT COUNT(*) as count FROM outbox WHERE status = 'failed'`);
    
    console.log('\n📊 Updated Outbox Summary:');
    console.log(`  Pending: ${pendingRes.rows[0].count}`);
    console.log(`  Processing: ${processingRes.rows[0].count}`);
    console.log(`  Failed: ${failedRes.rows[0].count}`);
    
    await pool.end();
    process.exit(0);
  } catch (e: any) {
    console.error('❌ Error:', e.message);
    console.error(e);
    await pool.end();
    process.exit(1);
  }
})();

