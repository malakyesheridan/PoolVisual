import type { Express } from 'express';
import { randomUUID } from 'crypto';
import { storage } from '../storage';

export function materialsForceRoutes(app: Express) {
  // Debug: schema + connectivity
  app.get('/api/_materials/debug', async (req, res) => {
    try {
      // Test basic connectivity - get materials for first available org
      const materials = await storage.getMaterials();
      const count = materials.length;
      
      // Check table structure (simplified for Express)
      res.json({ 
        ok: true, 
        ping: { ok: 1 }, 
        count, 
        materials: materials.slice(0, 3), // Show first 3 for debugging
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('[debug] materials schema failure:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Minimal forced insert that bypasses complex validation/mapping
  app.post('/api/materials/_force', async (req, res) => {
    const b = req.body as any;
    const name = (b?.name ?? '').toString().trim();
    const category = (b?.category ?? '').toString().trim();
    const unit = (b?.unit ?? '').toString().trim();
    
    console.log('[force] POST /api/materials/_force - Body:', JSON.stringify(b, null, 2));
    
    if (!name || !category || !unit) {
      return res.status(400).json({ 
        error: 'REQUIRED_FIELDS', 
        message: 'name, category, unit are required',
        received: { name, category, unit }
      });
    }
    
    try {
      const material = await storage.createMaterial({
        orgId: null,
        name: name,
        sku: b.sku || null,
        category: category,
        unit: unit,
        price: b.price || null,
        cost: b.cost || null,
        wastagePct: b.wastage_pct || b.wastagePct || null,
        marginPct: b.margin_pct || b.marginPct || null,
        supplier: b.supplier || 'PoolTile',
        sourceUrl: b.source_url || b.sourceUrl || null,
        finish: b.finish || null,
        tileWidthMm: b.tile_width_mm || b.tileWidthMm || null,
        tileHeightMm: b.tile_height_mm || b.tileHeightMm || null,
        sheetWidthMm: b.sheet_width_mm || b.sheetWidthMm || null,
        sheetHeightMm: b.sheet_height_mm || b.sheetHeightMm || null,
        groutWidthMm: b.grout_width_mm || b.groutWidthMm || null,
        thicknessMm: b.thickness_mm || b.thicknessMm || null,
        textureUrl: b.texture_url || b.textureUrl || null,
        thumbnailUrl: b.thumbnail_url || b.thumbnailUrl || null,
        notes: b.notes || null,
        physicalRepeatM: b.sheet_width_mm ? (b.sheet_width_mm / 1000).toString() : 
                        b.sheetWidthMm ? (b.sheetWidthMm / 1000).toString() :
                        b.tile_width_mm ? (b.tile_width_mm / 1000).toString() :
                        b.tileWidthMm ? (b.tileWidthMm / 1000).toString() : "0.3"
      });
      
      console.log('[force] ✅ Created material:', material.id, material.name);
      res.status(201).json(material);
      
    } catch (err: any) {
      console.error('[force] ❌ Insert failed:', err);
      res.status(500).json({ error: 'DB_INSERT_FAILED', message: err.message });
    }
  });
}