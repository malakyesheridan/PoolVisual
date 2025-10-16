export type SnapshotFn = (opts?: { pixelRatio?: number }) => Promise<string>; // returns dataURL
export type SelectionFn = () => { x: number; y: number; w: number; h: number } | null;

let _snap: SnapshotFn | null = null;
let _sel: SelectionFn | null = null;

export function registerCanvasSnapshot(fn: SnapshotFn | null) { 
  _snap = fn; 
}

export function registerSelectionProvider(fn: SelectionFn | null) { 
  _sel = fn; 
}

export async function snapshotFromCanvas(opts?: { pixelRatio?: number }) {
  if (!_snap) throw new Error("Canvas snapshot not registered");
  return _snap(opts);
}

export function readSelectionFromCanvas() { 
  return _sel ? _sel() : null; 
}
