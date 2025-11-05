// Freeform Pool Drawing Canvas
// Allows users to draw custom freeform pool shapes

import React, { useRef, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { RotateCcw } from 'lucide-react';

interface FreeformPoolCanvasProps {
  onPointsChange: (points: Array<{ x: number; y: number }>) => void;
  width?: number;
  height?: number;
}

export function FreeformPoolCanvas({ 
  onPointsChange,
  width = 400,
  height = 300
}: FreeformPoolCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#4A90E2';
    ctx.fillStyle = '#87CEEB';
    ctx.lineWidth = 2;

    if (points.length > 0) {
      const firstPoint = points[0];
      if (firstPoint) {
        ctx.beginPath();
        ctx.moveTo(firstPoint.x, firstPoint.y);
        
        for (let i = 1; i < points.length; i++) {
          const pt = points[i];
          if (pt) {
            ctx.lineTo(pt.x, pt.y);
          }
        }
        
        // Close the path
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw all points
        points.forEach((point, index) => {
          if (point) {
            ctx.fillStyle = index === 0 ? '#FFD700' : '#FF6B6B';
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        ctx.fillStyle = '#87CEEB';
      }
    } else {
      // Show placeholder message
      ctx.fillStyle = '#999';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Click and drag to draw your pool shape', width / 2, height / 2);
      ctx.fillStyle = '#87CEEB';
    }
  }, [points, width, height]);

  const getMousePos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    if (!pos) return;

    setIsDrawing(true);
    setPoints([pos]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;

    const pos = getMousePos(e);
    if (!pos) return;

    setPoints(prev => [...prev, pos]);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    
    if (points.length > 0) {
      onPointsChange(points);
    }
  };

  const handleClear = () => {
    setPoints([]);
    onPointsChange([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Draw Your Pool Shape
        </label>
        {points.length > 0 && (
          <Button
            onClick={handleClear}
            variant="outline"
            size="sm"
            className="h-7 px-2"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>
      
      <div className="border border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-crosshair w-full h-full"
        />
      </div>
      
      <div className="text-xs text-gray-500 space-y-1">
        <p>• Click and drag to draw your pool shape</p>
        <p>• Release to finish and close the shape</p>
        <p>• Start over by clicking "Clear"</p>
      </div>
    </div>
  );
}

