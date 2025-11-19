import React from 'react';
import { Group, Line } from 'react-konva';
import { useEditorStore } from '../../new_editor/store';

interface Props {
  imgFit: { originX: number; originY: number; imgScale: number };
  photoSpace: { imgW: number; imgH: number };
}

export function GridOverlay({ imgFit, photoSpace }: Props) {
  const { pointEditing, gridSpacing } = useEditorStore();
  
  // Only show grid when point editing is active and grid is enabled
  if (!pointEditing.showGrid) {
    return null;
  }

  const gridSize = gridSpacing;
  const imageWidth = photoSpace.imgW;
  const imageHeight = photoSpace.imgH;
  
  // Convert image coordinates to screen coordinates
  const imageToScreen = (x: number, y: number) => ({
    x: x * imgFit.imgScale + imgFit.originX,
    y: y * imgFit.imgScale + imgFit.originY
  });

  // Generate grid lines
  const verticalLines: JSX.Element[] = [];
  const horizontalLines: JSX.Element[] = [];

  // Vertical lines
  for (let x = 0; x <= imageWidth; x += gridSize) {
    const start = imageToScreen(x, 0);
    const end = imageToScreen(x, imageHeight);
    
    verticalLines.push(
      <Line
        key={`v-${x}`}
        points={[start.x, start.y, end.x, end.y]}
        stroke="#E5E7EB"
        strokeWidth={0.5}
        opacity={pointEditing.gridOpacity}
        shapeRendering="crispEdges"
      />
    );
  }

  // Horizontal lines
  for (let y = 0; y <= imageHeight; y += gridSize) {
    const start = imageToScreen(0, y);
    const end = imageToScreen(imageWidth, y);
    
    horizontalLines.push(
      <Line
        key={`h-${y}`}
        points={[start.x, start.y, end.x, end.y]}
        stroke="#E5E7EB"
        strokeWidth={0.5}
        opacity={pointEditing.gridOpacity}
        shapeRendering="crispEdges"
      />
    );
  }

  return (
    <Group name="grid-overlay">
      {verticalLines}
      {horizontalLines}
    </Group>
  );
}
