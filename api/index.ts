import { VercelRequest, VercelResponse } from '@vercel/node';
import express from "express";
import cors from 'cors';
import { getIronSession } from "iron-session";
import rateLimit from "express-rate-limit";
import { sessionOptions } from "../server/session";
import bcrypt from "bcryptjs";
import { storage } from "../server/storage";
import { registerRoutes } from "../server/routes";
import { serveStatic, log } from "../server/vite";
import { errorHandler, notFoundHandler, requestIdMiddleware } from "../server/lib/routeWrapper";

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

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Session middleware
app.use(async (req, res, next) => {
  req.session = await getIronSession(req, res, sessionOptions);
  next();
});

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

// Register other routes
registerRoutes(app);

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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  serveStatic(app);
}

// Add 404 handler after all routes and static serving
app.use(notFoundHandler);

// Add centralized error handler last
app.use(errorHandler);

// Vercel serverless function handler
export default (req: VercelRequest, res: VercelResponse) => {
  return app(req, res);
};