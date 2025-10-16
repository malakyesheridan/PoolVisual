/**
 * Clean mask store - minimal state model
 */

import { create } from 'zustand';
import { useMaterialUsageStore } from '../stores/materialUsageStore';
import { useProjectStore } from '../stores/projectStore';
import { useStatusSyncStore } from '../stores/statusSyncStore';
import { calculatePolygonArea } from '../new_editor/utils';

export interface Pt {
  x: number;
  y: number;
}

export interface Mask {
  id: string;
  pts: Pt[];
  mode: 'area' | 'polygon';
  materialId?: string | null;
  // NEW (additive) - Full material settings schema
  materialSettings?: {
    // Common (Konva + Canvas)
    opacity?: number;         // 0..100 (default 70)
    tint?: number;            // 0..100 (default 55; multiply overlay; cap internal effect at 0.6)
    edgeFeather?: number;     // 0..20 px (default 0; zoom/DPR invariant)
    intensity?: number;       // 0..100 (default 50; maps to contrast/brightness; neutral at 50)
    textureScale?: number;    // 10..300% (default 100; multiplies base tiling density)
    
    // Underwater V1 / V1.5 / V1.6 (Canvas2D compositing)
    blend?: number;           // 0..100 (default 65)
    refraction?: number;       // 0..100 (default 25)
    edgeSoftness?: number;    // 0..12 px (default 6; zoom/DPR invariant)
    depthBias?: number;       // 0..100 (default 35)
    highlights?: number;      // 0..100 (default 20)
    ripple?: number;          // 0..100 (default 0; zoom/DPR capped amplitude)
    materialOpacity?: number; // 0..100 (default 85)
    contactOcclusion?: number; // 0..100 (default 9; zoom/DPR invariant radius)
    textureBoost?: number;    // 0..100 (default 20)
    
    // Underwater V2 (advanced)
    underwaterVersion?: 'v1' | 'v2'; // default 'v1'
    meniscus?: number;        // 0..100 (default 32; DPR-aware stroke width)
    softness?: number;        // 0..100 (default 0)
    
    // Internal/cached values (read-only)
    sampledWaterHue?: { h: number; s: number; v: number };
    causticMask?: string;
  };
  
  // Mask Management (additive) - For professional project management
  name?: string;                // Custom mask name (e.g., "Pool Steps", "Main Area")
  isVisible?: boolean;          // Show/hide toggle (default: true)
  isLocked?: boolean;           // Prevent editing (default: false)
  groupId?: string | null;      // Group association for organization
  order?: number;               // Display order in UI (lower = first)
  createdAt?: number;           // Creation timestamp (ISO)
  lastModified?: number;        // Last modification timestamp (ISO)
  color?: string;               // Custom mask color for visual identification
  notes?: string;               // User notes for this mask
  
  // Drag functionality (additive) - For mask positioning
  position?: Pt;                // Global offset from original position (default: {x: 0, y: 0})
  rotation?: number;            // Rotation in degrees (default: 0)
  isDragging?: boolean;         // Temporary state during drag (default: false)
}

// Mask Group - For organizing masks into logical categories
export interface MaskGroup {
  id: string;
  name: string;
  color: string;
  isCollapsed: boolean;
  order: number;
  createdAt: number;
}

// Quote Generation Interfaces
export interface QuoteItem {
  id: string;
  maskId: string;
  materialId: string;
  area: number; // in square meters
  materialCost: number; // cost per square meter
  laborCost: number; // labor cost per square meter
  markup: number; // markup percentage (e.g., 20 for 20%)
  subtotal: number; // (materialCost + laborCost) * area * (1 + markup/100)
  notes?: string;
}

export interface Quote {
  id: string;
  name: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  projectAddress?: string;
  items: QuoteItem[];
  subtotal: number;
  taxRate: number; // percentage (e.g., 8.5 for 8.5%)
  taxAmount: number;
  total: number;
  notes?: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'completed';
  createdAt: number;
  lastModified: number;
  sentAt?: number;
  approvedAt?: number;
  expiresAt?: number; // quote expiration date
}

