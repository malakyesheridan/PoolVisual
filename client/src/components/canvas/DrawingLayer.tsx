/**
 * Drawing Layer Component
 * Renders current drawing stroke while user is drawing
 */

import React from 'react';
import { Line, Circle } from 'react-konva';
import { Vec2 } from '@shared/schema';
import { EditorTool } from '@/stores/editorSlice';

interface DrawingLayerProps {
  currentDrawing: Vec2[];
  tool: EditorTool;
  brushSize: number;
}

export function DrawingLayer({ currentDrawing, tool, brushSize }: DrawingLayerProps) {
  if (!currentDrawing || currentDrawing.length === 0) return null;

  const getStrokeColor = () => {
    switch (tool) {
      case 'area': return '#10b981'; // emerald-500
      case 'linear': return '#f59e0b'; // amber-500
      case 'waterline': return '#8b5cf6'; // violet-500
      case 'eraser': return '#ef4444'; // red-500
      case 'calibrate': return '#3b82f6'; // blue-500
      default: return '#6b7280'; // gray-500
    }
  };

  const renderDrawingStroke = () => {
    if (currentDrawing.length < 2) return null;

    const points = currentDrawing.flatMap(p => [p.x, p.y]);
    const strokeColor = getStrokeColor();

    switch (tool) {
      case 'area':
        return (
          <Line
            points={points}
            stroke={strokeColor}
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
            dash={[5, 5]}
            perfectDrawEnabled={false}
            shadowEnabled={false}
          />
        );

      case 'linear':
        return (
          <Line
            points={points}
            stroke={strokeColor}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
            perfectDrawEnabled={false}
            shadowEnabled={false}
          />
        );

      case 'waterline':
        return (
          <Line
            points={points}
            stroke={strokeColor}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
            dash={[10, 5]}
            perfectDrawEnabled={false}
            shadowEnabled={false}
          />
        );

      case 'eraser':
        return (
          <Line
            points={points}
            stroke={strokeColor + '80'} // Add transparency
            strokeWidth={brushSize}
            lineCap="round"
            lineJoin="round"
            globalCompositeOperation="source-over"
            perfectDrawEnabled={false}
            shadowEnabled={false}
          />
        );

      case 'calibrate':
        return (
          <Line
            points={points}
            stroke={strokeColor}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
            perfectDrawEnabled={false}
            shadowEnabled={false}
          />
        );

      default:
        return null;
    }
  };

  const renderDrawingPoints = () => {
    if (tool === 'eraser') return null; // Don't show points for eraser

    return currentDrawing.map((point, index) => (
      <Circle
        key={index}
        x={point.x}
        y={point.y}
        radius={tool === 'area' ? 3 : 4}
        fill={getStrokeColor()}
        stroke="#ffffff"
        strokeWidth={1}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />
    ));
  };

  const renderEraserBrush = () => {
    if (tool !== 'eraser' || currentDrawing.length === 0) return null;

    const lastPoint = currentDrawing[currentDrawing.length - 1];
    
    return (
      <Circle
        x={lastPoint.x}
        y={lastPoint.y}
        radius={brushSize / 2}
        stroke="#ef4444"
        strokeWidth={2}
        fill="transparent"
        dash={[3, 3]}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />
    );
  };

  return (
    <>
      {renderDrawingStroke()}
      {renderDrawingPoints()}
      {renderEraserBrush()}
    </>
  );
}