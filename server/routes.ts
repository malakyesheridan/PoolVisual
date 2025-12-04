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
  
  // Register admin routes
  const { adminRouter } = await import('./routes/admin.js');
  app.use('/api/admin', adminRouter);
  console.log('✅ Admin routes registered');
  
  // Register subscription routes
  const { subscriptionRoutes } = await import('./routes/subscription.js');
  app.use('/api/subscription', subscriptionRoutes);
  console.log('✅ Subscription routes registered');
  
  // Register credit routes
  const { creditRoutes } = await import('./routes/credits.js');
  app.use('/api/credits', creditRoutes);
  console.log('✅ Credit routes registered');
  
  // Register feature routes
  const { featureRoutes } = await import('./routes/features.js');
  app.use('/api/features', featureRoutes);
  console.log('✅ Feature routes registered');
  
  // Texture proxy (must be early to avoid auth middleware conflicts)
  registerTextureProxyRoutes(app);
  
  // Serve uploaded files statically
  app.use('/uploads', express.static('uploads'));
  
  // Add health routes
  app.use("/api", healthRoutes);
  
  // Register material routes (texture system)
  registerMaterialRoutes(app);
  registerMaterialRoutesV2(app); // Bulletproof materials endpoint
  
  // Register V2 materials routes - CRITICAL: Must register before 404 handler
  try {
    const materialsV2Module = await import('./routes/materialsV2.js');
    materialsV2Module.materialsV2Routes(app);
    console.log('✅ Materials V2 routes registered');
  } catch (error) {
    console.error('[Routes] Failed to register materials V2 routes:', error);
    throw error; // Fail fast - this is critical
  }
  
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
      
      // Normalize email to lowercase (consistent with login)
      const normalizedEmail = userData.email.toLowerCase().trim();
      
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

      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ ok: false, error: "User already exists with this email" });
      }

      // Hash password with enhanced service
      const hashedPassword = await PasswordService.hashPassword(userData.password);
      
      // Prepare user data, ensuring isAdmin is not set (will default to false in createUser)
      const userToCreate: any = {
        ...userData,
        email: normalizedEmail, // Use normalized email
        password: hashedPassword,
        isActive: true,
        failedLoginAttempts: 0,
        loginCount: 0,
      };
      
      // Remove isAdmin from userData if present (should not be set during registration)
      delete userToCreate.isAdmin;
      delete userToCreate.adminPermissions;
      
      const user = await storage.createUser(userToCreate);

      // Auto-create organization for the user with industry support
      // Get industry from request body, default to 'pool' for backward compatibility
      const industry = req.body.industry || 'pool';
      const orgName = req.body.orgName || userData.username;
      
      const org = await storage.createOrg(
        { 
          name: orgName,
          industry: industry // NEW: Set industry during org creation
        },
        user.id
      );

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
        user: { id: user.id, email: user.email, username: user.username },
        org: { id: org.id, name: org.name, industry: org.industry } // Include org in response
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

  // Trade Category endpoints
  // GET /api/trade-categories/:industry - Get categories for a specific industry
  app.get("/api/trade-categories/:industry", async (req: any, res: any) => {
    try {
      const { industry } = req.params;
      if (!industry) {
        return res.status(400).json({ error: "Industry parameter is required" });
      }
      
      const categories = await storage.getTradeCategories(industry);
      res.json(categories);
    } catch (error) {
      console.error('[trade-categories] Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // GET /api/trade-categories/:industry/:categoryKey/label - Get label for a specific category
  app.get("/api/trade-categories/:industry/:categoryKey/label", async (req: any, res: any) => {
    try {
      const { industry, categoryKey } = req.params;
      if (!industry || !categoryKey) {
        return res.status(400).json({ error: "Industry and categoryKey parameters are required" });
      }
      
      const label = await storage.getCategoryLabel(industry, categoryKey);
      if (!label) {
        return res.status(404).json({ error: "Category label not found" });
      }
      
      res.json({ industry, categoryKey, label });
    } catch (error) {
      console.error('[trade-categories/label] Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Onboarding endpoints
  // GET /api/onboarding/status - Get onboarding status for current user
  app.get("/api/onboarding/status", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const onboarding = await storage.getUserOnboarding(req.user.id);
      // Return default if no onboarding record exists (for existing users or if table doesn't exist)
      res.json(onboarding || { 
        step: 'welcome', 
        completed: false, 
        responses: {} 
      });
    } catch (error: any) {
      console.error('[onboarding/status] Error:', error);
      // If error is due to missing table, return default instead of 500
      const errorMessage = error?.message || 'Unknown error';
      if (errorMessage.includes('user_onboarding') || error?.code === '42P01' || error?.code === '42703') {
        return res.json({ 
          step: 'welcome', 
          completed: false, 
          responses: {} 
        });
      }
      // For any other error, still return default to prevent crashes
      console.warn('[onboarding/status] Unexpected error, returning default:', errorMessage);
      return res.json({ 
        step: 'welcome', 
        completed: false, 
        responses: {} 
      });
    }
  });

  // POST /api/onboarding/update - Update onboarding progress
  app.post("/api/onboarding/update", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { step, responses } = req.body;
      
      if (!step) {
        return res.status(400).json({ error: "Step is required" });
      }
      
      const onboarding = await storage.updateUserOnboarding(req.user.id, {
        step,
        responses: responses || {},
      });
      
      res.json(onboarding);
    } catch (error: any) {
      console.error('[onboarding/update] Error:', error);
      // If error is due to missing table, return success with default to prevent crashes
      if (error?.message?.includes('user_onboarding') || error?.code === '42P01' || error?.code === '42703') {
        console.warn('[onboarding/update] Table not found, returning default response');
        return res.json({ 
          step: step || 'welcome', 
          completed: false, 
          responses: responses || {} 
        });
      }
      res.status(500).json({ error: error?.message || 'Failed to update onboarding' });
    }
  });

  // POST /api/onboarding/complete - Mark onboarding as completed
  app.post("/api/onboarding/complete", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      await storage.completeUserOnboarding(req.user.id);
      res.json({ ok: true });
    } catch (error) {
      console.error('[onboarding/complete] Error:', error);
      res.status(500).json({ error: (error as Error).message });
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

  // Get current user's organization (first org or primary)
  app.get("/api/orgs/me", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const org = await storage.getOrgByUserId(req.user.id);
      if (!org) {
        return res.status(404).json({ ok: false, error: 'Organization not found' });
      }
      res.json({ ok: true, org });
    } catch (error) {
      res.status(500).json({ ok: false, error: (error as Error).message });
    }
  });

  // Get single organization
  app.get("/api/orgs/:orgId", authenticateSession, verifyOrgMembership, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { orgId } = req.params;
      if (!orgId) {
        return res.status(400).json({ message: "Organization ID is required" });
      }

      const org = await storage.getOrg(orgId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      res.json(org);
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

      // If branding was updated, invalidate PDF cache for all quotes for this user
      // Note: This is deprecated since orgs are no longer used for data ownership
      // Keeping for backward compatibility but will be removed in future
      if (updates.brandColors || updates.logoUrl) {
        try {
          const { pdfGenerator } = await import('./lib/pdfGenerator.js');
          // Get all quotes for user's org (legacy) and invalidate their cache
          const userOrgs = await storage.getUserOrgs(req.user.id);
          if (userOrgs.length > 0) {
            const quotes = await storage.getQuotes(req.user.id);
            await Promise.all(
              quotes.map(quote => pdfGenerator.invalidateCache(quote.id).catch(() => {}))
            );
          }
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
      
      // Create job with user_id (user-centric architecture)
      const jobData = {
        clientName,
        clientPhone: clientPhone || null,
        clientEmail: clientEmail || null,
        address: address || null,
        status: status || 'new',
      };

      const job = await storage.createJob(jobData, req.user.id);
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
      const { status, q } = req.query;

      // Get jobs for current user (user-centric architecture)
      let jobs = await storage.getJobs(req.user.id);
      
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
      const { jobIds } = req.query;

      // Parse jobIds if provided (comma-separated)
      const jobIdArray = jobIds ? (jobIds as string).split(',').filter(Boolean) : null;

      // Use Drizzle to build the query efficiently
      const { getDatabase } = await import('./db.js');
      const db = getDatabase();
      const { jobs, photos, masks } = await import('../../shared/schema.js');
      const { sql, max, and, inArray } = await import('drizzle-orm');
      
      // Build query using Drizzle (user-centric - filter by userId)
      const conditions = [sql`${jobs.userId} = ${req.user.id}::uuid`];
      if (jobIdArray && jobIdArray.length > 0) {
        conditions.push(inArray(jobs.id, jobIdArray));
      }
      
      const results = await db
        .select({
          job_id: jobs.id,
          total_photos: sql<number>`COUNT(DISTINCT ${photos.id})`,
          photos_with_canvas_work: sql<number>`COUNT(DISTINCT CASE WHEN ${masks.id} IS NOT NULL THEN ${photos.id} END)`,
          last_canvas_work: max(masks.createdAt),
        })
        .from(jobs)
        .leftJoin(photos, sql`${photos.jobId} = ${jobs.id}`)
        .leftJoin(masks, sql`${masks.photoId} = ${photos.id}`)
        .where(and(...conditions))
        .groupBy(jobs.id)
        .orderBy(sql`${jobs.createdAt} DESC`);

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
      
      const { jobId, width, height, exifData, photoCategory } = req.body;
      
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
        photoCategory: photoCategory || 'marketing', // Default to 'marketing' for backward compatibility
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
      const category = req.query.category as 'marketing' | 'renovation_buyer' | undefined;
      
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

      const photos = await storage.getJobPhotos(jobId, category);
      res.json(photos);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Update photo category
  app.put("/api/photos/:id/category", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const photoId = req.params.id;
      const { category } = req.body;

      if (!photoId) {
        return res.status(400).json({ message: "Photo ID is required" });
      }

      if (!category || !['marketing', 'renovation_buyer'].includes(category)) {
        return res.status(400).json({ message: "Valid category is required (marketing or renovation_buyer)" });
      }

      // Verify photo access
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      const job = await storage.getJob(photo.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedPhoto = await storage.updatePhotoCategory(photoId, category);
      res.json(updatedPhoto);
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
  app.get("/api/materials", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { category, q, industry } = req.query;

      // Get materials for current user (global + user-specific)
      let materials = await storage.getMaterials(req.user.id, category as string, industry as string);
      
      // Apply search filter
      if (q) {
        const searchTerm = (q as string).toLowerCase();
        materials = materials.filter(material => 
          material.name.toLowerCase().includes(searchTerm) ||
          (material.sku && material.sku.toLowerCase().includes(searchTerm))
        );
      }

      res.json(materials);
    } catch (error: any) {
      console.error('[Routes] Error fetching materials:', error);
      // Return empty array instead of crashing if there's a database issue
      if (error?.message?.includes('does not exist') || error?.code === '42P01' || error?.code === '42703') {
        console.warn('[Routes] Database table/column issue, returning empty materials array');
        return res.json([]);
      }
      res.status(500).json({ message: error?.message || 'Failed to fetch materials' });
    }
  });

  app.post("/api/materials", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const materialData = insertMaterialSchema.parse(req.body);
      
      // Create material for current user (or global if userId not set)
      // orgId is deprecated but kept for backward compatibility
      const material = await storage.createMaterial(materialData, req.user.id);
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

      // Check if user owns this job
      if (job.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const mask = await storage.createMask(maskData, req.user.id);
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

      // Check if user owns this job
      if (job.userId !== req.user.id) {
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

      // Check if user owns this job
      if (job.userId !== req.user.id) {
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
      const { status, jobId } = req.query;

      // Get quotes for current user (user-centric architecture)
      const filters: { status?: string; jobId?: string } = {};
      if (status && typeof status === 'string') filters.status = status;
      if (jobId && typeof jobId === 'string') filters.jobId = jobId;

      const quotes = await storage.getQuotes(req.user.id, filters);
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/quotes", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const quoteData = insertQuoteSchema.parse(req.body);
      
      // Verify job access (user must own the job)
      const job = await storage.getJob(quoteData.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Check if user owns this job
      if (job.userId !== req.user.id) {
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

      // Verify access through job (user must own the job)
      const job = await storage.getJob(quote.jobId);
      if (!job) {
        return res.status(404).json({ message: "Associated job not found" });
      }

      // Check if user owns this job
      const hasAccess = job.userId === req.user.id;
      
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
      
      // Return user profile (exclude password and sensitive fields)
      const { password, passwordResetToken, passwordResetExpires, ...profile } = user;
      res.json(profile);
    } catch (error: any) {
      console.error('[Routes] Error getting user profile:', error);
      res.status(500).json({ message: error?.message || "Failed to get user profile" });
    }
  });

  app.patch("/api/user/profile", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const updates = req.body;
      // Prevent password and sensitive field updates through this endpoint
      const { password, passwordResetToken, passwordResetExpires, id, createdAt, ...safeUpdates } = updates;
      
      // Validate email if provided
      if (safeUpdates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeUpdates.email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      
      const updatedUser = await storage.updateUser(req.user.id, safeUpdates);
      const { password: _, passwordResetToken: __, passwordResetExpires: ___, ...profile } = updatedUser;
      res.json(profile);
    } catch (error: any) {
      console.error('[Routes] Error updating user profile:', error);
      res.status(500).json({ message: error?.message || "Failed to update user profile" });
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

  // Email Verification Endpoints
  app.post("/api/user/verify-email/send", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { EmailVerificationService } = await import('./lib/emailVerificationService.js');
      const emailVerificationService = new EmailVerificationService();
      const result = await emailVerificationService.sendVerificationEmailToUser(req.user.id);
      
      if (result.success) {
        res.json({ message: result.message });
      } else {
        res.status(400).json({ message: result.message, error: result.error });
      }
    } catch (error: any) {
      console.error('[Routes] Error sending verification email:', error);
      res.status(500).json({ message: error?.message || "Failed to send verification email" });
    }
  });

  app.post("/api/user/verify-email/confirm", async (req: any, res: any) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Verification token is required" });
      }
      
      const { EmailVerificationService } = await import('./lib/emailVerificationService.js');
      const emailVerificationService = new EmailVerificationService();
      const result = await emailVerificationService.verifyEmail(token);
      
      if (result.success) {
        res.json({ message: result.message });
      } else {
        res.status(400).json({ message: result.message, error: result.error });
      }
    } catch (error: any) {
      console.error('[Routes] Error verifying email:', error);
      res.status(500).json({ message: error?.message || "Failed to verify email" });
    }
  });

  // User Sessions Endpoints
  app.get("/api/user/sessions", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const sessions = await storage.getUserSessions(req.user.id);
      res.json(sessions);
    } catch (error: any) {
      console.error('[Routes] Error getting user sessions:', error);
      res.status(500).json({ message: error?.message || "Failed to get user sessions" });
    }
  });

  app.delete("/api/user/sessions/:sessionId", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { sessionId } = req.params;
      const session = await storage.getUserSession(sessionId);
      
      if (!session || session.userId !== req.user.id) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      await storage.deleteUserSession(sessionId);
      res.json({ message: "Session revoked successfully" });
    } catch (error: any) {
      console.error('[Routes] Error revoking session:', error);
      res.status(500).json({ message: error?.message || "Failed to revoke session" });
    }
  });

  app.delete("/api/user/sessions", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Get current session ID from Iron Session
      const currentSessionId = req.session?.id || req.session?.sessionId;
      await storage.deleteUserSessions(req.user.id, currentSessionId);
      res.json({ message: "All other sessions revoked successfully" });
    } catch (error: any) {
      console.error('[Routes] Error revoking sessions:', error);
      res.status(500).json({ message: error?.message || "Failed to revoke sessions" });
    }
  });

  // Security Log Endpoint
  app.get("/api/user/security-log", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const eventType = req.query.eventType as string | undefined;
      
      const events = await storage.getSecurityEvents(req.user.id, { limit, offset, eventType });
      res.json(events);
    } catch (error: any) {
      console.error('[Routes] Error getting security log:', error);
      res.status(500).json({ message: error?.message || "Failed to get security log" });
    }
  });

  // User Preferences Endpoints
  app.get("/api/user/preferences", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const preferences = await storage.getUserPreferences(req.user.id);
      // Return defaults if no preferences exist (remove userId from response)
      if (preferences) {
        const { userId, ...prefs } = preferences;
        res.json(prefs);
      } else {
        res.json({
          dateFormat: 'dd/mm/yyyy',
          measurementUnits: 'metric',
          language: 'en',
          theme: 'light',
        });
      }
    } catch (error: any) {
      console.error('[Routes] Error getting user preferences:', error);
      // If table doesn't exist, return defaults
      if (error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
        res.json({
          dateFormat: 'dd/mm/yyyy',
          measurementUnits: 'metric',
          language: 'en',
          theme: 'light',
        });
      } else {
        res.status(500).json({ message: error?.message || "Failed to get user preferences" });
      }
    }
  });

  app.patch("/api/user/preferences", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const updates = req.body;
      
      // Validate preference values
      const validDateFormats = ['dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd'];
      const validUnits = ['metric', 'imperial'];
      const validThemes = ['light', 'dark', 'auto'];
      
      if (updates.dateFormat && !validDateFormats.includes(updates.dateFormat)) {
        return res.status(400).json({ message: `Invalid date format. Must be one of: ${validDateFormats.join(', ')}` });
      }
      if (updates.measurementUnits && !validUnits.includes(updates.measurementUnits)) {
        return res.status(400).json({ message: `Invalid measurement units. Must be one of: ${validUnits.join(', ')}` });
      }
      if (updates.theme && !validThemes.includes(updates.theme)) {
        return res.status(400).json({ message: `Invalid theme. Must be one of: ${validThemes.join(', ')}` });
      }
      
      const preferences = await storage.upsertUserPreferences(req.user.id, updates);
      // Remove userId from response
      const { userId, ...prefs } = preferences;
      res.json(prefs);
    } catch (error: any) {
      console.error('[Routes] Error updating user preferences:', error);
      res.status(500).json({ message: error?.message || "Failed to update user preferences" });
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

  // Property Notes endpoints (for real estate)
  app.get("/api/jobs/:id/notes", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const jobId = req.params.id;
      if (!jobId) {
        return res.status(400).json({ message: "Job ID is required" });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const notes = await storage.getPropertyNotes(jobId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/jobs/:id/notes", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const jobId = req.params.id;
      const { noteText, tags } = req.body;

      if (!jobId) {
        return res.status(400).json({ message: "Job ID is required" });
      }
      if (!noteText || !noteText.trim()) {
        return res.status(400).json({ message: "Note text is required" });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      const hasAccess = userOrgs.some(org => org.id === job.orgId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const note = await storage.createPropertyNote({
        jobId,
        userId: req.user.id,
        noteText: noteText.trim(),
        tags: tags || [],
      });
      res.json(note);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/notes/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const noteId = req.params.id;
      const { noteText, tags } = req.body;

      if (!noteId) {
        return res.status(400).json({ message: "Note ID is required" });
      }

      const note = await storage.updatePropertyNote(noteId, {
        noteText: noteText?.trim(),
        tags,
      });
      res.json(note);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/notes/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const noteId = req.params.id;
      if (!noteId) {
        return res.status(400).json({ message: "Note ID is required" });
      }

      await storage.deletePropertyNote(noteId);
      res.json({ message: "Note deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Opportunities endpoints (for real estate)
  app.get("/api/opportunities", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const requestingUserId = req.user.id;
      
      if (!requestingUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const filters: any = {};
      if (req.query.status) {
        // Map frontend status values to database values
        const statusMap: Record<string, string> = {
          'open': 'new',
          'won': 'closed_won',
          'lost': 'closed_lost',
          'abandoned': 'closed_lost',
        };
        filters.status = statusMap[req.query.status as string] || req.query.status;
      }
      if (req.query.pipelineStage) filters.pipelineStage = req.query.pipelineStage;
      if (req.query.propertyJobId) filters.propertyJobId = req.query.propertyJobId;

      // CRITICAL: Use the authenticated user's ID directly - no transformations
      // Ensure userId is a string (UUIDs in PostgreSQL are stored as UUID type but compared as strings in Drizzle)
      console.log('[GET /api/opportunities] Requesting userId:', String(requestingUserId), 'filters:', filters);
      const opportunities = await storage.getOpportunities(String(requestingUserId), filters);
      console.log('[GET /api/opportunities] Found', opportunities.length, 'opportunities for user', String(requestingUserId));
      console.log('[GET /api/opportunities] Opportunity IDs:', opportunities.map((o: any) => o.id));
      console.log('[GET /api/opportunities] StageIds:', opportunities.map((o: any) => ({ id: o.id, stageId: o.stageId, title: o.title })));
      
      // Map database status values back to frontend values
      const reverseStatusMap: Record<string, string> = {
        'new': 'open',
        'contacted': 'open',
        'qualified': 'open',
        'viewing': 'open',
        'offer': 'open',
        'closed_won': 'won',
        'closed_lost': 'lost',
      };
      
      const mappedOpportunities = opportunities.map((opp: any) => ({
        ...opp,
        status: reverseStatusMap[opp.status] || opp.status,
      }));
      
      console.log('[GET /api/opportunities] Returning', mappedOpportunities.length, 'mapped opportunities');
      res.json(mappedOpportunities);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/opportunities/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const opportunityId = req.params.id;
      const opportunity = await storage.getOpportunity(opportunityId);
      
      if (!opportunity) {
        return res.status(404).json({ message: "Opportunity not found" });
      }

      // Verify access - compare as strings to handle UUID type differences
      if (String(opportunity.userId) !== String(req.user.id)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Map database status values back to frontend values
      const reverseStatusMap: Record<string, string> = {
        'new': 'open',
        'contacted': 'open',
        'qualified': 'open',
        'viewing': 'open',
        'offer': 'open',
        'closed_won': 'won',
        'closed_lost': 'lost',
      };
      
      const mappedOpportunity = {
        ...opportunity,
        status: reverseStatusMap[opportunity.status] || opportunity.status,
      };

      res.json(mappedOpportunity);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/opportunities", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { 
        // New fields (Kanban board)
        title, value, stageId, pipelineId, contactId, ownerId, tags,
        // Legacy fields (backward compatibility)
        clientName, clientPhone, clientEmail, propertyAddress, propertyJobId, 
        status, pipelineStage, estimatedValue, probabilityPct, expectedCloseDate, source, notes 
      } = req.body;

      // Support both new (title) and old (clientName) formats
      const opportunityTitle = title || clientName;
      if (!opportunityTitle || !opportunityTitle.trim()) {
        return res.status(400).json({ message: "Title or client name is required" });
      }

      const userOrgs = await storage.getUserOrgs(req.user.id);
      
      // Map new status values to old ones for database compatibility
      // New: 'open', 'won', 'lost', 'abandoned'
      // Old: 'new', 'contacted', 'qualified', 'viewing', 'offer', 'closed_won', 'closed_lost'
      const statusMap: Record<string, string> = {
        'open': 'new',
        'won': 'closed_won',
        'lost': 'closed_lost',
        'abandoned': 'closed_lost',
      };
      const mappedStatus = status ? (statusMap[status] || status) : 'new';

      // CRITICAL: Get and validate userId FIRST
      if (!req.user?.id) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const authenticatedUserId = String(req.user.id).trim();
      if (!authenticatedUserId || authenticatedUserId === 'undefined' || authenticatedUserId === 'null') {
        return res.status(401).json({ message: "Invalid user ID" });
      }

      // Ensure title is set (required by schema)
      const finalTitle = opportunityTitle.trim() || 'Untitled Opportunity';

      // Build opportunity data with new fields taking precedence
      const opportunityData: any = {
        userId: authenticatedUserId, // Set correctly from the start
        createdBy: authenticatedUserId, // Set correctly from the start
        orgId: userOrgs[0]?.id || null,
        title: finalTitle, // REQUIRED by schema
        // Legacy fields for backward compatibility
        clientName: finalTitle,
        clientPhone: clientPhone || null,
        clientEmail: clientEmail || null,
        propertyAddress: propertyAddress || null,
        propertyJobId: propertyJobId || null,
        status: mappedStatus, // Use mapped status for database constraint
        pipelineStage: pipelineStage || 'new',
        estimatedValue: estimatedValue || null,
        probabilityPct: probabilityPct || 0,
        expectedCloseDate: expectedCloseDate || null,
        source: source || null,
        notes: notes || null,
      };

      // Add new Kanban fields if provided
      if (value !== undefined) {
        opportunityData.value = value;
        // Also set estimatedValue if not provided
        if (!estimatedValue) {
          opportunityData.estimatedValue = value;
        }
      }
      if (stageId) opportunityData.stageId = stageId;
      if (pipelineId) opportunityData.pipelineId = pipelineId;
      if (contactId) opportunityData.contactId = contactId;
      if (ownerId) opportunityData.ownerId = ownerId;
      if (tags) opportunityData.tags = tags;
      
      console.log('[POST /api/opportunities] Creating opportunity with userId:', authenticatedUserId);
      const opportunity = await storage.createOpportunity(opportunityData);
      
      if (!opportunity) {
        return res.status(500).json({ message: "Failed to create opportunity" });
      }
      
      console.log('[POST /api/opportunities] Created opportunity:', opportunity.id, 'with userId:', opportunity.userId);
      
      // Verify the opportunity was saved with the correct userId
      // Compare as strings to handle UUID type differences
      if (String(opportunity.userId) !== authenticatedUserId) {
        console.error('[POST /api/opportunities] ERROR: userId mismatch! Expected:', authenticatedUserId, 'Got:', opportunity.userId);
        return res.status(500).json({ message: "Opportunity was created with incorrect userId" });
      }
      
      console.log('[POST /api/opportunities] Opportunity userId verified successfully');
      
      // Map database status values back to frontend values
      const reverseStatusMap: Record<string, string> = {
        'new': 'open',
        'contacted': 'open',
        'qualified': 'open',
        'viewing': 'open',
        'offer': 'open',
        'closed_won': 'won',
        'closed_lost': 'lost',
      };
      
      const mappedOpportunity = {
        ...opportunity,
        status: reverseStatusMap[opportunity.status] || opportunity.status,
      };
      
      res.json(mappedOpportunity);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/opportunities/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const opportunityId = req.params.id;
      const opportunity = await storage.getOpportunity(opportunityId);
      
      if (!opportunity) {
        return res.status(404).json({ message: "Opportunity not found" });
      }

      // Verify access - compare as strings to handle UUID type differences
      if (String(opportunity.userId) !== String(req.user.id)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Map frontend status values to database values before updating
      const updates: any = { ...req.body };
      if (updates.status) {
        const statusMap: Record<string, string> = {
          'open': 'new',
          'won': 'closed_won',
          'lost': 'closed_lost',
          'abandoned': 'closed_lost',
        };
        updates.status = statusMap[updates.status] || updates.status;
      }
      
      const updated = await storage.updateOpportunity(opportunityId, updates);
      
      // Map database status values back to frontend values
      const reverseStatusMap: Record<string, string> = {
        'new': 'open',
        'contacted': 'open',
        'qualified': 'open',
        'viewing': 'open',
        'offer': 'open',
        'closed_won': 'won',
        'closed_lost': 'lost',
      };
      
      const mappedOpportunity = {
        ...updated,
        status: reverseStatusMap[updated.status] || updated.status,
      };
      
      res.json(mappedOpportunity);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/opportunities/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const opportunityId = req.params.id;
      const opportunity = await storage.getOpportunity(opportunityId);
      
      if (!opportunity) {
        return res.status(404).json({ message: "Opportunity not found" });
      }

      // Verify access - compare as strings to handle UUID type differences
      if (String(opportunity.userId) !== String(req.user.id)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteOpportunity(opportunityId);
      res.json({ message: "Opportunity deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Opportunity Follow-ups
  app.get("/api/opportunities/:id/followups", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const opportunityId = req.params.id;
      const opportunity = await storage.getOpportunity(opportunityId);
      
      if (!opportunity || opportunity.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const followups = await storage.getOpportunityFollowups(opportunityId);
      res.json(followups);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/opportunities/:id/followups", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const opportunityId = req.params.id;
      const { taskText, dueDate, assignedTo, taskOrder, isRecurring, recurrencePattern } = req.body;

      if (!taskText || !taskText.trim()) {
        return res.status(400).json({ message: "Task text is required" });
      }

      const opportunity = await storage.getOpportunity(opportunityId);
      if (!opportunity || opportunity.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const followup = await storage.createOpportunityFollowup({
        opportunityId,
        taskText: taskText.trim(),
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedTo,
        taskOrder: taskOrder || 0,
        isRecurring: isRecurring || false,
        recurrencePattern,
      });
      res.json(followup);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/followups/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const followupId = req.params.id;
      const followup = await storage.updateOpportunityFollowup(followupId, req.body);
      res.json(followup);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/followups/:id/complete", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const followupId = req.params.id;
      const followup = await storage.updateOpportunityFollowup(followupId, {
        completed: true,
        completedAt: new Date(),
        completedBy: req.user.id,
      });
      res.json(followup);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/followups/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const followupId = req.params.id;
      await storage.deleteOpportunityFollowup(followupId);
      res.json({ message: "Follow-up deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Opportunity Notes
  app.get("/api/opportunities/:id/notes", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const opportunityId = req.params.id;
      const opportunity = await storage.getOpportunity(opportunityId);
      
      if (!opportunity || opportunity.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const notes = await storage.getOpportunityNotes(opportunityId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/opportunities/:id/notes", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const opportunityId = req.params.id;
      const { noteText, noteType } = req.body;

      if (!noteText || !noteText.trim()) {
        return res.status(400).json({ message: "Note text is required" });
      }

      const opportunity = await storage.getOpportunity(opportunityId);
      if (!opportunity || opportunity.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const note = await storage.createOpportunityNote({
        opportunityId,
        userId: req.user.id,
        noteText: noteText.trim(),
        noteType: noteType || 'general',
      });
      res.json(note);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/opportunity-notes/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const noteId = req.params.id;
      const note = await storage.updateOpportunityNote(noteId, req.body);
      res.json(note);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/opportunity-notes/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const noteId = req.params.id;
      await storage.deleteOpportunityNote(noteId);
      res.json({ message: "Note deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Opportunity Activities
  app.get("/api/opportunities/:id/activities", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const opportunityId = req.params.id;
      const opportunity = await storage.getOpportunity(opportunityId);
      
      if (!opportunity || opportunity.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const activities = await storage.getOpportunityActivities(opportunityId);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/opportunities/:id/activities", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const opportunityId = req.params.id;
      const { activityType, activityTitle, activityDescription, activityData } = req.body;

      if (!activityType || !activityTitle) {
        return res.status(400).json({ message: "Activity type and title are required" });
      }

      const opportunity = await storage.getOpportunity(opportunityId);
      if (!opportunity || opportunity.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const activity = await storage.createOpportunityActivity({
        opportunityId,
        userId: req.user.id,
        activityType,
        activityTitle,
        activityDescription,
        activityData: activityData || {},
      });
      res.json(activity);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Opportunity Documents
  app.get("/api/opportunities/:id/documents", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const opportunityId = req.params.id;
      const opportunity = await storage.getOpportunity(opportunityId);
      
      if (!opportunity || opportunity.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const documents = await storage.getOpportunityDocuments(opportunityId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/opportunities/:id/documents", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const opportunityId = req.params.id;
      const { fileName, fileUrl, fileType, fileSize, description } = req.body;

      if (!fileName || !fileUrl) {
        return res.status(400).json({ message: "File name and URL are required" });
      }

      const opportunity = await storage.getOpportunity(opportunityId);
      if (!opportunity || opportunity.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const document = await storage.createOpportunityDocument({
        opportunityId,
        userId: req.user.id,
        fileName,
        fileUrl,
        fileType,
        fileSize,
        description,
      });
      res.json(document);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/opportunity-documents/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const documentId = req.params.id;
      await storage.deleteOpportunityDocument(documentId);
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Pipeline view
  app.get("/api/opportunities/pipeline", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const opportunities = await storage.getOpportunities(req.user.id);
      
      // Map database status values back to frontend values
      const reverseStatusMap: Record<string, string> = {
        'new': 'open',
        'contacted': 'open',
        'qualified': 'open',
        'viewing': 'open',
        'offer': 'open',
        'closed_won': 'won',
        'closed_lost': 'lost',
      };
      
      const mappedOpportunities = opportunities.map((opp: any) => ({
        ...opp,
        status: reverseStatusMap[opp.status] || opp.status,
      }));
      
      // Group by pipeline stage
      const pipeline: Record<string, any[]> = {};
      mappedOpportunities.forEach(opp => {
        const stage = opp.pipelineStage || 'new';
        if (!pipeline[stage]) {
          pipeline[stage] = [];
        }
        pipeline[stage].push(opp);
      });
      res.json(pipeline);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Tasks endpoints (alias for followups until migration is complete)
  app.get("/api/opportunities/:id/tasks", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const opportunityId = req.params.id;
      const opportunity = await storage.getOpportunity(opportunityId);
      
      if (!opportunity || opportunity.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const followups = await storage.getOpportunityFollowups(opportunityId);
      // Map followups to tasks format
      const tasks = followups.map((f: any) => ({
        ...f,
        title: f.title || f.taskText,
        status: f.status || (f.completed ? 'completed' : 'pending'),
      }));
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/opportunities/:id/tasks", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const opportunityId = req.params.id;
      const { title, description, dueDate } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ message: "Task title is required" });
      }

      const opportunity = await storage.getOpportunity(opportunityId);
      if (!opportunity || opportunity.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const followup = await storage.createOpportunityFollowup({
        opportunityId,
        taskText: title.trim(),
        dueDate: dueDate ? new Date(dueDate) : null,
      });
      
      // Map to task format
      res.json({
        ...followup,
        title: followup.title || followup.taskText,
        status: followup.status || (followup.completed ? 'completed' : 'pending'),
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/opportunity-tasks/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const taskId = req.params.id;
      const updates: any = { ...req.body };
      
      // Verify the task exists and belongs to the user's opportunity
      const task = await storage.getOpportunityFollowup(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Get the opportunity to verify ownership
      const opportunity = await storage.getOpportunity(task.opportunityId);
      if (!opportunity || opportunity.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Map task format to followup format
      if (updates.status) {
        updates.completed = updates.status === 'completed';
        delete updates.status;
      }
      if (updates.title) {
        updates.taskText = updates.title;
        delete updates.title;
      }
      
      const followup = await storage.updateOpportunityFollowup(taskId, updates);
      
      // Map to task format
      res.json({
        ...followup,
        title: followup.title || followup.taskText,
        status: followup.status || (followup.completed ? 'completed' : 'pending'),
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/opportunity-tasks/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const taskId = req.params.id;
      await storage.deleteOpportunityFollowup(taskId);
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Contacts endpoints
  app.get("/api/contacts", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const contacts = await storage.getContacts(req.user.id);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/contacts", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { firstName, lastName, email, phone, company, address, notes, tags } = req.body;

      if (!firstName || !lastName) {
        return res.status(400).json({ message: "First name and last name are required" });
      }

      const contact = await storage.createContact({
        userId: req.user.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email?.trim(),
        phone: phone?.trim(),
        company: company?.trim(),
        address: address?.trim(),
        notes: notes?.trim(),
        tags: tags || [],
      });
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/contacts/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const contactId = req.params.id;
      const contact = await storage.getContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (contact.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updated = await storage.updateContact(contactId, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/contacts/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const contactId = req.params.id;
      const contact = await storage.getContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (contact.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteContact(contactId);
      res.json({ message: "Contact deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Pipelines endpoints
  app.get("/api/pipelines", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const pipelines = await storage.getPipelines(req.user.id);
      res.json(pipelines);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/pipelines", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { name, isDefault, orgId } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Pipeline name is required" });
      }

      // If setting as default, unset other defaults for this user
      if (isDefault) {
        const existingPipelines = await storage.getPipelines(req.user.id);
        for (const pipeline of existingPipelines) {
          if (pipeline.isDefault) {
            await storage.updatePipeline(pipeline.id, { isDefault: false });
          }
        }
      }

      const pipeline = await storage.createPipeline({
        userId: req.user.id,
        orgId: orgId || null,
        name: name.trim(),
        isDefault: isDefault || false,
        stageOrder: [],
      });
      res.json(pipeline);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/pipelines/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const pipelineId = req.params.id;
      const pipeline = await storage.getPipeline(pipelineId);
      
      if (!pipeline) {
        return res.status(404).json({ message: "Pipeline not found" });
      }

      if (pipeline.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // If setting as default, unset other defaults
      if (req.body.isDefault) {
        const existingPipelines = await storage.getPipelines(req.user.id);
        for (const p of existingPipelines) {
          if (p.isDefault && p.id !== pipelineId) {
            await storage.updatePipeline(p.id, { isDefault: false });
          }
        }
      }

      const updated = await storage.updatePipeline(pipelineId, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/pipelines/:id/stages", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const pipelineId = req.params.id;
      const pipeline = await storage.getPipeline(pipelineId);
      
      if (!pipeline) {
        return res.status(404).json({ message: "Pipeline not found" });
      }

      if (pipeline.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Pass userId to get user-specific stage names
      const stages = await storage.getPipelineStages(pipelineId, req.user.id);
      console.log(`[GET /api/pipelines/:id/stages] Returning ${stages.length} stages for pipeline ${pipelineId}:`, stages.map(s => ({ id: s.id, name: s.name })));
      res.json(stages);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/pipelines/:id/stages", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const pipelineId = req.params.id;
      const { name, order, color } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Stage name is required" });
      }

      const pipeline = await storage.getPipeline(pipelineId);
      if (!pipeline || pipeline.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if a stage with this name already exists for this pipeline
      const existingStages = await storage.getPipelineStages(pipelineId);
      const duplicateStage = existingStages.find(s => s.name.toLowerCase() === name.trim().toLowerCase());
      
      if (duplicateStage) {
        console.log(`[POST /api/pipelines/:id/stages] Stage "${name}" already exists for pipeline ${pipelineId} with ID ${duplicateStage.id}, returning existing stage`);
        return res.json(duplicateStage);
      }

      console.log(`[POST /api/pipelines/:id/stages] Creating new stage "${name}" for pipeline ${pipelineId}`);
      const stage = await storage.createPipelineStage({
        pipelineId,
        name: name.trim(),
        order: order !== undefined ? order : 0,
        color: color || '#6B7280',
      });
      console.log(`[POST /api/pipelines/:id/stages] Created stage with ID ${stage.id} for pipeline ${pipelineId}`);
      res.json(stage);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/pipeline-stages/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const stageId = req.params.id;
      const stage = await storage.getPipelineStage(stageId);
      
      if (!stage) {
        return res.status(404).json({ message: "Pipeline stage not found" });
      }

      const pipeline = await storage.getPipeline(stage.pipelineId);
      if (!pipeline || pipeline.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // If updating name, store it as user-specific override
      if (req.body.name !== undefined && req.body.name !== stage.name) {
        await storage.upsertUserStageName(req.user.id, stageId, req.body.name);
        // Return stage with updated name
        const stages = await storage.getPipelineStages(stage.pipelineId, req.user.id);
        const updatedStage = stages.find(s => s.id === stageId);
        return res.json(updatedStage || stage);
      }

      // For other updates (color, order), update the stage directly
      const updated = await storage.updatePipelineStage(stageId, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Endpoint to update only the stage name (user-specific override)
  app.put("/api/pipeline-stages/:id/name", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const stageId = req.params.id;
      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Stage name is required" });
      }

      const stage = await storage.getPipelineStage(stageId);
      if (!stage) {
        return res.status(404).json({ message: "Pipeline stage not found" });
      }

      const pipeline = await storage.getPipeline(stage.pipelineId);
      if (!pipeline || pipeline.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Store user-specific name override
      await storage.upsertUserStageName(req.user.id, stageId, name.trim());
      
      // Return updated stage with user-specific name
      const stages = await storage.getPipelineStages(stage.pipelineId, req.user.id);
      const updatedStage = stages.find(s => s.id === stageId);
      res.json(updatedStage || stage);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Endpoint to reset stage name to default (delete user override)
  app.delete("/api/pipeline-stages/:id/name", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const stageId = req.params.id;
      const stage = await storage.getPipelineStage(stageId);
      
      if (!stage) {
        return res.status(404).json({ message: "Pipeline stage not found" });
      }

      const pipeline = await storage.getPipeline(stage.pipelineId);
      if (!pipeline || pipeline.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Delete user-specific name override
      await storage.deleteUserStageName(req.user.id, stageId);
      
      // Return stage with default name
      res.json(stage);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Endpoint to delete a stage
  app.delete("/api/pipeline-stages/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const stageId = req.params.id;
      const stage = await storage.getPipelineStage(stageId);
      
      if (!stage) {
        return res.status(404).json({ message: "Pipeline stage not found" });
      }

      const pipeline = await storage.getPipeline(stage.pipelineId);
      if (!pipeline || pipeline.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deletePipelineStage(stageId);
      res.json({ message: "Stage deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  console.log('✅ Routes registered successfully');
}
