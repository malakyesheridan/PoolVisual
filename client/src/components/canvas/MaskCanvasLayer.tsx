/**
 * Mask Canvas Layer
 * Renders all editor masks using the MaskRenderer component
 */

import { Layer } from 'react-konva';
import { useEditorStore } from '@/stores/editorSlice';
import { MaskRenderer } from './MaskRenderer';

export function MaskCanvasLayer() {
  const { masks, selectedMaskId, selectMask, photo } = useEditorStore();

  if (!photo || !masks.length) {
    return <Layer listening={false} />;
  }

  const imageWidth = photo.width || 800;
  const imageHeight = photo.height || 600;

  return (
    <Layer listening={true}>
      {masks.map(mask => (
        <MaskRenderer
          key={mask.id}
          mask={mask}
          isSelected={selectedMaskId === mask.id}
          onSelect={() => selectMask(mask.id)}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
        />
      ))}
    </Layer>
  );
}