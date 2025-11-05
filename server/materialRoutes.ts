import type { Express, Request } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { textureProcessor } from './textureProcessor.js';
import { ImportService } from './importService.js';
import { storage } from './storage.js';
import { z } from "zod";

// Define extended request interface to match existing auth
interface AuthenticatedRequest extends Request {
  user?: any;
  orgId?: string;
}

const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'));
    }
  }
});

const createMaterialSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  category: z.enum(['coping', 'waterline_tile', 'interior', 'paving', 'fencing']),
  unit: z.enum(['m2', 'lm', 'each']),
  price: z.coerce.number().optional().nullable(),
  cost: z.coerce.number().optional().nullable(),
  wastage_pct: z.coerce.number().optional().nullable(),
  margin_pct: z.coerce.number().optional().nullable(),
  supplier: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  finish: z.string().optional().nullable(),
  tile_width_mm: z.coerce.number().optional().nullable(),
  tile_height_mm: z.coerce.number().optional().nullable(),
  sheet_width_mm: z.coerce.number().optional().nullable(),
  sheet_height_mm: z.coerce.number().optional().nullable(),
  grout_width_mm: z.coerce.number().optional().nullable(),
  thickness_mm: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  texture_url: z.string().url().optional().nullable(),
  thumbnail_url: z.string().url().optional().nullable(),
  source_url: z.string().url().optional().nullable(),
  org_id: z.string().uuid().optional().nullable(),
  fileKey: z.string().optional(),
  makeSeamless: z.boolean().optional(),
  // Support both camelCase (frontend) and snake_case (backend) for compatibility
  wastagePct: z.string().optional(),
  marginPct: z.string().optional(),
  tileWidthMm: z.string().optional(),
  tileHeightMm: z.string().optional(),
  sheetWidthMm: z.string().optional(),
  sheetHeightMm: z.string().optional(),
  groutWidthMm: z.string().optional(),
  thicknessMm: z.string().optional()
});

// Temporary file storage for upload process
const pendingUploads = new Map<string, string>();

