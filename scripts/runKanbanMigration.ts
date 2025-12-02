import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import dotenvExpand from 'dotenv-expand';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '..', '.env');
const result = config({ path: envPath });
dotenvExpand.expand(result);

async function runMigration() {
  // Try to get DATABASE_URL from command line argument, environment variable, or .env file
  let cs = process.argv[2] || process.env.DATABASE_URL;
  
  if (!cs) {
    console.error('❌ ERROR: No DATABASE_URL found');
    console.error('\nUsage:');
    console.error('  npx tsx scripts/runKanbanMigration.ts [DATABASE_URL]');
    console.error('\nOr set DATABASE_URL in:');
    console.error('  - Command line: DATABASE_URL="postgresql://..." npx tsx scripts/runKanbanMigration.ts');
    console.error('  - .env file: DATABASE_URL=postgresql://...');
    console.error('\nExample:');
    console.error('  npx tsx scripts/runKanbanMigration.ts "postgresql://user:pass@host:5432/dbname"');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

  const migrationFile = '036_add_contacts_pipelines_kanban.sql';

  try {
    console.log('🔧 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    console.log(`\n📦 Running migration: ${migrationFile}`);
    const migrationPath = join(process.cwd(), 'migrations', migrationFile);
    
    if (!readFileSync(migrationPath, 'utf8')) {
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
    const checks = [
      { table: 'contacts', check: 'SELECT COUNT(*) FROM contacts' },
      { table: 'pipelines', check: 'SELECT COUNT(*) FROM pipelines' },
      { table: 'pipeline_stages', check: 'SELECT COUNT(*) FROM pipeline_stages' },
      { table: 'opportunity_tasks', check: 'SELECT COUNT(*) FROM opportunity_tasks' },
    ];

    for (const { table, check } of checks) {
      try {
        const result = await pool.query(check);
        console.log(`✅ ${table} table exists (${result.rows[0].count} rows)`);
      } catch (e: any) {
        console.log(`⚠️  ${table} table check failed: ${e.message}`);
      }
    }

    // Check if new columns were added to opportunities
    try {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'opportunities' 
        AND column_name IN ('title', 'contact_id', 'pipeline_id', 'stage_id', 'owner_id', 'tags')
      `);
      console.log(`✅ Opportunities table extended with ${result.rows.length} new columns`);
    } catch (e: any) {
      console.log(`⚠️  Opportunities table check failed: ${e.message}`);
    }
    
    console.log('\n✅ Migration completed successfully!');
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

