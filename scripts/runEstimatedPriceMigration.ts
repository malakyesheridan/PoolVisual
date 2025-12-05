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
  
  console.log('🔄 Running migration 048: Change estimated_price to text...');
  
  try {
    // Run the ALTER TABLE statement
    await sql`
      ALTER TABLE jobs 
        ALTER COLUMN estimated_price TYPE TEXT USING estimated_price::TEXT
    `;
    console.log('✅ Column type changed to TEXT');
    
    // Add comment (separate statement)
    await sql`
      COMMENT ON COLUMN jobs.estimated_price IS 'Property estimated price. Can be a number (e.g., "600000") or special text (e.g., "POA", "$600,000", "Contact for price").'
    `;
    console.log('✅ Comment added');
    
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
    
    console.log('✅ Migration 048 completed successfully');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42710' || error.code === '42P16') {
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

