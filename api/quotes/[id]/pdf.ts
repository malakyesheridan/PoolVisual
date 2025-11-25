/**
 * Separate Vercel serverless function for PDF generation
 * This isolates chromium dependency to reduce main function size
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const { watermark, terms, message } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Quote ID is required' });
    }

    // Import dependencies dynamically
    const { authenticateRequest, verifyQuoteAccess } = await import('../../../server/lib/authHelper.js');
    const { pdfGenerator } = await import('../../../server/lib/pdfGenerator.js');
    
    // Authentication check
    const auth = await authenticateRequest(req, res);
    if (!auth) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify quote access
    const hasAccess = await verifyQuoteAccess(id, auth.userId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Generate PDF with caching
    const pdfBuffer = await pdfGenerator.generateQuotePDFWithCache({
      quoteId: id,
      includeWatermark: watermark === 'true',
      includeTerms: terms === 'true',
      customMessage: message as string
    });

    // Ensure pdfBuffer is a Buffer
    if (!Buffer.isBuffer(pdfBuffer)) {
      throw new Error('PDF generation did not return a valid buffer');
    }

    // Validate PDF buffer (PDF files start with %PDF)
    if (pdfBuffer.length < 4 || pdfBuffer.toString('ascii', 0, 4) !== '%PDF') {
      throw new Error('Generated PDF buffer is not a valid PDF file');
    }

    // Set headers for PDF download - use set() for multiple headers
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="quote-${id.substring(0, 8)}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
      'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      'X-Content-Type-Options': 'nosniff'
    });
    
    // Send PDF buffer - use send() for binary data in Vercel (works better than end())
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[PDF API] Error generating PDF:', error);
    
    // If headers were already sent, we can't send JSON
    if (res.headersSent) {
      res.end();
      return;
    }
    
    res.status(500).json({ 
      message: (error as Error).message,
      error: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.stack : String(error)) 
        : undefined
    });
  }
}

