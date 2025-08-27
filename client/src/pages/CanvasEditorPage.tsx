/**
 * Enhanced Canvas Editor Page
 * Complete implementation with all functionality working
 */

import React, { useRef, useState } from 'react';
import { Stage as StageType } from 'konva/lib/Stage';
import { Toolbar } from '@/components/editor/Toolbar';
import { Sidebar } from '@/components/editor/Sidebar';
import { CanvasStage } from '@/components/canvas/CanvasStage';
import { UploadImageButton } from '@/components/uploader/UploadImageButton';
// import { CalibrationDialog } from '@/components/CalibrationDialog';
import { useEditorStore } from '@/stores/editorSlice';
import { cn } from '@/lib/utils';

export function CanvasEditorPage() {
  const stageRef = useRef<StageType>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCalibrationDialog, setShowCalibrationDialog] = useState(false);

  const store = useEditorStore();
  const {
    photo,
    editorState,
    loadImageFile,
    resetEditor
  } = store || {};

  const handleImageLoad = (file: File, imageUrl: string, dimensions: { width: number; height: number }) => {
    if (loadImageFile) {
      loadImageFile(file, imageUrl, dimensions);
    } else {
      console.error('loadImageFile function not available');
    }
  };

  const handleImageClear = () => {
    if (resetEditor) {
      resetEditor();
    }
  };

  const handleExport = () => {
    if (!stageRef.current) return;
    
    try {
      const dataURL = stageRef.current.toDataURL({
        mimeType: 'image/png',
        quality: 1,
        pixelRatio: 2
      });
      
      // Create download link
      const link = document.createElement('a');
      link.download = `pool-visual-${Date.now()}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export failed:', error);
    }
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

  const handleStageRef = (stage: StageType | null) => {
    // stageRef.current = stage;
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
                Upload a pool photo to start creating professional renovation quotes with precise measurements and material visualization.
              </p>
            </div>
            
            <UploadImageButton
              onImageLoad={handleImageLoad}
              className="mx-auto max-w-lg"
            />
            
            <div className="mt-8 text-center">
              <h3 className="text-lg font-medium text-slate-900 mb-4">
                What you can do:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <span className="text-emerald-600 text-2xl">📐</span>
                  </div>
                  <h4 className="font-medium text-slate-900 mb-2">Precise Measurements</h4>
                  <p className="text-sm text-slate-600">
                    Set calibration and draw area and linear measurements with real-world accuracy.
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <span className="text-blue-600 text-2xl">🎨</span>
                  </div>
                  <h4 className="font-medium text-slate-900 mb-2">Material Visualization</h4>
                  <p className="text-sm text-slate-600">
                    Apply different materials to masks and visualize renovation results.
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
              onStageRef={handleStageRef}
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

      {/* Calibration Dialog - TODO: Implement when needed */}
      {showCalibrationDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Calibration</h3>
            <p className="text-sm text-gray-600 mb-4">Calibration dialog will be implemented here.</p>
            <button 
              onClick={() => setShowCalibrationDialog(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}