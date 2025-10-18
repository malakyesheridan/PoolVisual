// Unified Template Store
// Manages pool templates that can be used in both Library and Canvas
// Integrates with existing Materials and Assets systems

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface UnifiedTemplate {
  id: string;
  name: string;
  description: string;
  category: 'rectangular' | 'freeform' | 'lap' | 'kidney' | 'custom';
  tags: string[];
  
  // Visual
  thumbnailUrl: string;
  previewUrl?: string;
  
  // Template data
  poolGeometry: {
    type: 'rect' | 'lap' | 'kidney' | 'freeform';
    dimensions: { width: number; height: number };
    cornerRadius?: number;
    variant?: 'organic' | 'modern';
  };
  
  // Materials & Assets
  materials: {
    coping?: string; // Material ID
    waterline?: string;
    interior?: string;
    paving?: string;
  };
  
  assets: Array<{
    assetId: string;
    position: { x: number; y: number };
    scale: number;
    rotation?: number;
  }>;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  createdBy?: string;
  
  // Business
  estimatedCost?: number;
  complexity: 'Low' | 'Medium' | 'High';
  size: 'Small' | 'Medium' | 'Large' | 'Extra Large';
}

interface UnifiedTemplateState {
  // Templates data
  templates: Record<string, UnifiedTemplate>;
  templateOrder: string[]; // For sorting/filtering
  
  // UI state
  selectedTemplateId: string | null;
  searchQuery: string;
  categoryFilter: string;
  
  // Loading state
  loading: boolean;
  error: string | null;
  
  // Actions
  loadTemplates: () => Promise<void>;
  addTemplate: (template: Omit<UnifiedTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => string;
  updateTemplate: (id: string, updates: Partial<UnifiedTemplate>) => void;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => string;
  
  // Selection
  selectTemplate: (id: string | null) => void;
  
  // Filtering
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: string) => void;
  
  // Usage tracking
  recordUsage: (id: string) => void;
  
  // Apply template to canvas (integration point)
  applyTemplate: (id: string) => Promise<void>;
}

