import React from 'react';
import { Line } from 'react-konva';
import useImage from 'use-image';
import type { Mask } from '@/stores/editorSlice';
import type { Material } from '@/state/materialsStore';

interface MaterialTextureProps {
  mask: Mask;
  material: Material;
}

export function MaterialTexture({ mask, material }: MaterialTextureProps) {
  const [textureImage] = useImage(material.texture_url || '', 'anonymous');
  
  if (!textureImage || mask.type !== 'area') {
    return null;
  }

  // Calculate texture scale based on physical repeat
  const physicalRepeatM = material.physical_repeat_m || 0.3;
  // Default to reasonable pixel density if no calibration available
  const pixelsPerMeter = 120; // Reasonable default for pool photos
  const textureScale = (physicalRepeatM * pixelsPerMeter) / textureImage.width;

  return (
    <Line
      key={`texture-${mask.id}`}
      points={mask.path.points.flatMap(p => [p.x, p.y])}
      closed={true}
      fillPatternImage={textureImage}
      fillPatternScaleX={textureScale}
      fillPatternScaleY={textureScale}
      fillPatternRepeat="repeat"
      opacity={0.8}
      stroke="rgba(255, 255, 255, 0.3)"
      strokeWidth={1}
    />
  );
}