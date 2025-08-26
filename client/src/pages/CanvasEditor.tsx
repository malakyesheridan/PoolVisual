/**
 * Canvas Editor Page - Complete pool renovation visual editor
 * Integrates all components: CanvasStage, Toolbar, Sidebar, MetricsBar
 */

import React, { useEffect, useRef, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { CanvasStage } from '@/components/editor/CanvasStage';
import { Toolbar } from '@/components/editor/Toolbar';
import { Sidebar } from '@/components/editor/Sidebar';
import { MetricsBar } from '@/components/editor/MetricsBar';
import { ImageUpload } from '@/components/editor/ImageUpload';
import { useEditorStore } from '@/stores/editorSlice';
import { Material } from '@shared/schema';

export default function CanvasEditor() {
  const [, params] = useRoute('/jobs/:jobId/editor/:photoId');
  const [, setLocation] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { jobId, photoId } = params || {};
  const {
    loadPhoto,
    loadImageFile,
    error,
    isLoading,
    photo,
    generateQuote,
    saveProgress
  } = useEditorStore();

  // Load materials data
  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ['/api/materials'],
    enabled: !!jobId
  });

  // Load photo when component mounts (if photoId provided)
  useEffect(() => {
    if (photoId && jobId) {
      loadPhoto(photoId, jobId).catch((err) => {
        console.error('Failed to load photo:', err);
        toast({
          title: "Error",
          description: "Failed to load photo for editing",
          variant: "destructive",
        });
      });
    }
  }, [photoId, jobId, loadPhoto]);

  // Handle image upload
  const handleImageUpload = (file: File, imageUrl: string, dimensions: { width: number; height: number }) => {
    loadImageFile(file, imageUrl, dimensions);
    toast({
      title: "Image Loaded",
      description: "Your image has been loaded successfully. You can now use the drawing tools.",
    });
  };

  // Clear uploaded image
  const handleClearImage = () => {
    // Reset editor state
    loadImageFile(new File([], ''), '', { width: 0, height: 0 });
  };

  // Update canvas dimensions when container resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isFullscreen]);

  // Handle fullscreen toggle
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle export
  const handleExport = () => {
    // Implementation would capture canvas and download
    toast({
      title: "Export Started",
      description: "Your image is being prepared for download",
    });
  };

  // Handle quote generation
  const handleGenerateQuote = async () => {
    try {
      await generateQuote();
      toast({
        title: "Quote Generated",
        description: "Your quote has been created successfully",
      });
      setLocation(`/jobs/${jobId}/quote`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate quote",
        variant: "destructive",
      });
    }
  };

  // Handle auto-save
  useEffect(() => {
    const interval = setInterval(() => {
      saveProgress().catch(console.error);
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(interval);
  }, [saveProgress]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600">Loading canvas editor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Failed to Load Editor
          </h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => setLocation(`/jobs/${jobId}`)}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Return to Job
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col bg-slate-50 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Top Toolbar */}
      <Toolbar
        onExport={handleExport}
        onFullscreen={handleFullscreen}
        className="flex-shrink-0"
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div 
          ref={containerRef}
          className="flex-1 relative bg-slate-100 overflow-hidden"
          data-testid="canvas-container"
        >
          {photo ? (
            <CanvasStage
              width={dimensions.width}
              height={dimensions.height}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-8">
              <div className="max-w-md w-full">
                <ImageUpload
                  onImageLoad={handleImageUpload}
                  onClear={handleClearImage}
                  currentImage={photo?.originalUrl}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <Sidebar
          materials={materials}
          onMaterialSelect={(materialId) => {
            // Material selection logic is handled in the sidebar
            console.log('Material selected:', materialId);
          }}
          className="flex-shrink-0"
        />
      </div>

      {/* Bottom Metrics Bar */}
      <MetricsBar
        materials={materials}
        onGenerateQuote={handleGenerateQuote}
        className="flex-shrink-0"
      />
    </div>
  );
}