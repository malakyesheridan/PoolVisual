/**
 * Enhanced Image Optimization Service
 * 
 * Builds upon existing Sharp image processing to add WebP conversion
 * and advanced optimization features without modifying existing code
 */

import * as sharp from 'sharp';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface ImageOptimizationOptions {
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  progressive?: boolean;
  lossless?: boolean;
  metadata?: boolean;
}

export interface OptimizationResult {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  format: string;
  dimensions: {
    width: number;
    height: number;
  };
  path: string;
}

export interface ThumbnailSet {
  small: Buffer;
  medium: Buffer;
  large: Buffer;
  original: Buffer;
}

export class ImageOptimizationService {
  private static readonly DEFAULT_QUALITY = 85;
  private static readonly DEFAULT_MAX_WIDTH = 1920;
  private static readonly DEFAULT_MAX_HEIGHT = 1080;

  /**
   * Optimize image with WebP conversion
   * @param inputPath Path to input image
   * @param outputPath Path for optimized image
   * @param options Optimization options
   * @returns Promise<OptimizationResult>
   */
  async optimizeImage(
    inputPath: string,
    outputPath: string,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizationResult> {
    try {
      const {
        format = 'webp',
        quality = ImageOptimizationService.DEFAULT_QUALITY,
        maxWidth = ImageOptimizationService.DEFAULT_MAX_WIDTH,
        maxHeight = ImageOptimizationService.DEFAULT_MAX_HEIGHT,
        progressive = true,
        lossless = false,
        metadata = false
      } = options;

      // Get original file size
      const originalStats = await fs.stat(inputPath);
      const originalSize = originalStats.size;

      // Get original image metadata
      const metadata_info = await sharp(inputPath).metadata();
      const originalWidth = metadata_info.width || 0;
      const originalHeight = metadata_info.height || 0;

      // Calculate new dimensions maintaining aspect ratio
      const { width, height } = this.calculateDimensions(
        originalWidth,
        originalHeight,
        maxWidth,
        maxHeight
      );

      // Create Sharp instance with optimization settings
      let sharpInstance = sharp(inputPath)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        });

      // Apply format-specific optimizations
      switch (format) {
        case 'webp':
          sharpInstance = sharpInstance.webp({
            quality,
            lossless,
            effort: 6 // Higher effort for better compression
          });
          break;

        case 'jpeg':
          sharpInstance = sharpInstance.jpeg({
            quality,
            progressive,
            mozjpeg: true // Use mozjpeg for better compression
          });
          break;

        case 'png':
          sharpInstance = sharpInstance.png({
            quality,
            progressive,
            compressionLevel: 9
          });
          break;

        case 'avif':
          sharpInstance = sharpInstance.avif({
            quality,
            lossless,
            effort: 9
          });
          break;
      }

      // Remove metadata if not requested
      if (!metadata) {
        sharpInstance = sharpInstance.withMetadata({});
      }

      // Process and save optimized image
      await sharpInstance.toFile(outputPath);

      // Get optimized file size
      const optimizedStats = await fs.stat(outputPath);
      const optimizedSize = optimizedStats.size;

      // Calculate compression ratio
      const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100;

      return {
        originalSize,
        optimizedSize,
        compressionRatio,
        format,
        dimensions: { width, height },
        path: outputPath
      };

    } catch (error) {
      console.error('[ImageOptimization] Error optimizing image:', error);
      throw new Error(`Failed to optimize image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate thumbnail set from image
   * @param inputPath Path to input image
   * @param options Optimization options
   * @returns Promise<ThumbnailSet>
   */
  async generateThumbnails(
    inputPath: string,
    options: ImageOptimizationOptions = {}
  ): Promise<ThumbnailSet> {
    try {
      const {
        format = 'webp',
        quality = ImageOptimizationService.DEFAULT_QUALITY,
        progressive = true
      } = options;

      // Define thumbnail sizes
      const sizes = {
        small: { width: 150, height: 150 },
        medium: { width: 300, height: 300 },
        large: { width: 600, height: 600 }
      };

      const thumbnails: ThumbnailSet = {
        small: Buffer.alloc(0),
        medium: Buffer.alloc(0),
        large: Buffer.alloc(0),
        original: Buffer.alloc(0)
      };

      // Generate thumbnails
      for (const [size, dimensions] of Object.entries(sizes)) {
        const buffer = await sharp(inputPath)
          .resize(dimensions.width, dimensions.height, {
            fit: 'cover',
            position: 'center'
          })
          .webp({ quality })
          .toBuffer();

        thumbnails[size as keyof Omit<ThumbnailSet, 'original'>] = buffer;
      }

      // Generate original-sized optimized version
      thumbnails.original = await sharp(inputPath)
        .webp({ quality })
        .toBuffer();

      return thumbnails;

    } catch (error) {
      console.error('[ImageOptimization] Error generating thumbnails:', error);
      throw new Error(`Failed to generate thumbnails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Optimize image for web delivery
   * @param inputPath Path to input image
   * @param outputDir Output directory
   * @param filename Base filename
   * @returns Promise<{ webp: OptimizationResult; jpeg: OptimizationResult }>
   */
  async optimizeForWeb(
    inputPath: string,
    outputDir: string,
    filename: string
  ): Promise<{
    webp: OptimizationResult;
    jpeg: OptimizationResult;
  }> {
    try {
      const baseName = path.parse(filename).name;

      // Optimize as WebP
      const webpPath = path.join(outputDir, `${baseName}.webp`);
      const webpResult = await this.optimizeImage(inputPath, webpPath, {
        format: 'webp',
        quality: 85,
        progressive: true
      });

      // Optimize as JPEG (fallback)
      const jpegPath = path.join(outputDir, `${baseName}.jpg`);
      const jpegResult = await this.optimizeImage(inputPath, jpegPath, {
        format: 'jpeg',
        quality: 90,
        progressive: true
      });

      return {
        webp: webpResult,
        jpeg: jpegResult
      };

    } catch (error) {
      console.error('[ImageOptimization] Error optimizing for web:', error);
      throw new Error(`Failed to optimize for web: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch optimize multiple images
   * @param inputPaths Array of input image paths
   * @param outputDir Output directory
   * @param options Optimization options
   * @returns Promise<OptimizationResult[]>
   */
  async batchOptimize(
    inputPaths: string[],
    outputDir: string,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizationResult[]> {
    try {
      const results: OptimizationResult[] = [];

      // Process images in parallel (limit concurrency)
      const concurrency = 5;
      const batches = this.chunkArray(inputPaths, concurrency);

      for (const batch of batches) {
        const batchPromises = batch.map(async (inputPath) => {
          const filename = path.basename(inputPath);
          const baseName = path.parse(filename).name;
          const outputPath = path.join(outputDir, `${baseName}_optimized.webp`);

          return this.optimizeImage(inputPath, outputPath, options);
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      return results;

    } catch (error) {
      console.error('[ImageOptimization] Error in batch optimization:', error);
      throw new Error(`Failed to batch optimize: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get image information
   * @param inputPath Path to input image
   * @returns Promise<sharp.Metadata>
   */
  async getImageInfo(inputPath: string): Promise<sharp.Metadata> {
    try {
      return await sharp(inputPath).metadata();
    } catch (error) {
      console.error('[ImageOptimization] Error getting image info:', error);
      throw new Error(`Failed to get image info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate optimal dimensions maintaining aspect ratio
   * @param originalWidth Original width
   * @param originalHeight Original height
   * @param maxWidth Maximum width
   * @param maxHeight Maximum height
   * @returns { width: number; height: number }
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    let width = originalWidth;
    let height = originalHeight;

    // Scale down if needed
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  /**
   * Split array into chunks
   * @param array Array to chunk
   * @param size Chunk size
   * @returns T[][]
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get optimization statistics
   * @param results Array of optimization results
   * @returns Optimization statistics
   */
  static getOptimizationStats(results: OptimizationResult[]): {
    totalOriginalSize: number;
    totalOptimizedSize: number;
    averageCompressionRatio: number;
    totalSavings: number;
    formatBreakdown: Record<string, number>;
  } {
    const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalOptimizedSize = results.reduce((sum, r) => sum + r.optimizedSize, 0);
    const averageCompressionRatio = results.reduce((sum, r) => sum + r.compressionRatio, 0) / results.length;
    const totalSavings = totalOriginalSize - totalOptimizedSize;

    const formatBreakdown = results.reduce((acc, r) => {
      acc[r.format] = (acc[r.format] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOriginalSize,
      totalOptimizedSize,
      averageCompressionRatio,
      totalSavings,
      formatBreakdown
    };
  }
}

// Export singleton instance
export const imageOptimizationService = new ImageOptimizationService();
