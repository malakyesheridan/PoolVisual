// Asset Mask Renderer
// Renders assets as masks using the existing mask rendering pipeline

import React from 'react';
import { Line, Shape, Group } from 'react-konva';
import { AssetMask, isAssetMask } from './assetToMaskConverter';
import { Mask } from '../../maskcore/store';

interface Props {
  assetMask: AssetMask;
  isSelected: boolean;
  onSelect: (maskId: string) => void;
  imgFit?: { originX: number; originY: number; imgScale: number };
}

export function AssetMaskRenderer({ assetMask, isSelected, onSelect, imgFit }: Props) {
  if (!assetMask.pts || assetMask.pts.length < 3) return null;

  // Convert image coordinates to screen coordinates for rendering
  const points = assetMask.pts.flatMap(pt => {
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
    <Group
      key={assetMask.id}
      name="mask-shape"
      listening={true}
      isMask={true} // custom attr
      maskId={assetMask.id} // for centralized handler
    >
      {/* Invisible hit area covering entire asset */}
      <Shape
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
        maskId={assetMask.id} // for centralized handler
      />
      {/* Visible outline */}
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
    </Group>
  );
}

/**
 * Render all asset masks
 */
export function AssetMasksLayer({ 
  assetMasks, 
  selectedId, 
  onSelect,
  imgFit
}: {
  assetMasks: AssetMask[];
  selectedId: string | null;
  onSelect: (maskId: string) => void;
  imgFit?: { originX: number; originY: number; imgScale: number };
}) {
  return (
    <>
      {assetMasks.map(assetMask => (
        <AssetMaskRenderer
          key={assetMask.id}
          assetMask={assetMask}
          isSelected={selectedId === assetMask.id}
          onSelect={onSelect}
          imgFit={imgFit}
        />
      ))}
    </>
  );
}
