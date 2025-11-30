// Load environment variables first
import "./bootstrapEnv.js";

import express from "express";
import cors from 'cors';
import { getIronSession } from "iron-session";
import rateLimit from "express-rate-limit";
import { sessionOptions } from './session.js';
import bcrypt from "bcryptjs";
import { storage } from './storage.js';
import { registerRoutes } from './routes.js';
import { serveStatic, log } from './vite.js';
import { errorHandler, notFoundHandler, requestIdMiddleware } from "./lib/routeWrapper.js";
import { metricsHandler } from './lib/metrics.js';
import { SSEManager } from './lib/sseManager.js';
import { initSSEBus } from './lib/sseBus.js';
import { router as aiEnhancementRouter } from './routes/aiEnhancement.js';
import { processOutboxEvents } from './jobs/outboxProcessor.js';

// SAFE_MODE configuration
const SAFE_MODE = process.env.SAFE_MODE === '1';
const START_WORKER = process.env.START_WORKER === '1';
const PORT = Number(process.env.PORT || 3000);

console.log(`[Config] SAFE_MODE=${SAFE_MODE}, START_WORKER=${START_WORKER}`);

// Initialize monitoring service
import { monitoringService } from './lib/monitoringService.js';
monitoringService.init().catch(err => {
  console.error('[Server] Failed to initialize monitoring:', err);
});

// Add crash handlers with Sentry
process.on('uncaughtException', (e) => {
  console.error('[fatal] uncaughtException', e);
  monitoringService.captureError(e, {
    level: 'fatal',
    tags: { type: 'uncaughtException' }
  });
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.error('[fatal] unhandledRejection', e);
  const error = e instanceof Error ? e : new Error(String(e));
  monitoringService.captureError(error, {
    level: 'fatal',
    tags: { type: 'unhandledRejection' }
  });
});

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      session: any;
    }
  }
}

// Create Express app
const app = express();

// Trust proxy for accurate IP addresses (important for Vercel/behind proxies)
app.set('trust proxy', true);

// Add CORS middleware
app.use(cors({ origin: true, credentials: true }));

// Add request ID middleware first
app.use(requestIdMiddleware);

// Body parsing with size limits (25MB for AI enhancements)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: false, limit: '25mb' }));

// Session middleware
app.use(async (req, res, next) => {
  req.session = await getIronSession(req, res, sessionOptions);
  next();
});

// Database context middleware (for RLS policies)
// NOTE: Temporarily disabled - Neon HTTP doesn't support session variables
// Routes will need to wrap storage calls with DbContext.withUserContext()
// import { setDbUserContext, clearDbUserContext } from './middleware/auth.js';
// app.use(setDbUserContext);
// app.use(clearDbUserContext);

