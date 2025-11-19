// Canvas Component with Proper Zoom, Pan, and Mask Drawing
import React, { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';
import { useEditorStore } from './store';
import { Masking } from './Masking';
// import { useMaskStore } from './Masking'; // Unused import
import { MaskCanvasKonva } from '../canvas/konva-stage/MaskCanvasKonva';
import { calculateImageFit } from '../maskcore/photoFit';
import { calculateCenterPan, calculateFitScale } from './utils';
import { loadPhotoSpace, isPhotoSpaceValid } from './photoSpacePersistence';

interface CanvasProps {
  width: number;
  height: number;
}

export function Canvas({ width, height }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [showDevHud, setShowDevHud] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{x: number, y: number} | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  
  // DEV toggle handler
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDevHud(prev => !prev);
        console.log(`DEV HUD ${showDevHud ? 'OFF' : 'ON'}`);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showDevHud]);
  
  const {
    photoSpace,
    imageUrl,
    variants,
    activeVariantId,
    state,
    activeTool,
    calibrationMode,
    dispatch
  } = useEditorStore();
  
  // Get the active variant's image URL, or fallback to imageUrl
  const activeImageUrl = React.useMemo(() => {
    if (activeVariantId) {
      const variant = variants.find(v => v.id === activeVariantId);
      if (variant) return variant.imageUrl;
    }
    return imageUrl;
  }, [variants, activeVariantId, imageUrl]);

  // Initialize material library adapter
  useEffect(() => {
    import('./materialLibraryAdapter').then(({ materialLibraryAdapter }) => {
      materialLibraryAdapter.loadMaterials().then(materials => {
        console.log('[Canvas] Material library initialized:', materials.length, 'materials');
      }).catch(err => {
        console.warn('[Canvas] Failed to initialize material library:', err);
      });
    });
  }, []);

  // Load image with proper state management - use active variant URL
  useEffect(() => {
    if (activeImageUrl) {
      console.log('[Canvas] Starting to load image:', activeImageUrl);
      const img = new Image();
      img.onload = () => {
        console.log('[Canvas] Image loaded successfully:', activeImageUrl, { width: img.naturalWidth, height: img.naturalHeight });
        imageRef.current = img;
        dispatch({ type: 'SET_STATE', payload: 'ready' });
        
        // Initialize photo space when image loads - use Canvas props instead of containerSize
        if (img.naturalWidth > 0 && img.naturalHeight > 0 && width > 0 && height > 0) {
          // CRITICAL FIX: Use photoSpace dimensions from store if already set (from SET_IMAGE)
          // This ensures we use database dimensions (source of truth) instead of natural dimensions
          const currentState = useEditorStore.getState();
          const currentPhotoSpace = currentState.photoSpace;
          const imgW = currentPhotoSpace.imgW || img.naturalWidth;
          const imgH = currentPhotoSpace.imgH || img.naturalHeight;
          const photoId = currentState.jobContext?.photoId;
          
          // Check if photo space is already initialized (user has zoomed/panned)
          const isPhotoSpaceInitialized = currentPhotoSpace.scale > 0 && 
                                         currentPhotoSpace.panX !== undefined && 
                                         currentPhotoSpace.panY !== undefined;
          
          // Try to load persisted photo space state
          const persistedState = loadPhotoSpace(photoId);
          const isValidPersistedState = isPhotoSpaceValid(persistedState, imgW, imgH);
          
          if (isValidPersistedState && persistedState) {
            // Restore persisted state (user's previous zoom/pan)
            console.log('[Canvas] Restoring persisted photo space:', persistedState);
            dispatch({
              type: 'SET_PHOTO_SPACE',
              payload: {
                scale: persistedState.scale!,
                panX: persistedState.panX!,
                panY: persistedState.panY!,
                imgW,
                imgH
              }
            });
          } else if (!isPhotoSpaceInitialized) {
            // Only auto-fit if photo space is not initialized (first load)
            // This ensures we don't overwrite user's zoom/pan when returning to canvas
            const finalScale = calculateFitScale(
              imgW,
              imgH,
              width,
              height,
              0.98 // 98% padding to leave some margin
            );

            const { panX, panY } = calculateCenterPan(
              imgW,
              imgH,
              width,
              height,
              finalScale
            );

            console.log('[Canvas] Initializing photo space (first load):', { 
              finalScale, panX, panY, 
              imgW, imgH,
              naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
              canvasW: width, canvasH: height,
              usingDatabaseDimensions: currentPhotoSpace.imgW !== undefined
            });
            dispatch({
              type: 'SET_PHOTO_SPACE',
              payload: {
                scale: finalScale,
                panX,
                panY,
                // Only set imgW/imgH if not already set (preserve database dimensions from SET_IMAGE)
                ...(currentPhotoSpace.imgW === undefined && { imgW: img.naturalWidth }),
                ...(currentPhotoSpace.imgH === undefined && { imgH: img.naturalHeight })
              }
            });
          } else {
            // Photo space is already initialized, just ensure dimensions are set
            console.log('[Canvas] Photo space already initialized, preserving zoom/pan');
            dispatch({
              type: 'SET_PHOTO_SPACE',
              payload: {
                // Only update dimensions if not already set
                ...(currentPhotoSpace.imgW === undefined && { imgW: img.naturalWidth }),
                ...(currentPhotoSpace.imgH === undefined && { imgH: img.naturalHeight })
              }
            });
          }
        } else {
          console.warn('[Canvas] Cannot initialize photo space - missing image or canvas dimensions', { 
            imgW: img.naturalWidth, 
            imgH: img.naturalHeight, 
            canvasW: width, 
            canvasH: height 
          });
        }
      };
      img.onerror = (error) => {
        console.error('[Canvas] Failed to load image:', activeImageUrl, error);
        dispatch({ type: 'SET_STATE', payload: 'error' });
      };
      img.src = activeImageUrl;
    } else {
      console.log('[Canvas] No activeImageUrl provided');
    }
  }, [activeImageUrl, dispatch, width, height]); // Use activeImageUrl instead of imageUrl

  // Set canvas size with ResizeObserver to match CSS size * DPR
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Set bitmap size to match CSS size * DPR
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // Scale CSS to maintain visual size
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      // Update canvas size state to trigger re-render
      setCanvasSize({ width: rect.width, height: rect.height });
      
      console.log('[Canvas] Resized canvas:', { 
        cssWidth: rect.width, 
        cssHeight: rect.height, 
        bitmapWidth: canvas.width, 
        bitmapHeight: canvas.height, 
        dpr 
      });
    });
    
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Handle wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!photoSpace || !imageRef.current) return;
    
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Use 10% increments instead of exponential scaling
    const currentPercentage = Math.round(photoSpace.scale * 100);
    const deltaY = e.deltaY;
    const increment = Math.abs(deltaY) > 50 ? 20 : 10; // Larger increment for faster scrolling
    
    let nextPercentage;
    if (deltaY < 0) {
      // Zoom in
      nextPercentage = Math.min(500, currentPercentage + increment);
    } else {
      // Zoom out
      nextPercentage = Math.max(10, currentPercentage - increment);
    }
    
    const newScale = nextPercentage / 100;
    
    // Calculate image coordinates at mouse position
    const imageX = (mouseX - photoSpace.panX) / photoSpace.scale;
    const imageY = (mouseY - photoSpace.panY) / photoSpace.scale;
    
    // Calculate new pan to keep image point under mouse
    const newPanX = mouseX - imageX * newScale;
    const newPanY = mouseY - imageY * newScale;
    
    dispatch({
      type: 'SET_PHOTO_SPACE',
      payload: {
        scale: newScale,
        panX: newPanX,
        panY: newPanY
      }
    });
  }, [photoSpace, dispatch]);

  // Handle mouse down for panning
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!photoSpace) return;
    
    // If in calibration mode, don't handle panning - let Konva handle the events
    if (calibrationMode) {
      console.log('[Canvas] Calibration mode active - not handling mouse events for panning');
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setIsPanning(true);
    setPanStart({ x: mouseX, y: mouseY });
  }, [photoSpace, calibrationMode]);

  // Handle mouse move for panning
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning || !panStart || !photoSpace || calibrationMode) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const deltaX = mouseX - panStart.x;
    const deltaY = mouseY - panStart.y;
    
    dispatch({
      type: 'SET_PHOTO_SPACE',
      payload: {
        panX: photoSpace.panX + deltaX,
        panY: photoSpace.panY + deltaY
      }
    });
    
    setPanStart({ x: mouseX, y: mouseY });
  }, [isPanning, panStart, photoSpace, calibrationMode, dispatch]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
  }, []);

  // Add event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

    // Asset rendering moved to Konva system
  // No longer needed in Canvas.tsx

  // Render canvas with proper coordinate system
  const renderCanvas = useCallback(async () => {
    console.log('[Canvas] renderCanvas called', { 
      hasCanvas: !!canvasRef.current, 
      hasImage: !!imageRef.current, 
      state, 
      hasPhotoSpace: !!photoSpace 
    });
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('[Canvas] No canvas element');
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('[Canvas] No canvas context');
      return;
    }
    
    const dpr = window.devicePixelRatio || 1;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background image with proper scaling and positioning
    if (imageRef.current && state === 'ready' && photoSpace) {
      console.log('[Canvas] Drawing image', { 
        imageSize: { width: imageRef.current.naturalWidth, height: imageRef.current.naturalHeight },
        photoSpace: { scale: photoSpace.scale, panX: photoSpace.panX, panY: photoSpace.panY, imgW: photoSpace.imgW, imgH: photoSpace.imgH },
        canvasSize: { bitmapWidth: canvas.width, bitmapHeight: canvas.height, cssWidth: canvas.style.width, cssHeight: canvas.style.height },
        dpr
      });
      
      // Apply photo space transform with DPR scaling
      ctx.save();
      ctx.translate(dpr * photoSpace.panX, dpr * photoSpace.panY);
      ctx.scale(dpr * photoSpace.scale, dpr * photoSpace.scale);
      
      // Draw image at origin
      ctx.drawImage(
        imageRef.current,
        0,
        0,
        photoSpace.imgW,
        photoSpace.imgH
      );
      
      ctx.restore();
      console.log('[Canvas] Image drawn successfully');
    } else {
      console.log('[Canvas] Not drawing image', { 
        hasImage: !!imageRef.current, 
        state, 
        hasPhotoSpace: !!photoSpace 
      });
    }
    
    // DISABLED: Mask rendering moved to MaskCanvasKonva to prevent duplication
    // The MaskCanvasKonva component handles all mask rendering including materials
    // This prevents the duplication issue when photo space changes (e.g., Fit button)
    // 
    // Original mask rendering code commented out below:
    /*
    // Draw masks using clean masking system
      const { masks: maskcoreMasks, draft, selectedId } = useMaskStore.getState();
      let allMasks: Record<string, any> = {};
      
      try {
        allMasks = getAllMasks();
      } catch (error) {
        console.warn('[Canvas] Error getting all masks:', error);
        allMasks = maskcoreMasks; // Fallback to just regular masks
      }
      
      // Draw all masks
      for (const mask of Object.values(allMasks)) {
        if (mask.pts.length < 3) continue;
        
        ctx.beginPath();
        const firstPoint = mask.pts[0];
        if (firstPoint) {
          ctx.moveTo(firstPoint.x, firstPoint.y);
          for (let i = 1; i < mask.pts.length; i++) {
            const point = mask.pts[i];
            if (point) {
              ctx.lineTo(point.x, point.y);
            }
          }
        }
        ctx.closePath();
        
        // Check if this is an asset mask
        if (isAssetMask(mask)) {
          // Render asset with its properties
          ctx.fillStyle = `rgba(100, 150, 200, ${mask.assetOpacity * 0.3})`;
          ctx.fill();
          
          // Draw asset outline if selected
          if (selectedId === mask.id) {
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        } else {
          // PHASE 7: Materials with underwater effects
          if (mask.materialId) {
            // Load material pattern with underwater effects
            const materialSettings = mask.materialSettings || {};
            const underwaterVersion = materialSettings.underwaterVersion || 'v1';
            const tileScale = materialSettings.tileScale || 1.0;
            
            // Load real material pattern from material library
            try {
              const { materialLibraryAdapter } = await import('./materialLibraryAdapter');
              const pattern = await materialLibraryAdapter.getPattern(mask.materialId, tileScale, {
                enabled: underwaterVersion !== 'none',
                blend: materialSettings.blend || 65,
                edgeSoftness: materialSettings.edgeSoftness || 0,
                depthBias: materialSettings.depthBias || 0,
                tint: materialSettings.tint || 0,
                edgeFeather: materialSettings.edgeFeather || 0,
                highlights: materialSettings.highlights || 0,
                ripple: materialSettings.ripple || 0,
                materialOpacity: materialSettings.materialOpacity || 100,
                contactOcclusion: materialSettings.contactOcclusion || 0,
                textureBoost: materialSettings.textureBoost || 0
              });
              
              if (pattern) {
                ctx.fillStyle = pattern;
                ctx.fill();
              } else {
                // Fallback to placeholder if pattern loading fails
                ctx.fillStyle = 'rgba(0, 170, 0, 0.25)';
                ctx.fill();
              }
            } catch (error) {
              console.warn('[Canvas] Failed to load material pattern:', error);
              // Fallback to placeholder
              ctx.fillStyle = 'rgba(0, 170, 0, 0.25)';
              ctx.fill();
            }
          } else {
            // No material - use default fill
            ctx.fillStyle = 'rgba(0, 170, 0, 0.25)';
            ctx.fill();
          }
        }
        
        // Apply edge softness if specified (zoom invariant)
        const edgeSoftness = mask.materialSettings?.edgeSoftness || 0;
        if (edgeSoftness > 0) {
          const softnessApplied = edgeSoftness / photoSpace.scale; // Zoom invariant
          ctx.shadowBlur = softnessApplied;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
          ctx.globalCompositeOperation = 'multiply';
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.globalCompositeOperation = 'source-over';
          console.log('[ZoomInvariant]', { edgeSoftnessPx: edgeSoftness, photoSpaceScale: photoSpace.scale, softnessApplied });
        }
      }
    */
      
    // DISABLED: Draft mask rendering also moved to MaskCanvasKonva
    // The MaskCanvasKonva component handles draft mask rendering as well
    /*
    // Draw draft mask
    if (draft && draft.pts.length >= 2) {
      ctx.beginPath();
      const firstPoint = draft.pts[0];
      if (firstPoint) {
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let i = 1; i < draft.pts.length; i++) {
          const point = draft.pts[i];
          if (point) {
            ctx.lineTo(point.x, point.y);
          }
        }
      }
      
      // PHASE 6: Draft styling - thin orange stroke + faint orange fill
      ctx.strokeStyle = '#FF7A1A'; // Orange stroke
      ctx.lineWidth = 1 / photoSpace.scale; // Scale stroke width inversely
      ctx.stroke();
      
      // Faint orange fill
      if (draft.pts.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 122, 26, 0.08)';
        ctx.fill();
      }
    }
    */
    
    // Assets rendered by Konva system - no Canvas API rendering needed
    
    // PHASE 10: Clean implementation - no legacy code
  }, [state, width, height, photoSpace, canvasSize]);

  // Render on changes - SIMPLIFIED
  useEffect(() => {
    console.log('[Canvas] useEffect triggered for renderCanvas', { 
      state, 
      hasImage: !!imageRef.current, 
      hasPhotoSpace: !!photoSpace,
      width,
      height
    });
    renderCanvas().catch(err => {
      console.warn('[Canvas] Render error:', err);
    });
  }, [renderCanvas]);


  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen" 
      style={{ height: '100vh' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        data-canvas="true"
        style={{
          pointerEvents: calibrationMode ? 'none' : 'auto'
        }}
        title="Canvas - Click to focus for keyboard shortcuts"
      />
      
      {/* NEW KONVA MASKING SYSTEM */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'transparent' }}>
        <MaskCanvasKonva
          activeTool={
            activeTool === 'pen' 
              ? 'polygon'  // Pen tool maps to polygon for drawing
              : activeTool === 'pan' 
                ? 'select'  // Pan tool maps to select for panning/selecting
                : activeTool
          }
          camera={photoSpace}
          imgFit={photoSpace?.imgW && photoSpace?.imgH 
            ? {
                // Image is drawn at (0,0) in world space, so originX/Y should be 0
                // Centering is handled by panX/panY, not by imgFit
                originX: 0,
                originY: 0,
                imgScale: 1.0
              }
            : { originX: 0, originY: 0, imgScale: 1 }
          }
          dpr={window.devicePixelRatio || 1}
        />
      </div>
      
      {/* OLD MASKING SYSTEM - DISABLED */}
      <Masking
        canvasRef={canvasRef}
        imageRef={imageRef}
        camera={{
        scale: photoSpace?.scale || 1,
        panX: photoSpace?.panX || 0,
        panY: photoSpace?.panY || 0
        }}
        imgFit={{
        originX: 0,
        originY: 0,
        imgScale: 1
        }}
        width={width}
        height={height}
      activeTool={activeTool === 'area' ? 'area' : null}
        onToolChange={(tool) => {
          dispatch({
            type: 'SET_ACTIVE_TOOL',
            payload: tool || 'select'
          });
        }}
        showDevHud={showDevHud}
      />
    </div>
  );
}