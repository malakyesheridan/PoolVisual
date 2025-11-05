import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function processMockJob(jobId: string) {
  console.log(`Processing mock job ${jobId}...`);
  
  try {
    // Get job data
    const jobRes = await pool.query(`
      SELECT id, tenant_id, user_id, photo_id, input_url, input_hash, masks, calibration_pixels_per_meter, options, provider, model
      FROM ai_enhancement_jobs
      WHERE id = $1
    `, [jobId]);
    
    if (!jobRes.rows.length) throw new Error('Job not found');
    const job = jobRes.rows[0];
    
    // Follow state machine: queued → downloading → preprocessing → rendering → postprocessing → uploading → completed
    await pool.query(`UPDATE ai_enhancement_jobs SET status='downloading', progress_stage='downloading', progress_percent=10, updated_at=NOW() WHERE id=$1`, [jobId]);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await pool.query(`UPDATE ai_enhancement_jobs SET status='preprocessing', progress_stage='preprocessing', progress_percent=25, updated_at=NOW() WHERE id=$1`, [jobId]);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await pool.query(`UPDATE ai_enhancement_jobs SET status='rendering', progress_stage='rendering', progress_percent=50, updated_at=NOW() WHERE id=$1`, [jobId]);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    await pool.query(`UPDATE ai_enhancement_jobs SET status='postprocessing', progress_stage='postprocessing', progress_percent=75, updated_at=NOW() WHERE id=$1`, [jobId]);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await pool.query(`UPDATE ai_enhancement_jobs SET status='uploading', progress_stage='uploading', progress_percent=90, updated_at=NOW() WHERE id=$1`, [jobId]);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Update to completed
    await pool.query(`
      UPDATE ai_enhancement_jobs 
      SET status='completed', progress_stage='completed', progress_percent=100, 
          cost_micros=100000, completed_at=NOW(), updated_at=NOW()
      WHERE id=$1
    `, [jobId]);
    
    console.log('✅ Job completed!');
    
  } catch (e: any) {
    console.error('❌ Error:', e.message);
    await pool.query(`UPDATE ai_enhancement_jobs SET status='failed', error_message=$1, updated_at=NOW() WHERE id=$2`, [e.message, jobId]);
  }
  
  await pool.end();
}

processMockJob(process.argv[2] || 'a35cd7c5-32ad-4dff-bfec-af07ec6457b1');

