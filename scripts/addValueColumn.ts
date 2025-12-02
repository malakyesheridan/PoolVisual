import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

// Load environment variables
const env = dotenv.config();
dotenvExpand.expand(env);

async function addValueColumn() {
  // Try to get DATABASE_URL from command line argument, environment variable, or .env file
  const databaseUrl = process.argv[2] || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ ERROR: No DATABASE_URL found');
    console.error('\nUsage:');
    console.error('  npx tsx scripts/addValueColumn.ts [DATABASE_URL]');
    console.error('\nOr set DATABASE_URL in:');
    console.error('  - Command line: DATABASE_URL="postgresql://..." npx tsx scripts/addValueColumn.ts');
    console.error('  - .env file: DATABASE_URL=postgresql://...');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🔌 Connecting to database...');
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to database');

    console.log('\n📝 Adding value column to opportunities table...');
    
    // Add value column
    await pool.query(`
      ALTER TABLE opportunities
      ADD COLUMN IF NOT EXISTS value NUMERIC(12,2);
    `);
    
    console.log('✅ Added value column');

    // Copy estimated_value to value if value is null
    console.log('\n📋 Copying estimated_value to value for existing records...');
    const updateResult = await pool.query(`
      UPDATE opportunities 
      SET value = estimated_value 
      WHERE value IS NULL AND estimated_value IS NOT NULL;
    `);
    
    console.log(`✅ Updated ${updateResult.rowCount} records`);

    // Verify the column exists
    console.log('\n🔍 Verifying column exists...');
    const verifyResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'opportunities' AND column_name = 'value';
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Value column verified:', verifyResult.rows[0]);
    } else {
      console.error('❌ Value column not found after migration');
      process.exit(1);
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addValueColumn();

