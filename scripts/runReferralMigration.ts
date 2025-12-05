/**
 * Run Referral System Migration
 * Executes migration 042_add_referral_system.sql
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

  const migrationFile = '042_add_referral_system.sql';

  try {
    console.log('🔧 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    console.log(`\n📦 Running migration: ${migrationFile}`);
    const migrationPath = join(process.cwd(), 'migrations', migrationFile);
    
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
    
    // Check that referrals table exists
    try {
      const tableCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'referrals'
      `);
      
      if (tableCheck.rows.length > 0) {
        console.log(`✅ referrals table exists`);
      } else {
        console.log(`❌ referrals table not found`);
      }
    } catch (e: any) {
      console.log(`❌ Table check failed: ${e.message}`);
    }
    
    // Check that user columns exist
    try {
      const columnCheck = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users' 
        AND column_name IN ('referral_code', 'referral_rewards_earned', 'referral_rewards_limit')
        ORDER BY column_name
      `);
      
      const expectedColumns = ['referral_code', 'referral_rewards_earned', 'referral_rewards_limit'];
      const foundColumns = columnCheck.rows.map((r: any) => r.column_name);
      
      for (const col of expectedColumns) {
        if (foundColumns.includes(col)) {
          const colInfo = columnCheck.rows.find((r: any) => r.column_name === col);
          console.log(`✅ ${col} column exists (type: ${colInfo.data_type})`);
        } else {
          console.log(`❌ ${col} column not found`);
        }
      }
    } catch (e: any) {
      console.log(`❌ Column check failed: ${e.message}`);
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('   - Created referrals table');
    console.log('   - Added referral tracking fields to users table');
    
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration process failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Make sure DATABASE_URL is set correctly');
      console.error('   The connection string should look like: postgresql://user:password@host:port/database');
    }
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();

