/**
 * Comprehensive Canvas Editor Toolbar
 * Includes zoom controls, view modes, export options, and tool shortcuts
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Download, 
  Save,
  Eye,
  EyeOff,
  Monitor,
  Split,
  Hand,
  Square,
  Zap,
  Waves,
  Eraser,
  Ruler,
  Undo,
  Redo
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
    editorState,
    isLoading,
    isDirty,
    lastSaved,
    compositeUrls,
    isGeneratingComposite,
    setActiveTool,
    setViewMode,
    setZoom,
    resetView,
    undo,
    redo,
    canUndo,
    canRedo,
    getUndoAction,
    getRedoAction,
    saveProgress,
    generateComposite
  } = useEditorStore();

  const handleZoomIn = () => {
    setZoom(Math.min(editorState.zoom * 1.2, 10));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(editorState.zoom / 1.2, 0.1));
  };

  const handleFitToScreen = () => {
    resetView();
  };

  const handleExport = () => {
    if (editorState.mode === 'before' || !compositeUrls[editorState.mode === 'after' ? 'after' : 'sideBySide']) {
      // Generate composite first
      if (editorState.mode === 'after') {
        generateComposite('after');
      } else if (editorState.mode === 'sideBySide') {
        generateComposite('sideBySide');
      }
    } else {
      onExport?.();
    }
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

  const viewModes = [
    { 
      value: 'before' as const, 
      label: 'Before', 
      icon: Eye 
    },
    { 
      value: 'after' as const, 
      label: 'After', 
      icon: EyeOff,
      disabled: !compositeUrls.after && !isGeneratingComposite
    },
    { 
      value: 'sideBySide' as const, 
      label: 'Side by Side', 
      icon: Split,
      disabled: !compositeUrls.sideBySide && !isGeneratingComposite
    },
  ];

  const formatLastSaved = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={cn(
      "flex items-center justify-between bg-white border-b border-slate-200 px-4 py-2 shadow-sm",
      className
    )}>
      {/* Left section - Tools and View Controls */}
      <div className="flex items-center space-x-4">
        {/* Drawing Tools */}
        <div className="flex items-center space-x-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = editorState.activeTool === tool.id;
            
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
            variant={editorState.calibration ? "default" : "secondary"}
            className="text-xs"
          >
            {editorState.calibration 
              ? `${editorState.calibration.lengthMeters}m` 
              : 'Not Set'
            }
          </Badge>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Undo/Redo */}
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={!canUndo()}
            title={getUndoAction() ? `Undo: ${getUndoAction()}` : 'Nothing to undo'}
            className="w-9 h-9 p-0"
            data-testid="button-undo"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={!canRedo()}
            title={getRedoAction() ? `Redo: ${getRedoAction()}` : 'Nothing to redo'}
            className="w-9 h-9 p-0"
            data-testid="button-redo"
          >
            <Redo className="w-4 h-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* View Mode Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-slate-700">View:</span>
          <Select
            value={editorState.mode}
            onValueChange={(value: 'before' | 'after' | 'sideBySide') => setViewMode(value)}
          >
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {viewModes.map((mode) => {
                const Icon = mode.icon;
                return (
                  <SelectItem 
                    key={mode.value} 
                    value={mode.value}
                    disabled={mode.disabled}
                  >
                    <div className="flex items-center space-x-2">
                      <Icon className="w-4 h-4" />
                      <span>{mode.label}</span>
                      {mode.disabled && isGeneratingComposite && (
                        <Badge variant="secondary" className="text-xs ml-2">
                          Generating...
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Center section - Zoom Controls */}
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomOut}
          disabled={editorState.zoom <= 0.1}
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
          {Math.round(editorState.zoom * 100)}%
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomIn}
          disabled={editorState.zoom >= 10}
          title="Zoom In"
          className="w-9 h-9 p-0"
          data-testid="button-zoom-in"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
      </div>

      {/* Right section - Save and Export */}
      <div className="flex items-center space-x-4">
        {/* Save Status */}
        <div className="flex items-center space-x-2 text-sm text-slate-600">
          <div className="flex items-center space-x-1">
            {isDirty && (
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            )}
            <span className="text-xs">
              Last saved: {formatLastSaved(lastSaved)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={saveProgress}
            disabled={isLoading || !isDirty}
            title="Save Progress"
            className="text-xs h-7"
            data-testid="button-save"
          >
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Export and Fullscreen */}
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            disabled={isLoading || (editorState.mode !== 'before' && !compositeUrls[editorState.mode === 'after' ? 'after' : 'sideBySide'] && !isGeneratingComposite)}
            title={
              editorState.mode === 'before' 
                ? 'Export Original Image'
                : compositeUrls[editorState.mode === 'after' ? 'after' : 'sideBySide']
                  ? 'Export Composite'
                  : 'Generate Composite First'
            }
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