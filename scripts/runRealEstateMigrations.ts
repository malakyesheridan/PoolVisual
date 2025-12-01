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

async function runMigrations() {
  // Try to get DATABASE_URL from command line argument, environment variable, or .env file
  let cs = process.argv[2] || process.env.DATABASE_URL;
  
  if (!cs) {
    console.error('❌ ERROR: No DATABASE_URL found');
    console.error('\nUsage:');
    console.error('  npx tsx scripts/runRealEstateMigrations.ts [DATABASE_URL]');
    console.error('\nOr set DATABASE_URL in:');
    console.error('  - Command line: DATABASE_URL="postgresql://..." npx tsx scripts/runRealEstateMigrations.ts');
    console.error('  - .env file: DATABASE_URL=postgresql://...');
    console.error('\nExample:');
    console.error('  npx tsx scripts/runRealEstateMigrations.ts "postgresql://user:pass@host:5432/dbname"');
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
    '032_add_photo_category.sql',
    '033_add_property_details.sql',
    '034_add_property_notes.sql',
    '035_create_opportunities_tables.sql',
  ];

  try {
    console.log('🔧 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    for (const migrationFile of migrations) {
      console.log(`\n📦 Running migration: ${migrationFile}`);
      const migrationPath = join(process.cwd(), 'migrations', migrationFile);
      
      if (!readFileSync(migrationPath, 'utf8')) {
        console.error(`❌ Migration file not found: ${migrationPath}`);
        continue;
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

