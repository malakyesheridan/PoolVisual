import express from "express";
import cors from 'cors';
import path from 'path';
import { getIronSession } from "iron-session";
import rateLimit from "express-rate-limit";
import { sessionOptions } from "./session";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite";
import { errorHandler, notFoundHandler, requestIdMiddleware } from "./lib/routeWrapper";

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

// Auth routes (defined before other routes)
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
  req.session.destroy();
  res.json({ ok: true });
});

// Register all other API routes
registerRoutes(app);

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    // Test database connection
    await storage.ping();
    res.json({ 
      ok: true, 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Database connection failed' 
    });
  }
});

// Serve static files in production
serveStatic(app);

// Add 404 handler after all routes and static serving
app.use(notFoundHandler);

// Add centralized error handler last
app.use(errorHandler);

// Export for Vercel
export default app;
