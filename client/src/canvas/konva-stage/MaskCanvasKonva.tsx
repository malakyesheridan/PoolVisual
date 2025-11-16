import React, { useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Group, Rect, Line, Circle } from 'react-konva';
import Konva from 'konva';
import { useMaskStore } from '../../maskcore/store';
import { useEditorStore } from '../../new_editor/store';
import { WorldGroup } from './WorldGroup';
import { MaskDraftLayer } from '../../components/canvas/MaskDraftLayer';
import { MaskPolygonsLayer } from '../../components/canvas/MaskPolygonsLayer';
import { MaskTextureLayer } from '../../components/canvas/MaskTextureLayer';
import { MaskControlPoints } from '../../components/canvas/MaskControlPoints';
import { GridOverlay } from '../../components/canvas/GridOverlay';
import { AssetsLayerKonva } from '../../components/canvas/AssetsLayerKonva';
import { useDraft } from '../draft/useDraft';
import { isAssetsEnabled } from '../../new_editor/featureFlags';
// AssetsLayer removed - assets now rendered as masks
import { getAllMasks, selectMaskOrAsset, deselectAll } from '../../new_editor/assets/unifiedMaskStore';
import { AssetMasksLayer } from '../../new_editor/assets/AssetMaskRenderer';
import { isAssetMask } from '../../new_editor/assets/assetToMaskConverter';

interface Props {
  camera: { scale: number; panX: number; panY: number };
  imgFit: { originX: number; originY: number; imgScale: number };
  dpr?: number;
  activeTool: 'area' | 'polygon' | 'select' | null;
}