// Generate unique ID
function generateTemplateId(): string {
  return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Load templates from localStorage
function loadTemplatesFromStorage(): Record<string, UnifiedTemplate> {
  try {
    const stored = localStorage.getItem('poolVisual-templates');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load templates from localStorage:', error);
    return {};
  }
}

// Save templates to localStorage
function saveTemplatesToStorage(templates: Record<string, UnifiedTemplate>): void {
  try {
    localStorage.setItem('poolVisual-templates', JSON.stringify(templates));
  } catch (error) {
    console.warn('Failed to save templates to localStorage:', error);
  }
}

export const useUnifiedTemplateStore = create<UnifiedTemplateState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    templates: {},
    templateOrder: [],
    selectedTemplateId: null,
    searchQuery: '',
    categoryFilter: 'all',
    loading: false,
    error: null,

    // Load templates from storage
    loadTemplates: async () => {
      set({ loading: true, error: null });
      try {
        const templates = loadTemplatesFromStorage();
        const templateOrder = Object.keys(templates).sort((a, b) => 
          templates[b].createdAt.localeCompare(templates[a].createdAt)
        );
        
        set({ 
          templates, 
          templateOrder,
          loading: false 
        });
      } catch (error) {
        console.error('Failed to load templates:', error);
        set({ 
          loading: false, 
          error: error instanceof Error ? error.message : 'Failed to load templates' 
        });
      }
    },

    // Add new template
    addTemplate: (templateData) => {
      const id = generateTemplateId();
      const now = new Date().toISOString();
      
      const template: UnifiedTemplate = {
        ...templateData,
        id,
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
      };

      set(state => {
        const newTemplates = { ...state.templates, [id]: template };
        const newOrder = [id, ...state.templateOrder];
        
        saveTemplatesToStorage(newTemplates);
        
        return {
          templates: newTemplates,
          templateOrder: newOrder,
        };
      });

      return id;
    },

    // Update existing template
    updateTemplate: (id, updates) => {
      set(state => {
        const template = state.templates[id];
        if (!template) return state;

        const updatedTemplate = {
          ...template,
          ...updates,
          id, // Ensure ID doesn't change
          updatedAt: new Date().toISOString(),
        };

        const newTemplates = { ...state.templates, [id]: updatedTemplate };
        saveTemplatesToStorage(newTemplates);
        
        return { templates: newTemplates };
      });
    },

    // Delete template
    deleteTemplate: (id) => {
      set(state => {
        const { [id]: deleted, ...remainingTemplates } = state.templates;
        const newOrder = state.templateOrder.filter(templateId => templateId !== id);
        
        saveTemplatesToStorage(remainingTemplates);
        
        return {
          templates: remainingTemplates,
          templateOrder: newOrder,
          selectedTemplateId: state.selectedTemplateId === id ? null : state.selectedTemplateId,
        };
      });
    },

    // Duplicate template
    duplicateTemplate: (id) => {
      const state = get();
      const originalTemplate = state.templates[id];
      if (!originalTemplate) return '';

      const newId = generateTemplateId();
      const now = new Date().toISOString();
      
      const duplicatedTemplate: UnifiedTemplate = {
        ...originalTemplate,
        id: newId,
        name: `${originalTemplate.name} (Copy)`,
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
      };

      set(state => {
        const newTemplates = { ...state.templates, [newId]: duplicatedTemplate };
        const newOrder = [newId, ...state.templateOrder];
        
        saveTemplatesToStorage(newTemplates);
        
        return {
          templates: newTemplates,
          templateOrder: newOrder,
        };
      });

      return newId;
    },

    // Selection
    selectTemplate: (id) => {
      set({ selectedTemplateId: id });
    },

    // Filtering
    setSearchQuery: (query) => {
      set({ searchQuery: query });
    },

    setCategoryFilter: (category) => {
      set({ categoryFilter: category });
    },

    // Usage tracking
    recordUsage: (id) => {
      set(state => {
        const template = state.templates[id];
        if (!template) return state;

        const updatedTemplate = {
          ...template,
          usageCount: template.usageCount + 1,
          lastUsed: new Date().toISOString(),
        };

        const newTemplates = { ...state.templates, [id]: updatedTemplate };
        saveTemplatesToStorage(newTemplates);
        
        return { templates: newTemplates };
      });
    },

    // Apply template to canvas
    applyTemplate: async (id) => {
      const state = get();
      const template = state.templates[id];
      if (!template) {
        console.warn('Template not found:', id);
        return;
      }

      // Record usage
      get().recordUsage(id);

      try {
        // Import editor store dynamically to avoid circular imports
        const { useEditorStore } = await import('../new_editor/store');
        const editorStore = useEditorStore.getState();
        
        // Clear existing masks and assets
        editorStore.masks.forEach(mask => {
          editorStore.dispatch({ type: 'REMOVE_MASK', payload: mask.id });
        });
        editorStore.assets.forEach(asset => {
          editorStore.dispatch({ type: 'REMOVE_ASSET', payload: asset.id });
        });

        // Create pool mask based on template geometry
        const poolMask = createPoolMaskFromTemplate(template);
        editorStore.dispatch({ type: 'ADD_MASK', payload: poolMask });

        // Apply materials to masks
        if (template.materials) {
          Object.entries(template.materials).forEach(([category, materialId]) => {
            if (materialId) {
              // Find mask for this material category and apply material
              const maskToUpdate = editorStore.masks.find(mask => 
                mask.materialId === undefined || mask.materialId === materialId
              );
              if (maskToUpdate) {
                editorStore.dispatch({ 
                  type: 'UPDATE_MASK', 
                  payload: { 
                    id: maskToUpdate.id, 
                    updates: { materialId } 
                  } 
                });
              }
            }
          });
        }

        // Add assets from template
        if (template.assets && template.assets.length > 0) {
          template.assets.forEach((assetData, index) => {
            const asset = {
              id: `asset_${Date.now()}_${index}`,
              defId: assetData.assetId,
              x: assetData.position.x,
              y: assetData.position.y,
              scale: assetData.scale,
              rotation: assetData.rotation || 0,
              opacity: 1.0,
              createdAt: Date.now(),
              settings: {
                brightness: 0,
                contrast: 0,
                saturation: 0,
                hue: 0,
                blur: 0,
                shadow: {
                  enabled: false,
                  offsetX: 2,
                  offsetY: 2,
                  blur: 5,
                  opacity: 0.3
                }
              }
            };
            editorStore.dispatch({ type: 'ADD_ASSET', payload: asset });
          });
        }

        console.log('Template applied successfully:', template.name);
      } catch (error) {
        console.error('Failed to apply template:', error);
        throw error;
      }
    },
  }))
);

