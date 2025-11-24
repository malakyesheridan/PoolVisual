/**
 * Diagnostic script to check if variants exist for a specific job
 */

import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';

const jobId = process.argv[2] || 'f57c3e38-51e4-46d7-b7bb-ebff1e2224ab';

async function checkJobVariants() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log(`\n🔍 Checking job: ${jobId}\n`);
    
    // Check job status
    const jobRows = await pool.query(
      `SELECT 
        id, status, progress_stage, progress_percent,
        error_message, error_code, created_at, updated_at, completed_at
      FROM ai_enhancement_jobs 
      WHERE id = $1`,
      [jobId]
    );
    
    if (jobRows.rows.length === 0) {
      console.log('❌ Job not found in database');
      return;
    }
    
    const job = jobRows.rows[0];
    console.log('📋 Job Details:');
    console.log(`   Status: ${job.status}`);
    console.log(`   Progress: ${job.progress_percent}% (${job.progress_stage})`);
    console.log(`   Created: ${job.created_at}`);
    console.log(`   Updated: ${job.updated_at}`);
    if (job.completed_at) {
      console.log(`   Completed: ${job.completed_at}`);
    }
    if (job.error_message) {
      console.log(`   Error: ${job.error_message}`);
    }
    
    // Check variants
    const variantRows = await pool.query(
      `SELECT id, output_url as url, rank, created_at 
      FROM ai_enhancement_variants 
      WHERE job_id = $1 
      ORDER BY rank`,
      [jobId]
    );
    
    console.log(`\n🎨 Variants: ${variantRows.rows.length}`);
    
    if (variantRows.rows.length === 0) {
      console.log('   ❌ NO VARIANTS FOUND IN DATABASE');
      console.log('   This means the callback did not save variants, or they were saved to a different job ID.');
    } else {
      variantRows.rows.forEach((variant, idx) => {
        console.log(`\n   Variant ${idx + 1}:`);
        console.log(`      ID: ${variant.id}`);
        console.log(`      Rank: ${variant.rank}`);
        console.log(`      URL: ${variant.url}`);
        console.log(`      Created: ${variant.created_at}`);
      });
    }
    
    // Check outbox events
    const outboxRows = await pool.query(
      `SELECT id, status, attempts, error_message, created_at, updated_at
      FROM ai_enhancement_outbox
      WHERE job_id = $1
      ORDER BY created_at DESC
      LIMIT 5`,
      [jobId]
    );
    
    console.log(`\n📦 Outbox Events: ${outboxRows.rows.length}`);
    outboxRows.rows.forEach((event, idx) => {
      console.log(`\n   Event ${idx + 1}:`);
      console.log(`      Status: ${event.status}`);
      console.log(`      Attempts: ${event.attempts}`);
      console.log(`      Created: ${event.created_at}`);
      console.log(`      Updated: ${event.updated_at}`);
      if (event.error_message) {
        console.log(`      Error: ${event.error_message.substring(0, 200)}...`);
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

checkJobVariants();
