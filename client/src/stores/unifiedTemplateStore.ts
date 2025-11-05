// Unified Template Store
// Manages pool templates that can be used in both Library and Canvas
// Integrates with existing Materials and Assets systems

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { resolveAssetId } from '../new_editor/assets/store';
import { useMaskStore } from '../maskcore/store';

// Helper function to generate pool geometry points from template
function generatePoolMaskFromGeometry(template: UnifiedTemplate, imageCenterX: number = 1000, imageCenterY: number = 1000): any {
  const { poolGeometry } = template;
  const { type, dimensions, cornerRadius } = poolGeometry;
  
  // Generate points based on pool type (in local coordinate space, centered at 0,0)
  const points: Array<{ x: number; y: number; kind: 'corner' }> = [];
  
  switch (type) {
    case 'rect':
    case 'lap': {
      const halfWidth = dimensions.width / 2;
      const halfHeight = dimensions.height / 2;
      const radius = cornerRadius || 20;
      
      // Create rounded rectangle points
      points.push(
        { x: -halfWidth + radius, y: -halfHeight, kind: 'corner' },
        { x: halfWidth - radius, y: -halfHeight, kind: 'corner' },
        { x: halfWidth, y: -halfHeight + radius, kind: 'corner' },
        { x: halfWidth, y: halfHeight - radius, kind: 'corner' },
        { x: halfWidth - radius, y: halfHeight, kind: 'corner' },
        { x: -halfWidth + radius, y: halfHeight, kind: 'corner' },
        { x: -halfWidth, y: halfHeight - radius, kind: 'corner' },
        { x: -halfWidth, y: -halfHeight + radius, kind: 'corner' }
      );
      break;
    }
    case 'kidney': {
      // Kidney-shaped pool
      const numPoints = 16;
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const radiusX = dimensions.width / 2;
        const radiusY = dimensions.height / 2;
        const x = radiusX * Math.cos(angle) * (1 + 0.3 * Math.sin(angle * 2));
        const y = radiusY * Math.sin(angle) * (1 + 0.2 * Math.cos(angle * 2));
        points.push({ x, y, kind: 'corner' });
      }
      break;
    }
    case 'freeform': {
      // Freeform pool
      const numPoints = 20;
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const radiusX = dimensions.width / 2;
        const radiusY = dimensions.height / 2;
        const noise = 0.1 + 0.2 * Math.sin(angle * 3) + 0.1 * Math.cos(angle * 5);
        const x = radiusX * Math.cos(angle) * (1 + noise);
        const y = radiusY * Math.sin(angle) * (1 + noise);
        points.push({ x, y, kind: 'corner' });
      }
      break;
    }
    default: {
      // Default rectangular
      const halfWidth = dimensions.width / 2;
      const halfHeight = dimensions.height / 2;
      points.push(
        { x: -halfWidth, y: -halfHeight, kind: 'corner' },
        { x: halfWidth, y: -halfHeight, kind: 'corner' },
        { x: halfWidth, y: halfHeight, kind: 'corner' },
        { x: -halfWidth, y: halfHeight, kind: 'corner' }
      );
    }
  }
  
  // Transform points from local space to image space by adding center offset
  const transformedPoints = points.map(pt => ({
    ...pt,
    x: pt.x + imageCenterX,
    y: pt.y + imageCenterY
  }));
  
  // Check all material categories with priority order
  const selectedMaterial = template.materials.interior || 
                           template.materials.waterline || 
                           template.materials.coping || 
                           template.materials.paving || 
                           null;
  
  console.log('[Template] Generating mask with material:', {
    maskId: crypto.randomUUID().substring(0, 8),
    selectedMaterial,
    availableMaterials: template.materials
  });
  
  return {
    id: crypto.randomUUID(), // Use proper UUID for server compatibility
    pts: transformedPoints,
    mode: 'area' as const,
    materialId: selectedMaterial,
    materialSettings: selectedMaterial ? {
      opacity: 100,
      tint: 55,
      edgeFeather: 0,
      intensity: 50,
      textureScale: 100
    } : undefined,
    isVisible: true,
    type: 'area' as const,
    name: `${template.name} Pool`,
    isLocked: false,
    position: { x: 0, y: 0 },
    rotation: 0,
    createdAt: Date.now(),
    lastModified: Date.now()
  };
}

