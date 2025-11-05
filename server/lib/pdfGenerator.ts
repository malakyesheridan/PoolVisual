/**
 * PDF Generation Service
 * 
 * Professional PDF generation for quotes using Puppeteer
 * Integrates with existing quote data and organization branding
 */

import puppeteer from 'puppeteer';
import { storage } from '../storage';
import { Quote, QuoteItem, Org, Settings } from '../../shared/schema';

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
  private browser: puppeteer.Browser | null = null;

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async generateQuotePDF(options: PDFGenerationOptions): Promise<Buffer> {
    await this.initialize();
    
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    try {
      // Gather all required data
      const pdfData = await this.gatherPDFData(options.quoteId);
      
      // Generate HTML content
      const htmlContent = this.generateHTML(pdfData, options);
      
      // Set content and generate PDF
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      return pdfBuffer;
    } finally {
      await page.close();
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
            border-bottom: 2px solid #e5e7eb;
        }
        
        .company-info h1 {
            font-size: 28px;
            color: #1f2937;
            margin-bottom: 8px;
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
            background-color: #f9fafb;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #374151;
            border-bottom: 1px solid #e5e7eb;
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
            border-top: 2px solid #e5e7eb;
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
            color: #1f2937;
            border-top: 2px solid #e5e7eb;
            border-bottom: none;
        }
        
        .deposit-section {
            margin-top: 20px;
            padding: 15px;
            background-color: #f0f9ff;
            border-left: 4px solid #0ea5e9;
        }
        
        .deposit-section h4 {
            color: #0c4a6e;
            margin-bottom: 8px;
        }
        
        .deposit-section p {
            color: #075985;
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
}

export const pdfGenerator = new PDFGenerator();
