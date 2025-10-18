import React, { useEffect, useRef } from 'react';
import { Canvas } from './Canvas';
import { Toolbar } from './Toolbar';
import { MaterialsPanel } from './MaterialsPanel';
import { AssetsPanel } from './AssetsPanel';
import { MeasurementOverlay } from './MeasurementOverlay';
import { MaskManagementPanel } from '../components/mask/MaskManagementPanel';
import { UnifiedTemplatesPanel } from './UnifiedTemplatesPanel';
import { useEditorStore } from './store';
import { Package, Image, Square, FileText } from 'lucide-react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '../components/ui/tooltip';

export function NewEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const { dispatch, getState } = useEditorStore();
  const [activeTab, setActiveTab] = React.useState<'materials' | 'assets' | 'templates' | 'masks'>('materials');
  
  // Sidebar width state with localStorage persistence
  const [sidebarWidth, setSidebarWidth] = React.useState(() => {
    const saved = localStorage.getItem('poolVisual-sidebarWidth');
    return saved ? parseInt(saved, 10) : 320;
  });
  
  // Resize state
  const [isResizing, setIsResizing] = React.useState(false);
  
  // PHASE 0: Reality & Single Store - DEV Build Chip
  const buildStamp = React.useMemo(() => Date.now(), []);
  const storeToken = React.useMemo(() => {
    const state = getState();
    return `store_${Object.keys(state).length}_${Date.now()}`;
  }, [getState]);
  
  // PHASE 10: Clean implementation - no mask mode switching
  
  // PHASE 3: Runtime guardrails against layout drift
  const layoutGuardrails = React.useRef({
    sidebarLeft: 0,
    viewportWidth: 0,
    viewportHeight: 0,
    zoomCount: 0
  });

  // Handle space+drag panning
  useEffect(() => {
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isPanning) {
        isPanning = true;
        document.body.style.cursor = 'grab';
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isPanning = false;
        document.body.style.cursor = 'default';
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (isPanning) {
        lastX = e.clientX;
        lastY = e.clientY;
        document.body.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning && (e.buttons & 1)) {
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;
        
        const currentState = getState();
        dispatch({
          type: 'SET_PHOTO_SPACE',
          payload: {
            panX: currentState.photoSpace.panX + deltaX,
            panY: currentState.photoSpace.panY + deltaY
          }
        });
        
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };

    const handleMouseUp = () => {
      if (isPanning) {
        document.body.style.cursor = 'grab';
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [dispatch]);

  // Handle Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  // Sidebar resize functionality
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.target === resizeHandleRef.current) {
        e.preventDefault();
        setIsResizing(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidth = window.innerWidth - e.clientX;
        
        // Constrain width between 250px and 600px
        const constrainedWidth = Math.max(250, Math.min(600, newWidth));
        setSidebarWidth(constrainedWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // Save to localStorage
        localStorage.setItem('poolVisual-sidebarWidth', sidebarWidth.toString());
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, sidebarWidth]);

  // Calculate canvas size and update store
  React.useEffect(() => {
    if (containerRef.current) {
      const canvasWidth = containerRef.current.clientWidth;
      const canvasHeight = containerRef.current.clientHeight;
      
      // Only update if dimensions are valid
      if (canvasWidth > 0 && canvasHeight > 0) {
        dispatch({
          type: 'SET_CONTAINER_SIZE',
          payload: { width: canvasWidth, height: canvasHeight }
        });
      }
    }
  }, [dispatch]); // Run on mount and when dispatch changes
  
  // Handle window resize to update container size
  React.useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const newWidth = containerRef.current.clientWidth;
        const newHeight = containerRef.current.clientHeight;
        dispatch({
          type: 'SET_CONTAINER_SIZE',
          payload: { width: newWidth, height: newHeight }
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dispatch]);
  
  // PHASE 3: Initialize layout guardrails on mount
  React.useEffect(() => {
    if (containerRef.current && sidebarRef.current) {
      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      const viewportRect = containerRef.current.getBoundingClientRect();
      
      layoutGuardrails.current = {
        sidebarLeft: sidebarRect.left,
        viewportWidth: viewportRect.width,
        viewportHeight: viewportRect.height,
        zoomCount: 0
      };
      
      if (import.meta.env.DEV) {
        console.log('[Layout Guardrails] Initialized:', layoutGuardrails.current);
      }
    }
  }, []);
  
  // PHASE 3: Monitor layout drift during zoom operations (DISABLED - was causing false positives)
  // This was debugging code that detected layout changes during zoom, but it was triggering
  // false positives because the zoomOperation event was never dispatched by zoom functions.
  // The layout drift detection is not essential for functionality.
  // 
  // React.useEffect(() => {
  //   if (!import.meta.env.DEV || !containerRef.current || !sidebarRef.current) return;
  //   
  //   const checkLayoutDrift = () => {
  //     const sidebarRect = sidebarRef.current!.getBoundingClientRect();
  //     const viewportRect = containerRef.current!.getBoundingClientRect();
  //     
  //     const sidebarDelta = Math.abs(sidebarRect.left - layoutGuardrails.current.sidebarLeft);
  //     const viewportWidthDelta = Math.abs(viewportRect.width - layoutGuardrails.current.viewportWidth);
  //     const viewportHeightDelta = Math.abs(viewportRect.height - layoutGuardrails.current.viewportHeight);
  //     
  //     if (sidebarDelta > 1 || viewportWidthDelta > 1 || viewportHeightDelta > 1) {
  //       console.error('[LAYOUT DRIFT] Detected layout changes during zoom:', {
  //         sidebarLeftDelta: sidebarDelta,
  //         viewportWidthDelta,
  //         viewportHeightDelta,
  //         zoomCount: layoutGuardrails.current.zoomCount
  //       });
  //     }
  //   };
  //   
  //   // Listen for zoom operations to track count
  //   const handleZoomOperation = () => {
  //     layoutGuardrails.current.zoomCount++;
  //   };
  //   
  //   window.addEventListener('zoomOperation', handleZoomOperation);
  //   
  //   // Check every 100ms during zoom operations
  //   const interval = setInterval(checkLayoutDrift, 100);
  //   
  //   return () => {
  //     clearInterval(interval);
  //     window.removeEventListener('zoomOperation', handleZoomOperation);
  //   };
  // }, []);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Toolbar />
      
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Canvas viewport container - fixed box that does NOT resize on zoom */}
        <div 
          ref={containerRef}
          className="flex-1 relative bg-white min-h-0"
          style={{
            position: 'relative',
            overflow: 'hidden',
            minWidth: 0,
            // Prevent horizontal scroll during zoom
            overflowX: 'hidden'
          }}
        >
          <Canvas 
            width={containerRef.current?.clientWidth || 800} 
            height={containerRef.current?.clientHeight || 600}
          />
          
          {/* Measurement Overlay */}
          <MeasurementOverlay />
        </div>
        
        {/* Resize Handle */}
        <div
          ref={resizeHandleRef}
          className={`w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize transition-colors ${
            isResizing ? 'bg-blue-500' : ''
          }`}
          style={{ minHeight: '100%' }}
        />
        
        {/* Sidebar - dynamic width */}
        <div 
          ref={sidebarRef} 
          style={{ width: `${sidebarWidth}px`, flex: '0 0 auto' }} 
          className="h-full overflow-hidden flex flex-col bg-white border-l border-gray-200"
        >
          {/* Tab Navigation */}
          <TooltipProvider>
            <div className="flex border-b bg-white">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`flex-1 px-3 py-2 text-sm font-medium flex items-center justify-center ${
                      activeTab === 'materials'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab('materials')}
                  >
                    <Package size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Materials</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`flex-1 px-3 py-2 text-sm font-medium flex items-center justify-center ${
                      activeTab === 'assets'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab('assets')}
                  >
                    <Image size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Assets</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`flex-1 px-3 py-2 text-sm font-medium flex items-center justify-center ${
                      activeTab === 'templates'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab('templates')}
                  >
                    <FileText size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Templates</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`flex-1 px-3 py-2 text-sm font-medium flex items-center justify-center ${
                      activeTab === 'masks'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab('masks')}
                  >
                    <Square size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Masks</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          
          {/* Tab Content */}
          <div className="flex-1 overflow-auto min-h-0">
            {activeTab === 'materials' && <MaterialsPanel />}
            {activeTab === 'assets' && <AssetsPanel />}
            {activeTab === 'templates' && <UnifiedTemplatesPanel />}
            {activeTab === 'masks' && <MaskManagementPanel />}
          </div>
        </div>
      </div>
      
      {/* DEV Build Chip - Phase 0 */}
    </div>
  );
}