// Helper to get default sections for templates without sections defined
function getDefaultSections(template: UnifiedTemplate): TemplateSection[] {
  return [
    {
      type: 'interior',
      materialId: template.materials.interior,
      offsetMm: 0,
      defaultWidthMm: 0, // Interior has no width (it IS the base)
      isLocked: false
    },
    {
      type: 'waterline',
      materialId: template.materials.waterline,
      offsetMm: 150, // 150mm waterline band
      defaultWidthMm: 150,
      isLocked: false,
      minWidthMm: 50,
      maxWidthMm: 300
    },
    {
      type: 'coping',
      materialId: template.materials.coping,
      offsetMm: 200, // Additional 200mm for coping
      defaultWidthMm: 200,
      isLocked: true,
      minWidthMm: 100,
      maxWidthMm: 400
    },
    {
      type: 'paving',
      materialId: template.materials.paving,
      offsetMm: 600, // Additional 600mm for paving
      defaultWidthMm: 600,
      isLocked: true,
      minWidthMm: 300,
      maxWidthMm: 2000
    }
  ];
}

// Generate concentric rectangle points with offset
function generateConcentricRectangle(
  baseWidth: number,
  baseHeight: number,
  offset: number, // offset in pixels (can be negative for inward)
  cornerRadius: number = 0
): Array<{ x: number; y: number; kind: 'corner' }> {
  const points: Array<{ x: number; y: number; kind: 'corner' }> = [];
  
  // New dimensions after offset
  const width = baseWidth + (offset * 2);
  const height = baseHeight + (offset * 2);
  
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const radius = Math.max(0, cornerRadius || 20);
  
  // Create rounded rectangle points
  points.push(
    { x: -halfWidth + radius, y: -halfHeight, kind: 'corner' },
    { x: halfWidth - radius, y: -halfHeight, kind: 'corner' },
    { x: halfWidth, y: -halfHeight + radius, kind: 'corner' },
    { x: halfWidth, y: halfHeight - radius, kind: 'corner' },
    { x: halfWidth - radius, y: halfHeight, kind: 'corner' },
    { x: -halfWidth + radius, y: halfHeight, kind: 'corner' },
    { x: -halfWidth, y: halfHeight - radius, kind: 'corner' },
    { x: -halfWidth, y: -halfHeight + radius, kind: 'corner' }
  );
  
  return points;
}

