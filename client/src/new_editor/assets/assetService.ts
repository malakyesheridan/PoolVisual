// Unified Asset Service
// Single source of truth for asset addition, positioning, and selection

import { useAssetsStore } from './store';
import { AssetSourceItem } from './types';
import { isAssetsDropFixEnabled } from './assets_drop_fix';
import { convertAssetToMask } from './assetToMaskConverter';
import { selectMaskOrAsset } from './unifiedMaskStore';
import { screenToImage } from '../utils';

export interface AddAssetOptions {
  sourceItem: AssetSourceItem;
  imageX: number;
  imageY: number;
  centerOffset?: boolean; // Whether to center the asset at the given coordinates
  photoSpace?: any; // PhotoSpace state to avoid circular dependency
  canvas?: HTMLCanvasElement; // Canvas element for coordinate conversion
}

export class AssetService {
  private static instance: AssetService;
  
  static getInstance(): AssetService {
    if (!AssetService.instance) {
      AssetService.instance = new AssetService();
    }
    return AssetService.instance;
  }

  /**
   * Add asset at specified image-space coordinates
   * This is the single entry point for both drag/drop and button-add
   */
  addAssetAt(options: AddAssetOptions): string {
    const { sourceItem, imageX, imageY, centerOffset = true, photoSpace } = options;
    
    // Check feature flag
    if (!isAssetsDropFixEnabled()) {
      console.warn('[AssetService] Assets drop fix is disabled, using fallback');
      return this.addAssetAtFallback(options);
    }
    
    // Instrumentation: Log before operation
    const beforeState = this.getCurrentCameraState(photoSpace);
    const beforeWorldState = this.getWorldState();
    
    console.log('[AssetService:addAssetAt:BEFORE]', {
      sourceItem: sourceItem.name,
      imagePos: { x: imageX, y: imageY },
      centerOffset,
      cameraState: beforeState,
      worldState: beforeWorldState,
      timestamp: Date.now()
    });

    // Verify parent hierarchy
    this.verifyParentHierarchy();

    // Guard: Check for camera/photo writes during asset creation
    this.guardCameraWrites(() => {
      const store = useAssetsStore.getState();
      
      // Ensure asset definition exists
      if (!store.defsById[sourceItem.id]) {
        const assetDef = {
          id: sourceItem.id,
          name: sourceItem.name,
          category: sourceItem.category,
          url: sourceItem.src,
          thumbnail: sourceItem.thumb,
          defaultScale: 1.0
        };
        
        store.loadAssetDefs([assetDef]);
      }

      // Calculate final position (center offset if requested)
      let finalX = imageX;
      let finalY = imageY;
      
      if (centerOffset) {
        // Use default dimensions for centering
        const defaultWidth = 50;
        const defaultHeight = 50;
        finalX = imageX; // Already represents center
        finalY = imageY; // Already represents center
      }

      // Create asset instance
      const assetId = store.addAsset(sourceItem.id, {
        x: finalX,
        y: finalY,
        scale: 1.0,
        rotation: 0,
        opacity: 1.0,
        locked: false
      });

      console.log(`[AssetService] Created asset ${assetId} at (${finalX}, ${finalY})`);
      
      // Select the newly created asset using unified selection
      selectMaskOrAsset(`asset_${assetId}`);
    }, photoSpace);

    // Instrumentation: Log after operation
    const afterState = this.getCurrentCameraState(photoSpace);
    const afterWorldState = this.getWorldState();
    
    console.log('[AssetService:addAssetAt:AFTER]', {
      assetId: useAssetsStore.getState().selectedAssetId,
      cameraState: afterState,
      worldState: afterWorldState,
      cameraChanged: this.compareStates(beforeState, afterState),
      worldChanged: this.compareWorldStates(beforeWorldState, afterWorldState)
    });

    // Return the asset ID (this will be set by the store)
    const store = useAssetsStore.getState();
    return store.selectedAssetId || '';
  }

  /**
   * Fallback method for when feature flag is disabled
   */
  private addAssetAtFallback(options: AddAssetOptions): string {
    const { sourceItem, imageX, imageY } = options;
    const store = useAssetsStore.getState();
    
    // Simple fallback - just add the asset
    const assetId = store.addAsset(sourceItem.id, {
      x: imageX,
      y: imageY,
      scale: 1.0,
      rotation: 0,
      opacity: 1.0,
      locked: false
    });

    return assetId;
  }

  /**
   * Get image-space coordinates from screen coordinates
   * Uses existing coordinate utilities for consistency
   */
  getImageCoordsFromScreen(screenX: number, screenY: number, photoSpace?: any, canvas?: HTMLCanvasElement): { x: number; y: number } | null {
    try {
      if (!photoSpace) {
        console.warn('[AssetService] PhotoSpace not provided');
        return null;
      }

      // Use existing coordinate conversion utility
      const imageCoords = screenToImage(
        { x: screenX, y: screenY },
        photoSpace,
        canvas
      );

      return imageCoords;
    } catch (error) {
      console.warn('[AssetService] Coordinate conversion failed:', error);
      return null;
    }
  }