interface MaskState {
  masks: Record<string, Mask>;
  draft: Mask | null;
  selectedId: string | null;
  // Additive:
  activeMaterialId: string | null;
  // Mask Management:
  maskGroups: Record<string, MaskGroup>;
  nextMaskOrder: number;        // Counter for mask ordering
  // Quote Generation State
  quotes: Record<string, Quote>;
  activeQuoteId: string | null;
  quoteSettings: {
    defaultMarkup: number; // default markup percentage
    defaultTaxRate: number; // default tax rate percentage
    defaultLaborCost: number; // default labor cost per square meter
  };
  // Point Editing State (additive - no impact on existing functionality)
  pointEditingMode: boolean;
  editingMaskId: string | null;
  // Move State (additive - no impact on existing functionality)
  moveState: {
    isMoveMode: boolean;
    moveModeMaskId: string | null;
    isDragging: boolean;
    dragStartPos: Pt | null;
    dragStartOffset: Pt | null;
  };
  // Rotate State (additive - no impact on existing functionality)
  rotateState: {
    isRotateMode: boolean;
    rotateModeMaskId: string | null;
    isDragging: boolean;
    dragStartAngle: number | null;
    dragStartRotation: number | null;
  };
}

interface MaskActions {
  BEGIN: () => void;
  APPEND: (pt: Pt) => void;
  POP: () => void;
  CANCEL: () => void;
  FINALIZE: () => void;
  SELECT: (id: string | null) => void;
  DELETE: (id: string) => void;
  SET_MATERIAL: (maskId: string, materialId: string) => void;
  // Additive:
  ASSIGN_MATERIAL: (maskId: string, materialId: string | null) => void;
  SET_ACTIVE_MATERIAL: (materialId: string | null) => void;
  SET_MATERIAL_SETTINGS: (maskId: string, settings: Partial<Mask['materialSettings']>) => void;
  // Mask Management Actions:
  RENAME_MASK: (maskId: string, name: string) => void;
  TOGGLE_MASK_VISIBILITY: (maskId: string) => void;
  TOGGLE_MASK_LOCK: (maskId: string) => void;
  SET_MASK_COLOR: (maskId: string, color: string) => void;
  SET_MASK_NOTES: (maskId: string, notes: string) => void;
  MOVE_MASK_TO_GROUP: (maskId: string, groupId: string | null) => void;
  REORDER_MASK: (maskId: string, newOrder: number) => void;
  // Group Management Actions:
  CREATE_GROUP: (name: string) => string;
  RENAME_GROUP: (groupId: string, name: string) => void;
  DELETE_GROUP: (groupId: string) => void;
  TOGGLE_GROUP_COLLAPSED: (groupId: string) => void;
  SET_GROUP_COLOR: (groupId: string, color: string) => void;
  // Quote Generation Actions:
  CREATE_QUOTE: (name: string) => string;
  UPDATE_QUOTE: (quoteId: string, updates: Partial<Quote>) => void;
  DELETE_QUOTE: (quoteId: string) => void;
  SET_ACTIVE_QUOTE: (quoteId: string | null) => void;
  ADD_QUOTE_ITEM: (quoteId: string, maskId: string, materialId: string, pixelsPerMeter?: number) => void;
  UPDATE_QUOTE_ITEM: (quoteId: string, itemId: string, updates: Partial<QuoteItem>) => void;
  REMOVE_QUOTE_ITEM: (quoteId: string, itemId: string) => void;
  UPDATE_QUOTE_SETTINGS: (settings: Partial<MaskState['quoteSettings']>) => void;
  CALCULATE_QUOTE_TOTALS: (quoteId: string) => void;
  // Point Editing Actions (additive - no impact on existing functionality)
  ENTER_POINT_EDITING: (maskId: string) => void;
  EXIT_POINT_EDITING: () => void;
  UPDATE_MASK_POINT: (maskId: string, pointIndex: number, newPoint: Pt) => void;
  ADD_MASK_POINT: (maskId: string, pointIndex: number, newPoint: Pt) => void;
  REMOVE_MASK_POINT: (maskId: string, pointIndex: number) => void;
  // Move Actions (additive - no impact on existing functionality)
  ENTER_MOVE_MODE: (maskId: string) => void;
  EXIT_MOVE_MODE: () => void;
  START_MOVE_DRAG: (maskId: string, startPos: Pt) => void;
  UPDATE_MOVE_DRAG: (maskId: string, delta: Pt) => void;
  END_MOVE_DRAG: (maskId: string) => void;
  // Rotate Actions (additive - no impact on existing functionality)
  ENTER_ROTATE_MODE: (maskId: string) => void;
  EXIT_ROTATE_MODE: () => void;
  START_ROTATE_DRAG: (maskId: string, startAngle: number) => void;
  UPDATE_ROTATE_DRAG: (maskId: string, deltaAngle: number) => void;
  END_ROTATE_DRAG: (maskId: string) => void;
}

type MaskStore = MaskState & MaskActions;