// Generate multiple section masks from template
function generateMultiSectionMasks(
  template: UnifiedTemplate,
  imageCenterX: number,
  imageCenterY: number,
  pixelsPerMeter?: number
): any[] {
  const poolGeometry = template.poolGeometry;
  
  // Get sections (use default if not defined)
  const sections = template.sections || getDefaultSections(template);
  
  // Base pool dimensions
  const baseWidth = poolGeometry.dimensions.width;
  const baseHeight = poolGeometry.dimensions.height;
  const cornerRadius = poolGeometry.cornerRadius || 20;
  
  const masks: any[] = [];
  
  // Default section widths in millimeters
  const defaultWidthsMm = [0, 150, 200, 600]; // interior (0), waterline (150mm), coping (200mm), paving (600mm)
  
  // Check if calibration is available
  const hasCalibration = pixelsPerMeter !== undefined && pixelsPerMeter > 0;
  
  if (!hasCalibration && process.env.NODE_ENV !== 'production') {
    console.warn('[Template] No calibration data available, using fallback pixel offsets');
  }
  
  // Calculate cumulative pixel offsets from mm widths
  // Each section builds outward from the previous section
  let cumulativeOffset = 0;
  const offsetsPx: number[] = [];
  
  sections.forEach((section, index) => {
    const widthMm = section.defaultWidthMm || defaultWidthsMm[index] || 0;
    
    // Convert mm to pixels
    let widthPx = 0;
    if (hasCalibration) {
      // pixelsPerMeter converts from meters, so divide mm by 1000 first
      widthPx = (widthMm / 1000) * pixelsPerMeter!;
    } else {
      // Fallback: use fixed pixel offsets (assuming 100px = 1m, so 150mm ≈ 15px)
      widthPx = widthMm / 10;
    }
    
    // Add to cumulative offset
    cumulativeOffset += widthPx;
    offsetsPx.push(cumulativeOffset);
  });
  
  sections.forEach((section, index) => {
    // Use cumulative pixel offsets (each section expands outward from previous)
    const offset = offsetsPx[index] || 0;
    
    // Generate concentric rectangle points
    const points = generateConcentricRectangle(baseWidth, baseHeight, offset, cornerRadius);
    
    // Transform points to image space by adding center offset
    const transformedPoints = points.map(pt => ({
      ...pt,
      x: pt.x + imageCenterX,
      y: pt.y + imageCenterY
    }));
    
    // Determine material ID for this section
    let materialId: string | null = section.materialId || 
                       (section.type === 'interior' ? template.materials.interior : null) ||
                       (section.type === 'waterline' ? template.materials.waterline : null) ||
                       (section.type === 'coping' ? template.materials.coping : null) ||
                       (section.type === 'paving' ? template.materials.paving : null) ||
                       null;
    
      // Warn if material is missing for this section
      if (!materialId && index > 0 && process.env.NODE_ENV !== 'production') {
        console.warn(`[Template] Missing material for ${section.type} section in template "${template.name}"`);
      }
    
    masks.push({
      id: crypto.randomUUID(),
      pts: transformedPoints,
      mode: 'area' as const,
      materialId,
      materialSettings: materialId ? {
        opacity: 100,
        tint: 55,
        edgeFeather: 0,
        intensity: 50,
        textureScale: 100
      } : undefined,
      isVisible: true,
      type: 'area' as const,
      name: `${template.name} ${section.type}`,
      isLocked: section.isLocked || false,
      position: { x: 0, y: 0 },
      rotation: 0,
      createdAt: Date.now(),
      lastModified: Date.now(),
      // Phase 1 metadata for linking
      templateId: template.id,
      templateSectionType: section.type,
      templateGroupId: `template-group-${template.id}`, // Will be updated in applyTemplate
      // Z-order: Interior (index 0) should render on top, paving renders first
      // Lower zIndex = renders first (back), higher zIndex = renders last (front)
      zIndex: sections.length - 1 - index, // Reverse: interior (index 0) gets highest zIndex
      depthLevel: index === 0 ? 0 : 1, // Interior = depth 0, others = depth 1
      order: index
    });
  });
  
        if (process.env.NODE_ENV !== 'production') {
          console.log('[Template] Generated multi-section masks:', {
            templateId: template.id,
            sectionCount: masks.length,
            sections: masks.map(m => ({ type: m.templateSectionType, materialId: m.materialId }))
          });
        }
  
  return masks;
}

// Template section definition
export interface TemplateSection {
  type: 'interior' | 'waterline' | 'coping' | 'paving';
  materialId?: string;
  offsetMm: number; // Offset from previous section (0 for interior)
  defaultWidthMm?: number;
  isLocked?: boolean;
  minWidthMm?: number;
  maxWidthMm?: number;
  joinStyle?: 'miter' | 'round' | 'bevel';
}

// Helper function to convert template asset data to editor asset format
function convertTemplateAssetToEditorAsset(templateAsset: any): any {
  const resolvedAssetId = resolveAssetId(templateAsset.sourceId);
  if (!resolvedAssetId) {
    console.warn(`[Template] Could not resolve asset ID: ${templateAsset.sourceId}`);
    return null;
  }

  return {
    id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    defId: resolvedAssetId,
    x: templateAsset.x,
    y: templateAsset.y,
    scale: templateAsset.scale || 1.0,
    rotation: templateAsset.rotation || 0,
    opacity: templateAsset.opacity || 1.0,
    locked: false
  };
}

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
  
  // Multi-section definition (Phase 1+)
  sections?: TemplateSection[];
  
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

