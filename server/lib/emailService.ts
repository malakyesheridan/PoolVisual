/**
 * Email Service
 * 
 * Professional email integration using Resend
 * Handles quote sending, notifications, and client communications
 */

import { Resend } from 'resend';
import { storage } from '../storage.js';
import { pdfGenerator } from './pdfGenerator.js';
import { Quote, Org, Settings } from '../../shared/schema.js';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export interface QuoteEmailData {
  quote: Quote;
  organization: Org;
  settings: Settings;
  clientEmail?: string;
  customMessage?: string;
}

export class EmailService {
  private resend: Resend;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('[EmailService] RESEND_API_KEY not found, email functionality will be disabled');
      this.resend = null as any;
    } else {
      this.resend = new Resend(apiKey);
    }
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@poolvisual.com';
  }

  async sendQuoteEmail(quoteId: string, clientEmail?: string, customMessage?: string): Promise<void> {
    if (!this.resend) {
      throw new Error('Email service not configured - RESEND_API_KEY is missing');
    }

    try {
      // Gather email data
      const emailData = await this.gatherQuoteEmailData(quoteId);
      
      // Generate PDF attachment
      const pdfBuffer = await pdfGenerator.generateQuotePDF({
        quoteId,
        includeWatermark: false,
        includeTerms: true,
        customMessage
      });

      // Generate email content
      const { subject, html } = this.generateQuoteEmailContent(emailData, customMessage);

      // Send email
      await this.resend.emails.send({
        from: this.fromEmail,
        to: clientEmail || emailData.organization.email || '',
        subject,
        html,
        attachments: [
          {
            filename: `quote-${quoteId.substring(0, 8)}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });

      // Update quote status to 'sent'
      await storage.updateQuote(quoteId, { status: 'sent' });

    } catch (error) {
      console.error('[EmailService] Error sending quote email:', error);
      throw new Error(`Failed to send quote email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendQuoteReminder(quoteId: string, clientEmail?: string): Promise<void> {
    if (!this.resend) {
      throw new Error('Email service not configured - RESEND_API_KEY is missing');
    }

    try {
      const emailData = await this.gatherQuoteEmailData(quoteId);
      
      const { subject, html } = this.generateReminderEmailContent(emailData);

      await this.resend.emails.send({
        from: this.fromEmail,
        to: clientEmail || emailData.organization.email || '',
        subject,
        html
      });

    } catch (error) {
      console.error('[EmailService] Error sending quote reminder:', error);
      throw new Error(`Failed to send quote reminder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendQuoteAcceptedNotification(quoteId: string, clientEmail?: string): Promise<void> {
    if (!this.resend) {
      throw new Error('Email service not configured - RESEND_API_KEY is missing');
    }

    try {
      const emailData = await this.gatherQuoteEmailData(quoteId);
      
      const { subject, html } = this.generateAcceptedEmailContent(emailData);

      await this.resend.emails.send({
        from: this.fromEmail,
        to: clientEmail || emailData.organization.email || '',
        subject,
        html
      });

    } catch (error) {
      console.error('[EmailService] Error sending acceptance notification:', error);
      throw new Error(`Failed to send acceptance notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async gatherQuoteEmailData(quoteId: string): Promise<QuoteEmailData> {
    const quote = await storage.getQuote(quoteId);
    if (!quote) {
      throw new Error('Quote not found');
    }

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

    return {
      quote,
      organization,
      settings
    };
  }

  private generateQuoteEmailContent(data: QuoteEmailData, customMessage?: string): { subject: string; html: string } {
    const { quote, organization, settings } = data;
    const total = parseFloat(quote.total);
    const depositAmount = total * parseFloat(quote.depositPct);

    const subject = `Quote #${quote.id.substring(0, 8)} - ${organization.name}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .content {
            background: white;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
        }
        .quote-info {
            background: #f8fafc;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .quote-info h2 {
            color: #1f2937;
            margin: 0 0 15px 0;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .info-item {
            margin-bottom: 10px;
        }
        .info-label {
            font-weight: 600;
            color: #374151;
            font-size: 14px;
        }
        .info-value {
            color: #6b7280;
            font-size: 14px;
        }
        .totals {
            background: #f0f9ff;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #0ea5e9;
        }
        .totals h3 {
            color: #0c4a6e;
            margin: 0 0 10px 0;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
        }
        .total-row.final {
            font-weight: 600;
            font-size: 18px;
            color: #1f2937;
            border-top: 2px solid #e5e7eb;
            padding-top: 10px;
            margin-top: 15px;
        }
        .deposit {
            background: #fef3c7;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #f59e0b;
        }
        .deposit h4 {
            color: #92400e;
            margin: 0 0 8px 0;
        }
        .deposit p {
            color: #b45309;
            margin: 0;
        }
        .cta {
            text-align: center;
            margin: 30px 0;
        }
        .cta-button {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
        }
        .footer {
            background: #f9fafb;
            padding: 20px;
            border-radius: 0 0 8px 8px;
            border: 1px solid #e5e7eb;
            border-top: none;
            font-size: 12px;
            color: #6b7280;
            text-align: center;
        }
        .message {
            background: #f0f9ff;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #0ea5e9;
        }
        .message h4 {
            color: #0c4a6e;
            margin: 0 0 10px 0;
        }
        .message p {
            color: #075985;
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${organization.name}</h1>
        <p>Professional Pool Services</p>
    </div>
    
    <div class="content">
        <h2>Your Quote is Ready!</h2>
        <p>Thank you for your interest in our pool services. We're excited to work with you and have prepared a detailed quote for your project.</p>
        
        <div class="quote-info">
            <h2>Quote Details</h2>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Quote Number:</div>
                    <div class="info-value">#${quote.id.substring(0, 8)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Date Created:</div>
                    <div class="info-value">${new Date(quote.createdAt).toLocaleDateString()}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Valid For:</div>
                    <div class="info-value">${quote.validityDays} days</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Status:</div>
                    <div class="info-value">${quote.status.toUpperCase()}</div>
                </div>
            </div>
        </div>
        
        <div class="totals">
            <h3>Quote Summary</h3>
            <div class="total-row">
                <span>Subtotal:</span>
                <span>${this.formatCurrency(parseFloat(quote.subtotal), settings.currencyCode)}</span>
            </div>
            <div class="total-row">
                <span>GST (${(settings.taxRate * 100).toFixed(1)}%):</span>
                <span>${this.formatCurrency(parseFloat(quote.gst), settings.currencyCode)}</span>
            </div>
            <div class="total-row final">
                <span>Total:</span>
                <span>${this.formatCurrency(total, settings.currencyCode)}</span>
            </div>
        </div>
        
        <div class="deposit">
            <h4>Deposit Required</h4>
            <p>A deposit of ${this.formatCurrency(depositAmount, settings.currencyCode)} (${(parseFloat(quote.depositPct) * 100).toFixed(0)}%) is required to secure this quote.</p>
        </div>
        
        ${customMessage ? `
            <div class="message">
                <h4>Additional Notes</h4>
                <p>${customMessage}</p>
            </div>
        ` : ''}
        
        <div class="cta">
            <a href="#" class="cta-button">Accept Quote & Pay Deposit</a>
        </div>
        
        <p><strong>Next Steps:</strong></p>
        <ul>
            <li>Review the attached PDF for detailed specifications</li>
            <li>Contact us if you have any questions</li>
            <li>Accept the quote to secure your booking</li>
        </ul>
    </div>
    
    <div class="footer">
        <p>This quote is valid for ${quote.validityDays} days from the date of issue.</p>
        <p>Generated by PoolVisual - Professional Pool Design Software</p>
    </div>
</body>
</html>
    `;

    return { subject, html };
  }

  private generateReminderEmailContent(data: QuoteEmailData): { subject: string; html: string } {
    const { quote, organization } = data;
    const subject = `Reminder: Quote #${quote.id.substring(0, 8)} - ${organization.name}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: #f59e0b;
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }
        .content {
            background: white;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
        }
        .cta-button {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
        }
        .footer {
            background: #f9fafb;
            padding: 20px;
            border-radius: 0 0 8px 8px;
            border: 1px solid #e5e7eb;
            border-top: none;
            font-size: 12px;
            color: #6b7280;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Quote Reminder</h1>
        <p>${organization.name}</p>
    </div>
    
    <div class="content">
        <h2>Don't Miss Out!</h2>
        <p>We wanted to remind you about your quote #${quote.id.substring(0, 8)} which is still valid for ${quote.validityDays} days.</p>
        
        <p>If you have any questions or would like to proceed with the project, please don't hesitate to contact us.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="#" class="cta-button">View Quote</a>
        </div>
    </div>
    
    <div class="footer">
        <p>Generated by PoolVisual - Professional Pool Design Software</p>
    </div>
</body>
</html>
    `;

    return { subject, html };
  }

  private generateAcceptedEmailContent(data: QuoteEmailData): { subject: string; html: string } {
    const { quote, organization } = data;
    const subject = `Quote Accepted - Project Confirmed #${quote.id.substring(0, 8)}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: #10b981;
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }
        .content {
            background: white;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
        }
        .footer {
            background: #f9fafb;
            padding: 20px;
            border-radius: 0 0 8px 8px;
            border: 1px solid #e5e7eb;
            border-top: none;
            font-size: 12px;
            color: #6b7280;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Quote Accepted!</h1>
        <p>${organization.name}</p>
    </div>
    
    <div class="content">
        <h2>Thank You for Choosing Us!</h2>
        <p>We're excited to confirm that your quote #${quote.id.substring(0, 8)} has been accepted and your project is now confirmed.</p>
        
        <p>Our team will be in touch soon to discuss next steps and schedule your project timeline.</p>
        
        <p>If you have any questions in the meantime, please don't hesitate to contact us.</p>
    </div>
    
    <div class="footer">
        <p>Generated by PoolVisual - Professional Pool Design Software</p>
    </div>
</body>
</html>
    `;

    return { subject, html };
  }

  private formatCurrency(amount: number, currencyCode: string = 'AUD'): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currencyCode
    }).format(amount);
  }
}

export const emailService = new EmailService();
