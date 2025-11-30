#!/usr/bin/env tsx
// Run multi-trade migrations (021, 022, 023)
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import dotenvExpand from 'dotenv-expand';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables (same as bootstrapEnv.ts)
const envPath = join(__dirname, '..', '.env');
const result = config({ path: envPath });
dotenvExpand.expand(result);

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

  try {
    console.log('🔧 Connecting to database...');
    
    const migrations = [
      '021_add_industry_to_orgs.sql',
      '022_trade_category_mapping.sql',
      '023_user_onboarding.sql',
    ];

    for (const migrationFile of migrations) {
      console.log(`\n📦 Running migration: ${migrationFile}`);
      const migrationPath = join(__dirname, '..', 'migrations', migrationFile);
      
      if (!readFileSync(migrationPath, 'utf8')) {
        console.error(`❌ Migration file not found: ${migrationPath}`);
        continue;
      }
      
      const migrationSQL = readFileSync(migrationPath, 'utf8');
      
      try {
        await pool.query(migrationSQL);
        console.log(`✅ ${migrationFile} applied successfully!`);
      } catch (error: any) {
        // Check if error is due to already existing objects
        if (
          error.message.includes('already exists') ||
          error.message.includes('duplicate') ||
          error.message.includes('IF NOT EXISTS') ||
          error.code === '42P07' || // duplicate_table
          error.code === '42710' || // duplicate_object
          error.code === '42701'    // duplicate_column
        ) {
          console.log(`⚠️  ${migrationFile} - objects already exist, skipping`);
        } else {
          console.error(`❌ ${migrationFile} failed:`, error.message);
          if (error.code) {
            console.error(`   Error code: ${error.code}`);
          }
          if (error.detail) {
            console.error(`   Detail: ${error.detail}`);
          }
          throw error; // Re-throw to stop execution
        }
      }
    }
    
    console.log('\n✅ All migrations completed!');
    
    // Verify migrations
    console.log('\n🔍 Verifying migrations...');
    
    // Check industry column
    const industryCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orgs' AND column_name = 'industry'
    `);
    if (industryCheck.rows.length > 0) {
      console.log('✅ industry column exists in orgs table');
    } else {
      console.log('⚠️  industry column not found in orgs table');
    }
    
    // Check trade_category_mapping table
    const tradeCategoryCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'trade_category_mapping'
    `);
    if (tradeCategoryCheck.rows.length > 0) {
      const count = await pool.query('SELECT COUNT(*) FROM trade_category_mapping');
      console.log(`✅ trade_category_mapping table exists (${count.rows[0].count} rows)`);
    } else {
      console.log('⚠️  trade_category_mapping table not found');
    }
    
    // Check user_onboarding table
    const onboardingCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'user_onboarding'
    `);
    if (onboardingCheck.rows.length > 0) {
      console.log('✅ user_onboarding table exists');
    } else {
      console.log('⚠️  user_onboarding table not found');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration process failed:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    await pool.end();
    process.exit(1);
  }
}

runMigrations();

