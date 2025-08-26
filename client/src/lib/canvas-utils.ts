import Konva from 'konva';
import { Point } from './measurement-utils';

/**
 * Create a new Konva stage
 */
export function createKonvaStage(container: HTMLDivElement): Konva.Stage {
  return new Konva.Stage({
    container,
    width: container.offsetWidth,
    height: container.offsetHeight,
    draggable: false,
  });
}

/**
 * Create background layer with grid
 */
export function createBackgroundLayer(stage: Konva.Stage): Konva.Layer {
  const layer = new Konva.Layer();
  
  const gridSize = 20;
  const width = stage.width();
  const height = stage.height();
  
  // Draw grid
  for (let i = 0; i < width / gridSize; i++) {
    const line = new Konva.Line({
      points: [i * gridSize, 0, i * gridSize, height],
      stroke: 'rgba(148, 163, 184, 0.1)',
      strokeWidth: 1,
    });
    layer.add(line);
  }
  
  for (let j = 0; j < height / gridSize; j++) {
    const line = new Konva.Line({
      points: [0, j * gridSize, width, j * gridSize],
      stroke: 'rgba(148, 163, 184, 0.1)',
      strokeWidth: 1,
    });
    layer.add(line);
  }
  
  stage.add(layer);
  return layer;
}

/**
 * Create photo layer
 */
export function createPhotoLayer(
  stage: Konva.Stage,
  imageUrl: string,
  onLoad?: () => void
): Konva.Layer {
  const layer = new Konva.Layer();
  
  const imageObj = new Image();
  imageObj.onload = () => {
    const image = new Konva.Image({
      x: 0,
      y: 0,
      image: imageObj,
      draggable: false,
    });
    
    // Center the image
    const scale = Math.min(
      stage.width() / imageObj.width,
      stage.height() / imageObj.height
    ) * 0.8;
    
    image.scale({ x: scale, y: scale });
    image.position({
      x: (stage.width() - imageObj.width * scale) / 2,
      y: (stage.height() - imageObj.height * scale) / 2,
    });
    
    layer.add(image);
    stage.add(layer);
    onLoad?.();
  };
  imageObj.src = imageUrl;
  
  return layer;
}

/**
 * Create mask layer for drawing masks
 */
export function createMaskLayer(stage: Konva.Stage): Konva.Layer {
  const layer = new Konva.Layer();
  stage.add(layer);
  return layer;
}

/**
 * Draw area mask (polygon)
 */
export function drawAreaMask(
  layer: Konva.Layer,
  points: Point[],
  options: {
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
    opacity?: number;
    dash?: number[];
  } = {}
): Konva.Line {
  const flatPoints = points.reduce((acc, point) => [...acc, point.x, point.y], [] as number[]);
  
  const polygon = new Konva.Line({
    points: flatPoints,
    closed: true,
    stroke: options.stroke || '#3b82f6',
    strokeWidth: options.strokeWidth || 2,
    fill: options.fill || 'rgba(59, 130, 246, 0.2)',
    opacity: options.opacity || 1,
    dash: options.dash,
  });
  
  layer.add(polygon);
  return polygon;
}

/**
 * Draw linear mask (polyline)
 */
export function drawLinearMask(
  layer: Konva.Layer,
  points: Point[],
  options: {
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    dash?: number[];
  } = {}
): Konva.Line {
  const flatPoints = points.reduce((acc, point) => [...acc, point.x, point.y], [] as number[]);
  
  const line = new Konva.Line({
    points: flatPoints,
    closed: false,
    stroke: options.stroke || '#3b82f6',
    strokeWidth: options.strokeWidth || 3,
    opacity: options.opacity || 1,
    dash: options.dash,
    lineCap: 'round',
    lineJoin: 'round',
  });
  
  layer.add(line);
  return line;
}

/**
 * Draw measurement label
 */
export function drawMeasurementLabel(
  layer: Konva.Layer,
  text: string,
  position: Point,
  options: {
    backgroundColor?: string;
    textColor?: string;
    fontSize?: number;
    padding?: number;
  } = {}
): Konva.Group {
  const group = new Konva.Group();
  
  const label = new Konva.Text({
    text,
    fontSize: options.fontSize || 12,
    fontFamily: 'Inter, system-ui, sans-serif',
    fill: options.textColor || '#374151',
    padding: options.padding || 8,
  });
  
  const textBounds = label.getClientRect();
  
  const background = new Konva.Rect({
    x: 0,
    y: 0,
    width: textBounds.width,
    height: textBounds.height,
    fill: options.backgroundColor || 'rgba(255, 255, 255, 0.9)',
    stroke: 'rgba(148, 163, 184, 0.2)',
    strokeWidth: 1,
    cornerRadius: 4,
  });
  
  group.add(background);
  group.add(label);
  group.position(position);
  
  layer.add(group);
  return group;
}

/**
 * Draw calibration line
 */
export function drawCalibrationLine(
  layer: Konva.Layer,
  startPoint: Point,
  endPoint: Point,
  label: string
): Konva.Group {
  const group = new Konva.Group();
  
  const line = new Konva.Line({
    points: [startPoint.x, startPoint.y, endPoint.x, endPoint.y],
    stroke: '#f59e0b',
    strokeWidth: 2,
  });
  
  const midPoint = {
    x: (startPoint.x + endPoint.x) / 2,
    y: (startPoint.y + endPoint.y) / 2 - 20,
  };
  
  group.add(line);
  
  const labelGroup = drawMeasurementLabel(layer, label, midPoint, {
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    textColor: 'white',
  });
  
  group.add(labelGroup);
  layer.add(group);
  return group;
}

/**
 * Handle stage zoom and pan
 */
export function setupStageInteraction(stage: Konva.Stage) {
  let lastCenter: Point | null = null;
  let lastDist = 0;
  
  stage.on('wheel', (e) => {
    e.evt.preventDefault();
    
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition()!;
    
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const scaleBy = 1.1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    stage.scale({ x: newScale, y: newScale });
    
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    
    stage.position(newPos);
  });
  
  // Touch/mobile zoom
  stage.on('touchmove', (e) => {
    e.evt.preventDefault();
    const touch1 = e.evt.touches[0];
    const touch2 = e.evt.touches[1];
    
    if (touch1 && touch2) {
      const center = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };
      
      const dist = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      if (!lastCenter) {
        lastCenter = center;
        lastDist = dist;
        return;
      }
      
      const scale = dist / lastDist;
      stage.scaleX(stage.scaleX() * scale);
      stage.scaleY(stage.scaleY() * scale);
      
      const dx = center.x - lastCenter.x;
      const dy = center.y - lastCenter.y;
      
      stage.x(stage.x() + dx);
      stage.y(stage.y() + dy);
      
      lastCenter = center;
      lastDist = dist;
    }
  });
  
  stage.on('touchend', () => {
    lastCenter = null;
    lastDist = 0;
  });
}
