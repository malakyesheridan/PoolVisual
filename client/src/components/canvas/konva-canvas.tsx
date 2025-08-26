import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@/stores/canvas-store';
import { 
  createKonvaStage, 
  createBackgroundLayer, 
  createPhotoLayer, 
  createMaskLayer,
  drawAreaMask,
  drawLinearMask,
  drawMeasurementLabel,
  drawCalibrationLine,
  setupStageInteraction
} from '@/lib/canvas-utils';
import { 
  calculatePolygonArea, 
  calculatePolygonPerimeter, 
  calculateLineLength,
  pixelAreaToSquareMeters,
  pixelsToMeters 
} from '@/lib/measurement-utils';
import Konva from 'konva';

interface KonvaCanvasProps {
  className?: string;
}

export function KonvaCanvas({ className }: KonvaCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const photoLayerRef = useRef<Konva.Layer | null>(null);
  const maskLayerRef = useRef<Konva.Layer | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);

  const {
    photo,
    calibration,
    masks,
    activeTool,
    selectedMaterial,
    viewMode,
    addMask,
    setCalibration
  } = useCanvasStore();

  // Initialize stage
  useEffect(() => {
    if (!containerRef.current) return;

    const stage = createKonvaStage(containerRef.current);
    stageRef.current = stage;

    // Create layers
    createBackgroundLayer(stage);
    maskLayerRef.current = createMaskLayer(stage);
    
    // Setup interactions
    setupStageInteraction(stage);

    // Handle resize
    const handleResize = () => {
      if (containerRef.current) {
        stage.width(containerRef.current.offsetWidth);
        stage.height(containerRef.current.offsetHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      stage.destroy();
    };
  }, []);

  // Load photo
  useEffect(() => {
    if (!photo || !stageRef.current) return;

    photoLayerRef.current = createPhotoLayer(
      stageRef.current,
      photo.url,
      () => {
        stageRef.current?.draw();
      }
    );
  }, [photo]);

  // Draw calibration line
  useEffect(() => {
    if (!calibration || !maskLayerRef.current) return;

    drawCalibrationLine(
      maskLayerRef.current,
      calibration.startPoint,
      calibration.endPoint,
      `${calibration.referenceLength}m`
    );
  }, [calibration]);

  // Draw masks
  useEffect(() => {
    if (!maskLayerRef.current || !calibration) return;

    maskLayerRef.current.destroyChildren();

    masks.forEach((mask) => {
      if (mask.type === 'area') {
        const polygon = drawAreaMask(maskLayerRef.current!, mask.points, {
          stroke: selectedMaterial ? '#3b82f6' : '#94a3b8',
          dash: selectedMaterial ? undefined : [10, 5],
        });

        // Add measurement label
        const area = calculatePolygonArea(mask.points);
        const areaM2 = pixelAreaToSquareMeters(area, calibration.pixelsPerMeter);
        
        const centroid = {
          x: mask.points.reduce((sum, p) => sum + p.x, 0) / mask.points.length,
          y: mask.points.reduce((sum, p) => sum + p.y, 0) / mask.points.length - 10,
        };

        drawMeasurementLabel(
          maskLayerRef.current!,
          `${areaM2.toFixed(1)} m²`,
          centroid
        );
      } else if (mask.type === 'linear') {
        const line = drawLinearMask(maskLayerRef.current!, mask.points, {
          stroke: '#3b82f6',
          strokeWidth: 3,
        });

        const length = calculateLineLength(mask.points);
        const lengthM = pixelsToMeters(length, calibration.pixelsPerMeter);
        
        const midIndex = Math.floor(mask.points.length / 2);
        const midPoint = {
          x: mask.points[midIndex].x,
          y: mask.points[midIndex].y - 10,
        };

        drawMeasurementLabel(
          maskLayerRef.current!,
          `${lengthM.toFixed(1)} lm`,
          midPoint
        );
      }
    });

    maskLayerRef.current.draw();
  }, [masks, calibration, selectedMaterial]);

  // Handle drawing
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'pan' || !stageRef.current) return;

    const pos = stageRef.current.getPointerPosition();
    if (!pos) return;

    setIsDrawing(true);
    setCurrentPath([pos]);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || !stageRef.current) return;

    const pos = stageRef.current.getPointerPosition();
    if (!pos) return;

    setCurrentPath(prev => [...prev, pos]);

    // Draw temporary path
    if (maskLayerRef.current) {
      // Remove any temporary drawings
      const tempShapes = maskLayerRef.current.find('.temp');
      tempShapes.forEach(shape => shape.destroy());

      // Draw current path
      if (activeTool === 'area') {
        drawAreaMask(maskLayerRef.current, currentPath, {
          stroke: '#3b82f6',
          strokeWidth: 2,
          dash: [5, 5],
        });
      } else if (activeTool === 'linear') {
        drawLinearMask(maskLayerRef.current, currentPath, {
          stroke: '#3b82f6',
          strokeWidth: 3,
        });
      }

      maskLayerRef.current.draw();
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || currentPath.length < 2) {
      setIsDrawing(false);
      setCurrentPath([]);
      return;
    }

    // Create mask
    if (activeTool === 'area' && currentPath.length >= 3) {
      addMask({
        type: 'area',
        points: currentPath,
        materialId: selectedMaterial || undefined,
      });
    } else if (activeTool === 'linear') {
      addMask({
        type: 'linear',
        points: currentPath,
      });
    }

    setIsDrawing(false);
    setCurrentPath([]);

    // Clean up temp shapes
    if (maskLayerRef.current) {
      const tempShapes = maskLayerRef.current.find('.temp');
      tempShapes.forEach(shape => shape.destroy());
      maskLayerRef.current.draw();
    }
  };

  // Setup event handlers
  useEffect(() => {
    if (!stageRef.current) return;

    const stage = stageRef.current;
    
    stage.on('mousedown', handleMouseDown);
    stage.on('mousemove', handleMouseMove);
    stage.on('mouseup', handleMouseUp);

    return () => {
      stage.off('mousedown', handleMouseDown);
      stage.off('mousemove', handleMouseMove);  
      stage.off('mouseup', handleMouseUp);
    };
  }, [isDrawing, currentPath, activeTool, selectedMaterial]);

  return (
    <div 
      ref={containerRef} 
      className={className}
      data-testid="canvas-konva-container"
      style={{ cursor: activeTool === 'pan' ? 'grab' : 'crosshair' }}
    />
  );
}
