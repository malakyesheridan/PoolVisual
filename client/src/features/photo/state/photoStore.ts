import { create } from "zustand";
import { persist } from "zustand/middleware";

type MaterialMap = {
  name: string;
  albedo?: string;
  normal?: string;
  roughness?: string;
  ao?: string;
  displacement?: string;
  scale?: number; // UV tiling
  tint?: [number, number, number]; // color balance multiplier
};

type PhotoState = {
  enabled: boolean;
  backgroundUrl?: string; // the base photo user is editing against
  plane: {
    width: number;   // meters (virtual)
    height: number;  // meters
    position: [number, number, number];
    rotation: [number, number, number]; // radians
  };
  material: MaterialMap;
  lighting: {
    exposure: number; // 0.1..2.5
    sunAzimuth: number; // deg
    sunElevation: number; // deg
    shadowOpacity: number; // 0..1
    envHdr?: string; // path to .hdr
    envRotation: number; // degrees; rotates HDRI
    shadowBlur: number; // 0..6 for soft shadow look
  };
  alignment: {
    showGuides: boolean;
    horizonDeg: number;         // -45..45 (tilt)
    vanishingYawDeg: number;    // 0..360
  };
  library: {
    materials: Array<{ name: string; albedo?: string; normal?: string; roughness?: string; ao?: string; displacement?: string }>;
    hdris: Array<{ name: string; url: string }>;
  };
  mask: { // optional crop/mask region for compositing
    type: "none" | "rect" | "polygon";
    rect?: { x: number; y: number; w: number; h: number };
    polygon?: Array<{ x: number; y: number }>;
  };
  set<K extends keyof PhotoState>(k: K, v: PhotoState[K]): void;
  patch<T extends Partial<PhotoState>>(p: T): void;
  addMaterial(material: { name: string; albedo?: string; normal?: string; roughness?: string; ao?: string; displacement?: string }): void;
  addHdri(hdri: { name: string; url: string }): void;
  autoMatchFromBackground(avgRgb: [number, number, number]): void;
};

export const usePhotoStore = create<PhotoState>()(persist(
  (set, get) => ({
    enabled: false,
    backgroundUrl: undefined,
    plane: { width: 2, height: 2, position: [0, 0, 0], rotation: [0, 0, 0] },
    material: { name: "Default", scale: 1, tint: [1, 1, 1] },
    lighting: { 
      exposure: 1.0, 
      sunAzimuth: 135, 
      sunElevation: 45, 
      shadowOpacity: 0.5,
      envRotation: 0,
      shadowBlur: 2.5
    },
    alignment: {
      showGuides: false,
      horizonDeg: 0,
      vanishingYawDeg: 0
    },
    library: {
      materials: [],
      hdris: [
        { name: "Studio", url: "/hdri/studio_2k.hdr" },
        { name: "Sunset", url: "/hdri/sunset_2k.hdr" },
        { name: "Indoor", url: "/hdri/indoor_2k.hdr" }
      ]
    },
    mask: { type: "none" },
    set: (k, v) => set({ [k]: v } as any),
    patch: (p) => set(p as any),
    addMaterial: (material) => set((state) => ({
      library: {
        ...state.library,
        materials: [...state.library.materials, material]
      }
    })),
    addHdri: (hdri) => set((state) => ({
      library: {
        ...state.library,
        hdris: [...state.library.hdris, hdri]
      }
    })),
    autoMatchFromBackground: (avgRgb) => {
      const { computeTintFromAvg, exposureFromLuma } = require('../utils/colorMatch');
      const tint = computeTintFromAvg(avgRgb);
      const exposure = exposureFromLuma(avgRgb);
      set((state) => ({
        material: { ...state.material, tint },
        lighting: { ...state.lighting, exposure }
      }));
    }
  }),
  { name: "photo-preview-v2" }
));
