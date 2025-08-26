import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Ruler, 
  Square, 
  Zap, 
  Waves,
  Eraser,
  Undo,
  Redo,
  Settings
} from "lucide-react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useState } from "react";

interface MeasurementToolsProps {
  onCalibrationStart?: () => void;
}

export function MeasurementTools({ onCalibrationStart }: MeasurementToolsProps) {
  const [referenceLength, setReferenceLength] = useState('3.5');
  
  const {
    activeTool,
    setActiveTool,
    brushSize,
    setBrushSize,
    calibration
  } = useCanvasStore();

  const tools = [
    { 
      id: 'area' as const, 
      icon: Square, 
      title: 'Area Mask',
      description: 'Draw polygonal areas'
    },
    { 
      id: 'linear' as const, 
      icon: Zap, 
      title: 'Linear Mask',
      description: 'Draw linear measurements'
    },
    { 
      id: 'waterline' as const, 
      icon: Waves, 
      title: 'Waterline Band',
      description: 'Mark waterline areas'
    },
    { 
      id: 'eraser' as const, 
      icon: Eraser, 
      title: 'Eraser',
      description: 'Remove masks'
    },
  ];

  return (
    <div className="space-y-4">
      {/* Calibration Panel */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Ruler className="w-4 h-4" />
            Calibration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Reference Length</span>
            {calibration ? (
              <Badge 
                variant="outline" 
                className="bg-green-50 text-green-700 border-green-200"
                data-testid="badge-calibration-status"
              >
                {calibration.referenceLength}m
              </Badge>
            ) : (
              <Badge variant="outline" data-testid="badge-calibration-status">
                Not Set
              </Badge>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="reference-length" className="text-xs">
              Reference Length (meters)
            </Label>
            <Input
              id="reference-length"
              type="number"
              value={referenceLength}
              onChange={(e) => setReferenceLength(e.target.value)}
              placeholder="3.5"
              step="0.1"
              min="0.1"
              className="text-sm"
              data-testid="input-reference-length"
            />
          </div>
          
          <Button
            onClick={onCalibrationStart}
            className="w-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
            variant="outline"
            size="sm"
            data-testid="button-calibrate"
          >
            <Settings className="w-4 h-4 mr-2" />
            Draw Reference Line
          </Button>
        </CardContent>
      </Card>

      {/* Tools Panel */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900">
            Mask Tools
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              
              return (
                <Button
                  key={tool.id}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={`p-2 h-auto flex flex-col gap-1 ${
                    isActive 
                      ? "bg-gradient-to-b from-primary to-primary/90 text-white" 
                      : "hover:bg-slate-50"
                  }`}
                  onClick={() => setActiveTool(tool.id)}
                  title={tool.description}
                  data-testid={`button-tool-${tool.id}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{tool.title}</span>
                </Button>
              );
            })}
          </div>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-slate-700 mb-2 block">
                Brush Size
              </Label>
              <Slider
                min={5}
                max={50}
                step={1}
                value={[brushSize]}
                onValueChange={([value]) => setBrushSize(value)}
                className="w-full"
                data-testid="slider-brush-size"
              />
              <div className="text-xs text-slate-500 text-right mt-1">
                {brushSize}px
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100"
                data-testid="button-undo"
              >
                <Undo className="w-3 h-3 mr-1" />
                Undo
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100"
                data-testid="button-redo"
              >
                <Redo className="w-3 h-3 mr-1" />
                Redo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
