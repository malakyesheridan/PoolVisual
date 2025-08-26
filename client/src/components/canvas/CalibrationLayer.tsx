/**
 * Calibration Layer Component
 * Renders calibration reference line and measurements
 */

import React from 'react';
import { Group, Line, Circle, Text, Rect } from 'react-konva';
import { CalibrationData } from '@shared/schema';

interface CalibrationLayerProps {
  calibration: CalibrationData;
}

export function CalibrationLayer({ calibration }: CalibrationLayerProps) {
  const { referenceLineStart, referenceLineEnd, referenceLineLength } = calibration;

  // Calculate midpoint for label
  const midPoint = {
    x: (referenceLineStart.x + referenceLineEnd.x) / 2,
    y: (referenceLineStart.y + referenceLineEnd.y) / 2
  };

  // Calculate angle for text rotation
  const dx = referenceLineEnd.x - referenceLineStart.x;
  const dy = referenceLineEnd.y - referenceLineStart.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  const labelText = `${referenceLineLength}m`;
  const labelWidth = labelText.length * 8 + 16;
  const labelHeight = 20;

  return (
    <Group>
      {/* Reference line */}
      <Line
        points={[
          referenceLineStart.x,
          referenceLineStart.y,
          referenceLineEnd.x,
          referenceLineEnd.y
        ]}
        stroke="#3b82f6"
        strokeWidth={3}
        lineCap="round"
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />

      {/* Start point */}
      <Circle
        x={referenceLineStart.x}
        y={referenceLineStart.y}
        radius={6}
        fill="#3b82f6"
        stroke="#ffffff"
        strokeWidth={2}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />

      {/* End point */}
      <Circle
        x={referenceLineEnd.x}
        y={referenceLineEnd.y}
        radius={6}
        fill="#3b82f6"
        stroke="#ffffff"
        strokeWidth={2}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />

      {/* Measurement label background */}
      <Rect
        x={midPoint.x - labelWidth / 2}
        y={midPoint.y - labelHeight / 2}
        width={labelWidth}
        height={labelHeight}
        fill="#ffffff"
        stroke="#3b82f6"
        strokeWidth={1}
        cornerRadius={4}
        rotation={Math.abs(angle) > 90 ? angle + 180 : angle}
        offsetX={labelWidth / 2}
        offsetY={labelHeight / 2}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />

      {/* Measurement text */}
      <Text
        x={midPoint.x}
        y={midPoint.y}
        text={labelText}
        fontSize={12}
        fontFamily="Arial, sans-serif"
        fontStyle="bold"
        fill="#3b82f6"
        align="center"
        verticalAlign="middle"
        rotation={Math.abs(angle) > 90 ? angle + 180 : angle}
        offsetX={labelWidth / 2}
        offsetY={6}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />

      {/* Calibration indicator */}
      <Group x={referenceLineStart.x - 60} y={referenceLineStart.y - 30}>
        <Rect
          x={0}
          y={0}
          width={120}
          height={24}
          fill="rgba(59, 130, 246, 0.9)"
          cornerRadius={12}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
        <Text
          x={60}
          y={12}
          text="CALIBRATION"
          fontSize={10}
          fontFamily="Arial, sans-serif"
          fontStyle="bold"
          fill="#ffffff"
          align="center"
          verticalAlign="middle"
          offsetX={30}
          offsetY={5}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
      </Group>
    </Group>
  );
}