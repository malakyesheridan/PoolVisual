/**
 * Run Appraisal Date Migration
 * Executes migration 053_add_appraisal_date_to_opportunities.sql
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import '../server/bootstrapEnv.js';

async function runMigration() {
  // Get DATABASE_URL from environment (loaded by bootstrapEnv)
  const cs = process.env.DATABASE_URL;
  
  if (!cs) {
    console.error('❌ ERROR: No DATABASE_URL found in environment');
    console.error('Please ensure DATABASE_URL is set in your .env file');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

  const migrationFile = '053_add_appraisal_date_to_opportunities.sql';

  try {
    console.log('🔧 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    console.log(`\n📦 Running migration: ${migrationFile}`);
    const migrationPath = join(process.cwd(), 'migrations', migrationFile);
    
    const fileExists = readFileSync(migrationPath, 'utf8');
    if (!fileExists) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }
    
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    try {
      await pool.query(migrationSQL);
      console.log(`✅ ${migrationFile} completed successfully`);
    } catch (error: any) {
      // Check if error is due to already existing objects
      if (error?.code === '42P07' || error?.code === '42710' || error?.message?.includes('already exists')) {
        console.log(`⚠️  ${migrationFile} - Some objects already exist, skipping...`);
      } else {
        console.error(`❌ ${migrationFile} failed:`, error.message);
        throw error;
      }
    }
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    
    // Check that column exists
    try {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'opportunities' 
        AND column_name = 'appraisal_date'
      `);
      
      if (result.rows.length > 0) {
        console.log('✅ Column appraisal_date exists in opportunities table');
        console.log(`   Type: ${result.rows[0].data_type}, Nullable: ${result.rows[0].is_nullable}`);
      } else {
        console.error('❌ Column appraisal_date not found in opportunities table');
        process.exit(1);
      }
      
      // Check index exists
      const indexResult = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'opportunities' 
        AND indexname = 'idx_opportunities_appraisal_date'
      `);
      
      if (indexResult.rows.length > 0) {
        console.log('✅ Index idx_opportunities_appraisal_date exists');
      } else {
        console.log('⚠️  Index idx_opportunities_appraisal_date not found (may be non-critical)');
      }
    } catch (verifyError: any) {
      console.error('❌ Verification failed:', verifyError.message);
      process.exit(1);
    }
    
    console.log('\n✅ Migration completed and verified successfully!');
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration process failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Make sure DATABASE_URL is set correctly in your .env file');
      console.error('   The connection string should look like: postgresql://user:password@host:port/database');
    }
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();

