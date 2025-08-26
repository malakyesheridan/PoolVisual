/**
 * Selection Layer Component
 * Renders selection indicators and handles for the selected mask
 */

import React from 'react';
import { Group, Line, Rect, Circle } from 'react-konva';
import { EditorMask, Vec2 } from '@shared/schema';

interface SelectionLayerProps {
  mask?: EditorMask;
  imageWidth: number;
  imageHeight: number;
}

export function SelectionLayer({ mask, imageWidth, imageHeight }: SelectionLayerProps) {
  if (!mask) return null;

  const getBoundingBox = (): { x: number; y: number; width: number; height: number } => {
    let points: Vec2[] = [];
    
    if (mask.type === 'area' && mask.polygon?.points) {
      points = mask.polygon.points;
    } else if ((mask.type === 'linear' || mask.type === 'waterline_band') && mask.polyline?.points) {
      points = mask.polyline.points;
    }

    if (points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  const renderSelectionBox = () => {
    const bbox = getBoundingBox();
    
    if (bbox.width === 0 || bbox.height === 0) return null;

    const padding = 10;
    
    return (
      <Rect
        x={bbox.x - padding}
        y={bbox.y - padding}
        width={bbox.width + padding * 2}
        height={bbox.height + padding * 2}
        stroke="#3b82f6"
        strokeWidth={2}
        dash={[8, 4]}
        fill="transparent"
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />
    );
  };

  const renderCornerHandles = () => {
    const bbox = getBoundingBox();
    
    if (bbox.width === 0 || bbox.height === 0) return null;

    const padding = 10;
    const handleSize = 8;
    
    const corners = [
      { x: bbox.x - padding, y: bbox.y - padding }, // Top-left
      { x: bbox.x + bbox.width + padding, y: bbox.y - padding }, // Top-right
      { x: bbox.x - padding, y: bbox.y + bbox.height + padding }, // Bottom-left
      { x: bbox.x + bbox.width + padding, y: bbox.y + bbox.height + padding }, // Bottom-right
    ];

    return corners.map((corner, index) => (
      <Rect
        key={index}
        x={corner.x - handleSize / 2}
        y={corner.y - handleSize / 2}
        width={handleSize}
        height={handleSize}
        fill="#ffffff"
        stroke="#3b82f6"
        strokeWidth={2}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />
    ));
  };

  const renderVertexHandles = () => {
    let points: Vec2[] = [];
    
    if (mask.type === 'area' && mask.polygon?.points) {
      points = mask.polygon.points;
    } else if ((mask.type === 'linear' || mask.type === 'waterline_band') && mask.polyline?.points) {
      points = mask.polyline.points;
    }

    return points.map((point, index) => (
      <Circle
        key={index}
        x={point.x}
        y={point.y}
        radius={5}
        fill="#3b82f6"
        stroke="#ffffff"
        strokeWidth={2}
        draggable={false}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />
    ));
  };

  const renderSelectionInfo = () => {
    const bbox = getBoundingBox();
    
    if (bbox.width === 0 || bbox.height === 0) return null;

    const infoX = bbox.x + bbox.width + 20;
    const infoY = bbox.y;
    
    return (
      <Group x={infoX} y={infoY}>
        <Rect
          x={0}
          y={0}
          width={120}
          height={60}
          fill="rgba(255, 255, 255, 0.95)"
          stroke="#3b82f6"
          strokeWidth={1}
          cornerRadius={4}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
        <Text
          x={8}
          y={8}
          text={mask.type.toUpperCase()}
          fontSize={12}
          fontFamily="Arial, sans-serif"
          fontStyle="bold"
          fill="#3b82f6"
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
        <Text
          x={8}
          y={24}
          text={`ID: ${mask.id.slice(-8)}`}
          fontSize={10}
          fontFamily="Arial, sans-serif"
          fill="#6b7280"
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
        {mask.materialId && (
          <Text
            x={8}
            y={40}
            text="Material: Yes"
            fontSize={10}
            fontFamily="Arial, sans-serif"
            fill="#10b981"
            perfectDrawEnabled={false}
            shadowEnabled={false}
          />
        )}
      </Group>
    );
  };

  return (
    <Group>
      {renderSelectionBox()}
      {renderCornerHandles()}
      {renderVertexHandles()}
      {renderSelectionInfo()}
    </Group>
  );
}