// Phase 2: Template group parameters for parametric editing
export interface TemplateGroupParams {
  templateGroupId: string;
  templateId: string;
  widthsMm: {
    waterline: number;
    coping: number;
    paving: number;
  };
  interiorSize?: { width: number; height: number }; // Optional for future
  lastModified: number;
}

interface UnifiedTemplateState {
  // Templates data
  templates: Record<string, UnifiedTemplate>;
  templateOrder: string[]; // For sorting/filtering
  
  // Phase 2: Active template groups and their parametric state
  activeTemplateGroups: Record<string, TemplateGroupParams>; // templateGroupId -> params
  debounceTimers: Record<string, NodeJS.Timeout>; // For debounced regeneration
  
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
  
  // Phase 2: Parametric editing actions
  setTemplateGroupWidth: (groupId: string, section: 'waterline' | 'coping' | 'paving', widthMm: number) => void;
  regenerateTemplateGroup: (groupId: string) => Promise<void>;
  getTemplateGroupParams: (groupId: string) => TemplateGroupParams | null;
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

/**
 * Persistence Schema for Template Group Params
 * 
 * Key: 'poolvisual:template-groups:v1'
 * Value: Record<string, TemplateGroupParams>
 * 
 * TemplateGroupParams {
 *   templateGroupId: string - Unique ID for this template application group
 *   templateId: string - Template ID this group is based on
 *   widthsMm: { waterline: number, coping: number, paving: number } - Section widths in mm
 *   interiorSize?: { width: number, height: number } - Optional interior dimensions
 *   lastModified: number - Unix timestamp of last modification
 * }
 * 
 * This data is loaded on app init and persisted on every param change.
 * Groups can regenerate their masks using this data + template definition.
 */

// Phase 2: Load template group params from localStorage
function loadTemplateGroupParams(): Record<string, TemplateGroupParams> {
  try {
    const stored = localStorage.getItem('poolvisual:template-groups:v1');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load template group params from localStorage:', error);
    return {};
  }
}

// Phase 2: Save template group params to localStorage
function saveTemplateGroupParams(params: Record<string, TemplateGroupParams>): void {
  try {
    localStorage.setItem('poolvisual:template-groups:v1', JSON.stringify(params));
  } catch (error) {
    console.warn('Failed to save template group params to localStorage:', error);
  }
}

export const useUnifiedTemplateStore = create<UnifiedTemplateState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    templates: {},
    templateOrder: [],
    activeTemplateGroups: {}, // Phase 2: Track parametric state
    debounceTimers: {}, // Phase 2: Track debounce timers
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
        
        // Phase 2: Load template group params
        const groupParams = loadTemplateGroupParams();
        
