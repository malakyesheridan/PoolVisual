/**
 * Lightweight API route for sending report emails via SendGrid
 * NO file storage, NO heavy dependencies
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { to, pdfBase64, propertyId } = req.body;

    if (!to || !pdfBase64 || !propertyId) {
      return res.status(400).json({ message: 'Missing required fields: to, pdfBase64, propertyId' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    // Get SendGrid API key from environment
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendGridApiKey) {
      console.error('[Send Report Email] SENDGRID_API_KEY not configured');
      return res.status(500).json({ message: 'Email service not configured' });
    }

    // Convert base64 to buffer for attachment
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Prepare SendGrid email
    const emailData = {
      personalizations: [
        {
          to: [{ email: to }],
          subject: `Seller Activity Report - Property ${propertyId.substring(0, 8)}`,
        },
      ],
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@easyflow.studio',
        name: 'EasyFlow Studio',
      },
      content: [
        {
          type: 'text/html',
          value: `
            <html>
              <body>
                <p>Please find attached the Seller Activity Report for the property.</p>
                <p>This report includes buyer matches, market insights, and property details.</p>
                <p>Best regards,<br>EasyFlow Studio</p>
              </body>
            </html>
          `,
        },
      ],
      attachments: [
        {
          content: pdfBase64,
          filename: `seller-report-${propertyId.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    };

    // Send email via SendGrid
    const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (!sendGridResponse.ok) {
      const errorText = await sendGridResponse.text();
      console.error('[Send Report Email] SendGrid error:', errorText);
      return res.status(500).json({ 
        message: 'Failed to send email',
        error: sendGridResponse.statusText 
      });
    }

    // Mark seller update for associated opportunity
    try {
      const { storage } = await import('../server/storage.js');
      // Find opportunity linked to this property
      const job = await storage.getJob(propertyId);
      if (job?.userId) {
        const opportunities = await storage.getOpportunities(String(job.userId), {
          propertyJobId: propertyId,
        });
        const sellerOpportunity = opportunities.find(
          (opp: any) => opp.opportunityType === 'seller' || opp.opportunityType === 'both'
        );
        if (sellerOpportunity) {
          await storage.markSellerUpdate(sellerOpportunity.id);
        }
      }
    } catch (error: any) {
      // Log but don't fail - activity tracking is non-critical
      console.warn('[Send Report Email] Failed to mark seller update:', error?.message);
    }

    return res.status(200).json({ 
      success: true,
      message: 'Email sent successfully' 
    });
  } catch (error) {
    console.error('[Send Report Email] Error:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

