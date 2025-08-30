import { Group, Rect } from 'react-konva';
import Konva from 'konva';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadTextureImage, patternScaleFor } from '../../lib/textureLoader';
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
  const material = useMaterialsStore(s => s.all().find(m => m.id === materialId));
  const url = material?.texture_url || material?.thumbnail_url || '';

  const rectRef = useRef<Konva.Rect>(null);
  const [img, setImg] = useState<HTMLImageElement|null>(null);

  // Load (with proxy fallback)
  useEffect(() => {
    let alive = true;
    setImg(null);
    if (!url) return;
    loadTextureImage(url)
      .then(i => { if (alive) setImg(i); })
      .catch(err => { console.warn('[texture] load failed', url, err); });
    return () => { alive = false; };
  }, [url]);

  // Clip poly
  const clipFunc = useMemo(() => {
    const pts = polygon ?? [];
    return function (this: Konva.Group, ctx: Konva.Context) {
      if (!pts.length) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.clip();
    };
  }, [polygon]);

  // Bounding box
  const bbox = useMemo(() => {
    const xs = polygon.map(p=>p.x), ys = polygon.map(p=>p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return { x:minX, y:minY, w:Math.max(1, maxX-minX), h:Math.max(1, maxY-minY) };
  }, [polygon]);

  // Apply pattern on changes
  useEffect(() => {
    const r = rectRef.current;
    if (!r || !img) return;

    const repeatPx = Math.max(32, meta?.scale ?? 256); // world pixels per tile (precomputed from ppm)
    const ps = patternScaleFor(img, repeatPx);

    // Compensate for stage zoom: pattern scale is in node space
    const sx = ps.x / stageScale;
    const sy = ps.y / stageScale;

    r.fillPatternImage(img);
    r.fillPatternScale({ x: sx, y: sy });
    r.fillPatternRotation(meta?.rotationDeg ?? 0);
    r.fillPatternOffset({ x: meta?.offsetX ?? 0, y: meta?.offsetY ?? 0 });
    r.fillPatternRepeat('repeat');
    r.cache();                  // ensure paint
    r.getLayer()?.batchDraw();

    // Debug (remove later)
    console.info('[texture] render', { maskId, img: img.width+'x'+img.height, repeatPx, stageScale, sx, sy });
  }, [img, meta?.scale, meta?.rotationDeg, meta?.offsetX, meta?.offsetY, stageScale, maskId]);

  if (!polygon?.length || !material) return null;

  return (
    <Group listening={false} clipFunc={clipFunc}>
      <Rect ref={rectRef} x={bbox.x} y={bbox.y} width={bbox.w} height={bbox.h}
            fill={img ? undefined : 'rgba(0,0,0,0.04)'} />
    </Group>
  );
}