// Selectors for easy access
export const useTemplateSelectors = () => {
  const store = useUnifiedTemplateStore();
  
  const filteredTemplates = Object.values(store.templates).filter(template => {
    const matchesSearch = !store.searchQuery || 
      template.name.toLowerCase().includes(store.searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(store.searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(store.searchQuery.toLowerCase()));
    
    const matchesCategory = !store.categoryFilter || store.categoryFilter === 'all' || template.category === store.categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  return {
    templates: filteredTemplates,
    selectedTemplate: store.selectedTemplateId ? store.templates[store.selectedTemplateId] : null,
    loading: store.loading,
    error: store.error,
  };
};

// Helper function to create pool mask from template
function createPoolMaskFromTemplate(template: UnifiedTemplate) {
  const { poolGeometry } = template;
  
  // Generate points based on pool type and dimensions
  let points: Array<{ x: number; y: number }> = [];
  
  const centerX = poolGeometry.dimensions.width / 2;
  const centerY = poolGeometry.dimensions.height / 2;
  
  switch (poolGeometry.type) {
    case 'rect':
    case 'lap':
      // Create rectangular pool
      const halfWidth = poolGeometry.dimensions.width / 2;
      const halfHeight = poolGeometry.dimensions.height / 2;
      const cornerRadius = poolGeometry.cornerRadius || 20;
      
      points = [
        { x: centerX - halfWidth + cornerRadius, y: centerY - halfHeight },
        { x: centerX + halfWidth - cornerRadius, y: centerY - halfHeight },
        { x: centerX + halfWidth, y: centerY - halfHeight + cornerRadius },
        { x: centerX + halfWidth, y: centerY + halfHeight - cornerRadius },
        { x: centerX + halfWidth - cornerRadius, y: centerY + halfHeight },
        { x: centerX - halfWidth + cornerRadius, y: centerY + halfHeight },
        { x: centerX - halfWidth, y: centerY + halfHeight - cornerRadius },
        { x: centerX - halfWidth, y: centerY - halfHeight + cornerRadius },
      ];
      break;
      
    case 'kidney':
      // Create kidney-shaped pool
      const kidneyWidth = poolGeometry.dimensions.width;
      const kidneyHeight = poolGeometry.dimensions.height;
      const numPoints = 16;
      
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const radiusX = kidneyWidth / 2;
        const radiusY = kidneyHeight / 2;
        
        // Kidney shape formula
        const x = centerX + radiusX * Math.cos(angle) * (1 + 0.3 * Math.sin(angle * 2));
        const y = centerY + radiusY * Math.sin(angle) * (1 + 0.2 * Math.cos(angle * 2));
        
        points.push({ x, y });
      }
      break;
      
    case 'freeform':
      // Create freeform pool
      const freeformWidth = poolGeometry.dimensions.width;
      const freeformHeight = poolGeometry.dimensions.height;
      const freeformPoints = 20;
      
      for (let i = 0; i < freeformPoints; i++) {
        const angle = (i / freeformPoints) * Math.PI * 2;
        const radiusX = freeformWidth / 2;
        const radiusY = freeformHeight / 2;
        
        // Freeform shape with organic curves
        const noise = 0.1 + 0.2 * Math.sin(angle * 3) + 0.1 * Math.cos(angle * 5);
        const x = centerX + radiusX * Math.cos(angle) * (1 + noise);
        const y = centerY + radiusY * Math.sin(angle) * (1 + noise);
        
        points.push({ x, y });
      }
      break;
      
    default:
      // Default to rectangular
      const defaultWidth = poolGeometry.dimensions.width;
      const defaultHeight = poolGeometry.dimensions.height;
      points = [
        { x: centerX - defaultWidth / 2, y: centerY - defaultHeight / 2 },
        { x: centerX + defaultWidth / 2, y: centerY - defaultHeight / 2 },
        { x: centerX + defaultWidth / 2, y: centerY + defaultHeight / 2 },
        { x: centerX - defaultWidth / 2, y: centerY + defaultHeight / 2 },
      ];
  }
  
  return {
    id: `template_mask_${Date.now()}`,
    points,
    materialId: template.materials?.interior, // Default to interior material
    name: `${template.name} Pool`,
  };
}
