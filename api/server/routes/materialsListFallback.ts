import type { Express } from "express";

export function registerMaterialsListFallback(app: Express) {
  // Fallback endpoint to get recent materials when other endpoints fail
  app.get('/api/_materials/last', async (req, res) => {
    try {
      // For now return empty to prevent clobbering, but this could query recent materials
      res.json({ items: [] });
    } catch (error) {
      console.error('Materials last fallback failed:', error);
      res.status(500).json({ error: 'Failed to get materials' });
    }
  });
}