import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const jobId = process.argv[2] || 'efab4985-e34d-48a7-9f0b-f2805886ef6f';

(async () => {
  try {
    console.log(`\n🔍 Checking job: ${jobId}\n`);
    
    // Check job status
    const jobRes = await pool.query(`
      SELECT id, status, progress_stage, progress_percent, created_at, completed_at, updated_at
      FROM ai_enhancement_jobs 
      WHERE id = $1
    `, [jobId]);
    
    if (jobRes.rows.length === 0) {
      console.log('❌ Job not found');
      await pool.end();
      process.exit(1);
    }
    
    const job = jobRes.rows[0];
    console.log('📋 Job Status:');
    console.log(JSON.stringify(job, null, 2));
    
    // Check variants
    const variantsRes = await pool.query(`
      SELECT id, job_id, output_url, rank, created_at
      FROM ai_enhancement_variants 
      WHERE job_id = $1
      ORDER BY rank
    `, [jobId]);
    
    console.log(`\n🖼️  Variants (${variantsRes.rows.length}):`);
    if (variantsRes.rows.length === 0) {
      console.log('❌ No variants found!');
    } else {
      variantsRes.rows.forEach((v, i) => {
        console.log(`  ${i + 1}. Rank ${v.rank}: ${v.output_url.substring(0, 80)}...`);
      });
      console.log(JSON.stringify(variantsRes.rows, null, 2));
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

