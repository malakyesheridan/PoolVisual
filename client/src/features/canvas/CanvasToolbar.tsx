/**
 * Canvas Toolbar - Simplified for Final Behavior Spec
 * Essential tools only, no Smart Blend button
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
  Grid3X3,
  Magnet,
  Eye,
  EyeOff
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorSlice';
import { cn } from '@/lib/utils';

interface CanvasToolbarProps {
  onExport?: () => void;
  onFitToScreen?: () => void;
  hasSelectedMask?: boolean;
  className?: string;
}

export function CanvasToolbar({ 
  onExport, 
  onFitToScreen,
  hasSelectedMask = false,
  className 
}: CanvasToolbarProps) {
  const photoSpace = useEditorStore(s => s.photoSpace);
  const setZoom = useEditorStore(s => s.setZoom);
  const setPan = useEditorStore(s => s.setPan);

  const handleExport = async () => {
    if (onExport) {
      onExport();
    }
  };

  const handleZoomIn = () => {
    const currentScale = photoSpace?.scale || 1;
    setZoom(currentScale * 1.2);
  };

  const handleZoomOut = () => {
    const currentScale = photoSpace?.scale || 1;
    setZoom(currentScale / 1.2);
  };

  const handleResetView = () => {
    setZoom(1);
    setPan(0, 0);
  };

  const handleFitToScreen = () => {
    if (onFitToScreen) {
      onFitToScreen();
    }
  };

  const formatZoomPercentage = (scale: number): string => {
    // Ensure scale is finite and positive, fallback to 100%
    const validScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    return `${Math.round(validScale * 100)}%`;
  };

  return (
    <div className={cn(
      "flex items-center justify-between bg-white border-b border-slate-200 px-4 py-2 shadow-sm",
      className
    )}>
      {/* Left section - Zoom Controls */}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomOut}
          title="Zoom Out"
          className="text-xs"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        
        <Badge variant="secondary" className="text-xs">
          {formatZoomPercentage(photoSpace?.scale || 1)}
        </Badge>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomIn}
          title="Zoom In"
          className="text-xs"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        
        <Separator orientation="vertical" className="h-6" />
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetView}
          title="Reset View"
          className="text-xs"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleFitToScreen}
          title="Fit to Screen"
          className="text-xs"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
        
        <Separator orientation="vertical" className="h-6" />
        
        <Button
          variant="outline"
          size="sm"
          title="Toggle Grid"
          className="text-xs"
          disabled
        >
          <Grid3X3 className="w-4 h-4" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          title="Toggle Snap"
          className="text-xs"
          disabled
        >
          <Magnet className="w-4 h-4" />
        </Button>
      </div>

      {/* Right section - Export Controls */}
      <div className="flex items-center space-x-2">
        {hasSelectedMask && (
          <Badge variant="outline" className="text-xs">
            Mask Selected
          </Badge>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          title="Export PNG"
          className="text-xs"
        >
          <Download className="w-4 h-4 mr-1" />
          Export PNG
        </Button>
      </div>
    </div>
  );
}
