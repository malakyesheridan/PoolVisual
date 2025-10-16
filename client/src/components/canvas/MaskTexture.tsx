import React, { useEffect, useMemo, useRef } from 'react';
import { Group, Rect, Shape } from 'react-konva';
import Konva from 'konva';
import { patternScaleFor } from '../../canvas/pattern-scale';
import { loadTextureImage } from '../../canvas/texture-loader';

type Pt = { x: number; y: number };
type Material = { id: string; albedoURL: string; physicalRepeatM?: number; defaultTileScale?: number; };

export function MaskTexture({
  maskId,
  pts,
  stageScale,
  material,
  photoPxPerMeter, // optional; if undefined, fallback
  settings = { opacity: 100, tint: 0, edgeFeather: 0, intensity: 50 },
  imgFit, // Add imgFit parameter for coordinate transformation
}: {
  maskId: string;
  pts: Pt[];
  stageScale: number;
  material: Material;
  photoPxPerMeter?: number;
  imgFit?: { originX: number; originY: number; imgScale: number };
  settings?: { 
    opacity?: number; 
    tint?: number; 
    edgeFeather?: number; 
    intensity?: number;
    textureScale?: number;
    // Underwater settings
    blend?: number;
    refraction?: number;
    edgeSoftness?: number;
    depthBias?: number;
    highlights?: number;
    ripple?: number;
    materialOpacity?: number;
    contactOcclusion?: number;
    textureBoost?: number;
    underwaterVersion?: 'v1' | 'v2';
    meniscus?: number;
    softness?: number;
  };
}) {
  const baseRef = useRef<Konva.Rect>(null);
  const tintRef = useRef<Konva.Rect>(null);
  const layerRef = useRef<Konva.Layer | null>(null);

  // Get parent layer once
  useEffect(() => {
    layerRef.current = baseRef.current?.getLayer() ?? null;
  }, []);

  const geomKey = useMemo(() => {
    if (!pts.length) return 'empty';
    const p0 = pts[0], pn = pts[pts.length - 1];
    return `${pts.length}:${p0.x.toFixed(1)},${p0.y.toFixed(1)}:${pn.x.toFixed(1)},${pn.y.toFixed(1)}`;
  }, [pts]);

  const clipFunc = useMemo(() => {
    if (!pts || pts.length < 3) return undefined;
    
    // Convert image coordinates to screen coordinates for clipping
    const poly = pts.map(p => {
      if (imgFit) {
        return {
          x: p.x * imgFit.imgScale + imgFit.originX,
          y: p.y * imgFit.imgScale + imgFit.originY
        };
      } else {
        return { x: p.x, y: p.y };
      }
    });
    
    return function (this: Konva.Group, ctx: Konva.Context) {
      if (!poly.length) return;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.clip();
    };
  }, [geomKey, imgFit]); // Add imgFit to dependencies

  // Compute repeatPx
  const repeatPx = useMemo(() => {
    const fallback = Math.max(32, Math.min(1024, Math.floor(256 * (material.defaultTileScale ?? 1))));
    if (photoPxPerMeter && material.physicalRepeatM) return Math.max(32, Math.min(2048, photoPxPerMeter * material.physicalRepeatM));
    return fallback;
  }, [material, photoPxPerMeter]);

  // Apply base texture when image is ready
  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        // Check if material has texture URL
        if (!material.albedoURL) {
          console.warn('[MaterialTextureMissing]', { 
            materialId: material.id, 
            materialName: material.name,
            url: material.albedoURL 
          });
          
          // Render subtle patterned fallback
          const rect = baseRef.current;
          if (rect) {
            rect.fill('#f0f0f0');
            rect.fillPatternImage(null);
            rect.fillPatternRepeat('no-repeat');
            rect.fillPatternScale({ x: 1, y: 1 });
            rafBatch();
          }
          return;
        }

        console.log('[ED/TEX:LOAD]', { url: material.albedoURL, status: 'loading' });
        console.log('[Editor:TextureLoad]', { url: material.albedoURL, status: 'loading' });
        const img = await loadTextureImage(material.albedoURL);
        if (stopped) return;
        const rect = baseRef.current;
        if (!rect) return;

        console.log('[ED/TEX:LOAD]', { url: material.albedoURL, status: 'ok', cacheHit: img.complete && img.naturalWidth > 0 });
        console.log('[Editor:TextureLoad]', { url: material.albedoURL, status: 'ok' });

        // Compute base pattern scale
        const base = patternScaleFor(img, repeatPx);
        
        // Apply user texture scale multiplier
        const userScale = (settings.textureScale ?? 100) / 100;
        
        // Apply zoom invariance
        const sx = (base.x * userScale) / stageScale;
        const sy = (base.y * userScale) / stageScale;

        rect.fillPatternImage(img);
        rect.fillPatternRepeat('repeat');
        rect.fillPatternScale({ x: sx, y: sy });
        rect.fillPatternOffset({ x: 0, y: 0 });

        // Filters for intensity - stable implementation
        const intensity = settings.intensity ?? 50;
        if (intensity !== 50) {
          const contrast = (intensity - 50) / 50; // range -1..+1
          const brightness = (intensity - 50) / 200; // small brighter/darker
          rect.filters([Konva.Filters.Contrast, Konva.Filters.Brighten]);
          (rect as any).contrast(contrast);
          (rect as any).brightness(brightness);
          rect.cache({ drawBorder: false });
        } else {
          rect.filters([]);
          rect.clearCache();
        }

        rafBatch();
        console.log('[ED/TEX:APPLY]', {
          maskId,
          materialId: material.id,
          scale: { sx, sy, userScale, stageScale }
        });
        console.log('[Editor:TextureApplied]', {
          maskId,
          materialId: material.id,
          repeatPx,
          scale: { sx, sy, userScale, stageScale }
        });
      } catch (e) {
        console.error('[ED/TEX:LOAD]', { url: material.albedoURL, status: 'err', error: e });
        console.error('[Editor:TextureLoad]', { url: material.albedoURL, status: 'err', error: e });
        
        // Render subtle patterned fallback on load failure
        const rect = baseRef.current;
        if (rect) {
          rect.fill('#f0f0f0');
          rect.fillPatternImage(null);
          rect.fillPatternRepeat('no-repeat');
          rect.fillPatternScale({ x: 1, y: 1 });
          rafBatch();
        }
      }
    })();
    return () => { stopped = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.albedoURL, repeatPx, stageScale, geomKey, settings.intensity, settings.textureScale]);

  // Opacity & Tint overlay each render - debounced for smooth sliders
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const o = Math.max(0, Math.min(1, (settings.opacity ?? 70) / 100));
      baseRef.current?.opacity(o);

      const tint = Math.max(0, Math.min(1, (settings.tint ?? 55) / 100)) * 0.6; // Cap at 0.6 for realism
      if (tintRef.current) {
        tintRef.current.opacity(tint);
        tintRef.current.globalCompositeOperation('multiply');
      }
      rafBatch();
    }, 16); // Debounce to 16ms (one RAF)

    return () => clearTimeout(timeoutId);
  }, [settings.opacity, settings.tint]);

  // Edge feather (destination-out) invariant to zoom
  const featherStroke = useMemo(
    () => Math.max(0, (settings.edgeFeather ?? 0) / Math.max(0.0001, stageScale)),
    [settings.edgeFeather, stageScale]
  );

  function rafBatch() {
    if (!layerRef.current) return;
    requestAnimationFrame(() => layerRef.current?.batchDraw());
  }

  // Don't render if we don't have valid points or clipFunc
  if (!pts || pts.length < 3 || !clipFunc) {
    return null;
  }

  return (
    <Group clipFunc={clipFunc}>
      {/* Base texture (full-viewport rect in world space) */}
      <Rect ref={baseRef} x={0} y={0} width={1e5} height={1e5} listening={false} />

      {/* Tint overlay (multiply) */}
      <Rect
        ref={tintRef}
        x={0}
        y={0}
        width={1e5}
        height={1e5}
        listening={false}
        fill="white"
        opacity={0}
      />

      {/* Feather: draw stroke along polygon with destination-out */}
      {featherStroke > 0 && (
        <Shape
          sceneFunc={(ctx, shape) => {
            if (!pts.length) return;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
          stroke="black"
          strokeWidth={featherStroke}
          shadowBlur={featherStroke}
          globalCompositeOperation="destination-out"
          listening={false}
        />
      )}
    </Group>
  );
}