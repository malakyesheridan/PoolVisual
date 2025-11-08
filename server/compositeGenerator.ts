import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';
import { storage } from './storage.js';
import { Mask, Material } from '../shared/schema.js';
import { randomUUID } from 'crypto';
import { storageService } from './lib/storageService.js';
import sharp from 'sharp';

export interface CompositeResult {
  beforeUrl: string;
  afterUrl: string;
  sideBySideUrl: string;
  status: 'completed' | 'failed';
  hasEdits: boolean;
  error?: string;
}

export class CompositeGenerator {
  // Maximum dimension for composite generation (to prevent timeouts and memory issues)
  // Reduced to 1500px to ensure completion within Vercel's 30s timeout
  private static readonly MAX_COMPOSITE_DIMENSION = 1500;
  // JPEG quality for composite output (smaller file size, faster upload)
  private static readonly COMPOSITE_QUALITY = 85;

  async generateComposite(photoId: string, forceRegenerate: boolean = false): Promise<CompositeResult> {
    try {
      console.log(`[CompositeGenerator] Starting composite generation for photo: ${photoId}`);
      
      // Get photo and masks
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        throw new Error('Photo not found');
      }

      let masks = await storage.getMasksByPhoto(photoId);
      console.log(`[CompositeGenerator] Found ${masks.length} masks for photo`);
      
      // Sort masks by zIndex to match client-side rendering order (lower zIndex renders first/behind)
      masks = masks.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      console.log(`[CompositeGenerator] Masks sorted by zIndex:`, masks.map(m => ({ id: m.id, zIndex: m.zIndex || 0, materialId: m.materialId })));
      
      // Log actual mask coordinates from database for debugging
      masks.forEach((mask, idx) => {
        try {
          let pathData = mask.pathJson;
          if (typeof pathData === 'string') {
            pathData = JSON.parse(pathData);
          }
          if (Array.isArray(pathData) && pathData.length > 0) {
            const firstPt = pathData[0];
            const lastPt = pathData[pathData.length - 1];
            const minX = Math.min(...pathData.map((p: any) => p.x || p[0] || 0));
            const maxX = Math.max(...pathData.map((p: any) => p.x || p[0] || 0));
            const minY = Math.min(...pathData.map((p: any) => p.y || p[1] || 0));
            const maxY = Math.max(...pathData.map((p: any) => p.y || p[1] || 0));
            console.log(`[CompositeGenerator] Mask ${idx + 1} (${mask.id}): ${pathData.length} points`);
            console.log(`[CompositeGenerator]   First point:`, firstPt);
            console.log(`[CompositeGenerator]   Last point:`, lastPt);
            console.log(`[CompositeGenerator]   Bounding box: X[${minX.toFixed(2)}, ${maxX.toFixed(2)}], Y[${minY.toFixed(2)}, ${maxY.toFixed(2)}]`);
            console.log(`[CompositeGenerator]   Photo dimensions (DB): ${photo.width}x${photo.height}`);
            if (minX < 0 || minY < 0) {
              console.warn(`[CompositeGenerator]   ⚠️ Mask has negative coordinates!`);
            }
            if (maxX > photo.width || maxY > photo.height) {
              console.warn(`[CompositeGenerator]   ⚠️ Mask extends beyond photo dimensions!`);
            }
          }
        } catch (e) {
          console.warn(`[CompositeGenerator] Failed to parse mask ${mask.id} coordinates:`, e);
        }
      });
      
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

      // Check if we can use cached composite
      if (!forceRegenerate && photo.compositeUrl && photo.compositeGeneratedAt) {
        // Check if any mask was updated after composite was generated
        const latestMaskUpdate = masks.reduce((latest, mask) => {
          const maskDate = mask.createdAt ? new Date(mask.createdAt) : new Date(0);
          return maskDate > latest ? maskDate : latest;
        }, new Date(0));

        const compositeDate = new Date(photo.compositeGeneratedAt);
        
        // If composite is newer than all masks, use cached version
        if (compositeDate >= latestMaskUpdate) {
          console.log(`[CompositeGenerator] Using cached composite: ${photo.compositeUrl}`);
          return {
            beforeUrl: photo.originalUrl,
            afterUrl: photo.compositeUrl,
            sideBySideUrl: photo.compositeUrl,
            status: 'completed',
            hasEdits: true
          };
        } else {
          console.log(`[CompositeGenerator] Masks updated after composite generation, regenerating`);
        }
      }

      // Generate composite
      const compositeUrl = await this.renderComposite(photo.originalUrl, masks, photo.width, photo.height);
      console.log(`[CompositeGenerator] Composite generated successfully: ${compositeUrl}`);
      
      // Store composite URL in database
      await storage.updatePhotoComposite(photoId, compositeUrl);
      
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

  private async renderComposite(
    originalUrl: string, 
    masks: Mask[], 
    originalWidth: number,
    originalHeight: number
  ): Promise<string> {
    console.log(`[CompositeGenerator] Loading original image: ${originalUrl}`);
    console.log(`[CompositeGenerator] Database dimensions: ${originalWidth}x${originalHeight}`);
    
    // Load and optimize original image before processing
    const startTime = Date.now();
    const optimizedImage = await this.loadAndOptimizeImage(originalUrl, originalWidth, originalHeight);
    const imageLoadTime = Date.now() - startTime;
    console.log(`[CompositeGenerator] Image loaded in ${imageLoadTime}ms`);
    
    // CRITICAL FIX: Masks are saved relative to database dimensions (photoSpace.imgW/imgH = photo.width/height)
    // After Phase 3, the editor uses database dimensions for photoSpace, so masks are saved relative to those
    // We MUST use database dimensions as the mask reference, not actual image dimensions
    const actualLoadedWidth = optimizedImage.width;
    const actualLoadedHeight = optimizedImage.height;
    
    // Use database dimensions as the mask reference (what masks were saved relative to)
    // Masks are saved using photoSpace.imgW/imgH which comes from photo.width/height (database)
    const maskReferenceWidth = originalWidth;  // Database dimensions (what masks were saved relative to)
    const maskReferenceHeight = originalHeight; // Database dimensions (what masks were saved relative to)
    
    // CRITICAL: Calculate scale from database dimensions (what masks were saved relative to) to optimized dimensions
    // Mask coordinates are stored relative to database dimensions (photo.width/height)
    // So we scale: mask_coords (in database dimensions) -> optimized_coords (in resized image)
    const scaleX = actualLoadedWidth / maskReferenceWidth;
    const scaleY = actualLoadedHeight / maskReferenceHeight;
    
    // Log for debugging - compare database vs actual dimensions
    const actualOriginalWidth = optimizedImage.actualOriginalWidth;
    const actualOriginalHeight = optimizedImage.actualOriginalHeight;
    if (Math.abs(actualOriginalWidth - originalWidth) > 1 || Math.abs(actualOriginalHeight - originalHeight) > 1) {
      console.warn(`[CompositeGenerator] ⚠️ Dimension mismatch detected:`, {
        database: `${originalWidth}x${originalHeight}`,
        actual: `${actualOriginalWidth}x${actualOriginalHeight}`,
        using: 'database dimensions for mask scaling (masks were saved relative to database dimensions)'
      });
    }
    
    console.log(`[CompositeGenerator] Scale factors (database->optimized): scaleX=${scaleX.toFixed(4)}, scaleY=${scaleY.toFixed(4)}`);
    console.log(`[CompositeGenerator] Reference dimensions: ${maskReferenceWidth}x${maskReferenceHeight} (database), Optimized: ${actualLoadedWidth}x${actualLoadedHeight}`);
    
    // Create canvas with actual optimized dimensions
    const canvas = createCanvas(actualLoadedWidth, actualLoadedHeight);
    const ctx = canvas.getContext('2d');
    
    // Draw optimized original image
    ctx.drawImage(optimizedImage, 0, 0);
    console.log(`[CompositeGenerator] Original image drawn to canvas`);
    
    // Preload all materials in parallel for better performance
    const materialLoadStart = Date.now();
    const materialPromises = masks
      .filter(mask => mask.materialId)
      .map(async (mask) => {
        try {
          const material = await storage.getMaterial(mask.materialId!);
          return { maskId: mask.id, material };
        } catch (error) {
          console.warn(`[CompositeGenerator] Failed to load material for mask ${mask.id}:`, error);
          return { maskId: mask.id, material: null };
        }
      });
    
    const materialResults = await Promise.all(materialPromises);
    const materialMap = new Map(materialResults.map(r => [r.maskId, r.material]));
    const materialLoadTime = Date.now() - materialLoadStart;
    console.log(`[CompositeGenerator] Loaded ${materialMap.size} materials in ${materialLoadTime}ms`);
    
    // Log material mapping for debugging
    materialResults.forEach(r => {
      console.log(`[CompositeGenerator] Material mapping: mask ${r.maskId} -> material ${r.material?.id || 'null'} (${r.material?.name || 'none'})`);
    });
    
    // Preload all material textures in parallel for better performance
    const textureLoadStart = Date.now();
    const texturePromises = materialResults
      .filter(r => r.material && r.material.textureUrl)
      .map(async (r) => {
        try {
          const textureImage = await this.loadImage(r.material!.textureUrl!);
          return { maskId: r.maskId, textureImage };
        } catch (error) {
          console.warn(`[CompositeGenerator] Failed to load texture for mask ${r.maskId}:`, error);
          return { maskId: r.maskId, textureImage: null };
        }
      });
    
    const textureResults = await Promise.all(texturePromises);
    const textureMap = new Map(textureResults.map(r => [r.maskId, r.textureImage]));
    const textureLoadTime = Date.now() - textureLoadStart;
    console.log(`[CompositeGenerator] Loaded ${textureMap.size} textures in ${textureLoadTime}ms`);
    
    // Apply masks with materials
    const maskApplyStart = Date.now();
    for (const mask of masks) {
      if (mask.materialId) {
        const material = materialMap.get(mask.id);
        if (material) {
          console.log(`[CompositeGenerator] Applying material to mask:`, {
            maskId: mask.id,
            maskMaterialId: mask.materialId,
            materialId: material.id,
            materialName: material.name,
            materialMatch: mask.materialId === material.id ? '✅ MATCH' : '❌ MISMATCH'
          });
          const textureImage = textureMap.get(mask.id);
          await this.applyMaterialToMask(
            ctx, 
            mask, 
            actualLoadedWidth, 
            actualLoadedHeight,
            scaleX,
            scaleY,
            material,
            textureImage || undefined
          );
        } else {
          console.warn(`[CompositeGenerator] ⚠️ Material not found in map for mask ${mask.id} (expected materialId: ${mask.materialId})`);
          console.warn(`[CompositeGenerator] Available mask IDs in materialMap:`, Array.from(materialMap.keys()));
        }
      } else {
        console.log(`[CompositeGenerator] Mask ${mask.id} has no material, skipping`);
      }
    }
    const maskApplyTime = Date.now() - maskApplyStart;
    console.log(`[CompositeGenerator] Applied ${masks.length} masks in ${maskApplyTime}ms`);
    
    // Convert canvas to JPEG buffer (smaller than PNG)
    const buffer = canvas.toBuffer('image/jpeg', { quality: CompositeGenerator.COMPOSITE_QUALITY });
    console.log(`[CompositeGenerator] Canvas converted to JPEG buffer: ${buffer.length} bytes`);
    
    // Upload to cloud storage
    const filename = `composites/composite-${randomUUID()}.jpg`;
    const compositeUrl = await storageService.put(filename, buffer, 'image/jpeg');
    
    console.log(`[CompositeGenerator] Composite uploaded to cloud storage: ${compositeUrl}`);
    return compositeUrl;
  }

  /**
   * Load and optimize image before processing
   * Resizes to MAX_COMPOSITE_DIMENSION if larger, maintains aspect ratio
   * Returns image with actual dimensions attached
   */
  private async loadAndOptimizeImage(
    url: string, 
    databaseWidth: number, 
    databaseHeight: number
  ): Promise<any & { actualOriginalWidth: number; actualOriginalHeight: number }> {
    try {
      // Handle both absolute and relative URLs
      let imageUrl = url;
      if (!url.startsWith('http')) {
        // Relative URL - prepend base URL
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        imageUrl = `${baseUrl}${url}`;
      }
      
      console.log(`[CompositeGenerator] Loading image from: ${imageUrl}`);
      
      // Fetch image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const imageBuffer = Buffer.from(await response.arrayBuffer());
      
      // CRITICAL: Get ACTUAL image dimensions from the fetched image
      // This ensures we use the real dimensions, not potentially incorrect database values
      const actualMetadata = await sharp(imageBuffer).metadata();
      const actualOriginalWidth = actualMetadata.width || databaseWidth;
      const actualOriginalHeight = actualMetadata.height || databaseHeight;
      
      console.log(`[CompositeGenerator] Actual image dimensions: ${actualOriginalWidth}x${actualOriginalHeight} (database: ${databaseWidth}x${databaseHeight})`);
      
      // Check if database dimensions match actual dimensions
      if (Math.abs(actualOriginalWidth - databaseWidth) > 1 || Math.abs(actualOriginalHeight - databaseHeight) > 1) {
        console.warn(`[CompositeGenerator] ⚠️ Dimension mismatch! Database: ${databaseWidth}x${databaseHeight}, Actual: ${actualOriginalWidth}x${actualOriginalHeight}`);
        console.warn(`[CompositeGenerator] Using actual dimensions for mask coordinate scaling`);
      }
      
      // Calculate optimized dimensions based on ACTUAL image dimensions
      const maxDim = CompositeGenerator.MAX_COMPOSITE_DIMENSION;
      let targetWidth = actualOriginalWidth;
      let targetHeight = actualOriginalHeight;
      
      if (actualOriginalWidth > maxDim || actualOriginalHeight > maxDim) {
        const scale = Math.min(maxDim / actualOriginalWidth, maxDim / actualOriginalHeight);
        targetWidth = Math.floor(actualOriginalWidth * scale);
        targetHeight = Math.floor(actualOriginalHeight * scale);
        console.log(`[CompositeGenerator] Resizing from ${actualOriginalWidth}x${actualOriginalHeight} to ${targetWidth}x${targetHeight}`);
      }
      
      // Use Sharp to resize and optimize
      let processedBuffer = imageBuffer;
      
      if (targetWidth !== actualOriginalWidth || targetHeight !== actualOriginalHeight) {
        // Use Sharp to resize
        processedBuffer = await sharp(imageBuffer)
          .resize(targetWidth, targetHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 90, progressive: true })
          .toBuffer();
      }
      
      // Load optimized image into canvas-compatible format
      const image = await loadImage(processedBuffer);
      console.log(`[CompositeGenerator] Image loaded successfully: ${image.width}x${image.height} (target: ${targetWidth}x${targetHeight})`);
      
      // Attach actual original dimensions to the image object for accurate scaling
      return Object.assign(image, {
        actualOriginalWidth,
        actualOriginalHeight
      });
    } catch (error) {
      console.error(`[CompositeGenerator] Failed to load/optimize image from ${url}:`, error);
      throw new Error(`Failed to load image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async applyMaterialToMask(
    ctx: CanvasRenderingContext2D, 
    mask: Mask, 
    width: number, 
    height: number,
    scaleX: number,
    scaleY: number,
    material?: Material | null,
    preloadedTextureImage?: any
  ): Promise<void> {
    try {
      console.log(`[CompositeGenerator] Processing mask ${mask.id}, pathJson type:`, typeof mask.pathJson);
      
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
      
      // Extract points array - pathData should be an array of MaskPoints
      let points: Array<{x: number, y: number, kind?: string, h1?: {x: number, y: number}, h2?: {x: number, y: number}}> = [];
      
      if (Array.isArray(pathData)) {
        // Direct array format: [{x, y, kind?, h1?, h2?}, ...]
        console.log(`[CompositeGenerator] Mask ${mask.id} has ${pathData.length} points in array format`);
        
        // Log first few points before scaling for debugging
        if (pathData.length > 0) {
          const firstPoint = pathData[0];
          const lastPoint = pathData[pathData.length - 1];
          console.log(`[CompositeGenerator] First point before scaling:`, firstPoint);
          console.log(`[CompositeGenerator] Last point before scaling:`, lastPoint);
          console.log(`[CompositeGenerator] Scale factors: scaleX=${scaleX.toFixed(4)}, scaleY=${scaleY.toFixed(4)}`);
          
          // Check for negative coordinates (indicates potential offset issue)
          const hasNegative = pathData.some((pt: any) => {
            const x = pt.x || pt[0] || 0;
            const y = pt.y || pt[1] || 0;
            return x < 0 || y < 0;
          });
          if (hasNegative) {
            console.warn(`[CompositeGenerator] ⚠️ Mask ${mask.id} has negative coordinates! This may indicate an offset issue.`);
            const negativePoints = pathData.filter((pt: any) => {
              const x = pt.x || pt[0] || 0;
              const y = pt.y || pt[1] || 0;
              return x < 0 || y < 0;
            });
            console.warn(`[CompositeGenerator] Negative points:`, negativePoints.slice(0, 3));
          }
        }
        
        points = pathData.map((point: any, index: number) => {
          if (typeof point === 'object' && point !== null) {
            const originalX = point.x || point[0] || 0;
            const originalY = point.y || point[1] || 0;
            
            // Scale coordinates
            let scaledX = originalX * scaleX;
            let scaledY = originalY * scaleY;
            
            // Clamp coordinates to canvas bounds to prevent negative or out-of-bounds values
            // This handles cases where masks were drawn near edges with imgFit offsets
            scaledX = Math.max(0, Math.min(scaledX, width - 1));
            scaledY = Math.max(0, Math.min(scaledY, height - 1));
            
            // Log first and last points for debugging
            if (index === 0 || index === pathData.length - 1) {
              const wasClamped = (originalX * scaleX !== scaledX) || (originalY * scaleY !== scaledY);
              if (wasClamped) {
                console.warn(`[CompositeGenerator] Point ${index} was clamped: (${originalX}, ${originalY}) -> (${scaledX.toFixed(2)}, ${scaledY.toFixed(2)}) [original scaled: (${(originalX * scaleX).toFixed(2)}, ${(originalY * scaleY).toFixed(2)})]`);
              } else {
                console.log(`[CompositeGenerator] Point ${index}: (${originalX}, ${originalY}) -> (${scaledX.toFixed(2)}, ${scaledY.toFixed(2)})`);
              }
            }
            
            return { 
              x: scaledX, 
              y: scaledY,
              kind: point.kind || 'corner',
              h1: point.h1 ? { 
                x: Math.max(0, Math.min(point.h1.x * scaleX, width - 1)), 
                y: Math.max(0, Math.min(point.h1.y * scaleY, height - 1)) 
              } : undefined,
              h2: point.h2 ? { 
                x: Math.max(0, Math.min(point.h2.x * scaleX, width - 1)), 
                y: Math.max(0, Math.min(point.h2.y * scaleY, height - 1)) 
              } : undefined
            };
          }
          return { x: 0, y: 0, kind: 'corner' };
        });
        
        // Log bounding box of scaled points
        if (points.length > 0) {
          const minX = Math.min(...points.map(p => p.x));
          const maxX = Math.max(...points.map(p => p.x));
          const minY = Math.min(...points.map(p => p.y));
          const maxY = Math.max(...points.map(p => p.y));
          console.log(`[CompositeGenerator] Scaled mask bounding box: (${minX.toFixed(2)}, ${minY.toFixed(2)}) to (${maxX.toFixed(2)}, ${maxY.toFixed(2)})`);
          console.log(`[CompositeGenerator] Canvas dimensions: ${width}x${height}`);
        }
      } else if (pathData && typeof pathData === 'object' && pathData.points) {
        // Object with points property: {points: [{x, y, kind?, h1?, h2?}, ...]}
        points = Array.isArray(pathData.points) 
          ? pathData.points.map((point: any) => ({
              x: (point.x || point[0] || 0) * scaleX,
              y: (point.y || point[1] || 0) * scaleY,
              kind: point.kind || 'corner',
              h1: point.h1 ? { x: point.h1.x * scaleX, y: point.h1.y * scaleY } : undefined,
              h2: point.h2 ? { x: point.h2.x * scaleX, y: point.h2.y * scaleY } : undefined
            }))
          : [];
      } else {
        console.log(`[CompositeGenerator] Unexpected pathJson format for mask ${mask.id}:`, pathData);
        return;
      }
      
      if (points.length < 3) {
        console.log(`[CompositeGenerator] Invalid mask path data for mask ${mask.id} - insufficient points:`, points.length);
        return;
      }
      
      console.log(`[CompositeGenerator] Mask ${mask.id} has ${points.length} points`);
      
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
      if (mask.materialId && material && material.textureUrl) {
        // Use preloaded texture if available, otherwise load it
        const materialImage = preloadedTextureImage || await this.loadImage(material.textureUrl);
        if (!materialImage) {
          console.log(`[CompositeGenerator] Failed to load material texture for mask ${mask.id}`);
          ctx.fillStyle = 'rgba(0, 170, 0, 0.25)';
          ctx.fill();
          return;
        }
        
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
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const image = await loadImage(buffer);
      console.log(`[CompositeGenerator] Image loaded successfully: ${image.width}x${image.height}`);
      return image;
    } catch (error) {
      console.error(`[CompositeGenerator] Failed to load image from ${url}:`, error);
      throw new Error(`Failed to load image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
