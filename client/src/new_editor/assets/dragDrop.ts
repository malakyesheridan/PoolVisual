// Drag-Drop System for Asset Library
// Handles drag from library cards with ghost preview and drop validation

import { AssetSourceItem } from './types';
import { assetService } from './assetService';
import { getCachedImage, imageCacheThumb } from './imageCache';

export interface DragState {
  isDragging: boolean;
  sourceItem: AssetSourceItem | null;
  ghostElement: HTMLElement | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

class AssetDragDrop {
  private dragState: DragState = {
    isDragging: false,
    sourceItem: null,
    ghostElement: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
  };

  private canvasElement: HTMLElement | null = null;
  private photoSpace: any = null; // Will be injected from editor

  // Initialize drag-drop system
  init(canvasElement: HTMLElement, photoSpace: any): void {
    this.canvasElement = canvasElement;
    this.photoSpace = photoSpace;
    
    // Add global event listeners
    document.addEventListener('dragover', this.handleDragOver.bind(this));
    document.addEventListener('drop', this.handleDrop.bind(this));
    document.addEventListener('dragend', this.handleDragEnd.bind(this));
  }

  // Start drag from library card
  async startDrag(sourceItem: AssetSourceItem, event: React.DragEvent): Promise<void> {
    this.dragState.isDragging = true;
    this.dragState.sourceItem = sourceItem;
    this.dragState.startX = event.clientX;
    this.dragState.startY = event.clientY;
    this.dragState.currentX = event.clientX;
    this.dragState.currentY = event.clientY;

    // Create ghost element in document body portal
    this.createGhostElement(sourceItem, event.clientX, event.clientY);
    
    // Set pointer capture for global tracking
    if (event.target instanceof HTMLElement) {
      event.target.setPointerCapture(event.pointerId);
    }
    
    // Set drag data
    event.dataTransfer.setData('text/plain', sourceItem.id);
    event.dataTransfer.effectAllowed = 'copy';
  }

  private createGhostElement(sourceItem: AssetSourceItem, x: number, y: number): void {
    // Remove existing ghost
    if (this.dragState.ghostElement) {
      document.body.removeChild(this.dragState.ghostElement);
    }

    // Create new ghost element in document body portal
    const ghost = document.createElement('div');
    ghost.className = 'asset-drag-ghost';
    ghost.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 10000;
      background: rgba(255, 255, 255, 0.9);
      border: 2px solid #3b82f6;
      border-radius: 8px;
      padding: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      left: ${x}px;
      top: ${y}px;
      transform: translate(-50%, -50%);
      gap: 8px;
      max-width: 200px;
    `;

    // Add asset name
    const nameSpan = document.createElement('span');
    nameSpan.textContent = sourceItem.name;
    nameSpan.style.cssText = `
      font-size: 12px;
      font-weight: 500;
      color: #374151;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    ghost.appendChild(nameSpan);

    document.body.appendChild(ghost);
    this.dragState.ghostElement = ghost;

    // Position ghost
    this.updateGhostPosition();
  }

  private updateGhostPosition(): void {
    if (!this.dragState.ghostElement) return;

    this.dragState.ghostElement.style.left = `${this.dragState.currentX + 10}px`;
    this.dragState.ghostElement.style.top = `${this.dragState.currentY + 10}px`;
  }

  private handleDragOver(event: DragEvent): void {
    if (!this.dragState.isDragging) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';

    this.dragState.currentX = event.clientX;
    this.dragState.currentY = event.clientY;
    this.updateGhostPosition();
  }

  private handleDrop(event: DragEvent): void {
    if (!this.dragState.isDragging || !this.dragState.sourceItem) return;

    event.preventDefault();

    // Get canvas bounds for coordinate conversion
    if (!this.canvasElement) {
      console.warn('[AssetDrop] Canvas element not available');
      this.cleanup();
      return;
    }

    const canvasRect = this.canvasElement.getBoundingClientRect();
    const relativeX = event.clientX - canvasRect.left;
    const relativeY = event.clientY - canvasRect.top;

    console.log('[AssetDrop:DEBUG]', {
      eventClientX: event.clientX,
      eventClientY: event.clientY,
      canvasRect: {
        left: canvasRect.left,
        top: canvasRect.top,
        width: canvasRect.width,
        height: canvasRect.height
      },
      relativeX,
      relativeY,
      photoSpace: this.photoSpace
    });

    // Get image-space coordinates from screen coordinates
    const imageCoords = assetService.getImageCoordsFromScreen(relativeX, relativeY, this.photoSpace, this.canvasElement as HTMLCanvasElement);
    if (!imageCoords) {
      console.warn('[AssetDrop] Could not convert screen coordinates to image space');
      this.cleanup();
      return;
    }

    console.log('[AssetDrop:DEBUG] Image coords:', imageCoords);

    // Clamp coordinates to image bounds with 8px gutter
    const clampedCoords = this.clampToImageBounds(imageCoords.x, imageCoords.y, 8);
    
    console.log('[AssetDrop:DEBUG] Clamped coords:', clampedCoords);
    
    // Use unified asset service
    const assetId = assetService.addAssetAt({
      sourceItem: this.dragState.sourceItem,
      imageX: clampedCoords.x,
      imageY: clampedCoords.y,
      centerOffset: true,
      photoSpace: this.photoSpace
    });

    console.log(`[AssetDrop] Created asset ${assetId} at (${clampedCoords.x}, ${clampedCoords.y})`);
    
    this.cleanup();
  }

  private handleDragEnd(event: DragEvent): void {
    this.cleanup();
  }

  // Removed screenToImageCoords - now using assetService.getImageCoordsFromScreen

  private clampToImageBounds(x: number, y: number, gutter: number): { x: number; y: number } {
    if (!this.photoSpace) return { x, y };

    try {
      const imageBounds = this.photoSpace.getImageBounds();
      const clampedX = Math.max(gutter, Math.min(imageBounds.width - gutter, x));
      const clampedY = Math.max(gutter, Math.min(imageBounds.height - gutter, y));
      return { x: clampedX, y: clampedY };
    } catch (error) {
      console.warn('Failed to get image bounds:', error);
      return { x, y };
    }
  }


  private cleanup(): void {
    if (this.dragState.ghostElement) {
      document.body.removeChild(this.dragState.ghostElement);
    }

    this.dragState = {
      isDragging: false,
      sourceItem: null,
      ghostElement: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0
    };
  }

  // Public API
  isDragging(): boolean {
    return this.dragState.isDragging;
  }

  getDragState(): DragState {
    return { ...this.dragState };
  }
}

// Singleton instance
export const assetDragDrop = new AssetDragDrop();

// React hook for drag start
export function useAssetDragStart() {
  return async (sourceItem: AssetSourceItem, event: React.DragEvent) => {
    await assetDragDrop.startDrag(sourceItem, event);
  };
}
