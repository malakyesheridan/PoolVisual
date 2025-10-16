import { useEffect, useRef } from 'react';
import { Stage, Layer, Group, Image as KonvaImage, Line, Circle, Shape } from 'react-konva';
import { useEditorStore } from '../../stores/editorSlice';
import { MaterialRendererV2 } from '../../render/MaterialRendererV2';
import { loadImageSafe } from '../../render/textures/TextureManager';
import { makeTransform } from '../../render/photoTransform';

export function PhotoCanvas({photoUrl, masks, selectedMaskId, materialForMask}:{photoUrl:string; masks:any[]; selectedMaskId?:string; materialForMask:(id:string)=>{texture_url?:string}|null}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const groupRef = useRef<any>(null);
  const imgRef = useRef<HTMLImageElement|null>(null);
  const mrRef = useRef<MaterialRendererV2|null>(null);
  
  // Use the new single source of truth
  const photoSpace = useEditorStore(s => s.photoSpace);
  const containerSize = useEditorStore(s => s.containerSize);
  
  // Compute transform from PhotoSpace
  const T = photoSpace ? makeTransform({
    imgW: photoSpace.imgW,
    imgH: photoSpace.imgH,
    scale: photoSpace.scale,
    panX: photoSpace.panX,
    panY: photoSpace.panY,
    containerW: containerSize.width,
    containerH: containerSize.height
  }) : { S: 1, originX: 0, originY: 0 };

  // Mount Pixi and subscriptions once
  useEffect(() => {
    const host = mountRef.current!;
    const mr = new MaterialRendererV2(host, host.clientWidth, host.clientHeight);
    mrRef.current = mr;

    // Subscribe to PhotoSpace changes
    const unsub = useEditorStore.subscribe(
      (state) => state.photoSpace,
      (photoSpace) => {
        if (photoSpace && mr) {
          const transform = makeTransform({
            imgW: photoSpace.imgW,
            imgH: photoSpace.imgH,
            scale: photoSpace.scale,
            panX: photoSpace.panX,
            panY: photoSpace.panY,
            containerW: containerSize.width,
            containerH: containerSize.height
          });
          mr.setTransform(transform);
        }
      }
    );
    
    const ro = new ResizeObserver((entries) => {
      const {width, height} = entries[0].contentRect;
      useEditorStore.getState().setContainerSize(width, height);
      mr.resize(width, height);
    });
    ro.observe(host);

    return () => { unsub(); ro.disconnect(); };
  }, [containerSize.width, containerSize.height]);

  // Load background photo and set image size
  useEffect(() => {
    (async () => {
      const img = await loadImageSafe(photoUrl);
      imgRef.current = img;
      // Update the editor store with image dimensions
      useEditorStore.getState().loadImageFile(new File([], 'temp'), photoUrl, {
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height
      });
    })();
  }, [photoUrl]);

  // Build meshes (Phase A: always show something)
  useEffect(() => {
    const mr = mrRef.current; if (!mr || !imgRef.current || !photoSpace) return;
    for (const m of masks) {
      const mat = materialForMask(m.id);
      const textureImgPromise = mat?.texture_url ? loadImageSafe(mat.texture_url) : Promise.resolve(imgRef.current!); // fallback
      textureImgPromise.then(texImg => {
        const verts = new Float32Array(m.pointsImg.flatMap((p:any)=>[p.xImg, p.yImg]));
        mr.upsertMesh(m.id, texImg, verts);
      }).catch(()=>{ /* fallback already handled in loader */ });
    }
  }, [masks, materialForMask, photoSpace?.imgW, photoSpace?.imgH]);

  return (
    <div ref={mountRef} className="relative w-full h-full">
      <Stage ref={stageRef} width={containerSize.width} height={containerSize.height} scaleX={1} scaleY={1}>
        <Layer>
          <Group ref={groupRef} x={T.originX} y={T.originY} scaleX={T.S} scaleY={T.S} listening>
            {/* Background photo in IMAGE space */}
            {imgRef.current && photoSpace && <KonvaImage image={imgRef.current} x={0} y={0} width={photoSpace.imgW} height={photoSpace.imgH} />}
            {/* Mask outlines - toggle visibility without killing hit testing */}
            {masks.map(m=>{
              const pts = m.pointsImg.flatMap((p:any)=>[p.xImg, p.yImg]);
              const selected = m.id === selectedMaskId;
              return (
                <Group
                  key={m.id}
                  name="mask-shape"
                  listening={true}
                  isMask={true} // custom attr
                  maskId={m.id} // for centralized handler
                >
                  {/* Invisible hit area covering entire mask */}
                  <Shape
                    sceneFunc={(context, shape) => {
                      context.beginPath();
                      context.moveTo(pts[0], pts[1]);
                      for (let i = 2; i < pts.length; i += 2) {
                        context.lineTo(pts[i], pts[i + 1]);
                      }
                      context.closePath();
                      context.fillStrokeShape(shape);
                    }}
                    fill="rgba(0,0,0,0)" // completely transparent
                    stroke="rgba(0,0,0,0)" // completely transparent
                    listening={true}
                    maskId={m.id} // for centralized handler
                  />
                  {/* Visible outline */}
                  <Line 
                    points={pts} 
                    closed 
                    stroke={selected ? "#2563eb" : "rgba(0,0,0,0)"}
                    strokeWidth={selected ? 1.5/T.S : 0}
                    lineJoin="round" 
                    lineCap="round"
                    listening={false} // let the hit area handle clicks
                    perfectDrawEnabled={false}
                  />
                </Group>
              );
            })}
            {/* Debug anchor dots */}
            {photoSpace && (
              <>
                <Circle x={0} y={0} radius={4/T.S} fill="#ff00aa" />
                <Circle x={photoSpace.imgW} y={0} radius={4/T.S} fill="#ff00aa" />
                <Circle x={0} y={photoSpace.imgH} radius={4/T.S} fill="#ff00aa" />
              </>
            )}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}