export function MaskCanvasKonva({ camera, imgFit, dpr = 1, activeTool }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const { masks, selectedId } = useMaskStore();
  const { assets, selectedAssetId, dispatch, assetPlaceMode, calibrationMode, photoSpace } = useEditorStore();
  const { draft, begin, append, updateLast, pop, cancel, canFinalize, finalize } = useDraft();
  
  // Guard against duplicate mask finalization - prevents duplicate masks when Enter is pressed multiple times
  // or when multiple handlers try to finalize the same draft
  const finalizingRef = useRef<boolean>(false);
  
  // Click counter for triple-click detection
  const clickCounterRef = useRef<{ 
    count: number; 
    timer: NodeJS.Timeout | null; 
    lastTarget: Konva.Node | null; 
    lastTime: number;
  }>({
    count: 0,
    timer: null,
    lastTarget: null,
    lastTime: 0
  });

  // RAF throttling for mouse move events
  const mouseMoveLockRef = useRef<boolean>(false);
  
  // Device detection for adaptive sensitivity
  const deviceTypeRef = useRef<'mouse' | 'trackpad' | 'touch'>('mouse');
  const lastPointerTypeRef = useRef<string>('');
  const movementHistoryRef = useRef<number[]>([]);
  const lastMoveTimeRef = useRef<number>(0);
  
  // Device-adaptive sensitivity settings
  const getDeviceSettings = useCallback(() => {
    const deviceType = deviceTypeRef.current;
    
    switch (deviceType) {
      case 'trackpad':
        return {
          minDistance: 30,        // Smaller dead zone for trackpads
          maxDistance: 150,       // Smaller max distance
          minSmoothingFactor: 0.7, // Less aggressive smoothing
          maxSmoothingFactor: 1.0, // Full sensitivity at distance
          maxRotationPerFrame: 15, // Higher rotation cap for trackpads
          sensitivityMultiplier: 1.5 // Boost sensitivity for trackpads
        };
      case 'touch':
        return {
          minDistance: 20,        // Very small dead zone for touch
          maxDistance: 100,       // Small max distance
          minSmoothingFactor: 0.8, // Minimal smoothing for touch
          maxSmoothingFactor: 1.0, // Full sensitivity
          maxRotationPerFrame: 20, // Highest rotation cap for touch
          sensitivityMultiplier: 2.0 // Highest sensitivity for touch
        };
      case 'mouse':
      default:
        return {
          minDistance: 50,        // Original values for mouse
          maxDistance: 200,       // Original values for mouse
          minSmoothingFactor: 0.3, // Original smoothing
          maxSmoothingFactor: 1.0, // Original smoothing
          maxRotationPerFrame: 5,  // Original rotation cap
          sensitivityMultiplier: 1.0 // No multiplier for mouse
        };
    }
  }, []);
  
  // State for calibration line visualization
  const [calibrationPoints, setCalibrationPoints] = React.useState<{x: number, y: number}[]>([]);
  
  // Get unified masks (including assets)
  const allMasks = getAllMasks();
  const assetMasks = Object.values(allMasks).filter(isAssetMask);
  const regularMasks = Object.values(allMasks).filter(mask => !isAssetMask(mask));

  // Visual feedback for calibration mode
  React.useEffect(() => {
    console.log('[MaskCanvasKonva] Calibration mode changed to:', calibrationMode);
    console.log('[MaskCanvasKonva] Current photoSpace scale:', photoSpace?.scale);
    if (stageRef.current) {
      const stage = stageRef.current;
      if (calibrationMode) {
        console.log('[MaskCanvasKonva] Setting crosshair cursor for calibration');
        stage.container().style.cursor = 'crosshair';
        console.log('[MaskCanvasKonva] Konva stage ready to receive calibration events');
      } else {
        console.log('[MaskCanvasKonva] Setting default cursor');
        stage.container().style.cursor = 'default';
        // Clear calibration points when exiting calibration mode
        setCalibrationPoints([]);
      }
    }
  }, [calibrationMode, photoSpace?.scale]);

  // Listen for calibration measurement points to update visualization
  React.useEffect(() => {
    const handleCalibrationPoint = (event: CustomEvent<{x: number, y: number}>) => {
      if (calibrationMode) {
        const point = event.detail;
        setCalibrationPoints(prev => {
          const newPoints = [...prev, point];
          // Keep only the last 2 points
          return newPoints.slice(-2);
        });
      }
    };

    window.addEventListener('calibration-measurement-point', handleCalibrationPoint as EventListener);
    return () => {
      window.removeEventListener('calibration-measurement-point', handleCalibrationPoint as EventListener);
    };
  }, [calibrationMode]);

  // Register/unregister Konva stage reference with store for canvas export
  useEffect(() => {
    if (stageRef.current) {
      dispatch({ type: 'SET_KONVA_STAGE_REF', payload: stageRef.current });
      console.log('[MaskCanvasKonva] Registered Konva stage reference with store');
    }
    return () => {
      dispatch({ type: 'SET_KONVA_STAGE_REF', payload: null });
      console.log('[MaskCanvasKonva] Unregistered Konva stage reference from store');
    };
  }, [dispatch]);

  // Log world transform once on mount
  useEffect(() => {
    console.log('[WorldTransform]', { 
      stageScale: camera.scale, 
      pan: { x: camera.panX, y: camera.panY },
      imgFit: { originX: imgFit.originX, originY: imgFit.originY, imgScale: imgFit.imgScale }
    });
  }, [camera.scale, camera.panX, camera.panY, imgFit.originX, imgFit.originY, imgFit.imgScale]);

  // Debug coordinate transformation during zoom
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[ZoomDebug]', {
        camera: { scale: camera.scale, panX: camera.panX, panY: camera.panY },
        imgFit: { originX: imgFit.originX, originY: imgFit.originY, imgScale: imgFit.imgScale },
        maskCount: Object.keys(allMasks).length
      });
    }
  }, [camera.scale, camera.panX, camera.panY, allMasks]);

  // Convert screen coordinates to image-space coordinates
  const screenToImageLocal = useCallback((localX: number, localY: number) => {
    // Konva getPointerPosition() returns CSS pixels relative to the stage
    // We need to convert these to image coordinates
    
    console.log('[CoordinateDebug] screenToImageLocal input:', { localX, localY });
    console.log('[CoordinateDebug] Camera state:', { panX: camera.panX, panY: camera.panY, scale: camera.scale });
    console.log('[CoordinateDebug] ImgFit state:', { originX: imgFit.originX, originY: imgFit.originY, imgScale: imgFit.imgScale });
    
    // Step 1: Convert stage coordinates to world coordinates (undo camera transform)
    const worldX = (localX - camera.panX) / camera.scale;
    const worldY = (localY - camera.panY) / camera.scale;
    
    console.log('[CoordinateDebug] World coordinates:', { worldX, worldY });
    
    // Step 2: Convert world coordinates to image coordinates (undo imgFit transform)
    const imageX = (worldX - imgFit.originX) / imgFit.imgScale;
    const imageY = (worldY - imgFit.originY) / imgFit.imgScale;
    
    console.log('[CoordinateDebug] Final image coordinates:', { imageX, imageY });
    
    return { x: imageX, y: imageY };
  }, [camera, imgFit]);

  // Handle pointer events
  const handlePointerDown = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    // Don't interfere with double-click events
    if (e.evt.detail === 2) {
      console.log('[PointerDown] Skipping - double-click detected');
      return;
    }
    
    if (!activeTool || activeTool === 'select') return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const imagePos = screenToImageLocal(pos.x, pos.y);
    
    if (activeTool === 'area' || activeTool === 'polygon') {
      // Get current drawing mode
      const editorState = useEditorStore.getState();
      
      if (!draft) {
        begin(activeTool);
      }
      
      if (editorState.drawingMode === 'freehand') {
        // For freehand mode, start continuous drawing
        append(imagePos);
        // Set up continuous drawing flag
        stage.setAttr('isFreehandDrawing', true);
      } else {
        // For area mode, add point normally
        append(imagePos);
      }
    }
  }, [activeTool, draft, begin, append, screenToImageLocal]);

  const handlePointerMove = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!activeTool || activeTool === 'select' || !draft) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const imagePos = screenToImageLocal(pos.x, pos.y);
    
    // Get current drawing mode
    const editorState = useEditorStore.getState();
    
    if (activeTool === 'area') {
      if (editorState.drawingMode === 'freehand') {
        // For freehand mode, continuously add points while dragging
        if (stage.getAttr('isFreehandDrawing')) {
          append(imagePos);
        }
      } else {
        // For area mode, update the last point to follow the mouse
        if (draft.pts.length > 0) {
          updateLast(imagePos);
        }
      }
    }
  }, [activeTool, draft, screenToImageLocal, updateLast, append]);

  const handlePointerUp = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!activeTool || activeTool === 'select' || !draft) return;

    const stage = e.target.getStage();
    if (!stage) return;

    // Get current drawing mode
    const editorState = useEditorStore.getState();
    
    if (editorState.drawingMode === 'freehand') {
      // For freehand mode, stop continuous drawing
      stage.setAttr('isFreehandDrawing', false);
    }

    if (activeTool === 'polygon') {
      // For polygon tool, each click adds a point
      // The point was already added in pointerDown
    }
  }, [activeTool, draft]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!draft) return;

      switch (e.key) {
        case 'Enter':
          // CRITICAL FIX: Prevent duplicate finalization from rapid Enter presses
          if (finalizingRef.current) {
            console.warn('[MaskCanvasKonva] Finalization already in progress, ignoring duplicate Enter');
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          
          if (canFinalize()) {
            finalizingRef.current = true;
            
            try {
              const finalizedDraft = finalize();
              if (!finalizedDraft) {
                finalizingRef.current = false;
                return;
              }
              
              const id = `mask_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
              
              // Determine mask type based on drawing mode
              const editorState = useEditorStore.getState();
              const maskType: 'area' | 'linear' = editorState.drawingMode === 'freehand' ? 'linear' : 'area';
              
              // Convert Point[] to MaskPoint[] (add kind: 'corner' to each point)
              const maskPoints = finalizedDraft.pts.map(pt => ({
                x: pt.x,
                y: pt.y,
                kind: 'corner' as const
              }));
              
              // Safety check: Ensure mask doesn't already exist
              const currentMasks = useMaskStore.getState().masks;
              if (currentMasks[id]) {
                console.error('[MaskCanvasKonva] Mask ID collision:', id);
                finalizingRef.current = false;
                return;
              }
              
              // Log coordinate details for debugging
              const photoSpace = useEditorStore.getState().photoSpace;
              const minX = Math.min(...maskPoints.map(p => p.x));
              const maxX = Math.max(...maskPoints.map(p => p.x));
              const minY = Math.min(...maskPoints.map(p => p.y));
              const maxY = Math.max(...maskPoints.map(p => p.y));
              console.log('[MaskCanvasKonva] Finalizing mask', { 
                id, 
                ptsCount: maskPoints.length, 
                maskType,
                boundingBox: { minX, minY, maxX, maxY },
                firstPoint: maskPoints[0],
                lastPoint: maskPoints[maskPoints.length - 1],
                photoSpace: { imgW: photoSpace.imgW, imgH: photoSpace.imgH },
                imgFit: { originX: imgFit.originX, originY: imgFit.originY, imgScale: imgFit.imgScale },
                hasNegative: minX < 0 || minY < 0,
                extendsBeyond: maxX > (photoSpace.imgW || 0) || maxY > (photoSpace.imgH || 0)
              });
              
              useMaskStore.setState(prev => {
                // Final safety check inside setState callback to prevent race conditions
                if (prev.masks[id]) {
                  console.error('[MaskCanvasKonva] Duplicate mask detected in setState, aborting');
                  return prev; // Return unchanged state
                }
                
                return {
                  masks: { 
                    ...prev.masks, 
                    [id]: { 
                      id, 
                      pts: maskPoints, 
                      mode: finalizedDraft.mode, 
                      materialId: prev.activeMaterialId ?? null,
                      materialSettings: null,
                      type: maskType
                    } 
                  },
                  selectedId: id
                };
              });
              
              console.debug('[MaskCanvasKonva] Mask finalized and added to store', { id });
            } catch (error) {
              console.error('[MaskCanvasKonva] Error during mask finalization:', error);
            } finally {
              // Reset flag after delay to prevent rapid re-finalization
              setTimeout(() => {
                finalizingRef.current = false;
              }, 200);
            }
          }
          break;
          
        case 'Escape':
          cancel();
          break;
          
        case 'Backspace':
          pop();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [draft, canFinalize, finalize, cancel, pop]);

  // Handle mask selection with lock checking
  const handleMaskSelect = useCallback((maskId: string) => {
    const { masks } = useMaskStore.getState();
    const mask = masks[maskId];
    
    // Check if mask is locked
    if (mask?.isLocked) {
      console.log('[MaskSelect] Mask is locked, selection prevented:', maskId);
      return;
    }
    
    useMaskStore.setState({ selectedId: maskId });
    console.debug('[MaskSelect]', { maskId });
  }, []);

  // Extract mask ID from target node by walking up parent chain
  const getMaskIdFromTarget = useCallback((target: Konva.Node): string | null => {
    let current = target;
    while (current) {
      const maskId = current.getAttr('maskId');
      if (maskId) return maskId;
      current = current.getParent();
    }
    return null;
  }, []);

  // Extract asset ID from target node by walking up parent chain
  const getAssetIdFromTarget = useCallback((target: Konva.Node): string | null => {
    let current = target;
    while (current) {
      const assetId = current.getAttr('assetId');
      if (assetId) return assetId;
      current = current.getParent();
    }
    return null;
  }, []);

  // Check if target is an asset node
  const isAssetNode = useCallback((target: Konva.Node): boolean => {
    let current = target;
    while (current) {
      if (current.hasName('asset-shape') || current.getAttr('assetId')) return true;
      current = current.getParent();
    }
    return false;
  }, []);

  // Get event target chain for debugging
  const getEventTargetChain = useCallback((target: Konva.Node): string[] => {
    const chain = [];
    let current = target;
    while (current && current !== current.getStage()) {
      chain.push(`${current.getClassName()}:${current.name() || 'unnamed'}:${current.id() || 'no-id'}`);
      current = current.getParent();
    }
    return chain;
  }, []);

  // Unified selection handler for masks and assets
  const handleUnifiedSelect = useCallback((maskId: string) => {
    selectMaskOrAsset(maskId);
  }, []);

  // Handle double-click for point editing
  const handleStageDoubleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    console.log('[DoubleClick] RAW EVENT FIRED!', {
      type: e.evt.type,
      target: e.target,
      timestamp: Date.now()
    });
    
    e.evt.preventDefault();
    e.evt.stopPropagation();
    
    const target = e.target as Konva.Node;
    
    // Cancel any pending drag timer immediately
    const { CANCEL_MASK_DRAG } = useMaskStore.getState();
    CANCEL_MASK_DRAG();
    
    // Clear triple-click timer to prevent interference
    const clickCounter = clickCounterRef.current;
    if (clickCounter.timer) {
      clearTimeout(clickCounter.timer);
      clickCounter.timer = null;
      clickCounter.count = 0;
      clickCounter.lastTarget = null;
    }
    
    console.log('[DoubleClick] Event triggered', {
      targetClass: target.getClassName(),
      targetName: target.name(),
      eventType: e.evt.type,
      timestamp: Date.now(),
      targetId: target.id(),
      clickCounter: clickCounterRef.current.count,
      stageSize: e.target.getStage()?.size(),
      allMasks: Object.keys(useMaskStore.getState().masks)
    });
    
    // Check if we clicked on a mask - be more flexible with target detection
    const isMaskShape = target.getClassName() === 'Shape' && target.name()?.startsWith('mask-');
    const isMaskLine = target.getClassName() === 'Line' && target.name()?.startsWith('mask-');
    
    console.log('[DoubleClick] Mask detection', {
      isMaskShape,
      isMaskLine,
      className: target.getClassName(),
      name: target.name(),
      id: target.id(),
      willProcess: isMaskShape || isMaskLine
    });
    
    if (isMaskShape || isMaskLine) {
      // Try multiple ways to get the mask ID
      let maskId = target.name()?.replace('mask-', '');
      if (!maskId) {
        maskId = getMaskIdFromTarget(target);
      }
      if (!maskId) {
        maskId = target.id();
      }
      
      const { masks, ENTER_POINT_EDITING, pointEditingMode, editingMaskId } = useMaskStore.getState();
      const mask = masks[maskId];
      
      console.log('[DoubleClick] Mask double-clicked', {
        maskId,
        maskExists: !!mask,
        maskLocked: mask?.isLocked,
        currentEditingMode: pointEditingMode,
        currentEditingMaskId: editingMaskId,
        targetType: target.getClassName(),
        availableMasks: Object.keys(masks)
      });
      
      // Only allow editing if mask exists and is not locked
      if (mask && !mask.isLocked) {
        console.log('[Point Editing] Entering point editing mode for mask:', maskId);
        ENTER_POINT_EDITING(maskId);
        
        // Visual feedback - briefly highlight the mask
        const stage = e.target.getStage();
        if (stage) {
          const shape = stage.findOne(`mask-${maskId}`);
          if (shape) {
            shape.stroke('#00ff00'); // Green highlight
            shape.strokeWidth(3);
            setTimeout(() => {
              shape.stroke('#2563eb'); // Back to blue
              shape.strokeWidth(1.5);
            }, 500);
          }
        }
      } else {
        console.log('[DoubleClick] Cannot enter edit mode:', {
          maskExists: !!mask,
          maskLocked: mask?.isLocked
        });
      }
    } else {
      console.log('[DoubleClick] Not a mask target:', {
        className: target.getClassName(),
        name: target.name(),
        id: target.id()
      });
      
      // TEST: Try to enter point editing mode on any target for debugging
      if (target.getClassName() === 'Stage') {
        console.log('[DoubleClick] TEST: Double-clicked on stage - checking for any masks');
        const { masks } = useMaskStore.getState();
        const maskIds = Object.keys(masks);
        if (maskIds.length > 0) {
          console.log('[DoubleClick] TEST: Found masks, trying to edit first one:', maskIds[0]);
          const { ENTER_POINT_EDITING } = useMaskStore.getState();
          ENTER_POINT_EDITING(maskIds[0]);
        } else {
          console.log('[DoubleClick] TEST: No masks found in store');
        }
      }
    }
  }, []);

  // Triple-click handler for move mode - using custom detection
  const handleTripleClick = useCallback((target: Konva.Node) => {
    console.log('[TripleClick] Custom detection triggered', {
      targetClass: target.getClassName(),
      targetName: target.name(),
      targetId: target.id()
    });
    
    // Check if we clicked on a mask
    const isMaskShape = target.getClassName() === 'Shape' && target.name()?.startsWith('mask-');
    const isMaskLine = target.getClassName() === 'Line' && target.name()?.startsWith('mask-');
    
    if (isMaskShape || isMaskLine) {
      // Try multiple ways to get the mask ID
      let maskId = target.name()?.replace('mask-', '');
      if (!maskId) {
        maskId = getMaskIdFromTarget(target);
      }
      if (!maskId) {
        maskId = target.id();
      }
      
      if (maskId) {
        const { masks, pointEditingMode, ENTER_MOVE_MODE, EXIT_MOVE_MODE, moveState } = useMaskStore.getState();
        const mask = masks[maskId];
        
        // Don't allow move mode if in point editing mode or mask is locked
        if (pointEditingMode || mask?.isLocked) {
          console.log('[TripleClick] Cannot enter move mode - point editing or locked mask', {
            pointEditingMode,
            maskLocked: mask?.isLocked
          });
          return;
        }
        
        // Toggle move mode
        if (moveState.isMoveMode && moveState.moveModeMaskId === maskId) {
          console.log('[TripleClick] Exiting move mode for mask:', maskId);
          EXIT_MOVE_MODE();
        } else {
          console.log('[TripleClick] Entering move mode for mask:', maskId);
          ENTER_MOVE_MODE(maskId);
        }
      }
    } else {
      console.log('[TripleClick] Not a mask target:', {
        className: target.getClassName(),
        name: target.name(),
        id: target.id()
      });
    }
  }, [getMaskIdFromTarget]);

  // Handle escape key to exit point editing and grid controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('[ESC Key] ESC pressed, checking modes');
        const { pointEditingMode, EXIT_POINT_EDITING, moveState, EXIT_MOVE_MODE } = useMaskStore.getState();
        console.log('[ESC Key] Current state', {
          pointEditingMode,
          moveStateIsMoveMode: moveState.isMoveMode
        });
        
        if (pointEditingMode) {
          console.log('[ESC Key] Exiting point editing mode');
          EXIT_POINT_EDITING();
        } else if (moveState.isMoveMode) {
          console.log('[ESC Key] Exiting move mode');
          EXIT_MOVE_MODE();
        } else {
          console.log('[ESC Key] No active mode to exit');
        }
      } else if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        // Toggle grid visibility with 'G' key
        dispatch({ type: 'TOGGLE_GRID_VISIBILITY' });
      } else if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        // Toggle grid snapping with 'S' key
        dispatch({ type: 'TOGGLE_GRID_SNAPPING' });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  // Centralized stage handler with event delegation
  const handleStageMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Don't interfere with double-click events
    if (e.evt.detail === 2) {
      console.log('[MouseDown] Skipping - double-click detected');
      return;
    }
    
    const target = e.target as Konva.Node;
    
    // Don't interfere with point editing mode for mask-level interactions
    const { pointEditingMode } = useMaskStore.getState();
    if (pointEditingMode) {
      // Allow button interactions (move/rotate buttons) but prevent mask interactions
      const isButtonClick = target.getClassName() === 'Circle' && 
                           (target.name()?.includes('move-button') || target.name()?.includes('rotate-button'));
      
      if (!isButtonClick) {
        console.log('[MouseDown] Skipping - point editing mode active (not a button)');
        return;
      }
      
      console.log('[MouseDown] Allowing button interaction in point editing mode');
    }
    
    // Detect device type for adaptive sensitivity
    const pointerType = (e.evt as any).pointerType || 'mouse';
    if (pointerType !== lastPointerTypeRef.current) {
      lastPointerTypeRef.current = pointerType;
      
      // Map pointer types to our device categories
      if (pointerType === 'touch') {
        deviceTypeRef.current = 'touch';
      } else if (pointerType === 'pen' || pointerType === 'mouse') {
        // Enhanced trackpad detection using navigator API
        const isTrackpad = (navigator as any).userAgentData?.mobile === false && 
                          (navigator as any).userAgentData?.platform === 'macOS' ||
                          /Mac|Trackpad/i.test(navigator.userAgent);
        
        deviceTypeRef.current = isTrackpad ? 'trackpad' : 'mouse';
      } else {
        deviceTypeRef.current = 'mouse';
      }
      
      console.log('[DeviceDetection] Detected device type:', deviceTypeRef.current, 'from pointer type:', pointerType);
    }

    // Check if this is a control button click - if so, don't interfere
    let isButtonClick = false;
    let currentTarget = target;
    while (currentTarget) {
      if (currentTarget.getAttr('isControlButton') === true) {
        isButtonClick = true;
        console.log('[Stage:mousedown] Control button click detected, not interfering', {
          buttonType: currentTarget.getAttr('buttonType'),
          targetClass: target.getClassName()
        });
        break;
      }
      currentTarget = currentTarget.getParent();
    }

    if (isButtonClick) {
      return; // Don't process button clicks in stage handler
    }

    // Simple triple-click detection
    const clickCounter = clickCounterRef.current;
    const now = Date.now();
    
    // Clear any existing timer
    if (clickCounter.timer) {
      clearTimeout(clickCounter.timer);
    }
    
    // Check if this is the same target as the last click and within 400ms
    if (clickCounter.lastTarget === target && (now - clickCounter.lastTime) < 400) {
      clickCounter.count++;
      clickCounter.lastTime = now;
    } else {
      clickCounter.count = 1;
      clickCounter.lastTarget = target;
      clickCounter.lastTime = now;
    }
    
    // Set timer to check for triple-click after double-click has had time to fire
    // Increased delay to ensure double-click events are not interfered with
    clickCounter.timer = setTimeout(() => {
      if (clickCounter.count >= 3) {
        console.log('[TripleClick] Detected via timer');
        handleTripleClick(target);
      }
      clickCounter.count = 0;
      clickCounter.lastTarget = null;
    }, 800); // Increased delay to avoid interfering with double-click

    // Get fresh calibration mode state to avoid stale closures
    const currentCalibrationMode = useEditorStore.getState().calibrationMode;

    // Debug instrumentation (temporary)
    console.log('[Stage:mousedown]', {
      targetClass: target.getClassName(),
      targetName: target.name(),
      targetId: target.id(),
      eventTargetChain: getEventTargetChain(target),
      assetPlaceMode: assetPlaceMode,
      calibrationMode: calibrationMode,
      currentCalibrationMode: currentCalibrationMode,
      camera: { panX: camera.panX, panY: camera.panY, scale: camera.scale }
    });
    
    // Phase 0: Check if we're in calibration mode (use fresh state)
    if (currentCalibrationMode) {
      console.log('[Calibration] Click detected in calibration mode');
      console.log('[Calibration] Current photoSpace scale:', photoSpace?.scale);
      console.log('[Calibration] Calibration mode from store:', calibrationMode);

      // Get click position in image space
      const stage = e.target.getStage();
      const pointerPosition = stage.getPointerPosition();
      if (!pointerPosition) {
        console.log('[Calibration] No pointer position available');
        return;
      }

      // Convert stage coordinates to image coordinates using the same logic as mask drawing
      const imagePos = screenToImageLocal(pointerPosition.x, pointerPosition.y);

      console.log('[Calibration] Coordinate conversion:', {
        pointerPosition,
        camera: { panX: camera.panX, panY: camera.panY, scale: camera.scale },
        imgFit: { originX: imgFit.originX, originY: imgFit.originY, imgScale: imgFit.imgScale },
        imagePos,
        photoSpaceScale: photoSpace?.scale
      });

      // Additional debugging: verify the conversion by converting back to screen coordinates
      const backToScreen = {
        x: imagePos.x * imgFit.imgScale + imgFit.originX,
        y: imagePos.y * imgFit.imgScale + imgFit.originY
      };
      
      console.log('[Calibration] Round-trip conversion check:', {
        originalScreen: pointerPosition,
        imageCoordinates: imagePos,
        backToScreen,
        offset: {
          x: pointerPosition.x - backToScreen.x,
          y: pointerPosition.y - backToScreen.y
        }
      });

      // Dispatch calibration measurement point event
      const event = new CustomEvent('calibration-measurement-point', {
        detail: imagePos
      });
      console.log('[Calibration] Dispatching measurement point event with data:', imagePos);
      window.dispatchEvent(event);
      console.log('[Calibration] Event dispatched successfully');

      // Still allow deselection in calibration mode if clicking on background
      // Check if we clicked on a mask/asset first
      const maskId = getMaskIdFromTarget(target);
      if (!maskId) {
        // Background click - deselect all
        console.log('[DeselectAll] Background click in calibration mode');
        deselectAll();
      }
      
      return; // Don't process other events in calibration mode
    }
    
    // Phase 1: Check if we're in asset place mode
    if (assetPlaceMode) {
      console.log('[AssetPlacement] Click detected in place mode:', assetPlaceMode.defId);
      
      // Get click position in image space
      const stage = e.target.getStage();
      const pointerPosition = stage.getPointerPosition();
      if (!pointerPosition) return;
      
      // Convert stage coordinates to image coordinates
      const imagePos = {
        x: (pointerPosition.x - camera.panX) / camera.scale,
        y: (pointerPosition.y - camera.panY) / camera.scale
      };
      
      console.log('[AssetPlacement] Image position:', imagePos);
      
      // Create new asset
      const newAsset = {
        id: `asset_${Date.now()}`,
        defId: assetPlaceMode.defId,
        x: imagePos.x,
        y: imagePos.y,
        scale: 1.0,
        rotation: 0,
        opacity: 1.0,
        createdAt: Date.now(),
        settings: {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          hue: 0,
          blur: 0,
          shadow: {
            enabled: false,
            offsetX: 2,
            offsetY: 2,
            blur: 5,
            opacity: 0.3
          }
        }
      };
      
      // Add the asset
      dispatch({ type: 'ADD_ASSET', payload: newAsset });
      
      // Clear place mode
      dispatch({ type: 'SET_ASSET_PLACE_MODE', payload: null });
      
      // Reset cursor
      document.body.style.cursor = 'default';
      
      console.log('[AssetPlacement] Asset placed:', newAsset.id);
      return; // Exit early - asset placement handled
    }
    
    // Phase 1: Check if this is a control point click (don't deselect)
    // Enhanced control point detection
    const isControlPoint = target.getClassName() === 'Circle' && 
                          (target.getParent()?.getClassName() === 'Group' || 
                           target.name()?.includes('control-point') ||
                           target.getParent()?.name()?.includes('control-point'));
    
    if (isControlPoint) {
      console.log('[ControlPoint] Click detected on control point, not deselecting', {
        targetClass: target.getClassName(),
        targetName: target.name(),
        parentClass: target.getParent()?.getClassName(),
        parentName: target.getParent()?.name()
      });
      return; // Let the control point handle its own events
    }
    
    // Phase 2: Check if this is a mask click (unified for masks and assets)
    const maskId = getMaskIdFromTarget(target);
    if (maskId) {
      const isAsset = maskId.startsWith('asset_');
      const { pointEditingMode, editingMaskId, masks, moveState, START_MOVE_DRAG, EXIT_MOVE_MODE } = useMaskStore.getState();
      const mask = masks[maskId];
      
      // Special handling for point editing mode
      if (pointEditingMode && editingMaskId === maskId) {
        // If we're in point editing mode for this mask, only allow control point interactions
        // If it's not a control point, treat it as a background click
        if (!isControlPoint) {
          console.log('[PointEditing] Non-control-point click in edit mode - treating as background click', {
            targetClass: target.getClassName(),
            targetName: target.name(),
            maskId
          });
          // Fall through to background click handling
        } else {
          console.log('[PointEditing] Control point click in edit mode - allowing');
          return;
        }
      } else {
        // Normal mask click handling
        // Don't allow moving if in point editing mode or mask is locked
        if (pointEditingMode || mask?.isLocked) {
          console.log('[MaskClick] Skipping move mode - point editing mode or locked mask', {
            pointEditingMode,
            editingMaskId,
            maskLocked: mask?.isLocked
          });
          handleUnifiedSelect(maskId);
          return;
        }
      }
      
      // Check if we're in move mode for this mask
      if (moveState.isMoveMode && moveState.moveModeMaskId === maskId) {
        // Start move mode dragging
        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();
        if (!pointerPosition) return;
        
        // Convert screen coordinates to image coordinates
        const imagePos = screenToImageLocal(pointerPosition.x, pointerPosition.y);
        
        console.log('[MaskClick] Starting move mode drag for mask:', maskId);
        START_MOVE_DRAG(maskId, imagePos);
        return;
      } else if (moveState.isMoveMode) {
        // In move mode for different mask - exit move mode first
        console.log('[MaskClick] Exiting move mode for different mask');
        EXIT_MOVE_MODE();
      }
      
      // Simple selection - no move mode activation on single click
      console.log('[MaskClick] Selecting mask:', { maskId, isAsset });
      handleUnifiedSelect(maskId);
      return;
    }
    
    // Phase 3: If not mask/asset/control point click, deselect all and exit move/rotate mode
    console.log('[BackgroundClick] Detected background click', {
      targetClass: target.getClassName(),
      targetName: target.name(),
      targetId: target.id(),
      isControlPoint,
      maskId: getMaskIdFromTarget(target)
    });
    
    const { moveState, rotateState, EXIT_MOVE_MODE, EXIT_ROTATE_MODE } = useMaskStore.getState();
    if (moveState.isMoveMode) {
      console.log('[BackgroundClick] Exiting move mode');
      EXIT_MOVE_MODE();
    }
    if (rotateState.isRotateMode) {
      console.log('[BackgroundClick] Exiting rotate mode');
      EXIT_ROTATE_MODE();
    }
    
    console.log('[DeselectAll]', { 
      reason: 'background-click',
      selectionRoute: 'background',
      transformerAttached: false,
      pointEditingMode: useMaskStore.getState().pointEditingMode,
      editingMaskId: useMaskStore.getState().editingMaskId
    });
    deselectAll();
  }, [getMaskIdFromTarget, handleUnifiedSelect, assetPlaceMode, camera, dispatch, handleTripleClick]);

  // Handle mouse move for move mode and rotate mode drag operations
  const handleStageMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Don't interfere with point editing mode for mask-level interactions
    const { pointEditingMode, moveState, rotateState } = useMaskStore.getState();
    if (pointEditingMode) {
      // Allow move/rotate drag operations if they're already in progress
      if (!moveState.isDragging && !rotateState.isDragging) {
        return;
      }
      console.log('[MouseMove] Allowing move/rotate drag in point editing mode');
    }
    
    // RAF throttling to prevent excessive updates
    if (mouseMoveLockRef.current) return;
    mouseMoveLockRef.current = true;
    
    requestAnimationFrame(() => {
      mouseMoveLockRef.current = false;
      
      // Enhanced trackpad detection based on movement patterns
      const now = performance.now();
      const timeSinceLastMove = now - lastMoveTimeRef.current;
      lastMoveTimeRef.current = now;
      
      // Track movement frequency and magnitude for trackpad detection
      if (timeSinceLastMove > 0 && timeSinceLastMove < 50) { // High frequency movements
        movementHistoryRef.current.push(timeSinceLastMove);
        if (movementHistoryRef.current.length > 10) {
          movementHistoryRef.current.shift();
        }
        
        // If we have enough samples and high frequency, likely trackpad
        if (movementHistoryRef.current.length >= 5) {
          const avgInterval = movementHistoryRef.current.reduce((a, b) => a + b, 0) / movementHistoryRef.current.length;
          if (avgInterval < 20 && deviceTypeRef.current === 'mouse') { // High frequency = trackpad
            deviceTypeRef.current = 'trackpad';
            console.log('[DeviceDetection] Refined to trackpad based on movement pattern');
          }
        }
      }
      
      const { moveState, rotateState, UPDATE_MOVE_DRAG, UPDATE_ROTATE_DRAG, masks } = useMaskStore.getState();
      
      const stage = e.target.getStage();
      const pointerPosition = stage.getPointerPosition();
      if (!pointerPosition) return;
    
    // Handle move mode dragging
    if (moveState.isDragging && moveState.moveModeMaskId && moveState.dragStartPos) {
      // Convert screen coordinates to image coordinates
      const currentImagePos = screenToImageLocal(pointerPosition.x, pointerPosition.y);
      
      // Calculate delta from start position (this should be the movement since drag started)
      const delta = {
        x: currentImagePos.x - moveState.dragStartPos.x,
        y: currentImagePos.y - moveState.dragStartPos.y
      };
      
      // Only log in development mode and throttle to avoid performance impact
      if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
        console.log('[MoveDrag]', { 
          maskId: moveState.moveModeMaskId, 
          delta, 
          currentPos: currentImagePos,
          startPos: moveState.dragStartPos
        });
      }
      
      // Update mask position
      UPDATE_MOVE_DRAG(moveState.moveModeMaskId, delta);
    }
    
    // Handle rotate mode dragging
    if (rotateState.isDragging && rotateState.rotateModeMaskId && rotateState.dragStartAngle !== null) {
      const mask = masks[rotateState.rotateModeMaskId];
      if (!mask) return;
      
      // Calculate mask center in screen coordinates
      const maskCenter = {
        x: mask.pts.reduce((sum, pt) => sum + pt.x, 0) / mask.pts.length,
        y: mask.pts.reduce((sum, pt) => sum + pt.y, 0) / mask.pts.length
      };
      
      // Apply position offset to center
      const positionOffset = mask.position || { x: 0, y: 0 };
      const offsetCenter = {
        x: maskCenter.x + positionOffset.x,
        y: maskCenter.y + positionOffset.y
      };
      
      // Convert center to screen coordinates
      const screenCenter = {
        x: offsetCenter.x * imgFit.imgScale + imgFit.originX,
        y: offsetCenter.y * imgFit.imgScale + imgFit.originY
      };
      
      // Calculate current angle from center to pointer
      const dx = pointerPosition.x - screenCenter.x;
      const dy = pointerPosition.y - screenCenter.y;
      const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      
      // Calculate delta angle with improved smoothness
      let deltaAngle = currentAngle - rotateState.dragStartAngle;
      
      // Normalize angle to prevent jumps across 0/360 boundary
      if (deltaAngle > 180) deltaAngle -= 360;
      if (deltaAngle < -180) deltaAngle += 360;
      
      // Apply device-adaptive smoothing based on distance from center
      const distanceSquared = dx * dx + dy * dy;
      const distanceFromCenter = Math.sqrt(distanceSquared);
      
      // Get device-specific settings
      const settings = getDeviceSettings();
      let smoothingFactor = settings.maxSmoothingFactor;
      
      if (distanceFromCenter < settings.minDistance) {
        smoothingFactor = settings.minSmoothingFactor;
      } else if (distanceFromCenter < settings.maxDistance) {
        // Use linear interpolation between min and max smoothing
        const ratio = (distanceFromCenter - settings.minDistance) / (settings.maxDistance - settings.minDistance);
        smoothingFactor = settings.minSmoothingFactor + 
          (settings.maxSmoothingFactor - settings.minSmoothingFactor) * ratio;
      }
      
      // Apply device-adaptive smoothing and rotation cap
      const adjustedDeltaAngle = deltaAngle * smoothingFactor * settings.sensitivityMultiplier;
      const smoothedDeltaAngle = Math.max(-settings.maxRotationPerFrame, 
        Math.min(settings.maxRotationPerFrame, adjustedDeltaAngle));
      
      // Only log in development mode and throttle to avoid performance impact
      if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
        console.log('[RotateDrag]', { 
          maskId: rotateState.rotateModeMaskId, 
          deltaAngle: smoothedDeltaAngle, 
          currentAngle,
          startAngle: rotateState.dragStartAngle,
          rawDelta: deltaAngle
        });
      }
      
      // Update mask rotation with smoothed delta
      UPDATE_ROTATE_DRAG(rotateState.rotateModeMaskId, smoothedDeltaAngle);
    }
    });
  }, [screenToImageLocal, imgFit]);

  // Handle mouse up for move mode and rotate mode drag operations
  const handleStageMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Don't interfere with point editing mode for mask-level interactions
    const { pointEditingMode, moveState, rotateState, END_MOVE_DRAG, END_ROTATE_DRAG } = useMaskStore.getState();
    if (pointEditingMode) {
      // Allow move/rotate drag operations to complete
      if (moveState.isDragging && moveState.moveModeMaskId) {
        console.log('[MoveDragEnd]', { maskId: moveState.moveModeMaskId });
        END_MOVE_DRAG(moveState.moveModeMaskId);
      }
      
      if (rotateState.isDragging && rotateState.rotateModeMaskId) {
        console.log('[RotateDragEnd]', { maskId: rotateState.rotateModeMaskId });
        END_ROTATE_DRAG(rotateState.rotateModeMaskId);
      }
      
      return; // Don't process other mouse up events in point editing mode
    }
    
    const { END_MOVE_DRAG: END_MOVE_DRAG_FALLBACK, END_ROTATE_DRAG: END_ROTATE_DRAG_FALLBACK } = useMaskStore.getState();
    
    if (moveState.isDragging && moveState.moveModeMaskId) {
      console.log('[MoveDragEnd]', { maskId: moveState.moveModeMaskId });
      END_MOVE_DRAG(moveState.moveModeMaskId);
    }
    
    if (rotateState.isDragging && rotateState.rotateModeMaskId) {
      console.log('[RotateDragEnd]', { maskId: rotateState.rotateModeMaskId });
      END_ROTATE_DRAG(rotateState.rotateModeMaskId);
    }
  }, []);

  // Update stage size when viewport changes
  useEffect(() => {
    const updateSize = () => {
      if (viewportRef.current && stageRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        stageRef.current.size({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <div
      ref={viewportRef}
      data-canvas="konva"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%'
      }}
    >
      <Stage
        ref={stageRef}
        width={viewportRef.current?.getBoundingClientRect().width || 800}
        height={viewportRef.current?.getBoundingClientRect().height || 600}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onDblClick={handleStageDoubleClick}
        style={{ background: 'transparent' }}
      >
        <Layer name="world">
          <WorldGroup camera={camera} imgFit={imgFit}>
            <MaskDraftLayer draft={draft} imgFit={imgFit} />
            {/* Regular Masks */}
            <MaskPolygonsLayer
              masks={regularMasks.reduce((acc, mask) => {
                acc[mask.id] = mask;
                return acc;
              }, {} as Record<string, any>)}
              selectedId={selectedId}
              onSelect={handleUnifiedSelect}
              imgFit={imgFit}
            />

            {/* Control Points for Point Editing */}
            {regularMasks.map(mask => (
              <MaskControlPoints
                key={`control-points-${mask.id}`}
                mask={mask}
                imgFit={imgFit}
              />
            ))}

            {/* Grid Overlay for Point Editing */}
            <GridOverlay imgFit={imgFit} photoSpace={photoSpace} />

            {/* Calibration Mode Overlay */}
            {calibrationMode && (
              <Group name="calibration-overlay">
                {/* Semi-transparent overlay to indicate calibration mode */}
                <Rect
                  x={0}
                  y={0}
                  width={imgFit.originX + imgFit.imgScale * (photoSpace?.imgW || 0)}
                  height={imgFit.originY + imgFit.imgScale * (photoSpace?.imgH || 0)}
                  fill="rgba(59, 130, 246, 0.1)"
                  stroke="rgba(59, 130, 246, 0.3)"
                  strokeWidth={2}
                  dash={[10, 5]}
                />
                {/* Corner indicators */}
                <Rect x={0} y={0} width={20} height={20} fill="rgba(59, 130, 246, 0.2)" stroke="rgb(59, 130, 246)" strokeWidth={2} />
                <Rect x={imgFit.originX + imgFit.imgScale * (photoSpace?.imgW || 0) - 20} y={0} width={20} height={20} fill="rgba(59, 130, 246, 0.2)" stroke="rgb(59, 130, 246)" strokeWidth={2} />
                <Rect x={0} y={imgFit.originY + imgFit.imgScale * (photoSpace?.imgH || 0) - 20} width={20} height={20} fill="rgba(59, 130, 246, 0.2)" stroke="rgb(59, 130, 246)" strokeWidth={2} />
                <Rect x={imgFit.originX + imgFit.imgScale * (photoSpace?.imgW || 0) - 20} y={imgFit.originY + imgFit.imgScale * (photoSpace?.imgH || 0) - 20} width={20} height={20} fill="rgba(59, 130, 246, 0.2)" stroke="rgb(59, 130, 246)" strokeWidth={2} />
                
                {/* Calibration measurement line */}
                {calibrationPoints.length > 0 && (
                  <>
                    {/* Draw points */}
                    {calibrationPoints.map((point, index) => {
                      // Convert image coordinates to screen coordinates for rendering
                      const screenX = point.x * imgFit.imgScale + imgFit.originX;
                      const screenY = point.y * imgFit.imgScale + imgFit.originY;
                      
                      console.log('[CalibrationRender] Point conversion:', {
                        imagePoint: point,
                        screenPoint: { x: screenX, y: screenY },
                        imgFit: { originX: imgFit.originX, originY: imgFit.originY, imgScale: imgFit.imgScale }
                      });
                      
                      return (
                        <Circle
                          key={`cal-point-${index}`}
                          x={screenX}
                          y={screenY}
                          radius={6}
                          fill="rgb(59, 130, 246)"
                          stroke="white"
                          strokeWidth={2}
                        />
                      );
                    })}
                    
                    {/* Draw line between points */}
                    {calibrationPoints.length === 2 && (
                      <Line
                        points={[
                          calibrationPoints[0].x * imgFit.imgScale + imgFit.originX,
                          calibrationPoints[0].y * imgFit.imgScale + imgFit.originY,
                          calibrationPoints[1].x * imgFit.imgScale + imgFit.originX,
                          calibrationPoints[1].y * imgFit.imgScale + imgFit.originY
                        ]}
                        stroke="rgb(59, 130, 246)"
                        strokeWidth={3}
                        dash={[5, 5]}
                      />
                    )}
                  </>
                )}
              </Group>
            )}
            {/* New Assets Layer */}
            <AssetsLayerKonva
              assets={assets}
              selectedId={selectedAssetId}
              onSelect={(assetId) => {
                dispatch({ type: 'SET_SELECTED_ASSET', payload: assetId });
              }}
            />
            {/* Asset Masks - rendered as masks */}
            {isAssetsEnabled() && (
            <AssetMasksLayer
              assetMasks={assetMasks}
              selectedId={selectedId}
              onSelect={handleUnifiedSelect}
              imgFit={imgFit}
            />
            )}
            <MaskTextureLayer 
              stageScale={camera.scale}
              imgFit={imgFit}
              onSelect={handleUnifiedSelect}
            />
          </WorldGroup>
        </Layer>
      </Stage>
    </div>
  );
}
