import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { usePhotoStore } from "./state/photoStore";

function intersectGroundRay(camera: THREE.Camera, ndc: THREE.Vector2) {
  const ray = new THREE.Ray();
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();
  (camera as THREE.PerspectiveCamera).getWorldPosition(origin);
  ray.origin.copy(origin);
  // set direction from NDC
  const v = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(camera).sub(origin).normalize();
  ray.direction.copy(v);
  const t = -origin.y / ray.direction.y; // ground at y=0
  return origin.clone().add(ray.direction.clone().multiplyScalar(t));
}

export default function CornerCalibrate() {
  const { camera, size } = useThree();
  const [pts, setPts] = useState<{ x: number; y: number }[]>([]);
  const st = usePhotoStore();

  useEffect(() => {
    setPts([]);
  }, [st.backgroundUrl]);

  function onClick(e: React.MouseEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPts(prev => [...prev, { x, y }].slice(0, 4));
  }

  useEffect(() => {
    if (pts.length !== 4) return;
    
    // Convert to NDC
    const ndcs = pts.map(p => new THREE.Vector2(p.x * 2 - 1, -(p.y * 2 - 1)));
    const ws = ndcs.map(ndc => intersectGroundRay(camera, ndc));
    
    // Fit plane: use p0..p3; width = average of |p0-p1| and |p2-p3|, height = average of |p1-p2| and |p3-p0|
    const [p0, p1, p2, p3] = ws;
    const width = 0.5 * (p0.distanceTo(p1) + p2.distanceTo(p3));
    const height = 0.5 * (p1.distanceTo(p2) + p3.distanceTo(p0));
    
    // center
    const center = new THREE.Vector3().add(p0).add(p1).add(p2).add(p3).multiplyScalar(0.25);
    
    // plane axes: x ~ p1-p0, z ~ p3-p0 (on ground)
    const xAxis = p1.clone().sub(p0).normalize();
    const zAxis = p3.clone().sub(p0).normalize();
    const yAxis = new THREE.Vector3(0, 1, 0);
    
    // build rotation from axes (ensure orthonormal)
    const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    const quat = new THREE.Quaternion().setFromRotationMatrix(basis);
    
    usePhotoStore.getState().patch({
      plane: { 
        width, 
        height, 
        position: [center.x, 0, center.z], 
        rotation: [0, quat.y, 0] 
      }
    });
    
    // Done; clear UI markers
    setPts([]);
    alert("Plane calibrated from 4 points");
  }, [pts, camera]);

  return (
    <div className="absolute inset-0" onClick={onClick} style={{ cursor: "crosshair" }}>
      {/* draw clicks */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {pts.map((p, i) => (
          <circle 
            key={i} 
            cx={`${p.x * 100}%`} 
            cy={`${p.y * 100}%`} 
            r="6" 
            fill="rgba(255,0,0,0.7)" 
          />
        ))}
        {pts.length === 4 && (
          <polyline 
            points={pts.map(p => `${p.x * 100},${p.y * 100}`).join(" ")} 
            fill="none" 
            stroke="rgba(255,0,0,0.5)" 
            strokeWidth="2" 
          />
        )}
      </svg>
      <div className="absolute top-2 left-2 bg-white/80 text-xs p-1 rounded">
        Click 4 corners on the background (clockwise).
      </div>
    </div>
  );
}
