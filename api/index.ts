import { VercelRequest, VercelResponse } from '@vercel/node';
import express from "express";
import cors from 'cors';
import { getIronSession } from "iron-session";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";

// Session configuration
const sessionOptions = {
  password: process.env.SESSION_SECRET || "fallback-secret-key-change-in-production",
  cookieName: "poolvisual-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

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

    // For now, return a mock user (database integration can be added later)
    req.session.user = { id: 'user-' + Date.now(), email: email, username: username };
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

    // For now, return a mock user (database integration can be added later)
    req.session.user = { id: 'user-' + Date.now(), email: email, username: 'dev-user' };
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

// Catch-all handler for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({ ok: false, error: 'Route not found' });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// Vercel serverless function handler
export default (req: VercelRequest, res: VercelResponse) => {
  return app(req, res);
};