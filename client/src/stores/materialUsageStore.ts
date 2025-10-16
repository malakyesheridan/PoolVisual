/**
 * Material Usage Store
 * Manages material usage tracking across projects
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MaterialUsage, ProjectMaterialSummary, MaterialUsageStore } from '../types/materialUsage';
import { calculatePolygonArea } from '../new_editor/utils';

export const useMaterialUsageStore = create<MaterialUsageStore>()(
  persist(
    (set, get) => ({
      usages: [],
      projectSummaries: {},

      addMaterialUsage: (usageData) => {
        const now = new Date();
        const usage: MaterialUsage = {
          ...usageData,
          usedAt: now,
          lastModified: now,
        };

        set((state) => {
          const newUsages = [...state.usages.filter(u => u.maskId !== usage.maskId), usage];
          return {
            usages: newUsages,
            projectSummaries: updateProjectSummary(state.projectSummaries, usage),
          };
        });
      },

      removeMaterialUsage: (maskId) => {
        set((state) => {
          const usageToRemove = state.usages.find(u => u.maskId === maskId);
          if (!usageToRemove) return state;

          const newUsages = state.usages.filter(u => u.maskId !== maskId);
          const newSummaries = { ...state.projectSummaries };
          
          // Update project summary
          if (usageToRemove.projectId in newSummaries) {
            newSummaries[usageToRemove.projectId] = calculateProjectSummary(
              newUsages.filter(u => u.projectId === usageToRemove.projectId)
            );
          }

          return {
            usages: newUsages,
            projectSummaries: newSummaries,
          };
        });
      },

      updateMaterialUsage: (maskId, updates) => {
        set((state) => {
          const usageIndex = state.usages.findIndex(u => u.maskId === maskId);
          if (usageIndex === -1) return state;

          const updatedUsage = {
            ...state.usages[usageIndex],
            ...updates,
            lastModified: new Date(),
          };

          const newUsages = [...state.usages];
          newUsages[usageIndex] = updatedUsage;

          return {
            usages: newUsages,
            projectSummaries: updateProjectSummary(state.projectSummaries, updatedUsage),
          };
        });
      },

      getProjectMaterialSummary: (projectId) => {
        const state = get();
        return state.projectSummaries[projectId] || null;
      },

      getMaterialUsageByProject: (projectId) => {
        const state = get();
        return state.usages.filter(u => u.projectId === projectId);
      },

      getMaterialUsageByMaterial: (materialId) => {
        const state = get();
        return state.usages.filter(u => u.materialId === materialId);
      },

      clearProjectUsages: (projectId) => {
        set((state) => ({
          usages: state.usages.filter(u => u.projectId !== projectId),
          projectSummaries: Object.fromEntries(
            Object.entries(state.projectSummaries).filter(([id]) => id !== projectId)
          ),
        }));
      },
    }),
    {
      name: 'poolVisual-material-usage-store',
      partialize: (state) => ({
        usages: state.usages,
        projectSummaries: state.projectSummaries,
      }),
    }
  )
);

// Helper function to update project summary
function updateProjectSummary(
  summaries: Record<string, ProjectMaterialSummary>,
  usage: MaterialUsage
): Record<string, ProjectMaterialSummary> {
  const projectId = usage.projectId;
  const projectUsages = Object.values(summaries[projectId]?.materialBreakdown || {});
  
  // Get all usages for this project (we'll recalculate)
  const allUsages = Object.values(summaries).flatMap(s => 
    Object.values(s.materialBreakdown).flatMap(m => 
      Array(m.usageCount).fill(m)
    )
  ).filter(u => u.projectId === projectId);

  summaries[projectId] = calculateProjectSummary([usage, ...allUsages]);
  return summaries;
}

// Helper function to calculate project summary
function calculateProjectSummary(usages: MaterialUsage[]): ProjectMaterialSummary {
  if (usages.length === 0) {
    return {
      projectId: '',
      projectName: '',
      totalMaterials: 0,
      uniqueMaterials: 0,
      totalArea: 0,
      totalCost: 0,
      materialBreakdown: {},
      lastUpdated: new Date(),
    };
  }

  const projectId = usages[0].projectId;
  const projectName = usages[0].projectName;
  
  const materialBreakdown: ProjectMaterialSummary['materialBreakdown'] = {};
  let totalArea = 0;
  let totalCost = 0;

  usages.forEach(usage => {
    if (!materialBreakdown[usage.materialId]) {
      materialBreakdown[usage.materialId] = {
        materialName: usage.materialName,
        usageCount: 0,
        totalArea: 0,
        totalCost: 0,
        photos: [],
      };
    }

    const breakdown = materialBreakdown[usage.materialId];
    breakdown.usageCount++;
    breakdown.totalArea += usage.area;
    breakdown.totalCost += usage.cost;
    
    if (!breakdown.photos.includes(usage.photoId)) {
      breakdown.photos.push(usage.photoId);
    }

    totalArea += usage.area;
    totalCost += usage.cost;
  });

  return {
    projectId,
    projectName,
    totalMaterials: usages.length,
    uniqueMaterials: Object.keys(materialBreakdown).length,
    totalArea,
    totalCost,
    materialBreakdown,
    lastUpdated: new Date(),
  };
}
