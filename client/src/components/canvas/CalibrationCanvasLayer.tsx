/**
 * Calibration Canvas Layer
 * Handles visual feedback for robust calibration state machine
 */

import React from 'react';
import { Layer, Circle, Line, Text } from 'react-konva';
import { useEditorStore } from '@/stores/editorSlice';

export function CalibrationCanvasLayer() {
  const { editorState } = useEditorStore();
  const { calState, calTemp, calibrationV2 } = editorState;

  // Don't render if not in calibration mode
  if (calState === 'idle') {
    return null;
  }

  const { a, b, preview } = calTemp;
  const elements = [];

  // Render point A (blue dot with label)
  if (a) {
    elements.push(
      <Circle
        key="cal-point-a"
        x={a.x}
        y={a.y}
        radius={8}
        fill="#3b82f6"
        stroke="#1e40af"
        strokeWidth={2}
      />
    );
    
    elements.push(
      <Text
        key="cal-label-a"
        x={a.x + 12}
        y={a.y - 20}
        text="A"
        fontSize={14}
        fill="#1e40af"
        fontStyle="bold"
      />
    );
  }

  // Render point B (green dot with label)
  if (b) {
    elements.push(
      <Circle
        key="cal-point-b"
        x={b.x}
        y={b.y}
        radius={8}
        fill="#10b981"
        stroke="#059669"
        strokeWidth={2}
      />
    );
    
    elements.push(
      <Text
        key="cal-label-b"
        x={b.x + 12}
        y={b.y - 20}
        text="B"
        fontSize={14}
        fill="#059669"
        fontStyle="bold"
      />
    );
  }

  // Render connecting line when both points are set
  if (a && b) {
    const distance = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    
    elements.push(
      <Line
        key="cal-line"
        points={[a.x, a.y, b.x, b.y]}
        stroke="#3b82f6"
        strokeWidth={3}
        dash={[5, 5]}
      />
    );
    
    // Distance label
    elements.push(
      <Text
        key="cal-distance"
        x={midX - 30}
        y={midY - 30}
        text={`${distance.toFixed(0)}px`}
        fontSize={12}
        fontStyle="bold"
        padding={4}
        fill="#ffffff"
        stroke="#1e40af"
        strokeWidth={1}
      />
    );
  } else if (a && preview && calState === 'placingB') {
    // Show live preview line from A to cursor
    elements.push(
      <Line
        key="cal-preview-line"
        points={[a.x, a.y, preview.x, preview.y]}
        stroke="#60a5fa"
        strokeWidth={2}
        dash={[8, 4]}
        opacity={0.7}
      />
    );
  }

  // Render existing calibration samples as small markers
  if (calibrationV2?.samples) {
    calibrationV2.samples.forEach((sample, index) => {
      elements.push(
        <Line
          key={`cal-sample-${sample.id}`}
          points={[sample.a.x, sample.a.y, sample.b.x, sample.b.y]}
          stroke="#22c55e"
          strokeWidth={2}
          opacity={0.4}
        />
      );
      
      elements.push(
        <Circle
          key={`cal-sample-a-${sample.id}`}
          x={sample.a.x}
          y={sample.a.y}
          radius={4}
          fill="#22c55e"
          opacity={0.6}
        />
      );
      
      elements.push(
        <Circle
          key={`cal-sample-b-${sample.id}`}
          x={sample.b.x}
          y={sample.b.y}
          radius={4}
          fill="#22c55e"
          opacity={0.6}
        />
      );
    });
  }

  return (
    <Layer>
      {elements}
    </Layer>
  );
}