/**
 * Comprehensive Canvas Editor Toolbar
 * Fixed to work with the new bulletproof store structure
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Download, 
  Hand,
  Square,
  Zap,
  Waves,
  Eraser,
  Ruler
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorSlice';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  onExport?: () => void;
  onFullscreen?: () => void;
  className?: string;
}

export function Toolbar({ onExport, onFullscreen, className }: ToolbarProps) {
  const {
    activeTool,
    zoom,
    calibration,
    setActiveTool,
    setZoom,
    setPan
  } = useEditorStore();

  const handleZoomIn = () => {
    setZoom(Math.min(zoom * 1.2, 10));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom / 1.2, 0.1));
  };

  const handleFitToScreen = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const tools = [
    { 
      id: 'hand' as const, 
      icon: Hand, 
      label: 'Pan/Select (H)', 
      shortcut: 'H' 
    },
    { 
      id: 'area' as const, 
      icon: Square, 
      label: 'Area Mask (A)', 
      shortcut: 'A' 
    },
    { 
      id: 'linear' as const, 
      icon: Zap, 
      label: 'Linear Mask (L)', 
      shortcut: 'L' 
    },
    { 
      id: 'waterline' as const, 
      icon: Waves, 
      label: 'Waterline Band (W)', 
      shortcut: 'W' 
    },
    { 
      id: 'eraser' as const, 
      icon: Eraser, 
      label: 'Eraser (E)', 
      shortcut: 'E' 
    },
  ];

  return (
    <div className={cn(
      "flex items-center justify-between bg-white border-b border-slate-200 px-4 py-2 shadow-sm",
      className
    )}>
      {/* Left section - Tools */}
      <div className="flex items-center space-x-4">
        {/* Drawing Tools */}
        <div className="flex items-center space-x-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            
            return (
              <Button
                key={tool.id}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTool(tool.id)}
                title={tool.label}
                className="w-9 h-9 p-0"
                data-testid={`tool-${tool.id}`}
              >
                <Icon className="w-4 h-4" />
              </Button>
            );
          })}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Calibration Status */}
        <div className="flex items-center space-x-2">
          <Ruler className="w-4 h-4 text-slate-500" />
          <Badge 
            variant={calibration ? "default" : "secondary"}
            className="text-xs"
          >
            {calibration 
              ? `${calibration.ppm.toFixed(1)} px/m` 
              : 'Not Set'
            }
          </Badge>
          <span className="text-xs text-slate-500">
            Press 'C' to calibrate
          </span>
        </div>
      </div>

      {/* Center section - Zoom Controls */}
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomOut}
          disabled={zoom <= 0.1}
          title="Zoom Out"
          className="w-9 h-9 p-0"
          data-testid="button-zoom-out"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleFitToScreen}
          title="Fit to Screen"
          className="min-w-16 text-xs font-mono"
          data-testid="button-fit-screen"
        >
          {Math.round(zoom * 100)}%
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomIn}
          disabled={zoom >= 10}
          title="Zoom In"
          className="w-9 h-9 p-0"
          data-testid="button-zoom-in"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
      </div>

      {/* Right section - Export and Fullscreen */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExport}
            title="Export Image"
            className="h-8"
            data-testid="button-export"
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onFullscreen}
            title="Toggle Fullscreen"
            className="w-9 h-9 p-0"
            data-testid="button-fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}