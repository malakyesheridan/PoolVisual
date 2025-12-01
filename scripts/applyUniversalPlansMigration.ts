import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    
    console.log('📄 Reading migration file: 030_easyflow_universal_plans.sql');
    const migrationPath = join(__dirname, '..', 'migrations', '030_easyflow_universal_plans.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Applying migration...');
    
    // Execute the migration SQL
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 030_easyflow_universal_plans.sql applied successfully!');
    console.log('   - Created easyflow_solo plan');
    console.log('   - Created easyflow_pro plan');
    console.log('   - Created easyflow_business plan');
    
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
    await pool.end();
    process.exit(1);
  }
}

applyMigration();
