import sharp from 'sharp';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

interface TextureOptions {
  tileWidthMm?: number;
  tileHeightMm?: number;
  sheetWidthMm?: number;
  sheetHeightMm?: number;
  groutWidthMm?: number;
  makeSeamless?: boolean;
}

interface ProcessedTexture {
  textureUrl: string;
  thumbnailUrl: string;
  physicalRepeatM: number;
}

export class TextureProcessor {
  private readonly uploadDir = 'uploads';
  private readonly textureDir = 'uploads/textures';
  private readonly thumbDir = 'uploads/thumbs';

  constructor() {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    await fs.mkdir(this.uploadDir, { recursive: true });
    await fs.mkdir(this.textureDir, { recursive: true });
    await fs.mkdir(this.thumbDir, { recursive: true });
  }

  async processTexture(inputPath: string, options: TextureOptions = {}): Promise<ProcessedTexture> {
    const textureId = randomUUID();
    const textureFilename = `${textureId}.jpg`;
    const thumbFilename = `${textureId}.jpg`;
    
    const texturePath = path.join(this.textureDir, textureFilename);
    const thumbPath = path.join(this.thumbDir, thumbFilename);

    // Load and normalize the image
    let image = sharp(inputPath)
      .withMetadata()
      .rotate() // Auto-rotate based on EXIF
      .toColorspace('srgb');

    // Get image metadata
    const metadata = await image.metadata();
    const { width = 1024, height = 1024 } = metadata;

    // Square crop or pad to max edge (center)
    const maxDim = Math.max(width, height);
    const squareImage = image
      .resize(maxDim, maxDim, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      });

    // Determine output size based on quality
    const outputSize = maxDim >= 1500 ? 2048 : 1024;
    
    let processedImage = squareImage.resize(outputSize, outputSize, {
      kernel: sharp.kernel.lanczos3
    });

    // Make seamless if requested
    if (options.makeSeamless !== false) {
      processedImage = await this.makeSeamless(processedImage, outputSize);
    }

    // Export optimized texture
    await processedImage
      .jpeg({
        quality: 85,
        progressive: true,
        mozjpeg: true
      })
      .toFile(texturePath);

    // Create thumbnail
    await sharp(texturePath)
      .resize(256, 256, {
        kernel: sharp.kernel.lanczos3
      })
      .jpeg({ quality: 80 })
      .toFile(thumbPath);

    // Calculate physical repeat
    const physicalRepeatM = this.calculatePhysicalRepeat(options);

    // Return URLs (in production these would be CDN URLs)
    return {
      textureUrl: `/uploads/textures/${textureFilename}`,
      thumbnailUrl: `/uploads/thumbs/${thumbFilename}`,
      physicalRepeatM
    };
  }

  private async makeSeamless(image: sharp.Sharp, size: number): Promise<sharp.Sharp> {
    // Create offset version (50% in X and Y)
    const offsetX = Math.floor(size / 2);
    const offsetY = Math.floor(size / 2);

    // Get the image buffer
    const imageBuffer = await image.png().toBuffer();
    
    // Create the offset image by cropping and compositing
    const topLeft = sharp(imageBuffer)
      .extract({ left: offsetX, top: offsetY, width: size - offsetX, height: size - offsetY });
    
    const topRight = sharp(imageBuffer)
      .extract({ left: 0, top: offsetY, width: offsetX, height: size - offsetY });
    
    const bottomLeft = sharp(imageBuffer)
      .extract({ left: offsetX, top: 0, width: size - offsetX, height: offsetY });
    
    const bottomRight = sharp(imageBuffer)
      .extract({ left: 0, top: 0, width: offsetX, height: offsetY });

    // Reassemble the offset image
    const offsetImage = sharp({
      create: {
        width: size,
        height: size,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    })
    .composite([
      { input: await topLeft.toBuffer(), left: 0, top: 0 },
      { input: await topRight.toBuffer(), left: size - offsetX, top: 0 },
      { input: await bottomLeft.toBuffer(), left: 0, top: size - offsetY },
      { input: await bottomRight.toBuffer(), left: size - offsetX, top: size - offsetY }
    ]);

    // Create blend mask for seam blending
    await this.createSeamBlendMask(size);
    
    // Blend the original and offset images
    const originalBuffer = await image.png().toBuffer();
    const offsetBuffer = await offsetImage.png().toBuffer();
    
    // Simple blend - in production would use more sophisticated blending
    return sharp(originalBuffer)
      .composite([
        {
          input: offsetBuffer,
          blend: 'overlay'
        }
      ]);
  }

  private async createSeamBlendMask(size: number): Promise<Buffer> {
    // Create a cross-shaped mask for blending seams
    const mask = sharp({
      create: {
        width: size,
        height: size,
        channels: 3,
        background: { r: 128, g: 128, b: 128 } // 50% gray
      }
    });

    return mask.png().toBuffer();
  }

  private calculatePhysicalRepeat(options: TextureOptions): number {
    // Calculate the physical repeat in meters
    if (options.sheetWidthMm && options.sheetWidthMm > 0) {
      return options.sheetWidthMm / 1000;
    } else if (options.tileWidthMm && options.tileWidthMm > 0) {
      return options.tileWidthMm / 1000;
    } else {
      return 0.30; // Default 30cm repeat
    }
  }

  async cleanup(filePath: string) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn('Failed to cleanup file:', filePath, error);
    }
  }
}

export const textureProcessor = new TextureProcessor();