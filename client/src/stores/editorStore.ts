import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { BgState, PhotoSpace, AreaMask, Tool } from "@/types/photo";

type Background = {
  url: string | null;
  naturalW: number;
  naturalH: number;
  state: BgState;
};

type EditorState = {
  // Layout / container
  containerW: number;
  containerH: number;

  // Background image
  bg: Background;

  // Transform
  photo: {
    space: PhotoSpace | null;
    initialized: boolean;
  };

  // Tools & masks
  tool: Tool;
  masks: AreaMask[];
  drawing: { active: boolean; points: number[] } | null;
  selectedId: string | null;

  // History (very simple for now)
  history: { past: string[]; future: string[] }; // JSON snapshots

  // Actions
  setContainerSize: (w: number, h: number) => void;
  loadImageFile: (file: File) => Promise<void>;
  fitToScreen: () => void;
  setZoomAtPoint: (deltaY: number, screenX: number, screenY: number) => void;
  setPan: (dx: number, dy: number) => void;

  setTool: (t: Tool) => void;
  startArea: () => void;
  addPoint: (screenX: number, screenY: number) => void;
  commitArea: () => void;
  cancelDrawing: () => void;
  selectMask: (id: string | null) => void;

  // History
  pushSnapshot: () => void;
  undo: () => void;
  redo: () => void;

  // Internal (exposed for effects)
  __commitIfReady: () => void;
};

const finite = (n: number) => Number.isFinite(n);
const guardFinite = (v: Partial<PhotoSpace>, prev: PhotoSpace | null): PhotoSpace | null => {
  if (!v || !prev) return null;
  const next = { ...prev, ...v };
  if (!finite(next.scale) || next.scale <= 0) return prev;
  if (!finite(next.panX) || !finite(next.panY)) return prev;
  return next;
};

export const useEditorStore = create<EditorState>()(devtools((set, get) => ({
  containerW: 0,
  containerH: 0,
  bg: { url: null, naturalW: 0, naturalH: 0, state: "idle" },
  photo: { space: null, initialized: false },

  tool: "pan",
  masks: [],
  drawing: null,
  selectedId: null,

  history: { past: [], future: [] },

  setContainerSize: (w, h) => {
    set({ containerW: w, containerH: h });
    get().__commitIfReady();
  },

  async loadImageFile(file) {
    // revoke old url AFTER new renders (we'll track outside later if needed)
    const url = URL.createObjectURL(file);
    set(state => ({
      bg: { ...state.bg, url, state: "loadingImage" },
      photo: { space: null, initialized: false },
      masks: [],
      drawing: null,
      selectedId: null,
      history: { past: [], future: [] },
    }));

    const img = new Image();
    img.onload = () => {
      set(state => ({
        bg: { ...state.bg, naturalW: img.naturalWidth, naturalH: img.naturalHeight, state: "waitingContainer" },
      }));
      get().__commitIfReady();
    };
    img.onerror = () => {
      set(state => ({ bg: { ...state.bg, state: "failed" } }));
    };
    img.src = url;
  },

  __commitIfReady: () => {
    const { containerW, containerH, bg, photo } = get();
    if (photo.initialized) return;
    if (bg.state !== "waitingContainer" && bg.state !== "ready") return;
    if (!(containerW > 0 && containerH > 0 && bg.naturalW > 0 && bg.naturalH > 0)) return;

    // Always start at 100% zoom for calibration compatibility
    const scale = 1.0;
    const panX = (containerW - bg.naturalW * scale) / 2;
    const panY = (containerH - bg.naturalH * scale) / 2;
    if (!finite(scale) || scale <= 0) return;

    const space: PhotoSpace = {
      scale, panX, panY,
      imgW: bg.naturalW, imgH: bg.naturalH,
      dpr: window.devicePixelRatio || 1,
    };

    set({
      photo: { space, initialized: true },
      bg: { ...bg, state: "ready" },
    });
  },

  fitToScreen: () => {
    const { containerW, containerH, bg, photo } = get();
    if (!(containerW > 0 && containerH > 0 && bg.naturalW > 0 && bg.naturalH > 0)) return;
    const scale = Math.min(containerW / bg.naturalW, containerH / bg.naturalH) * 0.98;
    const panX = (containerW - bg.naturalW * scale) / 2;
    const panY = (containerH - bg.naturalH * scale) / 2;
    if (!photo.space) return;
    const next = guardFinite({ scale, panX, panY }, photo.space);
    if (next) set({ photo: { ...get().photo, space: next } });
  },

  setZoomAtPoint: (deltaY, sx, sy) => {
    const { photo } = get();
    const ps = photo.space;
    if (!ps) return;
    const zoomFactor = Math.exp(-deltaY * 0.002); // smooth scroll
    const newScale = Math.max(0.05, Math.min(8, ps.scale * zoomFactor));

    const ix = (sx - ps.panX) / ps.scale;
    const iy = (sy - ps.panY) / ps.scale;

    const panX = sx - ix * newScale;
    const panY = sy - iy * newScale;

    const next = guardFinite({ scale: newScale, panX, panY }, ps);
    if (next) set({ photo: { ...photo, space: next } });
  },

  setPan: (dx, dy) => {
    const { photo } = get();
    const ps = photo.space;
    if (!ps) return;
    const next = guardFinite({ panX: ps.panX + dx, panY: ps.panY + dy }, ps);
    if (next) set({ photo: { ...photo, space: next } });
  },

  setTool: (t) => set({ tool: t }),

  startArea: () => set({ tool: "area", drawing: { active: true, points: [] }, selectedId: null }),

  addPoint: (sx, sy) => {
    const { photo, drawing } = get();
    const ps = photo.space;
    if (!ps || !drawing?.active) return;
    const ix = (sx - ps.panX) / ps.scale;
    const iy = (sy - ps.panY) / ps.scale;
    set({ drawing: { active: true, points: [...drawing.points, ix, iy] } });
  },

  commitArea: () => {
    const { drawing } = get();
    if (!drawing?.active || drawing.points.length < 6) { // min triangle
      set({ drawing: null, tool: "select" });
      return;
    }
    const mask: AreaMask = { id: crypto.randomUUID(), type: "area", points: drawing.points, closed: true };
    set(state => ({
      masks: [...state.masks, mask],
      drawing: null,
      tool: "select",
      selectedId: mask.id,
    }));
    get().pushSnapshot();
  },

  cancelDrawing: () => set({ drawing: null, tool: "select" }),

  selectMask: (id) => set({ selectedId: id }),

  pushSnapshot: () => {
    const snap = JSON.stringify({ masks: get().masks });
    set(state => ({ history: { past: [...state.history.past, snap], future: [] } }));
  },

  undo: () => {
    set(state => {
      const past = [...state.history.past];
      if (!past.length) return state;
      const last = past.pop()!;
      const prev = JSON.parse(last);
      return { ...state, masks: prev.masks, history: { past, future: [JSON.stringify({ masks: state.masks }), ...state.history.future] } };
    });
  },

  redo: () => {
    set(state => {
      const [next, ...rest] = state.history.future;
      if (!next) return state;
      const val = JSON.parse(next);
      return { ...state, masks: val.masks, history: { past: [...state.history.past, JSON.stringify({ masks: state.masks })], future: rest } };
    });
  },
})));
