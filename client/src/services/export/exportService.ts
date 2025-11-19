// client/src/services/export/exportService.ts
import { generateExportFilename, type FileNamingOptions } from './naming';

export interface ExportOptions {
  format: 'png' | 'webp' | 'pdf';
  scale: 1 | 2 | 4;
  maxDimension?: number;
  transparentBackground: boolean;
  watermark?: {
    enabled: boolean;
    text?: string;
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    opacity: number;
  };
  quality?: number; // 0-1 for WebP, default 0.8
}

export interface ExportResult {
  blob: Blob;
  size: number;
  dimensions: { width: number; height: number };
  format: string;
  mimeType: string;
  url: string;
}

export interface ShareOptions {
  expirationHours: number;
  passwordProtected?: boolean;
  password?: string;
  allowDownload: boolean;
  allowView: boolean;
}

export interface ShareResult {
  signedUrl: string;
  shareId: string;
  expiresAt: number;
  shortUrl?: string;
}

export class ExportService {
  async exportCanvas(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    options: ExportOptions
  ): Promise<ExportResult> {
    const startTime = performance.now();
    
    const sourceWidth = canvas.width;
    const sourceHeight = canvas.height;
    
    let exportWidth = sourceWidth * options.scale;
    let exportHeight = sourceHeight * options.scale;
    
    if (options.maxDimension) {
      const longestEdge = Math.max(exportWidth, exportHeight);
      if (longestEdge > options.maxDimension) {
        const scale = options.maxDimension / longestEdge;
        exportWidth = Math.floor(exportWidth * scale);
        exportHeight = Math.floor(exportHeight * scale);
      }
    }
    
    // Use OffscreenCanvas.convertToBlob() when available
    let exportCanvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    
    if (canvas instanceof OffscreenCanvas && 'convertToBlob' in canvas) {
      // Use OffscreenCanvas directly
      exportCanvas = new OffscreenCanvas(exportWidth, exportHeight);
      ctx = exportCanvas.getContext('2d', {
        alpha: options.transparentBackground,
        colorSpace: 'srgb', // sRGB assumed, no ICC embedding client-side
      })!;
      
      if (!ctx) {
        throw new Error('Failed to get OffscreenCanvas context');
      }
      
      // Draw source (scaled)
      ctx.drawImage(canvas, 0, 0, exportWidth, exportHeight);
    } else {
      // Fallback to normal canvas
      exportCanvas = document.createElement('canvas');
      exportCanvas.width = exportWidth;
      exportCanvas.height = exportHeight;
      ctx = exportCanvas.getContext('2d', {
        alpha: options.transparentBackground,
        colorSpace: 'srgb',
      })!;
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      if (!options.transparentBackground) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, exportWidth, exportHeight);
      }
      
