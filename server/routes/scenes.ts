import { Router } from "express";
import { getDatabase } from "../db";
import { sql } from "drizzle-orm";

export const scenes = Router();

function requireAuth(req: any, res: any, next: any) { 
  if (!req.session?.user) return res.status(401).json({ ok: false, error: "unauthorized" }); 
  next(); 
}

function requireDb(req: any, res: any, next: any) {
  const db = getDatabase();
  if (!db) return res.status(503).json({ ok: false, error: "database not available" });
  req.db = db; // Attach db to request for use in handlers
  next();
}

scenes.get("/", requireAuth, requireDb, async (req, res) => {
  try {
    const db = req.db;
    const rows = await db.execute(sql`
      SELECT id,name,updated_at FROM scenes WHERE user_id=${req.session.user!.id} ORDER BY updated_at DESC LIMIT 100
    `);
    res.json({ ok: true, scenes: rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
    return;
  }
});

scenes.get("/:id", requireAuth, requireDb, async (req, res) => {
  try {
    const db = req.db;
    const rows = await db.execute(sql`
      SELECT id,name,state,updated_at FROM scenes WHERE id=${req.params.id} AND user_id=${req.session.user!.id}
    `);
    // Neon HTTP returns array directly, not { rows: [...] }
    const result = Array.isArray(rows) ? rows : rows.rows || [];
    if (!result[0]) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, scene: result[0] });
    return;
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
    return;
  }
});

scenes.post("/", requireAuth, requireDb, async (req, res) => {
  try {
    const { name, state } = req.body || {};
    if (!name || !state) return res.status(400).json({ ok: false, error: "name/state required" });
    
    const db = req.db;
    const rows = await db.execute(sql`
      INSERT INTO scenes (user_id,name,state) VALUES (${req.session.user!.id},${name},${state}) RETURNING id,name,updated_at
    `);
    // Neon HTTP returns array directly, not { rows: [...] }
    const result = Array.isArray(rows) ? rows : rows.rows || [];
    res.json({ ok: true, scene: result[0] });
    return;
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
    return;
  }
});

scenes.put("/:id", requireAuth, requireDb, async (req, res) => {
  try {
    const { name, state } = req.body || {};
    const db = req.db;
    const rows = await db.execute(sql`
      UPDATE scenes SET name=COALESCE(${name},name), state=COALESCE(${state},state), updated_at=now() WHERE id=${req.params.id} AND user_id=${req.session.user!.id} RETURNING id,name,updated_at
    `);
    // Neon HTTP returns array directly, not { rows: [...] }
    const result = Array.isArray(rows) ? rows : rows.rows || [];
    if (!result[0]) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, scene: result[0] });
    return;
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
    return;
  }
});

scenes.delete("/:id", requireAuth, requireDb, async (req, res) => {
  try {
    const db = req.db;
    await db.execute(sql`
      DELETE FROM scenes WHERE id=${req.params.id} AND user_id=${req.session.user!.id}
    `);
    res.json({ ok: true });
    return;
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
    return;
  }
});
