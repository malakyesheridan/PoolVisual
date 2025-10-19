import { VercelRequest, VercelResponse } from '@vercel/node';
import express from "express";
import cors from 'cors';
import { getIronSession } from "iron-session";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import axios from 'axios';
import * as cheerio from 'cheerio';

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

// Import prefill endpoint
app.get('/api/import/prefill', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ 
        error: "Invalid URL", 
        details: "URL parameter is required" 
      });
    }

    // Simple web scraping for product data
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Extract basic product information
    const name = $('h1.product_title, .product-title, h1').first().text().trim() || 
                 $('meta[property="og:title"]').attr('content') || 
                 'Unknown Product';
    
    const price = $('.price, .woocommerce-Price-amount').first().text().trim() || 
                 $('meta[property="product:price:amount"]').attr('content') || 
                 '0.00';
    
    const sku = $('.sku, .product-sku').first().text().trim() || 
                $('meta[property="product:retailer_item_id"]').attr('content') || 
                '';
    
    const imageUrl = $('.woocommerce-product-gallery__image img, .product-image img').first().attr('src') ||
                    $('meta[property="og:image"]').attr('content') ||
                    '';

    // Determine category based on URL or content
    let category = 'waterline_tile'; // default
    if (url.includes('coping') || name.toLowerCase().includes('coping')) {
      category = 'coping';
    } else if (url.includes('paving') || name.toLowerCase().includes('paving')) {
      category = 'paving';
    } else if (url.includes('fencing') || name.toLowerCase().includes('fencing')) {
      category = 'fencing';
    } else if (url.includes('interior') || name.toLowerCase().includes('interior')) {
      category = 'interior';
    }

    // Extract dimensions from text content
    const pageText = $('body').text();
    const sizeMatch = pageText.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})\s*mm/);
    const thicknessMatch = pageText.match(/(\d{1,2})\s*mm/);
    
    const result = {
      name: name,
      sku: sku,
      price: price.replace(/[^\d.,]/g, ''),
      priceRaw: price,
      imageUrl: imageUrl,
      category: category,
      sizes: {
        ...(sizeMatch && { sheetW: parseInt(sizeMatch[1]), sheetH: parseInt(sizeMatch[2]) }),
        ...(thicknessMatch && { thickness: parseInt(thicknessMatch[1]) })
      },
      source_url: url
    };

    res.json(result);
    return;

  } catch (error) {
    console.error('Prefill error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to prefill data' 
    });
    return;
  }
});

// In-memory storage for materials (mock)
let materialsStore: any[] = [];

// Materials endpoints
app.get('/api/materials', (req, res) => {
  res.json({ materials: materialsStore });
});

app.post('/api/materials', (req, res) => {
  const material = { ...req.body, id: 'material-' + Date.now() };
  materialsStore.push(material);
  res.json({ ok: true, material });
});

app.get('/api/v2/materials', (req, res) => {
  res.json({ materials: materialsStore });
});

app.post('/api/v2/materials', (req, res) => {
  // Save new material
  const material = req.body;
  console.log('Saving material:', material);
  const savedMaterial = { ...material, id: 'material-' + Date.now() };
  materialsStore.push(savedMaterial);
  res.status(201).json(savedMaterial);
});

app.post('/api/materials/_force', (req, res) => {
  // Force save material (fallback)
  const material = req.body;
  console.log('Force saving material:', material);
  const savedMaterial = { ...material, id: 'material-' + Date.now() };
  materialsStore.push(savedMaterial);
  res.status(201).json(savedMaterial);
});

app.post('/api/materials/upload-texture-from-url', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    // For now, return a mock response
    res.json({
      textureUrl: imageUrl,
      thumbnailUrl: imageUrl,
      physicalRepeatM: 1.0
    });
    return;

  } catch (error) {
    console.error('Upload texture error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to upload texture' 
    });
    return;
  }
});

// Organization endpoints
app.get('/api/me/orgs', (req, res) => {
  res.json({ orgs: [] }); // Mock empty array for now
});

// Last materials endpoint
app.get('/api/_materials/last', (req, res) => {
  res.json({ materials: [] }); // Mock empty array for now
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