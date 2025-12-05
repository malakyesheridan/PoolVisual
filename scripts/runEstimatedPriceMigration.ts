import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function runMigration() {
  const sql = neon(DATABASE_URL);
  
  const migrationPath = path.join(__dirname, '../migrations/048_change_estimated_price_to_text.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  
  console.log('🔄 Running migration 048: Change estimated_price to text...');
  
  try {
    await sql(migrationSQL);
    console.log('✅ Migration 048 completed successfully');
    
    // Verify the change
    const verifyResult = await sql`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' AND column_name = 'estimated_price'
    `;
    
    if (verifyResult[0]?.data_type === 'text') {
      console.log('✅ Verified: estimated_price column is now TEXT type');
    } else {
      console.warn('⚠️  Warning: Column type verification failed. Current type:', verifyResult[0]?.data_type);
    }
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42710') {
      console.log('ℹ️  Column type may already be text, or migration already applied');
    }
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });

