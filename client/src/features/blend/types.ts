export type Point = { x: number; y: number };

export type SmartBlendInput = {
  backgroundDataURL: string; // snapshot of canvas
  materialAlbedoURL: string;
  materialProperties?: {
    physicalRepeatM?: number;
    scale?: number;
  };
  polygon: Array<Point>;
  canvasSize: { w: number; h: number };
  scale?: number;   // tiling scale (1 = default)
  strength?: number; // 0..1, default 0.7
};

export type SmartBlendResult = {
  dataURL: string;
  success: boolean;
  error?: string;
};
