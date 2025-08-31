import { useEffect, useRef } from 'react';
import { Stage, Layer, Group, Image as KonvaImage, Line, Circle } from 'react-konva';
import { usePhoto } from '../../state/photoTransformStore';
import { MaterialRendererV2 } from '../../render/MaterialRendererV2';
import { loadImageSafe } from '../../render/textures/TextureManager';

export function PhotoCanvas({photoUrl, masks, selectedMaskId, materialForMask}:{photoUrl:string; masks:any[]; selectedMaskId?:string; materialForMask:(id:string)=>{texture_url?:string}|null}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const groupRef = useRef<any>(null);
  const imgRef = useRef<HTMLImageElement|null>(null);
  const mrRef = useRef<MaterialRendererV2|null>(null);
  const T = usePhoto(s=>s.T);
  const imgW = usePhoto(s=>s.imgW);
  const imgH = usePhoto(s=>s.imgH);

  // Mount Pixi and subscriptions once
  useEffect(() => {
    const host = mountRef.current!;
    const mr = new MaterialRendererV2(host, host.clientWidth, host.clientHeight);
    mrRef.current = mr;

    const unsub = usePhoto.subscribe((state) => state.T, (t: any) => mr.setTransform(t));
    const ro = new ResizeObserver((entries) => {
      const {width, height} = entries[0].contentRect;
      usePhoto.getState().setContainer(width,height);
      mr.resize(width,height);
    });
    ro.observe(host);

    return () => { unsub(); ro.disconnect(); };
  }, []);

  // Load background photo and set image size
  useEffect(() => {
    (async () => {
      const img = await loadImageSafe(photoUrl);
      imgRef.current = img;
      usePhoto.getState().setImageSize(img.naturalWidth||img.width, img.naturalHeight||img.height);
    })();
  }, [photoUrl]);

  // Build meshes (Phase A: always show something)
  useEffect(() => {
    const mr = mrRef.current; if (!mr || !imgRef.current) return;
    for (const m of masks) {
      const mat = materialForMask(m.id);
      const textureImgPromise = mat?.texture_url ? loadImageSafe(mat.texture_url) : Promise.resolve(imgRef.current!); // fallback
      textureImgPromise.then(texImg => {
        const verts = new Float32Array(m.pointsImg.flatMap((p:any)=>[p.xImg, p.yImg]));
        mr.upsertMesh(m.id, texImg, verts);
      }).catch(()=>{ /* fallback already handled in loader */ });
    }
  }, [masks, materialForMask, imgW, imgH]);

  return (
    <div ref={mountRef} className="relative w-full h-full">
      <Stage ref={stageRef} width={usePhoto.getState().containerW} height={usePhoto.getState().containerH} scaleX={1} scaleY={1}>
        <Layer>
          <Group ref={groupRef} x={T.originX} y={T.originY} scaleX={T.S} scaleY={T.S} listening>
            {/* Background photo in IMAGE space */}
            {imgRef.current && <KonvaImage image={imgRef.current} x={0} y={0} width={imgW} height={imgH} />}
            {/* Mask outlines */}
            {masks.map(m=>{
              const pts = m.pointsImg.flatMap((p:any)=>[p.xImg, p.yImg]);
              const selected = m.id === selectedMaskId;
              return <Line key={m.id} points={pts} closed stroke={selected?'#2563eb':'#10b981'} strokeWidth={(selected?3:2)/T.S} lineJoin="round" lineCap="round" />;
            })}
            {/* Debug anchor dots */}
            <Circle x={0} y={0} radius={4/T.S} fill="#ff00aa" />
            <Circle x={imgW} y={0} radius={4/T.S} fill="#ff00aa" />
            <Circle x={0} y={imgH} radius={4/T.S} fill="#ff00aa" />
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}