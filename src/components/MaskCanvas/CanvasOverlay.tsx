import { useState, useEffect, useMemo } from 'react';
import { MaskingEngine } from '../../masking/engine';
import { makeOverlayProjector } from '../../masking/overlayProjector';
import { ensureMaterialsLoaded, getTextureUrl } from '../../materials/registry';

interface CanvasOverlayProps {
  engine: MaskingEngine;
  camera: { scale: number; panX: number; panY: number };
  imgFit: { originX: number; originY: number; imgScale: number };
  viewportEl: HTMLElement;
  masks?: Record<string, any>;
  selectedId?: string;
}

export function CanvasOverlay({ engine, camera, imgFit, viewportEl, masks = {}, selectedId }: CanvasOverlayProps) {
  const [draft, setDraft] = useState(engine.getDraft());
  const dpr = window.devicePixelRatio || 1;

  // ✅ Load materials once; non-blocking (first frame may show fallback fill, then textures appear)
  useEffect(() => {
    ensureMaterialsLoaded();
  }, []);

  const projector = useMemo(() => {
    return makeOverlayProjector(viewportEl, camera, dpr, imgFit);
  }, [viewportEl, camera.scale, camera.panX, camera.panY, dpr, imgFit.originX, imgFit.originY, imgFit.imgScale]);

  useEffect(() => {
    const unsubscribe = engine.subscribe(() => {
      setDraft(engine.getDraft());
    });
    return unsubscribe;
  }, [engine]);

  const renderDraftPath = () => {
    if (!draft || draft.pts.length < 2) return null;

    const screenPoints = draft.pts.map(pt => projector.toLocalFromImage(pt.x, pt.y));

    const pathData = screenPoints.reduce((path, point, index) => {
      return index === 0 ? `M ${point.x} ${point.y}` : `${path} L ${point.x} ${point.y}`;
    }, '');

    return (
      <path
        data-testid="draft-path"
        d={pathData}
        stroke="#ff7a1a"
        strokeWidth="2"
        fill="none"
        style={{ vectorEffect: 'non-scaling-stroke' }}
      />
    );
  };

  const renderDraftVertices = () => {
    if (!draft || draft.pts.length === 0) return null;

    return draft.pts.map((pt, index) => {
      const p = projector.toLocalFromImage(pt.x, pt.y);
      return <circle key={index} cx={p.x} cy={p.y} r="2" fill="#ff7a1a" />;
    });
  };

  const renderFinalizedMasks = () => {
    const rect = viewportEl.getBoundingClientRect();
    const overlayW = rect.width;
    const overlayH = rect.height;

    return Object.entries(masks).map(([maskId, mask]) => {
      if (!mask?.pts || mask.pts.length < 3) return null;

      const localPts = mask.pts.map((pt: any) => projector.toLocalFromImage(pt.x, pt.y));
      const outlinePoints = localPts.map((p: any) => `${p.x},${p.y}`).join(' ');
      const isSelected = selectedId === maskId;

      const textureUrl = getTextureUrl(mask.materialId);
      if (textureUrl) {
        // Debug once per render
        console.log('[MaterialRender]', { maskId, materialId: mask.materialId, textureUrl });
      }

      // Build a <path> d for the clipPath
      const clipD = localPts.reduce(
        (acc: string, p: any, i: number) => acc + (i ? ` L ${p.x} ${p.y}` : `M ${p.x} ${p.y}`),
        ''
      ) + ' Z';

      return (
        <g key={maskId}>
          {/* Define a clipPath per mask */}
          <defs>
            <clipPath id={`mask-clip-${maskId}`}>
              <path d={clipD} />
            </clipPath>
          </defs>

          {textureUrl ? (
            <>
              {/* Optional subtle loading/fallback fill behind image */}
              <polygon points={outlinePoints} fill="rgba(0,179,126,0.06)" clipPath={`url(#mask-clip-${maskId})`} />
              {/* Texture clipped to polygon; one image covering the viewport area */}
              <image
                href={textureUrl}
                x={0}
                y={0}
                width={overlayW}
                height={overlayH}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#mask-clip-${maskId})`}
                opacity={0.95}
                style={{ imageRendering: 'auto' }}
              />
            </>
          ) : (
            // Fallback flat fill (no material assigned or not found)
            <polygon points={outlinePoints} fill="rgba(0,179,126,0.10)" />
          )}

          {/* Outline - toggle visibility without killing hit testing */}
          <polygon
            points={outlinePoints}
            fill="none"
            stroke={isSelected ? "#2563eb" : "rgba(0,0,0,0)"}
            strokeWidth={isSelected ? 2 : 0}
            style={{ 
              vectorEffect: 'non-scaling-stroke',
              pointerEvents: 'auto' // Keep pointer events even when stroke is hidden
            }}
            data-mask-shape="true" // marker for SVG
            data-mask-id={mask.id} // for centralized handler
            onMouseDown={(e) => {
              e.stopPropagation(); // block stage handler
              // Note: SVG component would need selection handler passed as prop
            }}
          />
        </g>
      );
    });
  };

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10000,
        width: '100%',
        height: '100%'
      }}
    >
      {renderDraftPath()}
      {renderDraftVertices()}
      {renderFinalizedMasks()}
    </svg>
  );
}
