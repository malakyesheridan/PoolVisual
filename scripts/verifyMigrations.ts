/**
 * Verify that recent migrations have been applied
 */

import { Pool } from 'pg';
import '../server/bootstrapEnv.js';

async function verifyMigrations() {
  const cs = process.env.DATABASE_URL;
  
  if (!cs) {
    console.error('❌ ERROR: No DATABASE_URL found in environment');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    console.log('🔍 Verifying migrations...\n');
    
    // Check actions table
    const actionsCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'actions'
    `);
    console.log(`✅ Actions table: ${actionsCheck.rows.length > 0 ? 'EXISTS' : '❌ MISSING'}`);
    
    // Check appraisal_date column
    const appraisalCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'opportunities' 
      AND column_name = 'appraisal_date'
    `);
    console.log(`✅ Appraisal date column: ${appraisalCheck.rows.length > 0 ? 'EXISTS' : '❌ MISSING'}`);
    
    await pool.end();
    console.log('\n✅ Verification complete!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

verifyMigrations();