export const useMaskStore = create<MaskStore>((set, get) => ({
  masks: {},
  draft: null,
  selectedId: null,
  // Additive:
  activeMaterialId: null,
  // Mask Management:
  maskGroups: {},
  nextMaskOrder: 1,
  // Quote Generation:
  quotes: {},
  activeQuoteId: null,
  quoteSettings: {
    defaultMarkup: 25, // 25% markup
    defaultTaxRate: 8.5, // 8.5% tax
    defaultLaborCost: 15, // $15 per square meter
  },
  // Point Editing State (additive - no impact on existing functionality)
  pointEditingMode: false,
  editingMaskId: null,
  // Move State (additive - no impact on existing functionality)
  moveState: {
    isMoveMode: false,
    moveModeMaskId: null,
    isDragging: false,
    dragStartPos: null,
    dragStartOffset: null,
  },
  // Rotate State (additive - no impact on existing functionality)
  rotateState: {
    isRotateMode: false,
    rotateModeMaskId: null,
    isDragging: false,
    dragStartAngle: null,
    dragStartRotation: null,
  },

  BEGIN: () => {
    const id = `mask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    set({
      draft: {
        id,
        pts: []
      }
    });
  },

  APPEND: (pt) => {
    const { draft } = get();
    if (!draft) return;

    set({
      draft: {
        ...draft,
        pts: [...draft.pts, pt]
      }
    });
  },

  POP: () => {
    const { draft } = get();
    if (!draft || draft.pts.length <= 1) return;

    set({
      draft: {
        ...draft,
        pts: draft.pts.slice(0, -1)
      }
    });
  },

  CANCEL: () => {
    set({
      draft: null
    });
  },

  FINALIZE: () => {
    const { draft, nextMaskOrder, masks } = get();
    if (!draft || draft.pts.length < 3) return;

    // Calculate default mask name based on existing masks count
    const existingCount = Object.keys(masks).length;
    const defaultName = `Mask ${existingCount + 1}`;
    
    const now = Date.now();
    const finalizedMask: Mask = { 
      ...draft,
      // Set default values for management fields
      name: defaultName,
      isVisible: true,
      isLocked: false,
      groupId: null,
      order: nextMaskOrder,
      createdAt: now,
      lastModified: now,
      color: undefined,
      notes: undefined
    };
    
    set({
      masks: {
        ...get().masks,
        [draft.id]: finalizedMask
      },
      draft: null,
      selectedId: draft.id,
      nextMaskOrder: nextMaskOrder + 1
    });

    // Generate notification for mask creation
    generateMaskNotification('mask_created', finalizedMask, draft.id);
  },

  SELECT: (id) => {
    set({
      selectedId: id
    });
  },

  DELETE: (id) => {
    const { masks, selectedId } = get();
    const mask = masks[id];
    
    // Check if mask is locked
    if (mask?.isLocked) {
      console.log('[DELETE] Mask is locked, deletion prevented:', id);
      return;
    }
    
    const newMasks = { ...masks };
    delete newMasks[id];
    
    set({
      masks: newMasks,
      selectedId: selectedId === id ? null : selectedId
    });
  },

  SET_MATERIAL: (maskId, materialId) => {
    const { masks } = get();
    const mask = masks[maskId];
    if (!mask) return;

    // Check if mask is locked
    if (mask.isLocked) {
      console.log('[SET_MATERIAL] Mask is locked, material assignment prevented:', maskId);
      return;
    }

    set({
      masks: {
        ...masks,
        [maskId]: {
          ...masks[maskId],
          materialId
        }
      }
    });
    
    console.log('[SET_MATERIAL]', maskId, materialId, get().masks[maskId]);
  },

  // Additive actions:
  ASSIGN_MATERIAL: (maskId, materialId) => {
    console.log('[MaterialAssign]', { maskId, materialId });
    const { masks } = get();
    const m = masks[maskId];
    if (!m) return;
    
    // Check if mask is locked
    if (m.isLocked) {
      console.log('[ASSIGN_MATERIAL] Mask is locked, material assignment prevented:', maskId);
      return;
    }
    
    const updatedMask = { ...m, materialId };
    set({ masks: { ...masks, [maskId]: updatedMask } });
    
    // Track material usage if material is assigned and project context exists
    if (materialId) {
      trackMaterialUsage(updatedMask, maskId);
      // Generate notification for material assignment
      generateMaskNotification('material_assigned', updatedMask, maskId);
    } else {
      // Remove material usage if material is unassigned
      const materialUsageStore = useMaterialUsageStore.getState();
      materialUsageStore.removeMaterialUsage(maskId);
    }
    
    console.log('[ASSIGN_MATERIAL]', { maskId, materialId });
  },

  SET_ACTIVE_MATERIAL: (materialId) => {
    console.log('[MaterialSelect]', { materialId });
    set({ activeMaterialId: materialId });
  },

  SET_MATERIAL_SETTINGS: (maskId, settings) => {
    console.log('[SET_MATERIAL_SETTINGS]', { maskId, settings });
    const { masks } = get();
    const m = masks[maskId];
    if (!m) return;
    
    // Check if mask is locked
    if (m.isLocked) {
      console.log('[SET_MATERIAL_SETTINGS] Mask is locked, settings update prevented:', maskId);
      return;
    }
    
    const updatedMask = {
      ...m, 
      materialSettings: { 
        ...m.materialSettings, 
        ...settings 
      },
      lastModified: Date.now()
    };
    
    set({ 
      masks: { 
        ...masks, 
        [maskId]: updatedMask
      } 
    });

    // Track material usage if material is assigned and project context exists
    if (updatedMask.materialId) {
      trackMaterialUsage(updatedMask, maskId);
    }
  },

  // Mask Management Action Implementations:
  RENAME_MASK: (maskId, name) => {
    const { masks } = get();
    const mask = masks[maskId];
    if (!mask) return;
    
    set({
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          name,
          lastModified: Date.now()
        }
      }
    });
  },

  TOGGLE_MASK_VISIBILITY: (maskId) => {
    const { masks } = get();
    const mask = masks[maskId];
    if (!mask) return;
    
    set({
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          isVisible: !(mask.isVisible ?? true),
          lastModified: Date.now()
        }
      }
    });
  },

  TOGGLE_MASK_LOCK: (maskId) => {
    const { masks } = get();
    const mask = masks[maskId];
    if (!mask) return;
    
    set({
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          isLocked: !(mask.isLocked ?? false),
          lastModified: Date.now()
        }
      }
    });
  },

  SET_MASK_COLOR: (maskId, color) => {
    const { masks } = get();
    const mask = masks[maskId];
    if (!mask) return;
    
    set({
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          color,
          lastModified: Date.now()
        }
      }
    });
  },

  SET_MASK_NOTES: (maskId, notes) => {
    const { masks } = get();
    const mask = masks[maskId];
    if (!mask) return;
    
    set({
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          notes,
          lastModified: Date.now()
        }
      }
    });
  },

  MOVE_MASK_TO_GROUP: (maskId, groupId) => {
    const { masks } = get();
    const mask = masks[maskId];
    if (!mask) return;
    
    set({
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          groupId,
          lastModified: Date.now()
        }
      }
    });
  },

  REORDER_MASK: (maskId, newOrder) => {
    const { masks } = get();
    const mask = masks[maskId];
    if (!mask) return;
    
    set({
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          order: newOrder,
          lastModified: Date.now()
        }
      }
    });
  },

  // Group Management Action Implementations:
  CREATE_GROUP: (name) => {
    const { maskGroups } = get();
    const id = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const newGroup: MaskGroup = {
      id,
      name,
      color: '#3b82f6', // Default blue color
      isCollapsed: false,
      order: Object.keys(maskGroups).length + 1,
      createdAt: now
    };
    
    set({
      maskGroups: {
        ...maskGroups,
        [id]: newGroup
      }
    });
    
    return id;
  },

  RENAME_GROUP: (groupId, name) => {
    const { maskGroups } = get();
    const group = maskGroups[groupId];
    if (!group) return;
    
    set({
      maskGroups: {
        ...maskGroups,
        [groupId]: {
          ...group,
          name
        }
      }
    });
  },

  DELETE_GROUP: (groupId) => {
    const { maskGroups, masks } = get();
    const newGroups = { ...maskGroups };
    delete newGroups[groupId];
    
    // Move all masks in this group to no group
    const updatedMasks = { ...masks };
    Object.keys(updatedMasks).forEach(maskId => {
      if (updatedMasks[maskId].groupId === groupId) {
        updatedMasks[maskId] = {
          ...updatedMasks[maskId],
          groupId: null
        };
      }
    });
    
    set({
      maskGroups: newGroups,
      masks: updatedMasks
    });
  },

  TOGGLE_GROUP_COLLAPSED: (groupId) => {
    const { maskGroups } = get();
    const group = maskGroups[groupId];
    if (!group) return;
    
    set({
      maskGroups: {
        ...maskGroups,
        [groupId]: {
          ...group,
          isCollapsed: !group.isCollapsed
        }
      }
    });
  },

  SET_GROUP_COLOR: (groupId, color) => {
    const { maskGroups } = get();
    const group = maskGroups[groupId];
    if (!group) return;
    
    set({
      maskGroups: {
        ...maskGroups,
        [groupId]: {
          ...group,
          color
        } 
      } 
    });
  },

  // Quote Generation Action Implementations:
  CREATE_QUOTE: (name) => {
    const id = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const newQuote: Quote = {
      id,
      name,
      items: [],
      subtotal: 0,
      taxRate: get().quoteSettings.defaultTaxRate,
      taxAmount: 0,
      total: 0,
      status: 'draft',
      createdAt: now,
      lastModified: now
    };
    
    set({
      quotes: {
        ...get().quotes,
        [id]: newQuote
      },
      activeQuoteId: id
    });
    
    return id;
  },

  UPDATE_QUOTE: (quoteId, updates) => {
    const { quotes } = get();
    const quote = quotes[quoteId];
    if (!quote) return;
    
    set({
      quotes: {
        ...quotes,
        [quoteId]: {
          ...quote,
          ...updates,
          lastModified: Date.now()
        }
      }
    });
  },

  DELETE_QUOTE: (quoteId) => {
    const { quotes, activeQuoteId } = get();
    const newQuotes = { ...quotes };
    delete newQuotes[quoteId];
    
    set({
      quotes: newQuotes,
      activeQuoteId: activeQuoteId === quoteId ? null : activeQuoteId
    });
  },

  SET_ACTIVE_QUOTE: (quoteId) => {
    set({ activeQuoteId: quoteId });
  },

  ADD_QUOTE_ITEM: (quoteId, maskId, materialId, pixelsPerMeter = 100) => {
    const { quotes, masks, quoteSettings } = get();
    const quote = quotes[quoteId];
    const mask = masks[maskId];
    
    if (!quote || !mask) return;
    
    // Calculate area using proper polygon area calculation
    // Import the calculation function dynamically to avoid circular imports
    const calculatePolygonArea = (points: Pt[]): number => {
      if (points.length < 3) return 0;
      let area = 0;
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
      }
      return Math.abs(area) / 2;
    };
    
    const areaPixels = calculatePolygonArea(mask.pts);
    const area = areaPixels / (pixelsPerMeter * pixelsPerMeter); // Convert to square meters
    
    const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const materialCost = 50; // Placeholder - will be fetched from material registry
    const laborCost = quoteSettings.defaultLaborCost;
    const markup = quoteSettings.defaultMarkup;
    const subtotal = (materialCost + laborCost) * area * (1 + markup / 100);
    
    const newItem: QuoteItem = {
      id: itemId,
      maskId,
      materialId,
      area,
      materialCost,
      laborCost,
      markup,
      subtotal
    };
    
    const updatedQuote = {
      ...quote,
      items: [...quote.items, newItem],
      lastModified: Date.now()
    };
    
    set({
      quotes: {
        ...quotes,
        [quoteId]: updatedQuote
      }
    });
    
    // Recalculate totals
    get().CALCULATE_QUOTE_TOTALS(quoteId);
  },

  UPDATE_QUOTE_ITEM: (quoteId, itemId, updates) => {
    const { quotes } = get();
    const quote = quotes[quoteId];
    if (!quote) return;
    
    const updatedItems = quote.items.map(item => 
      item.id === itemId 
        ? { ...item, ...updates }
        : item
    );
    
    set({
      quotes: {
        ...quotes,
        [quoteId]: {
          ...quote,
          items: updatedItems,
          lastModified: Date.now()
        }
      }
    });
    
    // Recalculate totals
    get().CALCULATE_QUOTE_TOTALS(quoteId);
  },

  REMOVE_QUOTE_ITEM: (quoteId, itemId) => {
    const { quotes } = get();
    const quote = quotes[quoteId];
    if (!quote) return;
    
    const updatedItems = quote.items.filter(item => item.id !== itemId);
    
    set({
      quotes: {
        ...quotes,
        [quoteId]: {
          ...quote,
          items: updatedItems,
          lastModified: Date.now()
        }
      }
    });
    
    // Recalculate totals
    get().CALCULATE_QUOTE_TOTALS(quoteId);
  },

  UPDATE_QUOTE_SETTINGS: (settings) => {
    set({
      quoteSettings: {
        ...get().quoteSettings,
        ...settings
      }
    });
  },

  CALCULATE_QUOTE_TOTALS: (quoteId) => {
    const { quotes } = get();
    const quote = quotes[quoteId];
    if (!quote) return;
    
    const subtotal = quote.items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = subtotal * (quote.taxRate / 100);
    const total = subtotal + taxAmount;
    
    set({
      quotes: {
        ...quotes,
        [quoteId]: {
          ...quote,
          subtotal,
          taxAmount,
          total,
          lastModified: Date.now()
        }
      }
    });
  },

  // Point Editing Actions (additive - no impact on existing functionality)
  ENTER_POINT_EDITING: (maskId) => {
    const { masks } = get();
    const mask = masks[maskId];
    
    console.log('[ENTER_POINT_EDITING] Called', {
      maskId,
      maskExists: !!mask,
      maskLocked: mask?.isLocked,
      currentState: {
        pointEditingMode: get().pointEditingMode,
        editingMaskId: get().editingMaskId,
        selectedId: get().selectedId
      }
    });
    
    // Only allow editing if mask exists and is not locked
    if (mask && !mask.isLocked) {
      const newState = {
        pointEditingMode: true,
        editingMaskId: maskId,
        selectedId: maskId // Select the mask when entering edit mode
      };
      
      console.log('[ENTER_POINT_EDITING] Setting new state:', newState);
      set(newState);
    } else {
      console.log('[ENTER_POINT_EDITING] Cannot enter edit mode:', {
        maskExists: !!mask,
        maskLocked: mask?.isLocked
      });
    }
  },

  EXIT_POINT_EDITING: () => {
    set({
      pointEditingMode: false,
      editingMaskId: null
    });
  },

  UPDATE_MASK_POINT: (maskId, pointIndex, newPoint) => {
    const { masks } = get();
    const mask = masks[maskId];
    
    if (!mask || mask.isLocked || pointIndex < 0 || pointIndex >= mask.pts.length) {
      return;
    }
    
    // Create new points array with updated point
    const newPoints = [...mask.pts];
    newPoints[pointIndex] = newPoint;
    
    // Update mask with new points
    set({
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          pts: newPoints,
          lastModified: Date.now()
        }
      }
    });
  },

  ADD_MASK_POINT: (maskId, pointIndex, newPoint) => {
    const { masks } = get();
    const mask = masks[maskId];
    
    if (!mask || mask.isLocked || pointIndex < 0 || pointIndex > mask.pts.length) {
      return;
    }
    
    // Insert new point at specified index
    const newPoints = [...mask.pts];
    newPoints.splice(pointIndex, 0, newPoint);
    
    // Update mask with new points
    set({
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          pts: newPoints,
          lastModified: Date.now()
        }
      }
    });
  },

  REMOVE_MASK_POINT: (maskId, pointIndex) => {
    const { masks } = get();
    const mask = masks[maskId];
    
    if (!mask || mask.isLocked || pointIndex < 0 || pointIndex >= mask.pts.length || mask.pts.length <= 3) {
      return; // Don't allow removing points if mask would have less than 3 points
    }
    
    // Remove point at specified index
    const newPoints = [...mask.pts];
    newPoints.splice(pointIndex, 1);
    
    // Update mask with new points
    set({
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          pts: newPoints,
          lastModified: Date.now()
        } 
      } 
    });
  },

  // Drag Actions (additive - no impact on existing functionality)
  START_MASK_DRAG: (maskId, startPos) => {
    const { masks, dragState } = get();
    const mask = masks[maskId];
    
    if (!mask || mask.isLocked) {
      return; // Don't allow dragging locked masks
    }
    
    // Clear any existing drag timer
    if (dragState.dragTimer) {
      clearTimeout(dragState.dragTimer);
    }
    
    // Get current position offset (default to {x: 0, y: 0} if not set)
    const currentOffset = mask.position || { x: 0, y: 0 };
    
    console.log('[START_MASK_DRAG]', { maskId, startPos, currentOffset });
    
    set({
      dragState: {
        isDragging: true,
        draggingMaskId: maskId,
        dragStartPos: startPos,
        dragStartOffset: currentOffset,
        dragTimer: null,
      },
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          isDragging: true
        }
      }
    });
  },

  UPDATE_MASK_DRAG: (maskId, delta) => {
    const { masks, dragState } = get();
    const mask = masks[maskId];
    
    if (!mask || !dragState.isDragging || dragState.draggingMaskId !== maskId) {
      return;
    }
    
    // Calculate new position by adding delta to start offset
    const newPosition = {
      x: (dragState.dragStartOffset?.x || 0) + delta.x,
      y: (dragState.dragStartOffset?.y || 0) + delta.y
    };
    
    console.log('[UPDATE_MASK_DRAG]', { maskId, delta, newPosition });
    
    set({
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          position: newPosition,
          lastModified: Date.now()
        }
      }
    });
  },

  END_MASK_DRAG: (maskId) => {
    const { masks, dragState } = get();
    const mask = masks[maskId];
    
    if (!mask || !dragState.isDragging || dragState.draggingMaskId !== maskId) {
      return;
    }
    
    console.log('[END_MASK_DRAG]', { maskId });
    
    set({
      dragState: {
        isDragging: false,
        draggingMaskId: null,
        dragStartPos: null,
        dragStartOffset: null,
        dragTimer: null,
      },
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          isDragging: false,
          lastModified: Date.now()
        }
      }
    });
  },

  CANCEL_MASK_DRAG: () => {
    const { dragState } = get();
    
    // Clear any pending drag timer
    if (dragState.dragTimer) {
      clearTimeout(dragState.dragTimer);
    }
    
    console.log('[CANCEL_MASK_DRAG]');
    
    set({
      dragState: {
        isDragging: false,
        draggingMaskId: null,
        dragStartPos: null,
        dragStartOffset: null,
        dragTimer: null,
      }
    });
  },

  // Move Actions (additive - no impact on existing functionality)
  ENTER_MOVE_MODE: (maskId) => {
    const { masks } = get();
    const mask = masks[maskId];
    
    if (!mask || mask.isLocked) {
      return; // Don't allow moving locked masks
    }
    
    console.log('[ENTER_MOVE_MODE]', { maskId });
    
    set({
      moveState: {
        isMoveMode: true,
        moveModeMaskId: maskId,
        isDragging: false,
        dragStartPos: null,
        dragStartOffset: null,
      }
    });
  },

  EXIT_MOVE_MODE: () => {
    console.log('[EXIT_MOVE_MODE]');
    
    set({
      moveState: {
        isMoveMode: false,
        moveModeMaskId: null,
        isDragging: false,
        dragStartPos: null,
        dragStartOffset: null,
      }
    });
  },

  START_MOVE_DRAG: (maskId, startPos) => {
    const { masks, moveState } = get();
    const mask = masks[maskId];
    
    if (!mask || !moveState.isMoveMode || moveState.moveModeMaskId !== maskId) {
      return;
    }
    
    // Get current position offset (default to {x: 0, y: 0} if not set)
    const currentOffset = mask.position || { x: 0, y: 0 };
    
    console.log('[START_MOVE_DRAG]', { maskId, startPos, currentOffset });
    
    set({
      moveState: {
        ...moveState,
        isDragging: true,
        dragStartPos: startPos,
        dragStartOffset: currentOffset,
      }
    });
  },

  UPDATE_MOVE_DRAG: (maskId, delta) => {
    const { masks, moveState } = get();
    const mask = masks[maskId];
    
    if (!mask || !moveState.isDragging || moveState.moveModeMaskId !== maskId) {
      return;
    }
    
    // Calculate new position by adding delta to start offset
    const newPosition = {
      x: (moveState.dragStartOffset?.x || 0) + delta.x,
      y: (moveState.dragStartOffset?.y || 0) + delta.y
    };
    
    console.log('[UPDATE_MOVE_DRAG]', { maskId, delta, newPosition });
    
    set({
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          position: newPosition,
          lastModified: Date.now()
        }
      }
    });
  },

  END_MOVE_DRAG: (maskId) => {
    const { masks, moveState } = get();
    const mask = masks[maskId];
    
    if (!mask || !moveState.isDragging || moveState.moveModeMaskId !== maskId) {
      return;
    }
    
    console.log('[END_MOVE_DRAG]', { maskId });
    
    set({
      moveState: {
        ...moveState,
        isDragging: false,
        dragStartPos: null,
        dragStartOffset: null,
      },
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          lastModified: Date.now()
        }
      }
    });
  },

  // Rotate Actions (additive - no impact on existing functionality)
  ENTER_ROTATE_MODE: (maskId) => {
    const { masks } = get();
    const mask = masks[maskId];
    
    if (!mask || mask.isLocked) {
      return; // Don't allow rotating locked masks
    }
    
    console.log('[ENTER_ROTATE_MODE]', { maskId });
    
    set({
      rotateState: {
        isRotateMode: true,
        rotateModeMaskId: maskId,
        isDragging: false,
        dragStartAngle: null,
        dragStartRotation: null,
      }
    });
  },

  EXIT_ROTATE_MODE: () => {
    console.log('[EXIT_ROTATE_MODE]');
    
    set({
      rotateState: {
        isRotateMode: false,
        rotateModeMaskId: null,
        isDragging: false,
        dragStartAngle: null,
        dragStartRotation: null,
      }
    });
  },

  START_ROTATE_DRAG: (maskId, startAngle) => {
    const { masks, rotateState } = get();
    const mask = masks[maskId];
    
    if (!mask || !rotateState.isRotateMode || rotateState.rotateModeMaskId !== maskId) {
      return;
    }
    
    // Get current rotation (default to 0 if not set)
    const currentRotation = mask.rotation || 0;
    
    console.log('[START_ROTATE_DRAG]', { maskId, startAngle, currentRotation });
    
    set({
      rotateState: {
        ...rotateState,
        isDragging: true,
        dragStartAngle: startAngle,
        dragStartRotation: currentRotation,
      }
    });
  },

  UPDATE_ROTATE_DRAG: (maskId, deltaAngle) => {
    const { masks, rotateState } = get();
    const mask = masks[maskId];
    
    if (!mask || !rotateState.isDragging || rotateState.rotateModeMaskId !== maskId) {
      return;
    }
    
    // Calculate new rotation by adding delta to start rotation
    const newRotation = (rotateState.dragStartRotation || 0) + deltaAngle;
    
    console.log('[UPDATE_ROTATE_DRAG]', { maskId, deltaAngle, newRotation });
    
    set({
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          rotation: newRotation,
          lastModified: Date.now()
        }
      }
    });
  },

  END_ROTATE_DRAG: (maskId) => {
    const { masks, rotateState } = get();
    const mask = masks[maskId];
    
    if (!mask || !rotateState.isDragging || rotateState.rotateModeMaskId !== maskId) {
      return;
    }
    
    console.log('[END_ROTATE_DRAG]', { maskId });
    
    set({
      rotateState: {
        ...rotateState,
        isDragging: false,
        dragStartAngle: null,
        dragStartRotation: null,
      },
      masks: {
        ...masks,
        [maskId]: {
          ...mask,
          lastModified: Date.now()
        }
      }
    });
  }
}));

// Helper function to track material usage
function trackMaterialUsage(mask: Mask, maskId: string) {
  try {
    const projectStore = useProjectStore.getState();
    const materialUsageStore = useMaterialUsageStore.getState();
    
    if (!projectStore.project || !projectStore.currentPhoto || !mask.materialId) {
      return; // No project context or material assigned
    }

    // Calculate area in square meters
    const areaInSquareMeters = calculatePolygonArea(mask.pts, 1.0); // Assuming 1 pixel per meter for now
    
    // Get material info (you might need to import this from materials registry)
    const materialName = `Material ${mask.materialId}`; // TODO: Get actual material name
    
    // Calculate cost (you might need to get material price from registry)
    const costPerSquareMeter = 50; // TODO: Get actual material cost
    const totalCost = areaInSquareMeters * costPerSquareMeter;

    const usageData = {
      materialId: mask.materialId,
      materialName,
      projectId: projectStore.project.id,
      projectName: projectStore.project.name,
      photoId: projectStore.currentPhoto.id,
      photoName: projectStore.currentPhoto.name,
      maskId,
      maskName: mask.name || `Mask ${maskId.slice(-8)}`,
      area: areaInSquareMeters,
      cost: totalCost,
    };

    materialUsageStore.addMaterialUsage(usageData);
    
    console.log('[MaterialUsage] Tracked usage:', usageData);
  } catch (error) {
    console.error('[MaterialUsage] Error tracking material usage:', error);
  }
}

// Helper function to generate mask-related notifications
function generateMaskNotification(type: 'mask_created' | 'mask_modified' | 'material_assigned', mask: Mask, maskId: string) {
  try {
    const projectStore = useProjectStore.getState();
    const statusSyncStore = useStatusSyncStore.getState();
    
    if (!projectStore.project || !projectStore.currentPhoto) {
      return; // No project context
    }

    let message = '';
    let severity: 'info' | 'success' | 'warning' | 'error' = 'info';

    switch (type) {
      case 'mask_created':
        message = `New mask "${mask.name}" created in "${projectStore.project.name}"`;
        severity = 'success';
        break;
      case 'mask_modified':
        message = `Mask "${mask.name}" modified in "${projectStore.project.name}"`;
        severity = 'info';
        break;
      case 'material_assigned':
        message = `Material assigned to mask "${mask.name}" in "${projectStore.project.name}"`;
        severity = 'success';
        break;
    }

    statusSyncStore.addNotification({
      type,
      projectId: projectStore.project.id,
      photoId: projectStore.currentPhoto.id,
      maskId,
      message,
      severity,
      data: {
        maskName: mask.name,
        projectName: projectStore.project.name,
        photoName: projectStore.currentPhoto.name,
      },
    });

    console.log('[MaskNotification] Generated notification:', { type, maskId, message });
  } catch (error) {
    console.error('[MaskNotification] Error generating notification:', error);
  }
}
