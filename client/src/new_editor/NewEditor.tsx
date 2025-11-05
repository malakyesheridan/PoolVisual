import React, { useEffect, useRef } from 'react';
import { useRoute } from 'wouter';
import { Canvas } from './Canvas';
import { Toolbar } from './Toolbar';
import { MaterialsPanel } from './MaterialsPanel';
import { MeasurementOverlay } from './MeasurementOverlay';
import { MaskManagementPanel } from '../components/mask/MaskManagementPanel';
import { UnifiedTemplatesPanel } from './UnifiedTemplatesPanel';
import { useEditorStore } from './store';
import { useMaskStore } from '../maskcore/store';
import { apiClient } from '../lib/api-client';
import { Package, Square, FileText } from 'lucide-react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '../components/ui/tooltip';

interface NewEditorProps {
  jobId?: string;
  photoId?: string;
}

export function NewEditor({ jobId, photoId }: NewEditorProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const lastLoadedPhotoIdRef = useRef<string | null>(null);
  const justSavedRef = useRef<{ photoId: string; timestamp: number } | null>(null);
  const { dispatch, getState, jobContext } = useEditorStore();
  const [activeTab, setActiveTab] = React.useState<'materials' | 'templates' | 'masks'>('materials');
  
  // Extract jobId and photoId from URL parameters
  const [, jobParams] = useRoute('/jobs/:jobId/photo/:photoId/edit');
  const [, jobParamsCanvas] = useRoute('/jobs/:jobId/photo/:photoId/edit-canvas');
  
  // Get effective job and photo IDs from props, URL params, or context
  const effectiveJobId = jobId || jobParams?.jobId || jobParamsCanvas?.jobId || jobContext?.jobId;
  const effectivePhotoId = photoId || jobParams?.photoId || jobParamsCanvas?.photoId || jobContext?.photoId;
  
  // Debug logging for mask loading
  console.log('[NewEditor] Component mounted. Props:', { jobId, photoId });
  console.log('[NewEditor] Job context:', jobContext);
  console.log('[NewEditor] Effective IDs:', { effectiveJobId, effectivePhotoId });
  
  // Sidebar width state with localStorage persistence
  const [sidebarWidth, setSidebarWidth] = React.useState(() => {
    const saved = localStorage.getItem('poolVisual-sidebarWidth');
    return saved ? parseInt(saved, 10) : 320;
  });
  
  // Resize state
  const [isResizing, setIsResizing] = React.useState(false);
  
  // PHASE 0: Reality & Single Store - DEV Build Chip
  // const buildStamp = React.useMemo(() => Date.now(), []);
  // const storeToken = React.useMemo(() => {
  //   const state = getState();
  //   return `store_${Object.keys(state).length}_${Date.now()}`;
  // }, [getState]);
  
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

  // Listen for save completion events to prevent duplicate mask loading
  useEffect(() => {
    const handleSaveComplete = (event: CustomEvent<{ photoId: string }>) => {
      if (event.detail?.photoId) {
        justSavedRef.current = {
          photoId: event.detail.photoId,
          timestamp: Date.now()
        };
        // Clear the flag after 3 seconds (enough time for SET_IMAGE to process and any remounts)
        setTimeout(() => {
          if (justSavedRef.current?.photoId === event.detail.photoId) {
            justSavedRef.current = null;
          }
        }, 3000);
        console.log('[NewEditor] Save completion event received, will skip mask reload for 3 seconds');
      }
    };
    
    window.addEventListener('saveComplete', handleSaveComplete as EventListener);
    return () => {
      window.removeEventListener('saveComplete', handleSaveComplete as EventListener);
    };
  }, []);

  // Load existing masks when editing a photo from a job
  useEffect(() => {
    const loadExistingMasks = async () => {
      // console.log('[NewEditor] Mask loading effect triggered. effectivePhotoId:', effectivePhotoId, 'jobContext:', jobContext);
      
      // Try multiple sources for photoId
      const photoIdToUse = effectivePhotoId || jobContext?.photoId || photoId;
      // console.log('[NewEditor] PhotoId to use:', photoIdToUse);
      
      // CRITICAL FIX: Clear masks if photoId has changed to a different photo
      // This prevents masks from persisting across different images
      if (lastLoadedPhotoIdRef.current !== null && 
          lastLoadedPhotoIdRef.current !== photoIdToUse) {
        console.log('[NewEditor] PhotoId changed from', lastLoadedPhotoIdRef.current, 'to', photoIdToUse, '- clearing all masks');
        useMaskStore.setState({ masks: {}, selectedId: null, draft: null });
      }
      
      if (photoIdToUse) {
        try {
          // CRITICAL FIX: Skip entirely if we just saved this photo
          // This prevents duplicate masks (baked-in image + Konva overlay) immediately after save
          if (justSavedRef.current && 
              justSavedRef.current.photoId === photoIdToUse &&
              Date.now() - justSavedRef.current.timestamp < 3000) {
            console.log('[NewEditor] Just saved this photo, skipping mask reload to prevent duplicates');
            lastLoadedPhotoIdRef.current = photoIdToUse; // Update ref to prevent clearing on next render
            return; // Exit early - don't touch masks at all
          }
          
          // Fetch masks from server
          const existingMasks = await apiClient.getMasks(photoIdToUse);
          
          // Check for existing database masks in store AFTER fetching from server
          const currentMasks = useMaskStore.getState().masks;
          const currentDbMaskIds = Object.keys(currentMasks).filter(id => 
            !id.startsWith('mask_') && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
          );
          
          // If we have database masks in store, check if they match server masks
          if (currentDbMaskIds.length > 0) {
            if (existingMasks && existingMasks.length > 0) {
              const serverMaskIds = existingMasks.map((m: any) => m.id);
              
              // Check if all current database masks are present in server response
              const allMasksPresent = currentDbMaskIds.every(id => serverMaskIds.includes(id));
              const countsMatch = currentDbMaskIds.length === serverMaskIds.length;
              
              if (allMasksPresent && countsMatch) {
                console.log('[NewEditor] Current masks match server masks, skipping reload to prevent duplicates');
                lastLoadedPhotoIdRef.current = photoIdToUse; // Update ref
                return; // Skip reloading to prevent duplicate rendering
              }
              
              // Masks don't match - proceed with reload (masks may have been modified externally)
              // Continue to conversion logic below
            } else {
              // No masks on server - clear any masks in store (they belong to a different photo)
              console.log('[NewEditor] No masks on server for photo', photoIdToUse, '- clearing store masks');
              useMaskStore.setState({ masks: {}, selectedId: null, draft: null });
              lastLoadedPhotoIdRef.current = photoIdToUse; // Update ref
              return;
            }
          }
          
          // Process masks if we have any (either from first load or when masks don't match)
          if (existingMasks && existingMasks.length > 0) {
            // Convert server mask format to mask core store format
            const convertedMasks: Record<string, any> = {};
            
            existingMasks.forEach((serverMask: any) => {
              try {
                // console.log('[NewEditor] Processing server mask:', serverMask);
                
                // Parse the pathJson (it's stored as JSON string in server)
                let pathData;
                if (typeof serverMask.pathJson === 'string') {
                  pathData = JSON.parse(serverMask.pathJson);
                } else if (Array.isArray(serverMask.pathJson)) {
                  pathData = serverMask.pathJson;
                } else {
                  console.warn('[NewEditor] Unexpected pathJson format:', serverMask.pathJson);
                  pathData = [];
                }
                
                // Convert path data to points array
                const pts = Array.isArray(pathData) 
                  ? pathData.map((point: any) => {
                      // Handle both {x, y} and [x, y] formats
                      if (typeof point === 'object' && point !== null) {
                        return { x: point.x || point[0] || 0, y: point.y || point[1] || 0 };
                      }
                      return { x: 0, y: 0 };
                    })
                  : [];
                
                // Parse material settings from calcMetaJson
                let materialSettings = null;
                if (serverMask.calcMetaJson) {
                  if (typeof serverMask.calcMetaJson === 'string') {
                    materialSettings = JSON.parse(serverMask.calcMetaJson);
                  } else {
                    materialSettings = serverMask.calcMetaJson;
                  }
                }
                
                convertedMasks[serverMask.id] = {
                  id: serverMask.id,
                  pts: pts,
                  mode: 'area' as const, // Default to area mode
                  materialId: serverMask.materialId || null,
                  materialSettings: materialSettings,
                  isVisible: true,
                  // Multi-Level Geometry fields (additive)
                  depthLevel: serverMask.depthLevel || 0,
                  elevationM: serverMask.elevationM || 0,
                  zIndex: serverMask.zIndex || 0,
                  isStepped: serverMask.isStepped || false
                };
                
                // console.log('[NewEditor] Converted mask:', serverMask.id, convertedMasks[serverMask.id]);
              } catch (error) {
                console.error('[NewEditor] Failed to convert mask:', serverMask.id, error, serverMask);
              }
            });
            
            // Load masks into the mask core store
            if (Object.keys(convertedMasks).length > 0) {
              // CRITICAL FIX: Replace all masks with masks from server for this photo
              // This ensures only masks for the current photo are in the store
              useMaskStore.setState({
                masks: convertedMasks,
                selectedId: null,
                draft: null
              });
              
              // Update ref to track which photo we loaded masks for
              lastLoadedPhotoIdRef.current = photoIdToUse;
              
              console.log('[NewEditor] Successfully loaded', Object.keys(convertedMasks).length, 'masks into store for photo', photoIdToUse);
            } else {
              // No masks from server - ensure store is cleared
              lastLoadedPhotoIdRef.current = photoIdToUse;
              console.log('[NewEditor] No masks found for photo:', photoIdToUse);
            }
          } else {
            // No masks on server - clear store
            console.log('[NewEditor] No existing masks found for photo:', photoIdToUse);
            useMaskStore.setState({ masks: {}, selectedId: null, draft: null });
            lastLoadedPhotoIdRef.current = photoIdToUse;
          }
        } catch (error) {
          console.error('[NewEditor] Failed to load existing masks:', error);
          // Don't throw - this is not critical to the main functionality
        }
      } else {
        // console.log('[NewEditor] No photoId available, skipping mask loading');
      }
    };
    
    loadExistingMasks();
  }, [effectivePhotoId, jobContext, photoId]);

  // Load photo image URL when photoId is available
  // ONLY if there's no user-loaded image already in the store
  useEffect(() => {
    const loadPhotoImage = async () => {
      const photoIdToUse = effectivePhotoId || jobContext?.photoId || photoId;
      
      // Skip if no photoId available
      if (!photoIdToUse) {
        console.log('[NewEditor] No photoId to load photo for');
        return;
      }
      
      // Get fresh state directly (not from closure)
      const currentState = useEditorStore.getState();
      
      // CRITICAL: Don't auto-load if user has already loaded an image
      // Only load from API if there's no image OR if it's a Picsum placeholder
      const hasUserImage = currentState.imageUrl && !currentState.imageUrl.includes('picsum.photos');
      if (hasUserImage) {
        console.log('[NewEditor] User has already loaded an image, skipping API photo load:', currentState.imageUrl);
        return;
      }
      
      // If we already loaded this exact photoId, skip (unless URL changed)
      if (lastLoadedPhotoIdRef.current === photoIdToUse) {
        // Double-check the URL matches - if photo was updated, reload
        if (currentState.imageUrl && !currentState.imageUrl.includes('picsum.photos')) {
          console.log('[NewEditor] Photo already loaded for photoId:', photoIdToUse);
          return;
        }
        // If we have Picsum URL but a real photoId, reload
        console.log('[NewEditor] PhotoId matches but URL may be stale, reloading...');
      }
      
      console.log('[NewEditor] Loading photo for photoId:', photoIdToUse);
      
      try {
        const photo = await apiClient.getPhoto(photoIdToUse);
        if (photo && photo.originalUrl) {
          console.log('[NewEditor] Photo loaded from API:', photo.originalUrl);
          
          // REJECT Picsum URLs - they're placeholders, not real user photos
          if (photo.originalUrl.includes('picsum.photos')) {
            console.warn('[NewEditor] Photo has Picsum placeholder URL, rejecting to prevent overwriting user content');
            return;
          }
          
          // Get fresh state again after API call
          const freshState = useEditorStore.getState();
          
          // Only update if URL is different and not a test URL
          const isTestUrl = freshState.imageUrl?.includes('picsum.photos');
          if (!isTestUrl && freshState.imageUrl === photo.originalUrl) {
            console.log('[NewEditor] Photo URL already matches, skipping update');
            lastLoadedPhotoIdRef.current = photoIdToUse;
            return;
          }
          
          // Convert local paths to proxy URLs for old photos
          let imageUrl = photo.originalUrl;
          if (imageUrl.startsWith('/uploads/')) {
            // Old photos with local paths - use proxy endpoint
            imageUrl = `/api/photos/${photoIdToUse}/image`;
            console.log('[NewEditor] Converting local path to proxy URL:', imageUrl);
          }
          
          // Load image to get dimensions
          const img = new Image();
          img.onload = () => {
            console.log('[NewEditor] Setting image in store:', imageUrl);
            dispatch({
              type: 'SET_IMAGE',
              payload: {
                url: imageUrl,
                width: img.naturalWidth,
                height: img.naturalHeight
              }
            });
            lastLoadedPhotoIdRef.current = photoIdToUse;
          };
          img.onerror = () => {
            console.error('[NewEditor] Failed to load image from photo URL:', imageUrl);
          };
          img.src = imageUrl;
        } else {
          console.warn('[NewEditor] Photo data missing originalUrl:', photo);
        }
      } catch (error: any) {
        // Handle deleted photos gracefully (404 or any error after deletion)
        const isNotFound = error?.message?.includes('404') || 
                          error?.message?.includes('not found') ||
                          error?.status === 404 ||
                          error?.statusCode === 404;
        const isDeleted = error?.status === 500 || 
                         error?.statusCode === 500 ||
                         error?.message?.includes('Photo');
        
        // CRITICAL FIX: Treat all errors for deleted photos as "not found" to prevent retries
        if (isNotFound || isDeleted) {
          console.log('[NewEditor] Photo not found or deleted, clearing local state:', photoIdToUse);
          // Clear local photo state when photo is deleted
          dispatch({
            type: 'SET_IMAGE',
            payload: {
              url: '',
              width: 0,
              height: 0
            }
          });
          // Clear masks for deleted photo
          useMaskStore.setState({ masks: {}, selectedId: null, draft: null });
          lastLoadedPhotoIdRef.current = null;
          // Clear job context photoId to prevent future reload attempts
          if (effectivePhotoId === photoIdToUse) {
            dispatch({
              type: 'SET_JOB_CONTEXT',
              payload: {
                jobId: effectiveJobId || '',
                photoId: ''
              }
            });
          }
        } else {
          console.error('[NewEditor] Failed to load photo:', error);
        }
      }
    };
    
    loadPhotoImage();
  }, [effectivePhotoId, jobContext?.photoId, photoId, dispatch]); // Removed getState from deps

  // Cleanup: Clear ref on unmount to prevent stale state
  useEffect(() => {
    return () => {
      lastLoadedPhotoIdRef.current = null;
    };
  }, []);

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
        // const containerRect = containerRef.current.getBoundingClientRect();
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
  
  // Initialize container size on mount
  React.useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      dispatch({
        type: 'SET_CONTAINER_SIZE',
        payload: { width: rect.width, height: rect.height }
      });
    }
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
        // console.log('[Layout Guardrails] Initialized:', layoutGuardrails.current);
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
          <Toolbar 
            {...(effectiveJobId && { jobId: effectiveJobId })}
            {...(effectivePhotoId && { photoId: effectivePhotoId })}
          />
      
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
          <MeasurementOverlay jobId={effectiveJobId || undefined} />
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
          <div className="flex-1 min-h-0 relative overflow-hidden">
            {activeTab === 'materials' && <MaterialsPanel />}
            {activeTab === 'templates' && <UnifiedTemplatesPanel />}
            {activeTab === 'masks' && <MaskManagementPanel />}
          </div>
        </div>
      </div>
      
      {/* DEV Build Chip - Phase 0 */}
    </div>
  );
}
