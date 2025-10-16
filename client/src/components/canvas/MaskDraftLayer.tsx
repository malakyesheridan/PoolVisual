import React from 'react';
import { Line, Circle } from 'react-konva';

interface Props {
  draft: { mode: 'area' | 'polygon'; pts: { x: number; y: number }[] } | null;
  imgFit?: { originX: number; originY: number; imgScale: number };
}

export function MaskDraftLayer({ draft, imgFit }: Props) {
  if (!draft || draft.pts.length === 0) return null;

  // Convert image coordinates to screen coordinates for rendering
  const points = draft.pts.flatMap(pt => {
    if (imgFit) {
      // Convert image coordinates to screen coordinates
      const screenX = pt.x * imgFit.imgScale + imgFit.originX;
      const screenY = pt.y * imgFit.imgScale + imgFit.originY;
      return [screenX, screenY];
    } else {
      // Fallback to direct coordinates
      return [pt.x, pt.y];
    }
  });

  return (
    <>
      {/* Draw the draft line */}
      <Line
        points={points}
        stroke="#ff7a1a"
        strokeWidth={2}
        lineCap="round"
        lineJoin="round"
        closed={draft.mode === 'area' && draft.pts.length >= 3}
        listening={false}
      />
      
      {/* Draw vertex circles */}
      {draft.pts.map((pt, index) => {
        const screenPt = imgFit ? {
          x: pt.x * imgFit.imgScale + imgFit.originX,
          y: pt.y * imgFit.imgScale + imgFit.originY
        } : pt;
        
        return (
          <Circle
            key={index}
            x={screenPt.x}
            y={screenPt.y}
            radius={2}
            fill="#ff7a1a"
            listening={false}
          />
        );
      })}
    </>
  );
}
