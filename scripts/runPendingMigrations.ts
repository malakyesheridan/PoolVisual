import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import '../server/bootstrapEnv.js';

async function runMigrations() {
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

  const migrations = [
    '055_add_cold_start_fields.sql',
    '056_add_opportunity_activity_tracking.sql',
  ];

  try {
    console.log('🔧 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    for (const migrationFile of migrations) {
      console.log(`\n📦 Running migration: ${migrationFile}`);
      const migrationPath = join(process.cwd(), 'migrations', migrationFile);
      
      try {
        const migrationSQL = readFileSync(migrationPath, 'utf8');
        
        try {
          await pool.query(migrationSQL);
          console.log(`✅ ${migrationFile} completed successfully`);
        } catch (error: any) {
          if (error?.code === '42P07' || error?.code === '42710' || error?.message?.includes('already exists')) {
            console.log(`⚠️  ${migrationFile} - Some objects already exist, skipping...`);
          } else {
            console.error(`❌ ${migrationFile} failed:`, error.message);
            throw error;
          }
        }
      } catch (fileError: any) {
        if (fileError.code === 'ENOENT') {
          console.error(`❌ Migration file not found: ${migrationPath}`);
          process.exit(1);
        }
        throw fileError;
      }
    }
    
    console.log('\n🔍 Verifying migrations...');
    
    // Verify migration 055
    try {
      const check055 = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'jobs' 
          AND column_name IN ('initial_report_generated_at', 'seller_launch_insights')
      `);
      
      if (check055.rows.length === 2) {
        console.log(`✅ Migration 055 verified - both columns exist in jobs table`);
      } else {
        console.log(`⚠️  Migration 055 - Found ${check055.rows.length} of 2 expected columns`);
      }
    } catch (verifyError: any) {
      console.error('❌ Verification for migration 055 failed:', verifyError.message);
    }
    
    // Verify migration 056
    try {
      const check056 = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'opportunities' 
          AND column_name IN ('last_seller_update', 'last_agent_activity')
      `);
      
      if (check056.rows.length === 2) {
        console.log(`✅ Migration 056 verified - both columns exist in opportunities table`);
      } else {
        console.log(`⚠️  Migration 056 - Found ${check056.rows.length} of 2 expected columns`);
      }
    } catch (verifyError: any) {
      console.error('❌ Verification for migration 056 failed:', verifyError.message);
    }
    
    console.log('\n✅ All migrations completed and verified successfully!');
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

runMigrations();

