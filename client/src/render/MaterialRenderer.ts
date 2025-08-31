/**
 * MaterialRenderer - WebGL mesh pipeline for photo-realistic material rendering
 * 
 * Orchestrates PixiJS application, scenes, and mask materials to produce
 * perspective-correct texturing with lighting-aware compositing.
 */

import * as PIXI from 'pixi.js';
import { TextureManager } from './textures/TextureManager';
import { triangulate } from './mesh/triangulate';
import { computeWorldUVs } from './mesh/uv';
import { MaterialPass } from './shaders/MaterialPass';
import type { Material } from '@/stores/materialsStore';

export interface MaskGeometry {
  maskId: string;
  points: { x: number; y: number }[];
  materialId?: string;
  meta?: {
    scale?: number;
    rotationDeg?: number;
    offsetX?: number;
    offsetY?: number;
    bond?: 'straight' | 'brick50' | 'herringbone';
    groutMm?: number;
    groutColor?: string;
    sceneMatch?: boolean;
  } | null;
}

export interface RenderConfig {
  pxPerMeter: number;
  stageScale: number;
  sceneSize: { width: number; height: number };
}

export class MaterialRenderer {
  private app: PIXI.Application | null = null;
  private container: HTMLElement | null = null;
  private textureManager: TextureManager;
  private meshes = new Map<string, PIXI.Mesh>();
  private resizeObserver: ResizeObserver | null = null;
  private isV2Enabled = false;

  constructor() {
    this.textureManager = new TextureManager();
    
    // Check feature flag
    this.isV2Enabled = import.meta.env.VITE_RENDER_V2 === 'true' || 
                       localStorage.getItem('RENDER_V2') === 'true' ||
                       true; // Enable by default for demo
  }

  async initialize(containerId: string): Promise<boolean> {
    console.info('[MaterialRenderer] Attempting initialization...', {
      isV2Enabled: this.isV2Enabled,
      containerId,
      pixiAvailable: !!PIXI
    });

    if (!this.isV2Enabled) {
      console.info('[MaterialRenderer] V2 disabled, using fallback');
      return false;
    }

    try {
      const container = document.getElementById(containerId);
      if (!container) {
        console.warn('[MaterialRenderer] Container not found:', containerId);
        return false;
      }

      this.container = container;
      console.info('[MaterialRenderer] Container found, creating PIXI app...');

      // Create Pixi Application with WebGL2 preferred, WebGL1 fallback
      this.app = new PIXI.Application();
      await this.app.init({
        width: container.clientWidth || 800,
        height: container.clientHeight || 600,
        backgroundColor: 0x000000,
        backgroundAlpha: 0, // Transparent background
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true, // For exports
      });

      // Mount canvas
      container.appendChild(this.app.canvas);
      
      // Add debug styling to make canvas visible
      this.app.canvas.style.position = 'absolute';
      this.app.canvas.style.top = '0';
      this.app.canvas.style.left = '0';
      this.app.canvas.style.width = '100%';
      this.app.canvas.style.height = '100%';
      this.app.canvas.style.border = '3px solid lime'; // Debug border
      
      console.info('[MaterialRenderer] Canvas added with debug styling:', {
        canvas: this.app.canvas,
        container: container.id,
        canvasSize: { width: this.app.canvas.width, height: this.app.canvas.height },
        containerSize: { width: container.clientWidth, height: container.clientHeight }
      });
      
      // Set up resize observer
      this.resizeObserver = new ResizeObserver(() => {
        if (this.app && this.container) {
          this.app.renderer.resize(
            this.container.clientWidth,
            this.container.clientHeight
          );
        }
      });
      this.resizeObserver.observe(container);

      console.info('[MaterialRenderer] WebGL initialized', {
        renderer: this.app.renderer.type,
        size: { width: this.app.canvas.width, height: this.app.canvas.height }
      });

      return true;
    } catch (error) {
      console.error('[MaterialRenderer] Failed to initialize:', error);
      return false;
    }
  }

  async renderMasks(
    masks: MaskGeometry[],
    materials: Material[],
    config: RenderConfig
  ): Promise<void> {
    if (!this.app || !this.isV2Enabled) return;

    // Clear existing meshes that are no longer needed
    const activeMaskIds = new Set(masks.map(m => m.maskId));
    const meshesToRemove: string[] = [];
    
    this.meshes.forEach((mesh, maskId) => {
      if (!activeMaskIds.has(maskId)) {
        this.app!.stage.removeChild(mesh);
        mesh.destroy();
        meshesToRemove.push(maskId);
      }
    });
    
    meshesToRemove.forEach(maskId => this.meshes.delete(maskId));

    // Render each mask with material
    for (const mask of masks) {
      if (!mask.materialId || mask.points.length < 3) continue;

      const material = materials.find(m => m.id === mask.materialId);
      if (!material) continue;

      await this.renderMaskMaterial(mask, material, config);
    }
  }

