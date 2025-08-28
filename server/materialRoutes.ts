import type { Express, Request } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import { textureProcessor } from "./textureProcessor";
import { ImportService } from "./importService";
import { storage } from "./storage";
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
  sku: z.string().optional(),
  category: z.enum(['coping', 'waterline_tile', 'interior', 'paving', 'fencing']),
  unit: z.enum(['m2', 'lm', 'each']),
  price: z.string().optional(),
  cost: z.string().optional(),
  wastagePct: z.string().optional(),
  marginPct: z.string().optional(),
  supplier: z.string().optional(),
  color: z.string().optional(),
  finish: z.string().optional(),
  tileWidthMm: z.string().optional(),
  tileHeightMm: z.string().optional(),
  sheetWidthMm: z.string().optional(),
  sheetHeightMm: z.string().optional(),
  groutWidthMm: z.string().optional(),
  thicknessMm: z.string().optional(),
  notes: z.string().optional(),
  fileKey: z.string().optional(),
  makeSeamless: z.boolean().optional()
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

      // Prepare material data
      const materialData = {
        orgId: null, // Will be set when auth is integrated
        name: data.name,
        sku: data.sku || null,
        category: data.category,
        unit: data.unit,
        price: data.price || null,
        cost: data.cost || null,
        wastagePct: data.wastagePct || "8",
        marginPct: data.marginPct || null,
        supplier: data.supplier || null,
        color: data.color || null,
        finish: data.finish || null,
        tileWidthMm: data.tileWidthMm ? parseInt(data.tileWidthMm) : null,
        tileHeightMm: data.tileHeightMm ? parseInt(data.tileHeightMm) : null,
        sheetWidthMm: data.sheetWidthMm ? parseInt(data.sheetWidthMm) : null,
        sheetHeightMm: data.sheetHeightMm ? parseInt(data.sheetHeightMm) : null,
        groutWidthMm: data.groutWidthMm ? parseInt(data.groutWidthMm) : null,
        thicknessMm: data.thicknessMm ? parseInt(data.thicknessMm) : null,
        notes: data.notes || null,
        textureUrl: textureResult?.textureUrl || null,
        thumbnailUrl: textureResult?.thumbnailUrl || null,
        physicalRepeatM: textureResult?.physicalRepeatM?.toString() || (() => {
          const sizes = {
            sheetW: data.sheetWidthMm ? parseInt(data.sheetWidthMm) : undefined,
            sheetH: data.sheetHeightMm ? parseInt(data.sheetHeightMm) : undefined,
            tileW: data.tileWidthMm ? parseInt(data.tileWidthMm) : undefined,
            tileH: data.tileHeightMm ? parseInt(data.tileHeightMm) : undefined,
            grout: data.groutWidthMm ? parseInt(data.groutWidthMm) : undefined,
            thickness: data.thicknessMm ? parseInt(data.thicknessMm) : undefined
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

      // Get materials - for now without strict org filtering
      const materials = await storage.getMaterials(
        orgId as string || null, 
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
              tileWidthMm: updates.tileWidthMm ? parseInt(updates.tileWidthMm) : undefined,
              tileHeightMm: updates.tileHeightMm ? parseInt(updates.tileHeightMm) : undefined,
              sheetWidthMm: updates.sheetWidthMm ? parseInt(updates.sheetWidthMm) : undefined,
              sheetHeightMm: updates.sheetHeightMm ? parseInt(updates.sheetHeightMm) : undefined,
              groutWidthMm: updates.groutWidthMm ? parseInt(updates.groutWidthMm) : undefined,
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

      const material = await storage.updateMaterial(id, updates);
      res.json(material);

    } catch (error) {
      console.error('Update material error:', error);
      res.status(500).json({ error: 'Failed to update material' });
    }
  });

}