  /**
   * Get viewport center in image-space coordinates
   */
  getViewportCenterInImageSpace(photoSpace?: any, canvas?: HTMLCanvasElement): { x: number; y: number } | null {
    const viewportWidth = window.innerWidth - 320; // Subtract sidebar width
    const viewportHeight = window.innerHeight - 60; // Subtract toolbar height
    const screenCenterX = viewportWidth / 2;
    const screenCenterY = viewportHeight / 2;
    
    return this.getImageCoordsFromScreen(screenCenterX, screenCenterY, photoSpace, canvas);
  }

  /**
   * Guard against camera/photo writes during asset operations
   */
  private guardCameraWrites(operation: () => void, photoSpace?: any): void {
    // Store initial camera/background state
    const initialCamera = this.getCurrentCameraState(photoSpace);
    
    // Run the operation
    operation();
    
    // Check if camera/background was modified
    const finalCamera = this.getCurrentCameraState(photoSpace);
    const cameraChanged = 
      initialCamera.scale !== finalCamera.scale ||
      initialCamera.panX !== finalCamera.panX ||
      initialCamera.panY !== finalCamera.panY;
    
    if (cameraChanged) {
      console.warn('[AssetService] GUARD VIOLATION: Camera/background was modified during asset operation!', {
        initial: initialCamera,
        final: finalCamera
      });
    }
  }

  /**
   * Get current camera state for comparison
   */
  private getCurrentCameraState(photoSpace?: any): { scale: number; panX: number; panY: number } {
    if (!photoSpace) {
      console.warn('[AssetService] PhotoSpace not provided');
      return { scale: 1, panX: 0, panY: 0 };
    }
    
    return {
      scale: photoSpace.scale || 1,
      panX: photoSpace.panX || 0,
      panY: photoSpace.panY || 0
    };
  }

  /**
   * Get current world state for comparison
   */
  private getWorldState(): { x: number; y: number; scaleX: number; scaleY: number } {
    try {
      const stageElement = document.querySelector('div[style*="position: absolute"] canvas') ||
                          document.querySelector('canvas');
      if (!stageElement) return { x: 0, y: 0, scaleX: 1, scaleY: 1 };

      const konvaStage = (stageElement as any).__konvaStage;
      if (!konvaStage) return { x: 0, y: 0, scaleX: 1, scaleY: 1 };

      const worldGroup = konvaStage.findOne('.world-group');
      if (!worldGroup) return { x: 0, y: 0, scaleX: 1, scaleY: 1 };

      return {
        x: worldGroup.x(),
        y: worldGroup.y(),
        scaleX: worldGroup.scaleX(),
        scaleY: worldGroup.scaleY()
      };
    } catch (error) {
      console.warn('[AssetService] Could not get world state:', error);
      return { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    }
  }

  /**
   * Compare camera states
   */
  private compareStates(before: any, after: any): boolean {
    return before.scale !== after.scale || before.panX !== after.panX || before.panY !== after.panY;
  }

  /**
   * Compare world states
   */
  private compareWorldStates(before: any, after: any): boolean {
    return before.x !== after.x || before.y !== after.y || 
           before.scaleX !== after.scaleX || before.scaleY !== after.scaleY;
  }

  /**
   * Verify parent hierarchy for assets
   */
  verifyParentHierarchy(): void {
    const stageElement = document.querySelector('div[style*="position: absolute"] canvas') ||
                        document.querySelector('canvas');
    if (!stageElement) return;

    const konvaStage = (stageElement as any).__konvaStage;
    if (!konvaStage) return;

    const worldGroup = konvaStage.findOne('.world-group');
    if (!worldGroup) {
      console.warn('[AssetService] WARNING: WorldGroup not found!');
      return;
    }

    const assetsLayer = worldGroup.findOne('.assets-layer');
    if (!assetsLayer) {
      console.warn('[AssetService] WARNING: AssetsLayer not found under WorldGroup!');
      return;
    }

    // Check for listening overlays above assets
    const layers = worldGroup.getChildren();
    const assetsLayerIndex = layers.indexOf(assetsLayer);
    
    for (let i = assetsLayerIndex + 1; i < layers.length; i++) {
      const layer = layers[i];
      if (layer.listening()) {
        console.warn('[AssetService] WARNING: Listening overlay above assets:', {
          layerName: layer.name(),
          layerClass: layer.getClassName()
        });
      }
    }

    console.log('[AssetService] Parent hierarchy verified:', {
      stage: konvaStage.name(),
      worldGroup: worldGroup.name(),
      assetsLayer: assetsLayer.name(),
      assetsLayerListening: assetsLayer.listening()
    });
  }
}

// Export singleton instance
export const assetService = AssetService.getInstance();
