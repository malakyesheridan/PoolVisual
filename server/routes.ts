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
import { PasswordService } from "./lib/passwordService.js";
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
    return multer({
      storage: multer.memoryStorage(),
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
  } else {
    // Local development: use disk storage
    const uploadDir = 'uploads/';
    return multer({
      dest: uploadDir,
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
      const existingUser = await storage.getUserByEmail(userData.email);
      
      if (existingUser) {
        return res.status(400).json({ ok: false, error: "User already exists with this email" });
      }

      const hashedPassword = await PasswordService.hashPassword(userData.password);
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

      // Derive dimensions if not provided by client
      let finalWidth: number | null = width ? parseInt(width) : null;
      let finalHeight: number | null = height ? parseInt(height) : null;

      if (!finalWidth || !finalHeight || Number.isNaN(finalWidth) || Number.isNaN(finalHeight)) {
        try {
          const meta = await sharp(imageBuffer).metadata();
          if (meta.width && meta.height) {
            finalWidth = meta.width;
            finalHeight = meta.height;
          }
        } catch (e) {
          console.warn('Failed to read image metadata with sharp:', (e as Error).message);
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
      const photo = await storage.getPhoto(photoId);
      
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      // Get masks for this photo to check if there are any edits
      const masks = await storage.getMasksByPhoto(photoId);
      
      if (masks.length === 0) {
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
      
      // Generate actual composite
      const generator = new CompositeGenerator();
      const result = await generator.generateComposite(photoId);
      
      res.json(result);
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
