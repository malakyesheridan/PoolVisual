import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const orgId = userId; // Same as tenant ID
    
    // Create org if not exists
    await pool.query(`
      INSERT INTO orgs (id, name) 
      VALUES ($1, 'Test Org') 
      ON CONFLICT (id) DO NOTHING
    `, [orgId]);
    
    // Create user if not exists
    await pool.query(`
      INSERT INTO users (id, email, username, password) 
      VALUES ($1, 'test@example.com', 'testuser', '$2b$10$rNRORlsY.lHWejFuFdGKx.ADMvRZ6K9AqtzTdShiIrFRlLYzXHqS5u') 
      ON CONFLICT (id) DO NOTHING
    `, [userId]);
    
    // Create org membership
    await pool.query(`
      INSERT INTO org_members (org_id, user_id, role) 
      VALUES ($1, $2, 'admin') 
      ON CONFLICT (org_id, user_id) DO NOTHING
    `, [orgId, userId]);
    
    console.log('✅ Test org and membership created');
    await pool.end();
  } catch (e: any) {
    console.error(e.message);
    await pool.end();
    process.exit(1);
  }
})();

