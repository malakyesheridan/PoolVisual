/**
 * Client-side PDF Exporter using html2pdf.js
 * Lightweight, no server-side dependencies
 */

// @ts-ignore - html2pdf.js doesn't have TypeScript definitions
import html2pdf from 'html2pdf.js';

export interface PdfExportOptions {
  filename?: string;
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margin?: number | [number, number, number, number];
}

export async function exportToPdf(
  element: HTMLElement,
  options: PdfExportOptions = {}
): Promise<Blob> {
  const {
    filename = 'report.pdf',
    format = 'a4',
    orientation = 'portrait',
    margin = 10,
  } = options;

  const opt = {
    margin: Array.isArray(margin) ? margin : [margin, margin, margin, margin],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      letterRendering: true,
    },
    jsPDF: {
      unit: 'mm',
      format,
      orientation,
    },
  };

  return new Promise((resolve, reject) => {
    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => {
        // html2pdf doesn't return a blob directly, so we need to generate it
        html2pdf()
          .set(opt)
          .from(element)
          .outputPdf('blob')
          .then((blob: Blob) => {
            resolve(blob);
          })
          .catch(reject);
      })
      .catch(reject);
  });
}

export async function exportToPdfBase64(
  element: HTMLElement,
  options: PdfExportOptions = {}
): Promise<string> {
  const {
    format = 'a4',
    orientation = 'portrait',
    margin = 10,
  } = options;

  const opt = {
    margin: Array.isArray(margin) ? margin : [margin, margin, margin, margin],
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      letterRendering: true,
    },
    jsPDF: {
      unit: 'mm',
      format,
      orientation,
    },
  };

  return new Promise((resolve, reject) => {
    html2pdf()
      .set(opt)
      .from(element)
      .outputPdf('datauristring')
      .then((dataUri: string) => {
        // Extract base64 from data URI
        const base64 = dataUri.split(',')[1];
        resolve(base64);
      })
      .catch(reject);
  });
}

