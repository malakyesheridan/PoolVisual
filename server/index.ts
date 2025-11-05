// Load environment variables first
import "./bootstrapEnv";

import express from "express";
import cors from 'cors';
import { getIronSession } from "iron-session";
import rateLimit from "express-rate-limit";
import { sessionOptions } from "./session";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite";
import { errorHandler, notFoundHandler, requestIdMiddleware } from "./lib/routeWrapper";
import { metricsHandler } from './lib/metrics';
import { SSEManager } from './lib/sseManager';
import { initSSEBus } from './lib/sseBus';
import { router as aiEnhancementRouter } from './routes/aiEnhancement';
import { processOutboxEvents } from './jobs/outboxProcessor';

// SAFE_MODE configuration
const SAFE_MODE = process.env.SAFE_MODE === '1';
const START_WORKER = process.env.START_WORKER === '1';
const PORT = Number(process.env.PORT || 3000);

console.log(`[Config] SAFE_MODE=${SAFE_MODE}, START_WORKER=${START_WORKER}`);

// Add crash handlers
process.on('uncaughtException', (e) => {
  console.error('[fatal] uncaughtException', e);
});
process.on('unhandledRejection', (e) => {
  console.error('[fatal] unhandledRejection', e);
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
// POST /api/auth/register { email, password, username }
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, username } = req.body || {};
    if (!email || !password || !username) {
      return res.status(400).json({ ok: false, error: "Email, password, and username required" });
    }

    // In no-DB mode, return a mock user for development
    if (process.env.NO_DB_MODE === 'true') {
      req.session.user = { id: 'dev-user', email: email, username: username };
      await req.session.save();
      return res.json({ ok: true, user: req.session.user });
    }

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ ok: false, error: "User with this email already exists" });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ email, password: hashedPassword, username });
    
    req.session.user = { id: user.id, email: user.email, username: user.username };
    await req.session.save();
    return res.json({ ok: true, user: req.session.user });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Registration failed" });
  }
});

// POST /api/auth/login { email, password }
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password required" });
    }

    // In no-DB mode, return a mock user for development
    if (process.env.NO_DB_MODE === 'true') {
      req.session.user = { id: 'dev-user', email: email, username: 'dev-user' };
      await req.session.save();
      return res.json({ ok: true, user: req.session.user });
    }

    const user = await storage.getUserByEmail(email);
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ ok: false, error: "Invalid email or password" });
    }

    req.session.user = { id: user.id, email: user.email, username: user.username };
    await req.session.save();
    return res.json({ ok: true, user: req.session.user });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Login failed" });
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

// Initialize server
async function initializeServer() {
  // Healthz endpoint
  app.get('/healthz', (_req, res) => res.status(200).json({ ok: true, mode: SAFE_MODE ? 'safe' : 'normal' }));
  
  // Metrics endpoint
  app.get('/metrics', metricsHandler);
  
  // AI Enhancement routes (always mount)
  app.use('/api/ai/enhancement', aiEnhancementRouter);
  
  // Wrap heavy pieces in SAFE_MODE guard
  if (!SAFE_MODE) {
    // SSE system initialization
    SSEManager.init();
    initSSEBus();
    
    // Outbox processor loop
    console.log('[Server] Starting outbox processor loop (runs every 5 seconds)');
    setInterval(() => {
      processOutboxEvents().catch((e) => console.error('[Outbox] loop error', e));
    }, 5000);
    
    // Also process immediately on startup to catch any pending events
    console.log('[Server] Processing any pending outbox events on startup...');
    processOutboxEvents().catch((e) => console.error('[Outbox] startup processing error', e));
    
    // Start worker if enabled
    if (START_WORKER) {
      console.log('[Server] Worker will be spawned by server process');
      import('./jobs/worker').then(() => {
        console.log('[Server] Worker spawned successfully');
      }).catch(err => {
        console.error('[Server] Failed to spawn worker:', err);
      });
    } else {
      console.log('[Server] Worker not started (set START_WORKER=1 to enable)');
    }
  } else {
    console.log('[SAFE_MODE] Skipping Redis, BullMQ worker, SSE bus, outbox processor');
  }
  
  // Register other routes
  await registerRoutes(app);

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

  app.get('/api/health/db', async (_req, res) => {
    try {
      await storage.getAllMaterials();
      return res.json({ ok: true, mode: 'storage' });
    } catch (error) {
      return res.status(503).json({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Database connection failed' 
      });
    }
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
      const { pool } = await import('./db');
      if (!pool) throw new Error('Pool not available');
      
      const probeResult = await pool.query(`
        SELECT
          current_database() AS db,
          current_user AS user,
          current_setting('search_path', true) AS search_path,
          version() AS version
      `);
      const tablesResult = await pool.query(`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema IN ('public')
        ORDER BY table_schema, table_name
        LIMIT 50
      `);
      res.json({ envUrl: process.env.DATABASE_URL, probe: probeResult.rows[0], tables: tablesResult.rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message, envUrl: process.env.DATABASE_URL });
    }
  });

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    serveStatic(app);
  }

  // Add 404 handler after all routes and static serving
  app.use(notFoundHandler);

  // Add centralized error handler last
  app.use(errorHandler);

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

// Initialize the server
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

// Add middleware AFTER basic setup but it will ensure initialization completes
// This middleware runs before route handlers but after routes are registered
app.use(async (req, res, next) => {
  try {
    await ensureInitialized();
    next();
  } catch (error) {
    console.error('[Server] Initialization middleware error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        ok: false, 
        error: 'Server initialization failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Start initialization immediately (non-blocking)
if (process.env.NODE_ENV !== 'production') {
  // In development, start server immediately
  initializeServer().catch(console.error);
} else {
  // In production (Vercel), start initialization immediately but don't await
  ensureInitialized().catch((error) => {
    console.error('[Server] Failed to initialize on module load:', error);
  });
}

// For Vercel: export Express app directly
export default app;