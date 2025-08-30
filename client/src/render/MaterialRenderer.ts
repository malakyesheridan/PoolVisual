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

      // Create Pixi Application with WebGL2 preferred, WebGL1 fallback
      this.app = new PIXI.Application({
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
      container.appendChild(this.app.view as HTMLCanvasElement);
      
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
        renderer: this.app.renderer.type === PIXI.RendererType.WEBGL ? 'WebGL' : 'Canvas',
        version: (this.app.renderer as any).gl?.getParameter((this.app.renderer as any).gl.VERSION),
        size: { width: this.app.view.width, height: this.app.view.height }
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
        
        // Create new mesh
        const geometry = new PIXI.Geometry();
        const shader = new MaterialPass();
        mesh = new PIXI.Mesh(geometry, shader);
        
        if (mesh) {
          this.app.stage.addChild(mesh);
          this.meshes.set(mask.maskId, mesh);
        }
      }

      // Update geometry if points changed
      if (needsGeometryUpdate && mesh) {
        await this.updateMeshGeometry(mesh, mask, config);
      }

      // Update material and uniforms
      if (mesh) {
        await this.updateMeshMaterial(mesh, material, mask, config);
      }

      console.info('[render]', mask.maskId, {
        repeatPx: mask.meta?.scale || 256,
        bond: mask.meta?.bond || 'straight',
        stageScale: config.stageScale
      });

    } catch (error) {
      console.error('[MaterialRenderer] Failed to render mask:', mask.maskId, error);
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

    // Update geometry
    const geometry = mesh.geometry;
    geometry.addAttribute('aVertexPosition', triangulated.vertices, 2);
    geometry.addAttribute('aTextureCoord', uvs, 2);
    geometry.addIndex(triangulated.indices);
  }

  private async updateMeshMaterial(
    mesh: PIXI.Mesh,
    material: Material,
    mask: MaskGeometry,
    config: RenderConfig
  ): Promise<void> {
    // Get material texture
    const textureUrl = (material as any).textureUrl || (material as any).texture_url || '';
    if (!textureUrl) return;

    const texture = await this.textureManager.getTexture(material.id, textureUrl, {
      mipmaps: true,
      anisotropicFiltering: true
    });

    if (!texture) return;

    // Update shader uniforms
    const shader = mesh.shader as any; // MaterialPass extends PIXI.Shader
    if (shader && shader.uniforms) {
      shader.uniforms.uTex = texture;
      shader.uniforms.uGamma = 2.2;
      shader.uniforms.uContrast = 1.1;
      shader.uniforms.uSaturation = 1.0;
      shader.uniforms.uAO = 0.1;
      shader.uniforms.uFeather = 4.0;
    }

    // Scale and repeat based on material properties
    const repeatM = this.getPhysicalRepeat(material);
    const repeatPx = (mask.meta?.scale || 256) / config.pxPerMeter * repeatM;
    
    if (shader && shader.uniforms) {
      shader.uniforms.uRepeatScale = [1.0 / repeatPx, 1.0 / repeatPx];
      const bondValues = { straight: 0.0, brick50: 1.0, herringbone: 2.0 };
      shader.uniforms.uBond = bondValues[mask.meta?.bond as keyof typeof bondValues] || 0.0;
      shader.uniforms.uGroutWidth = (mask.meta?.groutMm || 2) / 1000 / repeatM;
      shader.uniforms.uGroutColor = this.parseColor(mask.meta?.groutColor || '#cccccc');
    }

    console.info('[tex] loaded', material.id, texture.baseTexture.width, texture.baseTexture.height);
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