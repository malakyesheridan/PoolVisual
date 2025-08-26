import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TopNavigation } from "@/components/layout/top-navigation";
import { MeasurementTools } from "@/components/canvas/measurement-tools";
import { MaterialLibrary } from "@/components/materials/material-library";
import { KonvaCanvas } from "@/components/canvas/konva-canvas";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useCanvasStore } from "@/stores/canvas-store";
import { 
  ZoomIn, 
  ZoomOut, 
  Hand,
  RotateCcw,
  RotateCw,
  Download,
  Palette
} from "lucide-react";

export default function CanvasEditor() {
  const [, params] = useRoute('/jobs/:jobId/photo/:photoId');
  const jobId = params?.jobId;
  const photoId = params?.photoId;
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const {
    scale,
    setScale,
    viewMode,
    setViewMode,
    activeTool,
    setActiveTool,
    calibration,
    masks,
    selectedMaterial
  } = useCanvasStore();

  const { data: orgs = [] } = useQuery({
    queryKey: ['/api/me/orgs'],
    queryFn: () => apiClient.getMyOrgs(),
  });

  const { data: job } = useQuery({
    queryKey: ['/api/jobs', jobId],
    queryFn: () => jobId ? apiClient.getJob(jobId) : Promise.resolve(null),
    enabled: !!jobId,
  });

  const { data: photo } = useQuery({
    queryKey: ['/api/photos', photoId],
    queryFn: () => photoId ? apiClient.getPhoto(photoId) : Promise.resolve(null),
    enabled: !!photoId,
  });

  // Auto-select first org if available
  if (!selectedOrgId && orgs.length > 0) {
    setSelectedOrgId(orgs[0].id);
  }

  // Load photo into canvas store when available
  useEffect(() => {
    if (photo) {
      useCanvasStore.getState().setPhoto({
        url: photo.originalUrl,
        width: photo.width,
        height: photo.height,
      });

      if (photo.calibrationPixelsPerMeter) {
        useCanvasStore.getState().setCalibration({
          pixelsPerMeter: parseFloat(photo.calibrationPixelsPerMeter),
          referenceLength: photo.calibrationMetaJson?.referenceLength || 3.5,
          startPoint: photo.calibrationMetaJson?.startPoint || { x: 100, y: 100 },
          endPoint: photo.calibrationMetaJson?.endPoint || { x: 200, y: 100 },
        });
      }
    }
  }, [photo]);

  const handleZoomIn = () => {
    setScale(Math.min(scale * 1.2, 5));
  };

  const handleZoomOut = () => {
    setScale(Math.max(scale * 0.8, 0.1));
  };

  const handleCalibrationStart = () => {
    // Switch to calibration mode
    setActiveTool('linear');
    // The actual calibration drawing would be handled by the canvas component
  };

  const handleAddToQuote = () => {
    // Add current mask/material selection to quote
    console.log('Adding to quote:', { masks, selectedMaterial });
  };

  const getCurrentMaskMetrics = () => {
    const activeMask = masks.find(m => m.id === useCanvasStore.getState().activeMask);
    if (!activeMask || !calibration) {
      return {
        area: 0,
        perimeter: 0,
        material: null,
        cost: 0
      };
    }

    // This would calculate real metrics based on the mask and calibration
    return {
      area: activeMask.areaM2 || 8.5,
      perimeter: activeMask.perimeterM || 12.5,
      material: 'Travertine Silver',
      cost: 1062.50
    };
  };

  const metrics = getCurrentMaskMetrics();

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <TopNavigation 
        currentPage="canvas-editor"
        jobDetails={job ? {
          clientName: job.clientName,
          address: job.address || ''
        } : undefined}
      />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-88 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          {/* Calibration & Tools */}
          <div className="border-b border-slate-100">
            <MeasurementTools onCalibrationStart={handleCalibrationStart} />
          </div>
          
          {/* Material Library */}
          {selectedOrgId && (
            <MaterialLibrary 
              orgId={selectedOrgId}
              onMaterialSelect={(materialId) => {
                console.log('Material selected:', materialId);
              }}
            />
          )}
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 flex flex-col bg-slate-100">
          {/* Canvas Toolbar */}
          <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={scale <= 0.1}
                  data-testid="button-zoom-out"
                >
                  <ZoomOut className="w-5 h-5 text-slate-600" />
                </Button>
                <span className="text-sm text-slate-600 min-w-12 text-center" data-testid="text-zoom-level">
                  {Math.round(scale * 100)}%
                </span>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={scale >= 5}
                  data-testid="button-zoom-in"
                >
                  <ZoomIn className="w-5 h-5 text-slate-600" />
                </Button>
              </div>
              
              <div className="h-6 w-px bg-slate-200"></div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant={viewMode === 'before' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('before')}
                  className="text-sm font-medium"
                  data-testid="button-view-before"
                >
                  Before
                </Button>
                <Button
                  variant={viewMode === 'after' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('after')}
                  className="text-sm font-medium"
                  data-testid="button-view-after"
                >
                  After
                </Button>
                <Button
                  variant={viewMode === 'sideBySide' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('sideBySide')}
                  className="text-sm font-medium"
                  data-testid="button-view-side-by-side"
                >
                  Side by Side
                </Button>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline"
                size="sm"
                className="text-sm font-medium"
                data-testid="button-export-image"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Image
              </Button>
              <Button 
                size="sm"
                className="bg-accent-500 hover:bg-accent-600 text-white"
                onClick={handleAddToQuote}
                data-testid="button-add-to-quote"
              >
                <Palette className="w-4 h-4 mr-2" />
                Add to Quote
              </Button>
            </div>
          </div>
          
          {/* Canvas Container */}
          <div className="flex-1 relative overflow-hidden">
            <KonvaCanvas className="absolute inset-0 w-full h-full" />
            
            {/* Canvas Tools Overlay */}
            <div className="absolute top-4 left-4">
              <Card className="bg-white/90 backdrop-blur-sm border border-slate-200 p-2 space-y-1">
                <Button 
                  variant={activeTool === 'pan' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setActiveTool('pan')}
                  title="Pan"
                  data-testid="button-pan-tool"
                >
                  <Hand className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost"
                  size="icon"
                  title="Rotate CCW"
                  data-testid="button-rotate-ccw"
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost"
                  size="icon"
                  title="Rotate CW"
                  data-testid="button-rotate-cw"
                >
                  <RotateCw className="w-5 h-5" />
                </Button>
              </Card>
            </div>
          </div>
        </main>
      </div>
      
      {/* Bottom Panel */}
      <div className="bg-white border-t border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="text-sm">
              <span className="text-slate-600">Current Selection:</span>
              <span className="font-medium text-slate-900 ml-1" data-testid="text-current-selection">
                {masks.length > 0 ? 'Coping Area' : 'None'}
              </span>
            </div>
            
            <div className="flex items-center space-x-4 text-sm">
              <div>
                <span className="text-slate-600">Area:</span>
                <span className="font-medium text-slate-900 ml-1" data-testid="text-current-area">
                  {metrics.area.toFixed(1)} m²
                </span>
              </div>
              <div>
                <span className="text-slate-600">Perimeter:</span>
                <span className="font-medium text-slate-900 ml-1" data-testid="text-current-perimeter">
                  {metrics.perimeter.toFixed(1)} lm
                </span>
              </div>
              <div>
                <span className="text-slate-600">Material:</span>
                <span className="font-medium text-slate-900 ml-1" data-testid="text-current-material">
                  {metrics.material || 'None'}
                </span>
              </div>
              <div>
                <span className="text-slate-600">Est. Cost:</span>
                <span className="font-medium text-slate-900 ml-1" data-testid="text-current-cost">
                  ${metrics.cost.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline"
              size="sm"
              data-testid="button-save-progress"
            >
              Save Progress
            </Button>
            <Button 
              size="sm"
              className="bg-primary hover:bg-primary/90"
              data-testid="button-generate-quote"
            >
              Generate Quote
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
