/**
 * Quote Routes
 * 
 * Handles all quote-related API endpoints
 * Separate from main routes.ts to keep concerns separated
 */

import type { Express, Request } from "express";
import { storage } from '../storage.js';
import { quoteCalculator } from '../lib/quoteCalculator.js';
// pdfGenerator is dynamically imported to avoid bundling chromium
// import { pdfGenerator } from '../lib/pdfGenerator.js';
import { emailService } from '../lib/emailService.js';
import { paymentService } from '../lib/paymentService.js';
import { insertQuoteSchema, insertQuoteItemSchema, quoteItems } from '../../shared/schema.js';
import { z } from 'zod';

// Define extended request interface
interface AuthenticatedRequest extends Request {
  user?: any;
  orgId?: string;
}

// Middleware to verify session authentication
const authenticateSession = async (req: AuthenticatedRequest, res: any, next: any) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    req.user = { id: req.session.user.id };
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error verifying authentication' });
  }
};

// Middleware to verify organization access
const verifyOrgAccess = async (req: AuthenticatedRequest, res: any, next: any) => {
  try {
    const { orgId } = req.params;
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
    res.status(500).json({ message: 'Error verifying organization access' });
  }
};

export function registerQuoteRoutes(app: Express): void {
  console.log('🔧 Registering quote routes...');

  // Get quote by ID
  app.get("/api/quotes/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      
      console.log('[QuoteRoutes] GET /api/quotes/:id', { id });
      
      if (!id) {
        return res.status(400).json({ message: "Quote ID is required" });
      }

      // Verify quote access
      const quote = await storage.getQuote(id);
      if (!quote) {
        console.log('[QuoteRoutes] Quote not found:', id);
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

      const items = await storage.getQuoteItems(quote.id);
      console.log('[QuoteRoutes] Returning quote with', items.length, 'items');
      res.json({ ...quote, items });
    } catch (error) {
      console.error('[QuoteRoutes] Error getting quote:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Generate quote from job mask data
  app.post("/api/quotes/generate-from-job/:jobId", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { jobId } = req.params;
      
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

      // Generate quote from mask data
      const { quote, items } = await quoteCalculator.createQuoteFromJob(jobId);

      res.json({
        message: "Quote generated successfully",
        quote,
        items
      });
    } catch (error) {
      console.error('[QuoteRoutes] Error generating quote from job:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Get quote items
  app.get("/api/quotes/:id/items", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      
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

      const items = await storage.getQuoteItems(id);
      res.json(items);
    } catch (error) {
      console.error('[QuoteRoutes] Error getting quote items:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Add quote item
  app.post("/api/quotes/:id/items", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      
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

      const itemData = insertQuoteItemSchema.parse({
        ...req.body,
        quoteId: id
      });

      const item = await storage.addQuoteItem(itemData);
      
      // Invalidate PDF cache after adding item
      const { pdfGenerator } = await import('../lib/pdfGenerator.js');
      await pdfGenerator.invalidateCache(id).catch(err => {
        console.warn('[QuoteRoutes] Failed to invalidate PDF cache:', err);
      });
      
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error('[QuoteRoutes] Error adding quote item:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Update quote item
  app.put("/api/quotes/:id/items/:itemId", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id, itemId } = req.params;
      
      if (!id || !itemId) {
        return res.status(400).json({ message: "Quote ID and Item ID are required" });
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

      // Update quote item
      const updatedItem = await storage.updateQuoteItem(itemId, req.body);
      
      // Invalidate PDF cache after updating item
      const { pdfGenerator } = await import('../lib/pdfGenerator.js');
      await pdfGenerator.invalidateCache(id).catch(err => {
        console.warn('[QuoteRoutes] Failed to invalidate PDF cache:', err);
      });
      
      res.json(updatedItem);
    } catch (error) {
      console.error('[QuoteRoutes] Error updating quote item:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Delete quote item
  app.delete("/api/quotes/:id/items/:itemId", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id, itemId } = req.params;
      
      if (!id || !itemId) {
        return res.status(400).json({ message: "Quote ID and Item ID are required" });
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

      // Delete quote item
      await storage.deleteQuoteItem(itemId);
      
      // Invalidate PDF cache after deleting item
      const { pdfGenerator } = await import('../lib/pdfGenerator.js');
      await pdfGenerator.invalidateCache(id).catch(err => {
        console.warn('[QuoteRoutes] Failed to invalidate PDF cache:', err);
      });
      
      res.json({ message: "Quote item deleted successfully" });
    } catch (error) {
      console.error('[QuoteRoutes] Error deleting quote item:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Delete quote
  app.delete("/api/quotes/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      
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

      // Delete quote (this will also delete all quote items)
      await storage.deleteQuote(id);
      res.json({ message: "Quote deleted successfully" });
    } catch (error) {
      console.error('[QuoteRoutes] Error deleting quote:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Update quote
  app.patch("/api/quotes/:id", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      
      console.log('[QuoteRoutes] PATCH /api/quotes/:id', { id, body: req.body });
      
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
      console.log('[QuoteRoutes] Updating quote with:', req.body);
      const updatedQuote = await storage.updateQuote(id, req.body);
      console.log('[QuoteRoutes] Quote updated successfully:', updatedQuote);
      
      // Invalidate PDF cache after update
      const { pdfGenerator } = await import('../lib/pdfGenerator.js');
      await pdfGenerator.invalidateCache(id).catch(err => {
        console.warn('[QuoteRoutes] Failed to invalidate PDF cache:', err);
      });
      
      res.json(updatedQuote);
    } catch (error) {
      console.error('[QuoteRoutes] Error updating quote:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Recalculate quote totals
  app.post("/api/quotes/:id/recalculate", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      
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

      // Get current quote items
      const items = await storage.getQuoteItems(id);
      
      // Convert to QuoteItemData format for calculation
      const quoteItemData = items.map(item => ({
        kind: item.kind as 'material' | 'labor' | 'adjustment',
        materialId: item.materialId || undefined,
        description: item.description,
        unit: item.unit || '',
        qty: item.qty ? parseFloat(item.qty) : 0,
        unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : 0,
        lineTotal: item.lineTotal ? parseFloat(item.lineTotal) : 0,
        calcMetaJson: item.calcMetaJson
      }));

      // Calculate new totals
      const totals = await quoteCalculator.calculateQuoteTotals(quoteItemData, job.orgId);

      // Update quote with new totals
      const updatedQuote = await storage.updateQuote(id, {
        subtotal: totals.subtotal.toString(),
        gst: totals.gst.toString(),
        total: totals.total.toString()
      });

      // Invalidate PDF cache after recalculation
      const { pdfGenerator } = await import('../lib/pdfGenerator.js');
      await pdfGenerator.invalidateCache(id).catch(err => {
        console.warn('[QuoteRoutes] Failed to invalidate PDF cache:', err);
      });

      res.json({
        message: "Quote recalculated successfully",
        quote: updatedQuote,
        totals
      });
    } catch (error) {
      console.error('[QuoteRoutes] Error recalculating quote:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Send quote
  app.post("/api/quotes/:id/send", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      const { clientEmail, customMessage } = req.body;
      
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

      // Send quote email
      await emailService.sendQuoteEmail(id, clientEmail, customMessage);

      res.json({
        message: "Quote sent successfully",
        quote: await storage.getQuote(id)
      });
    } catch (error) {
      console.error('[QuoteRoutes] Error sending quote:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Accept quote (create payment intent)
  app.post("/api/quotes/:id/accept", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      const { clientEmail } = req.body;
      
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

      // Create payment intent
      const paymentData = await paymentService.createPaymentIntent(id, clientEmail);

      res.json({
        message: "Payment intent created successfully",
        clientSecret: paymentData.clientSecret,
        amount: paymentData.amount,
        currency: paymentData.currency
      });
    } catch (error) {
      console.error('[QuoteRoutes] Error accepting quote:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // PDF generation is handled by separate Vercel serverless function at /api/quotes/:id/pdf
  // This prevents chromium from being bundled into the main serverless function

  // Preview PDF (returns PDF as base64 for preview)
  app.get("/api/quotes/:id/pdf-preview", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      
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

      // Dynamically import PDF generator to avoid bundling chromium
      const { pdfGenerator } = await import('../lib/pdfGenerator.js');
      
      // Generate PDF with watermark for preview
      const pdfBuffer = await pdfGenerator.generateQuotePDF({
        quoteId: id,
        includeWatermark: true,
        includeTerms: true
      });

      // Return as base64 for preview
      const base64PDF = pdfBuffer.toString('base64');
      res.json({ 
        pdf: base64PDF,
        filename: `quote-${id.substring(0, 8)}.pdf`
      });
    } catch (error) {
      console.error('[QuoteRoutes] Error generating PDF preview:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Canvas-Quote Integration: Add measurements to quote
  app.post("/api/quotes/add-measurements/:jobId", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { jobId } = req.params;
      const { measurements, quoteId } = req.body;

      if (!jobId) {
        return res.status(400).json({ message: "Job ID is required" });
      }

      if (!measurements || !Array.isArray(measurements)) {
        return res.status(400).json({ message: "Measurements array is required" });
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

      // If quoteId is provided, use it; otherwise find or create a draft quote
      let quote;
      
      if (quoteId) {
        // Verify quote exists and belongs to this job
        quote = await storage.getQuote(quoteId);
        if (!quote) {
          return res.status(404).json({ message: "Quote not found" });
        }
        if (quote.jobId !== jobId) {
          return res.status(400).json({ message: "Quote does not belong to this job" });
        }
      } else {
        // Find or create a draft quote for this job
        let quotes = await storage.getQuotes(job.orgId, { jobId, status: 'draft' });
        
        if (!quotes || quotes.length === 0) {
          // Create new draft quote
          quote = await storage.createQuote({
            jobId: jobId,
            status: 'draft',
            subtotal: '0',
            gst: '0',
            total: '0',
            depositPct: '0.30',
            validityDays: 30
          });
        } else {
          quote = quotes[0];
        }
      }

      // Get existing quote items to check for duplicates
      const existingItems = await storage.getQuoteItems(quote.id);
      
      // DEBUG: Log all existing items and their calcMetaJson structure
      console.log('[QuoteRoutes] Existing quote items:', existingItems.length);
      existingItems.forEach((item, idx) => {
        console.log(`[QuoteRoutes] Item ${idx + 1}:`, {
          id: item.id,
          description: item.description,
          calcMetaJsonType: typeof item.calcMetaJson,
          calcMetaJson: JSON.stringify(item.calcMetaJson),
          hasCalcMetaJson: !!item.calcMetaJson
        });
      });
      
      // DEBUG: Log incoming measurements
      console.log('[QuoteRoutes] Incoming measurements:', measurements.length);
      measurements.forEach((m, idx) => {
        console.log(`[QuoteRoutes] Measurement ${idx + 1}:`, {
          maskId: m.maskId,
          maskName: m.maskName,
          materialId: m.materialId,
          areaSquareMeters: m.areaSquareMeters
        });
      });
      
      // Add measurements as quote items (update existing or create new)
      const addedItems = [];
      const updatedItems = [];
      
      for (const measurement of measurements) {
        // Convert string values to numbers for calculations
        const cost = parseFloat(measurement.cost);
        const area = parseFloat(measurement.areaSquareMeters);
        
        const unitPrice = measurement.hasCostData && area > 0 
          ? (cost / area).toString()
          : '0';
        
        // Check if an item already exists for this maskId
        // Handle both JSONB object and parsed JSON cases
        let existingItem: any = null;
        let matchDetails: any = null;
        let matchMethod: 'maskId' | 'description' | null = null;
        
        // Strategy 1: Match by maskId (primary method)
        for (const item of existingItems) {
          const meta = item.calcMetaJson;
          if (!meta) continue;
          
          // Handle case where calcMetaJson might be a string (JSONB from DB)
          let parsedMeta: any;
          try {
            parsedMeta = typeof meta === 'string' ? JSON.parse(meta) : meta;
          } catch (e) {
            console.warn('[QuoteRoutes] Failed to parse calcMetaJson for item:', item.id, e);
            continue;
          }
          
          const isCanvasSource = parsedMeta?.source === 'canvas';
          if (!isCanvasSource) continue;
          
          const existingMaskId = parsedMeta?.maskId;
          const newMaskId = measurement.maskId;
          
          // Normalize both IDs to strings for comparison
          const existingMaskIdStr = existingMaskId ? String(existingMaskId).trim() : '';
          const newMaskIdStr = newMaskId ? String(newMaskId).trim() : '';
          
          const maskIdMatches = existingMaskIdStr === newMaskIdStr && existingMaskIdStr !== '';
          
          console.log('[QuoteRoutes] Comparing by maskId:', {
            itemId: item.id,
            itemDescription: item.description,
            existingMaskId: existingMaskIdStr,
            newMaskId: newMaskIdStr,
            existingMaskIdType: typeof existingMaskId,
            newMaskIdType: typeof newMaskId,
            maskIdMatches,
            parsedMetaKeys: Object.keys(parsedMeta || {})
          });
          
          if (maskIdMatches) {
            existingItem = item;
            matchMethod = 'maskId';
            matchDetails = {
              itemId: item.id,
              existingMaskId: existingMaskIdStr,
              newMaskId: newMaskIdStr,
              method: 'maskId'
            };
            break;
          }
        }
        
        // Strategy 2: Fallback - Match by description pattern and materialId
        // This handles cases where maskId might not be stored or has changed
        if (!existingItem) {
          const expectedDescription = `${measurement.materialName} - ${measurement.maskName}`;
          console.log('[QuoteRoutes] Trying fallback match by description:', {
            expectedDescription,
            materialId: measurement.materialId
          });
          
          for (const item of existingItems) {
            // Match by description pattern and materialId
            const descriptionMatches = item.description === expectedDescription || 
                                      item.description?.includes(measurement.maskName);
            const materialMatches = item.materialId === measurement.materialId;
            
            // Check if it's a canvas source item
            const meta = item.calcMetaJson;
            let isCanvasSource = false;
            if (meta) {
              try {
                const parsedMeta = typeof meta === 'string' ? JSON.parse(meta) : meta;
                isCanvasSource = parsedMeta?.source === 'canvas';
              } catch (e) {
                // Ignore parse errors
              }
            }
            
            if (descriptionMatches && materialMatches && isCanvasSource) {
              console.log('[QuoteRoutes] ✅ FOUND FALLBACK MATCH by description:', {
                itemId: item.id,
                itemDescription: item.description,
                expectedDescription,
                materialId: item.materialId
              });
              existingItem = item;
              matchMethod = 'description';
              matchDetails = {
                itemId: item.id,
                method: 'description',
                description: item.description,
                expectedDescription
              };
              break;
            }
          }
        }
        
        const itemData = {
          kind: 'material' as const,
          materialId: measurement.materialId,
          description: `${measurement.materialName} - ${measurement.maskName}`,
          unit: 'm²',
          qty: area.toString(),
          unitPrice: unitPrice,
          lineTotal: cost.toString(),
          calcMetaJson: {
            source: 'canvas',
            maskId: measurement.maskId,
            maskName: measurement.maskName,
            areaM2: area,
            calibrationData: measurement.calibrationData,
            confidence: measurement.confidence,
            calibrationMethod: measurement.calibrationMethod,
            lastUpdated: new Date().toISOString()
          }
        };
        
        try {
          if (existingItem) {
            // Update existing item
            console.log('[QuoteRoutes] ✅ FOUND MATCH - Updating existing quote item:', {
              itemId: existingItem.id,
              maskId: measurement.maskId,
              matchMethod,
              matchDetails,
              oldQty: existingItem.qty,
              newQty: area.toString(),
              oldTotal: existingItem.lineTotal,
              newTotal: cost.toString(),
              oldDescription: existingItem.description,
              newDescription: itemData.description
            });
            
            // Ensure maskId is in calcMetaJson when updating (in case it was missing)
            const finalItemData = {
              ...itemData,
              calcMetaJson: {
                ...itemData.calcMetaJson,
                maskId: measurement.maskId, // Ensure maskId is always present
                maskName: measurement.maskName
              }
            };
            
            const updatedItem = await storage.updateQuoteItem(existingItem.id, finalItemData);
            console.log('[QuoteRoutes] ✅ Successfully updated item:', updatedItem.id);
            updatedItems.push(updatedItem);
            addedItems.push(updatedItem); // Include in addedItems for response
          } else {
            // Create new item
            console.log('[QuoteRoutes] ❌ NO MATCH FOUND - Creating new quote item for maskId:', measurement.maskId, {
              totalExistingItems: existingItems.length,
              canvasItems: existingItems.filter(i => {
                try {
                  const meta = typeof i.calcMetaJson === 'string' ? JSON.parse(i.calcMetaJson) : i.calcMetaJson;
                  return meta?.source === 'canvas';
                } catch {
                  return false;
                }
              }).length,
              searchingForMaskId: measurement.maskId,
              allExistingMaskIds: existingItems.map(i => {
                try {
                  const meta = typeof i.calcMetaJson === 'string' ? JSON.parse(i.calcMetaJson) : i.calcMetaJson;
                  return meta?.source === 'canvas' ? meta?.maskId : null;
                } catch {
                  return null;
                }
              }).filter(Boolean)
            });
            const newItem = await storage.addQuoteItem({
              ...itemData,
              quoteId: quote.id
            });
            addedItems.push(newItem);
          }
        } catch (error) {
          console.error('[QuoteRoutes] Failed to process quote item:', error);
          throw new Error(`Failed to process quote item: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Recalculate quote totals
      const items = await storage.getQuoteItems(quote.id);
      const subtotal = items.reduce((sum, item) => sum + parseFloat(item.lineTotal || '0'), 0);
      const taxRate = 0.1; // 10% GST - should come from org settings
      const gst = subtotal * taxRate;
      const total = subtotal + gst;

      await storage.updateQuote(quote.id, {
        subtotal: subtotal.toString(),
        gst: gst.toString(),
        total: total.toString()
      });

      res.json({
        message: updatedItems.length > 0 
          ? `Measurements updated in quote successfully (${updatedItems.length} updated, ${addedItems.length - updatedItems.length} new)`
          : "Measurements added to quote successfully",
        quote: await storage.getQuote(quote.id),
        addedItems,
        updatedItems,
        totals: { subtotal, gst, total }
      });
    } catch (error) {
      console.error('[QuoteRoutes] Error adding measurements to quote:', error);
      
      // Ensure we only send safe error messages to the client
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      res.status(500).json({ 
        message: errorMessage,
        error: 'INTERNAL_SERVER_ERROR'
      });
    }
  });

  // Canvas-Quote Integration: Update quote item from canvas
  app.put("/api/quotes/:quoteId/items/:itemId/update-from-canvas", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { quoteId, itemId } = req.params;
      const { measurementData } = req.body;

      // Verify quote access
      const quote = await storage.getQuote(quoteId);
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

      // Update the quote item with new measurement data
      const unitPrice = measurementData.hasCostData && measurementData.areaSquareMeters > 0 
        ? (measurementData.cost / measurementData.areaSquareMeters).toString()
        : '0';
        
      const updatedItem = await storage.updateQuoteItem(itemId, {
        qty: measurementData.areaSquareMeters.toString(),
        unitPrice: unitPrice,
        lineTotal: measurementData.cost.toString(),
        calcMetaJson: {
          ...measurementData,
          source: 'canvas',
          lastUpdated: new Date().toISOString()
        }
      });

      // Recalculate quote totals
      const items = await storage.getQuoteItems(quoteId);
      const subtotal = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
      const taxRate = 0.1; // 10% GST
      const gst = subtotal * taxRate;
      const total = subtotal + gst;

      await storage.updateQuote(quoteId, {
        subtotal: subtotal.toString(),
        gst: gst.toString(),
        total: total.toString()
      });

      res.json({
        message: "Quote item updated from canvas",
        item: updatedItem,
        totals: { subtotal, gst, total }
      });
    } catch (error) {
      console.error('[QuoteRoutes] Error updating quote item from canvas:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Canvas-Quote Integration: Get quote items with source information
  app.get("/api/quotes/:id/items-with-sources", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      
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

      const items = await storage.getQuoteItems(id);
      
      // Categorize items by source
      const categorizedItems = {
        canvas: items.filter(item => item.calcMetaJson?.source === 'canvas'),
        manual: items.filter(item => item.calcMetaJson?.source === 'manual' || !item.calcMetaJson?.source),
        total: items.length
      };

      res.json({
        items,
        categorizedItems,
        summary: {
          totalItems: items.length,
          canvasItems: categorizedItems.canvas.length,
          manualItems: categorizedItems.manual.length,
          totalValue: items.reduce((sum, item) => sum + (item.lineTotal || 0), 0)
        }
      });
    } catch (error) {
      console.error('[QuoteRoutes] Error getting quote items with sources:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });
}
