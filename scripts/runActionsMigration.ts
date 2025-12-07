/**
 * Run Actions Table Migration
 * Executes migration 052_create_actions_table.sql
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

  const migrationFile = '052_create_actions_table.sql';

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
    
    // Check that table exists
    try {
      const result = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' 
        AND table_name = 'actions'
      `);
      
      if (result.rows.length > 0) {
        console.log('✅ Actions table exists');
        
        // Check columns
        const columnsResult = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'actions'
          ORDER BY ordinal_position
        `);
        
        console.log(`✅ Found ${columnsResult.rows.length} columns in actions table:`);
        columnsResult.rows.forEach((row: any) => {
          console.log(`   - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
        });
        
        // Check indexes
        const indexesResult = await pool.query(`
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'actions'
        `);
        
        if (indexesResult.rows.length > 0) {
          console.log(`✅ Found ${indexesResult.rows.length} indexes on actions table`);
        } else {
          console.log('⚠️  No indexes found on actions table (may be non-critical)');
        }
      } else {
        console.error('❌ Actions table not found');
        process.exit(1);
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

