// Canvas Component with Proper Zoom, Pan, and Mask Drawing
import { useRef, useEffect, useCallback, useState } from 'react';
import { useEditorStore } from './store';
import { Masking } from './Masking';
import { useMaskStore } from './Masking';
import { MaskCanvasKonva } from '../canvas/konva-stage/MaskCanvasKonva';
import { getImageFit } from '../maskcore/photoFit';
import { calculateFitScale, calculateCenterPan } from './utils';

interface CanvasProps {
  width: number;
  height: number;
}

export function Canvas({ width, height }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [showDevHud, setShowDevHud] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{x: number, y: number} | null>(null);
  
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
    state,
    activeTool,
    drawingPoints,
    isDrawing,
    masks,
    containerSize,
    calibrationMode,
    dispatch
  } = useEditorStore();

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

  // Load image with proper state management
  useEffect(() => {
    if (imageUrl) {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        dispatch({ type: 'SET_STATE', payload: 'ready' });
        
        // Initialize photo space when image loads - use same logic as Fit button
        if (img.naturalWidth > 0 && img.naturalHeight > 0 && containerSize.width > 0 && containerSize.height > 0) {
          const fitScale = calculateFitScale(
            img.naturalWidth,
            img.naturalHeight,
            containerSize.width,
            containerSize.height
          );
          
          const { panX, panY } = calculateCenterPan(
            img.naturalWidth,
            img.naturalHeight,
            containerSize.width,
            containerSize.height,
            fitScale
          );
          
          dispatch({
            type: 'SET_PHOTO_SPACE',
            payload: {
              scale: fitScale,
              panX,
              panY,
              imgW: img.naturalWidth,
              imgH: img.naturalHeight
            }
          });
        }
      };
      img.onerror = () => {
        dispatch({ type: 'SET_STATE', payload: 'error' });
      };
      img.src = imageUrl;
    }
  }, [imageUrl, dispatch, containerSize]);

  // Set canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }, [width, height]);

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply device pixel ratio
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // Draw background image with proper scaling and positioning
    if (imageRef.current && state === 'ready' && photoSpace) {
      // Apply photo space transform
      ctx.save();
      ctx.translate(photoSpace.panX, photoSpace.panY);
      ctx.scale(photoSpace.scale, photoSpace.scale);
      
      // Draw image at origin
      ctx.drawImage(
        imageRef.current,
        0,
        0,
        photoSpace.imgW,
        photoSpace.imgH
      );
    
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
      
      ctx.restore();
    }
    
    // Assets rendered by Konva system - no Canvas API rendering needed
    
    // PHASE 10: Clean implementation - no legacy code
  }, [masks, isDrawing, drawingPoints, state, width, height, photoSpace]);

  // Render on changes - SIMPLIFIED
  useEffect(() => {
    renderCanvas().catch(err => {
      console.warn('[Canvas] Render error:', err);
    });
  }, [renderCanvas]);


  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        data-canvas="true"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          pointerEvents: calibrationMode ? 'none' : 'auto'
        }}
        title="Canvas - Click to focus for keyboard shortcuts"
      />
      
      {/* NEW KONVA MASKING SYSTEM */}
      <MaskCanvasKonva
        activeTool={activeTool}
        camera={photoSpace}
        imgFit={getImageFit(imageRef, width, height, photoSpace.scale)}
        dpr={window.devicePixelRatio || 1}
      />
      
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