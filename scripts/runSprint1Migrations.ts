/**
 * Run Sprint 1 Migrations
 * Executes migrations 043_add_opportunity_type.sql and 044_add_buyer_profile.sql
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import '../server/bootstrapEnv.js';

async function runMigrations() {
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

  const migrations = [
    '043_add_opportunity_type.sql',
    '044_add_buyer_profile.sql',
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
          // Check if error is due to already existing objects
          if (error?.code === '42P07' || error?.code === '42710' || error?.message?.includes('already exists')) {
            console.log(`⚠️  ${migrationFile} - Some objects already exist, skipping...`);
          } else {
            console.error(`❌ ${migrationFile} failed:`, error.message);
            throw error;
          }
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.error(`❌ Migration file not found: ${migrationPath}`);
          throw error;
        }
        throw error;
      }
    }
    
    // Verify the migrations
    console.log('\n🔍 Verifying migrations...');
    
    // Check opportunity_type column
    try {
      const result = await pool.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'opportunities' AND column_name = 'opportunity_type'
      `);
      if (result.rows.length > 0) {
        console.log('✅ opportunity_type column exists in opportunities table');
      } else {
        console.log('⚠️  opportunity_type column not found');
      }
    } catch (error: any) {
      console.log('⚠️  Could not verify opportunity_type column:', error.message);
    }

    // Check buyer_profile column
    try {
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'contacts' AND column_name = 'buyer_profile'
      `);
      if (result.rows.length > 0) {
        console.log('✅ buyer_profile column exists in contacts table');
      } else {
        console.log('⚠️  buyer_profile column not found');
      }
    } catch (error: any) {
      console.log('⚠️  Could not verify buyer_profile column:', error.message);
    }
    
    console.log('\n✅ All migrations completed successfully!');
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