        set({ 
          templates, 
          templateOrder,
          activeTemplateGroups: groupParams,
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
        // Import stores dynamically to avoid circular imports
        const { useMaskStore } = await import('../maskcore/store');
        const { useAssetsStore } = await import('../new_editor/assets/store');
        const { useEditorStore } = await import('../new_editor/store');
        
        const maskStore = useMaskStore.getState();
        const assetsStore = useAssetsStore.getState();
        const editorStore = useEditorStore.getState();
        
        // Clear existing masks locally (no API calls)
        const existingMaskIds = Object.keys(maskStore.masks);
        
        // Update state to clear all masks at once
        useMaskStore.setState((state) => ({
          masks: {},
          selectedId: null
        }));
        
        // Note: Skip DELETE calls since we're clearing everything locally
        // This avoids server errors for local-only masks
        
        const assetIds = Object.keys(assetsStore.byId);
        for (const assetId of assetIds) {
          assetsStore.removeAsset(assetId);
        }

        // Get image dimensions from photo space to center the template
        const photoSpace = editorStore.photoSpace;
        const imageCenterX = photoSpace?.imgW ? photoSpace.imgW / 2 : 1000;
        const imageCenterY = photoSpace?.imgH ? photoSpace.imgH / 2 : 1000;
        
        // Get calibration for mm→px conversion
        const calibration = editorStore.calibration;
        const pixelsPerMeter = calibration?.pixelsPerMeter;
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('[Template] Centering template at:', { 
            imageCenterX, 
            imageCenterY, 
            photoSpace,
            hasCalibration: !!pixelsPerMeter,
            pixelsPerMeter 
          });
        }

        // Generate a single template group ID for all section masks
        const templateGroupId = `template-group-${template.id}-${Date.now()}`;

        // Determine if this is a legacy single-mask template or multi-section
        const isLegacyTemplate = !template.sections || template.sections.length === 0;
        
        let sectionMasks: any[];
        
        if (isLegacyTemplate) {
        // Legacy single-mask templates: create one mask as before
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Template] Applying legacy single-mask template "${template.name}"`);
        }
          const singleMask = generatePoolMaskFromGeometry(template, imageCenterX, imageCenterY);
          singleMask.templateGroupId = templateGroupId;
          sectionMasks = [singleMask];
        } else {
          // Multi-section templates: create 4 masks (interior, waterline, coping, paving)
          sectionMasks = generateMultiSectionMasks(
            template, 
            imageCenterX, 
            imageCenterY,
            pixelsPerMeter
          );
          
          // Assign consistent templateGroupId to all masks
          sectionMasks.forEach(mask => {
            mask.templateGroupId = templateGroupId;
          });
        }
        
        // Add all section masks to store in a single grouped transaction
        const masksObject = sectionMasks.reduce((acc, mask) => {
          acc[mask.id] = mask;
          return acc;
        }, {} as Record<string, any>);
        
        useMaskStore.setState((state) => ({
          masks: masksObject
        }));
        
        // Log summary after apply
        const sectionCounts = sectionMasks.reduce((acc, m) => {
          const key = m.templateSectionType || 'legacy';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Template] Applied template "${template.name}"`, {
            groupId: templateGroupId,
            type: isLegacyTemplate ? 'legacy' : 'multi-section',
            sections: sectionCounts,
            mmToPx: pixelsPerMeter ? `${(pixelsPerMeter / 1000).toFixed(1)} mm/px` : 'no calibration'
          });
        }

        // Add assets from template
        if (template.assets && template.assets.length > 0) {
          template.assets.forEach((templateAsset: any) => {
            assetsStore.addAsset(templateAsset.assetId, {
              x: templateAsset.position.x,
              y: templateAsset.position.y,
              scale: templateAsset.scale,
              rotation: templateAsset.rotation || 0,
              locked: false
            });
            console.log('[Template] Added asset:', templateAsset.assetId);
          });
        }

        // Phase 2: Store initial group params for parametric editing
        if (!isLegacyTemplate) {
          const initialParams: TemplateGroupParams = {
            templateGroupId,
            templateId: template.id,
            widthsMm: {
              waterline: 150,
              coping: 200,
              paving: 600
            },
            lastModified: Date.now()
          };
          
          set(state => {
            const updatedGroups = {
              ...state.activeTemplateGroups,
              [templateGroupId]: initialParams
            };
            saveTemplateGroupParams(updatedGroups); // Persist to localStorage
            return { activeTemplateGroups: updatedGroups };
          });
          
          console.log('[Template] Stored initial params for group:', templateGroupId);
        }

        console.log('Template applied successfully:', template.name);
      } catch (error) {
        console.error('Failed to apply template:', error);
        throw error;
      }
    },
    
    // Phase 2: Get template group params
    getTemplateGroupParams: (groupId) => {
      const state = get();
      return state.activeTemplateGroups[groupId] || null;
    },
    
    // Phase 2: Set width with debounced regeneration
    setTemplateGroupWidth: (groupId, section, widthMm) => {
      const state = get();
      const params = state.activeTemplateGroups[groupId];
      if (!params) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Template] Cannot set width for unknown group:', groupId);
        }
        return;
      }
      
      // Update params
      const newParams: TemplateGroupParams = {
        ...params,
        widthsMm: {
          ...params.widthsMm,
          [section]: widthMm
        },
        lastModified: Date.now()
      };
      
      set(state => {
        const updatedGroups = {
          ...state.activeTemplateGroups,
          [groupId]: newParams
        };
        saveTemplateGroupParams(updatedGroups); // Persist to localStorage
        return { activeTemplateGroups: updatedGroups };
      });
      
      // Clear existing timer
      const existingTimer = state.debounceTimers[groupId];
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Debounce regeneration (250ms)
      const timer = setTimeout(() => {
        get().regenerateTemplateGroup(groupId).catch(err => {
          console.error('[Template] Failed to regenerate group:', err);
        });
      }, 250);
      
      set(state => ({
        debounceTimers: {
          ...state.debounceTimers,
          [groupId]: timer
        }
      }));
    },
    
    // Phase 2: Regenerate template group masks
    regenerateTemplateGroup: async (groupId) => {
      const state = get();
      const params = state.activeTemplateGroups[groupId];
      const template = state.templates[params?.templateId || ''];
      
      if (!params || !template) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Template] Cannot regenerate - missing params or template:', groupId);
        }
        return;
      }
      
      try {
        // Import stores dynamically
        const { useMaskStore } = await import('../maskcore/store');
        const { useEditorStore } = await import('../new_editor/store');
        
        const maskStore = useMaskStore.getState();
        const editorStore = useEditorStore.getState();
        
        // Get calibration
        const calibration = editorStore.calibration;
        const pixelsPerMeter = calibration?.pixelsPerMeter;
        
        // Get photo space
        const photoSpace = editorStore.photoSpace;
        const imageCenterX = photoSpace?.imgW ? photoSpace.imgW / 2 : 1000;
        const imageCenterY = photoSpace?.imgH ? photoSpace.imgH / 2 : 1000;
        
        // Find existing masks in this group
        const existingMasks = Object.values(maskStore.masks).filter(m => 
          m.templateGroupId === groupId
        );
        
        if (existingMasks.length === 0) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[Template] No masks found for group:', groupId);
          }
          return;
        }
        
        // Store materials and metadata from existing masks
        const materialMap = new Map<string, string | null>();
        existingMasks.forEach(mask => {
          if (mask.templateSectionType) {
            materialMap.set(mask.templateSectionType, mask.materialId || null);
          }
        });
        
        // Regenerate with updated widths
        const regeneratedSections = template.sections || getDefaultSections(template);
        
        // Update default widths from params
        regeneratedSections.forEach((section, index) => {
          if (section.type === 'waterline') section.defaultWidthMm = params.widthsMm.waterline;
          if (section.type === 'coping') section.defaultWidthMm = params.widthsMm.coping;
          if (section.type === 'paving') section.defaultWidthMm = params.widthsMm.paving;
        });
        
        // Generate new masks
        const newMasks = generateMultiSectionMasks(
          { ...template, sections: regeneratedSections },
          imageCenterX,
          imageCenterY,
          pixelsPerMeter
        );
        
        // Restore materials and group ID
        newMasks.forEach(mask => {
          mask.templateGroupId = groupId;
          const oldMaterial = materialMap.get(mask.templateSectionType || '');
          if (oldMaterial !== undefined) mask.materialId = oldMaterial;
        });
        
        // Update mask store
        const masksObject = newMasks.reduce((acc, mask) => {
          acc[mask.id] = mask;
          return acc;
        }, {} as Record<string, any>);
        
        // Merge with existing masks (replace only this group)
        const allMasks = { ...maskStore.masks };
        newMasks.forEach(mask => {
          allMasks[mask.id] = mask;
        });
        
        const regenStart = performance.now();
        useMaskStore.setState({ masks: allMasks });
        const regenEnd = performance.now();
        
        // Dev telemetry
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Template] Regenerated group ${groupId}`, {
            groupId,
            widthsMm: params.widthsMm,
            pixelsPerMeter: pixelsPerMeter || 0,
            durationMs: regenEnd - regenStart,
            sectionCount: newMasks.length
          });
        }
      } catch (error) {
        console.error('[Template] Failed to regenerate group:', error);
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
