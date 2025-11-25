/**
 * PDF Generation Service
 * 
 * Professional PDF generation for quotes using Puppeteer
 * Integrates with existing quote data and organization branding
 * 
 * Uses @sparticuz/chromium for Vercel serverless compatibility
 */

// Use puppeteer-core for production (with @sparticuz/chromium) and regular puppeteer for development
// Import dynamically to avoid bundling chromium in serverless functions
import { storage } from '../storage.js';
import { Quote, QuoteItem, Org, Settings } from '../../shared/schema.js';
import { CacheService } from './cacheService.js';
import { browserPool } from './browserPool.js';
import { withRetry } from '../utils/retry.js';
import crypto from 'crypto';

export interface PDFGenerationOptions {
  quoteId: string;
  includeWatermark?: boolean;
  includeTerms?: boolean;
  customMessage?: string;
}

export interface PDFData {
  quote: Quote;
  items: QuoteItem[];
  organization: Org;
  settings: Settings;
  totals: {
    subtotal: number;
    gst: number;
    total: number;
    depositAmount: number;
  };
}

export class PDFGenerator {
  private cacheService: CacheService;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly BROWSER_TIMEOUT = 30000; // 30 seconds
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    generationTime: [] as number[],
    errors: 0
  };

  constructor() {
    this.cacheService = new CacheService({
      defaultTTL: this.CACHE_TTL,
      keyPrefix: 'pdf:quote:'
    });
  }

  /**
   * Generate cache key for PDF
   */
  private getCacheKey(quoteId: string, options: PDFGenerationOptions): string {
    const optionsHash = crypto
      .createHash('md5')
      .update(JSON.stringify({
        watermark: options.includeWatermark,
        terms: options.includeTerms,
        message: options.customMessage
      }))
      .digest('hex')
      .substring(0, 8);
    
    return `${quoteId}:${optionsHash}`;
  }

  /**
   * Get quote version for cache invalidation
   */
  private async getQuoteVersion(quoteId: string): Promise<string> {
    const quote = await storage.getQuote(quoteId);
    if (!quote) throw new Error('Quote not found');
    
    // Use updatedAt timestamp as version
    return new Date(quote.updatedAt).getTime().toString();
  }

  /**
   * Generate PDF with caching
   */
  async generateQuotePDFWithCache(options: PDFGenerationOptions): Promise<Buffer> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(options.quoteId, options);
    const versionKey = `version:${options.quoteId}`;
    
    try {
      // Check cache
      const cachedVersion = await this.cacheService.get<string>(versionKey);
      const currentVersion = await this.getQuoteVersion(options.quoteId);
      
      // If version matches, try to get cached PDF
      if (cachedVersion === currentVersion) {
        const cachedPDFBase64 = await this.cacheService.get<string>(cacheKey, {
          serialize: false // PDF is stored as base64 string
        });
        
        if (cachedPDFBase64) {
          console.log(`[PDFGenerator] Cache hit for quote ${options.quoteId}`);
          this.metrics.cacheHits++;
          const generationTime = Date.now() - startTime;
          this.metrics.generationTime.push(generationTime);
          return Buffer.from(cachedPDFBase64, 'base64');
        }
      }
      
      // Cache miss or version mismatch - generate new PDF with retry
      console.log(`[PDFGenerator] Cache miss for quote ${options.quoteId}, generating...`);
      this.metrics.cacheMisses++;
      const pdfBuffer = await withRetry(
        () => this.generateQuotePDFWithTimeout(options),
        {
          maxRetries: 2,
          delay: 1000, // 1 second initial delay
          retryable: (error) => {
            // Retry on timeout or connection errors
            return error.message.includes('timeout') ||
                   error.message.includes('ECONNREFUSED') ||
                   error.message.includes('browser') ||
                   error.message.includes('disconnected');
          },
          onRetry: (attempt, error) => {
            console.warn(`[PDFGenerator] Retry attempt ${attempt} for quote ${options.quoteId}:`, error.message);
          }
        }
      );
      
      // Cache the PDF as base64
      const pdfBase64 = pdfBuffer.toString('base64');
      await Promise.all([
        this.cacheService.set(cacheKey, pdfBase64, {
          ttl: this.CACHE_TTL,
          serialize: false
        }),
        this.cacheService.set(versionKey, currentVersion, {
          ttl: this.CACHE_TTL * 24 // Keep version for 24 hours
        })
      ]);
      
      const generationTime = Date.now() - startTime;
      this.metrics.generationTime.push(generationTime);
      
      // Keep only last 100 measurements
      if (this.metrics.generationTime.length > 100) {
        this.metrics.generationTime.shift();
      }
      
      return pdfBuffer;
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Generate PDF with timeout protection
   */
  private async generateQuotePDFWithTimeout(options: PDFGenerationOptions): Promise<Buffer> {
    return Promise.race([
      this.generateQuotePDF(options),
      new Promise<Buffer>((_, reject) => {
        setTimeout(() => {
          reject(new Error('PDF generation timeout after 30 seconds'));
        }, this.BROWSER_TIMEOUT);
      })
    ]);
  }

  /**
   * Invalidate cache for a quote (call when quote is updated)
   */
  async invalidateCache(quoteId: string): Promise<void> {
    // Delete version key to force cache miss on next request
    await this.cacheService.delete(`version:${quoteId}`);
    console.log(`[PDFGenerator] Cache invalidated for quote ${quoteId}`);
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics() {
    const avgTime = this.metrics.generationTime.length > 0
      ? this.metrics.generationTime.reduce((a, b) => a + b, 0) / this.metrics.generationTime.length
      : 0;
    
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = total > 0 ? this.metrics.cacheHits / total : 0;
    
    return {
      ...this.metrics,
      averageGenerationTime: avgTime,
      cacheHitRate: cacheHitRate
    };
  }

  // Legacy methods for backward compatibility (now use browser pool)
  async initialize(): Promise<void> {
    // Browser pool handles initialization automatically
    // This method is kept for backward compatibility
  }

  async cleanup(): Promise<void> {
    // Browser pool handles cleanup automatically
    // This method is kept for backward compatibility
  }

  async generateQuotePDF(options: PDFGenerationOptions): Promise<Buffer> {
    const browser = await browserPool.getBrowser();
    
    try {
      const page = await browser.newPage();
      
      try {
        // Gather all required data
        const pdfData = await this.gatherPDFData(options.quoteId);
        
        // Generate HTML content
        const htmlContent = this.generateHTML(pdfData, options);
        
        // Set content and generate PDF with timeout
        await page.setContent(htmlContent, { 
          waitUntil: 'networkidle0',
          timeout: 20000 // 20 second timeout for page load
        });
        
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm'
          },
          timeout: 10000 // 10 second timeout for PDF generation
        });

        return pdfBuffer;
      } finally {
        await page.close();
      }
    } finally {
      await browserPool.releaseBrowser(browser);
    }
  }

  private async gatherPDFData(quoteId: string): Promise<PDFData> {
    const quote = await storage.getQuote(quoteId);
    if (!quote) {
      throw new Error('Quote not found');
    }

    const items = await storage.getQuoteItems(quoteId);
    const job = await storage.getJob(quote.jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    const organization = await storage.getOrg(job.orgId);
    if (!organization) {
      throw new Error('Organization not found');
    }

    const settings = await storage.getOrgSettings(job.orgId);
    if (!settings) {
      throw new Error('Organization settings not found');
    }

    // Calculate totals
    const subtotal = parseFloat(quote.subtotal);
    const gst = parseFloat(quote.gst);
    const total = parseFloat(quote.total);
    const depositPct = parseFloat(quote.depositPct);
    const depositAmount = total * depositPct;

    return {
      quote,
      items,
      organization,
      settings,
      totals: { subtotal, gst, total, depositAmount }
    };
  }

  private generateHTML(data: PDFData, options: PDFGenerationOptions): string {
    const { quote, items, organization, settings, totals } = data;
    
    // Extract branding colors from organization (with defaults)
    const brandColors = organization.brandColors as { primary?: string; secondary?: string; accent?: string } | null || {};
    const primaryColor = brandColors.primary || '#0ea5e9';
    const secondaryColor = brandColors.secondary || '#1f2937';
    const accentColor = brandColors.accent || '#10b981';
    
    // Generate logo HTML if available
    const logoHtml = organization.logoUrl 
      ? `<img src="${organization.logoUrl}" alt="${organization.name}" style="max-height: 60px; margin-bottom: 10px; display: block;" />`
      : '';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quote #${quote.id.substring(0, 8)}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid ${primaryColor};
        }
        
        .company-info h1 {
            font-size: 28px;
            color: ${secondaryColor};
            margin-bottom: 8px;
        }
        
        .company-logo {
            margin-bottom: 12px;
        }
        
        .company-info p {
            color: #6b7280;
            font-size: 14px;
        }
        
        .quote-info {
            text-align: right;
        }
        
        .quote-info h2 {
            font-size: 24px;
            color: #1f2937;
            margin-bottom: 8px;
        }
        
        .quote-info p {
            color: #6b7280;
            font-size: 14px;
        }
        
        .quote-details {
            margin-bottom: 30px;
        }
        
        .quote-details h3 {
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 15px;
        }
        
        .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        
        .detail-item {
            margin-bottom: 10px;
        }
        
        .detail-label {
            font-weight: 600;
            color: #374151;
            font-size: 14px;
        }
        
        .detail-value {
            color: #6b7280;
            font-size: 14px;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        
        .items-table th {
            background-color: ${this.hexToRgba(primaryColor, 0.08)};
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: ${secondaryColor};
            border-bottom: 2px solid ${primaryColor};
        }
        
        .items-table td {
            padding: 12px;
            border-bottom: 1px solid #f3f4f6;
        }
        
        .items-table tr:nth-child(even) {
            background-color: #f9fafb;
        }
        
        .text-right {
            text-align: right;
        }
        
        .text-center {
            text-align: center;
        }
        
        .totals-section {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid ${primaryColor};
        }
        
        .totals-table {
            width: 100%;
            max-width: 300px;
            margin-left: auto;
        }
        
        .totals-table td {
            padding: 8px 0;
            border-bottom: 1px solid #f3f4f6;
        }
        
        .totals-table .total-row {
            font-weight: 600;
            font-size: 16px;
            color: ${secondaryColor};
            border-top: 2px solid ${primaryColor};
            border-bottom: none;
        }
        
        .deposit-section {
            margin-top: 20px;
            padding: 15px;
            background-color: ${this.hexToRgba(primaryColor, 0.1)};
            border-left: 4px solid ${primaryColor};
        }
        
        .deposit-section h4 {
            color: ${this.darkenColor(primaryColor, 0.2)};
            margin-bottom: 8px;
        }
        
        .deposit-section p {
            color: ${this.darkenColor(primaryColor, 0.15)};
            font-size: 14px;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
        }
        
        .terms-section {
            margin-top: 20px;
            padding: 15px;
            background-color: #f9fafb;
            border-radius: 6px;
        }
        
        .terms-section h4 {
            color: #374151;
            margin-bottom: 10px;
        }
        
        .terms-section p {
            color: #6b7280;
            font-size: 12px;
            line-height: 1.5;
        }
        
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 48px;
            color: rgba(0, 0, 0, 0.1);
            z-index: -1;
            pointer-events: none;
        }
        
        @media print {
            .container {
                padding: 0;
            }
        }
    </style>
</head>
<body>
    ${options.includeWatermark ? '<div class="watermark">DRAFT</div>' : ''}
    
    <div class="container">
        <div class="header">
            <div class="company-info">
                ${logoHtml ? `<div class="company-logo">${logoHtml}</div>` : ''}
                <h1>${organization.name}</h1>
                <p>${organization.address || 'Professional Pool Services'}</p>
                <p>${organization.phone || ''} ${organization.email || ''}</p>
            </div>
            <div class="quote-info">
                <h2>Quote #${quote.id.substring(0, 8)}</h2>
                <p>Date: ${new Date(quote.createdAt).toLocaleDateString()}</p>
                <p>Valid for: ${quote.validityDays} days</p>
            </div>
        </div>
        
        <div class="quote-details">
            <h3>Project Details</h3>
            <div class="details-grid">
                <div class="detail-item">
                    <div class="detail-label">Job ID:</div>
                    <div class="detail-value">${quote.jobId.substring(0, 8)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status:</div>
                    <div class="detail-value">${quote.status.toUpperCase()}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Created:</div>
                    <div class="detail-value">${new Date(quote.createdAt).toLocaleDateString()}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Updated:</div>
                    <div class="detail-value">${new Date(quote.updatedAt).toLocaleDateString()}</div>
                </div>
            </div>
        </div>
        
        <table class="items-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th class="text-center">Qty</th>
                    <th class="text-center">Unit</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Line Total</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr>
                        <td>${item.description}</td>
                        <td class="text-center">${item.qty?.toFixed(2) || '-'}</td>
                        <td class="text-center">${item.unit || '-'}</td>
                        <td class="text-right">${item.unitPrice ? this.formatCurrency(item.unitPrice, settings.currencyCode) : '-'}</td>
                        <td class="text-right">${item.lineTotal ? this.formatCurrency(item.lineTotal, settings.currencyCode) : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="totals-section">
            <table class="totals-table">
                <tr>
                    <td>Subtotal:</td>
                    <td class="text-right">${this.formatCurrency(totals.subtotal, settings.currencyCode)}</td>
                </tr>
                <tr>
                    <td>GST (${(settings.taxRate * 100).toFixed(1)}%):</td>
                    <td class="text-right">${this.formatCurrency(totals.gst, settings.currencyCode)}</td>
                </tr>
                <tr class="total-row">
                    <td>Total:</td>
                    <td class="text-right">${this.formatCurrency(totals.total, settings.currencyCode)}</td>
                </tr>
            </table>
        </div>
        
        <div class="deposit-section">
            <h4>Deposit Required</h4>
            <p>A deposit of ${this.formatCurrency(totals.depositAmount, settings.currencyCode)} (${(parseFloat(quote.depositPct) * 100).toFixed(0)}%) is required to secure this quote.</p>
        </div>
        
        ${options.customMessage ? `
            <div class="terms-section">
                <h4>Additional Notes</h4>
                <p>${options.customMessage}</p>
            </div>
        ` : ''}
        
        ${options.includeTerms && settings.pdfTerms ? `
            <div class="terms-section">
                <h4>Terms & Conditions</h4>
                <p>${settings.pdfTerms}</p>
            </div>
        ` : ''}
        
        <div class="footer">
            <p>This quote is valid for ${quote.validityDays} days from the date of issue.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private formatCurrency(amount: number, currencyCode: string = 'AUD'): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currencyCode
    }).format(amount);
  }

  // Helper method to convert hex to rgba
  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Helper method to darken a color
  private darkenColor(hex: string, amount: number): string {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) * (1 - amount));
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) * (1 - amount));
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) * (1 - amount));
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }
}

export const pdfGenerator = new PDFGenerator();
