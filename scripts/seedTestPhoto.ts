import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    // Get existing user and org
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');
    const orgRes = await pool.query('SELECT id FROM orgs WHERE id = $1', ['123e4567-e89b-12d3-a456-426614174000']);
    
    const userId = userRes.rows[0].id;
    const orgId = orgRes.rows.length ? orgRes.rows[0].id : '123e4567-e89b-12d3-a456-426614174000';
    
    // Create org if not exists
    if (!orgRes.rows.length) {
      await pool.query(`
        INSERT INTO orgs (id, name) 
        VALUES ($1, 'Test Org') 
        ON CONFLICT (id) DO NOTHING
      `, [orgId]);
    }
    
    // Create membership if not exists
    await pool.query(`
      INSERT INTO org_members (org_id, user_id, role) 
      VALUES ($1, $2, 'owner') 
      ON CONFLICT DO NOTHING
    `, [orgId, userId]);
    
    // Get org member id
    const memberRes = await pool.query(`
      SELECT id FROM org_members WHERE org_id = $1 AND user_id = $2
    `, [orgId, userId]);
    
    if (!memberRes.rows.length) throw new Error('Org member not found');
    const memberId = memberRes.rows[0].id;
    
    // Create a test job first
    const jobRes = await pool.query(`
      INSERT INTO public.jobs (id, org_id, client_name, status, created_by, created_at)
      VALUES (gen_random_uuid(), $1, 'Test Customer', 'new', $2, NOW())
      RETURNING id
    `, [orgId, memberId]);
    const jobId = jobRes.rows[0].id;
    
    // Create photo with job_id
    const photoRes = await pool.query(`
      INSERT INTO public.photos (id, job_id, original_url, width, height, created_at)
      VALUES (
        gen_random_uuid(),
        $1,
        'https://picsum.photos/2000/1500',
        2000,
        1500,
        NOW()
      )
      RETURNING id, job_id
    `, [jobId]);
    
    console.log(JSON.stringify({
      photoId: photoRes.rows[0].id,
      tenantId: orgId,
      userId: userId
    }));
    
    await pool.end();
  } catch (e: any) {
    console.error(e.message);
    await pool.end();
    process.exit(1);
  }
})();

