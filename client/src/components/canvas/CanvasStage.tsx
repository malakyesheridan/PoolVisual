/**
 * Canvas Stage Component - Main Konva Stage for pool photo editing
 * Uses InputRouter for clean tool event dispatch
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';

// A. AUDIT BANNER - Console banner to verify this is the mounted Canvas
const BUILD_TIMESTAMP = new Date().toISOString();
const RANDOM_ID = Math.random().toString(36).substring(2, 8);
console.log(`
🎯 MOUNTED CANVAS AUDIT
======================
File: client/src/components/canvas/CanvasStage.tsx
Build: ${BUILD_TIMESTAMP}
ID: ${RANDOM_ID}
======================
`);
import { Stage, Layer, Rect, Image } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { Stage as StageType } from 'konva/lib/Stage';
import useImage from 'use-image';
import { useEditorStore } from '@/stores/editorSlice';
import { CalibrationCanvasLayer } from './CalibrationCanvasLayer';
import { MaskCanvasLayer } from './MaskCanvasLayer';
import { InputRouter } from '@/editor/input/InputRouter';
import { CalibrationController } from '@/editor/input/controllers/CalibrationController';
import { AreaController } from '@/editor/input/controllers/AreaController';
import { LinearController } from '@/editor/input/controllers/LinearController';
import { WaterlineController } from '@/editor/input/controllers/WaterlineController';
import { EraserController } from '@/editor/input/controllers/EraserController';
import { HandController } from '@/editor/input/controllers/HandController';
import { isCalibrationActive } from '@/utils/calibrationHelpers';
import type { Vec2 } from '@shared/schema';

interface CanvasStageProps {
  className?: string;
  width?: number;
  height?: number;
}

export function CanvasStage({ className, width = 800, height = 600 }: CanvasStageProps) {
  console.info('[CanvasStage] mounted from:', import.meta?.url || 'CanvasStage.tsx');
  
  const stageRef = useRef<StageType>(null);
  const [stageDimensions, setStageDimensions] = useState({ width, height });

  const store = useEditorStore();
  const { photo, zoom, pan, calState, activeTool } = store;

  // B. INPUT ROUTER: ONLY CALIBRATION-ACTIVE STATES TAKE EVENTS  
  const getActive = () => {
    return (calState === 'placingA' || calState === 'placingB' || calState === 'lengthEntry') 
      ? 'calibration' 
      : activeTool;
  };
  const activeController = getActive();

  // Create input router with tool controllers
  const router = useMemo(() => {
    return new InputRouter(
      getActive,
      {
        calibration: new CalibrationController(store),
        area: new AreaController(store),
        linear: new LinearController(store),
        waterline: new WaterlineController(store),
        eraser: new EraserController(store),
        hand: new HandController(store),
      }
    );
  }, [store]);

  const [backgroundImage] = useImage(photo?.originalUrl || '', 'anonymous');

  // Update stage dimensions
  useEffect(() => {
    const updateStageDimensions = () => {
      if (width && height) {
        setStageDimensions({ width, height });
      }
    };

    updateStageDimensions();
    window.addEventListener('resize', updateStageDimensions);
    return () => window.removeEventListener('resize', updateStageDimensions);
  }, [width, height]);

  // D. STAGE DRAG + HAND TOOL - Only draggable when hand tool is active
  const setStageDraggable = useCallback((stage: StageType | null, tool: string) => {
    if (!stage) return;
    const isDraggable = tool === 'hand' && !(calState === 'placingA' || calState === 'placingB' || calState === 'lengthEntry');
    stage.draggable(isDraggable);
  }, [calState]);

  useEffect(() => {
    setStageDraggable(stageRef.current, activeController);
  }, [activeController, setStageDraggable]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't interfere with input fields
      }

      const key = e.key.toLowerCase();
      
      // Tool switching shortcuts
      switch (key) {
        case 'c':
          e.preventDefault();
          store.cancelAllTransient(); // C. Clean transitions
          store.startCalibration();
          break;
        case 'a':
          e.preventDefault();
          store.cancelAllTransient();
          store.setActiveTool('area');
          break;
        case 'l':
          e.preventDefault();
          store.cancelAllTransient();
          store.setActiveTool('linear');
          break;
        case 'w':
          e.preventDefault();
          store.cancelAllTransient();
          store.setActiveTool('waterline');
          break;
        case 'e':
          e.preventDefault();
          store.cancelAllTransient();
          store.setActiveTool('eraser');
          break;
        case 'h':
          e.preventDefault();
          store.cancelAllTransient();
          store.setActiveTool('hand');
          break;
        case 'enter':
          // Check if input is focused
          const el = document.activeElement;
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLInputElement).isContentEditable)) {
            return;
          }
          
          e.preventDefault();
          if (store.calState === 'lengthEntry') {
            store.commitCalSample();
          } else if (store.transient) {
            store.commitPath();
          }
          break;
          
        case 'escape':
          e.preventDefault();
          if (store.calState !== 'idle') {
            store.cancelCalibration();
          } else if (store.transient) {
            store.cancelPath();
          }
          break;
          
        default:
          // Let the router handle other keys
          if (router.handleKey(key, e)) {
            e.preventDefault();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, store, calState]);

  // Calculate image positioning
  const imageProps = useMemo(() => {
    if (!backgroundImage) return null;

    const imageAspect = backgroundImage.width / backgroundImage.height;
    const stageAspect = stageDimensions.width / stageDimensions.height;

    let imageWidth, imageHeight;
    if (imageAspect > stageAspect) {
      imageWidth = stageDimensions.width;
      imageHeight = stageDimensions.width / imageAspect;
    } else {
      imageWidth = stageDimensions.height * imageAspect;
      imageHeight = stageDimensions.height;
    }

    return {
      width: imageWidth,
      height: imageHeight,
      x: (stageDimensions.width - imageWidth) / 2 + pan.x,
      y: (stageDimensions.height - imageHeight) / 2 + pan.y,
      scaleX: zoom,
      scaleY: zoom,
    };
  }, [backgroundImage, stageDimensions, pan, zoom]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    
    const scaleBy = 1.02;
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = zoom;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - pan.x) / oldScale,
      y: (pointer.y - pan.y) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const finalScale = Math.max(0.1, Math.min(5, newScale));

    const newPos = {
      x: pointer.x - mousePointTo.x * finalScale,
      y: pointer.y - mousePointTo.y * finalScale,
    };

    store.setZoom(finalScale);
    store.setPan(newPos);
  }, [zoom, pan, store]);

  return (
    <div 
      className={className} 
      style={{ 
        width: '100%', 
        height: '100%',
        overflow: 'hidden',
        cursor: router.getCursor(),
        position: 'relative'
      }}
    >
      <Stage
        ref={stageRef}
        width={stageDimensions.width}
        height={stageDimensions.height}
        onMouseDown={(e) => router.handleDown(stageRef.current!, e)}
        onMouseMove={(e) => router.handleMove(stageRef.current!, e)}
        onMouseUp={(e) => router.handleUp(stageRef.current!, e)}
        onTouchStart={(e) => router.handleDown(stageRef.current!, e)}
        onTouchMove={(e) => router.handleMove(stageRef.current!, e)}
        onTouchEnd={(e) => router.handleUp(stageRef.current!, e)}
        onWheel={handleWheel}
        data-testid="canvas-stage"
      >
        {/* Background Layer - not listening */}
        <Layer listening={false}>
          {/* Canvas Background */}
          <Rect
            x={0}
            y={0}
            width={stageDimensions.width}
            height={stageDimensions.height}
            fill="#f8f9fa"
          />
          
          {/* Background Image */}
          {backgroundImage && imageProps && (
            <Image
              image={backgroundImage}
              {...imageProps}
            />
          )}
        </Layer>

        {/* Mask Layer - area/linear/waterline masks, listening */}
        <MaskCanvasLayer />

        {/* Calibration Layer - anchors and lines, listening */}
        <CalibrationCanvasLayer />

        {/* HUD Layer - cursor guides, not listening */}
        <Layer listening={false}>
          {/* Future: drawing layer, cursor guides */}
        </Layer>
      </Stage>
    </div>
  );
}