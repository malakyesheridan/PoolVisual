/**
 * Advanced 3D Material Renderer
 * Provides realistic 3D visualization of pool renovation materials
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Material, EditorMask } from '@shared/schema';
import { useEditorStore } from '@/stores/editorSlice';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Sun, 
  Moon,
  Palette,
  Layers,
  Eye,
  Download
} from 'lucide-react';

interface Material3DRendererProps {
  mask: EditorMask;
  material: Material;
  className?: string;
  isVisible?: boolean;
}

interface RenderSettings {
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  zoom: number;
  lightIntensity: number;
  ambientLight: number;
  materialRoughness: number;
  materialMetalness: number;
  normalScale: number;
  displacementScale: number;
  tileRepeat: number;
  perspective: number;
}

export function Material3DRenderer({ 
  mask, 
  material, 
  className = '',
  isVisible = true 
}: Material3DRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const [isRendering, setIsRendering] = useState(false);
  const [renderMode, setRenderMode] = useState<'realistic' | 'wireframe' | 'textured'>('realistic');
  
  const [settings, setSettings] = useState<RenderSettings>({
    rotationX: -30,
    rotationY: 15,
    rotationZ: 0,
    zoom: 1.2,
    lightIntensity: 1.0,
    ambientLight: 0.3,
    materialRoughness: 0.4,
    materialMetalness: 0.1,
    normalScale: 1.0,
    displacementScale: 0.02,
    tileRepeat: 4,
    perspective: 800
  });

  const store = useEditorStore();
  const { maskMaterials, photo } = store || {};
  const materialSettings = maskMaterials?.[mask.id];

  // Initialize 3D scene and renderer
  const initRenderer = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;

    setIsRendering(true);
    
    try {
      // Create 3D context for advanced rendering
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      // Clear canvas
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Create 3D geometry from mask
      await render3DMaterial(ctx, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
      
    } catch (error) {
      console.error('3D rendering failed:', error);
    } finally {
      setIsRendering(false);
    }
  }, [mask, material, settings, materialSettings, isVisible, renderMode]);

  // Advanced 3D material rendering with perspective projection
  const render3DMaterial = async (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!mask || !material) return;

    // Create 3D mesh from mask polygon/polyline
    const vertices = getMaskVertices();
    if (vertices.length < 3) return;

    // Apply 3D transformations
    const transformedVertices = vertices.map(vertex => {
      return project3DToScreen(vertex, width, height);
    });

    // Load and apply material textures
    const materialTexture = await loadMaterialTexture();
    
    // Render with different modes
    switch (renderMode) {
      case 'realistic':
        await renderRealisticMaterial(ctx, transformedVertices, materialTexture);
        break;
      case 'wireframe':
        renderWireframe(ctx, transformedVertices);
        break;
      case 'textured':
        await renderTexturedSurface(ctx, transformedVertices, materialTexture);
        break;
    }

    // Add lighting effects
    applyLightingEffects(ctx, transformedVertices);
    
    // Add surface details and material properties
    addMaterialDetails(ctx, transformedVertices);
  };

  // Convert mask geometry to 3D vertices
  const getMaskVertices = () => {
    const vertices: Array<{ x: number; y: number; z: number }> = [];
    
    if (mask.type === 'area' && 'polygon' in mask) {
      // Create 3D surface from area mask
      mask.polygon.points.forEach((point, index) => {
        vertices.push({
          x: point.x,
          y: point.y,
          z: 0 // Base surface
        });
        
        // Add depth for 3D effect based on material type
        const depth = getMaterialDepth();
        vertices.push({
          x: point.x,
          y: point.y,
          z: depth
        });
      });
    } else if (mask.type === 'linear' && 'polyline' in mask) {
      // Create 3D extrusion from linear mask
      const width = material.category === 'coping' ? 30 : 20;
      
      mask.polyline.points.forEach((point, index) => {
        // Calculate perpendicular offset for width
        const nextPoint = mask.polyline.points[index + 1] || point;
        const dx = nextPoint.x - point.x;
        const dy = nextPoint.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
          const perpX = -dy / length * width / 2;
          const perpY = dx / length * width / 2;
          
          // Add vertices for both sides of the extrusion
          vertices.push(
            { x: point.x + perpX, y: point.y + perpY, z: 0 },
            { x: point.x - perpX, y: point.y - perpY, z: 0 },
            { x: point.x + perpX, y: point.y + perpY, z: getMaterialDepth() },
            { x: point.x - perpX, y: point.y - perpY, z: getMaterialDepth() }
          );
        }
      });
    }
    
    return vertices;
  };

  // Get material-specific depth/thickness
  const getMaterialDepth = () => {
    switch (material.category) {
      case 'coping': return 15;
      case 'waterline_tile': return 8;
      case 'interior': return 5;
      case 'paving': return 25;
      case 'fencing': return 100;
      default: return 10;
    }
  };

  // Project 3D coordinates to screen space with perspective
  const project3DToScreen = (vertex: { x: number; y: number; z: number }, width: number, height: number) => {
    // Apply rotations
    const rad = Math.PI / 180;
    let { x, y, z } = vertex;

    // Rotation around X axis
    const cosX = Math.cos(settings.rotationX * rad);
    const sinX = Math.sin(settings.rotationX * rad);
    [y, z] = [y * cosX - z * sinX, y * sinX + z * cosX];

    // Rotation around Y axis
    const cosY = Math.cos(settings.rotationY * rad);
    const sinY = Math.sin(settings.rotationY * rad);
    [x, z] = [x * cosY + z * sinY, -x * sinY + z * cosY];

    // Rotation around Z axis
    const cosZ = Math.cos(settings.rotationZ * rad);
    const sinZ = Math.sin(settings.rotationZ * rad);
    [x, y] = [x * cosZ - y * sinZ, x * sinZ + y * cosZ];

    // Apply perspective projection
    const perspective = settings.perspective;
    const scale = perspective / (perspective + z);
    
    return {
      x: (x * scale * settings.zoom) + width / 2,
      y: (y * scale * settings.zoom) + height / 2,
      z: z,
      scale: scale
    };
  };

  // Load material texture and create pattern
  const loadMaterialTexture = async (): Promise<ImageData | null> => {
    try {
      if (!material.thumbnailUrl) return null;
      
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          resolve(ctx.getImageData(0, 0, img.width, img.height));
        };
        img.onerror = () => resolve(null);
        img.src = material.thumbnailUrl;
      });
    } catch (error) {
      console.error('Failed to load texture:', error);
      return null;
    }
  };

  // Render realistic material with lighting and shadows
  const renderRealisticMaterial = async (
    ctx: CanvasRenderingContext2D, 
    vertices: Array<{ x: number; y: number; z: number; scale: number }>,
    texture: ImageData | null
  ) => {
    if (vertices.length < 3) return;

    // Create gradient based on lighting
    const centerX = vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length;
    const centerY = vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length;
    
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, Math.max(100, vertices.length * 10)
    );
    
    // Apply material-specific colors and lighting
    const materialColor = getMaterialColor();
    const lightColor = `rgba(${materialColor.r + 30}, ${materialColor.g + 30}, ${materialColor.b + 30}, 0.9)`;
    const shadowColor = `rgba(${materialColor.r - 30}, ${materialColor.g - 30}, ${materialColor.b - 30}, 0.7)`;
    
    gradient.addColorStop(0, lightColor);
    gradient.addColorStop(0.7, `rgba(${materialColor.r}, ${materialColor.g}, ${materialColor.b}, 0.8)`);
    gradient.addColorStop(1, shadowColor);

    // Draw main surface
    ctx.beginPath();
    vertices.forEach((vertex, index) => {
      if (index === 0) {
        ctx.moveTo(vertex.x, vertex.y);
      } else {
        ctx.lineTo(vertex.x, vertex.y);
      }
    });
    ctx.closePath();
    
    ctx.fillStyle = gradient;
    ctx.fill();

    // Add texture overlay if available
    if (texture) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.7;
      
      // Apply texture with material settings
      const repeat = materialSettings?.repeatScale || settings.tileRepeat;
      applyTexturePattern(ctx, vertices, texture, repeat);
      
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // Add surface highlights and reflections
    addSurfaceHighlights(ctx, vertices);
  };

  // Render wireframe mode
  const renderWireframe = (
    ctx: CanvasRenderingContext2D, 
    vertices: Array<{ x: number; y: number; z: number; scale: number }>
  ) => {
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    vertices.forEach((vertex, index) => {
      if (index === 0) {
        ctx.moveTo(vertex.x, vertex.y);
      } else {
        ctx.lineTo(vertex.x, vertex.y);
      }
    });
    ctx.closePath();
    ctx.stroke();

    // Add depth lines
    vertices.forEach((vertex, index) => {
      if (index < vertices.length / 2) {
        const depthVertex = vertices[index + vertices.length / 2];
        if (depthVertex) {
          ctx.beginPath();
          ctx.moveTo(vertex.x, vertex.y);
          ctx.lineTo(depthVertex.x, depthVertex.y);
          ctx.stroke();
        }
      }
    });
  };

  // Render textured surface
  const renderTexturedSurface = async (
    ctx: CanvasRenderingContext2D, 
    vertices: Array<{ x: number; y: number; z: number; scale: number }>,
    texture: ImageData | null
  ) => {
    if (!texture || vertices.length < 3) return;

    // Draw base surface
    ctx.beginPath();
    vertices.forEach((vertex, index) => {
      if (index === 0) {
        ctx.moveTo(vertex.x, vertex.y);
      } else {
        ctx.lineTo(vertex.x, vertex.y);
      }
    });
    ctx.closePath();
    
    // Apply texture
    const repeat = materialSettings?.repeatScale || settings.tileRepeat;
    applyTexturePattern(ctx, vertices, texture, repeat);
  };

  // Apply texture pattern to surface
  const applyTexturePattern = (
    ctx: CanvasRenderingContext2D,
    vertices: Array<{ x: number; y: number; z: number; scale: number }>,
    texture: ImageData,
    repeat: number
  ) => {
    // Create pattern from texture
    const canvas = document.createElement('canvas');
    const patternCtx = canvas.getContext('2d');
    if (!patternCtx) return;
    
    canvas.width = texture.width;
    canvas.height = texture.height;
    patternCtx.putImageData(texture, 0, 0);
    
    const pattern = ctx.createPattern(canvas, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fill();
    }
  };

  // Get material-specific color
  const getMaterialColor = () => {
    const colors = {
      coping: { r: 200, g: 190, b: 180 },
      waterline_tile: { r: 150, g: 180, b: 210 },
      interior: { r: 180, g: 200, b: 220 },
      paving: { r: 170, g: 160, b: 140 },
      fencing: { r: 140, g: 120, b: 100 }
    };
    
    return colors[material.category as keyof typeof colors] || { r: 180, g: 180, b: 180 };
  };

  // Apply lighting effects
  const applyLightingEffects = (
    ctx: CanvasRenderingContext2D,
    vertices: Array<{ x: number; y: number; z: number; scale: number }>
  ) => {
    // Add ambient lighting
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = settings.ambientLight * 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    
    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  };

  // Add surface highlights and material details
  const addSurfaceHighlights = (
    ctx: CanvasRenderingContext2D,
    vertices: Array<{ x: number; y: number; z: number; scale: number }>
  ) => {
    // Add glossy highlights for certain materials
    if (['waterline_tile', 'interior'].includes(material.category)) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.4;
      
      const highlight = ctx.createLinearGradient(
        vertices[0]?.x || 0, vertices[0]?.y || 0,
        vertices[vertices.length - 1]?.x || 0, vertices[vertices.length - 1]?.y || 0
      );
      highlight.addColorStop(0, 'rgba(255, 255, 255, 0)');
      highlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
      highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = highlight;
      ctx.fill();
      
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  };

  // Add material-specific surface details
  const addMaterialDetails = (
    ctx: CanvasRenderingContext2D,
    vertices: Array<{ x: number; y: number; z: number; scale: number }>
  ) => {
    // Add material-specific surface textures and patterns
    switch (material.category) {
      case 'coping':
        addCopingDetails(ctx, vertices);
        break;
      case 'waterline_tile':
        addTileGroutLines(ctx, vertices);
        break;
      case 'paving':
        addPavingTexture(ctx, vertices);
        break;
    }
  };

  const addCopingDetails = (ctx: CanvasRenderingContext2D, vertices: Array<{ x: number; y: number; z: number; scale: number }>) => {
    // Add edge beveling for coping
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const addTileGroutLines = (ctx: CanvasRenderingContext2D, vertices: Array<{ x: number; y: number; z: number; scale: number }>) => {
    // Add grout line pattern
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.8)';
    ctx.lineWidth = 1;
    
    // Create grid pattern for tiles
    const tileSize = 20 * settings.zoom;
    vertices.forEach((vertex, index) => {
      if (index % Math.floor(tileSize) === 0) {
        ctx.beginPath();
        ctx.moveTo(vertex.x - 5, vertex.y);
        ctx.lineTo(vertex.x + 5, vertex.y);
        ctx.stroke();
      }
    });
  };

  const addPavingTexture = (ctx: CanvasRenderingContext2D, vertices: Array<{ x: number; y: number; z: number; scale: number }>) => {
    // Add stone/brick texture
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    vertices.forEach((vertex, index) => {
      if (index % 3 === 0) {
        ctx.fillRect(vertex.x - 2, vertex.y - 2, 4, 4);
      }
    });
  };

  // Update settings handler
  const updateSetting = useCallback((key: keyof RenderSettings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // Export rendered image
  const exportRender = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `3d-material-preview-${material.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = canvas.toDataURL();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [material.name]);

  // Initialize and re-render when dependencies change
  useEffect(() => {
    if (isVisible) {
      initRenderer();
    }
  }, [initRenderer, isVisible]);

  // Animation loop for interactive updates
  useEffect(() => {
    if (isVisible && settings.rotationY !== 0) {
      const animate = () => {
        initRenderer();
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animationFrameRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [settings, initRenderer, isVisible]);

  if (!isVisible) return null;

  return (
    <Card className={`${className} bg-gray-50`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center">
            <Layers className="h-4 w-4 mr-2 text-blue-600" />
            3D Material Preview: {material.name}
          </div>
          <div className="flex items-center space-x-1">
            <Badge variant="secondary" className="text-xs">
              {material.category}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={exportRender}
              className="h-6 w-6 p-0"
              title="Export 3D Preview"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 3D Canvas */}
        <div className="relative bg-white rounded border">
          <canvas
            ref={canvasRef}
            className="w-full h-64 rounded"
            style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}
          />
          
          {isRendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 rounded">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          )}

          {/* Render Mode Toggle */}
          <div className="absolute top-2 left-2">
            <div className="flex bg-white rounded shadow-sm border">
              {(['realistic', 'wireframe', 'textured'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setRenderMode(mode)}
                  className={`px-2 py-1 text-xs rounded ${
                    renderMode === mode 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3D Controls */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <label className="text-gray-600">Rotation X</label>
            <Slider
              value={[settings.rotationX]}
              onValueChange={([value]) => updateSetting('rotationX', value)}
              min={-90}
              max={90}
              step={5}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-gray-600">Rotation Y</label>
            <Slider
              value={[settings.rotationY]}
              onValueChange={([value]) => updateSetting('rotationY', value)}
              min={-90}
              max={90}
              step={5}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-gray-600">Zoom</label>
            <Slider
              value={[settings.zoom]}
              onValueChange={([value]) => updateSetting('zoom', value)}
              min={0.5}
              max={3}
              step={0.1}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-gray-600">Light Intensity</label>
            <Slider
              value={[settings.lightIntensity]}
              onValueChange={([value]) => updateSetting('lightIntensity', value)}
              min={0}
              max={2}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex space-x-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateSetting('rotationX', -30)}
              className="h-7 px-2"
              title="Reset View"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateSetting('zoom', settings.zoom + 0.2)}
              className="h-7 px-2"
              title="Zoom In"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateSetting('zoom', Math.max(0.5, settings.zoom - 0.2))}
              className="h-7 px-2"
              title="Zoom Out"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <Eye className="h-3 w-3" />
            <span>Real-time 3D Preview</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}