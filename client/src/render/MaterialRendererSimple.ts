/**
 * Simple MaterialRenderer for PixiJS v8 compatibility
 * Uses basic texture rendering without complex shaders
 */

import * as PIXI from 'pixi.js';
import { triangulate } from './mesh/triangulate';
import { computeWorldUVs } from './mesh/uv';

export interface Material {
  id: string;
  textureUrl?: string;
  texture_url?: string;
  physicalRepeatM?: string;
  physical_repeat_m?: string;
  sheetWidthMm?: number;
  sheet_width_mm?: number;
  tileWidthMm?: number;
  tile_width_mm?: number;
}

export interface MaskGeometry {
  maskId: string;
  materialId?: string;
  points: Array<{ x: number; y: number }>;
  meta?: {
    scale?: number;
    bond?: string;
    rotationDeg?: number;
    offsetX?: number;
    offsetY?: number;
    groutMm?: number;
    groutColor?: string;
  };
}

export interface RenderConfig {
  pxPerMeter: number;
  stageScale: number;
}

export class SimpleMaterialRenderer {
  private app: PIXI.Application | null = null;
  private container: HTMLElement | null = null;
  private meshes = new Map<string, PIXI.Mesh>();
  private textureCache = new Map<string, PIXI.Texture>();
  private resizeObserver: ResizeObserver | null = null;

  async initialize(containerId: string): Promise<boolean> {
    try {
      console.info('[SimpleMaterialRenderer] Initializing...');
      
      this.container = document.getElementById(containerId);
      if (!this.container) {
        console.error('[SimpleMaterialRenderer] Container not found:', containerId);
        return false;
      }

      // Create PixiJS v8 application with WebGL
      this.app = new PIXI.Application();
      await this.app.init({
        width: this.container.clientWidth || 800,
        height: this.container.clientHeight || 600,
        backgroundColor: 'transparent',
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      // Add canvas to container
      if (this.app.canvas) {
        this.container.appendChild(this.app.canvas);
      }

      // Set up resize handling
      this.setupResize();

      console.info('[SimpleMaterialRenderer] Initialized successfully');
      return true;

    } catch (error) {
      console.error('[SimpleMaterialRenderer] Initialization failed:', error);
      return false;
    }
  }

  private setupResize(): void {
    if (!this.container) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (this.app) {
          this.app.renderer.resize(width, height);
        }
      }
    });
    
    this.resizeObserver.observe(this.container);
  }

  async renderMasks(
    masks: MaskGeometry[],
    materials: Material[],
    config: RenderConfig
  ): Promise<void> {
    if (!this.app) return;

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
        
        // Create simple mesh with basic texture
        const geometry = new PIXI.Geometry();
        const texture = await this.getTexture(material);
        
        if (!texture) return;
        
        mesh = new PIXI.Mesh({ geometry, texture });
        
        if (mesh) {
          this.app.stage.addChild(mesh);
          this.meshes.set(mask.maskId, mesh);
        }
      }

      // Update geometry if points changed
      if (needsGeometryUpdate && mesh) {
        await this.updateMeshGeometry(mesh, mask, config);
      }

      // Update material texture
      if (mesh) {
        const texture = await this.getTexture(material);
        if (texture) {
          mesh.texture = texture;
        }
      }

      console.info('[SimpleMaterialRenderer] Rendered mask:', mask.maskId);

    } catch (error) {
      console.error('[SimpleMaterialRenderer] Failed to render mask:', mask.maskId, error);
    }
  }

  private async updateMeshGeometry(
    mesh: PIXI.Mesh,
    mask: MaskGeometry,
    config: RenderConfig
  ): Promise<void> {
    // Triangulate polygon
    const triangulated = triangulate(mask.points);
    if (!triangulated) return;

    // Compute world-space UVs
    const uvs = computeWorldUVs(
      mask.points,
      config.pxPerMeter,
      mask.meta?.rotationDeg || 0,
      mask.meta?.offsetX || 0,
      mask.meta?.offsetY || 0
    );

    // Update geometry using PixiJS v8 API
    const geometry = mesh.geometry;
    
    geometry.clear();
    
    // Add position attribute
    geometry.addAttribute(
      'aVertexPosition',
      new PIXI.Buffer({
        data: triangulated.vertices,
        usage: PIXI.BufferUsage.VERTEX
      }),
      2
    );
    
    // Add UV attribute
    geometry.addAttribute(
      'aTextureCoord',
      new PIXI.Buffer({
        data: uvs,
        usage: PIXI.BufferUsage.VERTEX
      }),
      2
    );
    
    // Add indices
    geometry.addIndex(
      new PIXI.Buffer({
        data: triangulated.indices,
        usage: PIXI.BufferUsage.INDEX
      })
    );
  }

  private async getTexture(material: Material): Promise<PIXI.Texture | null> {
    const textureUrl = material.textureUrl || material.texture_url || '';
    if (!textureUrl) return null;

    // Check cache first
    if (this.textureCache.has(textureUrl)) {
      return this.textureCache.get(textureUrl)!;
    }

    try {
      // Convert relative URL to absolute
      const resolvedUrl = textureUrl.startsWith('/') 
        ? `${window.location.origin}${textureUrl}` 
        : textureUrl;

      // Load texture using PixiJS Assets
      const texture = await PIXI.Assets.load(resolvedUrl);
      
      if (texture) {
        this.textureCache.set(textureUrl, texture);
        console.info('[SimpleMaterialRenderer] Loaded texture:', textureUrl, texture.width, texture.height);
      }
      
      return texture;

    } catch (error) {
      console.error('[SimpleMaterialRenderer] Failed to load texture:', textureUrl, error);
      return null;
    }
  }

  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }

    this.meshes.clear();
    this.textureCache.clear();
    this.container = null;
  }
}