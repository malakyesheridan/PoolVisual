export type PhotoSpace = {
  scale: number;    // zoom scale (float, > 0)
  panX: number;     // screen px offset X of image origin after scaling
  panY: number;     // screen px offset Y
  imgW: number;     // natural image width (px)
  imgH: number;     // natural image height (px)
  dpr: number;      // devicePixelRatio at render time (for future)
};

export type BgState = 'idle' | 'loadingImage' | 'waitingContainer' | 'ready' | 'failed';

export type AreaMask = {
  id: string;
  type: 'area';
  points: number[];    // image-space [x1,y1, x2,y2, ...]
  closed: boolean;
};

export type Tool = 'pan' | 'area' | 'select';
