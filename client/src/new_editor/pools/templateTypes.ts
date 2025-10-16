// Pool Template Types
export type TemplateId = string;

export type TemplateCategory = 'rectangular' | 'freeform' | 'spa';

export type TemplateMask = {
  id: string;
  points: Array<{ x: number; y: number }>;
  material?: {
    id: string;
    tileScale: number;
    opacity: number;
  };
};

export type TemplateAsset = {
  id: string;
  kind: 'decal';
  sourceId: string;
  name: string;
  category: string;
  natW: number;
  natH: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  blend: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';
  z: number;
};

export type TemplateScene = {
  masks: TemplateMask[];
  assets: TemplateAsset[];
};

export type PoolTemplate = {
  id: TemplateId;
  name: string;
  category: TemplateCategory;
  preview: string;
  description: string;
  tags: string[];
  scene: TemplateScene;
};

export type TemplateManifest = {
  version: number;
  updatedAt: string;
  categories: TemplateCategory[];
  templates: PoolTemplate[];
};

export type TemplateSourceInfo = {
  type: 'local' | 'cdn' | 'api';
  url?: string;
  error?: string;
};
