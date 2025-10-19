import { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';

const coNum = z.coerce.number().refine(v => !Number.isNaN(v), 'NaN').optional().nullable();
const strOpt = z.string().trim().optional().nullable();

const MaterialCreateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['coping','waterline_tile','interior','paving','fencing']),
  unit: z.enum(['m2','lm','each']),
  // allow both snake & camel on inputs:
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
  texture_url: strOpt, 
  textureUrl: strOpt,
  thumbnail_url: strOpt, 
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
  wastagePct: b.wastage_pct ?? b.wastagePct ?? 8,
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

export function registerMaterialRoutesV2(app: Express) {
  // Bulletproof create endpoint
  app.post('/api/materials', async (req, res) => {
    console.log('[materials] POST /api/materials - Body:', JSON.stringify(req.body, null, 2));
    
    const parsed = MaterialCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('[materials] Validation failed:', parsed.error.flatten());
      return res.status(400).json({ 
        error: 'INVALID_INPUT', 
        details: parsed.error.flatten(),
        received: req.body 
      });
    }
    
    const data = parsed.data;
    console.log('[materials] Validated data:', JSON.stringify(data, null, 2));
    
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
      
      console.log('[materials] Created material:', material.id, material.name);
      res.status(201).json(material);
      return;
      
    } catch (error: any) {
      console.error('[materials] DB_INSERT_FAILED:', error);
      res.status(500).json({ 
        error: 'DB_INSERT_FAILED', 
        message: error.message 
      });
      return;
    }
  });

  // Delete material endpoint
  app.delete('/api/materials/:id', async (req, res) => {
    const id = req.params.id;
    console.log('[materials] DELETE /api/materials/' + id);
    
    if (!id) {
      return res.status(400).json({ 
        error: 'MISSING_ID', 
        message: 'Material ID is required' 
      });
    }
    
    try {
      await storage.deleteMaterial(id);
      console.log('[materials] ✅ Deleted material:', id);
      res.status(204).send();
      return;
      
    } catch (err: any) {
      console.error('[materials] ❌ Delete failed:', err);
      res.status(500).json({ error: 'DB_DELETE_FAILED', message: err.message });
      return;
    }
  });

  // Debug endpoints
  app.get('/api/_health', (req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });
  
  app.post('/api/_echo', (req, res) => {
    res.json({ got: req.body });
  });
}