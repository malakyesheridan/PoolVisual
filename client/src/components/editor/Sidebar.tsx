/**
 * Simple Sidebar - Just mask list and basic info
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package,
  Ruler,
  Trash2,
  Square,
  Zap,
  Waves,
  Layers
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorSlice';
import { MaterialsTab } from './MaterialsTab';
import { cn } from '@/lib/utils';

interface SidebarProps {
  materials: any[];
  className?: string;
}

export function Sidebar({ materials, className }: SidebarProps) {
  const { masks, calibration, deleteMask } = useEditorStore();
  const [activeTab, setActiveTab] = useState('masks');

  const getMaskIcon = (type: string) => {
    switch (type) {
      case 'area': return Square;
      case 'linear': return Zap;
      case 'waterline_band': return Waves;
      default: return Square;
    }
  };

  const getMaskLabel = (type: string) => {
    switch (type) {
      case 'area': return 'Area';
      case 'linear': return 'Linear';
      case 'waterline_band': return 'Waterline';
      default: return 'Mask';
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-white border-l", className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5" />
          <h2 className="font-semibold">Editor Panel</h2>
        </div>
        
        {/* Calibration Status */}
        <div className="flex items-center gap-2 text-sm">
          <Ruler className="w-4 h-4" />
          <Badge variant={calibration ? "default" : "secondary"}>
            {calibration ? `${calibration.ppm.toFixed(1)} px/m` : 'Not Calibrated'}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mx-4 mb-2">
          <TabsTrigger value="masks" className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Masks
          </TabsTrigger>
          <TabsTrigger value="materials" className="flex items-center gap-1">
            <Package className="w-3 h-3" />
            Materials
          </TabsTrigger>
        </TabsList>

        <TabsContent value="masks" className="flex-1 flex flex-col m-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              <h3 className="font-medium text-sm text-gray-700">
                Drawn Masks ({masks.length})
              </h3>
              
              {masks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <Square className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No masks drawn yet</p>
                  <p className="text-xs mt-1">Use A, L, or W tools to draw</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {masks.map((mask, index) => {
                    const Icon = getMaskIcon(mask.type);
                    const label = getMaskLabel(mask.type);
                    
                    return (
                      <div
                        key={mask.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-blue-600" />
                          <div>
                            <div className="font-medium text-sm">
                              {label} {index + 1}
                            </div>
                            <div className="text-xs text-gray-500">
                              {mask.path.points.length} points
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          title="Delete mask"
                          onClick={() => deleteMask(mask.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="materials" className="flex-1 flex flex-col m-0">
          <MaterialsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}