/**
 * Material Usage Tracking for Projects
 * Tracks which materials are used in which projects and photos
 */

export interface MaterialUsage {
  materialId: string;
  materialName: string;
  projectId: string;
  projectName: string;
  photoId: string;
  photoName: string;
  maskId: string;
  maskName: string;
  area: number; // in square meters
  cost: number; // total cost for this usage
  usedAt: Date;
  lastModified: Date;
}

export interface ProjectMaterialSummary {
  projectId: string;
  projectName: string;
  totalMaterials: number;
  uniqueMaterials: number;
  totalArea: number;
  totalCost: number;
  materialBreakdown: {
    [materialId: string]: {
      materialName: string;
      usageCount: number;
      totalArea: number;
      totalCost: number;
      photos: string[];
    };
  };
  lastUpdated: Date;
}

export interface MaterialUsageStore {
  usages: MaterialUsage[];
  projectSummaries: Record<string, ProjectMaterialSummary>;
  
  // Actions
  addMaterialUsage: (usage: Omit<MaterialUsage, 'usedAt' | 'lastModified'>) => void;
  removeMaterialUsage: (maskId: string) => void;
  updateMaterialUsage: (maskId: string, updates: Partial<MaterialUsage>) => void;
  getProjectMaterialSummary: (projectId: string) => ProjectMaterialSummary | null;
  getMaterialUsageByProject: (projectId: string) => MaterialUsage[];
  getMaterialUsageByMaterial: (materialId: string) => MaterialUsage[];
  clearProjectUsages: (projectId: string) => void;
}
