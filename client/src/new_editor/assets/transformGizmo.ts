// Transform Gizmo for Asset Library
// Handles resize, rotation, movement, and snapping

import { Asset, TransformHandle, SnapTarget } from './types';
import { useAssetStore } from './assetStore';

export interface TransformState {
  isActive: boolean;
  asset: Asset | null;
  handles: TransformHandle[];
  snapTargets: SnapTarget[];
  isSnappingEnabled: boolean;
  startX: number;
  startY: number;
  startAsset: Asset | null;
}

class AssetTransformGizmo {
  private transformState: TransformState = {
    isActive: false,
    asset: null,
    handles: [],
    snapTargets: [],
    isSnappingEnabled: false,
    startX: 0,
    startY: 0,
    startAsset: null
  };

  private canvasElement: HTMLElement | null = null;
  private photoSpace: any = null;

  // Initialize transform system
  init(canvasElement: HTMLElement, photoSpace: any): void {
    this.canvasElement = canvasElement;
    this.photoSpace = photoSpace;
    
    // Add event listeners
    canvasElement.addEventListener('mousedown', this.handleMouseDown.bind(this));
    canvasElement.addEventListener('mousemove', this.handleMouseMove.bind(this));
    canvasElement.addEventListener('mouseup', this.handleMouseUp.bind(this));
    canvasElement.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  // Show gizmo for selected asset
  showGizmo(asset: Asset): void {
    this.transformState.isActive = true;
    this.transformState.asset = asset;
    this.generateHandles(asset);
    this.generateSnapTargets();
  }

  // Hide gizmo
  hideGizmo(): void {
    this.transformState.isActive = false;
    this.transformState.asset = null;
    this.transformState.handles = [];
    this.transformState.snapTargets = [];
  }

  // Toggle snapping
  toggleSnapping(): void {
    this.transformState.isSnappingEnabled = !this.transformState.isSnappingEnabled;
  }

  private generateHandles(asset: Asset): void {
    const handles: TransformHandle[] = [];
    const bounds = this.getAssetBounds(asset);

    // Corner resize handles
    const corners = [
      { x: bounds.left, y: bounds.top, type: 'resize-corner' as const },
      { x: bounds.right, y: bounds.top, type: 'resize-corner' as const },
      { x: bounds.left, y: bounds.bottom, type: 'resize-corner' as const },
      { x: bounds.right, y: bounds.bottom, type: 'resize-corner' as const }
    ];

    corners.forEach(corner => {
      handles.push({
        type: corner.type,
        x: corner.x,
        y: corner.y,
        width: 8,
        height: 8
      });
    });

    // Side resize handles
    const sides = [
      { x: bounds.left + bounds.width / 2, y: bounds.top, type: 'resize-side' as const },
      { x: bounds.right, y: bounds.top + bounds.height / 2, type: 'resize-side' as const },
      { x: bounds.left + bounds.width / 2, y: bounds.bottom, type: 'resize-side' as const },
      { x: bounds.left, y: bounds.top + bounds.height / 2, type: 'resize-side' as const }
    ];

    sides.forEach(side => {
      handles.push({
        type: side.type,
        x: side.x,
        y: side.y,
        width: 8,
        height: 8
      });
    });

    // Rotation handle
    handles.push({
      type: 'rotate',
      x: bounds.left + bounds.width / 2,
      y: bounds.top - 20,
      width: 8,
      height: 8
    });

    this.transformState.handles = handles;
  }

  private generateSnapTargets(): void {
    const targets: SnapTarget[] = [];
    
    if (!this.transformState.isSnappingEnabled) {
      this.transformState.snapTargets = targets;
      return;
    }

    // Grid snap targets
    if (this.photoSpace) {
      try {
        const gridSize = 10; // 10px grid
        const imageBounds = this.photoSpace.getImageBounds();
        
        for (let x = 0; x < imageBounds.width; x += gridSize) {
          for (let y = 0; y < imageBounds.height; y += gridSize) {
            targets.push({
              type: 'grid',
              x,
              y,
              threshold: 8
            });
          }
        }
      } catch (error) {
        console.warn('Failed to generate grid snap targets:', error);
      }
    }

    // Asset snap targets
    const assets = useAssetStore.getState().getAssetsInOrder();
    assets.forEach(asset => {
      if (asset.id === this.transformState.asset?.id) return;
      
      const bounds = this.getAssetBounds(asset);
      
      // Center snap
      targets.push({
        type: 'asset-center',
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
        threshold: 8
      });

      // Edge snaps
      targets.push(
        { type: 'asset-edge', x: bounds.left, y: bounds.top, threshold: 8 },
        { type: 'asset-edge', x: bounds.right, y: bounds.top, threshold: 8 },
        { type: 'asset-edge', x: bounds.left, y: bounds.bottom, threshold: 8 },
        { type: 'asset-edge', x: bounds.right, y: bounds.bottom, threshold: 8 }
      );
    });

    this.transformState.snapTargets = targets;
  }

  private getAssetBounds(asset: Asset): { left: number; top: number; width: number; height: number; right: number; bottom: number } {
    const scaledWidth = asset.natW * asset.scale;
    const scaledHeight = asset.natH * asset.scale;
    
    return {
      left: asset.x - scaledWidth / 2,
      top: asset.y - scaledHeight / 2,
      width: scaledWidth,
      height: scaledHeight,
      right: asset.x + scaledWidth / 2,
      bottom: asset.y + scaledHeight / 2
    };
  }

  private handleMouseDown(event: MouseEvent): void {
    if (!this.transformState.isActive || !this.transformState.asset) return;

    const mousePos = this.getMousePosition(event);
    const handle = this.getHandleAt(mousePos.x, mousePos.y);

    if (handle) {
      this.transformState.startX = mousePos.x;
      this.transformState.startY = mousePos.y;
      this.transformState.startAsset = { ...this.transformState.asset };
      
      // Set cursor based on handle type
      this.setCursor(handle.type);
      
      event.preventDefault();
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.transformState.isActive || !this.transformState.startAsset) return;

    const mousePos = this.getMousePosition(event);
    const deltaX = mousePos.x - this.transformState.startX;
    const deltaY = mousePos.y - this.transformState.startY;

    // Apply transform based on handle type
    this.applyTransform(deltaX, deltaY);
  }

  private handleMouseUp(event: MouseEvent): void {
    if (this.transformState.startAsset) {
      // Commit changes
      useAssetStore.getState().pushHistory();
      this.transformState.startAsset = null;
    }
    
    this.setCursor('default');
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.transformState.isActive || !this.transformState.asset) return;

    const asset = this.transformState.asset;
    const store = useAssetStore.getState();

    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        store.deleteAsset(asset.id);
        this.hideGizmo();
        break;
        
      case 'd':
      case 'D':
        if (event.ctrlKey || event.metaKey) {
          store.duplicateAsset(asset.id);
        }
        break;
        
      case 'l':
      case 'L':
        store.lockAsset(asset.id, !asset.locked);
        break;
        
      case 'h':
      case 'H':
        store.hideAsset(asset.id, !asset.hidden);
        break;
        
      case 'ArrowLeft':
        this.nudgeAsset(-1, 0, event.shiftKey);
        break;
        
      case 'ArrowRight':
        this.nudgeAsset(1, 0, event.shiftKey);
        break;
        
      case 'ArrowUp':
        this.nudgeAsset(0, -1, event.shiftKey);
        break;
        
      case 'ArrowDown':
        this.nudgeAsset(0, 1, event.shiftKey);
        break;
        
      case '[':
        this.changeZOrder(-1, event.shiftKey);
        break;
        
      case ']':
        this.changeZOrder(1, event.shiftKey);
        break;
    }
  }

  private applyTransform(deltaX: number, deltaY: number): void {
    if (!this.transformState.startAsset) return;

    const asset = this.transformState.startAsset;
    const store = useAssetStore.getState();

    // Apply snapping if enabled
    const snappedCoords = this.applySnapping(asset.x + deltaX, asset.y + deltaY);
    
    // Update asset position
    store.moveAsset(asset.id, snappedCoords.x, snappedCoords.y);
  }

  private applySnapping(x: number, y: number): { x: number; y: number } {
    if (!this.transformState.isSnappingEnabled) {
      return { x, y };
    }

    let snappedX = x;
    let snappedY = y;
    let minDistance = Infinity;

    for (const target of this.transformState.snapTargets) {
      const distance = Math.sqrt((x - target.x) ** 2 + (y - target.y) ** 2);
      
      if (distance < target.threshold && distance < minDistance) {
        snappedX = target.x;
        snappedY = target.y;
        minDistance = distance;
      }
    }

    return { x: snappedX, y: snappedY };
  }

  private nudgeAsset(deltaX: number, deltaY: number, bigStep: boolean): void {
    const asset = this.transformState.asset;
    if (!asset) return;

    const step = bigStep ? 10 : 1;
    const newX = asset.x + deltaX * step;
    const newY = asset.y + deltaY * step;
    
    useAssetStore.getState().moveAsset(asset.id, newX, newY);
  }

  private changeZOrder(direction: number, toExtreme: boolean): void {
    const asset = this.transformState.asset;
    if (!asset) return;

    const store = useAssetStore.getState();
    const assets = store.getAssetsInOrder();
    const currentIndex = assets.findIndex(a => a.id === asset.id);
    
    if (currentIndex === -1) return;

    let newIndex: number;
    if (toExtreme) {
      newIndex = direction > 0 ? assets.length - 1 : 0;
    } else {
      newIndex = Math.max(0, Math.min(assets.length - 1, currentIndex + direction));
    }

    if (newIndex !== currentIndex) {
      const newZ = assets[newIndex].z + (direction > 0 ? 1 : -1);
      store.setAssetZ(asset.id, newZ);
    }
  }

  private getHandleAt(x: number, y: number): TransformHandle | null {
    for (const handle of this.transformState.handles) {
      if (x >= handle.x - handle.width / 2 && 
          x <= handle.x + handle.width / 2 &&
          y >= handle.y - handle.height / 2 && 
          y <= handle.y + handle.height / 2) {
        return handle;
      }
    }
    return null;
  }

  private getMousePosition(event: MouseEvent): { x: number; y: number } {
    if (!this.canvasElement) return { x: 0, y: 0 };

    const rect = this.canvasElement.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    // Convert to image coordinates
    try {
      return this.photoSpace.screenToImage(canvasX, canvasY);
    } catch (error) {
      return { x: canvasX, y: canvasY };
    }
  }

  private setCursor(type: string): void {
    if (!this.canvasElement) return;

    const cursorMap: Record<string, string> = {
      'resize-corner': 'nw-resize',
      'resize-side': 'ew-resize',
      'rotate': 'grab',
      'move': 'move',
      'default': 'default'
    };

    this.canvasElement.style.cursor = cursorMap[type] || 'default';
  }

  // Public API
  getTransformState(): TransformState {
    return { ...this.transformState };
  }

  isSnappingEnabled(): boolean {
    return this.transformState.isSnappingEnabled;
  }
}

// Singleton instance
export const assetTransformGizmo = new AssetTransformGizmo();
