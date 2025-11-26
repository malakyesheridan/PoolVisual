// Dimension Helper Component
// Converts pixels to real-world measurements and provides intuitive controls

import React from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Ruler, Info } from 'lucide-react';

interface DimensionHelperProps {
  pixelsPerMeter: number;
  width: number;
  height: number;
  onDimensionChange: (width: number, height: number) => void;
  showRealWorld?: boolean;
  showSliders?: boolean;
}

export function DimensionHelper({ 
  pixelsPerMeter, 
  width, 
  height, 
  onDimensionChange,
  showRealWorld = true,
  showSliders = true 
}: DimensionHelperProps) {
  // Convert pixels to meters
  const realWidth = width / pixelsPerMeter;
  const realHeight = height / pixelsPerMeter;
  
  // Convert meters to feet for imperial users
  const realWidthFeet = realWidth * 3.28084;
  const realHeightFeet = realHeight * 3.28084;
  
  // Determine pool size category
  const getPoolSizeCategory = (widthM: number, heightM: number) => {
    const area = widthM * heightM;
    if (area > 80) return { category: 'Extra Large', color: 'bg-purple-100 text-purple-800' };
    if (area > 50) return { category: 'Large', color: 'bg-primary/10 text-primary' };
    if (area > 25) return { category: 'Medium', color: 'bg-green-100 text-green-800' };
    return { category: 'Small', color: 'bg-yellow-100 text-yellow-800' };
  };
  
  const sizeInfo = getPoolSizeCategory(realWidth, realHeight);
  
  const handleRealWorldChange = (newWidthM: number, newHeightM: number) => {
    const newWidthPx = newWidthM * pixelsPerMeter;
    const newHeightPx = newHeightM * pixelsPerMeter;
    onDimensionChange(newWidthPx, newHeightPx);
  };

  return (
    <div className="space-y-4">
      {/* Real-world measurements display */}
      {showRealWorld && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-gray-500" />
            <Label className="text-sm font-medium text-gray-700">Real-world Size</Label>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Width</Label>
              <div className="text-lg font-semibold text-gray-900">
                {realWidth.toFixed(1)}m
              </div>
              <div className="text-sm text-gray-500">
                {realWidthFeet.toFixed(1)} ft
              </div>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Height</Label>
              <div className="text-lg font-semibold text-gray-900">
                {realHeight.toFixed(1)}m
              </div>
              <div className="text-sm text-gray-500">
                {realHeightFeet.toFixed(1)} ft
              </div>
            </div>
          </div>
          
          {/* Pool size category */}
          <div className="flex items-center gap-2">
            <Badge className={sizeInfo.color}>
              {sizeInfo.category} Pool
            </Badge>
            <div className="text-xs text-gray-500">
              Area: {(realWidth * realHeight).toFixed(1)}m²
            </div>
          </div>
        </div>
      )}

      {/* Interactive sliders for real-world dimensions */}
      {showSliders && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Width (meters)</Label>
              <div className="text-sm text-gray-500">{realWidth.toFixed(1)}m</div>
            </div>
            <input 
              type="range" 
              min="3" 
              max="20" 
              step="0.5"
              value={realWidth}
              onChange={(e) => handleRealWorldChange(parseFloat(e.target.value), realHeight)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((realWidth - 3) / (20 - 3)) * 100}%, #E5E7EB ${((realWidth - 3) / (20 - 3)) * 100}%, #E5E7EB 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>3m</span>
              <span>20m</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Height (meters)</Label>
              <div className="text-sm text-gray-500">{realHeight.toFixed(1)}m</div>
            </div>
            <input 
              type="range" 
              min="2" 
              max="15" 
              step="0.5"
              value={realHeight}
              onChange={(e) => handleRealWorldChange(realWidth, parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((realHeight - 2) / (15 - 2)) * 100}%, #E5E7EB ${((realHeight - 2) / (15 - 2)) * 100}%, #E5E7EB 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>2m</span>
              <span>15m</span>
            </div>
          </div>
        </div>
      )}

      {/* Pixel inputs for precise control */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">Pixel Dimensions (for precise control)</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-500">Width (px)</Label>
            <Input
              type="number"
              value={Math.round(width)}
              onChange={(e) => onDimensionChange(parseInt(e.target.value) || 0, height)}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Height (px)</Label>
            <Input
              type="number"
              value={Math.round(height)}
              onChange={(e) => onDimensionChange(width, parseInt(e.target.value) || 0)}
              className="text-sm"
            />
          </div>
        </div>
      </div>

      {/* Size reference info */}
      <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-primary mt-0.5" />
          <div className="text-xs text-primary">
            <div className="font-medium mb-1">Size Reference:</div>
            <div className="space-y-1">
              <div>• Small: 3-5m × 2-4m (family pools)</div>
              <div>• Medium: 5-8m × 3-5m (standard pools)</div>
              <div>• Large: 8-12m × 4-6m (entertainment pools)</div>
              <div>• Extra Large: 12m+ × 6m+ (resort pools)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
