import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export const scenes = Router();

function requireAuth(req: any, res: any, next: any) { 
  if (!req.session?.user) return res.status(401).json({ ok: false, error: "unauthorized" }); 
  next(); 
}

function requireDb(req: any, res: any, next: any) {
  if (!db) return res.status(503).json({ ok: false, error: "database not available" });
  next();
}

scenes.get("/", requireAuth, requireDb, async (req, res) => {
  try {
    const rows = await db!.execute(sql`
      SELECT id,name,updated_at FROM scenes WHERE user_id=${req.session.user!.id} ORDER BY updated_at DESC LIMIT 100
    `);
    res.json({ ok: true, scenes: rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

scenes.get("/:id", requireAuth, requireDb, async (req, res) => {
  try {
    const rows = await db!.execute(sql`
      SELECT id,name,state,updated_at FROM scenes WHERE id=${req.params.id} AND user_id=${req.session.user!.id}
    `);
    if (!rows[0]) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, scene: rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

scenes.post("/", requireAuth, requireDb, async (req, res) => {
  try {
    const { name, state } = req.body || {};
    if (!name || !state) return res.status(400).json({ ok: false, error: "name/state required" });
    
    const rows = await db!.execute(sql`
      INSERT INTO scenes (user_id,name,state) VALUES (${req.session.user!.id},${name},${state}) RETURNING id,name,updated_at
    `);
    res.json({ ok: true, scene: rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

scenes.put("/:id", requireAuth, requireDb, async (req, res) => {
  try {
    const { name, state } = req.body || {};
    const rows = await db!.execute(sql`
      UPDATE scenes SET name=COALESCE(${name},name), state=COALESCE(${state},state), updated_at=now() WHERE id=${req.params.id} AND user_id=${req.session.user!.id} RETURNING id,name,updated_at
    `);
    if (!rows[0]) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, scene: rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

scenes.delete("/:id", requireAuth, requireDb, async (req, res) => {
  try {
    await db!.execute(sql`
      DELETE FROM scenes WHERE id=${req.params.id} AND user_id=${req.session.user!.id}
    `);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
