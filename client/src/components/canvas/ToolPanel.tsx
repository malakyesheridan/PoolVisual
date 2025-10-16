/**
 * Tool Panel - Simplified for Final Behavior Spec
 * Essential tools only: Pan/Select, Area Mask, Linear Mask, Waterline Mask, Eraser, Calibration
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { 
  MousePointer, 
  Square, 
  Minus, 
  Waves, 
  Eraser, 
  Ruler,
  Undo,
  Redo,
  Trash2
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorSlice';
import { useMaskStore } from '@/features/canvas/stores/maskStore';
import { cn } from '@/lib/utils';

interface ToolPanelProps {
  className?: string;
}

export function ToolPanel({ className }: ToolPanelProps) {
  const activeTool = useEditorStore(s => s.activeTool);
  const setTool = useEditorStore(s => s.setTool);
  const selectedMaskId = useMaskStore(s => s.selectedMaskId ?? null);
  const masksById = useMaskStore(s => s.masksById ?? {});
  const deleteMask = useMaskStore(s => s.removeMask);
  const undo = useEditorStore(s => s.undo);
  const redo = useEditorStore(s => s.redo);
  const canUndo = useEditorStore(s => s.canUndo);
  const canRedo = useEditorStore(s => s.canRedo);

  const tools = [
    { id: 'hand', label: 'Pan/Select', icon: MousePointer, description: 'Pan and select masks' },
    { id: 'area', label: 'Area Mask', icon: Square, description: 'Draw polygon areas' },
    { id: 'linear', label: 'Linear Mask', icon: Minus, description: 'Draw linear strokes' },
    { id: 'waterline_band', label: 'Waterline', icon: Waves, description: 'Draw waterline bands' },
    { id: 'eraser', label: 'Eraser', icon: Eraser, description: 'Erase mask areas' },
    { id: 'calibration', label: 'Calibrate', icon: Ruler, description: 'Set scale reference' },
  ];

  const handleToolSelect = (toolId: string) => {
    setTool(toolId as any);
  };

  const handleDeleteMask = () => {
    if (selectedMaskId) {
      deleteMask(selectedMaskId);
    }
  };

  const selectedMask = selectedMaskId ? masksById[selectedMaskId] : null;

  return (
    <div className={cn("flex flex-col h-full bg-white border-r", className)}>
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold mb-4">Tools</h3>
        
        {/* Tool Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {tools.map(tool => (
            <Button
              key={tool.id}
              variant={activeTool === tool.id ? "default" : "outline"}
              size="sm"
              onClick={() => handleToolSelect(tool.id)}
              className="h-auto p-3 flex flex-col items-center text-center"
              title={tool.description}
            >
              <tool.icon className="w-5 h-5 mb-1" />
              <span className="text-xs">{tool.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Mask Properties */}
      {selectedMask && (
        <div className="p-4 border-b">
          <h4 className="text-sm font-medium mb-3">Mask Properties</h4>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Type</Label>
              <div className="text-sm text-gray-600 capitalize">
                {selectedMask.type.replace('_', ' ')}
              </div>
            </div>

            {/* Width controls for linear/waterline masks */}
            {(selectedMask.type === 'linear' || selectedMask.type === 'waterline_band') && (
              <div>
                <Label className="text-xs">Width (px)</Label>
                <Slider
                  defaultValue={[selectedMask.width || 80]}
                  max={200}
                  min={20}
                  step={10}
                  className="mt-1"
                  onValueChange={(value) => {
                    // TODO: Update mask width
                    console.log('Width changed:', value[0]);
                  }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {selectedMask.width || 80}px
                </div>
              </div>
            )}

            {/* Material info */}
            {selectedMask.materialId && (
              <div>
                <Label className="text-xs">Material</Label>
                <div className="text-sm text-gray-600">
                  {selectedMask.materialId}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 border-b">
        <h4 className="text-sm font-medium mb-3">Actions</h4>
        
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
            className="w-full justify-start"
          >
            <Undo className="w-4 h-4 mr-2" />
            Undo
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={!canRedo}
            className="w-full justify-start"
          >
            <Redo className="w-4 h-4 mr-2" />
            Redo
          </Button>
          
          {selectedMaskId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteMask}
              className="w-full justify-start text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Mask
            </Button>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="p-4">
        <h4 className="text-sm font-medium mb-3">Shortcuts</h4>
        
        <div className="space-y-1 text-xs text-gray-600">
          <div><kbd className="px-1 bg-gray-100 rounded">Space</kbd> + Drag = Pan</div>
          <div><kbd className="px-1 bg-gray-100 rounded">Esc</kbd> = Cancel drawing</div>
          <div><kbd className="px-1 bg-gray-100 rounded">Delete</kbd> = Delete mask</div>
          <div><kbd className="px-1 bg-gray-100 rounded">Ctrl+Z</kbd> = Undo</div>
          <div><kbd className="px-1 bg-gray-100 rounded">Ctrl+Y</kbd> = Redo</div>
        </div>
      </div>
    </div>
  );
}
