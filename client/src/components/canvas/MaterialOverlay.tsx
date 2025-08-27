import React, { useRef, useEffect, useCallback } from 'react';
import { Application, Graphics, Container, Sprite, Texture, Filter } from 'pixi.js';
import { triangulate } from 'earcut';
import { Material, Mask } from '@shared/schema';

interface MaterialOverlayProps {
  width: number;
  height: number;
  masks: Mask[];
  materials: Material[];
  pixelsPerMeter: number;
  onMaterialUpdate?: (maskId: string, settings: MaterialSettings) => void;
}

interface MaterialSettings {
  repeatScale: number;
  rotationDeg: number;
  brightness: number;
  contrast: number;
}

// WebGL fragment shader for advanced material blending
const materialShader = `
precision mediump float;

varying vec2 vUV;
varying vec2 vWorldPos;

uniform sampler2D uTexture;
uniform sampler2D uBasePhoto;
uniform float uPPM;
uniform float uRepeatM;
uniform float uRepeatScale;
uniform float uRotation;
uniform float uBrightness;
uniform float uContrast;
uniform vec2 uPhotoSize;

mat2 rotate2D(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

vec3 softLight(vec3 base, vec3 blend) {
  vec3 result;
  for(int i = 0; i < 3; i++) {
    if(blend[i] < 0.5) {
      result[i] = 2.0 * base[i] * blend[i] + base[i] * base[i] * (1.0 - 2.0 * blend[i]);
    } else {
      result[i] = sqrt(base[i]) * (2.0 * blend[i] - 1.0) + 2.0 * base[i] * (1.0 - blend[i]);
    }
  }
  return result;
}

void main() {
  // Convert world position to meters
  vec2 worldM = vWorldPos / uPPM;
  
  // Apply rotation
  vec2 rotatedM = rotate2D(radians(uRotation)) * worldM;
  
  // Calculate UV based on physical repeat and scale
  float repeatM = uRepeatM > 0.0 ? uRepeatM : 0.30; // fallback 30cm
  vec2 uv = (rotatedM / repeatM) * uRepeatScale;
  
  // Sample material texture with wrapping
  vec4 materialColor = texture2D(uTexture, fract(uv));
  
  // Apply brightness and contrast
  materialColor.rgb = (materialColor.rgb - 0.5) * uContrast + 0.5 + uBrightness;
  materialColor.rgb = clamp(materialColor.rgb, 0.0, 1.0);
  
  // Sample base photo for lighting information
  vec2 photoUV = vWorldPos / uPhotoSize;
  vec4 baseColor = texture2D(uBasePhoto, photoUV);
  
  // Apply soft-light blending to preserve lighting
  vec3 blended = softLight(baseColor.rgb, materialColor.rgb);
  
  // Edge feathering based on distance to polygon edge
  float edgeAlpha = smoothstep(0.0, 16.0, min(
    distance(gl_FragCoord.xy, vWorldPos),
    16.0
  ));
  
  gl_FragColor = vec4(blended, materialColor.a * edgeAlpha);
}
`;

