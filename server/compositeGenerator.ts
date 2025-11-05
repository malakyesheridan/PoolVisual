import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';
import { storage } from './storage';
import { Mask, Material } from '@shared/schema';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';

export interface CompositeResult {
  beforeUrl: string;
  afterUrl: string;
  sideBySideUrl: string;
  status: 'completed' | 'failed';
  hasEdits: boolean;
  error?: string;
}

export class CompositeGenerator {
  private compositesDir = path.join(process.cwd(), 'uploads', 'composites');
  
  constructor() {
    // Ensure composites directory exists
    if (!fs.existsSync(this.compositesDir)) {
      fs.mkdirSync(this.compositesDir, { recursive: true });
    }
  }

  async generateComposite(photoId: string): Promise<CompositeResult> {
    try {
      console.log(`[CompositeGenerator] Starting composite generation for photo: ${photoId}`);
      
      // Get photo and masks
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        throw new Error('Photo not found');
      }

      const masks = await storage.getMasksByPhoto(photoId);
      console.log(`[CompositeGenerator] Found ${masks.length} masks for photo`);
      
      if (masks.length === 0) {
        console.log(`[CompositeGenerator] No masks found, returning original image`);
        return {
          beforeUrl: photo.originalUrl,
          afterUrl: photo.originalUrl,
          sideBySideUrl: photo.originalUrl,
          status: 'completed',
          hasEdits: false
        };
      }

      // Generate composite
      const compositeUrl = await this.renderComposite(photo.originalUrl, masks);
      console.log(`[CompositeGenerator] Composite generated successfully: ${compositeUrl}`);
      
      return {
        beforeUrl: photo.originalUrl,
        afterUrl: compositeUrl,
        sideBySideUrl: compositeUrl, // For now, same as after
        status: 'completed',
        hasEdits: true
      };

    } catch (error) {
      console.error('[CompositeGenerator] Composite generation failed:', error);
      return {
        beforeUrl: '',
        afterUrl: '',
        sideBySideUrl: '',
        status: 'failed',
        hasEdits: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async renderComposite(originalUrl: string, masks: Mask[]): Promise<string> {
    console.log(`[CompositeGenerator] Loading original image: ${originalUrl}`);
    
    // Load original image
    const originalImage = await this.loadImage(originalUrl);
    console.log(`[CompositeGenerator] Image loaded: ${originalImage.width}x${originalImage.height}`);
    
    // Create canvas
    const canvas = createCanvas(originalImage.width, originalImage.height);
    const ctx = canvas.getContext('2d');
    
    // Draw original image
    ctx.drawImage(originalImage, 0, 0);
    console.log(`[CompositeGenerator] Original image drawn to canvas`);
    
    // Apply masks with materials
    for (const mask of masks) {
      if (mask.materialId) {
        console.log(`[CompositeGenerator] Applying material ${mask.materialId} to mask ${mask.id}`);
        await this.applyMaterialToMask(ctx, mask, originalImage.width, originalImage.height);
      } else {
        console.log(`[CompositeGenerator] Mask ${mask.id} has no material, skipping`);
      }
    }
    
    // Save composite
    const filename = `composite-${randomUUID()}.png`;
    const filepath = path.join(this.compositesDir, filename);
    
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filepath, buffer);
    
    console.log(`[CompositeGenerator] Composite saved to: ${filepath}`);
    return `/uploads/composites/${filename}`;
  }

  private async applyMaterialToMask(
    ctx: CanvasRenderingContext2D, 
    mask: Mask, 
    width: number, 
    height: number
  ): Promise<void> {
    try {
      console.log(`[CompositeGenerator] Processing mask ${mask.id}, pathJson type:`, typeof mask.pathJson);
      console.log(`[CompositeGenerator] Raw pathJson:`, mask.pathJson);
      
      // Parse mask path - pathJson is stored as JSON string in database
      let pathData = mask.pathJson as any;
      
      // Handle JSON string format (this is how it's stored in the database)
      if (typeof pathData === 'string') {
        try {
          pathData = JSON.parse(pathData);
        } catch (parseError) {
          console.log(`[CompositeGenerator] Failed to parse pathJson string for mask ${mask.id}:`, parseError);
          return;
        }
      }
      
      console.log(`[CompositeGenerator] Parsed pathData:`, pathData);
      
      // Extract points array - pathData should be an array of MaskPoints
      let points: Array<{x: number, y: number, kind?: string, h1?: {x: number, y: number}, h2?: {x: number, y: number}}> = [];
      
      if (Array.isArray(pathData)) {
        // Direct array format: [{x, y, kind?, h1?, h2?}, ...]
        points = pathData.map((point: any) => {
          if (typeof point === 'object' && point !== null) {
            return { 
              x: point.x || point[0] || 0, 
              y: point.y || point[1] || 0,
              kind: point.kind || 'corner',
              h1: point.h1,
              h2: point.h2
            };
          }
          return { x: 0, y: 0, kind: 'corner' };
        });
      } else if (pathData && typeof pathData === 'object' && pathData.points) {
        // Object with points property: {points: [{x, y, kind?, h1?, h2?}, ...]}
        points = Array.isArray(pathData.points) 
          ? pathData.points.map((point: any) => ({
              x: point.x || point[0] || 0,
              y: point.y || point[1] || 0,
              kind: point.kind || 'corner',
              h1: point.h1,
              h2: point.h2
            }))
          : [];
      } else {
        console.log(`[CompositeGenerator] Unexpected pathJson format for mask ${mask.id}:`, pathData);
        return;
      }
      
      if (points.length < 3) {
        console.log(`[CompositeGenerator] Invalid mask path data for mask ${mask.id} - insufficient points:`, points.length);
        console.log(`[CompositeGenerator] Points data:`, points);
        return;
      }
      
      console.log(`[CompositeGenerator] Mask ${mask.id} has ${points.length} points:`, points.slice(0, 3));
      
      // Create mask path with Bezier curve support
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length; i++) {
        const current = points[i];
        const prev = points[i - 1];
        
        if (current.kind === 'smooth' && current.h1 && current.h2) {
          // Bezier curve with handles
          ctx.bezierCurveTo(
            prev.h2?.x || prev.x, prev.h2?.y || prev.y,
            current.h1.x, current.h1.y,
            current.x, current.y
          );
        } else {
          // Linear segment
          ctx.lineTo(current.x, current.y);
        }
      }
      
      // Close the path
      const first = points[0];
      const last = points[points.length - 1];
      
      if (last.kind === 'smooth' && last.h1 && last.h2) {
        ctx.bezierCurveTo(
          last.h2.x, last.h2.y,
          first.h1?.x || first.x, first.h1?.y || first.y,
          first.x, first.y
        );
      } else {
        ctx.lineTo(first.x, first.y);
      }
      
      // Load and apply material with improved scaling
      if (mask.materialId) {
        const material = await storage.getMaterial(mask.materialId);
        if (material && material.textureUrl) {
          console.log(`[CompositeGenerator] Loading material texture: ${material.textureUrl}`);
          const materialImage = await this.loadImage(material.textureUrl);
          
          // Parse calcMetaJson for material settings (tileScale, underwater settings, etc.)
          let materialSettings: any = {};
          if (mask.calcMetaJson) {
            try {
              materialSettings = typeof mask.calcMetaJson === 'string' 
                ? JSON.parse(mask.calcMetaJson) 
                : mask.calcMetaJson;
              console.log(`[CompositeGenerator] Parsed material settings for mask ${mask.id}:`, materialSettings);
            } catch (parseError) {
              console.log(`[CompositeGenerator] Failed to parse calcMetaJson for mask ${mask.id}:`, parseError);
            }
          }
          
          // Apply improved texture scaling similar to client-side
          // Check for both textureScale and tileScale (textureScale is the correct field name)
          const tileScale = materialSettings.textureScale || materialSettings.tileScale || 1.0;
          console.log(`[CompositeGenerator] Using tileScale: ${tileScale} for mask ${mask.id}`);
          const pattern = this.createScaledPattern(ctx, materialImage, tileScale, width, height, material);
          
          if (pattern) {
            ctx.fillStyle = pattern;
            ctx.fill();
            console.log(`[CompositeGenerator] Scaled material pattern applied to mask ${mask.id} with tileScale: ${tileScale}`);
            
            // Apply basic underwater effects if settings exist
            if (materialSettings.underwaterRealism) {
              this.applyBasicUnderwaterEffects(ctx, materialSettings.underwaterRealism, points);
            }
          } else {
            console.log(`[CompositeGenerator] Failed to create scaled pattern for material ${mask.materialId}`);
            // Fallback to solid color
            ctx.fillStyle = 'rgba(0, 170, 0, 0.25)';
            ctx.fill();
          }
        } else {
          console.log(`[CompositeGenerator] Material ${mask.materialId} not found or has no texture URL`);
          // Fallback to solid color
          ctx.fillStyle = 'rgba(0, 170, 0, 0.25)';
          ctx.fill();
        }
      }
    } catch (error) {
      console.error(`[CompositeGenerator] Error applying material to mask ${mask.id}:`, error);
      // Fallback to solid color
      ctx.fillStyle = 'rgba(0, 170, 0, 0.25)';
      ctx.fill();
    }
  }

