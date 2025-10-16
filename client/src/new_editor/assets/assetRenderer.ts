// Asset Rendering Pipeline
// Handles rendering of assets with blend modes, opacity, and transform effects

import { Asset, Blend } from './types';
import { getCachedImage, imageCacheFull, imageCacheThumb } from './imageCache';
import { assetSource } from './assetSource';

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  photoSpace: any;
  dpr: number;
  isExport: boolean;
}

export interface RenderOptions {
  includeHidden: boolean;
  includeLocked: boolean;
  maxTimeoutMs: number;
  fallbackToThumb: boolean;
}

class AssetRenderer {
  private renderQueue: Asset[] = [];
  private loadingAssets: Set<string> = new Set();
  private renderTimeout: number = 5000; // 5 seconds per asset

  // Main render function
  async renderAssets(
    assets: Asset[], 
    context: RenderContext, 
    options: RenderOptions = {
      includeHidden: false,
      includeLocked: true,
      maxTimeoutMs: 5000,
      fallbackToThumb: true
    }
  ): Promise<void> {
    const { ctx, photoSpace, dpr, isExport } = context;
    
    // Filter assets based on options
    const visibleAssets = assets.filter(asset => {
      if (!options.includeHidden && asset.hidden) return false;
      if (!options.includeLocked && asset.locked) return false;
      return true;
    });

    // Sort by z-order (bottom to top)
    const sortedAssets = visibleAssets.sort((a, b) => a.z - b.z);

    // Render each asset
    for (const asset of sortedAssets) {
      await this.renderAsset(asset, context, options);
    }
  }

  // Render a single asset
  private async renderAsset(
    asset: Asset, 
    context: RenderContext, 
    options: RenderOptions
  ): Promise<void> {
    const { ctx, photoSpace, dpr } = context;
    
    // Get source item
    const sourceItem = assetSource.getItemById(asset.sourceId);
    if (!sourceItem) {
      console.warn(`Asset source item not found: ${asset.sourceId}`);
      return;
    }

    // Try to load full image first
    let imageEntry;
    try {
      const fullKey = assetSource.getCacheKey(sourceItem);
      imageEntry = await this.loadImageWithTimeout(
        fullKey, 
        sourceItem.src, 
        imageCacheFull,
        options.maxTimeoutMs
      );
    } catch (error) {
      // Fallback to thumbnail if enabled
      if (options.fallbackToThumb) {
        try {
          const thumbKey = assetSource.getThumbCacheKey(sourceItem);
          imageEntry = await this.loadImageWithTimeout(
            thumbKey, 
            sourceItem.thumb, 
            imageCacheThumb,
            options.maxTimeoutMs
          );
          console.warn(`Using thumbnail for asset ${asset.id}: ${sourceItem.name}`);
        } catch (thumbError) {
          console.error(`Failed to load both full and thumbnail for asset ${asset.id}:`, thumbError);
          this.renderPlaceholder(asset, context);
          return;
        }
      } else {
        console.error(`Failed to load full image for asset ${asset.id}:`, error);
        this.renderPlaceholder(asset, context);
        return;
      }
    }

    if (imageEntry.status !== 'ready') {
      this.renderPlaceholder(asset, context);
      return;
    }

    // Calculate transform
    const transform = this.calculateTransform(asset, imageEntry, context);
    
    // Save context state
    ctx.save();
    
    try {
      // Apply blend mode and opacity
      ctx.globalAlpha = asset.opacity;
      ctx.globalCompositeOperation = this.getBlendMode(asset.blend);
      
      // Apply transform
      ctx.translate(transform.centerX, transform.centerY);
      ctx.rotate((asset.rotation * Math.PI) / 180);
      
      if (asset.skewX) {
        ctx.transform(1, 0, Math.tan((asset.skewX * Math.PI) / 180), 1, 0, 0);
      }
      
      // Draw image
      ctx.drawImage(
        imageEntry.img,
        -transform.width / 2,
        -transform.height / 2,
        transform.width,
        transform.height
      );
      
    } finally {
      // Restore context state
      ctx.restore();
    }
  }

