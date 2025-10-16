import React, { useState } from 'react';
import { runSmartBlend } from './smartBlend';
import type { Point } from './types';

interface SmartBlendControlsProps {
  onApply: (dataURL: string) => void;
  onError: (error: string) => void;
  materialAlbedoURL: string;
  polygon: Point[];
  canvasSize: { w: number; h: number };
}

export default function SmartBlendControls({
  onApply,
  onError,
  materialAlbedoURL,
  polygon,
  canvasSize
}: SmartBlendControlsProps) {
  const [scale, setScale] = useState(1);
  const [strength, setStrength] = useState(0.7);

  const handleApply = async () => {
    try {
      // Preflight checks before Smart Blend
      if (!materialAlbedoURL) {
        throw new Error("Select a material first.");
      }
      if (polygon.length < 3) {
        throw new Error("Draw a mask with at least 3 points first.");
      }
      if (!backgroundDataURL) {
        throw new Error("Canvas not ready.");
      }
      if (!canvasSize || !canvasSize.w || !canvasSize.h) {
        throw new Error("Canvas size invalid.");
      }

      const result = await runSmartBlend({
        backgroundDataURL: '', // Will be provided by caller
        materialAlbedoURL,
        polygon,
        canvasSize,
        scale,
        strength
      });

      onApply(result);
    } catch (error: any) {
      console.warn("[SmartBlend] blocked:", error?.message || error);
      onError(error?.message || "Cannot run Smart Blend yet.");
    }
  };

  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold mb-3">Smart Blend Controls</h3>
      
      <div className="space-y-4">
        {/* Scale Control */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Material Scale: {scale.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.1"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            disabled={false}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0.5x</span>
            <span>1.0x</span>
            <span>2.0x</span>
            <span>4.0x</span>
          </div>
        </div>

        {/* Strength Control */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Blend Strength: {strength.toFixed(1)}
          </label>
          <input
            type="range"
            min="0.3"
            max="1.0"
            step="0.1"
            value={strength}
            onChange={(e) => setStrength(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            disabled={false}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Subtle</span>
            <span>Natural</span>
            <span>Strong</span>
          </div>
        </div>

        {/* Apply Button */}
        <button
          onClick={handleApply}
          disabled={isProcessing || !materialAlbedoURL || polygon.length < 3}
          className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
            isProcessing
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isProcessing ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </div>
          ) : (
            'Apply Smart Blend'
          )}
        </button>

        {/* Status Info */}
        <div className="text-xs text-gray-600">
          <p>• Scale: Adjusts material tiling size</p>
          <p>• Strength: Controls color matching intensity</p>
          <p>• Automatically preserves shadows and lighting</p>
        </div>
      </div>
    </div>
  );
}
