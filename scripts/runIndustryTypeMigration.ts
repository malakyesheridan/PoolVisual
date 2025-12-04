import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import '../server/bootstrapEnv.js';

async function runMigration() {
  // Get DATABASE_URL from environment (loaded by bootstrapEnv)
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

  const migrationFile = '038_require_industry_type.sql';

  try {
    console.log('🔧 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    console.log(`\n📦 Running migration: ${migrationFile}`);
    const migrationPath = join(process.cwd(), 'migrations', migrationFile);
    
    const fileExists = readFileSync(migrationPath, 'utf8');
    if (!fileExists) {
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
    
    // Check that industry_type is NOT NULL
    try {
      const notNullCheck = await pool.query(`
        SELECT column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'users' 
        AND column_name = 'industry_type'
      `);
      
      if (notNullCheck.rows.length > 0) {
        const col = notNullCheck.rows[0];
        console.log(`✅ industry_type column found`);
        console.log(`   - Nullable: ${col.is_nullable}`);
        console.log(`   - Default: ${col.column_default || 'none'}`);
        
        if (col.is_nullable === 'NO') {
          console.log(`✅ industry_type is NOT NULL (required)`);
        } else {
          console.log(`⚠️  industry_type is still nullable - migration may need review`);
        }
      } else {
        console.log(`❌ industry_type column not found`);
      }
    } catch (e: any) {
      console.log(`❌ Verification check failed: ${e.message}`);
      throw e;
    }
    
    // Check constraint exists
    try {
      const constraintCheck = await pool.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'users' 
        AND constraint_name = 'valid_industry_type'
      `);
      
      if (constraintCheck.rows.length > 0) {
        console.log(`✅ valid_industry_type constraint exists`);
      } else {
        console.log(`⚠️  valid_industry_type constraint not found`);
      }
    } catch (e: any) {
      console.log(`⚠️  Constraint check failed: ${e.message}`);
    }
    
    // Check for users without industry_type (should be 0 after migration)
    try {
      const nullCheck = await pool.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE industry_type IS NULL
      `);
      const nullCount = parseInt(nullCheck.rows[0].count);
      if (nullCount === 0) {
        console.log(`✅ All users have industry_type set (${nullCount} null values)`);
      } else {
        console.log(`⚠️  Found ${nullCount} users without industry_type - migration may need to be re-run`);
      }
    } catch (e: any) {
      console.log(`⚠️  Null check failed: ${e.message}`);
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

