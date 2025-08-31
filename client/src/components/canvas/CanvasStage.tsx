/**
 * Canvas Stage - Reliable, Testable Implementation
 * One set of handlers, correct layer order
 */

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Image as KonvaImage, Group } from 'react-konva';
import { Stage as StageType } from 'konva/lib/Stage';
import useImage from 'use-image';
import { useEditorStore } from '@/stores/editorSlice';
import { useEditorStore as useNewEditorStore } from '@/state/editorStore';
import { useMaterialsStore } from '@/state/materialsStore';
import { InputRouter } from '@/editor/input/InputRouter';
import { MaskTexture } from './MaskTexture';
import { MaskShape } from './MaskShape';
import { getAllMasks, getMaskById, patchMask, pushUndo, getPxPerMeter } from './modelBindings';
import { MaterialRenderer, type MaskGeometry, type RenderConfig } from '@/render/MaterialRenderer';
import { PhotoSpace, PhotoTransform, makeTransform, calculateFitScale, imgToScreen, screenToImg } from '@/render/photoTransform';
import { usePhoto } from '@/state/photoTransformStore';

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
  const stageRef = useRef<StageType>(null);
  const [stageDimensions, setStageDimensions] = useState({ width, height });
  const materialRendererRef = useRef<MaterialRenderer | null>(null);
  const [renderV2Enabled, setRenderV2Enabled] = useState(false);
  

  // Destructure state - individual selectors to prevent infinite loops
  const masks = useEditorStore(s => s.masks);
  const transient = useEditorStore(s => s.transient);
  const calState = useEditorStore(s => s.calState);
  const calTemp = useEditorStore(s => s.calTemp);
  const activeTool = useEditorStore(s => s.activeTool);
  const photo = useEditorStore(s => s.photo);
  const zoom = useEditorStore(s => s.zoom);
  const pan = useEditorStore(s => s.pan);
  const selectedMaskId = useEditorStore(s => s.selectedMaskId);
  const selectMask = useEditorStore(s => s.selectMask);

  // New editor store for robust selection and material application
  const newSelectedMaskId = useNewEditorStore(s => s.selectedMaskId);
  const newSelectMask = useNewEditorStore(s => s.setSelectedMask);
  const registerDeps = useNewEditorStore(s => (s as any).registerDeps);

  // Register dependencies once - only if registerDeps exists
  useEffect(() => {
    if (registerDeps && typeof registerDeps === 'function') {
      registerDeps({
        listMasks: getAllMasks,
        getMask: getMaskById,
        patchMask: patchMask,
        pushUndo: pushUndo,
        getPxPerMeter: getPxPerMeter,
      });
    }
  }, [registerDeps]);

  // Materials store for texture lookup
  const materials = useMaterialsStore(s => s.items);

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

  // Calculate PhotoSpace and canonical transform
  const { photoSpace, photoTransform } = useMemo(() => {
    if (!backgroundImage) return { photoSpace: null, photoTransform: null };

    // Calculate fit scale to contain image in stage
    const fitScale = calculateFitScale(
      backgroundImage.width,
      backgroundImage.height,
      stageDimensions.width,
      stageDimensions.height
    );

    const space: PhotoSpace = {
      imgW: backgroundImage.width,
      imgH: backgroundImage.height,
      fitScale,
      zoom,
      panX: pan.x,
      panY: pan.y
    };

    const transform = makeTransform({
      ...space,
      containerW: stageDimensions.width,
      containerH: stageDimensions.height
    });

    return { photoSpace: space, photoTransform: transform };
  }, [backgroundImage, stageDimensions, zoom, pan]);

  // Initialize WebGL renderer
  useEffect(() => {
    const initRenderer = async () => {
      try {
        console.info('[CanvasStage] Starting WebGL renderer initialization...');
        
        if (!materialRendererRef.current) {
          console.info('[CanvasStage] Creating MaterialRenderer instance...');
          materialRendererRef.current = new MaterialRenderer();
          
          console.info('[CanvasStage] Calling initialize...');
          const initialized = await materialRendererRef.current.initialize('gl-layer');
          setRenderV2Enabled(initialized);
          
          if (initialized) {
            console.info('🚀 [CanvasStage] WebGL V2 renderer ENABLED - photo-realistic materials active');
            
            // Subscribe to PhotoSpace transform updates for real-time WebGL panning
            const unsubscribe = usePhoto.subscribe((state) => {
              if (materialRendererRef.current) {
                materialRendererRef.current.setTransform(state.T);
              }
            });
            
            // Store unsubscribe function for cleanup
            (materialRendererRef.current as any).unsubscribeTransform = unsubscribe;
          } else {
            console.info('⚠️ [CanvasStage] WebGL V2 failed - using fallback Konva renderer');
          }
        }
      } catch (error) {
        console.error('[CanvasStage] WebGL initialization error:', error);
        setRenderV2Enabled(false);
      }
    };

    initRenderer();

    return () => {
      if (materialRendererRef.current) {
        // Cleanup subscription
        if ((materialRendererRef.current as any).unsubscribeTransform) {
          (materialRendererRef.current as any).unsubscribeTransform();
        }
        materialRendererRef.current.destroy();
        materialRendererRef.current = null;
      }
    };
  }, []);

  // Update WebGL renderer when masks or materials change
  // Update WebGL renderer when masks OR photoTransform changes
  useEffect(() => {
    const updateRenderer = async () => {
      if (!renderV2Enabled || !materialRendererRef.current) return;

      // Convert masks to WebGL format - store vertices in IMAGE SPACE
      const webglMasks: MaskGeometry[] = getAllMasks()
        .filter(mask => mask.material_id && mask.kind === 'area' && mask.polygon?.length)
        .map(mask => {
          // Convert screen coordinates to image coordinates for unified coordinate system
          const imagePoints = mask.polygon!.map((point: { x: number; y: number }) => {
            if (!photoTransform) return point;
            // Convert from screen space to image space - this normalizes all coordinates
            return screenToImg(photoTransform, point.x, point.y);
          });
          
          return {
            maskId: mask.id,
            points: imagePoints, // Now in image coordinate space
            materialId: mask.material_id!,
            meta: mask.material_meta
          };
        });

      // Get render configuration using PhotoSpace transform
      const pxPerMeter = getPxPerMeter() || 100; // Default if no calibration
      
      // Only create config if we have valid transform data
      if (!photoSpace || !photoTransform) {
        return; // Skip WebGL rendering without valid transforms
      }
      
      const config: RenderConfig = {
        pxPerMeter,
        stageScale: zoom,
        sceneSize: stageDimensions,
        // PhotoSpace transform data for WebGL positioning
        imageTransform: {
          x: photoTransform.originX,
          y: photoTransform.originY,
          scaleX: photoTransform.S,
          scaleY: photoTransform.S,
          imageWidth: photoSpace.imgW,
          imageHeight: photoSpace.imgH
        }
      };

      try {
        // Convert materials record to array with proper type compatibility
        const materialsArray = Object.values(materials).map(m => ({
          ...m,
          isActive: true,
          createdAt: new Date().toISOString()
        }));
        await materialRendererRef.current.renderMasks(webglMasks, materialsArray, config);
      } catch (error) {
        console.error('[CanvasStage] WebGL render failed:', error);
      }
    };

    updateRenderer();
  }, [masks, materials, zoom, stageDimensions, renderV2Enabled, photoSpace, photoTransform]);

  return (
    <div className={className} style={{ position: 'relative' }}>
      {/* Konva Stage - Base layer with image */}
      <div style={{ position: 'relative', zIndex: 1 }}>
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
          {backgroundImage && photoSpace && photoTransform && (
            <Group
              x={photoTransform.originX}
              y={photoTransform.originY}
              scaleX={photoTransform.S}
              scaleY={photoTransform.S}
              listening={false}
            >
              <KonvaImage
                image={backgroundImage}
                x={0}
                y={0}
                width={photoSpace.imgW}
                height={photoSpace.imgH}
                listening={false}
              />
            </Group>
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

        {/* Material Layer - fallback to Konva when WebGL is disabled */}
        {!renderV2Enabled && (
          <Layer id="MaterialOverlay" listening={false}>
            {getAllMasks().filter(mask => mask.material_id && mask.kind === 'area' && mask.polygon?.length).map((mask) => (
              <MaskTexture
                key={`material-${mask.id}`}
                maskId={mask.id}
                polygon={mask.polygon!}
                materialId={mask.material_id!}
                meta={mask.material_meta}
              />
            ))}
          </Layer>
        )}

        {/* Enhanced Mask Selection - combine with existing masks layer to reduce layer count */}

        <Layer id="Masks" listening>
          {photoSpace && photoTransform && (
            <Group
              x={photoTransform.originX}
              y={photoTransform.originY}
              scaleX={photoTransform.S}
              scaleY={photoTransform.S}
              listening={true}
            >
              {/* Diagnostic anchor dots to verify coordinate system alignment */}
              <Circle x={0} y={0} radius={4 / photoTransform.S} fill="#ff00aa" />
              <Circle x={photoSpace.imgW} y={0} radius={4 / photoTransform.S} fill="#ff00aa" />
              <Circle x={0} y={photoSpace.imgH} radius={4 / photoTransform.S} fill="#ff00aa" />
              
              {masks.map(m => {
            const isSelected = selectedMaskId === m.id;
            const isNewSelected = newSelectedMaskId === m.id;
            const handleSelect = (e: any) => {
              e.cancelBubble = true;
              selectMask(m.id);
              if (newSelectMask && typeof newSelectMask === 'function') {
                newSelectMask(m.id);
              }
            };
            
            const hasMaterial = !!(m as any).materialId || !!(m as any).material_id;
            
            // Mask points should already be in image coordinate space
            // The photoGroup handles coordinate transformation
            
            // Scale-invariant stroke widths and hit areas
            const strokeWidth = (isSelected || isNewSelected ? 4 : 2) / photoTransform.S;
            const strokeWidthWaterline = (isSelected || isNewSelected ? 5 : 3) / photoTransform.S;
            const strokeWidthMeasure = (isSelected || isNewSelected ? 5 : 3) / photoTransform.S;
            const hitWidth = 20 / photoTransform.S;
            
            return (
              m.type==='area'
                ? <Line 
                    key={m.id} 
                    points={m.path.points.flatMap((p: { x: number; y: number }) => {
                      // Convert to image space for unified coordinate system with WebGL
                      const imgPt = screenToImg(photoTransform, p.x, p.y);
                      return [imgPt.x, imgPt.y];
                    })} 
                    closed 
                    fill={hasMaterial && renderV2Enabled ? 'transparent' : hasMaterial ? 'transparent' : "rgba(16,185,129,.25)"} 
                    stroke={isSelected || isNewSelected ? "#3b82f6" : "#10b981"} 
                    strokeWidth={strokeWidth}
                    onClick={handleSelect}
                    onTap={handleSelect}
                    hitStrokeWidth={hitWidth}
                  />
                : m.type==='waterline_band'
                  ? <Line 
                      key={m.id} 
                      points={m.path.points.flatMap(p=>[p.x,p.y])} 
                      stroke={isSelected || isNewSelected ? "#3b82f6" : "#8b5cf6"} 
                      strokeWidth={strokeWidthWaterline}
                      onClick={handleSelect}
                      onTap={handleSelect}
                      hitStrokeWidth={hitWidth}
                    />
                  : <Line 
                      key={m.id} 
                      points={m.path.points.flatMap(p=>[p.x,p.y])} 
                      stroke={isSelected || isNewSelected ? "#3b82f6" : "#f59e0b"} 
                      strokeWidth={strokeWidthMeasure}
                      onClick={handleSelect}
                      onTap={handleSelect}
                      hitStrokeWidth={hitWidth}
                    />
            );
              })}
            </Group>
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
      
      {/* WebGL Layer - positioned ABOVE Konva Stage to render on top */}
      <div 
        id="gl-layer" 
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 2 }}
      />
    </div>
  );
}