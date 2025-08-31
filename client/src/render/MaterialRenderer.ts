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
  imageTransform?: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    imageWidth: number;
    imageHeight: number;
  };
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
      
      // Position canvas correctly with background for visibility
      this.app.canvas.style.position = 'absolute';
      this.app.canvas.style.top = '0';
      this.app.canvas.style.left = '0';
      this.app.canvas.style.width = '100%';
      this.app.canvas.style.height = '100%';
      // Transparent background for production use
      
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
    // Apply PhotoSpace transform to WebGL stage to match Konva coordinate system
    if (this.app?.stage && config?.imageTransform) {
      const transform = config.imageTransform;
      // Apply the same PhotoSpace transform that Konva uses
      this.app.stage.position.set(transform.x, transform.y);
      this.app.stage.scale.set(transform.scaleX, transform.scaleY);
      
      // Add diagnostic anchor dots to verify alignment with Konva
      this.addDiagnosticAnchors(transform.imageWidth, transform.imageHeight);
      
      // Force render to ensure transform is applied immediately
      this.app.renderer.render(this.app.stage);
      
      console.info('[MaterialRenderer] Applied PhotoSpace transform + forced render:', {
        position: { x: transform.x, y: transform.y },
        scale: { x: transform.scaleX, y: transform.scaleY }
      });
    }
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

        // Use vertices in their original screen space coordinates
        // The mesh positioning will handle the transformation
        const meshVertices = triangulated.vertices;

        // Create mesh geometry compatible with PixiJS v8
        const geometry = new PIXI.MeshGeometry({
          positions: new Float32Array(meshVertices),
          uvs: new Float32Array(uvs),
          indices: new Uint32Array(triangulated.indices) // Fixed: use Uint32Array
        });
        
        // Create mesh with texture
        mesh = new PIXI.Mesh({ geometry, texture });
        
        // Ensure mesh is visible first - get basic rendering working
        mesh.visible = true;
        mesh.tint = 0xFFFFFF;
        mesh.alpha = 1.0;
        
        console.info('[MaterialRenderer] Basic mesh created, attempting photorealistic enhancement...');
        
        // Apply simple photorealistic effects safely
        try {
          this.applyPhotorealisticEffectsSafely(mesh, texture, material);
          console.info('[MaterialRenderer] Photorealistic effects applied successfully');
        } catch (error) {
          console.warn('[MaterialRenderer] Photorealistic effects failed, using basic texture:', error);
        }
        
        // Apply inverse image transform to mesh vertices to compensate for stage transform
        // With PhotoSpace Groups, masks are in image coordinate space
        // The stage transform handles all positioning and scaling
        mesh.position.set(0, 0);
        mesh.scale.set(1, 1);
        mesh.rotation = 0;
        
        // Debug mesh properties with coordinate analysis
        const vertices = Array.from(triangulated.vertices);
        const meshArray = Array.from(meshVertices);
        console.info('[MaterialRenderer] Mesh created with properties:', {
          vertices: triangulated.vertices.length / 2,
          triangles: triangulated.indices.length / 3,
          uvs: uvs.length / 2,
          textureSize: `${texture.width}x${texture.height}`,
          meshBounds: {
            x: mesh.x,
            y: mesh.y,
            width: mesh.width,
            height: mesh.height
          },
          vertexSample: meshArray.slice(0, 6), // First 3 coords
          uvSample: Array.from(uvs.slice(0, 6)), // First 3 UV coords
          imageTransform: config?.imageTransform,
          visible: mesh.visible,
          alpha: mesh.alpha
        });
        
        if (mesh) {
          // Clear previous mesh if exists
          const existingMesh = this.meshes.get(mask.maskId);
          if (existingMesh) {
            this.app.stage.removeChild(existingMesh);
          }
          
          this.app.stage.addChild(mesh);
          this.meshes.set(mask.maskId, mesh);
          
          console.info('[MaterialRenderer] Added mesh to stage:', {
            maskId: mask.maskId,
            vertices: triangulated.vertices.length / 2,
            stageChildren: this.app.stage.children.length,
            meshPosition: { x: mesh.x, y: mesh.y },
            meshBounds: { width: mesh.width, height: mesh.height },
            textureValid: texture && texture.source,
            canvasSize: { width: this.app.screen.width, height: this.app.screen.height }
          });
          
          // Force render update
          this.app.render();
          
          console.info('[MaterialRenderer] Render forced - mesh should now be visible');
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

      console.info('[MaterialRenderer] Rendered mask:', mask.maskId, 'with photorealistic effects');

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

  private getMaterialRoughness(material: Material): number {
    // Determine roughness based on material category and properties
    const category = (material as any).category || '';
    const finish = (material as any).finish || '';
    
    // Pool tile materials - typically smooth to slightly textured
    if (category.includes('tile')) {
      if (finish.includes('matte') || finish.includes('rough')) return 0.7;
      if (finish.includes('glossy') || finish.includes('polished')) return 0.1;
      return 0.4; // Default for tiles
    }
    
    // Waterline tiles - usually glazed, smoother
    if (category.includes('waterline')) {
      return 0.2;
    }
    
    // Coping stones - more textured
    if (category.includes('coping')) {
      return 0.6;
    }
    
    // Default medium roughness
    return 0.5;
  }
  
  private getMaterialMetallic(material: Material): number {
    // Pool materials are typically non-metallic
    const category = (material as any).category || '';
    const name = (material as any).name?.toLowerCase() || '';
    
    // Check for metallic finishes
    if (name.includes('metallic') || name.includes('steel') || name.includes('bronze')) {
      return 0.8;
    }
    
    // Most pool materials are non-metallic
    return 0.0;
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

  /** The ONLY way WebGL follows the photo: update stage pos/scale here. */
  setTransform(T:{S:number; originX:number; originY:number}) {
    if (!this.app?.stage) return;
    this.app.stage.position.set(T.originX, T.originY);
    this.app.stage.scale.set(T.S, T.S);
    // Remove any CSS transforms - use ONLY Pixi stage transforms
    if (this.app.view && this.app.view.style) {
      this.app.view.style.transform = 'none';
      this.app.view.style.transformOrigin = '0 0';
    }
    console.log('[MaterialRenderer] Applied PhotoSpace transform + forced render:', {
      position: { x: T.originX, y: T.originY },
      scale: { x: T.S, y: T.S }
    });
    // IMPORTANT: no CSS transforms on canvas; no per-mesh transforms for pan/zoom
  }

  /**
   * Create a photorealistic mesh with advanced shading
   */
  private createPhotorealisticMesh(geometry: MaskGeometry, texture: PIXI.Texture, material: any): PIXI.Mesh {
    console.log('[MaterialRenderer] Creating photorealistic mesh with enhanced filtering...');
    
    // Use the existing geometry and UV computation
    const mesh = this.createMesh(geometry, texture);
    
    // Apply photorealistic visual enhancements
    this.applyPhotorealisticEffects(mesh, texture, material);
    
    return mesh;
  }

  private applyPhotorealisticEffectsSafely(mesh: PIXI.Mesh, texture: PIXI.Texture, material: any): void {
    // Apply visual enhancements safely with error checking
    
    // 1. Enhanced texture filtering for quality (PixiJS v8 compatible)
    try {
      if (texture && texture.source) {
        texture.source.scaleMode = 'linear';
      }
    } catch (error) {
      console.warn('[MaterialRenderer] Failed to set texture properties:', error);
    }
    
    // 2. Simple color enhancement based on material type
    const category = material?.category || '';
    
    try {
      // Use simple tint instead of complex filters for now
      if (category.includes('tile') || category.includes('waterline')) {
        // Subtle blue tint for underwater tiles
        mesh.tint = 0xF0F8FF; // Alice blue tint
        mesh.alpha = 0.98;
        console.log('[MaterialRenderer] Applied tile tint');
      } else if (category.includes('coping')) {
        // Slight warm tint for stone
        mesh.tint = 0xFFF8DC; // Cornsilk tint
        mesh.alpha = 0.96;
        console.log('[MaterialRenderer] Applied coping tint');
      } else if (category.includes('paving')) {
        // Weathered outdoor tint
        mesh.tint = 0xF5F5DC; // Beige tint
        mesh.alpha = 0.94;
        console.log('[MaterialRenderer] Applied paving tint');
      } else {
        // Default: no tint, just ensure visibility
        mesh.tint = 0xFFFFFF;
        mesh.alpha = 1.0;
        console.log('[MaterialRenderer] Applied default appearance');
      }
    } catch (error) {
      console.warn('[MaterialRenderer] Failed to apply material effects:', error);
      // Fallback to basic appearance
      mesh.tint = 0xFFFFFF;
      mesh.alpha = 1.0;
    }
    
    console.log(`[MaterialRenderer] Applied safe photorealistic effects for ${category} material`);
  }

  /**
   * Update existing mesh with photorealistic properties
   */
  private updatePhotorealisticMesh(mesh: PIXI.Mesh, geometry: MaskGeometry, texture: PIXI.Texture, material: any): void {
    this.updateMesh(mesh, geometry, texture);
    
    // Reapply safe photorealistic effects to updated mesh
    try {
      this.applyPhotorealisticEffectsSafely(mesh, texture, material);
    } catch (error) {
      console.warn('[MaterialRenderer] Failed to update photorealistic effects:', error);
    }
  }

  private addDiagnosticAnchors(imgW: number, imgH: number): void {
    if (!this.app) return;
    
    // Remove existing diagnostic anchors
    this.app.stage.children = this.app.stage.children.filter(child => !child.label?.startsWith('diagnostic-'));
    
    // Create three anchor sprites at image corners to match Konva circles
    const anchorPositions = [
      { x: 0, y: 0, color: 0xff00aa },
      { x: imgW, y: 0, color: 0xff00aa },
      { x: 0, y: imgH, color: 0xff00aa }
    ];
    
    anchorPositions.forEach((pos, i) => {
      const graphics = new PIXI.Graphics();
      graphics.circle(0, 0, 4); // 4px radius to match Konva
      graphics.fill(pos.color);
      graphics.position.set(pos.x, pos.y);
      graphics.label = `diagnostic-anchor-${i}`;
      this.app!.stage.addChild(graphics);
    });
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