/**
 * Calibration Canvas Layer
 * Handles visual feedback for robust calibration state machine
 * Fixed to work with the new bulletproof store structure
 */

import React from 'react';
import { Layer, Circle, Line, Text } from 'react-konva';
import { useEditorStore, type CalSample } from '@/stores/editorSlice';

export function CalibrationCanvasLayer() {
  const { calState, calTemp, calibration } = useEditorStore();

  // Don't render if not in calibration mode
  if (calState === 'idle') {
    return null;
  }

  const elements = [];

  // Current calibration in progress
  if (calTemp) {
    const { a, b, preview } = calTemp;

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

    // Render line between A and current preview position (mouse)
    if (a && preview && calState === 'placingB') {
      elements.push(
        <Line
          key="cal-preview-line"
          points={[a.x, a.y, preview.x, preview.y]}
          stroke="#64748b"
          strokeWidth={2}
          dash={[5, 5]}
          opacity={0.7}
        />
      );
    }

    // Render line between A and B when both are placed
    if (a && b) {
      elements.push(
        <Line
          key="cal-line"
          points={[a.x, a.y, b.x, b.y]}
          stroke="#ef4444"
          strokeWidth={3}
          opacity={0.8}
        />
      );

      // Calculate and display distance
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      
      elements.push(
        <Text
          key="cal-distance"
          x={midX}
          y={midY - 15}
          text={`${distance.toFixed(1)}px`}
          fontSize={12}
          fill="#ef4444"
          fontStyle="bold"
          align="center"
        />
      );

      if (calTemp.meters) {
        elements.push(
          <Text
            key="cal-meters"
            x={midX}
            y={midY + 5}
            text={`${calTemp.meters}m`}
            fontSize={12}
            fill="#059669"
            fontStyle="bold"
            align="center"
          />
        );
      }
    }
  }

  // Render existing calibration samples
  if (calibration?.samples) {
    calibration.samples.forEach((sample: CalSample, index: number) => {
      const { a, b } = sample;
      const sampleKey = `sample-${index}`;
      
      // Sample line
      elements.push(
        <Line
          key={`${sampleKey}-line`}
          points={[a.x, a.y, b.x, b.y]}
          stroke="#7c3aed"
          strokeWidth={2}
          opacity={0.6}
        />
      );

      // Sample points
      elements.push(
        <Circle
          key={`${sampleKey}-a`}
          x={a.x}
          y={a.y}
          radius={4}
          fill="#7c3aed"
          opacity={0.6}
        />
      );

      elements.push(
        <Circle
          key={`${sampleKey}-b`}
          x={b.x}
          y={b.y}
          radius={4}
          fill="#7c3aed"
          opacity={0.6}
        />
      );

      // Sample label
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      
      elements.push(
        <Text
          key={`${sampleKey}-label`}
          x={midX}
          y={midY - 10}
          text={`${sample.meters}m`}
          fontSize={10}
          fill="#7c3aed"
          align="center"
        />
      );
    });
  }

  return (
    <Layer listening={false}>
      {elements}
    </Layer>
  );
}