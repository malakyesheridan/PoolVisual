import { useRef, useState } from "react";
import { usePhotoStore } from "./state/photoStore";
import { exportComposite } from "./utils/exportComposite";
import { PBRSet } from "./types";
import { averageImageRGB, computeTintFromAvg, exposureFromLuma } from "./utils/colorMatch";
import { useTransformMode } from "./context/TransformContext";
import { currentPlaneAreaM2, syncQuoteFromPhoto } from "./utils/areaToQuote";
import { snapshotFromCanvas } from "./bridge/canvasBridge";

const DEMO_MATS: PBRSet[] = [
  // Replace these URLs with real PBR textures you add under /public/materials
  { 
    name: "Ceramic Tile - White", 
    albedo: "/materials/demo/tile_albedo.jpg", 
    normal: "/materials/demo/tile_normal.jpg", 
    roughness: "/materials/demo/tile_rough.jpg", 
    ao: "/materials/demo/tile_ao.jpg", 
    displacement: "/materials/demo/tile_disp.jpg" 
  },
  { 
    name: "Stone Beige", 
    albedo: "/materials/demo/stone_albedo.jpg", 
    normal: "/materials/demo/stone_normal.jpg", 
    roughness: "/materials/demo/stone_rough.jpg", 
    ao: "/materials/demo/stone_ao.jpg" 
  },
];

