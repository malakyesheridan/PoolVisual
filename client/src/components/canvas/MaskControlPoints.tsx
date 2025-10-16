import React, { useState } from 'react';
import { Group, Circle, Line } from 'react-konva';
import { Mask, Pt } from '../../maskcore/store';
import { useMaskStore } from '../../maskcore/store';
import { useEditorStore } from '../../new_editor/store';

interface Props {
  mask: Mask;
  imgFit: { originX: number; originY: number; imgScale: number };
}

export function MaskControlPoints({ mask, imgFit }: Props) {
  const { pointEditingMode, editingMaskId, UPDATE_MASK_POINT, ADD_MASK_POINT, REMOVE_MASK_POINT, selectedId } = useMaskStore();
  const { dispatch, pointEditing, gridSpacing } = useEditorStore();
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  
  console.log('[MaskControlPoints] Render check', {
    maskId: mask.id,
    pointEditingMode,
    editingMaskId,
    selectedId,
    shouldRender: pointEditingMode && editingMaskId === mask.id && selectedId === mask.id
  });
  
  // Only show control points if this mask is being edited AND selected
  if (!pointEditingMode || editingMaskId !== mask.id || selectedId !== mask.id) {
    return null;
  }

  console.log('[MaskControlPoints] Rendering control points for mask:', mask.id, 'with', mask.pts.length, 'points');

  // Convert image coordinates to screen coordinates
  const pointsToScreen = (pts: Pt[]) => {
    const positionOffset = mask.position || { x: 0, y: 0 };
    const rotation = mask.rotation || 0;
    
    // Calculate mask center for rotation
    const maskCenter = {
      x: pts.reduce((sum, pt) => sum + pt.x, 0) / pts.length,
      y: pts.reduce((sum, pt) => sum + pt.y, 0) / pts.length
    };
    
    // Helper function to rotate a point around center
    const rotatePoint = (pt: Pt, center: { x: number; y: number }, angle: number) => {
      if (angle === 0) return pt;
      
      const cos = Math.cos(angle * Math.PI / 180);
      const sin = Math.sin(angle * Math.PI / 180);
      const dx = pt.x - center.x;
      const dy = pt.y - center.y;
      
      return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos
      };
    };
    
    return pts.map(pt => {
      // Apply rotation first
      const rotatedPt = rotatePoint(pt, maskCenter, rotation);
      // Then apply position offset and convert to screen coordinates
      return {
        x: (rotatedPt.x + positionOffset.x) * imgFit.imgScale + imgFit.originX,
        y: (rotatedPt.y + positionOffset.y) * imgFit.imgScale + imgFit.originY
      };
    });
  };

  // Snap to grid if enabled
  const snapToGrid = (point: Pt): Pt => {
    if (!pointEditing.snapToGrid) return point;
    
    const gridSize = gridSpacing;
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize
    };
  };

  const screenPoints = pointsToScreen(mask.pts);

  // Generate edge lines between points
  const edgeLines: JSX.Element[] = [];
  for (let i = 0; i < screenPoints.length; i++) {
    const current = screenPoints[i];
    const next = screenPoints[(i + 1) % screenPoints.length];
    
    edgeLines.push(
      <Line
        key={`edge-${i}`}
        points={[current.x, current.y, next.x, next.y]}
        stroke="#3B82F6"
        strokeWidth={1}
        opacity={0.5}
        dash={[5, 5]}
      />
    );
  }

  return (
    <Group>
      {/* Edge lines */}
      {edgeLines}
      
      {/* Control points */}
      {screenPoints.map((point, index) => (
        <Group key={`control-point-${mask.id}-${index}`}>
          {/* Hover area (larger invisible circle for easier interaction) */}
          <Circle
            x={point.x}
            y={point.y}
            radius={8}
            fill="transparent"
            draggable
            onMouseEnter={() => setHoveredPointIndex(index)}
            onMouseLeave={() => setHoveredPointIndex(null)}
            onDragStart={(e) => {
              console.log('[ControlPoint] Drag start', { maskId: mask.id, pointIndex: index });
              e.evt.stopPropagation(); // Prevent event from bubbling up
              // Create undo snapshot before starting drag
              dispatch({ type: 'SNAPSHOT' });
            }}
            onDragMove={(e) => {
              const stage = e.target.getStage();
              if (!stage) return;
              
              // Convert screen coordinates back to image coordinates
              const newScreenX = e.target.x();
              const newScreenY = e.target.y();
              
              const newImageX = (newScreenX - imgFit.originX) / imgFit.imgScale;
              const newImageY = (newScreenY - imgFit.originY) / imgFit.imgScale;
              
              // Apply grid snapping if enabled
              const snappedPoint = snapToGrid({ x: newImageX, y: newImageY });
              
              console.log('[ControlPoint] Drag move', { 
                maskId: mask.id, 
                pointIndex: index, 
                newScreenX, 
                newScreenY, 
                newImageX, 
                newImageY,
                snappedPoint 
              });
              
              // Update the point in real-time
              UPDATE_MASK_POINT(mask.id, index, snappedPoint);
            }}
            onDragEnd={(e) => {
              console.log('[ControlPoint] Drag end', { maskId: mask.id, pointIndex: index });
              // Final position update
              const stage = e.target.getStage();
              if (!stage) return;
              
              const newScreenX = e.target.x();
              const newScreenY = e.target.y();
              
              const newImageX = (newScreenX - imgFit.originX) / imgFit.imgScale;
              const newImageY = (newScreenY - imgFit.originY) / imgFit.imgScale;
              
              // Apply grid snapping if enabled
              const snappedPoint = snapToGrid({ x: newImageX, y: newImageY });
              
              // Final update
              UPDATE_MASK_POINT(mask.id, index, snappedPoint);
            }}
            onContextMenu={(e) => {
              e.evt.preventDefault();
              // Right-click to add point
              const stage = e.target.getStage();
              if (!stage) return;
              
              const pointerPos = stage.getPointerPosition();
              if (!pointerPos) return;
              
              // Convert screen coordinates to image coordinates
              const newImageX = (pointerPos.x - imgFit.originX) / imgFit.imgScale;
              const newImageY = (pointerPos.y - imgFit.originY) / imgFit.imgScale;
              
              const snappedPoint = snapToGrid({ x: newImageX, y: newImageY });
              
              // Create undo snapshot
              dispatch({ type: 'SNAPSHOT' });
              
              // Add point after current index
              ADD_MASK_POINT(mask.id, index + 1, snappedPoint);
            }}
            onMouseDown={(e) => {
              if (e.evt.button === 1) { // Middle mouse button
                e.evt.preventDefault();
                // Create undo snapshot
                dispatch({ type: 'SNAPSHOT' });
                // Remove point
                REMOVE_MASK_POINT(mask.id, index);
              }
            }}
          />
          
          {/* Visible control point */}
          <Circle
            x={point.x}
            y={point.y}
            radius={hoveredPointIndex === index ? 6 : 4}
            fill={hoveredPointIndex === index ? "#1E40AF" : "#3B82F6"}
            stroke="#1E40AF"
            strokeWidth={1}
            listening={false} // Let the hover area handle all interactions
          />
        </Group>
      ))}
    </Group>
  );
}