export function registerMaterialRoutes(app: Express) {
  
  // Upload texture endpoint
  app.post("/api/materials/upload-texture", upload.single('texture'), async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileKey = randomUUID();
      pendingUploads.set(fileKey, req.file.path);

      // Set cleanup timer (1 hour)
      setTimeout(() => {
        const filePath = pendingUploads.get(fileKey);
        if (filePath) {
          textureProcessor.cleanup(filePath);
          pendingUploads.delete(fileKey);
        }
      }, 60 * 60 * 1000);

      res.json({
        fileKey,
        uploadUrl: null // Not needed for direct upload
      });

    } catch (error) {
      console.error('Texture upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // Create material with texture processing (using existing auth pattern)
  app.post("/api/materials", async (req: AuthenticatedRequest, res: any) => {
    try {
      // Simple auth check - will integrate with existing auth later
      const validation = createMaterialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validation.error.issues 
        });
      }

      const data = validation.data;
      
      // For now, create without orgId validation
      let textureResult = null;

      // Process texture if fileKey provided
      if (data.fileKey) {
        const filePath = pendingUploads.get(data.fileKey);
        if (!filePath) {
          return res.status(400).json({ error: "Invalid or expired file key" });
        }

        try {
          const processOptions: any = {
            makeSeamless: data.makeSeamless !== false
          };
          
          if (data.tileWidthMm) processOptions.tileWidthMm = parseInt(data.tileWidthMm);
          if (data.tileHeightMm) processOptions.tileHeightMm = parseInt(data.tileHeightMm);
          if (data.sheetWidthMm) processOptions.sheetWidthMm = parseInt(data.sheetWidthMm);
          if (data.sheetHeightMm) processOptions.sheetHeightMm = parseInt(data.sheetHeightMm);
          if (data.groutWidthMm) processOptions.groutWidthMm = parseInt(data.groutWidthMm);
          
          textureResult = await textureProcessor.processTexture(filePath, processOptions);

          // Cleanup
          await textureProcessor.cleanup(filePath);
          pendingUploads.delete(data.fileKey);
        } catch (error) {
          console.error('Texture processing error:', error);
          return res.status(500).json({ error: 'Texture processing failed' });
        }
      }

      // Helper function to safely parse numbers
      const safeNumber = (val: any, fallback: number | null = null) => {
        if (val === null || val === undefined || val === '') return fallback;
        const parsed = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(parsed) ? fallback : parsed;
      };

      // Support both camelCase and snake_case inputs for compatibility
      const getValue = (snakeKey: string, camelKey: string) => {
        return (data as any)[snakeKey] ?? (data as any)[camelKey];
      };

      // Prepare material data
      const materialData = {
        orgId: data.org_id || null,
        name: data.name,
        sku: data.sku || null,
        category: data.category,
        unit: data.unit,
        price: safeNumber(data.price),
        cost: safeNumber(data.cost),
        wastagePct: safeNumber(getValue('wastage_pct', 'wastagePct'), 8),
        marginPct: safeNumber(getValue('margin_pct', 'marginPct')),
        supplier: data.supplier || 'PoolTile',
        color: data.color || null,
        finish: data.finish || null,
        tileWidthMm: safeNumber(getValue('tile_width_mm', 'tileWidthMm')),
        tileHeightMm: safeNumber(getValue('tile_height_mm', 'tileHeightMm')),
        sheetWidthMm: safeNumber(getValue('sheet_width_mm', 'sheetWidthMm')),
        sheetHeightMm: safeNumber(getValue('sheet_height_mm', 'sheetHeightMm')),
        groutWidthMm: safeNumber(getValue('grout_width_mm', 'groutWidthMm')),
        thicknessMm: safeNumber(getValue('thickness_mm', 'thicknessMm')),
        notes: data.notes || null,
        textureUrl: textureResult?.textureUrl || data.texture_url || null,
        thumbnailUrl: textureResult?.thumbnailUrl || data.thumbnail_url || null,
        sourceUrl: data.source_url || null,
        physicalRepeatM: textureResult?.physicalRepeatM?.toString() || (() => {
          const sizes = {
            sheetW: safeNumber(getValue('sheet_width_mm', 'sheetWidthMm'), 0),
            sheetH: safeNumber(getValue('sheet_height_mm', 'sheetHeightMm'), 0),
            tileW: safeNumber(getValue('tile_width_mm', 'tileWidthMm'), 0),
            tileH: safeNumber(getValue('tile_height_mm', 'tileHeightMm'), 0),
            grout: safeNumber(getValue('grout_width_mm', 'groutWidthMm'), 0),
            thickness: safeNumber(getValue('thickness_mm', 'thicknessMm'), 0)
          };
          return ImportService.calculatePhysicalRepeat(sizes).toString();
        })()
      };

      const material = await storage.createMaterial(materialData);

      res.json(material);

    } catch (error) {
      console.error('Create material error:', error);
      res.status(500).json({ error: 'Failed to create material' });
    }
  });

  // Get materials with pagination and filtering
  app.get("/api/materials", async (req: AuthenticatedRequest, res: any) => {
    try {
      const { category, q, page = "1", pageSize = "20", orgId } = req.query;

      // Get materials - validate orgId is a proper UUID or null
      let validOrgId: string | undefined = undefined;
      if (orgId && typeof orgId === 'string' && orgId !== 'default') {
        // Basic UUID validation
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(orgId)) {
          validOrgId = orgId;
        } else {
          return res.status(400).json({ 
            error: 'INVALID_ORG_ID', 
            message: 'orgId must be a valid UUID or omitted for global materials' 
          });
        }
      }
      
      const materials = await storage.getMaterials(
        validOrgId, 
        category as string || undefined
      );

      // Simple filtering by search term
      let filteredMaterials = materials;
      if (q && typeof q === 'string') {
        const searchTerm = q.toLowerCase();
        filteredMaterials = materials.filter(m => 
          m.name.toLowerCase().includes(searchTerm) ||
          (m.sku && m.sku.toLowerCase().includes(searchTerm)) ||
          (m.supplier && m.supplier.toLowerCase().includes(searchTerm))
        );
      }

      // Simple pagination
      const pageNum = parseInt(page as string);
      const size = parseInt(pageSize as string);
      const start = (pageNum - 1) * size;
      const end = start + size;
      
      const paginatedMaterials = filteredMaterials.slice(start, end);

      res.json({
        materials: paginatedMaterials,
        total: filteredMaterials.length,
        page: pageNum,
        pageSize: size,
        totalPages: Math.ceil(filteredMaterials.length / size)
      });

    } catch (error) {
      console.error('Get materials error:', error);
      res.status(500).json({ error: 'Failed to get materials' });
    }
  });

  // Update material
  app.patch("/api/materials/:id", async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Process new texture if provided
      if (updates.fileKey) {
        const filePath = pendingUploads.get(updates.fileKey);
        if (filePath) {
          try {
            const textureResult = await textureProcessor.processTexture(filePath, {
              tileWidthMm: updates.tileWidthMm ? parseInt(updates.tileWidthMm) : 0,
              tileHeightMm: updates.tileHeightMm ? parseInt(updates.tileHeightMm) : 0,
              sheetWidthMm: updates.sheetWidthMm ? parseInt(updates.sheetWidthMm) : 0,
              sheetHeightMm: updates.sheetHeightMm ? parseInt(updates.sheetHeightMm) : 0,
              groutWidthMm: updates.groutWidthMm ? parseInt(updates.groutWidthMm) : 0,
              makeSeamless: updates.makeSeamless !== false
            });

            updates.textureUrl = textureResult.textureUrl;
            updates.thumbnailUrl = textureResult.thumbnailUrl;
            updates.physicalRepeatM = textureResult.physicalRepeatM.toString();

            await textureProcessor.cleanup(filePath);
            pendingUploads.delete(updates.fileKey);
          } catch (error) {
            console.error('Texture reprocessing error:', error);
            return res.status(500).json({ error: 'Texture processing failed' });
          }
        }
      }

      const material = await storage.updateMaterial(id as string, updates);
      res.json(material);

    } catch (error) {
      console.error('Update material error:', error);
      res.status(500).json({ error: 'Failed to update material' });
    }
  });

}