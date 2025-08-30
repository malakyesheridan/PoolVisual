import { Group, Rect } from 'react-konva';
import Konva from 'konva';
import { useEffect, useMemo, useRef, useState } from 'react';
import { preloadImage, computePatternScale } from '../../canvas/texture-utils';
import { useEditorStore } from '@/stores/editorSlice';
import { useMaterialsStore } from '@/state/materialsStore';

type P = {
  maskId: string;
  polygon: { x: number; y: number }[];     // mask polygon (world coords)
  materialId: string;
  materialMeta?: { scale?: number; rotationDeg?: number; offsetX?: number; offsetY?: number } | null | undefined;
};

/**
 * Renders a repeating texture inside the given polygon using Konva clip + Rect with fillPatternImage.
 * The Rect is large (viewport-sized) and sits under the clip so the pattern fills the shape.
 * It recomputes on stage zoom changes so that pattern stays world-scale-true.
 */
export function MaskTexture({ maskId, polygon, materialId, materialMeta }: P) {
  const stageScale = useEditorStore(s => s.zoom);

  const materials = useMaterialsStore(s => s.items);
  const material = materials[materialId];
  const textureUrl = material?.texture_url || '';

  const groupRef = useRef<Konva.Group>(null);
  const rectRef  = useRef<Konva.Rect>(null);

  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load texture
  useEffect(() => {
    let mounted = true;
    setError(null);
    setImg(null);
    if (!textureUrl) return;
    preloadImage(textureUrl)
      .then(i => { if (mounted) setImg(i); })
      .catch(e => { if (mounted) setError(e.message); });
    return () => { mounted = false; };
  }, [textureUrl]);

  // Clip func for polygon
  const clipFunc = useMemo(() => {
    const pts = polygon ?? [];
    return function (this: Konva.Group, ctx: Konva.Context) {
      if (!pts?.length) return;
      ctx.beginPath();
      ctx.moveTo(pts[0]?.x ?? 0, pts[0]?.y ?? 0);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i]?.x ?? 0, pts[i]?.y ?? 0);
      }
      ctx.closePath();
      ctx.clip();
    };
  }, [polygon]);

  // Bounding box (for rect sizing)
  const bbox = useMemo(() => {
    if (!polygon?.length) return { x: 0, y: 0, w: 1, h: 1 };
    const xs = polygon.map(p => p.x);
    const ys = polygon.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  }, [polygon]);

  // Apply pattern when the image or stage scale changes
  useEffect(() => {
    const rect = rectRef.current;
    if (!rect || !img) return;

    // materialMeta.scale currently holds "repeatPx" placeholder from applyMaterialToMask; derive pattern scale now:
    const repeatPx = Math.max(32, materialMeta?.scale ?? 256); // world pixels per tile (min clamp)
    const patternScale = computePatternScale(img, repeatPx);

    rect.fillPatternImage(img);
    // Konva's pattern scale is in node space; correct for stage scale so world-tied repeat looks consistent:
    const sx = patternScale.x / stageScale;
    const sy = patternScale.y / stageScale;
    rect.fillPatternScale({ x: sx, y: sy });
    rect.fillPatternRotation(materialMeta?.rotationDeg ?? 0);
    rect.fillPatternOffset({ x: materialMeta?.offsetX ?? 0, y: materialMeta?.offsetY ?? 0 });
    rect.fillPatternRepeat('repeat');
    rect.cache(); // ensure pattern paints reliably
    rect.getLayer()?.batchDraw();
  }, [img, materialMeta?.scale, materialMeta?.rotationDeg, materialMeta?.offsetX, materialMeta?.offsetY, stageScale]);

  if (!polygon?.length || !material) return null;

  return (
    <Group ref={groupRef} listening={false} clipFunc={clipFunc}>
      {/* Large rect covering bbox; pattern will fill & be clipped by the Group */}
      <Rect ref={rectRef}
        x={bbox.x} y={bbox.y} width={bbox.w} height={bbox.h}
        fill={img ? '' : 'rgba(0,0,0,0.04)'} // subtle placeholder while loading
      />
    </Group>
  );
}