export default function PhotoToolbar() {
  const st = usePhotoStore();
  const [scale, setScale] = useState(st.material.scale ?? 1);
  const { mode: transformMode, setMode } = useTransformMode();
  const [newMaterial, setNewMaterial] = useState({ name: "", albedo: "", normal: "", roughness: "", ao: "", displacement: "" });
  const { calibrateMode, setCalibrateMode } = useTransformMode();
  const threeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  return (
    <div className="flex flex-wrap gap-3 items-center p-2 border-b bg-white/70 backdrop-blur sticky top-0 z-10">
      {/* Basic Controls */}
      <label className="flex items-center gap-2">
        <input 
          type="checkbox" 
          checked={st.enabled} 
          onChange={e => st.set("enabled", e.target.checked)} 
        />
        Enable Photo Mode
      </label>

      <label className="flex items-center gap-2">
        <input 
          type="checkbox" 
          checked={st.alignment.showGuides} 
          onChange={e => st.patch({ alignment: { ...st.alignment, showGuides: e.target.checked } })} 
        />
        Guides
      </label>

      <label className="flex items-center gap-2">
        <input 
          type="checkbox" 
          checked={calibrateMode} 
          onChange={e => setCalibrateMode(e.target.checked)} 
        />
        Calibrate (4-point)
      </label>

      <input 
        type="file" 
        accept="image/*" 
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const url = URL.createObjectURL(f);
          st.set("backgroundUrl", url);
        }} 
      />

      {/* Transform Controls */}
      <div className="flex items-center gap-1">
        <span className="text-xs">Mode:</span>
        <button 
          onClick={() => setTransformMode("translate")}
          className={`px-2 py-1 text-xs rounded ${transformMode === "translate" ? "bg-primary text-white" : "bg-gray-200"}`}
        >
          Move
        </button>
        <button 
          onClick={() => setTransformMode("rotate")}
          className={`px-2 py-1 text-xs rounded ${transformMode === "rotate" ? "bg-primary text-white" : "bg-gray-200"}`}
        >
          Rotate
        </button>
        <button 
          onClick={() => setTransformMode("scale")}
          className={`px-2 py-1 text-xs rounded ${transformMode === "scale" ? "bg-primary text-white" : "bg-gray-200"}`}
        >
          Scale
        </button>
      </div>

      {/* Material Selection */}
      <div className="flex items-center gap-2">
        <span className="text-xs">Material</span>
        <select 
          className="text-xs border rounded px-2 py-1"
          onChange={(e) => {
            const m = DEMO_MATS.find(x => x.name === e.target.value);
            if (m) st.patch({ material: { ...m, scale } });
          }}
        >
          <option value="">None</option>
          {DEMO_MATS.map(m => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* Material Tiling */}
      <div className="flex items-center gap-2">
        <span className="text-xs">Tile</span>
        <input 
          type="range" 
          min={0.25} 
          max={8} 
          step={0.25} 
          value={scale}
          className="w-20"
          onChange={e => { 
            const v = Number(e.target.value); 
            setScale(v); 
            st.patch({ material: { ...st.material, scale: v } }); 
          }} 
        />
        <span className="text-xs">{scale.toFixed(2)}×</span>
      </div>

      {/* Lighting Controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs">Sun</span>
        <input 
          type="range" 
          min={0} 
          max={360} 
          value={st.lighting.sunAzimuth}
          className="w-16"
          onChange={e => st.patch({ lighting: { ...st.lighting, sunAzimuth: Number(e.target.value) } })} 
        />
        <input 
          type="range" 
          min={0} 
          max={90} 
          value={st.lighting.sunElevation}
          className="w-16"
          onChange={e => st.patch({ lighting: { ...st.lighting, sunElevation: Number(e.target.value) } })} 
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs">Exp</span>
        <input 
          type="range" 
          min={0.1} 
          max={2.5} 
          step={0.05} 
          value={st.lighting.exposure}
          className="w-16"
          onChange={e => st.patch({ lighting: { ...st.lighting, exposure: Number(e.target.value) } })} 
        />
      </div>

      {/* Shadow Controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs">Shadow</span>
        <input 
          type="range" 
          min={0} 
          max={1} 
          step={0.05} 
          value={st.lighting.shadowOpacity}
          className="w-16"
          onChange={e => st.patch({ lighting: { ...st.lighting, shadowOpacity: Number(e.target.value) } })} 
        />
        <input 
          type="range" 
          min={0} 
          max={6} 
          step={0.1} 
          value={st.lighting.shadowBlur}
          className="w-16"
          onChange={e => st.patch({ lighting: { ...st.lighting, shadowBlur: Number(e.target.value) } })} 
        />
      </div>

      {/* HDRI Controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs">HDRI</span>
        <select 
          className="text-xs border rounded px-2 py-1"
          onChange={(e) => {
            const hdri = st.library.hdris.find(h => h.name === e.target.value);
            if (hdri) st.patch({ lighting: { ...st.lighting, envHdr: hdri.url } });
          }}
        >
          <option value="">None</option>
          {st.library.hdris.map(h => (
            <option key={h.name} value={h.name}>{h.name}</option>
          ))}
        </select>
        <input 
          type="file" 
          accept=".hdr" 
          className="text-xs"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const url = URL.createObjectURL(f);
            const name = f.name.replace('.hdr', '');
            st.addHdri({ name, url });
          }} 
        />
        <input 
          type="range" 
          min={0} 
          max={360} 
          value={st.lighting.envRotation}
          className="w-16"
          onChange={e => st.patch({ lighting: { ...st.lighting, envRotation: Number(e.target.value) } })} 
        />
      </div>

      {/* Action Buttons */}
      <button 
        className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
        onClick={async () => {
          if (!st.backgroundUrl) return alert("Upload a background first");
          const avg = await averageImageRGB(st.backgroundUrl);
          const tint = computeTintFromAvg(avg);
          const exp = exposureFromLuma(avg);
          st.patch({ 
            material: { ...st.material, tint }, 
            lighting: { ...st.lighting, exposure: exp } 
          });
        }}
              >
         Match Photo
       </button>

               <button 
          className="px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
          onClick={async () => {
            const m2 = currentPlaneAreaM2();
            await syncQuoteFromPhoto(usePhotoStore.getState().material.name || "Material", m2);
            alert(`Quote updated with ${m2.toFixed(2)} m²`);
          }}
        >
          Sync Quote
        </button>

        <button 
          className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
          onClick={async () => {
            try {
              const dataUrl = await snapshotFromCanvas({ pixelRatio: window.devicePixelRatio || 2 });
              usePhotoStore.getState().set("backgroundUrl", dataUrl);
              const avg = await averageImageRGB(dataUrl);
              const tint = computeTintFromAvg(avg);
              const exp = exposureFromLuma(avg);
              usePhotoStore.getState().patch({ 
                material: { ...usePhotoStore.getState().material, tint }, 
                lighting: { ...usePhotoStore.getState().lighting, exposure: exp } 
              });
            } catch (e: any) {
              alert("Sync from Canvas failed: " + (e?.message || e));
            }
          }}
        >
          Sync from Canvas
        </button>

       <button  
        className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary"
        onClick={async () => {
          const threeCanvas = document.querySelector("canvas") as HTMLCanvasElement | null;
          if (!threeCanvas) return alert("3D canvas not found");
          
          let bgEl: HTMLImageElement | undefined;
          if (st.backgroundUrl) { 
            bgEl = new Image(); 
            bgEl.crossOrigin = "anonymous"; 
            bgEl.src = st.backgroundUrl; 
            await new Promise(r => { bgEl!.onload = r; }); 
          }
          
          const blob = await exportComposite({
            threeCanvas,
            backgroundImg: bgEl,
            mask: st.mask,
            scale: 2
          });
          
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `poolvisual-photo-${Date.now()}.png`;
          a.click();
        }}
      >
        Export PNG
      </button>

      <button 
        className="px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600"
        onClick={async () => {
          const threeCanvas = document.querySelector("canvas") as HTMLCanvasElement | null;
          if (!threeCanvas) return alert("3D canvas not found");
          
          let bgEl: HTMLImageElement | undefined;
          if (st.backgroundUrl) { 
            bgEl = new Image(); 
            bgEl.crossOrigin = "anonymous"; 
            bgEl.src = st.backgroundUrl; 
            await new Promise(r => { bgEl!.onload = r; }); 
          }
          
          const blob = await exportComposite({
            threeCanvas,
            backgroundImg: bgEl,
            mask: st.mask,
            scale: 4
          });
          
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `poolvisual-photo-4k-${Date.now()}.png`;
          a.click();
        }}
      >
        4K Export
      </button>
    </div>
  );
}