  // Load image with timeout
  private async loadImageWithTimeout(
    key: string, 
    src: string, 
    cache: any, 
    timeoutMs: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Image load timeout: ${src}`));
      }, timeoutMs);

      getCachedImage(key, src, cache)
        .then(entry => {
          clearTimeout(timeout);
          resolve(entry);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  // Calculate transform for asset
  private calculateTransform(asset: Asset, imageEntry: any, context: RenderContext) {
    const { photoSpace, dpr } = context;
    
    // Calculate scaled dimensions
    const scaledWidth = asset.natW * asset.scale;
    const scaledHeight = asset.natH * asset.scale;
    
    // Convert image coordinates to screen coordinates
    const screenCoords = photoSpace.imageToScreen(asset.x, asset.y);
    
    return {
      centerX: screenCoords.x,
      centerY: screenCoords.y,
      width: scaledWidth * dpr,
      height: scaledHeight * dpr
    };
  }

  // Render placeholder for missing images
  private renderPlaceholder(asset: Asset, context: RenderContext): void {
    const { ctx, photoSpace, dpr } = context;
    
    const scaledWidth = asset.natW * asset.scale;
    const scaledHeight = asset.natH * asset.scale;
    const screenCoords = photoSpace.imageToScreen(asset.x, asset.y);
    
    ctx.save();
    
    // Draw checker pattern placeholder
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(
      screenCoords.x - (scaledWidth * dpr) / 2,
      screenCoords.y - (scaledHeight * dpr) / 2,
      scaledWidth * dpr,
      scaledHeight * dpr
    );
    
    // Draw border
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      screenCoords.x - (scaledWidth * dpr) / 2,
      screenCoords.y - (scaledHeight * dpr) / 2,
      scaledWidth * dpr,
      scaledHeight * dpr
    );
    
    // Draw "?" in center
    ctx.fillStyle = '#9ca3af';
    ctx.font = `${Math.min(scaledWidth, scaledHeight) * dpr * 0.3}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', screenCoords.x, screenCoords.y);
    
    ctx.restore();
  }

  // Get blend mode for canvas
  private getBlendMode(blend: Blend): GlobalCompositeOperation {
    const blendMap: Record<Blend, GlobalCompositeOperation> = {
      'normal': 'source-over',
      'multiply': 'multiply',
      'screen': 'screen',
      'overlay': 'overlay',
      'darken': 'darken',
      'lighten': 'lighten'
    };
    
    return blendMap[blend] || 'source-over';
  }

  // Render transform gizmo
  renderTransformGizmo(asset: Asset, context: RenderContext): void {
    const { ctx, photoSpace, dpr } = context;
    
    const scaledWidth = asset.natW * asset.scale;
    const scaledHeight = asset.natH * asset.scale;
    const screenCoords = photoSpace.imageToScreen(asset.x, asset.y);
    
    ctx.save();
    
    // Draw selection outline
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(
      screenCoords.x - (scaledWidth * dpr) / 2,
      screenCoords.y - (scaledHeight * dpr) / 2,
      scaledWidth * dpr,
      scaledHeight * dpr
    );
    
    // Draw resize handles
    const handleSize = 8 * dpr;
    ctx.fillStyle = '#3b82f6';
    ctx.setLineDash([]);
    
    // Corner handles
    const corners = [
      { x: screenCoords.x - (scaledWidth * dpr) / 2, y: screenCoords.y - (scaledHeight * dpr) / 2 },
      { x: screenCoords.x + (scaledWidth * dpr) / 2, y: screenCoords.y - (scaledHeight * dpr) / 2 },
      { x: screenCoords.x - (scaledWidth * dpr) / 2, y: screenCoords.y + (scaledHeight * dpr) / 2 },
      { x: screenCoords.x + (scaledWidth * dpr) / 2, y: screenCoords.y + (scaledHeight * dpr) / 2 }
    ];
    
    corners.forEach(corner => {
      ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
    });
    
    // Side handles
    const sides = [
      { x: screenCoords.x, y: screenCoords.y - (scaledHeight * dpr) / 2 },
      { x: screenCoords.x + (scaledWidth * dpr) / 2, y: screenCoords.y },
      { x: screenCoords.x, y: screenCoords.y + (scaledHeight * dpr) / 2 },
      { x: screenCoords.x - (scaledWidth * dpr) / 2, y: screenCoords.y }
    ];
    
    sides.forEach(side => {
      ctx.fillRect(side.x - handleSize / 2, side.y - handleSize / 2, handleSize, handleSize);
    });
    
    // Rotation handle
    ctx.fillRect(
      screenCoords.x - handleSize / 2,
      screenCoords.y - (scaledHeight * dpr) / 2 - 20 * dpr,
      handleSize,
      handleSize
    );
    
    ctx.restore();
  }

  // Render snap targets (dev only)
  renderSnapTargets(snapTargets: any[], context: RenderContext): void {
    if (!import.meta.env.DEV) return;
    
    const { ctx, photoSpace, dpr } = context;
    
    ctx.save();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
    
    snapTargets.forEach(target => {
      const screenCoords = photoSpace.imageToScreen(target.x, target.y);
      ctx.beginPath();
      ctx.arc(screenCoords.x, screenCoords.y, target.threshold * dpr, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    ctx.restore();
  }

  // Preload assets for better performance
  async preloadAssets(assets: Asset[]): Promise<void> {
    const preloadPromises = assets.map(async asset => {
      const sourceItem = assetSource.getItemById(asset.sourceId);
      if (!sourceItem) return;
      
      try {
        const fullKey = assetSource.getCacheKey(sourceItem);
        await getCachedImage(fullKey, sourceItem.src, imageCacheFull);
      } catch (error) {
        console.warn(`Failed to preload asset ${asset.id}:`, error);
      }
    });
    
    await Promise.allSettled(preloadPromises);
  }
}

// Singleton instance
export const assetRenderer = new AssetRenderer();
