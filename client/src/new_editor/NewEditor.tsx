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
import { shouldIgnoreShortcut } from '../editor/keyboard/shortcuts';
import { Package, Square, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const { dispatch, getState, jobContext, variants, activeVariantId } = useEditorStore();
  const [activeTab, setActiveTab] = React.useState<'materials' | 'templates' | 'masks'>('materials');
  
  // Handle variant navigation
  const handlePreviousVariant = () => {
    if (variants.length <= 1) return;
    const currentIndex = variants.findIndex(v => v.id === activeVariantId);
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : variants.length - 1;
    dispatch({ type: 'SET_ACTIVE_VARIANT', payload: variants[previousIndex].id });
  };
  
  const handleNextVariant = () => {
    if (variants.length <= 1) return;
    const currentIndex = variants.findIndex(v => v.id === activeVariantId);
    const nextIndex = currentIndex < variants.length - 1 ? currentIndex + 1 : 0;
    dispatch({ type: 'SET_ACTIVE_VARIANT', payload: variants[nextIndex].id });
  };
  
  const activeVariant = variants.find(v => v.id === activeVariantId);
  const canNavigate = variants.length > 1;
  
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

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard: Don't trigger shortcuts when typing in inputs
      if (shouldIgnoreShortcut(e.target)) {
        return;
      }
      
      const state = useEditorStore.getState();
      
      // Tool selection shortcuts
      if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' });
        return;
      }
      
      if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'area' });
        return;
      }
      
      // Calibration shortcut
      if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && state.state === 'ready') {
        e.preventDefault();
        // Dispatch event to open calibration tool (Toolbar will listen)
        window.dispatchEvent(new CustomEvent('openCalibrationTool'));
        return;
      }
      
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }
      
      // Save shortcut (Ctrl+S / Cmd+S)
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && state.state === 'ready') {
        e.preventDefault();
        // Dispatch event to trigger save (Toolbar will listen)
        window.dispatchEvent(new CustomEvent('triggerSave'));
        return;
      }
      
      // Zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        // Dispatch event to trigger zoom in (Toolbar will listen)
        window.dispatchEvent(new CustomEvent('triggerZoomIn'));
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        // Dispatch event to trigger zoom out (Toolbar will listen)
        window.dispatchEvent(new CustomEvent('triggerZoomOut'));
        return;
      }
      
      // Delete/Backspace - Delete selected mask
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.state === 'ready') {
        const maskStore = useMaskStore.getState();
        if (maskStore.selectedId && maskStore.masks[maskStore.selectedId]) {
          const selectedMask = maskStore.masks[maskStore.selectedId];
          // Check if mask is locked
          if (selectedMask.isLocked) {
            return; // Don't delete locked masks
          }
          e.preventDefault();
          // Use DELETE action from mask store
          maskStore.DELETE(maskStore.selectedId).catch(err => {
            console.error('Failed to delete mask:', err);
          });
          return;
        }
      }
      
      // Enter - Commit drawing (handled by MaskCanvasKonva, but we can add a fallback)
      // ESC - Exit mode (handled by various components)
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
                
                // Still dispatch event so Toolbar updates saved state
                window.dispatchEvent(new CustomEvent('masksLoaded', { 
                  detail: { photoId: photoIdToUse, maskCount: existingMasks.length } 
                }));
                return; // Skip reloading to prevent duplicate rendering
              }
              
              // Masks don't match - proceed with reload (masks may have been modified externally)
              // Continue to conversion logic below
            } else {
              // No masks on server - clear any masks in store (they belong to a different photo)
              console.log('[NewEditor] No masks on server for photo', photoIdToUse, '- clearing store masks');
              useMaskStore.setState({ masks: {}, selectedId: null, draft: null });
              lastLoadedPhotoIdRef.current = photoIdToUse; // Update ref
              
              // Dispatch event for empty masks
              window.dispatchEvent(new CustomEvent('masksLoaded', { 
                detail: { photoId: photoIdToUse, maskCount: 0 } 
              }));
              return;
            }
          }
          
          // Process masks if we have any (either from first load or when masks don't match)
          if (existingMasks && existingMasks.length > 0) {
            // Convert server mask format to mask core store format
            const convertedMasks: Record<string, any> = {};
            
            // Get image dimensions for coordinate clamping
            const photoSpace = getState().photoSpace;
            const imgWidth = photoSpace.imgW || 2048; // Fallback to reasonable default
            const imgHeight = photoSpace.imgH || 2048; // Fallback to reasonable default
            
            // Helper function to clamp coordinates to image bounds
            const clampToImageBounds = (x: number, y: number): { x: number; y: number } => ({
              x: Math.max(0, Math.min(x, imgWidth - 1)),
              y: Math.max(0, Math.min(y, imgHeight - 1))
            });
            
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
                
                // Convert path data to points array and clamp coordinates to image bounds
                // This fixes existing masks with negative coordinates or coordinates beyond image dimensions
                const pts = Array.isArray(pathData) 
                  ? pathData.map((point: any) => {
                      // Handle both {x, y} and [x, y] formats
                      if (typeof point === 'object' && point !== null) {
                        const rawX = point.x || point[0] || 0;
                        const rawY = point.y || point[1] || 0;
                        
                        // Clamp main point coordinates
                        const clamped = clampToImageBounds(rawX, rawY);
                        
                        // Build clamped point object
                        const clampedPoint: any = {
                          x: clamped.x,
                          y: clamped.y,
                          kind: point.kind || 'corner'
                        };
                        
                        // Also clamp bezier handles if they exist
                        if (point.h1) {
                          const clampedH1 = clampToImageBounds(point.h1.x || 0, point.h1.y || 0);
                          clampedPoint.h1 = { x: clampedH1.x, y: clampedH1.y };
                        }
                        if (point.h2) {
                          const clampedH2 = clampToImageBounds(point.h2.x || 0, point.h2.y || 0);
                          clampedPoint.h2 = { x: clampedH2.x, y: clampedH2.y };
                        }
                        
                        // Log if coordinates were clamped (for debugging)
                        if (rawX !== clamped.x || rawY !== clamped.y) {
                          console.warn(`[NewEditor] Clamped mask point coordinates for mask ${serverMask.id}: (${rawX}, ${rawY}) -> (${clamped.x}, ${clamped.y})`);
                        }
                        
                        return clampedPoint;
                      }
                      return { x: 0, y: 0, kind: 'corner' };
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
            
            // Dispatch event to notify Toolbar to update lastSavedMaskState
            window.dispatchEvent(new CustomEvent('masksLoaded', { 
              detail: { photoId: photoIdToUse, maskCount: Object.keys(convertedMasks).length } 
            }));
          } else {
            // No masks from server - ensure store is cleared
            lastLoadedPhotoIdRef.current = photoIdToUse;
            console.log('[NewEditor] No masks found for photo:', photoIdToUse);
            
            // Dispatch event for empty masks too
            window.dispatchEvent(new CustomEvent('masksLoaded', { 
              detail: { photoId: photoIdToUse, maskCount: 0 } 
            }));
          }
        } else {
          // No masks on server - clear store
          console.log('[NewEditor] No existing masks found for photo:', photoIdToUse);
          useMaskStore.setState({ masks: {}, selectedId: null, draft: null });
          lastLoadedPhotoIdRef.current = photoIdToUse;
          
          // Dispatch event for empty masks
          window.dispatchEvent(new CustomEvent('masksLoaded', { 
            detail: { photoId: photoIdToUse, maskCount: 0 } 
          }));
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
  // If we have a photoId, always reload from API to ensure we have the latest data
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
      
      // CRITICAL FIX: If we have a photoId, we should always reload from API
      // The only exception is if we just loaded this exact photoId and the URL matches
      // This ensures that when returning to the editor, the image is always loaded
      if (lastLoadedPhotoIdRef.current === photoIdToUse) {
        // Check if URL matches and is not a placeholder
        if (currentState.imageUrl && 
            !currentState.imageUrl.includes('picsum.photos') &&
            currentState.imageUrl !== '') {
          // Verify the URL is actually valid by checking if it's from the API
          const isApiUrl = currentState.imageUrl.includes(`/api/photos/${photoIdToUse}`) ||
                         currentState.imageUrl.includes(photoIdToUse);
          if (isApiUrl) {
            console.log('[NewEditor] Photo already loaded for photoId:', photoIdToUse, 'URL:', currentState.imageUrl);
            return;
          }
        }
        // If URL doesn't match or is placeholder, reload
        console.log('[NewEditor] PhotoId matches but URL may be stale, reloading...');
      }
      
      // If no photoId but user has manually loaded an image, don't overwrite it
      // This only applies when there's NO photoId (user uploaded manually)
      // Since we have a photoId here, we should always load from API
      
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
          
          // Convert local paths to proxy URLs for old photos
          let imageUrl = photo.originalUrl;
          if (imageUrl.startsWith('/uploads/')) {
            // Old photos with local paths - use proxy endpoint
            imageUrl = `/api/photos/${photoIdToUse}/image`;
            console.log('[NewEditor] Converting local path to proxy URL:', imageUrl);
          }
          
          // Get fresh state again after API call
          const freshState = useEditorStore.getState();
          
          // Check if URL matches (accounting for proxy URL conversion)
          const isTestUrl = freshState.imageUrl?.includes('picsum.photos');
          const currentUrlMatches = freshState.imageUrl === imageUrl || 
                                   freshState.imageUrl === photo.originalUrl ||
                                   (freshState.imageUrl?.includes(`/api/photos/${photoIdToUse}`) && imageUrl.includes(`/api/photos/${photoIdToUse}`));
          
          // Only skip if URL matches, not a test URL, and we just loaded this photoId
          // If ref is null (just remounted), always reload to ensure image is loaded
          if (!isTestUrl && currentUrlMatches && lastLoadedPhotoIdRef.current === photoIdToUse) {
            console.log('[NewEditor] Photo URL already matches and was just loaded, skipping update');
            return;
          }
          
          // If we're here, we need to reload (either ref is null or URL doesn't match)
          console.log('[NewEditor] Reloading image - ref:', lastLoadedPhotoIdRef.current, 'photoId:', photoIdToUse, 'URL match:', currentUrlMatches);
          
          // Load image to get dimensions
          const img = new Image();
          img.onload = () => {
            console.log('[NewEditor] Setting image in store:', imageUrl);
            
            // CRITICAL FIX: Validate dimensions match database (source of truth for masks)
            const dbWidth = photo.width;
            const dbHeight = photo.height;
            const naturalWidth = img.naturalWidth;
            const naturalHeight = img.naturalHeight;
            
            // Check for dimension mismatch (allow 1px tolerance for rounding)
            const widthDiff = Math.abs(naturalWidth - dbWidth);
            const heightDiff = Math.abs(naturalHeight - dbHeight);
            const hasMismatch = widthDiff > 1 || heightDiff > 1;
            
            if (hasMismatch) {
              console.warn(`[NewEditor] ⚠️ Dimension mismatch detected:`, {
                photoId: photoIdToUse,
                database: `${dbWidth}x${dbHeight}`,
                natural: `${naturalWidth}x${naturalHeight}`,
                difference: {
                  width: widthDiff,
                  height: heightDiff
                },
                action: 'Using database dimensions for mask coordinate system'
              });
              
              // TODO: Consider auto-fixing database if mismatch is significant (>10px)
              // For now, use database dimensions as source of truth
            }
            
            // Always use database dimensions for photoSpace to ensure mask coordinates match
            // Masks were saved relative to database dimensions, so we must use those
            dispatch({
              type: 'SET_IMAGE',
              payload: {
                url: imageUrl,
                width: dbWidth,   // Use database dimensions (source of truth)
                height: dbHeight, // Use database dimensions (source of truth)
                // Include natural dimensions for reference (optional, for Layer 4)
                naturalWidth: naturalWidth,
                naturalHeight: naturalHeight
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
    <div className="h-full flex flex-col bg-gray-50 relative">
          <Toolbar 
            {...(effectiveJobId && { jobId: effectiveJobId })}
            {...(effectivePhotoId && { photoId: effectivePhotoId })}
          />
      
      <div className="flex-1 flex overflow-hidden min-h-0 gap-4 p-4">
        {/* Canvas viewport container - fixed box that does NOT resize on zoom */}
        <div 
          ref={containerRef}
          className="flex-1 relative bg-white rounded-xl shadow-md min-h-0"
          style={{
            position: 'relative',
            overflow: 'hidden',
            minWidth: 0,
            // Prevent horizontal scroll during zoom
            overflowX: 'hidden'
          }}
          role="main"
          aria-label="Canvas Editor"
        >
          <Canvas 
            width={containerRef.current?.clientWidth || 800} 
            height={containerRef.current?.clientHeight || 600}
          />
          
          {/* Measurement Overlay */}
          <MeasurementOverlay jobId={effectiveJobId || undefined} />
          
          {/* Variant Switcher - Bottom of Canvas */}
          {variants.length > 0 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30">
              <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg px-4 py-2 flex items-center gap-3">
                <button
                  onClick={handlePreviousVariant}
                  disabled={!canNavigate}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600 hover:text-gray-900"
                  title="Previous variant"
                  aria-label="Previous variant"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-2 min-w-[120px] justify-center">
                  <span className="text-sm font-medium text-gray-900">
                    {activeVariant?.label || 'Original'}
                  </span>
                  {variants.length > 1 && (
                    <span className="text-xs text-gray-500">
                      {variants.findIndex(v => v.id === activeVariantId) + 1} / {variants.length}
                    </span>
                  )}
                </div>
                
                <button
                  onClick={handleNextVariant}
                  disabled={!canNavigate}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600 hover:text-gray-900"
                  title="Next variant"
                  aria-label="Next variant"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
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
          className="h-full overflow-hidden flex flex-col bg-white shadow-sm border-l border-gray-100 rounded-xl"
          role="complementary"
          aria-label="Editor Sidebar"
        >
          {/* Tab Navigation */}
          <TooltipProvider>
            <div className="flex border-b border-gray-100 bg-white px-6 pt-6">
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
