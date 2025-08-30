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

  // fat hit area to make taps reliable
  const onSelect = (e:any) => {
    e.cancelBubble = true;
    selectMask(id);
  };

  if (kind !== 'area') {
    // TODO: render linear/band shapes similarly; selection handler remains the same
    return null;
  }

  return (
    <Group onMouseDown={onSelect} onTouchStart={onSelect} onClick={onSelect}>
      <Line points={points} closed stroke={isSelected ? color : '#10b981'}
            strokeWidth={isSelected ? 3 : 2} lineJoin="round" lineCap="round" listening={false} />
      {/* An invisible wide stroke to make selection easy */}
      <Line points={points} closed stroke="rgba(0,0,0,0)" strokeWidth={18} hitStrokeWidth={18} />
    </Group>
  );
}