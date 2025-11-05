// Pool Shape Preview Component
// Shows visual representation of pool shape with materials

import React, { useRef, useEffect } from 'react';
import { Badge } from '../ui/badge';
import { getProxiedTextureUrl } from '../../lib/textureProxy';

interface PoolShapePreviewProps {
  type: 'rect' | 'lap' | 'kidney' | 'freeform';
  dimensions: { width: number; height: number };
  cornerRadius?: number;
  materials?: {
    coping?: string;
    waterline?: string;
    interior?: string;
    paving?: string;
  };
  onDimensionChange?: (width: number, height: number) => void;
  customPoints?: Array<{ x: number; y: number }>;
}

// Helper function to load texture images
const loadTextureImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

export function PoolShapePreview({ 
  type, 
  dimensions, 
  cornerRadius = 20,
  materials,
  onDimensionChange,
  customPoints 
}: PoolShapePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const drawPoolPreview = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size (optimized for visibility and detail)
    const canvasSize = 400;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    
    // Try to load material images
    let materialImages: {
      interior?: HTMLImageElement;
      coping?: HTMLImageElement;
      waterline?: HTMLImageElement;
      paving?: HTMLImageElement;
    } = {};
    
    if (materials) {
      try {
        // Dynamic import to avoid circular dependencies
        const { ensureLoaded, getById } = await import('../../materials/registry');
        await ensureLoaded();
        
        // Load interior material
        if (materials.interior) {
          const material = getById(materials.interior);
          if (material?.thumbnailURL || material?.albedoURL) {
            try {
              const imageUrl = material.thumbnailURL || material.albedoURL || '';
              const proxiedUrl = getProxiedTextureUrl(imageUrl);
              const img = await loadTextureImage(proxiedUrl);
              materialImages.interior = img;
            } catch (err) {
              console.warn('[PoolShapePreview] Failed to load interior texture:', err);
            }
          }
        }
        
        // Load coping material
        if (materials.coping) {
          const material = getById(materials.coping);
          if (material?.thumbnailURL || material?.albedoURL) {
            try {
              const imageUrl = material.thumbnailURL || material.albedoURL || '';
              const proxiedUrl = getProxiedTextureUrl(imageUrl);
              const img = await loadTextureImage(proxiedUrl);
              materialImages.coping = img;
            } catch (err) {
              console.warn('[PoolShapePreview] Failed to load coping texture:', err);
            }
          }
        }
        
        // Load waterline material
        if (materials.waterline) {
          const material = getById(materials.waterline);
          if (material?.thumbnailURL || material?.albedoURL) {
            try {
              const imageUrl = material.thumbnailURL || material.albedoURL || '';
              const proxiedUrl = getProxiedTextureUrl(imageUrl);
              const img = await loadTextureImage(proxiedUrl);
              materialImages.waterline = img;
            } catch (err) {
              console.warn('[PoolShapePreview] Failed to load waterline texture:', err);
            }
          }
        }
        
        // Load paving material
        if (materials.paving) {
          const material = getById(materials.paving);
          if (material?.thumbnailURL || material?.albedoURL) {
            try {
              const imageUrl = material.thumbnailURL || material.albedoURL || '';
              const proxiedUrl = getProxiedTextureUrl(imageUrl);
              const img = await loadTextureImage(proxiedUrl);
              materialImages.paving = img;
            } catch (err) {
              console.warn('[PoolShapePreview] Failed to load paving texture:', err);
            }
          }
        }
      } catch (err) {
        console.warn('[PoolShapePreview] Material loading failed, using fallback:', err);
      }
    }
    
    // Calculate scale to fit pool in canvas
    const maxDimension = Math.max(dimensions.width, dimensions.height);
    const scale = (canvasSize * 0.7) / maxDimension;
    
    // Center the pool
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    
    // Multi-section rendering with proper layering
    const sections = [
      { name: 'paving', offset: 60, materialImage: materialImages.paving, fallbackColor: '#8B7355' },
      { name: 'coping', offset: 25, materialImage: materialImages.coping, fallbackColor: '#A0522D' },
      { name: 'waterline', offset: 12, materialImage: materialImages.waterline, fallbackColor: '#4682B4' },
      { name: 'interior', offset: 0, materialImage: materialImages.interior, fallbackColor: '#4A90E2' },
    ];
    
    // Draw sections from back to front
    for (const section of sections) {
      let points: Array<{ x: number; y: number }> = [];
      
      // Use custom points for freeform if available
      if (type === 'freeform' && customPoints && customPoints.length > 0) {
        // Calculate bounding box of custom points
        const minX = Math.min(...customPoints.map(p => p.x));
        const maxX = Math.max(...customPoints.map(p => p.x));
        const minY = Math.min(...customPoints.map(p => p.y));
        const maxY = Math.max(...customPoints.map(p => p.y));
        
        const customWidth = maxX - minX;
        const customHeight = maxY - minY;
        
        // Scale to fit canvas with some offset for multi-section
        const scale = (canvasSize * 0.6) / Math.max(customWidth, customHeight);
        
        // Center the points
        const centerOffsetX = minX + customWidth / 2;
        const centerOffsetY = minY + customHeight / 2;
        
        points = customPoints.map(pt => ({
          x: centerX + (pt.x - centerOffsetX) * scale * (1 + section.offset / 400),
          y: centerY + (pt.y - centerOffsetY) * scale * (1 + section.offset / 400)
        }));
      } else {
        const sectionScale = scale * (1 + (section.offset / Math.max(dimensions.width, dimensions.height)));
        points = generatePoolPoints(type, dimensions, cornerRadius, sectionScale, centerX, centerY);
      }
      
      if (points.length === 0) continue;
      
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      
      // Fill with material image or fallback color
      if (section.materialImage) {
        const pattern = ctx.createPattern(section.materialImage, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
        } else {
          ctx.fillStyle = section.fallbackColor;
        }
      } else {
        ctx.fillStyle = section.fallbackColor;
      }
      ctx.fill();
      
      // Add subtle stroke for definition
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  };
  
  const generatePoolPoints = (
    poolType: string, 
    dims: { width: number; height: number }, 
    radius: number, 
    scale: number, 
    centerX: number, 
    centerY: number
  ) => {
    const scaledWidth = dims.width * scale;
    const scaledHeight = dims.height * scale;
    const scaledRadius = radius * scale;
    
    let points: Array<{ x: number; y: number }> = [];
    
    switch (poolType) {
      case 'rect':
      case 'lap':
        // Rectangular pool with rounded corners
        const halfWidth = scaledWidth / 2;
        const halfHeight = scaledHeight / 2;
        
        points = [
          { x: centerX - halfWidth + scaledRadius, y: centerY - halfHeight },
          { x: centerX + halfWidth - scaledRadius, y: centerY - halfHeight },
          { x: centerX + halfWidth, y: centerY - halfHeight + scaledRadius },
          { x: centerX + halfWidth, y: centerY + halfHeight - scaledRadius },
          { x: centerX + halfWidth - scaledRadius, y: centerY + halfHeight },
          { x: centerX - halfWidth + scaledRadius, y: centerY + halfHeight },
          { x: centerX - halfWidth, y: centerY + halfHeight - scaledRadius },
          { x: centerX - halfWidth, y: centerY - halfHeight + scaledRadius },
        ];
        break;
        
      case 'kidney':
        // Natural kidney/bean shape - organic curves
        const kidneyPoints = 40;
        for (let i = 0; i < kidneyPoints; i++) {
          const t = (i / kidneyPoints) * Math.PI * 2;
          
          // Base ellipse dimensions
          const majorRadius = scaledWidth / 2.4;
          const minorRadius = scaledHeight / 2.8;
          
          // Create kidney bean shape with smooth indentation
          // The indentation is deeper on one side (creating the bean look)
          const indentPhase = t + Math.PI;
          const indentDepth = 0.3; // How deep the indent goes
          const indentEffect = 1 - indentDepth * (0.5 + 0.5 * Math.cos(indentPhase));
          
          // Apply indentation only to one side for the kidney effect
          const kidneyFactor = indentEffect > 0.7 ? 1 : (0.7 + 0.3 * indentEffect);
          
          const x = centerX + majorRadius * Math.cos(t) * kidneyFactor;
          const y = centerY + minorRadius * Math.sin(t);
          
          points.push({ x, y });
        }
        break;
        
      case 'freeform':
        // Organic freeform shape - flowing, natural curves
        const freeformPoints = 40;
        for (let i = 0; i < freeformPoints; i++) {
          const t = (i / freeformPoints) * Math.PI * 2;
          
          // Base ellipse
          const baseRadiusX = scaledWidth / 2.5;
          const baseRadiusY = scaledHeight / 2.7;
          
          // Natural flowing curves with multiple harmonic frequencies
          const wave1 = 1 + 0.15 * Math.sin(t * 3 - 0.5); // 3 primary lobes
          const wave2 = 1 + 0.12 * Math.sin(t * 5 + 1.2); // 5 secondary lobes
          const wave3 = 1 + 0.08 * Math.sin(t * 7); // 7 fine detail
          const wave4 = 1 + 0.05 * Math.sin(t * 11); // 11 subtle variations
          
          const combinedWave = wave1 * wave2 * wave3 * wave4;
          
          // Slight asymmetry for natural look
          const asymX = 1 + 0.03 * Math.sin(t * 9);
          const asymY = 1 - 0.03 * Math.cos(t * 9);
          
          const x = centerX + baseRadiusX * Math.cos(t) * combinedWave * asymX;
          const y = centerY + baseRadiusY * Math.sin(t) * combinedWave * asymY;
          
          points.push({ x, y });
        }
        break;
        
      default:
        // Default rectangular
        const defaultHalfWidth = scaledWidth / 2;
        const defaultHalfHeight = scaledHeight / 2;
        points = [
          { x: centerX - defaultHalfWidth, y: centerY - defaultHalfHeight },
          { x: centerX + defaultHalfWidth, y: centerY - defaultHalfHeight },
          { x: centerX + defaultHalfWidth, y: centerY + defaultHalfHeight },
          { x: centerX - defaultHalfWidth, y: centerY + defaultHalfHeight },
        ];
    }
    
    return points;
  };
  
  useEffect(() => {
    const draw = async () => {
      try {
        await drawPoolPreview();
      } catch (err) {
        console.warn('[PoolShapePreview] Failed to draw preview:', err);
      }
    };
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, dimensions, cornerRadius, materials, customPoints]);
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-gray-700">Live Preview</h3>
        <Badge variant="outline" className="text-xs">
          {type.charAt(0).toUpperCase() + type.slice(1)} Pool
        </Badge>
      </div>
      
      <div className="w-full h-64 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <canvas 
          ref={canvasRef}
          className="w-full h-full"
        />
      </div>
      
      {/* Material info (condensed) */}
      {materials && Object.values(materials).some(Boolean) && (
        <div className="text-xs text-gray-500 text-center">
          {Object.values(materials).filter(Boolean).length} material{Object.values(materials).filter(Boolean).length !== 1 ? 's' : ''} applied
        </div>
      )}
    </div>
  );
}
