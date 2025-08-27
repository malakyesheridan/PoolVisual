/**
 * Canvas Stage - Reliable, Testable Implementation
 * One set of handlers, correct layer order
 */

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Image } from 'react-konva';
import { Stage as StageType } from 'konva/lib/Stage';
import useImage from 'use-image';
import { useEditorStore } from '@/stores/editorSlice';
import { InputRouter } from '@/editor/input/InputRouter';

const BUILD_TIMESTAMP = new Date().toISOString();
const RANDOM_ID = Math.random().toString(36).substring(2, 8);

console.log(`
🎯 MOUNTED CANVAS AUDIT
======================
File: client/src/components/canvas/CanvasStage.tsx
Build: ${BUILD_TIMESTAMP}
ID: ${RANDOM_ID}
======================
`);

interface CanvasStageProps {
  className?: string;
  width?: number;
  height?: number;
}

export function CanvasStage({ className, width = 800, height = 600 }: CanvasStageProps) {
  console.info('[CanvasStage] mounted from:', import.meta?.url || 'CanvasStage.tsx');
  
  const stageRef = useRef<StageType>(null);
  const [stageDimensions, setStageDimensions] = useState({ width, height });

  // Destructure state - individual selectors to prevent infinite loops
  const masks = useEditorStore(s => s.masks);
  const transient = useEditorStore(s => s.transient);
  const calState = useEditorStore(s => s.calState);
  const calTemp = useEditorStore(s => s.calTemp);
  const activeTool = useEditorStore(s => s.activeTool);
  const photo = useEditorStore(s => s.photo);
  const zoom = useEditorStore(s => s.zoom);
  const pan = useEditorStore(s => s.pan);

  // Create InputRouter with store reference
  const router = useMemo(() => new InputRouter(useEditorStore), []);

  const [backgroundImage] = useImage(photo?.originalUrl || '', 'anonymous');

  // Stage is draggable only when active tool is 'hand'
  useEffect(()=>{ 
    stageRef.current?.draggable(activeTool==='hand'); 
  },[activeTool]);

  // Update stage dimensions
  useEffect(() => {
    const updateStageDimensions = () => {
      if (width && height) {
        setStageDimensions({ width, height });
      }
    };

    updateStageDimensions();
    window.addEventListener('resize', updateStageDimensions);
    return () => window.removeEventListener('resize', updateStageDimensions);
  }, [width, height]);

  // Calculate image positioning
  const imageProps = useMemo(() => {
    if (!backgroundImage) return null;

    const imageAspect = backgroundImage.width / backgroundImage.height;
    const stageAspect = stageDimensions.width / stageDimensions.height;

    let imageWidth, imageHeight;
    if (imageAspect > stageAspect) {
      imageWidth = stageDimensions.width;
      imageHeight = stageDimensions.width / imageAspect;
    } else {
      imageWidth = stageDimensions.height * imageAspect;
      imageHeight = stageDimensions.height;
    }

    return {
      width: imageWidth,
      height: imageHeight,
      x: (stageDimensions.width - imageWidth) / 2 + pan.x,
      y: (stageDimensions.height - imageHeight) / 2 + pan.y,
      scaleX: zoom,
      scaleY: zoom,
    };
  }, [backgroundImage, stageDimensions, pan, zoom]);

  return (
    <div className={className}>
      <Stage
        ref={stageRef}
        width={stageDimensions.width} 
        height={stageDimensions.height}
        onMouseDown={e=>router.handleDown(stageRef.current!,e)}
        onMouseMove={e=>router.handleMove(stageRef.current!,e)}
        onMouseUp={e=>router.handleUp(stageRef.current!,e)}
        onTouchStart={e=>router.handleDown(stageRef.current!,e)}
        onTouchMove={e=>router.handleMove(stageRef.current!,e)}
        onTouchEnd={e=>router.handleUp(stageRef.current!,e)}
      >
        <Layer id="Background" listening={false}>
          {backgroundImage && imageProps && (
            <Image
              image={backgroundImage}
              x={imageProps.x}
              y={imageProps.y}
              width={imageProps.width}
              height={imageProps.height}
              scaleX={imageProps.scaleX}
              scaleY={imageProps.scaleY}
            />
          )}
        </Layer>

        <Layer id="MaskDrawing" listening>
          {transient?.points?.length ? (
            <Line
              points={transient.points.flatMap(p=>[p.x,p.y])}
              stroke="#22c55e" strokeWidth={2} closed={transient.tool==='area'}
              opacity={0.9}
            />
          ):null}
        </Layer>

        {/* Material Layer - renders textures for masks with attached materials */}
        <Layer id="MaterialOverlay" listening={false}>
          {masks.map((mask) => {
            if (!mask.materialId || mask.type !== 'area') {
              return null;
            }
            
            // Simple material visualization - shows attached materials
            return (
              <Line
                key={`material-${mask.id}`}
                points={mask.path.points.flatMap(p => [p.x, p.y])}
                fill="rgba(100, 150, 255, 0.25)"
                stroke="rgba(100, 150, 255, 0.8)"
                strokeWidth={1}
                closed={true}
                opacity={0.6}
              />
            );
          })}
        </Layer>

        <Layer id="Masks" listening>
          {masks.map(m =>
            m.type==='area'
              ? <Line key={m.id} points={m.path.points.flatMap(p=>[p.x,p.y])} closed fill="rgba(16,185,129,.25)" stroke="#10b981" strokeWidth={2}/>
              : m.type==='waterline_band'
                ? <Line key={m.id} points={m.path.points.flatMap(p=>[p.x,p.y])} stroke="#8b5cf6" strokeWidth={3}/>
                : <Line key={m.id} points={m.path.points.flatMap(p=>[p.x,p.y])} stroke="#f59e0b" strokeWidth={3}/>
          )}
        </Layer>

        <Layer id="Calibration" listening>
          {calState!=='idle' && calTemp?.a && (
            <>
              <Circle x={calTemp.a.x} y={calTemp.a.y} radius={5} fill="#3B82F6" />
              {(calState==='placingB' && calTemp.preview) && (
                <Line points={[calTemp.a.x,calTemp.a.y, calTemp.preview.x,calTemp.preview.y]} stroke="#60A5FA" dash={[8,6]} strokeWidth={2}/>
              )}
              {(calState==='lengthEntry' && calTemp.b) && (
                <>
                  <Line points={[calTemp.a.x,calTemp.a.y, calTemp.b.x,calTemp.b.y]} stroke="#2563EB" strokeWidth={3}/>
                  <Circle x={calTemp.b.x} y={calTemp.b.y} radius={5} fill="#3B82F6" />
                </>
              )}
            </>
          )}
        </Layer>
      </Stage>
    </div>
  );
}