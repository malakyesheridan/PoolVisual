/**
 * Test script to verify GET /api/ai/enhancement/:id returns variants correctly
 * This simulates what the client polling does
 */

import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';

const jobId = process.argv[2] || 'f57c3e38-51e4-46d7-b7bb-ebff1e2224ab';

async function testGetJob() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log(`\n🔍 Testing GET job endpoint logic for: ${jobId}\n`);
    
    // Simulate the GET endpoint query
    const rows = await pool.query(
      `SELECT 
        id, status, progress_stage, progress_percent,
        error_message, error_code, created_at, updated_at, completed_at, options
      FROM ai_enhancement_jobs 
      WHERE id = $1`,
      [jobId]
    );
    
    if (rows.rows.length === 0) {
      console.log('❌ Job not found in database');
      return;
    }
    
    const job = rows.rows[0];
    console.log('📋 Job Details:');
    console.log(`   Status: ${job.status}`);
    console.log(`   Progress: ${job.progress_percent}% (${job.progress_stage})`);
    
    // Extract mode from options (simulating server logic)
    let mode: 'add_pool' | 'add_decoration' | 'blend_materials' | undefined;
    if (job.options) {
      try {
        const options = typeof job.options === 'string' ? JSON.parse(job.options) : job.options;
        mode = options.mode;
        console.log(`   Mode: ${mode}`);
      } catch (e) {
        console.log(`   Mode: (parse error)`);
      }
    }
    
    // Fetch variants if completed (simulating server logic)
    if (job.status === 'completed') {
      console.log(`\n✅ Job is completed - fetching variants...`);
      const variants = await pool.query(
        `SELECT id, output_url as url, rank FROM ai_enhancement_variants WHERE job_id = $1 ORDER BY rank`,
        [jobId]
      );
      
      console.log(`\n🎨 Variants returned: ${variants.rows.length}`);
      if (variants.rows.length > 0) {
        variants.rows.forEach((variant, idx) => {
          console.log(`   Variant ${idx + 1}:`);
          console.log(`      ID: ${variant.id}`);
          console.log(`      Rank: ${variant.rank}`);
          console.log(`      URL: ${variant.url}`);
        });
        console.log(`\n✅ GET endpoint WOULD return variants correctly`);
      } else {
        console.log(`\n❌ GET endpoint would NOT return variants (none in database)`);
      }
    } else {
      console.log(`\n⚠️ Job is not completed (status: ${job.status}) - GET endpoint would NOT fetch variants`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testGetJob();

