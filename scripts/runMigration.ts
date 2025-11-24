import { Pool } from 'pg';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const migrationFile = process.argv[2] || '015_add_credits_to_orgs.sql';
    const migrationPath = join(process.cwd(), 'migrations', migrationFile);
    
    console.log(`\n📦 Running migration: ${migrationFile}\n`);
    console.log(`📄 Reading from: ${migrationPath}\n`);
    
    const sql = readFileSync(migrationPath, 'utf-8');
    
    console.log('🔍 SQL to execute:');
    console.log(sql);
    console.log('\n');
    
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify the migration
    const check = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orgs' AND column_name = 'credits_balance'
    `);
    
    if (check.rows.length > 0) {
      console.log('✅ Verification: credits_balance column exists');
      console.log(`   Type: ${check.rows[0].data_type}`);
    } else {
      console.log('❌ Verification failed: credits_balance column not found');
    }
    
    await pool.end();
    process.exit(0);
  } catch (e: any) {
    console.error('❌ Migration failed:', e.message);
    console.error(e);
    await pool.end();
    process.exit(1);
  }
})();
