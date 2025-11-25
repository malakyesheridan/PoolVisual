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

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quote-${id.substring(0, 8)}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[PDF API] Error generating PDF:', error);
    res.status(500).json({ message: (error as Error).message });
  }
}