// Dev mode: Auto-authenticate for testing (development only)
if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_AUTH === '1') {
  app.use(async (req, res, next) => {
    try {
      // Only auto-auth if no user is set and we're accessing API routes
      if (!req.session?.user && req.path.startsWith('/api')) {
        // Use the seeded test user ID from earlier
        const testUserId = '027a7c88-9d4b-4ee4-9246-c5da53a120ab';
        
        // Set a mock user for development (iron-session will auto-save)
        req.session.user = {
          id: testUserId,
          email: 'test@example.com',
          username: 'testuser'
        };
      }
    } catch (err) {
      // Ignore errors, just continue without auth
    }
    next();
  });
}

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/", authLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Auth routes
// NOTE: Registration endpoint moved to routes.ts to avoid duplication
// POST /api/auth/login { email, password }
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Email and password are required' 
      });
    }
    
    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();
    console.log('[Auth/Login] Login attempt:', {
      originalEmail: email,
      normalizedEmail,
      passwordLength: password?.length || 0
    });
    
    // In no-DB mode, return a mock user for development
    if (process.env.NO_DB_MODE === 'true') {
      req.session.user = { id: 'dev-user', email: email, username: 'dev-user' };
      await req.session.save();
      return res.json({ ok: true, user: req.session.user });
    }

    // Use enhanced authentication service
    const { EnhancedAuthService } = await import('./lib/enhancedAuthService.js');
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
    const userAgent = req.headers['user-agent'];
    
    const result = await EnhancedAuthService.login(
      normalizedEmail,
      password,
      typeof ipAddress === 'string' ? ipAddress : undefined,
      userAgent
    );

    if (!result.success) {
      const statusCode = result.lockedUntil ? 423 : 401; // 423 = Locked
      return res.status(statusCode).json({
        ok: false,
        error: result.error,
        lockedUntil: result.lockedUntil,
        remainingAttempts: result.remainingAttempts,
      });
    }

    // Get full user to check admin status
    const fullUser = await storage.getUser(result.user!.id);
    
    // Set session (include admin status)
    req.session.user = {
      id: result.user!.id,
      email: result.user!.email,
      username: result.user!.username,
      isAdmin: fullUser?.isAdmin || false,
      adminPermissions: (fullUser?.adminPermissions as string[]) || [],
    };
    await req.session.save();

    // Track session for security management
    try {
      const { parseUserAgent } = await import('./lib/deviceParser.js');
      const deviceInfo = parseUserAgent(userAgent);
      
      // Use Iron Session's internal session ID if available, otherwise generate one
      // Iron Session stores session in encrypted cookie, we'll use a hash of user + timestamp
      const sessionId = `session-${result.user!.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      await storage.createUserSession({
        userId: result.user!.id,
        sessionId,
        deviceInfo,
        ipAddress: typeof ipAddress === 'string' ? ipAddress : undefined,
        userAgent,
      });
      
      // Store session ID in session for later reference
      (req.session as any).sessionId = sessionId;
      await req.session.save();
    } catch (sessionError) {
      // Don't fail login if session tracking fails
      console.warn('[Auth/Login] Failed to track session:', sessionError);
    }

    return res.json({ ok: true, user: req.session.user });
  } catch (e: any) {
    const errorMessage = e?.message || String(e);
    const errorStack = e?.stack;
    
    console.error('[Auth/Login] Error:', errorMessage);
    if (errorStack) {
      console.error('[Auth/Login] Error stack:', errorStack);
    }
    
    // Return 500 for server errors, but preserve the actual error message
    return res.status(500).json({ 
      ok: false, 
      error: errorMessage || "Login failed",
      // Include stack in development for debugging
      ...(process.env.NODE_ENV === 'development' && errorStack ? { stack: errorStack } : {})
    });
  }
});

// GET /api/auth/me
app.get("/api/auth/me", (req, res) => {
  res.json({ ok: true, user: req.session.user || null });
});

// POST /api/auth/logout
app.post("/api/auth/logout", async (req, res) => {
  await req.session.destroy();
  res.json({ ok: true });
});

// Initialize server - register routes synchronously BEFORE export
// This ensures routes exist when Vercel loads the module
async function initializeServer() {
  // Healthz endpoint
  app.get('/healthz', async (_req, res) => {
    const { checkDatabaseHealth } = await import('./lib/dbHealth.js');
    const dbHealth = await checkDatabaseHealth();
    
    const overallStatus = dbHealth.status === 'down' ? 503 : 200;
    
    res.status(overallStatus).json({
      ok: dbHealth.status !== 'down',
      mode: SAFE_MODE ? 'safe' : 'normal',
      database: {
        status: dbHealth.status,
        latency: `${dbHealth.latency}ms`,
        timestamp: dbHealth.timestamp
      }
    });
  });
  
  // Database health check endpoint
  app.get('/api/health/db', async (_req, res) => {
    const { checkDatabaseHealth, getPoolStats } = await import('./lib/dbHealth.js');
    const dbHealth = await checkDatabaseHealth();
    const poolStats = await getPoolStats();
    
    const statusCode = dbHealth.status === 'down' ? 503 : dbHealth.status === 'degraded' ? 200 : 200;
    
    res.status(statusCode).json({
      ...dbHealth,
      pool: poolStats
    });
  });
  
  // Metrics endpoint
  app.get('/metrics', metricsHandler);
  
  // AI Enhancement routes (always mount)
  app.use('/api/ai/enhancement', aiEnhancementRouter);
  
  // Register other routes SYNCHRONOUSLY - routes must exist before export
  // CRITICAL: This must complete before 404 handler is registered
  console.log('[Server] Starting route registration...');
  try {
    await registerRoutes(app);
    console.log('[Server] Route registration completed successfully');
    
    // Verify critical routes are registered by checking Express router
    const routes: string[] = [];
    if (app._router?.stack) {
      app._router.stack.forEach((layer: any) => {
        if (layer.route) {
          const method = layer.route.stack[0]?.method?.toUpperCase() || 'UNKNOWN';
          routes.push(`${method} ${layer.route.path}`);
        }
      });
    }
    console.log('[Server] Total registered routes:', routes.length);
    const materialsRoutes = routes.filter((r: string) => r.includes('materials'));
    console.log('[Server] Materials routes found:', materialsRoutes);
    const hasV2Route = routes.some((r: string) => r.includes('/api/v2/materials'));
    console.log('[Server] /api/v2/materials route registered:', hasV2Route);
  } catch (error) {
    console.error('[Server] Failed to register routes:', error);
    console.error('[Server] Route registration error stack:', error instanceof Error ? error.stack : 'No stack');
    // Re-throw to prevent 404 handler from being registered if routes fail
    throw error;
  }

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    const mode = process.env.NO_DB_MODE === 'true' ? 'no-db' : 'db';
    res.json({
      ok: true,
      mode,
      nodeEnv: process.env.NODE_ENV || 'development',
      hotReload: 'working!'
    });
  });

  // Favicon route to prevent 404 errors
  app.get('/favicon.ico', (_req, res) => {
    res.status(204).end(); // No content response
  });

  // Diagnostics endpoints
  app.get('/api/diagnostics/env', (_req, res) => {
    res.json({
      ok: true,
      nodeEnv: process.env.NODE_ENV || 'development',
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      pvRequireDb: process.env.PV_REQUIRE_DB,
      materialFlag: process.env.VITE_PV_MATERIAL_LIBRARY_ENABLED,
    });
  });

  app.get('/api/diagnostics/db', async (_req, res) => {
    try {
      await storage.getAllMaterials();
      return res.json({ ok: true, mode: 'storage' });
    } catch (error) {
      return res.status(500).json({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Database connection failed' 
      });
    }
  });

  // Debug DB route (before 404 handler)
  app.get('/debug/db', async (_req, res) => {
    try {
      const { getSql } = await import('./db.js');
      const sql = getSql();
      if (!sql) throw new Error('Database connection not available');
      
      // Use Neon client with tagged template literals
      const probeResult = await sql`
        SELECT
          current_database() AS db,
          current_user AS user,
          current_setting('search_path', true) AS search_path,
          version() AS version
      `;
      const tablesResult = await sql`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema IN ('public')
        ORDER BY table_schema, table_name
        LIMIT 50
      `;
      res.json({ 
        envUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET', 
        probe: Array.isArray(probeResult) ? probeResult[0] : probeResult, 
        tables: Array.isArray(tablesResult) ? tablesResult : [] 
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message, envUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET' });
    }
  });

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    serveStatic(app);
  }

  // Add 404 handler after all routes and static serving
  app.use(notFoundHandler);

  // Add error handler AFTER all routes (Express requirement)
  app.use(errorHandler);

  // Wrap heavy pieces in SAFE_MODE guard
  if (!SAFE_MODE) {
    // SSE system initialization
    SSEManager.init();
    initSSEBus();
    
    // Start worker if enabled
    if (START_WORKER) {
      console.log('[Server] Worker will be spawned by server process');
      import('./jobs/worker.js').then(() => {
        console.log('[Server] Worker spawned successfully');
      }).catch(err => {
        console.error('[Server] Failed to spawn worker:', err);
      });
    } else {
      console.log('[Server] Worker not started (set START_WORKER=1 to enable)');
    }
  } else {
    console.log('[SAFE_MODE] Skipping Redis, BullMQ worker, SSE bus');
  }
  
  // Outbox processor should run if N8N_WEBHOOK_URL is set (even in SAFE_MODE)
  // It doesn't need Redis when using n8n webhooks
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  console.log('[Server] Outbox processor check:', { 
    n8nWebhookUrl: !!n8nWebhookUrl, 
    SAFE_MODE, 
    shouldStart: !!(n8nWebhookUrl || !SAFE_MODE) 
  });
  
  if (n8nWebhookUrl || !SAFE_MODE) {
    console.log('[Server] Starting outbox processor loop (runs every 5 seconds)');
    if (n8nWebhookUrl) {
      console.log('[Server] Outbox processor will use n8n webhook:', n8nWebhookUrl.substring(0, 50) + '...');
    }
    
    // Process immediately on startup to catch any pending events
    console.log('[Server] Processing any pending outbox events on startup...');
    processOutboxEvents().catch((e) => {
      console.error('[Outbox] Startup processing error:', e);
      console.error('[Outbox] Error stack:', e instanceof Error ? e.stack : 'No stack trace');
    });
    
    // Start interval loop
    setInterval(() => {
      processOutboxEvents().catch((e) => {
        console.error('[Outbox] Loop error:', e);
        console.error('[Outbox] Error stack:', e instanceof Error ? e.stack : 'No stack trace');
      });
    }, 5000);
  } else {
    console.log('[Server] Outbox processor not started (N8N_WEBHOOK_URL not set and SAFE_MODE enabled)');
  }

  // Start server in development mode
  if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
      console.log(`[server] listening on http://localhost:${PORT} (SAFE_MODE=${SAFE_MODE})`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    });
  }
  
  // Mark initialization as complete
  console.log('[Server] All routes registered, initialization complete');
}

