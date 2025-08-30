// client/src/components/canvas/MaskTexture.tsx
import { Group, Rect } from 'react-konva';
import Konva from 'konva';
import { useEffect, useMemo, useRef, useState } from 'react';
import { computePatternScale, preloadImage } from '../../canvas/texture-utils';
import { useMaterialsStore } from '../../state/materialsStore';
import { useEditorStore } from '@/stores/editorSlice';

type P = {
  maskId: string;
  polygon: { x:number; y:number }[];
  materialId: string;
  meta?: { scale?: number; rotationDeg?: number; offsetX?: number; offsetY?: number } | null;
};

export function MaskTexture({ maskId, polygon, materialId, meta }: P) {
  const stageScale = useEditorStore(s => s.zoom);
  const mat = useMaterialsStore(s => s.all().find(m => m.id === materialId));
  const texUrl = mat?.texture_url || mat?.thumbnail_url || '';

  const rectRef = useRef<Konva.Rect>(null);

  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let mounted = true;
    setImg(null);
    if (!texUrl) return;
    preloadImage(texUrl).then(i => { if (mounted) setImg(i); }).catch(err => {
      console.warn('[texture] load failed', texUrl, err);
    });
    return () => { mounted = false; };
  }, [texUrl]);

  const clipFunc = useMemo(() => {
    const pts = polygon || [];
    return function (this: Konva.Group, ctx: Konva.Context) {
      if (!pts.length) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.clip();
    };
  }, [polygon]);

  const bbox = useMemo(() => {
    const xs = polygon.map(p=>p.x), ys = polygon.map(p=>p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return { x:minX, y:minY, w:Math.max(1, maxX-minX), h:Math.max(1, maxY-minY) };
  }, [polygon]);

  useEffect(() => {
    const r = rectRef.current;
    if (!r || !img) return;
    const repeatPx = Math.max(32, meta?.scale ?? 256);        // world pixels per tile
    const ps = computePatternScale(img, repeatPx);            // world scale
    const sx = ps.x / stageScale;                             // convert to node scale
    const sy = ps.y / stageScale;

    r.fillPatternImage(img);
    r.fillPatternScale({ x: sx, y: sy });
    r.fillPatternRotation(meta?.rotationDeg ?? 0);
    r.fillPatternOffset({ x: meta?.offsetX ?? 0, y: meta?.offsetY ?? 0 });
    r.fillPatternRepeat('repeat');
    r.cache();
    r.getLayer()?.batchDraw();
  }, [img, meta?.scale, meta?.rotationDeg, meta?.offsetX, meta?.offsetY, stageScale]);

  if (!polygon?.length) return null;

  return (
    <Group listening={false} clipFunc={clipFunc}>
      <Rect ref={rectRef} x={bbox.x} y={bbox.y} width={bbox.w} height={bbox.h}
        fill={img ? undefined : 'rgba(0,0,0,0.04)'} />
    </Group>
  );
}