import { pool } from "../server/db";

(async () => {
  const c = await pool.connect();
  try {
    await c.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await c.query(`
      CREATE TABLE IF NOT EXISTS scenes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        name TEXT NOT NULL,
        state JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_scenes_user ON scenes(user_id);
      CREATE INDEX IF NOT EXISTS idx_scenes_updated ON scenes(updated_at DESC);
    `);
    console.log("✅ scenes table ready");
  } finally { 
    c.release(); 
  }
})();
