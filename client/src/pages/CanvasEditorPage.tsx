import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editorSlice';
import { CanvasStage } from '@/components/canvas/CanvasStage';
import { Toolbar } from '@/components/editor/Toolbar';
import { Sidebar } from '@/components/editor/Sidebar';
import { ImageUpload } from '@/components/editor/ImageUpload';
import { CalibrationDialog } from '@/components/editor/CalibrationDialog';

export function CanvasEditorPage() {
  console.info('[EditorPage] route file:', import.meta?.url || 'CanvasEditorPage.tsx');
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCalibrationDialog, setShowCalibrationDialog] = useState(false);

  const photo = useEditorStore(s => s.photo);
  const loadImageFile = useEditorStore(s => s.loadImageFile);
  const {
    calState,
    transient,
    commitCalSample,
    commitPath,
    cancelCalibration,
    cancelPath,
    setTool,
    startCalibration
  } = useEditorStore();

  // Global keyboard handler exactly as specified
  useEffect(()=>{
    function isTyping(){ const el=document.activeElement as HTMLElement|null; return !!el && (el.tagName==='INPUT'||el.tagName==='TEXTAREA'||(el as any).isContentEditable); }
    
    const onKey=(e:KeyboardEvent)=>{
      if(isTyping()) return;
      const isCalActive = calState==='placingA' || calState==='placingB' || calState==='lengthEntry';
      
      if(e.key==='Enter'){
        if(calState==='lengthEntry'){ commitCalSample(); }
        else if(transient){ commitPath(); }
      }else if(e.key==='Escape'){
        if(isCalActive) cancelCalibration();
        else if(transient) cancelPath();
      }else if(e.key==='a'||e.key==='A'){ setTool('area'); }
      else if(e.key==='l'||e.key==='L'){ setTool('linear'); }
      else if(e.key==='w'||e.key==='W'){ setTool('waterline'); }
      else if(e.key==='e'||e.key==='E'){ setTool('eraser'); }
      else if(e.key==='h'||e.key==='H'){ setTool('hand'); }
      else if(e.key==='c'||e.key==='C'){ startCalibration(); }
    };
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  },[calState, transient, commitCalSample, commitPath, cancelCalibration, cancelPath, setTool, startCalibration]);

  const handleImageLoad = (file: File, imageUrl: string, dimensions: { width: number; height: number }) => {
    if (loadImageFile) {
      loadImageFile(file, imageUrl, dimensions);
    } else {
      console.error('loadImageFile function not available');
    }
  };

  const handleImageClear = () => {
    // Clear functionality handled by individual components
  };

  const handleExport = () => {
    // Export functionality will be implemented with stage access
    console.info('[Export] Export functionality placeholder');
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Show upload interface if no image is loaded
  if (!photo) {
    return (
      <div className="h-screen flex flex-col bg-slate-50">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-4">
                Pool Visual Editor
              </h1>
              <p className="text-lg text-slate-600 mb-8">
                Upload a pool photo to start creating visual quotes with advanced measurement tools.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
              <ImageUpload 
                onImageLoad={handleImageLoad}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg border border-slate-200">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-blue-600 text-2xl">📐</span>
                </div>
                <h4 className="font-medium text-slate-900 mb-2">Precision Tools</h4>
                <p className="text-sm text-slate-600">
                  Calibrate measurements and draw accurate area calculations.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg border border-slate-200">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-green-600 text-2xl">🎨</span>
                </div>
                <h4 className="font-medium text-slate-900 mb-2">Material Preview</h4>
                <p className="text-sm text-slate-600">
                  Visualize different materials and finishes on your pool design.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg border border-slate-200">
                <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-violet-600 text-2xl">💰</span>
                </div>
                <h4 className="font-medium text-slate-900 mb-2">Professional Quotes</h4>
                <p className="text-sm text-slate-600">
                  Generate detailed quotes with quantity calculations and pricing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main editor interface
  return (
    <div className={cn(
      "h-screen flex flex-col bg-slate-100",
      isFullscreen && "fixed inset-0 z-50"
    )}>
      {/* Main Editor Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Canvas */}
          <div className="flex-1 relative bg-gray-100 overflow-auto">
            <CanvasStage
              className="w-full h-full min-h-0"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l bg-white">
          <Sidebar materials={[]} />
        </div>
      </div>

      {/* Toolbar */}
      <Toolbar
        onExport={handleExport}
        onFullscreen={handleFullscreen}
      />

      {/* Calibration Dialog */}
      <CalibrationDialog />
    </div>
  );
}