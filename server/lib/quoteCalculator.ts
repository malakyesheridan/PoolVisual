/**
 * Quote Calculator Service
 * 
 * Bridges mask data from the canvas editor to quote calculations
 * Leverages existing calculation utilities from the frontend
 */

import { storage } from '../storage.js';
import { eq, and } from 'drizzle-orm';
import { masks, materials, photos, jobs, quotes, quoteItems } from '../../shared/schema.js';
import type { Mask, Material, Photo, Job, Quote, QuoteItem } from '../../shared/schema.js';

export interface MaskCalculationData {
  maskId: string;
  photoId: string;
  type: 'area' | 'linear' | 'waterline_band';
  points: Array<{ x: number; y: number }>;
  materialId?: string;
  areaM2?: number;
  perimeterM?: number;
  calibrationData?: {
    pixelsPerMeter: number;
    confidence: 'high' | 'medium' | 'low';
  };
}

export interface MaterialCost {
  materialId: string;
  materialName: string;
  areaM2: number;
  unitPrice: number;
  lineTotal: number;
  hasCostData: boolean;
}

export interface QuoteItemData {
  kind: 'material' | 'labor' | 'adjustment';
  materialId?: string;
  description: string;
  unit: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  calcMetaJson?: any;
}

export class QuoteCalculator {
  /**
   * Extract mask data from all photos in a job
   */
  async extractMaskData(jobId: string): Promise<MaskCalculationData[]> {
    try {
      // Get all photos for the job
      const jobPhotos = await storage.getJobPhotos(jobId);
      
      const allMaskData: MaskCalculationData[] = [];
      
      for (const photo of jobPhotos) {
        // Get masks for this photo
        const photoMasks = await storage.getMasksByPhoto(photo.id);
        
        for (const mask of photoMasks) {
          // Parse the path JSON to get points
          const pathData = mask.pathJson as any;
          const points = pathData?.points || [];
          
          // Get calibration data from photo
          const calibrationData = await storage.getPhotoCalibration(photo.id);
          
          allMaskData.push({
            maskId: mask.id,
            photoId: photo.id,
            type: mask.type as 'area' | 'linear' | 'waterline_band',
            points: points.map((p: any) => ({ x: p.x, y: p.y })),
            materialId: mask.materialId || undefined,
            areaM2: mask.areaM2 ? parseFloat(mask.areaM2) : undefined,
            perimeterM: mask.perimeterM ? parseFloat(mask.perimeterM) : undefined,
            calibrationData: calibrationData ? {
              pixelsPerMeter: calibrationData.ppm,
              confidence: 'medium' // Default confidence
            } : undefined
          });
        }
      }
      
      return allMaskData;
    } catch (error) {
      console.error('[QuoteCalculator] Error extracting mask data:', error);
      throw new Error('Failed to extract mask data from job');
    }
  }

  /**
   * Calculate material cost for a mask
   */
  async calculateMaterialCost(maskData: MaskCalculationData): Promise<MaterialCost | null> {
    try {
      if (!maskData.materialId || !maskData.areaM2) {
        return null;
      }

      // Get material details
      const material = await storage.getMaterial(maskData.materialId);
      if (!material) {
        return null;
      }

      const unitPrice = material.price ? parseFloat(material.price) : 0;
      const lineTotal = maskData.areaM2 * unitPrice;

      return {
        materialId: material.id,
        materialName: material.name,
        areaM2: maskData.areaM2,
        unitPrice,
        lineTotal,
        hasCostData: unitPrice > 0
      };
    } catch (error) {
      console.error('[QuoteCalculator] Error calculating material cost:', error);
      return null;
    }
  }