  private createScaledPattern(
    ctx: CanvasRenderingContext2D, 
    materialImage: any, 
    tileScale: number, 
    imageWidth: number, 
    imageHeight: number,
    material?: any
  ): CanvasPattern | null {
    try {
      // Use heuristic PPM similar to client-side (1000 pixels per meter)
      const heuristicPPM = 1000;
      // Use material's physicalRepeatM if available, otherwise default to 0.3 meters per tile
      const physicalRepeatM = material?.physicalRepeatM ? parseFloat(material.physicalRepeatM) : 0.3;
      const tileSizePx = (heuristicPPM * physicalRepeatM) / tileScale;
      
      console.log(`[CompositeGenerator] Creating scaled pattern: tileSizePx=${tileSizePx}, tileScale=${tileScale}, physicalRepeatM=${physicalRepeatM}`);
      
      // Create a temporary canvas for the scaled pattern
      const tempCanvas = createCanvas(tileSizePx, tileSizePx);
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        console.log(`[CompositeGenerator] Failed to get 2D context for pattern canvas`);
        return null;
      }
      
      // Draw the material image scaled to the calculated tile size
      tempCtx.drawImage(materialImage, 0, 0, tileSizePx, tileSizePx);
      
      // Create pattern from the scaled canvas
      const pattern = ctx.createPattern(tempCanvas, 'repeat');
      
      if (!pattern) {
        console.log(`[CompositeGenerator] Failed to create pattern from scaled canvas`);
        return null;
      }
      
      return pattern;
    } catch (error) {
      console.error(`[CompositeGenerator] Error creating scaled pattern:`, error);
      return null;
    }
  }

  private applyBasicUnderwaterEffects(
    ctx: CanvasRenderingContext2D, 
    underwaterSettings: any, 
    points: Array<{x: number, y: number}>
  ): void {
    try {
      if (!underwaterSettings.enabled || underwaterSettings.blend <= 0) {
        return;
      }
      
      const intensity = underwaterSettings.blend / 100;
      
      // Apply basic underwater tint (similar to client-side v1.0)
      ctx.globalCompositeOperation = 'multiply';
      
      // Basic underwater color adjustment
      const underwaterTint = {
        r: 0.65, // Reduce red significantly
        g: 0.90, // Slight green boost
        b: 1.15, // Blue boost
        brightness: 0.80 // Overall dimming
      };
      
      ctx.fillStyle = `rgba(${Math.floor(255 * underwaterTint.r)}, ${Math.floor(255 * underwaterTint.g)}, ${Math.floor(255 * underwaterTint.b)}, ${intensity})`;
      ctx.fill();
      
      // Reset composite operation
      ctx.globalCompositeOperation = 'source-over';
      
      console.log(`[CompositeGenerator] Applied basic underwater effects with intensity: ${intensity}`);
    } catch (error) {
      console.error(`[CompositeGenerator] Error applying underwater effects:`, error);
      // Reset composite operation on error
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private async loadImage(url: string): Promise<any> {
    try {
      // Handle both absolute and relative URLs
      let imageUrl = url;
      if (!url.startsWith('http')) {
        // Relative URL - prepend base URL
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        imageUrl = `${baseUrl}${url}`;
      }
      
      console.log(`[CompositeGenerator] Loading image from: ${imageUrl}`);
      const image = await loadImage(imageUrl);
      console.log(`[CompositeGenerator] Image loaded successfully: ${image.width}x${image.height}`);
      return image;
    } catch (error) {
      console.error(`[CompositeGenerator] Failed to load image from ${url}:`, error);
      throw new Error(`Failed to load image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
