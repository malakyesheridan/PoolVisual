/**
 * Enhanced Canvas Stage Component
 * Production-ready Konva.js implementation with full functionality
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Group, Rect, Line } from 'react-konva';
import { Stage as StageType } from 'konva/lib/Stage';
import { KonvaEventObject } from 'konva/lib/Node';
import useImage from 'use-image';
import { Vec2 } from '@shared/schema';
import { useEditorStore } from '@/stores/editorSlice';

interface CanvasStageProps {
  className?: string;
  onStageRef?: (stage: StageType | null) => void;
}

export function CanvasStage({ className, onStageRef }: CanvasStageProps) {
  const stageRef = useRef<StageType>(null);
  const [stageDimensions, setStageDimensions] = useState({ width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPointerPosition, setLastPointerPosition] = useState<Vec2 | null>(null);

  const {
    photo,
    editorState,
    masks,
    selectedMaskId,
    currentDrawing,
    setZoom,
    setPan,
    startDrawing,
    addPoint,
    finishDrawing,
    selectMask,
    eraseFromSelected
  } = useEditorStore();

  const [backgroundImage] = useImage(photo?.originalUrl || '', 'anonymous');

  // Update stage dimensions
  useEffect(() => {
    const updateStageDimensions = () => {
      const container = stageRef.current?.container();
      if (container) {
        const { clientWidth, clientHeight } = container;
        setStageDimensions({ width: clientWidth, height: clientHeight });
      }
    };

    updateStageDimensions();
    window.addEventListener('resize', updateStageDimensions);
    return () => window.removeEventListener('resize', updateStageDimensions);
  }, []);

  // Pass stage ref to parent
  useEffect(() => {
    onStageRef?.(stageRef.current);
  }, [onStageRef]);

  // Calculate image dimensions and positioning
  const imageProps = backgroundImage && photo ? (() => {
    const imageAspect = backgroundImage.width / backgroundImage.height;
    const stageAspect = stageDimensions.width / stageDimensions.height;
    
    let displayWidth = backgroundImage.width;
    let displayHeight = backgroundImage.height;
    
    // Fit image to stage while maintaining aspect ratio - fit to screen
    const maxScale = 0.8; // Use 80% of available space
    if (imageAspect > stageAspect) {
      displayWidth = stageDimensions.width * maxScale;
      displayHeight = displayWidth / imageAspect;
    } else {
      displayHeight = stageDimensions.height * maxScale;
      displayWidth = displayHeight * imageAspect;
    }
    
    // Center the image and apply zoom/pan
    const centerX = stageDimensions.width / 2;
    const centerY = stageDimensions.height / 2;
    
    return {
      image: backgroundImage,
      width: displayWidth,
      height: displayHeight,
      x: centerX - (displayWidth * editorState.zoom) / 2 + editorState.pan.x,
      y: centerY - (displayHeight * editorState.zoom) / 2 + editorState.pan.y,
      scaleX: editorState.zoom,
      scaleY: editorState.zoom
    };
  })() : null;

  // Canvas interaction handlers
  const getPointerPosition = useCallback((): Vec2 | null => {
    const stage = stageRef.current;
    if (!stage || !imageProps) return null;
    
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    
    // Convert stage coordinates to image coordinates
    const imageX = (pos.x - imageProps.x) / editorState.zoom;
    const imageY = (pos.y - imageProps.y) / editorState.zoom;
    
    return {
      x: imageX,
      y: imageY
    };
  }, [imageProps, editorState.zoom]);

  const handleStageMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!backgroundImage) return;

    const clickedOnEmpty = e.target === e.target.getStage();
    const pos = getPointerPosition();
    if (!pos) return;

    // Handle different tools
    switch (editorState.activeTool) {
      case 'hand':
        if (clickedOnEmpty) {
          setIsPanning(true);
          setLastPointerPosition(pos);
        }
        break;
        
      case 'area':
      case 'linear':
      case 'waterline':
        if (clickedOnEmpty) {
          startDrawing(pos);
        }
        break;
        
      case 'eraser':
        // Eraser interaction is handled in mouse move
        break;
        
      default:
        break;
    }
  }, [
    backgroundImage,
    editorState.activeTool,
    getPointerPosition,
    startDrawing
  ]);

  const handleStageMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const pos = getPointerPosition();
    if (!pos) return;

    // Handle panning
    if (isPanning && lastPointerPosition) {
      const dx = pos.x - lastPointerPosition.x;
      const dy = pos.y - lastPointerPosition.y;
      setPan({
        x: editorState.pan.x + dx,
        y: editorState.pan.y + dy
      });
      setLastPointerPosition(pos);
      return;
    }

    // Handle drawing
    if (currentDrawing && ['area', 'linear', 'waterline', 'eraser'].includes(editorState.activeTool)) {
      addPoint(pos);
    }
  }, [
    isPanning,
    lastPointerPosition,
    currentDrawing,
    editorState.activeTool,
    editorState.pan,
    getPointerPosition,
    setPan,
    addPoint
  ]);

  const handleStageMouseUp = useCallback(() => {
    setIsPanning(false);
    setLastPointerPosition(null);

    // Finish drawing for area and linear tools
    if (currentDrawing && ['area', 'linear', 'waterline'].includes(editorState.activeTool)) {
      finishDrawing();
    }
  }, [
    currentDrawing,
    editorState.activeTool,
    finishDrawing
  ]);

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    
    const scaleBy = 1.02;
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = editorState.zoom;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - editorState.pan.x) / oldScale,
      y: (pointer.y - editorState.pan.y) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const finalScale = Math.max(0.1, Math.min(5, newScale));

    const newPos = {
      x: pointer.x - mousePointTo.x * finalScale,
      y: pointer.y - mousePointTo.y * finalScale,
    };

    setZoom(finalScale);
    setPan(newPos);
  }, [editorState.zoom, editorState.pan, setZoom, setPan]);

  return (
    <div 
      className={className} 
      style={{ 
        width: '100%', 
        height: '100%',
        overflow: 'hidden',
        cursor: editorState.activeTool === 'hand' ? 'grab' : 'crosshair'
      }}
    >
      <Stage
        ref={stageRef}
        width={stageDimensions.width}
        height={stageDimensions.height}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onWheel={handleWheel}
        draggable={false}
        data-testid="canvas-stage"
      >
        {/* Background Layer */}
        <Layer>
          {/* Canvas Background */}
          <Rect
            x={0}
            y={0}
            width={stageDimensions.width}
            height={stageDimensions.height}
            fill="#f8fafc"
          />
          
          {/* Background Image */}
          {imageProps && (
            <Group>
              <KonvaImage
                {...imageProps}
                listening={false}
              />
            </Group>
          )}
        </Layer>

        {/* Masks Layer */}
        <Layer>
          {imageProps && masks.length > 0 && (
            <Group
              x={imageProps.x}
              y={imageProps.y}
              scaleX={editorState.zoom}
              scaleY={editorState.zoom}
            >
              {/* Render all masks */}
              {masks.map(mask => {
                const isSelected = mask.id === selectedMaskId;
                
                if (mask.type === 'area') {
                  return (
                    <Line
                      key={mask.id}
                      points={mask.polygon.points.flatMap(p => [p.x, p.y])}
                      stroke={isSelected ? "#f59e0b" : "#3b82f6"}
                      strokeWidth={isSelected ? 3 : 2}
                      fill={`rgba(59, 130, 246, ${isSelected ? 0.2 : 0.1})`}
                      closed={true}
                      onClick={() => selectMask(mask.id)}
                      onTap={() => selectMask(mask.id)}
                    />
                  );
                } else if (mask.type === 'linear') {
                  return (
                    <Line
                      key={mask.id}
                      points={mask.polyline.points.flatMap(p => [p.x, p.y])}
                      stroke={isSelected ? "#f59e0b" : "#10b981"}
                      strokeWidth={isSelected ? 4 : 3}
                      lineCap="round"
                      lineJoin="round"
                      onClick={() => selectMask(mask.id)}
                      onTap={() => selectMask(mask.id)}
                    />
                  );
                } else if (mask.type === 'waterline_band') {
                  return (
                    <Line
                      key={mask.id}
                      points={mask.polyline.points.flatMap(p => [p.x, p.y])}
                      stroke={isSelected ? "#f59e0b" : "#8b5cf6"}
                      strokeWidth={isSelected ? 5 : 4}
                      lineCap="round"
                      lineJoin="round"
                      onClick={() => selectMask(mask.id)}
                      onTap={() => selectMask(mask.id)}
                    />
                  );
                }
                return null;
              })}
            </Group>
          )}
        </Layer>

        {/* Drawing Layer */}
        <Layer>
          {imageProps && currentDrawing && currentDrawing.length > 0 && (
            <Group
              x={imageProps.x}
              y={imageProps.y}
              scaleX={editorState.zoom}
              scaleY={editorState.zoom}
            >
              {/* Current drawing stroke */}
              {editorState.activeTool === 'area' && currentDrawing.length > 2 && (
                <>
                  <Line
                    points={currentDrawing.flatMap(p => [p.x, p.y])}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="rgba(59, 130, 246, 0.1)"
                    closed={true}
                    dash={[5, 5]}
                  />
                  {/* Close line */}
                  {currentDrawing.length > 0 && (
                    <Line
                      points={[
                        currentDrawing[currentDrawing.length - 1]?.x || 0,
                        currentDrawing[currentDrawing.length - 1]?.y || 0,
                        currentDrawing[0]?.x || 0,
                        currentDrawing[0]?.y || 0
                      ]}
                      stroke="#3b82f6"
                      strokeWidth={1}
                      dash={[3, 3]}
                      opacity={0.5}
                    />
                  )}
                </>
              )}
              
              {/* Linear drawing */}
              {editorState.activeTool === 'linear' && currentDrawing.length > 1 && (
                <Line
                  points={currentDrawing.flatMap(p => [p.x, p.y])}
                  stroke="#10b981"
                  strokeWidth={3}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
              
              {/* Waterline drawing */}
              {editorState.activeTool === 'waterline' && currentDrawing.length > 1 && (
                <Line
                  points={currentDrawing.flatMap(p => [p.x, p.y])}
                  stroke="#8b5cf6"
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
              
              {/* Eraser visual */}
              {editorState.activeTool === 'eraser' && currentDrawing.length > 0 && (
                <Line
                  points={currentDrawing.flatMap(p => [p.x, p.y])}
                  stroke="#ef4444"
                  strokeWidth={editorState.brushSize}
                  lineCap="round"
                  lineJoin="round"
                  opacity={0.7}
                />
              )}
            </Group>
          )}
        </Layer>

        {/* Calibration Layer */}
        <Layer>
          {imageProps && editorState.calibration && 'start' in editorState.calibration && 'end' in editorState.calibration && (
            <Group
              x={imageProps.x}
              y={imageProps.y}
              scaleX={editorState.zoom}
              scaleY={editorState.zoom}
            >
              <Line
                points={[
                  editorState.calibration.start.x,
                  editorState.calibration.start.y,
                  editorState.calibration.end.x,
                  editorState.calibration.end.y
                ]}
                stroke="#ef4444"
                strokeWidth={3}
                lineCap="round"
                dash={[10, 5]}
              />
            </Group>
          )}
        </Layer>
      </Stage>
    </div>
  );
}