      if (canvas instanceof HTMLCanvasElement) {
        ctx.drawImage(canvas, 0, 0, exportWidth, exportHeight);
      } else {
        const bitmap = await createImageBitmap(canvas);
        ctx.drawImage(bitmap, 0, 0, exportWidth, exportHeight);
      }
    }
    
    // Add watermark if enabled
    if (options.watermark?.enabled) {
      this.addWatermark(ctx, exportWidth, exportHeight, options.watermark);
    }
    
    // Export to blob
    let blob: Blob;
    let mimeType: string;
    
    if (options.format === 'png') {
      mimeType = 'image/png';
      if (exportCanvas instanceof OffscreenCanvas && 'convertToBlob' in exportCanvas) {
        blob = await exportCanvas.convertToBlob({ type: mimeType });
      } else {
        blob = await new Promise<Blob>((resolve, reject) => {
          (exportCanvas as HTMLCanvasElement).toBlob(
            (b) => b ? resolve(b) : reject(new Error('Failed to export PNG')),
            mimeType
          );
        });
      }
    } else if (options.format === 'webp') {
      mimeType = 'image/webp';
      const quality = options.quality ?? 0.8; // Default 0.8
      if (exportCanvas instanceof OffscreenCanvas && 'convertToBlob' in exportCanvas) {
        blob = await exportCanvas.convertToBlob({ type: mimeType, quality });
      } else {
        blob = await new Promise<Blob>((resolve, reject) => {
          (exportCanvas as HTMLCanvasElement).toBlob(
            (b) => b ? resolve(b) : reject(new Error('Failed to export WebP')),
            mimeType,
            quality
          );
        });
      }
    } else if (options.format === 'pdf') {
      // Use jsPDF default import
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      
      const imgData = exportCanvas instanceof OffscreenCanvas
        ? await (await createImageBitmap(exportCanvas)).toDataURL('image/png')
        : (exportCanvas as HTMLCanvasElement).toDataURL('image/png');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = exportWidth;
      const imgHeight = exportHeight;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      
      pdf.addImage(
        imgData,
        'PNG',
        (pdfWidth - imgWidth * ratio) / 2,
        (pdfHeight - imgHeight * ratio) / 2,
        imgWidth * ratio,
        imgHeight * ratio
      );
      
      blob = pdf.output('blob');
      mimeType = 'application/pdf';
    } else {
      throw new Error(`Unsupported format: ${options.format}`);
    }
    
    const duration = performance.now() - startTime;
    
    return {
      blob,
      size: blob.size,
      dimensions: { width: exportWidth, height: exportHeight },
      format: options.format,
      mimeType,
      url: URL.createObjectURL(blob),
    };
  }
  
  private addWatermark(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    watermark: NonNullable<ExportOptions['watermark']>
  ): void {
    const text = watermark.text || 'EasyFlow'; // Changed from "PoolVisual"
    const fontSize = Math.min(width, height) * 0.02;
    const padding = fontSize * 0.5;
    
    ctx.save();
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = `rgba(0, 0, 0, ${watermark.opacity || 0.3})`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    
    let x: number, y: number;
    switch (watermark.position) {
      case 'bottom-right':
        x = width - padding;
        y = height - padding;
        break;
      case 'bottom-left':
        x = padding;
        y = height - padding;
        ctx.textAlign = 'left';
        break;
      case 'top-right':
        x = width - padding;
        y = padding;
        ctx.textBaseline = 'top';
        break;
      case 'top-left':
        x = padding;
        y = padding;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        break;
    }
    
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  
  async exportMultipleVersions(
    versions: Array<{ name: string; canvas: HTMLCanvasElement | OffscreenCanvas }>,
    options: ExportOptions
  ): Promise<Blob> {
    // JSZip default import
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    let totalSize = 0;
    const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB cap
    
    for (const version of versions) {
      const result = await this.exportCanvas(version.canvas, options);
      
      // Enforce 50MB total cap
      if (totalSize + result.size > MAX_ZIP_SIZE) {
        throw new Error('ZIP size would exceed 50MB limit');
      }
      
      const filename = generateExportFilename({
        projectName: version.name,
        format: options.format,
        scale: options.scale,
        timestamp: true,
      });
      
      zip.file(filename, result.blob);
      totalSize += result.size;
    }
    
    return zip.generateAsync({ type: 'blob' });
  }
  
  async createShareLink(
    exportResult: ExportResult,
    options: ShareOptions
  ): Promise<ShareResult> {
    // Pre-signed PUT upload flow
    const uploadResponse = await fetch('/api/export/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: generateExportFilename({
          format: exportResult.format,
          timestamp: true,
        }),
        contentType: exportResult.mimeType,
        expirationHours: options.expirationHours,
        passwordProtected: options.passwordProtected,
        allowDownload: options.allowDownload,
        allowView: options.allowView,
      }),
    });
    
    if (!uploadResponse.ok) {
      throw new Error('Failed to get presigned URL');
    }
    
    const { uploadUrl, shareId, expiresAt, viewUrl, shortUrl } = await uploadResponse.json();
    
    // Upload blob directly to presigned URL
    const uploadResult = await fetch(uploadUrl, {
      method: 'PUT',
      body: exportResult.blob,
      headers: {
        'Content-Type': exportResult.mimeType,
      },
    });
    
    if (!uploadResult.ok) {
      throw new Error('Failed to upload to presigned URL');
    }
    
    return {
      shareId,
      signedUrl: viewUrl,
      expiresAt,
      shortUrl,
    };
  }
}

