import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import '../server/bootstrapEnv.js';

async function runMigration() {
  const cs = process.env.DATABASE_URL;
  
  if (!cs) {
    console.error('❌ ERROR: No DATABASE_URL found in environment');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

  const migrationFile = '039_prevent_negative_credits.sql';

  try {
    console.log('🔧 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    console.log(`\n📦 Running migration: ${migrationFile}`);
    const migrationPath = join(process.cwd(), 'migrations', migrationFile);
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    console.log(`✅ ${migrationFile} completed successfully`);
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const constraintCheck = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'users' 
      AND constraint_name = 'credits_balance_non_negative'
    `);
    
    if (constraintCheck.rows.length > 0) {
      console.log(`✅ credits_balance_non_negative constraint exists`);
    } else {
      console.log(`❌ Constraint not found`);
    }
    
    // Check for negative balances (should be 0 after migration)
    const negativeCheck = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE credits_balance < 0
    `);
    const negativeCount = parseInt(negativeCheck.rows[0].count);
    if (negativeCount === 0) {
      console.log(`✅ No negative credit balances found`);
    } else {
      console.log(`⚠️  Found ${negativeCount} users with negative credits (should have been fixed)`);
    }
    
    console.log('\n✅ Migration completed successfully!');
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration process failed:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();

