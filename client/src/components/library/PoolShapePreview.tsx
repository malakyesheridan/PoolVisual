// Pool Shape Preview Component
// Shows visual representation of pool shape with materials

import React, { useRef, useEffect } from 'react';
import { Badge } from '../ui/badge';

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
}

export function PoolShapePreview({ 
  type, 
  dimensions, 
  cornerRadius = 20,
  materials,
  onDimensionChange 
}: PoolShapePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    drawPoolPreview();
  }, [type, dimensions, cornerRadius, materials]);
  
  const drawPoolPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    const canvasSize = 200;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    
    // Calculate scale to fit pool in canvas
    const maxDimension = Math.max(dimensions.width, dimensions.height);
    const scale = (canvasSize * 0.8) / maxDimension;
    
    // Center the pool
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    
    // Generate pool points based on type
    const points = generatePoolPoints(type, dimensions, cornerRadius, scale, centerX, centerY);
    
    // Draw pool shape
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    
    // Fill with interior material color (or default)
    ctx.fillStyle = materials?.interior ? '#4A90E2' : '#87CEEB';
    ctx.fill();
    
    // Draw border (coping)
    ctx.strokeStyle = materials?.coping ? '#8B4513' : '#654321';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw waterline
    if (materials?.waterline) {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Draw paving around pool (simplified)
    if (materials?.paving) {
      ctx.strokeStyle = '#808080';
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    
    // Add pool type label
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(type.toUpperCase(), centerX, centerY);
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
        // Kidney-shaped pool
        const numPoints = 16;
        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          const radiusX = scaledWidth / 2;
          const radiusY = scaledHeight / 2;
          
          // Kidney shape formula
          const x = centerX + radiusX * Math.cos(angle) * (1 + 0.3 * Math.sin(angle * 2));
          const y = centerY + radiusY * Math.sin(angle) * (1 + 0.2 * Math.cos(angle * 2));
          
          points.push({ x, y });
        }
        break;
        
      case 'freeform':
        // Freeform pool
        const freeformPoints = 20;
        for (let i = 0; i < freeformPoints; i++) {
          const angle = (i / freeformPoints) * Math.PI * 2;
          const radiusX = scaledWidth / 2;
          const radiusY = scaledHeight / 2;
          
          // Freeform shape with organic curves
          const noise = 0.1 + 0.2 * Math.sin(angle * 3) + 0.1 * Math.cos(angle * 5);
          const x = centerX + radiusX * Math.cos(angle) * (1 + noise);
          const y = centerY + radiusY * Math.sin(angle) * (1 + noise);
          
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
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Pool Preview</h3>
        <Badge variant="outline" className="text-xs">
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Badge>
      </div>
      
      <div className="aspect-square bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
        <canvas 
          ref={canvasRef}
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      
      {/* Material legend */}
      {materials && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-600">Materials Applied:</div>
          <div className="flex flex-wrap gap-1">
            {materials.interior && (
              <Badge variant="secondary" className="text-xs">
                Interior: {materials.interior}
              </Badge>
            )}
            {materials.coping && (
              <Badge variant="secondary" className="text-xs">
                Coping: {materials.coping}
              </Badge>
            )}
            {materials.waterline && (
              <Badge variant="secondary" className="text-xs">
                Waterline: {materials.waterline}
              </Badge>
            )}
            {materials.paving && (
              <Badge variant="secondary" className="text-xs">
                Paving: {materials.paving}
              </Badge>
            )}
          </div>
        </div>
      )}
      
      {/* Interactive resize handles (if onDimensionChange provided) */}
      {onDimensionChange && (
        <div className="text-xs text-gray-500 text-center">
          Drag the preview to resize (coming soon)
        </div>
      )}
    </div>
  );
}