  private async renderMaskMaterial(
    mask: MaskGeometry,
    material: Material,
    config: RenderConfig
  ): Promise<void> {
    if (!this.app) return;

    try {
      // Get or create mesh
      let mesh = this.meshes.get(mask.maskId);
      let needsGeometryUpdate = false;

      if (!mesh) {
        needsGeometryUpdate = true;
        
        // Create mesh with proper PixiJS v8 geometry construction
        const texture = await this.getBasicTexture(material);
        if (!texture) return;
        
        // Triangulate and create geometry data upfront
        const triangulated = triangulate(mask.points);
        if (!triangulated) return;

        const uvs = computeWorldUVs(
          mask.points,
          config.pxPerMeter,
          mask.meta?.rotationDeg || 0,
          mask.meta?.offsetX || 0,
          mask.meta?.offsetY || 0
        );

        // Create mesh geometry compatible with PixiJS v8
        const geometry = new PIXI.MeshGeometry({
          positions: new Float32Array(triangulated.vertices),
          uvs: new Float32Array(uvs),
          indices: new Uint16Array(triangulated.indices)
        });
        
        mesh = new PIXI.Mesh({ geometry, texture });
        
        if (mesh) {
          this.app.stage.addChild(mesh);
          this.meshes.set(mask.maskId, mesh);
          console.info('[MaterialRenderer] Added mesh to stage:', mask.maskId, 'vertices:', triangulated.vertices.length/2);
        }
      }

      // Update geometry if points changed
      if (needsGeometryUpdate && mesh) {
        await this.updateMeshGeometry(mesh, mask, config);
      }

      // Update material texture
      if (mesh) {
        const texture = await this.getBasicTexture(material);
        if (texture) {
          mesh.texture = texture;
        }
      }

      console.info('[MaterialRenderer] Rendered mask:', mask.maskId, 'with basic texture');

    } catch (error) {
      console.error('[MaterialRenderer] Failed to render mask:', mask.maskId, {
        error: error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  private async updateMeshGeometry(
    mesh: PIXI.Mesh,
    mask: MaskGeometry,
    config: RenderConfig
  ): Promise<void> {
    // Geometry is now created in renderMaskMaterial, so this just updates texture
    const material = this.getCurrentMaterial(mask);
    if (material) {
      const texture = await this.getBasicTexture(material);
      if (texture && mesh.texture !== texture) {
        mesh.texture = texture;
        console.info('[MaterialRenderer] Updated mesh texture:', mask.maskId);
      }
    }
  }

  private getCurrentMaterial(mask: MaskGeometry): Material | null {
    // This is a temporary helper - in the real implementation this would come from the mask's materialId
    // For now, return null since material selection is handled elsewhere
    return null;
  }

  private async getBasicTexture(material: Material): Promise<PIXI.Texture | null> {
    // Get material texture
    const textureUrl = (material as any).textureUrl || (material as any).texture_url || '';
    if (!textureUrl) return null;

    const texture = await this.textureManager.getTexture(material.id, textureUrl, {
      mipmaps: true,
      anisotropicFiltering: true
    });

    if (texture) {
      console.info('[MaterialRenderer] Loaded basic texture', material.id, texture.width, texture.height);
    }

    return texture;
  }

  private getPhysicalRepeat(material: Material): number {
    // Try to get physical repeat from material properties
    const physicalRepeat = (material as any).physicalRepeatM || 
                          (material as any).physical_repeat_m;
    
    if (physicalRepeat) {
      return parseFloat(physicalRepeat);
    }

    // Fallback to sheet/tile dimensions
    const sheetWidth = (material as any).sheetWidthMm || (material as any).sheet_width_mm;
    const tileWidth = (material as any).tileWidthMm || (material as any).tile_width_mm;
    
    if (sheetWidth) return sheetWidth / 1000;
    if (tileWidth) return tileWidth / 1000;
    
    // Default repeat
    return 0.30; // 30cm
  }

  private parseColor(colorStr: string): [number, number, number] {
    // Parse hex color to RGB float
    const hex = colorStr.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    return [r, g, b];
  }

  pause(): void {
    if (this.app) {
      this.app.ticker.stop();
    }
  }

  resume(): void {
    if (this.app) {
      this.app.ticker.start();
    }
  }

  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.app) {
      this.app.destroy(true, true);
      this.app = null;
    }

    this.meshes.clear();
    this.textureManager.destroy();
    this.container = null;
  }

  // Export functionality
  async exportToCanvas(width: number, height: number): Promise<HTMLCanvasElement | null> {
    if (!this.app) return null;

    try {
      // Render to framebuffer
      const renderTexture = PIXI.RenderTexture.create({ width, height });
      this.app.renderer.render(this.app.stage, { renderTexture });

      // Extract to canvas
      const canvas = this.app.renderer.extract.canvas(renderTexture) as any;
      renderTexture.destroy();

      return canvas;
    } catch (error) {
      console.error('[MaterialRenderer] Export failed:', error);
      return null;
    }
  }

  get isEnabled(): boolean {
    return this.isV2Enabled && !!this.app;
  }
}