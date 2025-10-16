export type PhotoSpace = {
  scale: number; 
  panX: number; 
  panY: number; 
  imgW: number; 
  imgH: number; 
  dpr: number;
};

export type AreaMask = {
  id: string;
  type: 'area';
  points: number[]; // [x1,y1,x2,y2,...] in natural image pixels
  materialId?: string;
};

export type Material = {
  id: string; 
  name: string; 
  url: string; 
  scaleM: number; // meters per tile repeat
};

export type Doc = {
  status: 'idle'|'loading'|'ready'|'error';
  error?: string;
  bg: { url?: string; w?: number; h?: number };
  view: PhotoSpace;
  masks: Record<string, AreaMask>;
  selectedId?: string;
  mode: 'select'|'draw-area'|'pan';
  history: { past: DocSnapshot[]; future: DocSnapshot[] };
  materials: Record<string, Material>;
};

export type DocSnapshot = Omit<Doc,'history'|'status'|'error'>;
