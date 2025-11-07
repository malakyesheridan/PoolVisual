#!/usr/bin/env tsx
// Apply database migration script for 013_add_composite_url.sql
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env') });

async function applyMigration() {
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
    
    console.log('📄 Reading migration file: 013_add_composite_url.sql');
    const migrationPath = join(__dirname, '..', 'migrations', '013_add_composite_url.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Applying migration...');
    
    // Execute the migration SQL as a single query
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 013_add_composite_url.sql applied successfully!');
    console.log('   - Added composite_url column to photos table');
    console.log('   - Added composite_generated_at column to photos table');
    console.log('   - Created indexes for performance');
    console.log('   - Added audit log entry');
    
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }
    await pool.end();
    process.exit(1);
  }
}

applyMigration();
