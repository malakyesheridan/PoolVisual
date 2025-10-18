import express from "express";
import cors from 'cors';
import path from 'path';
import fs from 'fs';

// Create Express app
const app = express();

// Add CORS middleware
app.use(cors({ origin: true, credentials: true }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    ok: true, 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Serve static files in production
const distPath = path.resolve(process.cwd(), "dist", "public");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  
  // Fall through to index.html for client-side routing
  app.use("*", (req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
} else {
  // If dist doesn't exist, serve a simple message
  app.use("*", (req, res) => {
    res.status(404).json({ 
      error: "Build files not found. Please run 'npm run build' first.",
      path: distPath 
    });
  });
}

// Export for Vercel
export default app;