import type { Express } from 'express';
import fs from 'fs';
import path from 'path';

// Fallback data for materials when DB is not available
const FALLBACK_MATERIALS = [
  {
    id: 'fallback-1',
    name: 'Travertine Silver',
    sku: 'TRV-SIL-001',
    category: 'coping',
    unit: 'lm',
    price: 85.00,
    cost: 60.00,
    wastagePct: 8.0,
    marginPct: 25.0,
    textureUrl: '/materials/textures/travertine-silver.jpg',
    thumbnailUrl: '/materials/thumbs/travertine-silver.jpg',
    supplier: 'PoolTile',
    isActive: true,
    createdAt: new Date().toISOString(),
    orgId: null
  },
  {
    id: 'fallback-2',
    name: 'Glass Mosaic Blue 25x25',
    sku: 'GLM-BLU-001',
    category: 'waterline_tile',
    unit: 'm2',
    price: 160.00,
    cost: 120.00,
    wastagePct: 10.0,
    marginPct: 35.0,
    textureUrl: '/materials/textures/glass-mosaic-blue.jpg',
    thumbnailUrl: '/materials/thumbs/glass-mosaic-blue.jpg',
    supplier: 'PoolTile',
    isActive: true,
    createdAt: new Date().toISOString(),
    orgId: null
  },
  {
    id: 'fallback-3',
    name: 'Pebblecrete Quartz Blue',
    sku: 'PEB-QBL-001',
    category: 'interior',
    unit: 'm2',
    price: 95.00,
    cost: 70.00,
    wastagePct: 7.0,
    marginPct: 40.0,
    textureUrl: '/materials/textures/pebblecrete-quartz-blue.jpg',
    thumbnailUrl: '/materials/thumbs/pebblecrete-quartz-blue.jpg',
    supplier: 'PoolTile',
    isActive: true,
    createdAt: new Date().toISOString(),
    orgId: null
  }
];

// Fallback data for assets when DB is not available
const FALLBACK_ASSETS = [
  {
    id: 'asset-1',
    name: 'Pool Template 1',
    type: 'template',
    url: '/assets/templates/pool-template-1.png',
    thumbnailUrl: '/assets/thumbs/pool-template-1.png',
    category: 'pool',
    tags: ['modern', 'rectangular'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'asset-2',
    name: 'Pool Template 2',
    type: 'template',
    url: '/assets/templates/pool-template-2.png',
    thumbnailUrl: '/assets/thumbs/pool-template-2.png',
    category: 'pool',
    tags: ['classic', 'oval'],
    createdAt: new Date().toISOString()
  }
];

async function loadJsonFallback(filePath: string, fallbackData: any[]) {
  try {
    const fullPath = path.resolve(process.cwd(), 'public', filePath);
    if (fs.existsSync(fullPath)) {
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed.items || parsed;
    }
  } catch (error) {
    console.warn(`[fallback] Failed to load ${filePath}:`, error);
  }
  return fallbackData;
}

export function registerFallbackRoutes(app: Express) {
  // Materials endpoint with DB fallback
  app.get('/api/materials', async (req, res) => {
    try {
      // Try to use DB if available
      if (process.env.NO_DB_MODE !== 'true') {
        const { storage } = await import('../storage');
        const materials = await storage.getMaterials();
        res.json({ items: materials });
        return;
      }
    } catch (error) {
      console.warn('[materials] DB failed, using fallback:', error);
    }

    // Fallback to JSON file or hardcoded data
    const materials = await loadJsonFallback('materials/index.json', FALLBACK_MATERIALS);
    
    res.set('x-source', materials === FALLBACK_MATERIALS ? 'fallback-hardcoded' : 'fallback-json');
    res.json({ items: materials });
  });

  // Assets endpoint with DB fallback
  app.get('/api/assets', async (req, res) => {
    try {
      // Try to use DB if available
      if (process.env.NO_DB_MODE !== 'true') {
        // This would be implemented when assets are stored in DB
        // For now, always use fallback
      }
    } catch (error) {
      console.warn('[assets] DB failed, using fallback:', error);
    }

    // Fallback to JSON file or hardcoded data
    const assets = await loadJsonFallback('assets/asset-index.json', FALLBACK_ASSETS);
    
    res.set('x-source', assets === FALLBACK_ASSETS ? 'fallback-hardcoded' : 'fallback-json');
    res.json({ items: assets });
  });

  // Health check for fallback system
  app.get('/api/fallback/health', (req, res) => {
    res.json({
      ok: true,
      mode: process.env.NO_DB_MODE === 'true' ? 'no-db' : 'db',
      materialsFallback: FALLBACK_MATERIALS.length,
      assetsFallback: FALLBACK_ASSETS.length,
      timestamp: new Date().toISOString()
    });
  });
}
