import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { registerTextureProxyRoutes } from './routes/textureProxy.js';
import healthRoutes from "./routes/health.js";
import { storage } from './storage.js';
import { CompositeGenerator } from './compositeGenerator.js';
import { 
  insertUserSchema, 
  insertOrgSchema, 
  insertJobSchema, 
  insertMaterialSchema,
  insertMaskSchema,
  insertQuoteSchema,
  insertQuoteItemSchema,
  CalibrationSchema
} from "../shared/schema.js";
import { z } from "zod";
import bcrypt from "bcryptjs";
// JWT removed - using session-based authentication
import multer from "multer";
import { randomUUID } from "crypto";
import express from "express";
import { registerMaterialRoutes } from './materialRoutes.js';
import { registerMaterialRoutesV2 } from "./routes/materials.js";
import { scenes } from "./routes/scenes.js";
import sharp from "sharp";
import { PasswordService, PasswordValidator } from "./lib/passwordService.js";
import { PasswordResetService } from "./lib/passwordResetService.js";
import { createBruteForceMiddleware } from "./lib/bruteForceProtection.js";
import { storageService } from "./lib/storageService.js";

import multer from "multer";
import { randomUUID } from "crypto";
import express from "express";
import path from "path";
import os from "os";

// JWT_SECRET removed - using session-based authentication

