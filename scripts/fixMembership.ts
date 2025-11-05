import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    // First get existing user
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');
    if (!userRes.rows.length) throw new Error('No users found');
    const userId = userRes.rows[0].id;
    
    // Get or create org
    const orgId = '123e4567-e89b-12d3-a456-426614174000';
    await pool.query(`
      INSERT INTO orgs (id, name) 
      VALUES ($1, 'Test Org') 
      ON CONFLICT (id) DO NOTHING
    `, [orgId]);
    
    // Create membership
    await pool.query(`
      INSERT INTO org_members (org_id, user_id, role) 
      VALUES ($1, $2, 'owner') 
      ON CONFLICT DO NOTHING
    `, [orgId, userId]);
    
    console.log(`✅ Membership added for user ${userId}`);
    await pool.end();
  } catch (e: any) {
    console.error(e.message);
    await pool.end();
  }
})();
