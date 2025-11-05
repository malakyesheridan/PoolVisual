#!/usr/bin/env tsx
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigrations() {
  const cs = process.env.DATABASE_URL;
  
  if (!cs) {
    console.log('ERROR: No DATABASE_URL');
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
    const migrations = [
      '007_ai_enhancement_system.sql',
      '008_webhook_nonces.sql',
      '009_outbox_pattern.sql',
      '010_state_machine.sql',
      '011_cache_provider_tracking.sql',
      '012_reserved_cost.sql'
    ];

    for (const f of migrations) {
      console.log(`\nApplying ${f}...`);
      const migrationPath = join(__dirname, '..', 'migrations', f);
      const sql = readFileSync(migrationPath, 'utf8');
      await pool.query(sql);
      console.log(`✅ ${f} applied`);
    }
    
    console.log('\n✅ All migrations applied successfully!');
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error(`❌ Migration failed:`, error.message);
    await pool.end();
    process.exit(1);
  }
}

applyMigrations();
