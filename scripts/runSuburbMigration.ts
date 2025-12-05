import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function runMigration() {
  const sql = neon(DATABASE_URL);
  
  console.log('🔄 Running migration 051: Rename school_district to suburb...');
  
  try {
    // Execute ALTER TABLE to rename the column
    await sql`
      ALTER TABLE jobs RENAME COLUMN school_district TO suburb
    `;
    
    console.log('✅ Column school_district has been renamed to suburb');
    
    // Add comment
    await sql`
      COMMENT ON COLUMN jobs.suburb IS 'Suburb or locality where the property is located'
    `;
    console.log('✅ Comment added');
    
    // Verify the change
    const verifyResult = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' AND column_name IN ('school_district', 'suburb')
    `;
    
    if (verifyResult.length > 0) {
      console.log('\n📊 Verification:');
      verifyResult.forEach((row: any) => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
      
      if (verifyResult.some((row: any) => row.column_name === 'suburb')) {
        console.log('\n✅ Column "suburb" exists in jobs table');
      }
      if (verifyResult.some((row: any) => row.column_name === 'school_district')) {
        console.log('⚠️  Column "school_district" still exists (this should not happen)');
      }
    }
    
    console.log('✅ Migration 051 completed successfully');
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42701') {
      console.error('   This might mean the column has already been renamed or does not exist');
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