// Initialize routes IMMEDIATELY and SYNCHRONOUSLY before export
// This ensures routes exist when Vercel loads the module
let initPromise: Promise<void> | null = null;
let isInitialized = false;

async function ensureInitialized() {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = initializeServer().then(() => {
      isInitialized = true;
      console.log('[Server] Initialization complete');
    }).catch((error) => {
      console.error('[Server] Initialization failed:', error);
      initPromise = null; // Allow retry
      throw error;
    });
  }
  return initPromise;
}

// Start initialization immediately on module load (non-blocking)
// This ensures routes begin registering as soon as possible
ensureInitialized().catch((error) => {
  console.error('[Server] Failed to initialize on module load:', error);
  console.error('[Server] Stack:', error instanceof Error ? error.stack : 'No stack');
  // Don't throw - module must export successfully
});

// CRITICAL: Add middleware that waits for initialization before handling requests
// This ensures routes exist before Express tries to match them
// According to Vercel docs, this pattern ensures async initialization completes
app.use(async (req, res, next) => {
  try {
    // Wait for initialization to complete (registers routes)
    await ensureInitialized();
    // Routes are now registered, proceed to route matching
    next();
  } catch (error) {
    console.error('[Server] Initialization middleware error:', error);
    console.error('[Server] Initialization error stack:', error instanceof Error ? error.stack : 'No stack');
    // If initialization fails, return 503 Service Unavailable
    // Don't call next(error) here - we want to send a response
    if (!res.headersSent) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Server initialization failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// For Vercel: export Express app directly
// Routes are registered via ensureInitialized() + middleware above
// The middleware ensures routes exist before requests are handled
// Error handler is registered inside initializeServer() AFTER routes
export default app;