/**
 * Run Match Suggestions Migration
 * Executes migration 049_add_match_suggestions.sql
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

  const migrationFile = '049_add_match_suggestions.sql';

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
    
    // Check match_suggestions table
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_name = 'match_suggestions'
      `);
      if (result.rows[0].count > 0) {
        console.log('✅ match_suggestions table exists');
      } else {
        console.log('⚠️  match_suggestions table not found');
      }
    } catch (error: any) {
      console.log('⚠️  Could not verify match_suggestions table:', error.message);
    }

    // Check indexes
    try {
      const indexes = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'match_suggestions'
        ORDER BY indexname
      `);
      if (indexes.rows.length > 0) {
        console.log(`✅ Found ${indexes.rows.length} indexes:`);
        indexes.rows.forEach((idx: any) => {
          console.log(`   - ${idx.indexname}`);
        });
      } else {
        console.log('⚠️  No indexes found');
      }
    } catch (error: any) {
      console.log('⚠️  Could not verify indexes:', error.message);
    }
    
    console.log('\n✅ Migration verification complete!');
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

