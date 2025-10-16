import React, { useRef, useEffect } from 'react';
import { MaskingEngine } from '../../masking/engine';
import { AreaTool } from './AreaTool';
import { PolygonTool } from './PolygonTool';
import { SelectTool } from './SelectTool';
import { KeyBindings } from './KeyBindings';
import { CanvasOverlay } from './CanvasOverlay';

interface MaskCanvasProps {
  activeTool: 'area' | 'polygon' | 'select' | null;
  camera: { scale: number; panX: number; panY: number };
  imgFit: { originX: number; originY: number; imgScale: number };
  masks: Record<string, any>;
  selectedId?: string | null;
  onMaskSelect: (id: string | null) => void;
}

export function MaskCanvas({
  activeTool,
  camera,
  imgFit,
  masks,
  selectedId,
  onMaskSelect
}: MaskCanvasProps) {
  const engineRef = useRef(new MaskingEngine());
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Temporary dev banner and console log
  useEffect(() => {
    console.info('[MaskingOverhaul] mounted');
  }, []);

  return (
    <div
      ref={viewportRef}
      data-testid="mask-viewport"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%'
      }}
    >
      {/* Temporary dev banner */}
      <div
        data-testid="masking-banner"
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          backgroundColor: '#ff6b35',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
          zIndex: 1001,
          pointerEvents: 'none',
          fontFamily: 'monospace'
        }}
      >
        MASKING OVERHAUL ACTIVE
      </div>

      {/* SVG OVERLAY COMPONENTS DISABLED - USING KONVA SYSTEM */}
      {/* <KeyBindings engine={engineRef.current} />
      
      {viewportRef.current && (
        <CanvasOverlay
          engine={engineRef.current}
          camera={camera}
          imgFit={imgFit}
          viewportEl={viewportRef.current}
          masks={masks}
          selectedId={selectedId}
        />
      )}
      
      {activeTool === 'area' && viewportRef.current && (
        <AreaTool
          engine={engineRef.current}
          camera={camera}
          imgFit={imgFit}
          viewportEl={viewportRef.current}
        />
      )}
      
      {activeTool === 'polygon' && viewportRef.current && (
        <PolygonTool
          engine={engineRef.current}
          camera={camera}
          imgFit={imgFit}
          viewportEl={viewportRef.current}
        />
      )}
      
      {activeTool === 'select' && viewportRef.current && (
        <SelectTool
          engine={engineRef.current}
          camera={camera}
          imgFit={imgFit}
          viewportEl={viewportRef.current}
          masks={masks}
          onMaskSelect={onMaskSelect}
        />
      )} */}
    </div>
  );
}
