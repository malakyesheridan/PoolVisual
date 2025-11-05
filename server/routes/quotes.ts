/**
 * Quote Routes
 * 
 * Handles all quote-related API endpoints
 * Separate from main routes.ts to keep concerns separated
 */

import type { Express, Request } from "express";
import { storage } from '../storage.js';
import { quoteCalculator } from '../lib/quoteCalculator.js';
import { pdfGenerator } from '../lib/pdfGenerator.js';
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
      res.json({ message: "Quote item deleted successfully" });
    } catch (error) {
      console.error('[QuoteRoutes] Error deleting quote item:', error);
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

  // Generate PDF for quote
  app.get("/api/quotes/:id/pdf", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
    try {
      const { id } = req.params;
      const { watermark, terms, message } = req.query;
      
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

      // Generate PDF
      const pdfBuffer = await pdfGenerator.generateQuotePDF({
        quoteId: id,
        includeWatermark: watermark === 'true',
        includeTerms: terms === 'true',
        customMessage: message as string
      });

      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="quote-${id.substring(0, 8)}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[QuoteRoutes] Error generating PDF:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

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
      const { measurements } = req.body;

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

      // Find or create a draft quote for this job
      let quotes = await storage.getQuotes(job.orgId, { jobId, status: 'draft' });
      let quote;
      
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

      // Add measurements as quote items
      const addedItems = [];
      
      for (const measurement of measurements) {
        // Convert string values to numbers for calculations
        const cost = parseFloat(measurement.cost);
        const area = parseFloat(measurement.areaSquareMeters);
        
        const unitPrice = measurement.hasCostData && area > 0 
          ? (cost / area).toString()
          : '0';
          
        const itemData = {
          quoteId: quote.id,
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
            calibrationMethod: measurement.calibrationMethod
          }
        };
        
        console.log('[QuoteRoutes] Adding quote item:', JSON.stringify(itemData, null, 2));
        
        try {
          const item = await storage.addQuoteItem(itemData);
          addedItems.push(item);
        } catch (error) {
          console.error('[QuoteRoutes] Failed to add quote item:', error);
          throw new Error(`Failed to add quote item: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        message: "Measurements added to quote successfully",
        quote: await storage.getQuote(quote.id),
        addedItems,
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
