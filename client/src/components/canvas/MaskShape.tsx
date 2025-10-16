// client/src/components/canvas/MaskShape.tsx
import { Group, Line, Shape } from 'react-konva';
import { useMemo } from 'react';
import { useEditorStore } from '@/stores/editorSlice';

type P = {
  id: string;
  kind: 'area'|'linear'|'band';
  polygon?: { x:number; y:number }[];
  isSelected: boolean;
  color?: string;
};

export function MaskShape({ id, kind, polygon=[], isSelected, color='#2dd4bf' }: P) {
  const selectMask = useEditorStore(s => s.setSelectedMask);

  const points = useMemo(() => polygon.flatMap(p => [p.x, p.y]), [polygon]);

  // Individual mask handlers removed - using centralized stage handler

  if (kind !== 'area') {
    // TODO: render linear/band shapes similarly; selection handler remains the same
    return null;
  }

  return (
    <Group
      name="mask-shape"
      listening={true}
      isMask={true} // custom attr
      maskId={id} // for centralized handler
    >
      {/* Invisible hit area covering entire mask */}
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
        maskId={id} // for centralized handler
      />
      {/* Visible outline */}
      <Line 
        points={points} 
        closed 
        stroke={isSelected ? '#2563eb' : 'rgba(0,0,0,0)'}
        strokeWidth={isSelected ? 1.5 : 0}
        lineJoin="round" 
        lineCap="round" 
        listening={false} // let the hit area handle clicks
        perfectDrawEnabled={false}
      />
    </Group>
  );
}