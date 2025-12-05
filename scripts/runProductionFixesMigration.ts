/**
 * Run Production Fixes Migration
 * Executes migration 046_fix_production_errors.sql
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

  const migrationFile = '046_fix_production_errors.sql';

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
    
    // Check updated_at column on materials
    try {
      const result = await pool.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'materials' AND column_name = 'updated_at'
      `);
      if (result.rows.length > 0) {
        console.log('✅ updated_at column exists in materials table');
      } else {
        console.log('⚠️  updated_at column not found');
      }
    } catch (error: any) {
      console.log('⚠️  Could not verify updated_at column:', error.message);
    }

    // Check trial_enhancements_granted column
    try {
      const result = await pool.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'trial_enhancements_granted'
      `);
      if (result.rows.length > 0) {
        console.log('✅ trial_enhancements_granted column exists in users table');
      } else {
        console.log('⚠️  trial_enhancements_granted column not found');
      }
    } catch (error: any) {
      console.log('⚠️  Could not verify trial_enhancements_granted column:', error.message);
    }

    // Check system_get_materials function
    try {
      const result = await pool.query(`
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_name = 'system_get_materials'
      `);
      if (result.rows.length > 0) {
        console.log('✅ system_get_materials function exists');
      } else {
        console.log('⚠️  system_get_materials function not found');
      }
    } catch (error: any) {
      console.log('⚠️  Could not verify system_get_materials function:', error.message);
    }
    
    console.log('\n✅ Migration completed successfully!');
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