export function MaterialOverlay({ 
  width, 
  height, 
  masks, 
  materials, 
  pixelsPerMeter,
  onMaterialUpdate 
}: MaterialOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const materialContainerRef = useRef<Container | null>(null);

  // Initialize PIXI application
  useEffect(() => {
    if (!canvasRef.current) return;

    const app = new Application({
      view: canvasRef.current,
      width,
      height,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    appRef.current = app;
    
    // Create container for material overlays
    const materialContainer = new Container();
    materialContainerRef.current = materialContainer;
    app.stage.addChild(materialContainer);

    return () => {
      app.destroy(true);
    };
  }, [width, height]);

  // Create triangulated polygon for mask
  const createMaskGeometry = useCallback((mask: Mask) => {
    const points = mask.pathJson.points as Array<{x: number, y: number}>;
    if (points.length < 3) return null;

    // Flatten points for earcut
    const coords: number[] = [];
    points.forEach(p => {
      coords.push(p.x, p.y);
    });

    // Triangulate
    const triangles = triangulate(coords);
    
    return {
      vertices: coords,
      indices: triangles
    };
  }, []);

  // Create material sprite for a mask
  const createMaterialSprite = useCallback(async (mask: Mask, material: Material) => {
    if (!material.textureUrl) return null;

    try {
      // Load texture
      const texture = await Texture.from(material.textureUrl);
      
      // Create geometry
      const geometry = createMaskGeometry(mask);
      if (!geometry) return null;

      // Create graphics object for the polygon
      const graphics = new Graphics();
      
      // Apply material texture using custom shader (simplified for now)
      const materialSettings = mask.calcMetaJson as MaterialSettings || {
        repeatScale: 1.0,
        rotationDeg: 0,
        brightness: 0,
        contrast: 1.0
      };

      // Calculate initial scale based on physical dimensions
      const physicalRepeatM = material.physicalRepeatM ? 
        parseFloat(material.physicalRepeatM.toString()) : 0.30;
      
      const textureSize = 1024; // Assume 1024px texture
      const initialScale = (textureSize / physicalRepeatM) / pixelsPerMeter;
      const finalScale = initialScale * materialSettings.repeatScale;

      // Draw polygon with tiled texture
      graphics.beginTextureFill({
        texture,
        matrix: new PIXI.Matrix()
          .scale(finalScale, finalScale)
          .rotate(materialSettings.rotationDeg * Math.PI / 180)
      });

      // Draw the triangulated polygon
      for (let i = 0; i < geometry.indices.length; i += 3) {
        const i1 = geometry.indices[i] * 2;
        const i2 = geometry.indices[i + 1] * 2;
        const i3 = geometry.indices[i + 2] * 2;
        
        if (i === 0) {
          graphics.moveTo(geometry.vertices[i1], geometry.vertices[i1 + 1]);
        }
        graphics.lineTo(geometry.vertices[i2], geometry.vertices[i2 + 1]);
        graphics.lineTo(geometry.vertices[i3], geometry.vertices[i3 + 1]);
      }
      
      graphics.endFill();

      // Apply blend mode for realistic lighting
      graphics.blendMode = PIXI.BLEND_MODES.MULTIPLY;
      graphics.alpha = 0.8;

      return graphics;

    } catch (error) {
      console.error('Failed to create material sprite:', error);
      return null;
    }
  }, [createMaskGeometry, pixelsPerMeter]);

  // Update material overlays when masks or materials change
  useEffect(() => {
    if (!materialContainerRef.current) return;

    const updateOverlays = async () => {
      // Clear existing overlays
      materialContainerRef.current!.removeChildren();

      // Create overlays for masks with materials
      for (const mask of masks) {
        if (!mask.materialId) continue;

        const material = materials.find(m => m.id === mask.materialId);
        if (!material) continue;

        const sprite = await createMaterialSprite(mask, material);
        if (sprite) {
          materialContainerRef.current!.addChild(sprite);
        }
      }
    };

    updateOverlays();
  }, [masks, materials, createMaterialSprite]);

  // Handle material settings updates
  const updateMaterialSettings = useCallback((maskId: string, settings: MaterialSettings) => {
    onMaterialUpdate?.(maskId, settings);
  }, [onMaterialUpdate]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 10
      }}
      data-testid="material-overlay-canvas"
    />
  );
}

// Material controls component
interface MaterialControlsProps {
  maskId: string;
  settings: MaterialSettings;
  onUpdate: (settings: MaterialSettings) => void;
}

export function MaterialControls({ maskId, settings, onUpdate }: MaterialControlsProps) {
  return (
    <div className="space-y-3 p-3 bg-slate-50 rounded-lg" data-testid={`material-controls-${maskId}`}>
      <h4 className="font-medium text-sm">Material Settings</h4>
      
      {/* Repeat Scale */}
      <div className="space-y-1">
        <label className="text-xs text-slate-600">Scale</label>
        <input
          type="range"
          min="0.25"
          max="4"
          step="0.1"
          value={settings.repeatScale}
          onChange={(e) => onUpdate({ ...settings, repeatScale: parseFloat(e.target.value) })}
          className="w-full"
          data-testid="slider-repeat-scale"
        />
        <div className="text-xs text-slate-500">{settings.repeatScale.toFixed(1)}×</div>
      </div>

      {/* Rotation */}
      <div className="space-y-1">
        <label className="text-xs text-slate-600">Rotation</label>
        <input
          type="range"
          min="0"
          max="360"
          step="15"
          value={settings.rotationDeg}
          onChange={(e) => onUpdate({ ...settings, rotationDeg: parseFloat(e.target.value) })}
          className="w-full"
          data-testid="slider-rotation"
        />
        <div className="text-xs text-slate-500">{settings.rotationDeg}°</div>
      </div>

      {/* Brightness */}
      <div className="space-y-1">
        <label className="text-xs text-slate-600">Brightness</label>
        <input
          type="range"
          min="-0.3"
          max="0.3"
          step="0.05"
          value={settings.brightness}
          onChange={(e) => onUpdate({ ...settings, brightness: parseFloat(e.target.value) })}
          className="w-full"
          data-testid="slider-brightness"
        />
        <div className="text-xs text-slate-500">{settings.brightness > 0 ? '+' : ''}{(settings.brightness * 100).toFixed(0)}%</div>
      </div>

      {/* Contrast */}
      <div className="space-y-1">
        <label className="text-xs text-slate-600">Contrast</label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={settings.contrast}
          onChange={(e) => onUpdate({ ...settings, contrast: parseFloat(e.target.value) })}
          className="w-full"
          data-testid="slider-contrast"
        />
        <div className="text-xs text-slate-500">{(settings.contrast * 100).toFixed(0)}%</div>
      </div>
    </div>
  );
}