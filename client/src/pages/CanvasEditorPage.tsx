import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editorSlice';
import { useMaterialsStore } from '@/state/materialsStore';
import { listMaterialsClient } from '@/lib/materialsClient';
import { CanvasStage } from '@/components/canvas/CanvasStage';
import { Toolbar } from '@/components/editor/Toolbar';
import { Sidebar } from '@/components/editor/Sidebar';
import { ImageUpload } from '@/components/editor/ImageUpload';
import { CalibrationDialog } from '@/components/editor/CalibrationDialog';
import { BottomSheet } from '@/components/editor/mobile/BottomSheet';
import { Toolbelt } from '@/components/editor/mobile/Toolbelt';
import { FabUpload } from '@/components/uploader/FabUpload';
import { MaterialPickerModal } from '@/components/materials/MaterialPickerModal';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Undo, Redo, MoreHorizontal, Palette } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

export function CanvasEditorPage() {
  console.info('[EditorPage] route file:', import.meta?.url || 'CanvasEditorPage.tsx');
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCalibrationDialog, setShowCalibrationDialog] = useState(false);
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [, navigate] = useLocation();

  // Materials store integration
  const { all: getAllMaterials, hydrateMerge } = useMaterialsStore();

  const photo = useEditorStore(s => s.photo);
  const loadImageFile = useEditorStore(s => s.loadImageFile);
  const selectedMaskId = useEditorStore(s => s.selectedMaskId);
  const selectMask = useEditorStore(s => s.selectMask);
  const applyMaterialToMask = useEditorStore(s => s.applyMaterialToMask);
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

  // Load materials when component mounts (lazy, non-clobber)
  useEffect(() => {
    const currentMaterials = getAllMaterials();
    if (currentMaterials.length === 0) {
      listMaterialsClient()
        .then(materials => {
          hydrateMerge(materials);
          console.log('[CanvasEditor] Loaded', materials.length, 'materials');
        })
        .catch(error => {
          console.error('[CanvasEditor] Failed to load materials:', error);
        });
    }
  }, [getAllMaterials, hydrateMerge]);

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

  const handleMaterialPick = (material: any) => {
    console.log('[CanvasEditor] Material picked:', material);
    
    if (!selectedMaskId) {
      toast.error('Please select a mask first');
      return;
    }
    
    // Apply material to selected mask
    applyMaterialToMask(selectedMaskId, material.id);
    setShowMaterialPicker(false);
    toast.success(`Applied ${material.name} to selected mask`);
  };

  const handleMaskSelect = (maskId: string) => {
    selectMask(maskId);
    console.log('[CanvasEditor] Mask selected:', maskId);
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
      <div className="cover-under-header bg-slate-50">
        <div className="flex items-center justify-center p-4 md:p-8 h-full">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-6 md:mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3 md:mb-4 mobile-text-xl">
                Pool Visual Editor
              </h1>
              <p className="text-base md:text-lg text-slate-600 mb-6 md:mb-8 mobile-text-base">
                Upload a pool photo to start creating visual quotes with advanced measurement tools.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4 md:p-8 mb-6 md:mb-8">
              <ImageUpload 
                onImageLoad={handleImageLoad}
              />
            </div>

            {/* FAB for mobile upload */}
            <FabUpload onFileSelect={handleImageLoad} />

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
      "cover-under-header flex flex-col bg-slate-100",
      isFullscreen && "fixed inset-0 z-50"
    )}>
      {/* Main Editor Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Canvas */}
          <div className="flex-1 relative bg-gray-100 overflow-hidden">
            <CanvasStage
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>

        {/* Desktop Sidebar (hidden on mobile) */}
        <div className="hidden md:block w-80 border-l bg-white">
          <Sidebar materials={[]} />
        </div>
      </div>

      {/* Desktop Toolbar (hidden on mobile) */}
      <div className="hidden md:block">
        <Toolbar />
      </div>

      {/* Mobile bottom sheet */}
      <BottomSheet>
        <Toolbelt />
      </BottomSheet>

      {/* FAB for mobile upload */}
      <FabUpload onFileSelect={handleImageLoad} />

      {/* Calibration Dialog */}
      <CalibrationDialog />

      {/* Material Picker Modal */}
      <MaterialPickerModal
        open={showMaterialPicker}
        onClose={() => setShowMaterialPicker(false)}
        onPick={handleMaterialPick}
      />

      {/* Floating Material Picker Button */}
      <Button
        onClick={() => setShowMaterialPicker(true)}
        disabled={!selectedMaskId}
        className={cn(
          "fixed bottom-20 md:bottom-4 right-4 z-50 shadow-lg",
          selectedMaskId 
            ? "bg-blue-600 hover:bg-blue-700" 
            : "bg-gray-400 cursor-not-allowed"
        )}
        size="lg"
        data-testid="button-open-material-picker"
      >
        <Palette className="w-5 h-5 mr-2" />
        {selectedMaskId ? 'Apply Material' : 'Select Mask First'}
      </Button>
    </div>
  );
}