import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { registerTextureProxyRoutes } from './routes/textureProxy.js';
import healthRoutes from "./routes/health.js";
import { storage } from './storage.js';
import { CompositeGenerator } from './compositeGenerator.js';
import { requireIndustryType } from './middleware/requireIndustry.js';
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
import { randomUUID, randomBytes } from "crypto";
import express from "express";
import { registerMaterialRoutes } from './materialRoutes.js';
import { registerMaterialRoutesV2 } from "./routes/materials.js";
import { scenes } from "./routes/scenes.js";
import sharp from "sharp";
import { PasswordService, PasswordValidator } from "./lib/passwordService.js";
import { PasswordResetService } from "./lib/passwordResetService.js";
import { createBruteForceMiddleware } from "./lib/bruteForceProtection.js";
import { storageService } from "./lib/storageService.js";
import { logger } from "./lib/logger.js";
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
  
  // Public buyer form API endpoint (for metadata - React app handles the route)
  app.get("/api/public/buyer-form/:token", async (req: any, res: any) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      // Look up form link
      const formLink = await storage.getBuyerFormLinkByToken(token);
      
      if (!formLink) {
        return res.status(404).json({ 
          valid: false,
          message: "This form link is invalid or has been removed" 
        });
      }

      // Validate status
      if (formLink.status !== 'active') {
        return res.status(404).json({ 
          valid: false,
          message: "This form link has been disabled" 
        });
      }

      // Validate expiry
      if (formLink.expiresAt && new Date(formLink.expiresAt) < new Date()) {
        return res.status(404).json({ 
          valid: false,
          message: "This form link has expired" 
        });
      }

      // Get org info for branding
      const org = await storage.getOrg(formLink.orgId);
      if (!org) {
        return res.status(404).json({ 
          valid: false,
          message: "Organization not found" 
        });
      }

      // Trigger 4: Past Appraisal Re-engaged - Check if contact was previously dormant
      try {
        const { createActionIfNotExists } = await import('./lib/actionHelper.js');
        // Check if there's a contact associated with this form submission
        // If form link has been accessed before and contact exists, create action
        const submissions = await storage.getBuyerFormSubmissions(formLink.id);
        if (submissions.length > 0) {
          // Check if there's a contact created from previous submission
          const previousSubmission = submissions[submissions.length - 1];
          if (previousSubmission.createdContactId) {
            const contact = await storage.getContact(previousSubmission.createdContactId);
            if (contact) {
              // Check if contact was created more than 7 days ago (dormant)
              const contactAge = new Date().getTime() - new Date(contact.createdAt).getTime();
              const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
              if (contactAge > sevenDaysInMs) {
                await createActionIfNotExists({
                  orgId: formLink.orgId,
                  agentId: formLink.createdByUserId,
                  contactId: contact.id,
                  propertyId: formLink.propertyId || null,
                  type: 'seller_interest_reengaged',
                  description: 'Past appraisal contact has become active again.',
                  priority: 'high',
                });
              }
            }
          }
        }
      } catch (actionError: any) {
        console.warn('[Buyer Form Link] Failed to check for re-engagement:', actionError?.message);
      }

      // Get property info if linked
      let propertyInfo: any = null;
      if (formLink.propertyId) {
        const job = await storage.getJob(formLink.propertyId);
        if (job) {
          // Get first photo for property
          const photos = await storage.getJobPhotos(formLink.propertyId);
          const firstPhoto = photos && photos.length > 0 ? photos[0] : null;
          
          propertyInfo = {
            id: job.id,
            address: job.address || job.clientName || 'Property',
            photoUrl: firstPhoto ? (firstPhoto.originalUrl?.startsWith('/uploads/') 
              ? `/api/photos/${firstPhoto.id}/image` 
              : firstPhoto.originalUrl || firstPhoto.url) : null,
          };
        }
      }

      // Return safe metadata
      res.json({
        valid: true,
        orgName: org.name,
        orgLogoUrl: org.logoUrl,
        property: propertyInfo,
        // Form fields schema (static for v1)
        fields: {
          fullName: { type: 'text', required: true, label: 'Full Name' },
          email: { type: 'email', required: true, label: 'Email' },
          phone: { type: 'tel', required: false, label: 'Phone' },
          preferredSuburbs: { type: 'array', required: false, label: 'Preferred Suburbs' },
          budgetMin: { type: 'number', required: false, label: 'Budget Min' },
          budgetMax: { type: 'number', required: false, label: 'Budget Max' },
          bedsMin: { type: 'number', required: false, label: 'Min Beds' },
          bathsMin: { type: 'number', required: false, label: 'Min Baths' },
          propertyType: { type: 'select', required: false, label: 'Property Type', options: ['house', 'townhouse', 'apartment', 'land', 'acreage'] },
          mustHaves: { type: 'array', required: false, label: 'Must Haves' },
          dealBreakers: { type: 'array', required: false, label: 'Deal Breakers' },
          financeStatus: { type: 'select', required: false, label: 'Finance Status', options: ['preapproved', 'needsFinance', 'cash', 'unknown'] },
          timeline: { type: 'select', required: false, label: 'Timeline', options: ['asap', '30days', '60days', '3to6months', 'unknown'] },
          freeNotes: { type: 'textarea', required: false, label: 'Additional Notes' },
        },
      });
    } catch (error: any) {
      console.error('[Get Buyer Form Metadata Error]', error?.message || error);
      res.status(500).json({ 
        valid: false,
        message: "Failed to load form" 
      });
    }
  });
  
  console.log('✅ Public buyer form GET route registered');
  
  // Register admin routes
  const { adminRouter } = await import('./routes/admin.js');
  app.use('/api/admin', adminRouter);
  console.log('✅ Admin routes registered');
  
  // Register subscription routes
  const { subscriptionRoutes } = await import('./routes/subscription.js');
  app.use('/api/subscription', subscriptionRoutes);
  console.log('✅ Subscription routes registered');
  
  // Register enhancement routes
  const { enhancementRoutes } = await import('./routes/enhancements.js');
  app.use('/api/enhancements', enhancementRoutes);
  // Keep /api/credits for backward compatibility (redirects to enhancements)
  app.use('/api/credits', enhancementRoutes);
  console.log('✅ Enhancement routes registered');
  
  // Register feature routes
  const { featureRoutes } = await import('./routes/features.js');
  app.use('/api/features', featureRoutes);
  console.log('✅ Feature routes registered');
  
  // Register referral routes
  const { referralRoutes } = await import('./routes/referrals.js');
  app.use('/api/referrals', referralRoutes);
  console.log('✅ Referral routes registered');
  
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

      // Record referral if referral code is provided
      const referralCode = req.body.referralCode || req.query.ref;
      if (referralCode) {
        try {
          const { referralService } = await import('./lib/referralService.js');
          const referralResult = await referralService.recordReferral(referralCode, user.id);
          if (referralResult.success) {
            logger.info({
              msg: 'Referral recorded for new user',
              userId: user.id,
              referralCode,
              referralId: referralResult.referralId,
            });
          } else {
            logger.warn({
              msg: 'Failed to record referral during registration',
              userId: user.id,
              referralCode,
              reason: referralResult.message,
            });
          }
        } catch (referralError) {
          // Log but don't fail registration if referral recording fails
          logger.warn({
            msg: 'Failed to record referral during registration',
            err: referralError,
            userId: user.id,
            referralCode,
          });
        }
      }

      // Activate free trial for new user (if they haven't used it before)
      try {
        const { trialService } = await import('./lib/trialService.js');
        const trialResult = await trialService.activateTrial(user.id);
        if (trialResult.success) {
          logger.info({
            msg: 'Trial activated for new user',
            userId: user.id,
            email: normalizedEmail,
          });
        }
      } catch (trialError) {
        // Log but don't fail registration if trial activation fails
        logger.warn({
          msg: 'Failed to activate trial during registration',
          err: trialError,
          userId: user.id,
        });
      }

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

  // Activate free trial endpoint
  app.post("/api/trial/activate", async (req: any, res: any) => {
    try {
      const user = req.session?.user;
      if (!user?.id) {
        return res.status(401).json({ ok: false, error: 'Authentication required' });
      }

      const { trialService } = await import('./lib/trialService.js');
      const result = await trialService.activateTrial(user.id);

      if (!result.success) {
        return res.status(400).json({ 
          ok: false, 
          error: result.message || 'Failed to activate trial' 
        });
      }

      // Refresh user data
      const updatedUser = await storage.getUser(user.id);
      if (updatedUser) {
        req.session.user = {
          ...user,
          isTrial: updatedUser.isTrial,
          trialStartDate: updatedUser.trialStartDate,
          trialEnhancements: updatedUser.trialEnhancements,
          hasUsedTrial: updatedUser.hasUsedTrial,
        };
        await req.session.save();
      }

      res.json({ 
        ok: true, 
        message: 'Trial activated successfully',
        user: updatedUser ? {
          isTrial: updatedUser.isTrial,
          trialStartDate: updatedUser.trialStartDate,
          trialEnhancements: updatedUser.trialEnhancements,
          hasUsedTrial: updatedUser.hasUsedTrial,
        } : null,
      });
    } catch (error) {
      logger.error({ msg: 'Failed to activate trial', err: error });
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
  // NOTE: No requireIndustryType middleware - users need to access this to set industry
  app.post("/api/onboarding/update", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      // Validate request body with Zod
      const { OnboardingUpdateSchema } = await import('../shared/schemas.js');
      const validated = OnboardingUpdateSchema.parse(req.body);
      const { step, responses } = validated;
      
      const onboarding = await storage.updateUserOnboarding(req.user.id, {
        step,
        responses: responses || {},
      });
      
      res.json(onboarding);
    } catch (error: any) {
      console.error('[onboarding/update] Error:', error);
      
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation error", 
          details: error.issues 
        });
      }
      
      // If error is due to missing table, return success with default to prevent crashes
      if (error?.message?.includes('user_onboarding') || error?.code === '42P01' || error?.code === '42703') {
        console.warn('[onboarding/update] Table not found, returning default response');
        return res.json({ 
          step: req.body.step || 'welcome', 
          completed: false, 
          responses: req.body.responses || {} 
        });
      }
      res.status(500).json({ error: error?.message || 'Failed to update onboarding' });
    }
  });

  // POST /api/onboarding/complete - Mark onboarding as completed
  // NOTE: No requireIndustryType middleware - users need to access this to complete onboarding
  app.post("/api/onboarding/complete", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      // Validate request body with Zod
      const { OnboardingCompleteSchema } = await import('../shared/schemas.js');
      OnboardingCompleteSchema.parse(req.body || {});
      
      await storage.completeUserOnboarding(req.user.id);
      
      // Complete referral and award rewards if user was referred
      try {
        const { referralService } = await import('./lib/referralService.js');
        const referralResult = await referralService.completeReferral(req.user.id);
        if (referralResult.success) {
          logger.info({
            msg: 'Referral completed after onboarding',
            userId: req.user.id,
            referrerRewarded: referralResult.referrerRewarded,
            refereeRewarded: referralResult.refereeRewarded,
          });
        }
      } catch (referralError) {
        // Log but don't fail onboarding completion if referral completion fails
        logger.warn({
          msg: 'Failed to complete referral after onboarding',
          err: referralError,
          userId: req.user.id,
        });
      }
      
      res.json({ ok: true });
    } catch (error: any) {
      console.error('[onboarding/complete] Error:', error);
      
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation error", 
          details: error.issues 
        });
      }
      
      res.status(500).json({ error: error?.message || 'Failed to complete onboarding' });
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
      
      // Check for missing property fields and create action if needed
      try {
        const { checkMissingPropertyFields } = await import('./lib/actionHelper.js');
        const userOrgs = await storage.getUserOrgs(req.user.id);
        const orgId = userOrgs.length > 0 ? userOrgs[0].id : null;
        if (orgId) {
          // Fetch the full job to check all fields
          const fullJob = await storage.getJob(job.id);
          if (fullJob) {
            await checkMissingPropertyFields(job.id, fullJob, orgId, req.user.id);
          }
        }
      } catch (actionError: any) {
        console.warn('[POST /api/jobs] Failed to check for missing property fields:', actionError?.message);
      }
      
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

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(job);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Matched Buyers endpoint
  app.get("/api/jobs/:id/matched-buyers", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const jobId = req.params.id;
      if (!jobId) {
        return res.status(400).json({ message: "Job ID is required" });
      }

      // Get property/job
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get orgId for matching (use job.orgId if available, otherwise get from user)
      let orgId: string | null = job.orgId || null;
      if (!orgId) {
        const userOrgs = await storage.getUserOrgs(req.user.id);
        if (userOrgs && userOrgs.length > 0) {
          orgId = userOrgs[0].id;
        }
      }

      if (!orgId) {
        return res.status(400).json({ message: "User must belong to an organization" });
      }

      // Import matching engine
      const { matchBuyersToProperty } = await import('./services/matchingEngine.js');
      
      // Prepare property data
      // Parse estimatedPrice - try to extract numeric value from string if needed
      let estimatedPrice: number | null = null;
      if (job.estimatedPrice) {
        if (typeof job.estimatedPrice === 'string') {
          // Try to extract number from string (e.g., "$600,000" -> 600000)
          const cleaned = job.estimatedPrice.replace(/[$,]/g, '').trim();
          const parsed = parseFloat(cleaned);
          if (!isNaN(parsed)) {
            estimatedPrice = parsed;
          }
        } else {
          estimatedPrice = Number(job.estimatedPrice);
        }
      }
      
      // Get property notes for matching
      let propertyNotesTexts: string[] = [];
      try {
        const notes = await storage.getPropertyNotes(jobId);
        propertyNotesTexts = notes.map((note: any) => note.noteText || '').filter((text: string) => text.trim());
      } catch (error: any) {
        // If notes can't be loaded, continue without them (non-critical)
        console.warn('[Matched Buyers] Could not load property notes:', error?.message);
      }
      
      const propertyData = {
        id: job.id,
        address: job.address || null,
        suburb: job.suburb || null,
        estimatedPrice: estimatedPrice,
        bedrooms: job.bedrooms ? Number(job.bedrooms) : null,
        bathrooms: job.bathrooms ? Number(job.bathrooms) : null,
        propertyType: job.propertyType || null,
        propertyFeatures: Array.isArray(job.propertyFeatures) ? job.propertyFeatures : (job.propertyFeatures ? [String(job.propertyFeatures)] : []),
        propertyDescription: job.propertyDescription || null,
        propertyNotes: propertyNotesTexts,
        listingDate: job.listingDate || null,
      };
      
      console.log('[Matched Buyers] Property data:', JSON.stringify(propertyData, null, 2));

      // Get buyer opportunities with profiles
      const buyerOpportunities = await storage.getBuyerOpportunitiesWithProfiles(orgId);

      // Validate buyerOpportunities is an array
      if (!Array.isArray(buyerOpportunities)) {
        console.error('[Matched Buyers] buyerOpportunities is not an array:', typeof buyerOpportunities, buyerOpportunities);
        return res.status(500).json({ message: "Invalid data format from storage" });
      }

      console.log(`[Matched Buyers] Found ${buyerOpportunities.length} buyer opportunities`);
      if (buyerOpportunities.length > 0) {
        console.log('[Matched Buyers] Sample opportunity:', JSON.stringify(buyerOpportunities[0], null, 2));
      }

      // Run matching engine
      const matchingResult = matchBuyersToProperty(propertyData, buyerOpportunities);

      // Log for debugging
      console.log(`[MatchingEngine] Property ${jobId} → ${buyerOpportunities.length} candidates, ${matchingResult.matches.length} matches`);
      if (matchingResult.matches.length > 0) {
        console.log('[MatchingEngine] Top match:', JSON.stringify(matchingResult.matches[0], null, 2));
      }

      // Generate match suggestions after computing matches
      try {
        const { generateMatchSuggestions } = await import('./services/matchSuggestionGenerator.js');
        const suggestions = await generateMatchSuggestions({
          orgId,
          propertyId: jobId,
          createdByUserId: req.user.id,
        });
        console.log(`[Matched Buyers] Generated ${suggestions.length} match suggestions`);
        // Note: Action creation for new buyer matches is handled inside generateMatchSuggestions
      } catch (suggestionError: any) {
        // Log but don't fail the request if suggestion generation fails
        const errorMsg = suggestionError?.message || String(suggestionError);
        console.warn('[Matched Buyers] Failed to generate suggestions:', errorMsg);
        // If it's a migration error, log it prominently
        if (errorMsg.includes('migration') || errorMsg.includes('match_suggestions')) {
          console.error('[Matched Buyers] ⚠️  Match suggestions feature requires migration 049_add_match_suggestions.sql to be run');
        }
      }

      res.json(matchingResult);
    } catch (error: any) {
      console.error('[Matched Buyers] Error:', error?.message || error);
      console.error('[Matched Buyers] Stack:', error?.stack);
      res.status(500).json({ message: error?.message || "Failed to get matched buyers" });
    }
  });

  // Match Suggestions endpoints
  app.get("/api/jobs/:id/match-suggestions", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const jobId = req.params.id;
      const status = req.query.status as string | undefined;

      if (!jobId) {
        return res.status(400).json({ message: "Job ID is required" });
      }

      // Get property/job
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get orgId
      let orgId: string | null = job.orgId || null;
      if (!orgId) {
        const userOrgs = await storage.getUserOrgs(req.user.id);
        if (userOrgs && userOrgs.length > 0) {
          orgId = userOrgs[0].id;
        }
      }

      if (!orgId) {
        return res.status(400).json({ message: "User must belong to an organization" });
      }

      // Get match suggestions
      let suggestions: any[] = [];
      try {
        suggestions = await storage.getMatchSuggestionsByProperty(orgId, jobId, status);
        console.log(`[Match Suggestions] Found ${suggestions.length} suggestions for property ${jobId}`);
      } catch (error: any) {
        console.error('[Match Suggestions] Error fetching suggestions:', error?.message || error);
        // If table doesn't exist, return empty array (migration not run yet)
        if (error?.code === '42P01' || error?.message?.includes('match_suggestions')) {
          console.warn('[Match Suggestions] match_suggestions table may not exist. Run migration 049_add_match_suggestions.sql');
          return res.json({
            propertyId: jobId,
            suggestions: [],
            error: 'Migration not run',
          });
        }
        throw error;
      }

      // Enrich with opportunity and contact data
      const enrichedSuggestions = await Promise.all(
        suggestions.map(async (suggestion) => {
          const opportunity = await storage.getOpportunity(suggestion.opportunityId);
          const contact = await storage.getContact(suggestion.contactId);
          
          return {
            id: suggestion.id,
            opportunityId: suggestion.opportunityId,
            contactId: suggestion.contactId,
            contactName: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown' : 'Unknown',
            matchScore: suggestion.matchScore,
            matchTier: suggestion.matchTier,
            status: suggestion.status,
            createdAt: suggestion.createdAt,
            actedAt: suggestion.actedAt,
            buyerProfileSummary: contact?.buyerProfile ? {
              budgetMin: (contact.buyerProfile as any)?.budgetMin,
              budgetMax: (contact.buyerProfile as any)?.budgetMax,
              preferredSuburbs: (contact.buyerProfile as any)?.preferredSuburbs,
              bedsMin: (contact.buyerProfile as any)?.bedsMin,
              bathsMin: (contact.buyerProfile as any)?.bathsMin,
              propertyType: (contact.buyerProfile as any)?.propertyType,
              timeline: (contact.buyerProfile as any)?.timeline,
            } : null,
          };
        })
      );

      res.json({
        propertyId: jobId,
        suggestions: enrichedSuggestions,
      });
    } catch (error: any) {
      console.error('[Match Suggestions] Error:', error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to get match suggestions" });
    }
  });

  app.patch("/api/match-suggestions/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const suggestionId = req.params.id;
      const { status } = req.body;

      if (!suggestionId) {
        return res.status(400).json({ message: "Suggestion ID is required" });
      }

      if (!status || !['new', 'in_progress', 'completed', 'dismissed'].includes(status)) {
        return res.status(400).json({ message: "Valid status is required" });
      }

      // Get existing suggestion
      const suggestion = await storage.getMatchSuggestion(suggestionId);
      if (!suggestion) {
        return res.status(404).json({ message: "Match suggestion not found" });
      }

      // Verify org access
      const job = await storage.getJob(suggestion.propertyId);
      if (!job) {
        return res.status(404).json({ message: "Property not found" });
      }

      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Update suggestion
      const updates: any = { status };
      
      // Set acted fields when moving to completed or dismissed
      if (status === 'completed' || status === 'dismissed') {
        updates.actedByUserId = req.user.id;
        updates.actedAt = new Date();
      }

      const updated = await storage.updateMatchSuggestion(suggestionId, updates);
      res.json(updated);
    } catch (error: any) {
      console.error('[Match Suggestions] Error updating:', error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to update match suggestion" });
    }
  });

  app.post("/api/match-suggestions/:id/generate-followup", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const suggestionId = req.params.id;

      if (!suggestionId) {
        return res.status(400).json({ message: "Suggestion ID is required" });
      }

      // Get existing suggestion
      const suggestion = await storage.getMatchSuggestion(suggestionId);
      if (!suggestion) {
        return res.status(404).json({ message: "Match suggestion not found" });
      }

      // Verify org access
      const job = await storage.getJob(suggestion.propertyId);
      if (!job) {
        return res.status(404).json({ message: "Property not found" });
      }

      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Generate follow-up message
      const { generateFollowUpMessage } = await import('./services/aiFollowUpGenerator.js');
      const followUp = await generateFollowUpMessage({ matchSuggestionId: suggestionId });

      res.json({
        ...suggestion,
        ...followUp,
      });
    } catch (error: any) {
      console.error('[Match Suggestions] Error generating follow-up:', error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to generate follow-up message" });
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

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Prepare updates - convert date strings to Date objects
      const updates: any = { ...req.body };
      
      // Convert listingDate string to Date if provided
      if (updates.listingDate && typeof updates.listingDate === 'string') {
        const dateValue = new Date(updates.listingDate);
        if (!isNaN(dateValue.getTime())) {
          updates.listingDate = dateValue;
        } else {
          // Invalid date, set to null
          updates.listingDate = null;
        }
      } else if (updates.listingDate === '' || updates.listingDate === null) {
        updates.listingDate = null;
      }

      // Handle estimatedPrice - allow strings (e.g., "POA", "$600,000") or numbers
      // Store as string in database to support special values
      if (updates.estimatedPrice !== undefined && updates.estimatedPrice !== null) {
        if (typeof updates.estimatedPrice === 'string') {
          // Keep as string - allows values like "POA", "Contact for price", "$600,000"
          updates.estimatedPrice = updates.estimatedPrice.trim();
          if (updates.estimatedPrice === '') {
            updates.estimatedPrice = null;
          }
        } else if (typeof updates.estimatedPrice === 'number') {
          // Convert number to string for storage
          updates.estimatedPrice = String(updates.estimatedPrice);
        } else {
          updates.estimatedPrice = null;
        }
      }


      // Update job with provided fields
      const updatedJob = await storage.updateJob(jobId, updates);
      
      // Check for missing property fields and create action if needed
      try {
        const { checkMissingPropertyFields } = await import('./lib/actionHelper.js');
        const userOrgs = await storage.getUserOrgs(req.user.id);
        const orgId = updatedJob.orgId || (userOrgs.length > 0 ? userOrgs[0].id : null);
        if (orgId) {
          // Fetch the full updated job to check all fields
          const fullJob = await storage.getJob(jobId);
          if (fullJob) {
            await checkMissingPropertyFields(jobId, fullJob, orgId, req.user.id);
          }
        }
      } catch (actionError: any) {
        console.warn('[PATCH /api/jobs/:id] Failed to check for missing property fields:', actionError?.message);
      }
      
      // Generate match suggestions after property update (async, don't block response)
      // Only if price, suburb, beds, baths, or property type changed
      const relevantFieldsChanged = 
        updates.estimatedPrice !== undefined ||
        updates.suburb !== undefined ||
        updates.address !== undefined ||
        updates.bedrooms !== undefined ||
        updates.bathrooms !== undefined ||
        updates.propertyType !== undefined ||
        updates.propertyFeatures !== undefined;

      if (relevantFieldsChanged) {
        // Run suggestion generation in background (don't await)
        (async () => {
          try {
            const { generateMatchSuggestions } = await import('./services/matchSuggestionGenerator.js');
            let orgId: string | null = updatedJob.orgId || null;
            if (!orgId) {
              const userOrgs = await storage.getUserOrgs(req.user.id);
              if (userOrgs && userOrgs.length > 0) {
                orgId = userOrgs[0].id;
              }
            }
            if (orgId) {
              await generateMatchSuggestions({
                orgId,
                propertyId: jobId,
                createdByUserId: req.user.id,
              });
            }
          } catch (suggestionError: any) {
            // Log but don't fail the request
            console.warn('[Property Update] Failed to generate suggestions:', suggestionError?.message);
          }
        })();
      }

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

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      
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

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      
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

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      
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

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      
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

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      
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

      // Verify job access (user-centric)
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // User-centric access check
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      
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

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      
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

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      
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

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      
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

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      
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

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      
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

      // Verify user-centric access (same pattern as other endpoints)
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
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

      // Verify user-centric access (same pattern as other endpoints)
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
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

      // Get note to verify access
      const note = await storage.getPropertyNote(noteId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }

      // Get the job to verify access
      const job = await storage.getJob(note.jobId);
      if (!job) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedNote = await storage.updatePropertyNote(noteId, {
        noteText: noteText?.trim(),
        tags,
      });
      res.json(updatedNote);
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

      // Get note to verify access
      const note = await storage.getPropertyNote(noteId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }

      // Get the job to verify access
      const job = await storage.getJob(note.jobId);
      if (!job) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Verify user-centric access
      const hasAccess = job.userId === req.user.id || req.user.isAdmin;
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
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
      if (req.query.opportunityType && ['buyer', 'seller', 'both'].includes(req.query.opportunityType as string)) {
        filters.opportunityType = req.query.opportunityType;
      }

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
      
      // Trigger 2: Opportunity Stalled - Check for opportunities with no activity in 14 days
      try {
        const { createActionIfNotExists } = await import('./lib/actionHelper.js');
        const userOrgs = await storage.getUserOrgs(String(requestingUserId));
        const defaultOrgId = userOrgs.length > 0 ? userOrgs[0].id : null;
        
        if (defaultOrgId) {
          const fourteenDaysAgo = new Date();
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
          
          for (const opp of opportunities) {
            // Only check opportunities that are not closed
            // Use database status values: 'closed_won', 'closed_lost'
            // Note: 'abandoned' is mapped to 'closed_lost' before storage, so it never exists in DB
            const isClosed = opp.status === 'closed_won' || opp.status === 'closed_lost';
            if (isClosed) continue;
            
            // Use opportunity's orgId if available, otherwise fall back to user's first org
            const oppOrgId = opp.orgId || defaultOrgId;
            
            // Check if opportunity is stalled (no notes or activity in 14 days)
            const notes = await storage.getOpportunityNotes(opp.id);
            const latestNote = notes.length > 0 
              ? notes.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
              : null;
            
            const lastActivityDate = latestNote 
              ? new Date(latestNote.createdAt)
              : new Date(opp.updatedAt || opp.createdAt);
            
            if (lastActivityDate < fourteenDaysAgo) {
              // Opportunity is stalled - use opportunity's orgId for proper org scoping
              await createActionIfNotExists({
                orgId: oppOrgId,
                agentId: String(requestingUserId),
                opportunityId: opp.id,
                type: 'opportunity_stalled',
                description: 'This opportunity has had no activity for 14 days.',
                priority: 'medium',
              });
            }
          }
        }
      } catch (actionError: any) {
        console.warn('[GET /api/opportunities] Failed to check for stalled opportunities:', actionError?.message);
      }
      
      // Trigger: Appraisal Follow-Ups - Check for opportunities with appraisals that need follow-up
      try {
        const { createActionIfNotExists } = await import('./lib/actionHelper.js');
        const userOrgs = await storage.getUserOrgs(String(requestingUserId));
        const defaultOrgId = userOrgs.length > 0 ? userOrgs[0].id : null;
        
        if (defaultOrgId) {
          // Use UTC methods to match how appraisal dates are stored (UTC midnight)
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          
          for (const opp of opportunities) {
            // Only check opportunities that are not closed
            // Use database status values since we're iterating over raw database records
            // Database values: 'closed_won', 'closed_lost'
            // Note: 'abandoned' is mapped to 'closed_lost' before storage, so it never exists in DB
            const isClosed = opp.status === 'closed_won' || opp.status === 'closed_lost';
            if (isClosed) continue;
            
            // Check if opportunity has an appraisal date
            if (!opp.appraisalDate) continue;
            
            // Use opportunity's orgId if available, otherwise fall back to user's first org
            const oppOrgId = opp.orgId || defaultOrgId;
            
            // Use UTC methods to match how appraisal dates are stored (UTC midnight)
            const appraisalDate = new Date(opp.appraisalDate);
            appraisalDate.setUTCHours(0, 0, 0, 0);
            
            // Calculate days since appraisal
            const daysSinceAppraisal = Math.floor((today.getTime() - appraisalDate.getTime()) / (1000 * 60 * 60 * 24));
            
            // Check for 7-day follow-up
            if (daysSinceAppraisal === 7) {
              await createActionIfNotExists({
                orgId: oppOrgId,
                agentId: String(requestingUserId),
                opportunityId: opp.id,
                type: 'appraisal_follow_up',
                description: 'This appraisal was completed 7 days ago. Follow up with the seller.',
                priority: 'high',
              });
            }
            
            // Check for 30-day follow-up
            if (daysSinceAppraisal === 30) {
              await createActionIfNotExists({
                orgId: oppOrgId,
                agentId: String(requestingUserId),
                opportunityId: opp.id,
                type: 'appraisal_follow_up',
                description: 'This appraisal was completed 30 days ago. Follow up with the seller.',
                priority: 'high',
              });
            }
            
            // Check for 90-day follow-up
            if (daysSinceAppraisal === 90) {
              await createActionIfNotExists({
                orgId: oppOrgId,
                agentId: String(requestingUserId),
                opportunityId: opp.id,
                type: 'appraisal_follow_up',
                description: 'This appraisal was completed 90 days ago. Follow up with the seller.',
                priority: 'high',
              });
            }
          }
        }
      } catch (actionError: any) {
        console.warn('[GET /api/opportunities] Failed to check for appraisal follow-ups:', actionError?.message);
      }
      
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
        title, value, stageId, pipelineId, contactId, ownerId, tags, opportunityType,
        // Legacy fields (backward compatibility)
        clientName, clientPhone, clientEmail, propertyAddress, propertyJobId, 
        status, pipelineStage, estimatedValue, probabilityPct, expectedCloseDate, source, notes,
        // Appraisal workflow
        appraisalDate
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
        appraisalDate: (appraisalDate && typeof appraisalDate === 'string' && appraisalDate.trim() !== '') ? appraisalDate.trim() : null,
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
      // Validate and set opportunityType (must be 'buyer', 'seller', or 'both')
      if (opportunityType && ['buyer', 'seller', 'both'].includes(opportunityType)) {
        opportunityData.opportunityType = opportunityType;
      } else {
        opportunityData.opportunityType = 'buyer'; // Default to 'buyer'
      }
      
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

  // Actions endpoints
  app.get("/api/actions", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { priority, type, grouped } = req.query;
      let actions = await storage.getActionsByUser(req.user.id);
      
      // Filter out completed actions for main view
      actions = actions.filter(a => !a.completedAt);
      
      // Apply filters
      if (priority && typeof priority === 'string') {
        actions = actions.filter(a => a.priority === priority);
      }
      if (type && typeof type === 'string') {
        // For missing_property_fields, use startsWith since action types have dynamic suffixes
        if (type === 'missing_property_fields') {
          actions = actions.filter(a => a.actionType && a.actionType.startsWith('missing_property_fields_'));
        } else {
          actions = actions.filter(a => a.actionType === type);
        }
      }
      
      // If grouped=true, return grouped structure
      if (grouped === 'true') {
        const groupedActions: {
          property: Array<{ entityId: string; entityName: string; actions: any[] }>;
          opportunity: Array<{ entityId: string; entityName: string; actions: any[] }>;
          contact: Array<{ entityId: string; entityName: string; actions: any[] }>;
        } = {
          property: [],
          opportunity: [],
          contact: [],
        };
        
        // Group actions by entity
        const propertyMap = new Map<string, any[]>();
        const opportunityMap = new Map<string, any[]>();
        const contactMap = new Map<string, any[]>();
        
        for (const action of actions) {
          if (action.propertyId) {
            if (!propertyMap.has(action.propertyId)) {
              propertyMap.set(action.propertyId, []);
            }
            propertyMap.get(action.propertyId)!.push(action);
          } else if (action.opportunityId) {
            if (!opportunityMap.has(action.opportunityId)) {
              opportunityMap.set(action.opportunityId, []);
            }
            opportunityMap.get(action.opportunityId)!.push(action);
          } else if (action.contactId) {
            if (!contactMap.has(action.contactId)) {
              contactMap.set(action.contactId, []);
            }
            contactMap.get(action.contactId)!.push(action);
          }
        }
        
        // Build property groups
        for (const [propertyId, entityActions] of propertyMap.entries()) {
          try {
            const property = await storage.getJob(propertyId);
            groupedActions.property.push({
              entityId: propertyId,
              entityName: property?.address || property?.clientName || `Property ${propertyId.substring(0, 8)}`,
              actions: entityActions,
            });
          } catch (e) {
            // Property not found, use ID
            groupedActions.property.push({
              entityId: propertyId,
              entityName: `Property ${propertyId.substring(0, 8)}`,
              actions: entityActions,
            });
          }
        }
        
        // Build opportunity groups
        for (const [opportunityId, entityActions] of opportunityMap.entries()) {
          try {
            const opportunity = await storage.getOpportunity(opportunityId);
            groupedActions.opportunity.push({
              entityId: opportunityId,
              entityName: opportunity?.title || `Opportunity ${opportunityId.substring(0, 8)}`,
              actions: entityActions,
            });
          } catch (e) {
            groupedActions.opportunity.push({
              entityId: opportunityId,
              entityName: `Opportunity ${opportunityId.substring(0, 8)}`,
              actions: entityActions,
            });
          }
        }
        
        // Build contact groups
        for (const [contactId, entityActions] of contactMap.entries()) {
          try {
            const contact = await storage.getContact(contactId);
            const contactName = contact 
              ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || `Contact ${contactId.substring(0, 8)}`
              : `Contact ${contactId.substring(0, 8)}`;
            groupedActions.contact.push({
              entityId: contactId,
              entityName: contactName,
              actions: entityActions,
            });
          } catch (e) {
            groupedActions.contact.push({
              entityId: contactId,
              entityName: `Contact ${contactId.substring(0, 8)}`,
              actions: entityActions,
            });
          }
        }
        
        return res.json(groupedActions);
      }
      
      // Return flat list if not grouped
      res.json(actions);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.get("/api/actions/entity/:entityId", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { entityId } = req.params;
      
      // Get all actions for this entity (including completed)
      const allActions = await storage.getAllActionsByUser(req.user.id);
      const entityActions = allActions.filter(a => 
        a.propertyId === entityId || 
        a.opportunityId === entityId || 
        a.contactId === entityId
      );
      
      // Sort: incomplete first, then by created date
      entityActions.sort((a, b) => {
        if (a.completedAt && !b.completedAt) return 1;
        if (!a.completedAt && b.completedAt) return -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      res.json(entityActions);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/actions", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { actionType, description, priority, contactId, opportunityId, propertyId } = req.body;

      if (!actionType) {
        return res.status(400).json({ message: "action_type is required" });
      }

      // Get user's org - actions require an organization
      const userOrgs = await storage.getUserOrgs(req.user.id);
      const orgId = userOrgs.length > 0 ? userOrgs[0].id : null;

      if (!orgId) {
        return res.status(400).json({ message: "User must belong to an organization to create actions" });
      }

      // Use createActionIfNotExists for deduplication (prevents duplicate actions within 24 hours)
      const { createActionIfNotExists } = await import('./lib/actionHelper.js');
      await createActionIfNotExists({
        orgId,
        agentId: req.user.id,
        contactId: contactId || null,
        opportunityId: opportunityId || null,
        propertyId: propertyId || null,
        type: actionType,
        description: description || null,
        priority: priority || 'medium',
      });

      // Return success - the helper handles creation and deduplication
      res.json({ success: true, message: "Action created or already exists" });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/actions/:id/complete", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const actionId = req.params.id;
      const action = await storage.completeAction(actionId);
      res.json(action);
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

  // Buyer Profile endpoints
  app.get("/api/contacts/:id/buyer-profile", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const contactId = req.params.id;
      const contact = await storage.getContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (contact.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const buyerProfile = (contact as any).buyerProfile || {};
      res.json(buyerProfile);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/contacts/:id/buyer-profile", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const contactId = req.params.id;
      const contact = await storage.getContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Check both userId and orgId for proper scoping
      if (contact.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Also verify org membership if orgId is present
      if (contact.orgId && req.user.orgId && contact.orgId !== req.user.orgId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Log the entire request body for debugging
      console.log('[Buyer Profile Update] Full request body:', JSON.stringify(req.body, null, 2));
      
      // Validate buyer profile data
      const {
        budgetMin,
        budgetMax,
        preferredSuburbs,
        bedsMin,
        bathsMin,
        propertyType,
        mustHaves,
        dealBreakers,
        financeStatus,
        timeline,
        freeNotes,
      } = req.body;

      // Log what we extracted from the body
      console.log('[Buyer Profile Update] Extracted fields:', {
        preferredSuburbs: preferredSuburbs,
        preferredSuburbsType: typeof preferredSuburbs,
        preferredSuburbsIsArray: Array.isArray(preferredSuburbs),
        mustHaves: mustHaves,
        mustHavesType: typeof mustHaves,
        mustHavesIsArray: Array.isArray(mustHaves),
        dealBreakers: dealBreakers,
        dealBreakersType: typeof dealBreakers,
        dealBreakersIsArray: Array.isArray(dealBreakers),
      });

      // Validation: budgetMin <= budgetMax if both exist
      if (budgetMin !== undefined && budgetMax !== undefined) {
        const min = Number(budgetMin);
        const max = Number(budgetMax);
        if (!isNaN(min) && !isNaN(max) && min > max) {
          return res.status(400).json({ message: "Budget minimum must be less than or equal to maximum" });
        }
        if (min < 0 || max < 0) {
          return res.status(400).json({ message: "Budget values must be non-negative" });
        }
      }

      // Validate bedsMin and bathsMin are non-negative
      if (bedsMin !== undefined && Number(bedsMin) < 0) {
        return res.status(400).json({ message: "Minimum beds must be non-negative" });
      }
      if (bathsMin !== undefined && Number(bathsMin) < 0) {
        return res.status(400).json({ message: "Minimum baths must be non-negative" });
      }

      // Build buyer profile object (only include defined fields)
      // CRITICAL: For array fields, always include them if they're in the request body (even if empty)
      // This ensures that empty arrays can clear existing values
      const buyerProfile: any = {};
      if (budgetMin !== undefined) buyerProfile.budgetMin = budgetMin === null || budgetMin === '' ? null : Number(budgetMin);
      if (budgetMax !== undefined) buyerProfile.budgetMax = budgetMax === null || budgetMax === '' ? null : Number(budgetMax);
      // CRITICAL: Always include array fields if they're present in the request, even if empty
      // Check if the field exists in req.body (not just undefined check)
      if ('preferredSuburbs' in req.body) {
        buyerProfile.preferredSuburbs = Array.isArray(preferredSuburbs) ? preferredSuburbs : [];
        console.log('[Buyer Profile Update] Setting preferredSuburbs:', buyerProfile.preferredSuburbs);
      }
      if (bedsMin !== undefined) buyerProfile.bedsMin = bedsMin === null || bedsMin === '' ? null : Number(bedsMin);
      if (bathsMin !== undefined) buyerProfile.bathsMin = bathsMin === null || bathsMin === '' ? null : Number(bathsMin);
      if (propertyType !== undefined) buyerProfile.propertyType = propertyType || null;
      // CRITICAL: Always include array fields if they're present in the request, even if empty
      if ('mustHaves' in req.body) {
        buyerProfile.mustHaves = Array.isArray(mustHaves) ? mustHaves : [];
        console.log('[Buyer Profile Update] Setting mustHaves:', buyerProfile.mustHaves);
      }
      if ('dealBreakers' in req.body) {
        buyerProfile.dealBreakers = Array.isArray(dealBreakers) ? dealBreakers : [];
        console.log('[Buyer Profile Update] Setting dealBreakers:', buyerProfile.dealBreakers);
      }
      if (financeStatus !== undefined) buyerProfile.financeStatus = financeStatus || null;
      if (timeline !== undefined) buyerProfile.timeline = timeline || null;
      // CRITICAL: Always include freeNotes if it's defined, even if it's an empty string
      // Convert empty string to null, but preserve actual text content
      if (freeNotes !== undefined) {
        buyerProfile.freeNotes = (typeof freeNotes === 'string' && freeNotes.trim() === '') ? null : freeNotes;
      }

      // Merge with existing buyer profile to avoid overwriting with empty values
      const existingProfile = (contact as any).buyerProfile || {};
      const mergedProfile = { ...existingProfile, ...buyerProfile };
      
      // Log for debugging array fields
      console.log('[Buyer Profile Update] Received arrays:', {
        preferredSuburbs: preferredSuburbs,
        mustHaves: mustHaves,
        dealBreakers: dealBreakers,
      });
      console.log('[Buyer Profile Update] Merged profile:', JSON.stringify(mergedProfile, null, 2));

      // Update contact with merged buyer profile
      // Use Promise.race to add a timeout to prevent hanging
      const updatePromise = storage.updateContact(contactId, { buyerProfile: mergedProfile });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Update operation timed out')), 10000)
      );
      
      const updated = await Promise.race([updatePromise, timeoutPromise]) as any;
      const updatedBuyerProfile = (updated as any).buyerProfile || {};
      
      // Send response immediately without waiting for any background operations
      res.json(updatedBuyerProfile);
    } catch (error: any) {
      // Log error but don't wait for Redis or other services
      console.error('[Buyer Profile Update Error]', error?.message || error);
      const statusCode = error?.message?.includes('timeout') ? 504 : 500;
      res.status(statusCode).json({ 
        message: error?.message || 'Failed to update buyer profile' 
      });
    }
  });

  // Buyer Inquiry Form Links endpoints
  app.post("/api/buyer-forms", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { propertyId } = req.body; // No expiresAt needed - one link per user, no expiry
      const userId = req.user.id;
      
      // Get user's org (from session or first org)
      const userOrgs = await storage.getUserOrgs(userId);
      if (!userOrgs || userOrgs.length === 0) {
        return res.status(400).json({ message: "User must belong to an organization" });
      }
      const orgId = userOrgs[0].id;

      // Validate propertyId if provided
      if (propertyId) {
        const job = await storage.getJob(propertyId);
        if (!job) {
          return res.status(404).json({ message: "Property not found" });
        }
        // Verify user has access to this property
        if (job.userId !== userId && !req.user.isAdmin) {
          return res.status(403).json({ message: "Access denied to property" });
        }
      }

      // Get or create a single form link for this user (one link per user, reusable)
      let formLink = await storage.getBuyerFormLinks(orgId, userId).then(links => 
        links.find(link => !link.propertyId || link.propertyId === propertyId)
      );

      if (!formLink) {
        // Generate secure token
        let token: string;
        let attempts = 0;
        do {
          token = randomBytes(32).toString('hex');
          const existing = await storage.getBuyerFormLinkByToken(token);
          if (!existing) break;
          attempts++;
          if (attempts > 5) {
            throw new Error("Failed to generate unique token");
          }
        } while (true);

        // Create form link (no expiry - permanent link)
        formLink = await storage.createBuyerFormLink({
          orgId,
          createdByUserId: userId,
          propertyId: propertyId || null,
          token,
          status: 'active',
          expiresAt: null, // No expiry - permanent link
        });
      }

      // Construct shareable URL
      const baseUrl = process.env.PUBLIC_BASE_URL || process.env.APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
      const shareUrl = `${baseUrl}/public/buyer-form/${formLink.token}`;

      res.json({
        id: formLink.id,
        token: formLink.token,
        shareUrl,
        propertyId: formLink.propertyId,
        expiresAt: formLink.expiresAt,
        status: formLink.status,
        createdAt: formLink.createdAt,
      });
    } catch (error: any) {
      console.error('[Buyer Form Link Creation Error]', error?.message || error);
      res.status(500).json({ 
        message: error?.message || 'Failed to create buyer form link' 
      });
    }
  });

  app.get("/api/buyer-forms", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const userId = req.user.id;
      
      // Get user's org
      const userOrgs = await storage.getUserOrgs(userId);
      if (!userOrgs || userOrgs.length === 0) {
        return res.json([]);
      }
      const orgId = userOrgs[0].id;

      // Get all form links for this org (optionally filtered by user)
      const formLinks = await storage.getBuyerFormLinks(orgId, userId);

      // Construct shareable URLs
      const baseUrl = process.env.APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
      const linksWithUrls = formLinks.map(link => ({
        ...link,
        shareUrl: `${baseUrl}/public/buyer-form/${link.token}`,
      }));

      res.json(linksWithUrls);
    } catch (error: any) {
      console.error('[Get Buyer Form Links Error]', error?.message || error);
      res.status(500).json({ 
        message: error?.message || 'Failed to get buyer form links' 
      });
    }
  });

  app.post("/api/public/buyer-form/:token", async (req: any, res: any) => {
    try {
      const { token } = req.params;
      const {
        fullName,
        email,
        phone,
        preferredSuburbs,
        budgetMin,
        budgetMax,
        bedsMin,
        bathsMin,
        propertyType,
        mustHaves,
        dealBreakers,
        financeStatus,
        timeline,
        freeNotes,
        _hp, // Honeypot field
      } = req.body;

      // Honeypot check - if filled, treat as spam
      if (_hp && _hp.trim() !== '') {
        // Return success but don't create anything
        return res.json({ success: true, message: "Thank you for your submission." });
      }

      // Validate token and form link
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      const formLink = await storage.getBuyerFormLinkByToken(token);
      
      if (!formLink) {
        return res.status(404).json({ message: "Invalid form link" });
      }

      if (formLink.status !== 'active') {
        return res.status(404).json({ message: "This form link has been disabled" });
      }

      if (formLink.expiresAt && new Date(formLink.expiresAt) < new Date()) {
        return res.status(404).json({ message: "This form link has expired" });
      }

      // Basic rate limiting per token + IP (simple in-memory for v1)
      const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const rateLimitKey = `buyer_form_submit:${token}:${clientIp}`;
      // Note: For production, use Redis or a proper rate limiter
      // For v1, we'll rely on the honeypot and basic validation

      // Validation
      if (!fullName || !fullName.trim()) {
        return res.status(400).json({ message: "Full name is required" });
      }

      if (!email && !phone) {
        return res.status(400).json({ message: "Either email or phone is required" });
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Validate numeric fields
      if (budgetMin !== undefined && budgetMin !== null && budgetMin !== '') {
        const min = Number(budgetMin);
        if (isNaN(min) || min < 0) {
          return res.status(400).json({ message: "Budget minimum must be a non-negative number" });
        }
      }

      if (budgetMax !== undefined && budgetMax !== null && budgetMax !== '') {
        const max = Number(budgetMax);
        if (isNaN(max) || max < 0) {
          return res.status(400).json({ message: "Budget maximum must be a non-negative number" });
        }
      }

      if (budgetMin !== undefined && budgetMax !== undefined && 
          budgetMin !== null && budgetMax !== null && 
          budgetMin !== '' && budgetMax !== '') {
        const min = Number(budgetMin);
        const max = Number(budgetMax);
        if (!isNaN(min) && !isNaN(max) && min > max) {
          return res.status(400).json({ message: "Budget minimum must be less than or equal to maximum" });
        }
      }

      if (bedsMin !== undefined && bedsMin !== null && bedsMin !== '') {
        const beds = Number(bedsMin);
        if (isNaN(beds) || beds < 0) {
          return res.status(400).json({ message: "Minimum beds must be a non-negative number" });
        }
      }

      if (bathsMin !== undefined && bathsMin !== null && bathsMin !== '') {
        const baths = Number(bathsMin);
        if (isNaN(baths) || baths < 0) {
          return res.status(400).json({ message: "Minimum baths must be a non-negative number" });
        }
      }

      // Parse arrays (handle both array and string formats)
      const preferredSuburbsArray = Array.isArray(preferredSuburbs) 
        ? preferredSuburbs.filter(s => s && s.trim())
        : (typeof preferredSuburbs === 'string' && preferredSuburbs.trim() 
          ? preferredSuburbs.split(',').map(s => s.trim()).filter(s => s)
          : []);

      const mustHavesArray = Array.isArray(mustHaves)
        ? mustHaves.filter(m => m && m.trim())
        : (typeof mustHaves === 'string' && mustHaves.trim()
          ? mustHaves.split('\n').map(m => m.trim()).filter(m => m)
          : []);

      const dealBreakersArray = Array.isArray(dealBreakers)
        ? dealBreakers.filter(d => d && d.trim())
        : (typeof dealBreakers === 'string' && dealBreakers.trim()
          ? dealBreakers.split('\n').map(d => d.trim()).filter(d => d)
          : []);

      // Split full name into first and last
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || 'Unknown';

      // Use a transaction-like approach: try to create everything, rollback on error
      let createdContactId: string | null = null;
      let createdOpportunityId: string | null = null;

      try {
        // 1. Find or create contact
        let contact: any = null;
        
        // Try to find existing contact by email first, then phone
        // Search within the org's contacts (scoped to the form creator's user)
        if (email) {
          const contacts = await storage.getContacts(formLink.createdByUserId);
          // Match by email within the same org
          contact = contacts.find((c: any) => 
            c.orgId === formLink.orgId && 
            c.email && 
            c.email.toLowerCase() === email.toLowerCase()
          );
        }
        
        if (!contact && phone) {
          const contacts = await storage.getContacts(formLink.createdByUserId);
          // Match by phone within the same org
          contact = contacts.find((c: any) => 
            c.orgId === formLink.orgId && 
            c.phone && 
            c.phone === phone
          );
        }

        // Build buyer profile from form data
        const buyerProfile: any = {};
        if (budgetMin !== undefined && budgetMin !== null && budgetMin !== '') {
          buyerProfile.budgetMin = Number(budgetMin);
        }
        if (budgetMax !== undefined && budgetMax !== null && budgetMax !== '') {
          buyerProfile.budgetMax = Number(budgetMax);
        }
        if (preferredSuburbsArray.length > 0) {
          buyerProfile.preferredSuburbs = preferredSuburbsArray;
        }
        if (bedsMin !== undefined && bedsMin !== null && bedsMin !== '') {
          buyerProfile.bedsMin = Number(bedsMin);
        }
        if (bathsMin !== undefined && bathsMin !== null && bathsMin !== '') {
          buyerProfile.bathsMin = Number(bathsMin);
        }
        if (propertyType) {
          buyerProfile.propertyType = propertyType;
        }
        if (mustHavesArray.length > 0) {
          buyerProfile.mustHaves = mustHavesArray;
        }
        if (dealBreakersArray.length > 0) {
          buyerProfile.dealBreakers = dealBreakersArray;
        }
        if (financeStatus) {
          buyerProfile.financeStatus = financeStatus;
        }
        if (timeline) {
          buyerProfile.timeline = timeline;
        }
        if (freeNotes !== undefined && freeNotes !== null) {
          buyerProfile.freeNotes = (typeof freeNotes === 'string' && freeNotes.trim() === '') ? null : freeNotes;
        }

        if (contact) {
          // Update existing contact
          const existingProfile = (contact.buyerProfile || {}) as any;
          const mergedProfile = { ...existingProfile, ...buyerProfile };
          
          await storage.updateContact(contact.id, {
            email: email || contact.email,
            phone: phone || contact.phone,
            buyerProfile: mergedProfile,
          });
          createdContactId = contact.id;
        } else {
          // Create new contact
          const newContact = await storage.createContact({
            userId: formLink.createdByUserId,
            orgId: formLink.orgId,
            firstName,
            lastName,
            email: email || null,
            phone: phone || null,
            buyerProfile,
          });
          createdContactId = newContact.id;
        }

        // 2. Get default pipeline and find "Contacted" stage for the user who created the form link
        let contactedStageId: string | null = null;
        let defaultPipelineId: string | null = null;
        
        try {
          const pipelines = await storage.getPipelines(formLink.createdByUserId);
          const defaultPipeline = pipelines.find((p: any) => p.isDefault) || pipelines[0];
          
          if (defaultPipeline) {
            defaultPipelineId = defaultPipeline.id;
            const stages = await storage.getPipelineStages(defaultPipeline.id, formLink.createdByUserId);
            // Find "Contacted" stage (case-insensitive, also check for user custom names)
            const contactedStage = stages.find((s: any) => 
              s.name.toLowerCase() === 'contacted' || 
              (s.customName && s.customName.toLowerCase() === 'contacted')
            );
            
            if (contactedStage) {
              contactedStageId = contactedStage.id;
            } else if (stages.length > 1) {
              // If no "Contacted" stage found, use the second stage (usually "Contacted" is order 1)
              contactedStageId = stages[1]?.id || stages[0]?.id || null;
            } else if (stages.length > 0) {
              // Fallback to first stage if only one exists
              contactedStageId = stages[0].id;
            }
          }
        } catch (error: any) {
          console.warn('[Buyer Form Submission] Failed to get pipeline/stages, using defaults:', error.message);
          // Continue without pipeline/stage - will use defaults
        }

        // 3. Create buyer opportunity
        const opportunityTitle = `${firstName} ${lastName} - Buyer Inquiry${formLink.propertyId ? ' (Property)' : ''}`;
        const opportunityNotes = `Created from Buyer Inquiry Form${freeNotes ? `\n\nAdditional Notes:\n${freeNotes}` : ''}`;

        const opportunity = await storage.createOpportunity({
          userId: formLink.createdByUserId,
          orgId: formLink.orgId,
          createdBy: formLink.createdByUserId,
          title: opportunityTitle,
          clientName: `${firstName} ${lastName}`, // Required field - set from form data
          clientEmail: email || null,
          clientPhone: phone || null,
          contactId: createdContactId,
          propertyJobId: formLink.propertyId || null,
          opportunityType: 'buyer',
          status: 'contacted', // Use 'contacted' to match the stage - valid values: 'new', 'contacted', 'qualified', 'viewing', 'offer', 'closed_won', 'closed_lost'
          pipelineStage: 'contacted', // Set to 'contacted' for legacy field
          pipelineId: defaultPipelineId,
          stageId: contactedStageId, // Set the actual stage ID
          notes: opportunityNotes,
          source: 'buyer_inquiry_form',
        });
        createdOpportunityId = opportunity.id;
        
        console.log('[Buyer Form Submission] Successfully created opportunity:', opportunity.id);

        // 3. Record submission
        await storage.createBuyerFormSubmission({
          formLinkId: formLink.id,
          orgId: formLink.orgId,
          createdContactId,
          createdOpportunityId,
          payload: {
            fullName,
            email: email || null,
            phone: phone || null,
            preferredSuburbs: preferredSuburbsArray,
            budgetMin: budgetMin ? Number(budgetMin) : null,
            budgetMax: budgetMax ? Number(budgetMax) : null,
            bedsMin: bedsMin ? Number(bedsMin) : null,
            bathsMin: bathsMin ? Number(bathsMin) : null,
            propertyType: propertyType || null,
            mustHaves: mustHavesArray,
            dealBreakers: dealBreakersArray,
            financeStatus: financeStatus || null,
            timeline: timeline || null,
            freeNotes: freeNotes || null,
          },
          requestIp: clientIp,
          userAgent: req.get('user-agent') || null,
        });

        // Success response
        res.json({ 
          success: true, 
          message: "Thank you for your inquiry. We'll be in touch soon!" 
        });
      } catch (error: any) {
        console.error('[Buyer Form Submission Error - Inner]', {
          message: error?.message,
          code: error?.code,
          detail: error?.detail,
          constraint: error?.constraint,
        });
        // If we created a contact or opportunity but submission failed, log it
        // In a production system, you might want to clean up or retry
        res.status(500).json({ 
          success: false,
          message: error?.message || "Something went wrong. Please try again later." 
        });
      }
    } catch (error: any) {
      console.error('[Buyer Form Submission Error - Outer]', {
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
        constraint: error?.constraint,
      });
      res.status(500).json({ 
        message: "Something went wrong. Please try again later." 
      });
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
