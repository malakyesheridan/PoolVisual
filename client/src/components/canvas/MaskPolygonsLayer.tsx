import React from 'react';
import { Line, Shape, Group } from 'react-konva';
import { MaskControlButtons } from './MaskControlButtons';
import { useMaskStore } from '../../maskcore/store';

interface Props {
  masks: Record<string, { id: string; pts: { x: number; y: number }[] }>;
  selectedId: string | null;
  onSelect: (maskId: string) => void;
  imgFit?: { originX: number; originY: number; imgScale: number };
}

export function MaskPolygonsLayer({ masks, selectedId, onSelect, imgFit }: Props) {
  const { pointEditingMode, editingMaskId } = useMaskStore();
  
  return (
    <>
      {Object.entries(masks).map(([maskId, mask]) => {
        if (!mask.pts || mask.pts.length < 3) return null;
        
        // Skip hidden masks
        if (mask.isVisible === false) return null;

        // Check if this mask is in point editing mode
        const isInPointEditing = pointEditingMode && editingMaskId === maskId;
        
        let points;
        if (isInPointEditing) {
          // In point editing mode, mask is already flattened - use points as-is
          if (imgFit) {
            points = mask.pts.flatMap(pt => [
              pt.x * imgFit.imgScale + imgFit.originX,
              pt.y * imgFit.imgScale + imgFit.originY
            ]);
          } else {
            points = mask.pts.flatMap(pt => [pt.x, pt.y]);
          }
        } else {
          // Normal mode - apply position offset and rotation if mask has been transformed
          const positionOffset = mask.position || { x: 0, y: 0 };
          const rotation = mask.rotation || 0;
          
          // Calculate mask center for rotation
          const maskCenter = {
            x: mask.pts.reduce((sum, pt) => sum + pt.x, 0) / mask.pts.length,
            y: mask.pts.reduce((sum, pt) => sum + pt.y, 0) / mask.pts.length
          };
          
          // Helper function to rotate a point around center
          const rotatePoint = (pt: { x: number; y: number }, center: { x: number; y: number }, angle: number) => {
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
          
          points = mask.pts.flatMap(pt => {
            // Apply rotation first
            const rotatedPt = rotatePoint(pt, maskCenter, rotation);
            
            if (imgFit) {
              // Apply position offset to the rotated point, then convert to screen coordinates
              const offsetX = rotatedPt.x + positionOffset.x;
              const offsetY = rotatedPt.y + positionOffset.y;
              const screenX = offsetX * imgFit.imgScale + imgFit.originX;
              const screenY = offsetY * imgFit.imgScale + imgFit.originY;
              return [screenX, screenY];
            } else {
              // Fallback to direct coordinates with offset
              return [rotatedPt.x + positionOffset.x, rotatedPt.y + positionOffset.y];
            }
          });
        }
        
        const isSelected = selectedId === maskId;

        return (
          <Group
            key={maskId}
            name="mask-shape"
            listening={true}
            isMask={true} // custom attr
            maskId={maskId} // for centralized handler
          >
            {/* Invisible hit area covering entire mask */}
            <Shape
              name={`mask-${maskId}`}
              sceneFunc={(context, shape) => {
                context.beginPath();
                context.moveTo(points[0], points[1]);
                for (let i = 2; i < points.length; i += 2) {
                  context.lineTo(points[i], points[i + 1]);
                }
                context.closePath();
                context.fillStrokeShape(shape);
              }}
              fill="rgba(0,0,0,0)" // completely transparent
              stroke="rgba(0,0,0,0)" // completely transparent
              listening={true}
              maskId={maskId} // for centralized handler
            />
            
            {/* Visible outline - only when selected */}
            <Line
              points={points}
              stroke={isSelected ? '#2563eb' : 'rgba(0,0,0,0)'}
              strokeWidth={isSelected ? 1.5 : 0}
              closed={true}
              fillEnabled={false}
              listening={false} // let the hit area handle clicks
              lineCap="round"
              lineJoin="round"
              perfectDrawEnabled={false}
            />
            
            {/* Control buttons - only when selected */}
            {isSelected && (
              <MaskControlButtons
                mask={mask}
                imgFit={imgFit}
              />
            )}
          </Group>
        );
      })}
    </>
  );
}
