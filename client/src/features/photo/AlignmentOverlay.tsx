import React from "react";
import { usePhotoStore } from "./state/photoStore";

export default function AlignmentOverlay() {
  const { alignment, set, patch } = usePhotoStore();
  if (!alignment.showGuides) return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      <div className="absolute top-2 left-2 pointer-events-auto bg-white/80 rounded p-2 shadow">
        <div className="text-xs font-medium mb-1">Perspective Assist</div>
        <label className="flex items-center gap-2 text-xs">
          Horizon
          <input 
            type="range" 
            min={-45} 
            max={45} 
            value={alignment.horizonDeg}
            onChange={e => patch({ 
              alignment: { 
                ...alignment, 
                horizonDeg: Number(e.target.value) 
              }
            })}
          />
          <span>{alignment.horizonDeg}°</span>
        </label>
        <label className="flex items-center gap-2 text-xs">
          Vanish Yaw
          <input 
            type="range" 
            min={0} 
            max={360} 
            value={alignment.vanishingYawDeg}
            onChange={e => patch({ 
              alignment: { 
                ...alignment, 
                vanishingYawDeg: Number(e.target.value) 
              }
            })}
          />
          <span>{alignment.vanishingYawDeg}°</span>
        </label>
      </div>
      
      {/* Guides */}
      <div
        className="absolute inset-0"
        style={{
          background:
            `linear-gradient(${90+alignment.vanishingYawDeg}deg, rgba(255,0,0,0.25) 1px, transparent 1px),
             linear-gradient(${alignment.horizonDeg}deg, rgba(0,0,255,0.25) 1px, transparent 1px)`,
          backgroundSize: "100% 1px, 1px 100%",
        }}
      />
    </div>
  );
}
