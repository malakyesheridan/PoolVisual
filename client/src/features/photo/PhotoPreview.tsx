import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Sky, Html, Environment, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePhotoStore } from "./state/photoStore";
import { prepColorMap, prepLinearMap } from "./utils/pbrUtils";
import { useTransformMode } from "./context/TransformContext";

function useBackgroundImage(url?: string) {
  const [img, setImg] = useState<HTMLImageElement>();
  useEffect(() => {
    if (!url) { setImg(undefined); return; }
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => setImg(el);
    el.src = url;
  }, [url]);
  return img;
}

function PlanePBR({ maps, size, tint = [1, 1, 1] }: { 
  maps: Partial<Record<"albedo"|"normal"|"roughness"|"ao"|"displacement", THREE.Texture>>, 
  size:[number,number],
  tint?: [number, number, number]
}) {
  const mat = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      map: maps.albedo, 
      normalMap: maps.normal, 
      roughnessMap: maps.roughness, 
      aoMap: maps.ao, 
      displacementMap: maps.displacement,
      roughness: 1, 
      metalness: 0,
    });
    
    // Apply tint
    material.color.setRGB(tint[0], tint[1], tint[2]);
    
    return material;
  }, [maps, tint]);
  
  const geo = useMemo(() => new THREE.PlaneGeometry(size[0], size[1], 256, 256), [size]);
  const mesh = useRef<THREE.Mesh>(null!);
  
  useEffect(() => {
    if (maps.ao) {
      // set 2nd set of UVs for AO
      (geo as any).setAttribute("uv2", (geo as any).attributes.uv);
    }
  }, [geo, maps.ao]);
  
  return (
    <mesh ref={mesh} geometry={geo} castShadow receiveShadow rotation-x={-Math.PI/2} material={mat} />
  );
}

function Scene() {
  const { plane, material, lighting, alignment } = usePhotoStore();
  const { gl, scene, camera } = useThree();
  const { mode: transformMode } = useTransformMode();

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = lighting.exposure;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [gl, lighting.exposure]);

  // Camera mapping for perspective alignment
  useFrame(() => {
    camera.rotation.x = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(alignment.horizonDeg * 0.2, -10, 10));
    camera.rotation.y = THREE.MathUtils.degToRad(THREE.MathUtils.euclideanModulo(alignment.vanishingYawDeg, 360) * 0.2);
  });

  // Load textures if provided
  const loader = useMemo(() => new THREE.TextureLoader(), []);
  const scale = material.scale ?? 1;
  
  // Safe texture loading with error handling
  const loadTexture = (url: string, processor: (tex: THREE.Texture) => THREE.Texture) => {
    try {
      return processor(loader.load(url));
    } catch (e) {
      console.warn(`[Photo] Failed to load texture: ${url}`, e);
      return undefined;
    }
  };
  
  const albedo   = material.albedo   ? loadTexture(material.albedo,   (tex) => prepColorMap(tex, scale)) : undefined;
  const normal   = material.normal   ? loadTexture(material.normal,   (tex) => prepLinearMap(tex, scale)) : undefined;
  const rough    = material.roughness? loadTexture(material.roughness,(tex) => prepLinearMap(tex, scale)) : undefined;
  const ao       = material.ao       ? loadTexture(material.ao,       (tex) => prepLinearMap(tex, scale)) : undefined;
  const disp     = material.displacement? loadTexture(material.displacement, (tex) => prepLinearMap(tex, scale)) : undefined;

  // Shadow catcher ground
  const ground = useMemo(() => new THREE.PlaneGeometry(50, 50), []);
  const shadowMat = useMemo(() => new THREE.ShadowMaterial({ opacity: lighting.shadowOpacity }), [lighting.shadowOpacity]);

  // Lights
  const sun = useRef<THREE.DirectionalLight>(null!);
  const sunAz = THREE.MathUtils.degToRad(lighting.sunAzimuth);
  const sunEl = THREE.MathUtils.degToRad(lighting.sunElevation);
  const sunPos = useMemo(() => {
    const r = 10;
    return [Math.cos(sunAz)*Math.cos(sunEl)*r, Math.sin(sunEl)*r, Math.sin(sunAz)*Math.cos(sunEl)*r] as [number, number, number];
  }, [sunAz, sunEl]);

  return (
    <>
      {/* Environment HDRI */}
      {lighting.envHdr?.endsWith(".hdr") && (
        <Environment 
          files={lighting.envHdr} 
          rotation={THREE.MathUtils.degToRad(lighting.envRotation)} 
        />
      )}
      
      {/* Fallback Sky if no HDRI */}
      {!lighting.envHdr && (
        <Sky sunPosition={sunPos} turbidity={4} />
      )}
      
      <hemisphereLight intensity={0.35} />
      <directionalLight 
        ref={sun} 
        position={sunPos} 
        intensity={1.2} 
        castShadow 
        shadow-mapSize-width={2048} 
        shadow-mapSize-height={2048} 
      />
      
      {/* Shadow catcher ground */}
      <mesh geometry={ground} rotation-x={-Math.PI/2} position={[0,-0.0001,0]} receiveShadow>
        <primitive object={shadowMat} attach="material" />
      </mesh>
      
      {/* TransformControls around product plane */}
      <TransformControls mode={transformMode} makeDefault>
        <group position={[plane.position[0], plane.position[1], plane.position[2]]} rotation={plane.rotation as any}>
          <PlanePBR 
            maps={{ albedo, normal, roughness: rough, ao, displacement: disp }} 
            size={[plane.width, plane.height]} 
            tint={material.tint}
          />
          <ContactShadows 
            opacity={lighting.shadowOpacity} 
            blur={lighting.shadowBlur} 
            far={8} 
            resolution={2048} 
            frames={1} 
          />
        </group>
      </TransformControls>
      
      <OrbitControls enablePan enableRotate enableZoom makeDefault />
    </>
  );
}

export default function PhotoPreview() {
  const { backgroundUrl, enabled } = usePhotoStore();
  const bg = useBackgroundImage(backgroundUrl);
  
  if (!enabled) return (
    <div className="p-4 text-sm opacity-70">
      Photorealistic Preview is disabled. Enable it in the Photo toolbar.
    </div>
  );

  // Guard against missing background
  if (!backgroundUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="p-6 text-center text-gray-500">
          <div className="text-lg mb-2">📸</div>
          <div className="text-sm mb-4">Waiting for canvas snapshot...</div>
          <div className="text-xs opacity-70">Click "Sync from Canvas" to load your design</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full relative">
      {bg && (
        <img 
          src={bg.src} 
          alt="background" 
          className="absolute inset-0 w-full h-full object-contain pointer-events-none" 
        />
      )}
      <Canvas className="w-full h-full relative">
        <Suspense fallback={<Html center>Loading PBR…</Html>}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
