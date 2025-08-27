/**
 * Mask Canvas Layer
 * Renders all editor masks using the MaskRenderer component
 */

import { Layer, Line } from 'react-konva';
import { useEditorStore } from '@/stores/editorSlice';

export function MaskCanvasLayer() {
  const { masks, transient, photo, activeTool } = useEditorStore();

  if (!photo) {
    return <Layer listening={false} />;
  }

  const imageWidth = photo.width || 800;
  const imageHeight = photo.height || 600;

  return (
    <>
      {/* E. CANVAS LAYERS MUST RENDER THE SAME MASK ARRAY */}
      <Layer id="MaskDrawing" listening>
        {/* Render transient path for current tool */}
        {transient?.points?.length ? (
          <Line
            points={transient.points.flatMap(p => [p.x, p.y])}
            stroke="#34d399"
            strokeWidth={2}
            closed={activeTool === 'area'}
            opacity={0.9}
          />
        ) : null}
      </Layer>

      <Layer id="Masks" listening>
        {masks.map(m => (
          m.type === 'area'
            ? <Line 
                key={m.id} 
                points={m.path.points.flatMap(p => [p.x, p.y])} 
                closed 
                fill="rgba(52,211,153,.25)" 
                stroke="#10b981" 
                strokeWidth={2}
                onClick={() => {}}
              />
            : <Line 
                key={m.id} 
                points={m.path.points.flatMap(p => [p.x, p.y])} 
                stroke="#f59e0b" 
                strokeWidth={3}
                onClick={() => {}}
              />
        ))}
      </Layer>
    </>
  );
}