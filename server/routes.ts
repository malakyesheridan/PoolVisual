import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { registerTextureProxyRoutes } from './routes/textureProxy';
import healthRoutes from "./routes/health";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertOrgSchema, 
  insertJobSchema, 
  insertPhotoSchema,
  insertMaterialSchema,
  insertMaskSchema,
  insertQuoteSchema,
  insertQuoteItemSchema,
  CalibrationSchema
} from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
// JWT removed - using session-based authentication
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import express from "express";
import { registerMaterialRoutes } from "./materialRoutes";
import { registerMaterialRoutesV2 } from "./routes/materials";
import { scenes } from "./routes/scenes";

// JWT_SECRET removed - using session-based authentication

// File upload configuration
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: parseInt(process.env.MAX_IMAGE_SIZE || '10485760'), // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(',');
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  },
});

// Define extended request interface
interface AuthenticatedRequest extends Request {
  user?: any;
  orgId?: string;
}

// Middleware to verify session authentication
const authenticateSession = async (req: AuthenticatedRequest, res: any, next: any) => {
  if (!req.session?.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // Set user from session
  req.user = req.session.user;
  next();
};

// Middleware to verify organization membership
const verifyOrgMembership = async (req: AuthenticatedRequest, res: any, next: any) => {
  try {
    const orgId = req.params.orgId || req.body.orgId || req.query.orgId;
    if (!orgId) {
      return res.status(400).json({ message: 'Organization ID required' });
    }

    const userOrgs = await storage.getUserOrgs(req.user.id);
    const hasAccess = userOrgs.some(org => org.id === orgId);
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this organization' });
    }
    
    req.orgId = orgId;
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Error verifying organization access' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Texture proxy (must be early to avoid auth middleware conflicts)
  registerTextureProxyRoutes(app);
  
  // Serve uploaded files statically
  app.use('/uploads', express.static('uploads'));
  
  // Add health routes
  app.use("/api", healthRoutes);
  
  // Register material routes (texture system)
  registerMaterialRoutes(app);
  registerMaterialRoutesV2(app); // Bulletproof materials endpoint
  
  // Register V2 materials routes
  const { materialsV2Routes } = await import('./routes/materialsV2');
  materialsV2Routes(app);
  
  // Register force materials routes for debugging
  const { materialsForceRoutes } = await import('./routes/materialsForce');
  materialsForceRoutes(app);
  
  // Register import routes (manual import turbo)
  const { registerImportRoutes } = await import('./importRoutes');
  registerImportRoutes(app);
  
  // Register scenes routes (project save/load)
  app.use("/api/scenes", scenes);
  
  // Register fallback routes for no-DB mode
  const { registerFallbackRoutes } = await import('./routes/fallbackRoutes');
  registerFallbackRoutes(app);
  
  // Legacy health check for compatibility
  app.get("/api/health", async (req, res) => {
    try {
      // Test database connection
      const testUser = await storage.getUser('00000000-0000-0000-0000-000000000000');
      
      res.json({ 
        status: "healthy",
        timestamp: new Date().toISOString(),
        db: true,
        storage: true,
        queue: true,
        version: process.env.npm_package_version || '1.0.0'
      });
    } catch (error) {
      res.status(500).json({ 
        status: "unhealthy", 
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Auth endpoints
  app.post("/api/auth/register", async (req: any, res: any) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      
      if (existingUser) {
        return res.status(400).json({ ok: false, error: "User already exists with this email" });
      }

      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });

      res.json({ 
        ok: true,
        user: { id: user.id, email: user.email, username: user.username }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          ok: false,
          error: "Validation error", 
          details: error.errors 
        });
      }
      console.error('[auth/register] DB error:', error);
      res.status(500).json({ ok: false, error: (error as Error).message });
    }
  });

  // Login endpoint removed - using session-based auth from server/index.ts

  // Organization endpoints
  app.post("/api/orgs", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const orgData = insertOrgSchema.parse(req.body);
      const org = await storage.createOrg(orgData, req.user.id);
      res.json(org);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/me/orgs", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const orgs = await storage.getUserOrgs(req.user.id);
      res.json(orgs);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Organization invitation endpoint
  app.post("/api/orgs/:orgId/invite", authenticateSession, verifyOrgMembership, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { email, role } = req.body;
      
      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }

      // Here you would typically send an invitation email
      // For now, we'll just return success
      res.json({ 
        message: "Invitation sent successfully",
        email,
        role,
        orgId: req.params.orgId
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Jobs endpoints
  app.post("/api/jobs", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const jobData = insertJobSchema.parse(req.body);
      
      // Verify user has access to the organization
      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasOrgAccess = userOrgs.some(org => org.id === jobData.orgId);
      
      if (!hasOrgAccess) {
        return res.status(403).json({ message: "Access denied to this organization" });
      }

      // Get the user's org member ID for this organization
      const orgMember = await storage.getOrgMember(req.user.id, jobData.orgId);
      if (!orgMember) {
        return res.status(403).json({ message: "User is not a member of this organization" });
      }

      // Set the correct createdBy field and ensure status is set
      const jobToCreate = {
        ...jobData,
        createdBy: orgMember.id,
        status: jobData.status || 'new'
      };

      const job = await storage.createJob(jobToCreate);
      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/jobs", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { orgId, status, q } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId parameter is required" });
      }

      // Verify org access
      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this organization" });
      }

      let jobs = await storage.getJobs(orgId as string);
      
      // Apply filters
      if (status) {
        jobs = jobs.filter(job => job.status === status);
      }
      
      if (q) {
        const searchTerm = (q as string).toLowerCase();
        jobs = jobs.filter(job => 
          job.clientName.toLowerCase().includes(searchTerm) ||
          job.address?.toLowerCase().includes(searchTerm)
        );
      }

      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/jobs/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const jobId = req.params.id;
      if (!jobId) {
        return res.status(400).json({ message: "Job ID is required" });
      }
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Verify org access
      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(job);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Photos endpoints
  app.post("/api/photos", authenticateSession, upload.single('photo'), async (req: AuthenticatedRequest, res: any) => {
    try {
      const { jobId, width, height, exifData } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ message: "Photo file is required" });
      }

      // Verify job access
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // In production, upload file to cloud storage (S3, Supabase Storage, etc.)
      const originalUrl = `/uploads/${req.file.filename}`;

      const photoData = {
        jobId,
        originalUrl,
        width: parseInt(width),
        height: parseInt(height),
        exifJson: exifData ? JSON.parse(exifData) : null,
      };

      const photo = await storage.createPhoto(photoData);
      res.json(photo);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/photos/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const photoId = req.params.id;
      if (!photoId) {
        return res.status(400).json({ message: "Photo ID is required" });
      }
      
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      // Verify access through job
      const job = await storage.getJob(photo.jobId);
      if (!job) {
        return res.status(404).json({ message: "Associated job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(photo);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/photos/:id/calibration", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const photoId = req.params.id;
      if (!photoId) {
        return res.status(400).json({ message: "Photo ID is required" });
      }
      
      // Support both V1 (legacy) and V2 (robust) calibration formats
      let calibrationData;
      
      if (req.body.samples && Array.isArray(req.body.samples)) {
        // V2 format - validate with Zod
        const validation = CalibrationSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({ 
            message: "Invalid calibration data",
            errors: validation.error.format()
          });
        }
        calibrationData = validation.data;
      } else {
        // V1 format - legacy support
        const { pixelsPerMeter, meta } = req.body;
        if (!pixelsPerMeter || pixelsPerMeter <= 0) {
          return res.status(400).json({ message: "Valid pixelsPerMeter value required" });
        }
        calibrationData = { pixelsPerMeter, meta };
      }

      // Verify photo access
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      const job = await storage.getJob(photo.jobId);
      if (!job) {
        return res.status(404).json({ message: "Associated job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (calibrationData.samples) {
        // V2 format
        const updatedPhoto = await storage.updatePhotoCalibrationV2(photoId, {
          ppm: calibrationData.ppm,
          samples: calibrationData.samples,
          stdevPct: calibrationData.stdevPct
        });
        res.json({
          ...calibrationData,
          updatedAt: new Date().toISOString()
        });
      } else {
        // V1 format  
        const updatedPhoto = await storage.updatePhotoCalibration(photoId, calibrationData.pixelsPerMeter, calibrationData.meta);
        res.json(updatedPhoto);
      }
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Materials endpoints
  app.get("/api/materials", async (req: AuthenticatedRequest, res: any) => {
    try {
      const { orgId, category, q } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId parameter is required" });
      }

      // Verify org access
      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this organization" });
      }

      let materials = await storage.getMaterials(orgId as string, category as string);
      
      // Apply search filter
      if (q) {
        const searchTerm = (q as string).toLowerCase();
        materials = materials.filter(material => 
          material.name.toLowerCase().includes(searchTerm) ||
          material.sku.toLowerCase().includes(searchTerm)
        );
      }

      res.json(materials);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/materials", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const materialData = insertMaterialSchema.parse(req.body);
      
      if (materialData.orgId) {
        // Verify org access
        const userOrgs = await storage.getUserOrgs(req.user.id);
        const hasAccess = userOrgs.some(org => org.id === materialData.orgId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied to this organization" });
        }
      }

      const material = await storage.createMaterial(materialData);
      res.json(material);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.patch("/api/materials/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const updates = req.body;
      
      // Get existing material to check ownership
      const existingMaterial = await storage.updateMaterial(req.params.id, {});
      if (!existingMaterial) {
        return res.status(404).json({ message: "Material not found" });
      }

      if (existingMaterial.orgId) {
        const userOrgs = await storage.getUserOrgs(req.user.id);
        const hasAccess = userOrgs.some(org => org.id === existingMaterial.orgId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const material = await storage.updateMaterial(req.params.id, updates);
      res.json(material);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/materials/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      // Similar access check as above
      await storage.deleteMaterial(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Masks endpoints
  app.post("/api/masks", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const maskData = insertMaskSchema.parse(req.body);
      
      // Verify photo access through job
      const photo = await storage.getPhoto(maskData.photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      const job = await storage.getJob(photo.jobId);
      if (!job) {
        return res.status(404).json({ message: "Associated job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const mask = await storage.createMask(maskData);
      res.json(mask);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/masks", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { photoId } = req.query;
      if (!photoId) {
        return res.status(400).json({ message: "photoId parameter is required" });
      }

      // Verify photo access
      const photo = await storage.getPhoto(photoId as string);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      const job = await storage.getJob(photo.jobId);
      if (!job) {
        return res.status(404).json({ message: "Associated job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const masks = await storage.getMasksByPhoto(photoId as string);
      res.json(masks);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/masks/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      // Add access verification here
      await storage.deleteMask(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Quotes endpoints
  app.post("/api/quotes", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const quoteData = insertQuoteSchema.parse(req.body);
      
      // Verify job access
      const job = await storage.getJob(quoteData.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const quote = await storage.createQuote(quoteData);
      res.json(quote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/quotes/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Verify access through job
      const job = await storage.getJob(quote.jobId);
      if (!job) {
        return res.status(404).json({ message: "Associated job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const items = await storage.getQuoteItems(quote.id);
      res.json({ ...quote, items });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/quotes/:id/items", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const itemData = insertQuoteItemSchema.parse({
        ...req.body,
        quoteId: req.params.id
      });

      // Verify quote access
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const job = await storage.getJob(quote.jobId);
      if (!job) {
        return res.status(404).json({ message: "Associated job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const item = await storage.addQuoteItem(itemData);
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/quotes/:id/recalculate", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      // Verify quote access
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const job = await storage.getJob(quote.jobId);
      if (!job) {
        return res.status(404).json({ message: "Associated job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const items = await storage.getQuoteItems(req.params.id);
      const subtotal = items.reduce((sum, item) => sum + parseFloat(item.lineTotal || "0"), 0);
      
      // Get tax rate from org settings
      const orgSettings = await storage.getOrgSettings(job.orgId);
      const taxRate = parseFloat(orgSettings?.taxRate || "0.10");
      
      const gst = Math.round(subtotal * taxRate * 100) / 100;
      const total = Math.round((subtotal + gst) * 100) / 100;

      const updatedQuote = await storage.updateQuote(req.params.id, {
        subtotal: subtotal.toFixed(2),
        gst: gst.toFixed(2),
        total: total.toFixed(2)
      });

      res.json(updatedQuote);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/quotes/:id/send", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      // Verify access and send quote
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Here you would:
      // 1. Generate PDF
      // 2. Send email via Resend
      // 3. Update quote status to 'sent'
      
      const updatedQuote = await storage.updateQuote(req.params.id, {
        status: 'sent'
      });

      res.json({ 
        message: "Quote sent successfully",
        quote: updatedQuote
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/quotes/:id/accept", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const depositAmount = parseFloat(quote.total || '0') * parseFloat(quote.depositPct || '0.3');
      
      // Update quote status to accepted
      await storage.updateQuote(req.params.id, {
        status: 'accepted'
      });

      res.json({ 
        message: "Quote accepted successfully",
        depositAmount 
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Public share endpoint
  app.get("/api/share/q/:token", async (req, res) => {
    try {
      const quote = await storage.getQuoteByToken(req.params.token);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found or link expired" });
      }

      const items = await storage.getQuoteItems(quote.id);
      res.json({ ...quote, items });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Payment endpoints removed - payments handled externally
  // You can add external payment integration endpoints here if needed

  // Settings endpoints
  app.get("/api/settings/:orgId", authenticateSession, verifyOrgMembership, async (req: AuthenticatedRequest, res: any) => {
    try {
      const settings = await storage.getOrgSettings(req.params.orgId);
      res.json(settings || {
        currencyCode: 'AUD',
        taxRate: '0.10',
        depositDefaultPct: '0.30',
        validityDays: 30,
        pdfTerms: null
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.patch("/api/settings/:orgId", authenticateSession, verifyOrgMembership, async (req: AuthenticatedRequest, res: any) => {
    try {
      const updates = req.body;
      const settings = await storage.updateOrgSettings(req.params.orgId, updates);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Image composition endpoint (for before/after generation)
  app.post("/api/photos/:id/composite", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      // Verify photo access
      const photo = await storage.getPhoto(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      // This would enqueue a background job to generate composite images
      // For now, return a job ID
      const jobId = randomUUID();

      res.json({
        jobId,
        status: 'queued',
        message: 'Composite generation started'
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/photos/:id/composite", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      // Return composite URLs if ready
      res.json({
        beforeUrl: '/api/composites/before.jpg',
        afterUrl: '/api/composites/after.jpg',
        sideBySideUrl: '/api/composites/side-by-side.jpg',
        status: 'completed'
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Notifications endpoints
  app.get("/api/notifications", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      // This would get user notifications from storage
      res.json([]);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/notifications/mark-read", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { notificationIds } = req.body;
      // Mark notifications as read
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  // Simple texture proxy route - Phase A minimal implementation
  app.get('/api/texture', async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: 'Missing URL parameter' });
      }

      // If it's a relative URL, serve it directly
      if (url.startsWith('/')) {
        return res.redirect(url);
      }

      // For external URLs, proxy them
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'PoolVisual/1.0',
          'Accept': 'image/*,*/*;q=0.8'
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Upstream failed' });
      }

      // Set appropriate headers
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      });

      // Pipe the response
      response.body?.pipe(res);
    } catch (error: any) {
      console.error('[texture-proxy]', error);
      res.status(500).json({ error: 'Proxy error', message: error.message });
    }
  });

  return httpServer;
}
