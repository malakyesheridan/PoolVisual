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
    // Use absolute paths from project root
    const { pdfGenerator } = await import('../../../server/lib/pdfGenerator.js');
    const { storage } = await import('../../../server/storage.js');
    
    // TODO: Add proper authentication check
    // For now, we'll verify quote exists
    const quote = await storage.getQuote(id);
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    // Generate PDF
    const pdfBuffer = await pdfGenerator.generateQuotePDF({
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
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
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
      error: error instanceof Error ? error.stack : String(error)
    });
  }
}

