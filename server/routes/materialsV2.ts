import type { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';

const coNum = z.coerce.number().refine(v => !Number.isNaN(v), 'NaN').optional().nullable();
const strOpt = z.string().trim().optional().nullable();

const CreateDto = z.object({
  name: z.string().min(1),
  category: z.enum(['coping','waterline_tile','interior','paving','fencing']),
  unit: z.enum(['m2','lm','each']),
  // accept both snake & camel from UI
  sku: strOpt,
  price: coNum, 
  priceAmount: coNum,
  cost: coNum,
  wastage_pct: coNum, 
  wastagePct: coNum,
  margin_pct: coNum, 
  marginPct: coNum,
  tile_width_mm: coNum, 
  tileWidthMm: coNum,
  tile_height_mm: coNum, 
  tileHeightMm: coNum,
  sheet_width_mm: coNum, 
  sheetWidthMm: coNum,
  sheet_height_mm: coNum, 
  sheetHeightMm: coNum,
  grout_width_mm: coNum, 
  groutWidthMm: coNum,
  thickness_mm: coNum, 
  thicknessMm: coNum,
  finish: strOpt,
  texture_url: strOpt, // Remove .url() validation - accept relative paths
  textureUrl: strOpt,
  thumbnail_url: strOpt, // Remove .url() validation - accept relative paths  
  thumbnailUrl: strOpt,
  supplier: strOpt,
  source_url: strOpt, 
  sourceUrl: strOpt,
  notes: strOpt,
  org_id: strOpt, 
  orgId: strOpt,
  fileKey: strOpt
}).transform((b: any) => ({
  name: b.name,
  sku: b.sku ?? null,
  category: b.category,
  unit: b.unit,
  price: b.price ?? b.priceAmount ?? null,
  cost: b.cost ?? null,
  wastagePct: b.wastage_pct ?? b.wastagePct ?? null,
  marginPct: b.margin_pct ?? b.marginPct ?? null,
  tileWidthMm: b.tile_width_mm ?? b.tileWidthMm ?? null,
  tileHeightMm: b.tile_height_mm ?? b.tileHeightMm ?? null,
  sheetWidthMm: b.sheet_width_mm ?? b.sheetWidthMm ?? null,
  sheetHeightMm: b.sheet_height_mm ?? b.sheetHeightMm ?? null,
  groutWidthMm: b.grout_width_mm ?? b.groutWidthMm ?? null,
  thicknessMm: b.thickness_mm ?? b.thicknessMm ?? null,
  finish: b.finish ?? null,
  textureUrl: b.texture_url ?? b.textureUrl ?? null,
  thumbnailUrl: b.thumbnail_url ?? b.thumbnailUrl ?? null,
  supplier: b.supplier ?? 'PoolTile',
  sourceUrl: b.source_url ?? b.sourceUrl ?? null,
  notes: b.notes ?? null,
  orgId: b.org_id ?? b.orgId ?? null
}));

export function materialsV2Routes(app: Express) {
  // Probe and Echo endpoints for debugging
  app.get('/api/v2/_probe', (req, res) => {
    res.json({ ok: true, ts: Date.now(), env: process.env.NODE_ENV });
  });

  // Test database connection
  app.get('/api/v2/_test-db', async (req, res) => {
    try {
      // Simple test query to verify database connection
      const result = await storage.getMaterials();
      res.json({ 
        ok: true, 
        count: result.length,
        message: `Database connection working. Found ${result.length} materials.`
      });
    } catch (error: any) {
      console.error('[v2/_test-db] Database test failed:', error);
      res.status(500).json({ 
        ok: false, 
        error: error.message,
        stack: error.stack 
      });
    }
  });

  // Check if materials table exists and has data
  app.get('/api/v2/_check-materials', async (req, res) => {
    try {
      // Try to get all materials without any filters
      const allMaterials = await storage.getAllMaterials();
      res.json({ 
        ok: true, 
        count: allMaterials.length,
        materials: allMaterials.slice(0, 5).map(m => ({
          id: m.id,
          name: m.name,
          category: m.category,
          orgId: m.orgId,
          textureUrl: m.textureUrl,
          thumbnailUrl: m.thumbnailUrl,
          isActive: m.isActive
        })),
        message: `Found ${allMaterials.length} total materials in database.`
      });
    } catch (error: any) {
      console.error('[v2/_check-materials] Check failed:', error);
      res.status(500).json({ 
        ok: false, 
        error: error.message,
        stack: error.stack 
      });
    }
  });
  
  app.post('/api/v2/_echo', (req, res) => {
    res.json({ got: req.body, timestamp: Date.now() });
  });

  // Create material - bulletproof endpoint
  app.post('/api/v2/materials', async (req, res) => {
    console.log('[v2/materials] POST /api/v2/materials - Body:', JSON.stringify(req.body, null, 2));
    
    const parsed = CreateDto.safeParse(req.body);
    if (!parsed.success) {
      console.error('[v2/materials] Validation failed:', parsed.error.flatten());
      return res.status(400).json({ 
        error: 'INVALID_INPUT', 
        details: parsed.error.flatten(),
        received: req.body 
      });
    }
    
    const data = parsed.data;
    console.log('[v2/materials] Validated data:', JSON.stringify(data, null, 2));
    
    try {
      const material = await storage.createMaterial({
        orgId: data.orgId,
        name: data.name,
        sku: data.sku,
        category: data.category,
        unit: data.unit,
        price: data.price,
        cost: data.cost,
        wastagePct: data.wastagePct,
        marginPct: data.marginPct,
        supplier: data.supplier,
        sourceUrl: data.sourceUrl,
        finish: data.finish,
        tileWidthMm: data.tileWidthMm,
        tileHeightMm: data.tileHeightMm,
        sheetWidthMm: data.sheetWidthMm,
        sheetHeightMm: data.sheetHeightMm,
        groutWidthMm: data.groutWidthMm,
        thicknessMm: data.thicknessMm,
        textureUrl: data.textureUrl,
        thumbnailUrl: data.thumbnailUrl,
        notes: data.notes,
        physicalRepeatM: data.sheetWidthMm ? (data.sheetWidthMm / 1000).toString() : 
                        data.tileWidthMm ? (data.tileWidthMm / 1000).toString() : 
                        "0.3"
      });
      
      console.log('[v2/materials] ✅ Created material:', material.id, material.name);
      res.status(201).json(material);
      return;
      
    } catch (error: any) {
      console.error('[v2/materials] ❌ DB_INSERT_FAILED:', error);
      res.status(500).json({ 
        error: 'DB_INSERT_FAILED', 
        message: error.message 
      });
    }
  });

  // List materials for hydration
  app.get('/api/v2/materials', async (req, res) => {
    try {
      console.log('[v2/materials] Starting materials fetch...');
      
      // Get all materials regardless of orgId - this is for the canvas editor
      const materials = await storage.getMaterials(); // No orgId = get all materials
      
      console.log(`[v2/materials] Successfully fetched ${materials.length} materials`);
      
      // Log first few materials for debugging
      if (materials.length > 0) {
        console.log('[v2/materials] Sample materials:', materials.slice(0, 3).map(m => ({
          id: m.id,
          name: m.name,
          category: m.category,
          textureUrl: m.textureUrl,
          thumbnailUrl: m.thumbnailUrl
        })));
      } else {
        console.log('[v2/materials] No materials found in database');
      }
      
      res.json({ items: materials });
      return;
    } catch (error: any) {
      console.error('[v2/materials] List failed with error:', error);
      console.error('[v2/materials] Error stack:', error.stack);
      res.status(500).json({ 
        error: 'LIST_FAILED', 
        message: error.message,
        details: error.stack 
      });
    }
  });

  // Delete material endpoint
  app.delete('/api/v2/materials/:id', async (req, res) => {
    const id = req.params.id;
    console.log('[v2/materials] DELETE /api/v2/materials/' + id);
    
    if (!id) {
      return res.status(400).json({ 
        error: 'MISSING_ID', 
        message: 'Material ID is required' 
      });
    }
    
    try {
      await storage.deleteMaterial(id);
      console.log('[v2/materials] ✅ Deleted material:', id);
      res.status(204).send();
      
    } catch (err: any) {
      console.error('[v2/materials] ❌ Delete failed:', err);
      res.status(500).json({ error: 'DB_DELETE_FAILED', message: err.message });
    }
  });
}