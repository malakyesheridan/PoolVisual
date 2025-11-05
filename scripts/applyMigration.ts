#!/usr/bin/env tsx
// Apply database migration script
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables like the server does
config({ path: join(__dirname, '..', '.env') });

async function applyMigration() {
  const cs = process.env.DATABASE_URL;
  
  if (!cs) {
    console.log('PG FAIL: No DATABASE_URL');
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
    console.log('Applying migration: 003_add_multi_level_geometry.sql');
    
    // Read the migration file
    const migrationPath = join(__dirname, '..', 'migrations', '003_add_multi_level_geometry.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Apply the migration
    await pool.query(migrationSQL);
    
    console.log('Migration applied successfully!');
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.log(`Migration failed: ${error.message}`);
    await pool.end();
    process.exit(1);
  }
}

applyMigration();