  /**
   * Generate quote items from mask data
   */
  async generateQuoteItems(jobId: string): Promise<QuoteItemData[]> {
    try {
      const maskData = await this.extractMaskData(jobId);
      const quoteItems: QuoteItemData[] = [];

      // Group masks by material for consolidation
      const materialGroups = new Map<string, MaskCalculationData[]>();
      
      for (const mask of maskData) {
        if (mask.materialId && mask.areaM2) {
          if (!materialGroups.has(mask.materialId)) {
            materialGroups.set(mask.materialId, []);
          }
          materialGroups.get(mask.materialId)!.push(mask);
        }
      }

      // Create quote items for each material group
      for (const [materialId, masks] of materialGroups) {
        const materialCost = await this.calculateMaterialCost(masks[0]);
        if (!materialCost) continue;

        // Calculate totals for this material
        const totalArea = masks.reduce((sum, mask) => sum + (mask.areaM2 || 0), 0);
        const totalCost = totalArea * materialCost.unitPrice;

        quoteItems.push({
          kind: 'material',
          materialId: materialId,
          description: `${materialCost.materialName} - Pool Surface`,
          unit: 'm²',
          qty: totalArea,
          unitPrice: materialCost.unitPrice,
          lineTotal: totalCost,
          calcMetaJson: {
            maskCount: masks.length,
            maskIds: masks.map(m => m.maskId),
            calculationMethod: 'area_based',
            generatedAt: new Date().toISOString()
          }
        });
      }

      return quoteItems;
    } catch (error) {
      console.error('[QuoteCalculator] Error generating quote items:', error);
      throw new Error('Failed to generate quote items from mask data');
    }
  }

  /**
   * Calculate quote totals including tax
   */
  async calculateQuoteTotals(quoteItems: QuoteItemData[], orgId: string): Promise<{
    subtotal: number;
    gst: number;
    total: number;
    depositAmount: number;
  }> {
    try {
      // Get organization settings for tax rate and deposit percentage
      const settings = await storage.getOrgSettings(orgId);
      const taxRate = settings?.taxRate ? parseFloat(settings.taxRate) : 0.10; // Default 10% GST
      const depositPct = settings?.depositDefaultPct ? parseFloat(settings.depositDefaultPct) : 0.30; // Default 30%

      const subtotal = quoteItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const gst = subtotal * taxRate;
      const total = subtotal + gst;
      const depositAmount = total * depositPct;

      return {
        subtotal,
        gst,
        total,
        depositAmount
      };
    } catch (error) {
      console.error('[QuoteCalculator] Error calculating quote totals:', error);
      throw new Error('Failed to calculate quote totals');
    }
  }

  /**
   * Create a complete quote from job mask data
   */
  async createQuoteFromJob(jobId: string): Promise<{
    quote: Quote;
    items: QuoteItem[];
  }> {
    try {
      // Get job details
      const job = await storage.getJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      // Generate quote items from mask data
      const quoteItemData = await this.generateQuoteItems(jobId);
      
      // Calculate totals
      const totals = await this.calculateQuoteTotals(quoteItemData, job.orgId);

      // Create quote record
      const quote = await storage.createQuote({
        jobId: jobId,
        status: 'draft',
        subtotal: totals.subtotal.toString(),
        gst: totals.gst.toString(),
        total: totals.total.toString(),
        depositPct: '0.30', // Default 30% deposit
        validityDays: 30
      });

      // Create quote item records
      const items: QuoteItem[] = [];
      for (const itemData of quoteItemData) {
        const item = await storage.addQuoteItem({
          quoteId: quote.id,
          kind: itemData.kind,
          materialId: itemData.materialId,
          description: itemData.description,
          unit: itemData.unit,
          qty: itemData.qty.toString(),
          unitPrice: itemData.unitPrice.toString(),
          lineTotal: itemData.lineTotal.toString(),
          calcMetaJson: itemData.calcMetaJson
        });
        items.push(item);
      }

      return { quote, items };
    } catch (error) {
      console.error('[QuoteCalculator] Error creating quote from job:', error);
      throw new Error('Failed to create quote from job data');
    }
  }
}

export const quoteCalculator = new QuoteCalculator();