// Use memory storage for Vercel (no filesystem access needed)
// For local development, use disk storage with /tmp directory
const getMulterConfig = () => {
  if (process.env.VERCEL) {
    // Use memory storage in Vercel - files are processed immediately
    // Increased limit to 50MB for canvas exports which can be large
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: parseInt(process.env.MAX_IMAGE_SIZE || '52428800'), // 50MB default for Vercel
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
  } else {
    // Local development: use disk storage
    const uploadDir = 'uploads/';
    return multer({
      dest: uploadDir,
      limits: {
        fileSize: parseInt(process.env.MAX_IMAGE_SIZE || '52428800'), // 50MB default
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
  }
};

// Lazy initialization of multer to avoid creating directories at module load
let upload: ReturnType<typeof multer> | null = null;

function getUpload() {
  if (!upload) {
    upload = getMulterConfig();
  }
  return upload;
}

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

export async function registerRoutes(app: Express): Promise<void> {
  console.log('🔧 Registering routes...');
  
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
  const { materialsV2Routes } = await import('./routes/materialsV2.js');
  materialsV2Routes(app);
  
  // Register force materials routes for debugging
  const { materialsForceRoutes } = await import('./routes/materialsForce.js');
  materialsForceRoutes(app);
  
  // Register materials list fallback
  const { registerMaterialsListFallback } = await import('./routes/materialsListFallback.js');
  registerMaterialsListFallback(app);
  
  // Register import routes (manual import turbo)
  const { registerImportRoutes } = await import('./importRoutes.js');
  registerImportRoutes(app);
  
  // Register scenes routes (project save/load)
  app.use("/api/scenes", scenes);
  
  // Register fallback routes for no-DB mode
  const { registerFallbackRoutes } = await import('./routes/fallbackRoutes.js');
  registerFallbackRoutes(app);
  
  // Register quote routes
  const { registerQuoteRoutes } = await import('./routes/quotes.js');
  registerQuoteRoutes(app);
  
  // Register export routes (presigned URLs)
  const { registerExportRoutes } = await import('./routes/export.js');
  registerExportRoutes(app);
  
  // Legacy health check for compatibility
  app.get("/api/health", async (req, res) => {
    try {
      // Test database connection
      await storage.getUser('00000000-0000-0000-0000-000000000000');
      
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
      
      // Enhanced password validation
      const passwordValidation = PasswordValidator.validate(userData.password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          ok: false,
          error: "Password validation failed",
          details: passwordValidation.errors,
          strength: passwordValidation.strength
        });
      }

      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ ok: false, error: "User already exists with this email" });
      }

      // Hash password with enhanced service
      const hashedPassword = await PasswordService.hashPassword(userData.password);
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        isActive: true,
        failedLoginAttempts: 0,
        loginCount: 0,
      });

      // Log security event
      const { AuthAuditService } = await import('./lib/authAuditService.js');
      // Extract IP address (handle x-forwarded-for as string or array)
      let ipAddress: string | undefined = req.ip;
      if (!ipAddress) {
        const forwardedFor = req.headers['x-forwarded-for'];
        if (Array.isArray(forwardedFor)) {
          ipAddress = forwardedFor[0];
        } else if (typeof forwardedFor === 'string') {
          ipAddress = forwardedFor.split(',')[0].trim();
        } else {
          ipAddress = req.socket.remoteAddress;
        }
      }
      await AuthAuditService.logSecurityEvent({
        userId: user.id,
        eventType: 'user_registered',
        ipAddress,
        userAgent: req.headers['user-agent'],
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

  // Password Reset endpoints
  const passwordResetService = new PasswordResetService();
  const bruteForceMiddleware = createBruteForceMiddleware({
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 60 * 60 * 1000 // 1 hour
  });

  // POST /api/auth/password-reset/initiate
  app.post("/api/auth/password-reset/initiate", bruteForceMiddleware('password_reset'), async (req: any, res: any) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          ok: false, 
          error: "Email is required" 
        });
      }

      const result = await passwordResetService.initiatePasswordReset(email);
      
      if (result.success) {
        res.json({ 
          ok: true, 
          message: result.message 
        });
      } else {
        // Record failed attempt for rate limiting
        if (req.recordFailedAttempt) {
          req.recordFailedAttempt();
        }
        
        res.status(400).json({ 
          ok: false, 
          error: result.error,
          message: result.message 
        });
      }
    } catch (error) {
      console.error('[PasswordReset] Error initiating password reset:', error);
      res.status(500).json({ 
        ok: false, 
        error: "Internal server error" 
      });
    }
  });

  // POST /api/auth/password-reset/confirm
  app.post("/api/auth/password-reset/confirm", bruteForceMiddleware('password_reset'), async (req: any, res: any) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ 
          ok: false, 
          error: "Token and new password are required" 
        });
      }

      const result = await passwordResetService.resetPassword(token, newPassword);
      
      if (result.success) {
        res.json({ 
          ok: true, 
          message: result.message 
        });
      } else {
        // Record failed attempt for rate limiting
        if (req.recordFailedAttempt) {
          req.recordFailedAttempt();
        }
        
        res.status(400).json({ 
          ok: false, 
          error: result.error,
          message: result.message 
        });
      }
    } catch (error) {
      console.error('[PasswordReset] Error confirming password reset:', error);
      res.status(500).json({ 
        ok: false, 
        error: "Internal server error" 
      });
    }
  });

  // POST /api/auth/password-reset/verify-email
  app.post("/api/auth/password-reset/verify-email", async (req: any, res: any) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ 
          ok: false, 
          error: "Verification token is required" 
        });
      }

      const result = await passwordResetService.verifyEmail(token);
      
      if (result.success) {
        res.json({ 
          ok: true, 
          message: result.message 
        });
      } else {
        res.status(400).json({ 
          ok: false, 
          error: result.error,
          message: result.message 
        });
      }
    } catch (error) {
      console.error('[EmailVerification] Error verifying email:', error);
      res.status(500).json({ 
        ok: false, 
        error: "Internal server error" 
      });
    }
  });

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

  // Update organization (for branding, logo, etc.)
  app.patch("/api/orgs/:orgId", authenticateSession, verifyOrgMembership, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { orgId } = req.params;
      if (!orgId) {
        return res.status(400).json({ message: "Organization ID is required" });
      }

      const updates = req.body;
      const updatedOrg = await storage.updateOrg(orgId, updates);

      // If branding was updated, invalidate PDF cache for all quotes in this org
      if (updates.brandColors || updates.logoUrl) {
        try {
          const { pdfGenerator } = await import('./lib/pdfGenerator.js');
          // Get all quotes for this org and invalidate their cache
          const quotes = await storage.getQuotes(orgId);
          await Promise.all(
            quotes.map(quote => pdfGenerator.invalidateCache(quote.id).catch(() => {}))
          );
        } catch (error) {
          console.warn('[Routes] Failed to invalidate PDF cache after branding update:', error);
        }
      }

      res.json(updatedOrg);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Get organization member endpoint
  app.get("/api/orgs/:orgId/members/:userId", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { orgId, userId } = req.params;
      const orgMember = await storage.getOrgMember(userId, orgId);
      if (!orgMember) {
        return res.status(404).json({ message: "Organization member not found" });
      }
      res.json(orgMember);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Create/Join organization member endpoint
  // Automatically adds the current user to an organization if they're not already a member
  // IMPORTANT: This route must come BEFORE /api/orgs/:orgId/invite to avoid route conflicts
  app.post("/api/orgs/:orgId/join", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    console.log('[Route] POST /api/orgs/:orgId/join called', { 
      orgId: req.params.orgId, 
      userId: req.user?.id,
      body: req.body 
    });
    try {
      const { orgId } = req.params;
      const { role } = req.body; // Optional: role (defaults to "estimator")
      
      console.log('[Route] Processing join request', { orgId, role, userId: req.user.id });
      
      // Verify the organization exists
      const org = await storage.getOrg(orgId);
      if (!org) {
        console.log('[Route] Organization not found:', orgId);
        return res.status(404).json({ message: "Organization not found" });
      }

      console.log('[Route] Organization found, creating membership');
      // Create or get existing membership
      const orgMember = await storage.createOrgMember(orgId, req.user.id, role || "estimator");
      console.log('[Route] Membership created successfully:', orgMember);
      res.json(orgMember);
    } catch (error) {
      console.error('[Route] Error in /join endpoint:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  console.log('✅ Registered route: POST /api/orgs/:orgId/join');

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
      console.log('Job creation request body:', req.body);
      
      // Manual validation instead of schema
      const { clientName, clientPhone, clientEmail, address, status } = req.body;
      
      if (!clientName || typeof clientName !== 'string') {
        return res.status(400).json({ message: "clientName is required" });
      }
      
      // Get user's organizations (should be just one for now)
      const userOrgs = await storage.getUserOrgs(req.user.id);
      if (userOrgs.length === 0) {
        return res.status(400).json({ 
          message: "No organization found. Please contact support." 
        });
      }
      
      // Use the first (and only) org for now
      const userOrg = userOrgs[0];
      
      // Get the user's org member ID for this organization
      const orgMember = await storage.getOrgMember(req.user.id, userOrg.id);
      if (!orgMember) {
        return res.status(403).json({ message: "User is not a member of this organization" });
      }
      
      const jobData = {
        clientName,
        clientPhone: clientPhone || null,
        clientEmail: clientEmail || null,
        address: address || null,
        orgId: userOrg.id, // Auto-use user's org
        status: status || 'new',
        createdBy: orgMember.id
      };

      const job = await storage.createJob(jobData);
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

  // Batch endpoint for canvas status - optimized to reduce N+1 queries
  app.get("/api/jobs/canvas-status", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { orgId, jobIds } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId parameter is required" });
      }

      // Verify org access
      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this organization" });
      }

      // Parse jobIds if provided (comma-separated)
      const jobIdArray = jobIds ? (jobIds as string).split(',').filter(Boolean) : null;

      // Use optimized batch query to fetch all canvas status in one go
      const { executeQuery } = await import('./lib/db.js');
      
      // Build query to get all canvas status efficiently
      let query = `
        SELECT 
          j.id as job_id,
          COUNT(DISTINCT p.id) as total_photos,
          COUNT(DISTINCT CASE WHEN m.id IS NOT NULL THEN p.id END) as photos_with_canvas_work,
          MAX(m.created_at) as last_canvas_work
        FROM jobs j
        LEFT JOIN photos p ON p.job_id = j.id
        LEFT JOIN masks m ON m.photo_id = p.id
        WHERE j.org_id = $1
      `;
      
      const params: any[] = [orgId];
      
      if (jobIdArray && jobIdArray.length > 0) {
        query += ` AND j.id = ANY($2::uuid[])`;
        params.push(jobIdArray);
      }
      
      query += `
        GROUP BY j.id
        ORDER BY j.created_at DESC
      `;

      const results = await executeQuery(query, params);

      // Transform results to match expected format
      const canvasStatus = results.map((row: any) => ({
        jobId: row.job_id,
        canvasWorkProgress: {
          totalPhotos: parseInt(row.total_photos) || 0,
          photosWithCanvasWork: parseInt(row.photos_with_canvas_work) || 0,
          completionPercentage: row.total_photos > 0 
            ? Math.round((parseInt(row.photos_with_canvas_work) / parseInt(row.total_photos)) * 100)
            : 0,
          lastCanvasWork: row.last_canvas_work ? new Date(row.last_canvas_work).getTime() : null
        }
      }));

      res.json(canvasStatus);
    } catch (error) {
      console.error('[Canvas Status Batch] Error:', error);
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

  app.patch("/api/jobs/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
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

      // Update job with provided fields
      const updatedJob = await storage.updateJob(jobId, req.body);
      res.json(updatedJob);
    } catch (error) {
      console.error('[Routes] Error updating job:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Photos endpoints
  app.post("/api/photos", authenticateSession, getUpload().single('photo'), async (req: AuthenticatedRequest, res: any) => {
    try {
      console.log('Photo upload request:', { 
        body: req.body, 
        file: req.file ? { 
          filename: req.file.filename, 
          size: req.file.size,
          buffer: !!req.file.buffer,
          path: req.file.path
        } : null,
        user: req.user?.id 
      });
      
      const { jobId, width, height, exifData } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ message: "Photo file is required" });
      }

      // Check file size
      if (req.file.size > 52428800) { // 50MB
        return res.status(413).json({ 
          message: "File too large. Maximum size is 50MB.",
          received: `${(req.file.size / 1024 / 1024).toFixed(2)}MB`,
          limit: "50MB"
        });
      }

      if (!jobId) {
        return res.status(400).json({ message: "Job ID is required" });
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

      // Get image buffer and dimensions
      let imageBuffer: Buffer;
      if (req.file.buffer) {
        // Memory storage (Vercel) - use buffer directly
        imageBuffer = req.file.buffer;
      } else if (req.file.path) {
        // Disk storage (local) - read from file
        const fs = await import('fs');
        imageBuffer = fs.readFileSync(req.file.path);
      } else {
        return res.status(400).json({ message: "No file buffer or path available" });
      }

      // CRITICAL FIX: Always use sharp metadata for dimensions (source of truth)
      // Client-provided dimensions may not match actual image file (EXIF rotation, browser processing, etc.)
      let finalWidth: number | null = null;
      let finalHeight: number | null = null;

      try {
        const meta = await sharp(imageBuffer).metadata();
        if (meta.width && meta.height) {
          finalWidth = meta.width;
          finalHeight = meta.height;
          
          // Log warning if client provided different dimensions
          if (width && height) {
            const clientWidth = parseInt(width);
            const clientHeight = parseInt(height);
            if (!Number.isNaN(clientWidth) && !Number.isNaN(clientHeight)) {
              const widthDiff = Math.abs(clientWidth - finalWidth);
              const heightDiff = Math.abs(clientHeight - finalHeight);
              if (widthDiff > 1 || heightDiff > 1) {
                console.warn(`[PhotoUpload] Dimension mismatch: client provided ${clientWidth}x${clientHeight}, actual ${finalWidth}x${finalHeight}. Using actual dimensions.`);
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to read image metadata with sharp:', (e as Error).message);
        // Fallback to client-provided dimensions only if sharp fails
        if (width && height) {
          finalWidth = parseInt(width);
          finalHeight = parseInt(height);
          if (Number.isNaN(finalWidth) || Number.isNaN(finalHeight)) {
            finalWidth = null;
            finalHeight = null;
          }
        }
      }

      if (!finalWidth || !finalHeight) {
        return res.status(400).json({ message: "Unable to determine image dimensions" });
      }

      // Upload to cloud storage (Vercel Blob or S3) in production, or use local path in development
      let originalUrl: string;
      const hasCloudStorage = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.AWS_ACCESS_KEY_ID);
      
      console.log('[PhotoUpload] Storage check:', {
        VERCEL: !!process.env.VERCEL,
        BLOB_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
        AWS_KEY: !!process.env.AWS_ACCESS_KEY_ID,
        hasCloudStorage
      });
      
      if (process.env.VERCEL || hasCloudStorage) {
        // Upload to cloud storage (Vercel Blob preferred, S3 fallback)
        const fileExtension = req.file.originalname.split('.').pop() || 'jpg';
        const storagePath = `photos/${jobId}/${randomUUID()}.${fileExtension}`;
        
        try {
          console.log('[PhotoUpload] Uploading to cloud storage:', storagePath);
          originalUrl = await storageService.put(
            storagePath,
            imageBuffer,
            req.file.mimetype || 'image/jpeg'
          );
          console.log('[PhotoUpload] Successfully uploaded to cloud storage:', originalUrl);
        } catch (storageError: any) {
          console.error('[PhotoUpload] Cloud storage upload failed:', storageError);
          console.error('[PhotoUpload] Error details:', {
            message: storageError?.message,
            stack: storageError?.stack,
            name: storageError?.name
          });
          // Don't fallback to local path in production - throw error instead
          if (process.env.VERCEL) {
            return res.status(500).json({ 
              message: 'Failed to upload photo to cloud storage. Please check storage configuration.',
              error: storageError?.message 
            });
          }
          // Fallback to local path only in development
          originalUrl = `/uploads/${randomUUID()}-${req.file.originalname}`;
        }
      } else {
        // Local development - use local path
        if (req.file.path) {
          originalUrl = `/uploads/${req.file.filename}`;
        } else {
          // If no path, save to local uploads directory
          const fs = await import('fs');
          const uploadsDir = path.resolve(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const filename = `${randomUUID()}-${req.file.originalname}`;
          const filePath = path.join(uploadsDir, filename);
          fs.writeFileSync(filePath, imageBuffer);
          originalUrl = `/uploads/${filename}`;
        }
      }

      const photoData = {
        jobId,
        originalUrl,
        width: finalWidth,
        height: finalHeight,
        exifJson: exifData ? JSON.parse(exifData) : null,
      };

      console.log('Creating photo with data:', photoData);
      const photo = await storage.createPhoto(photoData);
      console.log('Photo created successfully:', photo.id);
      
      res.json(photo);
    } catch (error) {
      console.error('Photo upload error:', error);
      
      // Handle multer errors specifically
      if ((error as any).code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ 
          message: 'File too large',
          error: 'File exceeds maximum size limit',
          limit: '50MB'
        });
      }
      
      // Default to 500 if error lacks a status
      res.status((error as any)?.statusCode || 500).json({ message: (error as Error).message || 'Upload failed' });
    }
  });

  app.get("/api/photos/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const photoId = req.params.id;
      if (!photoId) {
        return res.status(400).json({ message: "Photo ID is required" });
      }
      
      // CRITICAL FIX: Wrap database call in try-catch to handle any DB errors gracefully
      let photo;
      try {
        photo = await storage.getPhoto(photoId);
      } catch (dbError) {
        console.error('[GetPhoto] Database error fetching photo:', dbError);
        // If it's a database error (e.g., photo was just deleted), return 404
        return res.status(404).json({ message: "Photo not found" });
      }
      
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      // CRITICAL FIX: Better error handling for edge cases
      // Check if jobId exists before trying to access it
      if (!photo.jobId) {
        console.error('[GetPhoto] Photo missing jobId:', photoId);
        return res.status(404).json({ message: "Photo not found or invalid" });
      }

      // Verify access through job - handle errors gracefully
      let job;
      try {
        job = await storage.getJob(photo.jobId);
      } catch (jobError) {
        console.error('[GetPhoto] Error fetching job:', jobError);
        return res.status(404).json({ message: "Photo not found" });
      }
      
      if (!job) {
        console.error('[GetPhoto] Job not found for photo:', photoId, 'jobId:', photo.jobId);
        return res.status(404).json({ message: "Photo not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(photo);
    } catch (error) {
      console.error('[GetPhoto] Unexpected error fetching photo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Return 404 instead of 500 for deleted photos or other "not found" scenarios
      // This prevents client retries and makes error handling more predictable
      return res.status(404).json({ message: `Photo not found: ${errorMessage}` });
    }
  });

  // Proxy endpoint for old photos with local paths - redirects to Vercel Blob or serves locally
  app.get("/api/photos/:id/image", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const photoId = req.params.id;
      if (!photoId) {
        return res.status(400).json({ message: "Photo ID is required" });
      }
      
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      // Verify access
      const job = await storage.getJob(photo.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // If photo has an external URL (Vercel Blob, S3, etc.), redirect to it
      if (photo.originalUrl && (photo.originalUrl.startsWith('http://') || photo.originalUrl.startsWith('https://'))) {
        return res.redirect(photo.originalUrl);
      }

      // If it's a local path, try to serve it (for development only)
      if (photo.originalUrl && photo.originalUrl.startsWith('/uploads/')) {
        // In production, these files don't exist
        if (process.env.VERCEL) {
          return res.status(404).json({ 
            message: "Photo file not found. This photo was uploaded before cloud storage was enabled.",
            suggestion: "Please re-upload this photo.",
            originalUrl: photo.originalUrl
          });
        }
        
        // Local development - try to serve from filesystem
        const fs = await import('fs');
        const filePath = path.resolve(process.cwd(), photo.originalUrl.substring(1));
        if (fs.existsSync(filePath)) {
          return res.sendFile(filePath);
        }
      }

      return res.status(404).json({ message: "Photo file not found" });
    } catch (error) {
      console.error('[GetPhotoImage] Error:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Update photo data
  app.put("/api/photos/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const photoId = req.params.id;
      if (!photoId) {
        return res.status(400).json({ message: "Photo ID is required" });
      }
      
      const { originalUrl, width, height } = req.body;
      if (!originalUrl || !width || !height) {
        return res.status(400).json({ message: "originalUrl, width, and height are required" });
      }
      
      // Verify access through existing photo
      const existingPhoto = await storage.getPhoto(photoId);
      if (!existingPhoto) {
        return res.status(404).json({ message: "Photo not found" });
      }

      const job = await storage.getJob(existingPhoto.jobId);
      if (!job) {
        return res.status(404).json({ message: "Associated job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedPhoto = await storage.updatePhoto(photoId, {
        originalUrl,
        width: parseInt(width),
        height: parseInt(height)
      });
      
      res.json(updatedPhoto);
    } catch (error) {
      console.error('Error updating photo:', error);
      res.status(500).json({ message: "Failed to update photo" });
    }
  });

  // Delete photo
  app.delete("/api/photos/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const photoId = req.params.id;
      if (!photoId) {
        return res.status(400).json({ message: "Photo ID is required" });
      }
      
      // Verify access through existing photo
      const existingPhoto = await storage.getPhoto(photoId);
      if (!existingPhoto) {
        return res.status(404).json({ message: "Photo not found" });
      }

      const job = await storage.getJob(existingPhoto.jobId);
      if (!job) {
        return res.status(404).json({ message: "Associated job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // CRITICAL FIX: Delete associated records first to prevent orphaned records
      // and foreign key constraint issues
      
      // 1. Delete associated masks
      try {
        const associatedMasks = await storage.getMasksByPhoto(photoId);
        console.log(`[DeletePhoto] Found ${associatedMasks.length} masks to delete`);
        for (const mask of associatedMasks) {
          try {
            await storage.deleteMask(mask.id);
            console.log(`[DeletePhoto] Deleted associated mask: ${mask.id}`);
          } catch (maskError) {
            console.warn(`[DeletePhoto] Failed to delete mask ${mask.id}:`, maskError);
            // Continue with photo deletion even if mask deletion fails
          }
        }
      } catch (maskQueryError) {
        console.error('[DeletePhoto] Error querying masks:', maskQueryError);
        // Continue with photo deletion even if mask query fails
      }
      
      // 2. Delete or nullify AI enhancement jobs that reference this photo
      // Note: ai_enhancement_jobs.photo_id has no ON DELETE CASCADE, so we need to handle it manually
      try {
        const { getSql } = await import('./db.js');
        const sql = getSql();
        if (sql) {
          // Use Neon client with tagged template literal
          await sql`UPDATE ai_enhancement_jobs SET photo_id = NULL WHERE photo_id = ${photoId}`;
          console.log(`[DeletePhoto] Nullified AI enhancement jobs photo_id for: ${photoId}`);
        }
      } catch (aiJobError: any) {
        // If this fails, it's not critical - the table might not exist or the photo might not have enhancement jobs
        console.warn('[DeletePhoto] Could not handle AI enhancement jobs (this is optional):', aiJobError.message || aiJobError);
        // Continue with photo deletion - AI jobs are optional
      }
      
      // Delete the photo
      try {
        await storage.deletePhoto(photoId);
        console.log(`[DeletePhoto] Successfully deleted photo: ${photoId}`);
      } catch (deleteError) {
        console.error('[DeletePhoto] Error deleting photo from database:', deleteError);
        // Check if it's a foreign key constraint error
        const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError);
        if (errorMessage.includes('foreign key') || errorMessage.includes('constraint')) {
          return res.status(409).json({ 
            message: "Cannot delete photo: it is referenced by other records. Please delete associated records first." 
          });
        }
        throw deleteError; // Re-throw if it's not a constraint error
      }
      
      res.json({ message: "Photo deleted successfully" });
    } catch (error) {
      console.error('[DeletePhoto] Unexpected error deleting photo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DeletePhoto] Error details:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        photoId: req.params.id
      });
      res.status(500).json({ 
        message: "Failed to delete photo",
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  });

  // Get photos for a specific job
  app.get("/api/jobs/:id/photos", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const jobId = req.params.id;
      if (!jobId) {
        return res.status(400).json({ message: "Job ID is required" });
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

      const photos = await storage.getJobPhotos(jobId);
      res.json(photos);
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
        await storage.updatePhotoCalibrationV2(photoId, {
          ppm: calibrationData.ppm ?? 0,
          samples: calibrationData.samples.map(sample => ({
            x1: sample.a.x,
            y1: sample.a.y,
            x2: sample.b.x,
            y2: sample.b.y,
            distance: sample.meters,
            pixels: Math.sqrt(Math.pow(sample.b.x - sample.a.x, 2) + Math.pow(sample.b.y - sample.a.y, 2))
          })),
          stdevPct: calibrationData.stdevPct ?? 0
        });
        res.json({
          ...calibrationData,
          updatedAt: new Date().toISOString()
        });
      } else {
        // V1 format  
        const updatedPhoto = await storage.updatePhotoCalibration(photoId, calibrationData.ppm ?? 0, {
          samples: [],
          stdevPct: calibrationData.stdevPct ?? 0
        });
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
          (material.sku && material.sku.toLowerCase().includes(searchTerm))
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
      
      const materialId = req.params.id;
      if (!materialId) {
        return res.status(400).json({ message: "Material ID is required" });
      }
      
      // Get existing material to check ownership
      const existingMaterial = await storage.updateMaterial(materialId, {});
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

      const materialId2 = req.params.id;
      if (!materialId2) {
        return res.status(400).json({ message: "Material ID is required" });
      }
      
      const material = await storage.updateMaterial(materialId2, updates);
      res.json(material);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/materials/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const materialId = req.params.id;
      if (!materialId) {
        return res.status(400).json({ message: "Material ID is required" });
      }
      
      // Similar access check as above
      await storage.deleteMaterial(materialId);
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
      const photoId = req.query.photoId as string;
      if (!photoId) {
        return res.status(400).json({ message: "photoId parameter is required" });
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

      const masks = await storage.getMasksByPhoto(photoId as string);
      res.json(masks);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/masks/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const maskId = req.params.id;
      if (!maskId) {
        return res.status(400).json({ message: "Mask ID is required" });
      }
      
      // Verify access through existing mask
      const existingMask = await storage.getMask(maskId);
      if (!existingMask) {
        return res.status(404).json({ message: "Mask not found" });
      }

      const photo = await storage.getPhoto(existingMask.photoId);
      if (!photo) {
        return res.status(404).json({ message: "Associated photo not found" });
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
      
      await storage.deleteMask(maskId);
      
      // Invalidate composite cache since masks have changed
      try {
        await storage.clearPhotoComposite(existingMask.photoId);
        console.log(`[DeleteMask] Cleared composite cache for photo ${existingMask.photoId}`);
      } catch (cacheError) {
        // Log but don't fail the delete operation if cache clearing fails
        console.warn(`[DeleteMask] Failed to clear composite cache:`, cacheError);
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Quotes endpoints
  app.get("/api/quotes", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { orgId, status, jobId } = req.query;
      
      if (!orgId || typeof orgId !== 'string') {
        return res.status(400).json({ message: "orgId is required" });
      }

      // Verify organization access
      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this organization" });
      }

      const filters: { status?: string; jobId?: string } = {};
      if (status && typeof status === 'string') filters.status = status;
      if (jobId && typeof jobId === 'string') filters.jobId = jobId;

      const quotes = await storage.getQuotes(orgId, filters);
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

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
      const quoteId = req.params.id;
      if (!quoteId) {
        return res.status(400).json({ message: "Quote ID is required" });
      }
      
      const quote = await storage.getQuote(quoteId);
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

  // Update quote
  app.patch("/api/quotes/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      
      console.log('[Routes] PATCH /api/quotes/:id', { id, body: req.body });
      
      if (!id) {
        return res.status(400).json({ message: "Quote ID is required" });
      }

      // Verify quote access
      const quote = await storage.getQuote(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const job = await storage.getJob(quote.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Update quote with provided fields
      console.log('[Routes] Updating quote with:', req.body);
      const updatedQuote = await storage.updateQuote(id, req.body);
      console.log('[Routes] Quote updated successfully:', updatedQuote);
      res.json(updatedQuote);
    } catch (error) {
      console.error('[Routes] Error updating quote:', error);
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
      const quoteId = req.params.id;
      if (!quoteId) {
        return res.status(400).json({ message: "Quote ID is required" });
      }
      
      const quote = await storage.getQuote(quoteId);
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
      const quoteId = req.params.id;
      if (!quoteId) {
        return res.status(400).json({ message: "Quote ID is required" });
      }
      
      const quote = await storage.getQuote(quoteId);
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

      const quoteId2 = req.params.id;
      if (!quoteId2) {
        return res.status(400).json({ message: "Quote ID is required" });
      }
      
      const items = await storage.getQuoteItems(quoteId2);
      const subtotal = items.reduce((sum, item) => sum + parseFloat(item.lineTotal || "0"), 0);
      
      // Get tax rate from org settings
      const orgSettings = await storage.getOrgSettings(job.orgId);
      const taxRate = parseFloat(String(orgSettings?.taxRate ?? "0.10"));
      
      const gst = Math.round(subtotal * taxRate * 100) / 100;
      const total = Math.round((subtotal + gst) * 100) / 100;

      const updatedQuote = await storage.updateQuote(quoteId, {
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
      const quoteId = req.params.id;
      if (!quoteId) {
        return res.status(400).json({ message: "Quote ID is required" });
      }
      
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Here you would:
      // 1. Generate PDF
      // 2. Send email via Resend
      // 3. Update quote status to 'sent'
      
      const updatedQuote = await storage.updateQuote(quoteId, {
        status: 'sent'
      });

      res.json({ 
        message: "Quote sent successfully",
        quote: updatedQuote
      });
      return;
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/quotes/:id/accept", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const quoteId = req.params.id;
      if (!quoteId) {
        return res.status(400).json({ message: "Quote ID is required" });
      }
      
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const depositAmount = parseFloat(quote.total || '0') * parseFloat(quote.depositPct || '0.3');
      
      // Update quote status to accepted
      await storage.updateQuote(quoteId, {
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
      const token = req.params.token;
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }
      
      const quote = await storage.getQuoteByToken(token);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found or link expired" });
      }

      const items = await storage.getQuoteItems(quote.id);
      res.json({ ...quote, items });
      return;
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
      return;
    }
  });

  // Payment endpoints removed - payments handled externally
  // You can add external payment integration endpoints here if needed

  // Settings endpoints
  app.get("/api/settings/:orgId", authenticateSession, verifyOrgMembership, async (req: AuthenticatedRequest, res: any) => {
    try {
      const orgId = req.params.orgId;
      if (!orgId) {
        return res.status(400).json({ message: "Organization ID is required" });
      }
      
      const settings = await storage.getOrgSettings(orgId);
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
      const orgId = req.params.orgId;
      if (!orgId) {
        return res.status(400).json({ message: "Organization ID is required" });
      }
      
      const updates = req.body;
      const settings = await storage.updateOrgSettings(orgId, updates);
      res.json(settings);
      return;
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // User Profile Endpoints
  app.get("/api/user/profile", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return user profile (exclude password)
      const { password, ...profile } = user;
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.patch("/api/user/profile", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const updates = req.body;
      // Prevent password updates through this endpoint (use separate endpoint)
      const { password, ...safeUpdates } = updates;
      
      const updatedUser = await storage.updateUser(req.user.id, safeUpdates);
      const { password: _, ...profile } = updatedUser;
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/user/change-password", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      
      // Get user and verify current password
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { PasswordService } = await import('./lib/passwordService.js');
      const isValid = await PasswordService.verifyPassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      
      // Validate new password
      const { PasswordValidator } = await import('./lib/passwordService.js');
      const validation = PasswordValidator.validate(newPassword);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.errors.join(', ') });
      }
      
      // Hash and update password
      const hashedPassword = await PasswordService.hashPassword(newPassword);
      await storage.updateUser(req.user.id, { password: hashedPassword });
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // User Preferences Endpoints
  app.get("/api/user/preferences", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const preferences = await storage.getUserPreferences(req.user.id);
      // Return defaults if no preferences exist
      res.json(preferences || {
        dateFormat: 'dd/mm/yyyy',
        measurementUnits: 'metric',
        language: 'en',
        theme: 'light',
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.patch("/api/user/preferences", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const updates = req.body;
      const preferences = await storage.upsertUserPreferences(req.user.id, updates);
      res.json(preferences);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Image composition endpoint (for before/after generation)
  app.post("/api/photos/:id/composite", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const photoId = req.params.id;
      if (!photoId) {
        return res.status(400).json({ message: "Photo ID is required" });
      }
      
      // Verify photo access
      const photo = await storage.getPhoto(photoId);
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
      return;
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/photos/:id/composite", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const photoId = req.params.id;
      const forceRegenerate = req.query.force === 'true';
      const photo = await storage.getPhoto(photoId);
      
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      // Get masks for this photo to check if there are any edits
      const masks = await storage.getMasksByPhoto(photoId);
      console.log(`[GetComposite] Photo ${photoId}: Found ${masks.length} masks in database`);
      
      if (masks.length === 0) {
        console.log(`[GetComposite] No masks found for photo ${photoId}, returning original image`);
        // No edits, return original image
        res.json({
          beforeUrl: photo.originalUrl,
          afterUrl: photo.originalUrl,
          sideBySideUrl: photo.originalUrl,
          status: 'completed',
          hasEdits: false
        });
        return;
      }
      
      console.log(`[GetComposite] Photo ${photoId}: Processing ${masks.length} masks for composite generation`);
      
      // Generate actual composite (force regenerate if requested or if code changed)
      // Always force regenerate for now to ensure we use the latest code
      const generator = new CompositeGenerator();
      const result = await generator.generateComposite(photoId, true); // Force regenerate to use new code
      
      console.log(`[GetComposite] Composite generated:`, {
        status: result.status,
        hasEdits: result.hasEdits,
        afterUrl: result.afterUrl?.substring(0, 80) + '...'
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Debug endpoint to inspect mask coordinates
  app.get("/api/photos/:id/masks/debug", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const photoId = req.params.id;
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      const masks = await storage.getMasksByPhoto(photoId);
      const maskData = masks.map(mask => {
        let pathData = mask.pathJson;
        if (typeof pathData === 'string') {
          pathData = JSON.parse(pathData);
        }
        const points = Array.isArray(pathData) ? pathData : (pathData?.points || []);
        const coords = points.map((p: any) => ({ x: p.x || p[0] || 0, y: p.y || p[1] || 0 }));
        const minX = Math.min(...coords.map(p => p.x));
        const maxX = Math.max(...coords.map(p => p.x));
        const minY = Math.min(...coords.map(p => p.y));
        const maxY = Math.max(...coords.map(p => p.y));
        
        return {
          id: mask.id,
          pointCount: points.length,
          firstPoint: coords[0],
          lastPoint: coords[coords.length - 1],
          boundingBox: { minX, maxX, minY, maxY },
          hasNegative: minX < 0 || minY < 0,
          extendsBeyond: maxX > photo.width || maxY > photo.height,
          allPoints: coords.slice(0, 10) // First 10 points for detailed inspection
        };
      });
      
      res.json({
        photoId,
        photoDimensions: { width: photo.width, height: photo.height },
        masks: maskData
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Debug endpoint to force composite generation with detailed logging
  app.get("/api/photos/:id/composite/debug", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const photoId = req.params.id;
      console.log(`[CompositeDebug] Endpoint called for photo: ${photoId}`);
      
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      console.log(`[CompositeDebug] Photo found: ${photo.id}, dimensions: ${photo.width}x${photo.height}`);
      
      const masks = await storage.getMasksByPhoto(photoId);
      console.log(`[CompositeDebug] Found ${masks.length} masks`);
      
      // Log detailed mask information
      masks.forEach((mask, idx) => {
        let pathData = mask.pathJson;
        if (typeof pathData === 'string') {
          pathData = JSON.parse(pathData);
        }
        if (Array.isArray(pathData) && pathData.length > 0) {
          const coords = pathData.map((p: any) => ({ x: p.x || p[0] || 0, y: p.y || p[1] || 0 }));
          const minX = Math.min(...coords.map(p => p.x));
          const maxX = Math.max(...coords.map(p => p.x));
          const minY = Math.min(...coords.map(p => p.y));
          const maxY = Math.max(...coords.map(p => p.y));
          console.log(`[CompositeDebug] Mask ${idx + 1}: ${coords.length} points, bbox: [${minX.toFixed(1)}, ${minY.toFixed(1)}] to [${maxX.toFixed(1)}, ${maxY.toFixed(1)}]`);
          console.log(`[CompositeDebug]   First 3 points:`, coords.slice(0, 3));
        }
      });
      
      // Force regenerate composite
      const generator = new CompositeGenerator();
      const result = await generator.generateComposite(photoId, true);
      
      res.json({
        ...result,
        debug: {
          photoId,
          photoDimensions: { width: photo.width, height: photo.height },
          maskCount: masks.length,
          forceRegenerated: true
        }
      });
    } catch (error) {
      console.error('[CompositeDebug] Error:', error);
      res.status(500).json({ message: (error as Error).message, stack: (error as Error).stack });
    }
  });

  // Check if system function exists in database
  app.get("/api/debug/system-function-check", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { executeQuery } = await import('./lib/dbHelpers.js');
      
      // Check if function exists
      const functionCheck = await executeQuery(`
        SELECT 
          proname, 
          prosecdef,
          pg_get_function_identity_arguments(oid) as args
        FROM pg_proc 
        WHERE proname = 'get_masks_by_photo_system'
      `);
      
      if (functionCheck.length === 0) {
        return res.json({
          exists: false,
          message: 'Function get_masks_by_photo_system() does not exist. Run migration: npm run db:migrate:system-masks'
        });
      }
      
      const func = functionCheck[0];
      return res.json({
        exists: true,
        hasSecurityDefiner: func.prosecdef === true,
        functionName: func.proname,
        arguments: func.args,
        message: func.prosecdef ? '✅ Function exists with SECURITY DEFINER (will bypass RLS)' : '⚠️ Function exists but missing SECURITY DEFINER'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  // Diagnostic endpoint for enhancement jobs
  app.get("/api/debug/enhancement/:jobId", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const jobId = req.params.jobId;
      const { executeQuery } = await import('./lib/dbHelpers.js');
      
      // 1. Check if outbox event exists
      const outboxEvents = await executeQuery(
        `SELECT id, event_type, status, attempts, created_at, next_retry_at, payload 
         FROM outbox 
         WHERE job_id = $1 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [jobId]
      );
      
      // 2. Check job details
      const job = await executeQuery(
        `SELECT id, status, photo_id, created_at, updated_at 
         FROM ai_enhancement_jobs 
         WHERE id = $1`,
        [jobId]
      );
      
      // 3. If job has photoId, check masks
      let masks: any[] = [];
      let photoDetails: any = null;
      if (job.length > 0 && job[0].photo_id) {
        try {
          photoDetails = await storage.getPhoto(job[0].photo_id);
          masks = await storage.getMasksByPhoto(job[0].photo_id);
        } catch (error: any) {
          console.error(`[Debug] Error fetching photo/masks:`, error);
        }
      }
      
      // 4. Parse outbox payload to check photoId
      let payloadPhotoId = null;
      let payloadMasksCount = 0;
      if (outboxEvents.length > 0 && outboxEvents[0].payload) {
        try {
          const payload = typeof outboxEvents[0].payload === 'string' 
            ? JSON.parse(outboxEvents[0].payload) 
            : outboxEvents[0].payload;
          payloadPhotoId = payload.photoId;
          payloadMasksCount = payload.masks?.length || 0;
        } catch (e) {
          console.error(`[Debug] Error parsing payload:`, e);
        }
      }
      
      res.json({
        job: job[0] || null,
        outboxEvents: outboxEvents.map(ev => ({
          id: ev.id,
          event_type: ev.event_type,
          status: ev.status,
          attempts: ev.attempts,
          created_at: ev.created_at,
          next_retry_at: ev.next_retry_at,
          payloadPhotoId: ev.payload ? (() => {
            try {
              const p = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload;
              return p.photoId;
            } catch {
              return null;
            }
          })() : null
        })),
        photoDetails: photoDetails ? {
          id: photoDetails.id,
          width: photoDetails.width,
          height: photoDetails.height,
          originalUrl: photoDetails.originalUrl?.substring(0, 80) + '...'
        } : null,
        masks: {
          count: masks.length,
          photoId: job[0]?.photo_id || null,
          masks: masks.map(m => ({
            id: m.id,
            materialId: m.materialId,
            hasCalcMetaJson: !!m.calcMetaJson,
            calcMetaJsonPreview: m.calcMetaJson ? (typeof m.calcMetaJson === 'string' ? m.calcMetaJson.substring(0, 100) : JSON.stringify(m.calcMetaJson).substring(0, 100)) : null
          }))
        },
        diagnostic: {
          hasOutboxEvent: outboxEvents.length > 0,
          outboxEventStatus: outboxEvents[0]?.status || 'none',
          jobPhotoId: job[0]?.photo_id || null,
          payloadPhotoId: payloadPhotoId,
          photoIdMatch: job[0]?.photo_id === payloadPhotoId,
          masksFound: masks.length,
          photoExists: !!photoDetails,
          payloadMasksCount: payloadMasksCount
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message, stack: error.stack });
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
      if (response.body) {
        const reader = response.body.getReader();
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            res.end();
          } catch (error) {
            res.end();
          }
        };
        pump();
      } else {
        res.end();
      }
    } catch (error: any) {
      console.error('[texture-proxy]', error);
      res.status(500).json({ error: 'Proxy error', message: error.message });
    }
  });

  // Stripe webhook endpoint
  app.post("/api/webhooks/stripe", async (req: any, res: any) => {
    try {
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        return res.status(400).json({ message: 'Missing stripe-signature header' });
      }

      const { paymentService } = await import('./lib/paymentService.js');
      await paymentService.processWebhook(req.body, signature);
      
      res.json({ received: true });
    } catch (error) {
      console.error('[Stripe Webhook] Error:', error);
      res.status(400).json({ message: 'Webhook error' });
    }
  });
  
  console.log('✅ Routes registered successfully');
}
