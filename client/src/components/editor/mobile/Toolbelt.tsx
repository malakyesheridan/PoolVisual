import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { 
  Square, 
  Minus, 
  Waves, 
  Eraser, 
  Settings,
  Package,
  Brush
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorSlice';
import { MaterialGrid } from './MaterialGrid';

const tools = [
  { id: 'area', label: 'Area', icon: Square },
  { id: 'linear', label: 'Linear', icon: Minus },
  { id: 'waterline', label: 'Waterline', icon: Waves },
  { id: 'eraser', label: 'Eraser', icon: Eraser }
] as const;

export function Toolbelt() {
  const [brushSize, setBrushSize] = useState([5]);
  const { activeTool, setTool, calState, startCalibration } = useEditorStore();

  const handleToolSelect = (toolId: string) => {
    setTool(toolId as any);
  };

  const handleCalibrationClick = () => {
    startCalibration();
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="tools" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mx-4 mb-3">
          <TabsTrigger value="tools" className="tap-target">Tools</TabsTrigger>
          <TabsTrigger value="materials" className="tap-target">Materials</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tools" className="flex-1 px-4 space-y-4">
          {/* Tool Selection */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3 mobile-text-base">Drawing Tools</h3>
            <div className="grid grid-cols-2 gap-2">
              {tools.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;
                
                return (
                  <Button
                    key={tool.id}
                    variant={isActive ? "default" : "outline"}
                    className={cn(
                      "h-12 flex flex-col gap-1 tap-target transition-smooth",
                      isActive && "ring-2 ring-primary ring-offset-2"
                    )}
                    onClick={() => handleToolSelect(tool.id)}
                    data-testid={`tool-${tool.id}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs">{tool.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Calibration */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3 mobile-text-base">Calibration</h3>
            <Button
              variant={calState !== 'idle' ? "default" : "outline"}
              className="w-full h-12 tap-target"
              onClick={handleCalibrationClick}
              data-testid="button-calibration"
            >
              {calState === 'idle' ? (
                <>
                  <Settings className="w-4 h-4 mr-2" />
                  Set Scale
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4 mr-2" />
                  Calibrating...
                </>
              )}
            </Button>
          </div>

          {/* Brush Size (for applicable tools) */}
          {(activeTool === 'area' || activeTool === 'eraser') && (
            <div>
              <h3 className="font-medium text-gray-900 mb-3 mobile-text-base">
                <Brush className="w-4 h-4 inline mr-2" />
                Brush Size: {brushSize[0]}px
              </h3>
              <div className="px-3">
                <Slider
                  value={brushSize}
                  onValueChange={setBrushSize}
                  max={20}
                  min={1}
                  step={1}
                  className="w-full"
                  data-testid="brush-size-slider"
                />
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="materials" className="flex-1">
          <MaterialGrid />
        </TabsContent>
      </Tabs>

      {/* Primary Action Row */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <Button 
          className="w-full h-12 tap-target"
          disabled={true} // Will be enabled when mask is selected
          data-testid="button-attach-material"
        >
          Attach Material to Mask
        </Button>
      </div>
    </div>
  );
}