/**
 * Calibration Canvas Layer
 * Handles visual feedback for calibration state machine
 */

import React, { useEffect, useRef } from 'react';
import { Stage, Layer, Circle, Line, Text, Group } from 'react-konva';
import { useEditorStore } from '@/stores/editorSlice';
import { getPixelDistance } from '@/lib/calibration-v2';
import type { Vec2 } from '@shared/schema';

interface CalibrationCanvasLayerProps {
  stageRef: React.RefObject<any>;
  onPointPlace?: (point: Vec2) => void;
}

export function CalibrationCanvasLayer({ stageRef, onPointPlace }: CalibrationCanvasLayerProps) {
  const { editorState } = useEditorStore();
  const { calibrationV2, calState, calTempPoints } = editorState;
  
  const layerRef = useRef<any>(null);
  
  // Handle click events for placing calibration points
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    
    const handleStageClick = (e: any) => {
      if (calState !== 'placingA' && calState !== 'placingB') return;
      if (e.target !== stage) return; // Only respond to stage clicks, not shape clicks
      
      const pos = stage.getPointerPosition();
      if (!pos) return;
      
      // Convert to stage coordinates (accounting for zoom/pan)
      const transform = stage.getAbsoluteTransform().copy();
      transform.invert();
      const stagePos = transform.point(pos);
      
      onPointPlace?.(stagePos);
    };
    
    stage.on('click', handleStageClick);
    return () => stage.off('click', handleStageClick);
  }, [calState, onPointPlace, stageRef]);
  
  const renderTemporaryPoints = () => {
    const { a, b } = calTempPoints;
    const elements = [];
    
    // Render point A
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
          draggable={calState === 'lengthEntry'}
        />
      );
      
      // Label for point A
      elements.push(
        <Text
          key="cal-label-a"
          x={a.x + 12}
          y={a.y - 20}
          text="A"
          fontSize={12}
          fill="#1e40af"
          fontStyle="bold"
        />
      );
    }
    
    // Render point B and line
    if (a && b) {
      elements.push(
        <Circle
          key="cal-point-b"
          x={b.x}
          y={b.y}
          radius={8}
          fill="#3b82f6"
          stroke="#1e40af"
          strokeWidth={2}
          draggable={calState === 'lengthEntry'}
        />
      );
      
      // Label for point B
      elements.push(
        <Text
          key="cal-label-b"
          x={b.x + 12}
          y={b.y - 20}
          text="B"
          fontSize={12}
          fill="#1e40af"
          fontStyle="bold"
        />
      );
      
      // Dashed line between points
      elements.push(
        <Line
          key="cal-line"
          points={[a.x, a.y, b.x, b.y]}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[5, 5]}
        />
      );
      
      // Distance label at midpoint
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const distance = getPixelDistance(a, b);
      
      elements.push(
        <Group key="cal-distance-label">
          <Circle
            x={midX}
            y={midY}
            radius={20}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1}
            opacity={0.9}
          />
          <Text
            x={midX}
            y={midY - 6}
            text={`${distance.toFixed(0)}px`}
            fontSize={10}
            fill="#1e40af"
            align="center"
            offsetX={15}
          />
        </Group>
      );
    }
    
    return elements;
  };
  
  const renderCommittedSamples = () => {
    if (!calibrationV2?.samples) return [];
    
    return calibrationV2.samples.map((sample, index) => {
      const midX = (sample.a.x + sample.b.x) / 2;
      const midY = (sample.a.y + sample.b.y) / 2;
      
      return (
        <Group key={`sample-${sample.id}`}>
          {/* Small reference points */}
          <Circle
            x={sample.a.x}
            y={sample.a.y}
            radius={3}
            fill="#10b981"
            opacity={0.7}
          />
          <Circle
            x={sample.b.x}
            y={sample.b.y}
            radius={3}
            fill="#10b981"
            opacity={0.7}
          />
          
          {/* Sample label */}
          <Group>
            <Circle
              x={midX}
              y={midY}
              radius={12}
              fill="#10b981"
              opacity={0.8}
            />
            <Text
              x={midX}
              y={midY - 4}
              text={`#${index + 1}`}
              fontSize={8}
              fill="white"
              align="center"
              offsetX={6}
            />
          </Group>
        </Group>
      );
    });
  };
  
  // Only render if we're in a calibration state or have committed samples
  if (calState === 'idle' && !calibrationV2?.samples?.length) {
    return null;
  }
  
  return (
    <Layer ref={layerRef}>
      {renderTemporaryPoints()}
      {renderCommittedSamples()}
    </Layer>
  );
}