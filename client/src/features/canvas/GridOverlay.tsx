/**
 * Grid Overlay Component for Konva Stage
 */

import React, { useMemo } from 'react';
import { Layer, Line } from 'react-konva';
import { generateGridLines } from './utils/gridUtils';
import { useCanvasViewportStore } from './stores/canvasViewportStore';

interface GridOverlayProps {
  width: number;
  height: number;
  visible?: boolean;
}

export function GridOverlay({ width, height, visible = true }: GridOverlayProps) {
  const { gridConfig, zoom, panX, panY } = useCanvasViewportStore();
  
  const gridLines = useMemo(() => {
    if (!gridConfig.enabled || !visible) {
      return { vertical: [], horizontal: [] };
    }
    
    // Adjust grid offset based on pan
    const offset = {
      x: panX % gridConfig.size,
      y: panY % gridConfig.size,
    };
    
    return generateGridLines(width, height, gridConfig.size, offset);
  }, [gridConfig.enabled, gridConfig.size, width, height, panX, panY, visible]);

  if (!gridConfig.enabled || !visible) {
    return null;
  }

  return (
    <Layer listening={false}>
      {/* Vertical lines */}
      {gridLines.vertical.map((x, index) => (
        <Line
          key={`v-${index}`}
          points={[x, 0, x, height]}
          stroke={gridConfig.color}
          strokeWidth={1}
          opacity={gridConfig.opacity}
          listening={false}
        />
      ))}
      
      {/* Horizontal lines */}
      {gridLines.horizontal.map((y, index) => (
        <Line
          key={`h-${index}`}
          points={[0, y, width, y]}
          stroke={gridConfig.color}
          strokeWidth={1}
          opacity={gridConfig.opacity}
          listening={false}
        />
      ))}
    </Layer>
  );
}
