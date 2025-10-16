import jsPDF from 'jspdf';
import { Quote, QuoteItem } from '../maskcore/store';
import { getAll } from '../materials/registry';

interface PDFQuoteOptions {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  logoUrl?: string;
}

export class QuotePDFGenerator {
  private doc: jsPDF;
  private options: PDFQuoteOptions;

  constructor(options: PDFQuoteOptions = {}) {
    this.doc = new jsPDF();
    this.options = {
      companyName: 'Pool Design Pro',
      companyAddress: '123 Pool Street, Pool City, PC 12345',
      companyPhone: '(555) 123-POOL',
      companyEmail: 'quotes@pooldesignpro.com',
      ...options
    };
  }

  generateQuotePDF(quote: Quote): void {
    this.doc = new jsPDF();
    
    // Get materials for display names
    const materials = getAll();
    
    // Header
    this.addHeader(quote);
    
    // Quote Info
    this.addQuoteInfo(quote);
    
    // Client Info
    this.addClientInfo(quote);
    
    // Items Table
    this.addItemsTable(quote, materials);
    
    // Totals
    this.addTotals(quote);
    
    // Footer
    this.addFooter(quote);
    
    // Download
    this.downloadPDF(quote.name);
  }

  private addHeader(quote: Quote): void {
    const { companyName, companyAddress, companyPhone, companyEmail } = this.options;
    
    // Company Name
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(companyName!, 20, 30);
    
    // Company Details
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(companyAddress!, 20, 40);
    this.doc.text(`Phone: ${companyPhone}`, 20, 46);
    this.doc.text(`Email: ${companyEmail}`, 20, 52);
    
    // Quote Title
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('QUOTE', 150, 30);
    
    // Date
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    const date = new Date(quote.createdAt).toLocaleDateString();
    this.doc.text(`Date: ${date}`, 150, 40);
    
    // Status
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`Status: ${quote.status.toUpperCase()}`, 150, 46);
  }

  private addQuoteInfo(quote: Quote): void {
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`Quote: ${quote.name}`, 20, 70);
    
    if (quote.expiresAt) {
      const expiryDate = new Date(quote.expiresAt).toLocaleDateString();
      this.doc.text(`Valid Until: ${expiryDate}`, 20, 76);
    }
  }

  private addClientInfo(quote: Quote): void {
    if (!quote.clientName) return;
    
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Client Information:', 20, 90);
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    let yPos = 98;
    
    if (quote.clientName) {
      this.doc.text(`Name: ${quote.clientName}`, 20, yPos);
      yPos += 6;
    }
    
    if (quote.clientEmail) {
      this.doc.text(`Email: ${quote.clientEmail}`, 20, yPos);
      yPos += 6;
    }
    
    if (quote.clientPhone) {
      this.doc.text(`Phone: ${quote.clientPhone}`, 20, yPos);
      yPos += 6;
    }
    
    if (quote.projectAddress) {
      this.doc.text(`Project Address: ${quote.projectAddress}`, 20, yPos);
      yPos += 6;
    }
  }

  private addItemsTable(quote: Quote, materials: Record<string, any>): void {
    const startY = quote.clientName ? 120 : 90;
    
    // Table Header
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Item', 20, startY);
    this.doc.text('Material', 60, startY);
    this.doc.text('Area (m²)', 100, startY);
    this.doc.text('Rate ($/m²)', 130, startY);
    this.doc.text('Subtotal', 160, startY);
    
    // Draw line under header
    this.doc.line(20, startY + 2, 190, startY + 2);
    
    let yPos = startY + 8;
    
    // Table Rows
    quote.items.forEach((item, index) => {
      const material = materials[item.materialId];
      const materialName = material?.name || 'Unknown Material';
      
      this.doc.setFont('helvetica', 'normal');
      
      // Item name (mask name)
      this.doc.text(`Item ${index + 1}`, 20, yPos);
      
      // Material name
      this.doc.text(materialName, 60, yPos);
      
      // Area
      this.doc.text(item.area.toFixed(2), 100, yPos);
      
      // Rate (material + labor + markup)
      const totalRate = (item.materialCost + item.laborCost) * (1 + item.markup / 100);
      this.doc.text(`$${totalRate.toFixed(2)}`, 130, yPos);
      
      // Subtotal
      this.doc.text(`$${item.subtotal.toFixed(2)}`, 160, yPos);
      
      // Notes if any
      if (item.notes) {
        yPos += 4;
        this.doc.setFontSize(8);
        this.doc.text(`Note: ${item.notes}`, 20, yPos);
        this.doc.setFontSize(10);
      }
      
      yPos += 8;
      
      // Add new page if needed
      if (yPos > 250) {
        this.doc.addPage();
        yPos = 20;
      }
    });
  }

  private addTotals(quote: Quote): void {
    const startY = Math.max(200, this.doc.internal.pageSize.height - 60);
    
    // Subtotal
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Subtotal:', 130, startY);
    this.doc.text(`$${quote.subtotal.toFixed(2)}`, 160, startY);
    
    // Tax
    this.doc.text(`Tax (${quote.taxRate}%):`, 130, startY + 6);
    this.doc.text(`$${quote.taxAmount.toFixed(2)}`, 160, startY + 6);
    
    // Total
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(12);
    this.doc.text('TOTAL:', 130, startY + 16);
    this.doc.text(`$${quote.total.toFixed(2)}`, 160, startY + 16);
    
    // Draw line above total
    this.doc.line(130, startY + 12, 190, startY + 12);
  }

  private addFooter(quote: Quote): void {
    const pageHeight = this.doc.internal.pageSize.height;
    
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Thank you for your business!', 20, pageHeight - 20);
    this.doc.text('This quote is valid for 30 days from the date issued.', 20, pageHeight - 15);
    
    if (quote.notes) {
      this.doc.text(`Notes: ${quote.notes}`, 20, pageHeight - 10);
    }
  }

  private downloadPDF(filename: string): void {
    const sanitizedFilename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    this.doc.save(`${sanitizedFilename}_quote.pdf`);
  }
}

// Export function for easy use
export function generateQuotePDF(quote: Quote, options?: PDFQuoteOptions): void {
  const generator = new QuotePDFGenerator(options);
  generator.generateQuotePDF(quote);
}
