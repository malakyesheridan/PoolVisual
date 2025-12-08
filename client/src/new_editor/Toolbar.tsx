import React, { useRef, useEffect, useState } from 'react';
import { useEditorStore, getDefaultUnderwaterRealismSettings } from './store';
import { calculateFitScale, calculateCenterPan, getMaskPointCoords } from './utils';
import { materialLibraryAdapter } from './materialLibraryAdapter';
import { PV_UNDERWATER_V15, PV_UNDERWATER_V16_POLISH } from './featureFlags';
import { 
  processPhotoUpload, 
  validatePhotoFile, 
  handlePasteEvent, 
  handleDropEvent, 
  handleDragOverEvent 
} from './photoUpload';
import { Upload, Maximize2, MousePointer, Square, ZoomIn, ZoomOut, Ruler, Key, FileText, ChevronDown, Save, ArrowLeft, Loader2, Sparkles, CheckCircle2, AlertCircle, Receipt } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PV_PRECISE_MASKS } from './featureFlags';
import { CalibrationTool } from './CalibrationTool';
import { KeyLegend } from './KeyLegend';
import { JobSelector } from './JobSelector';
import { PhotoSelectionModal } from './PhotoSelectionModal';
import { JobsDrawer } from '../components/enhancement/JobsDrawer';
import { QuoteSelectionModal } from '../components/quotes/QuoteSelectionModal';
import { useMaskStore } from '../maskcore/store';
import { useProjectStore } from '../stores/projectStore';
import { useUnifiedTemplateStore } from '../stores/unifiedTemplateStore';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { apiClient } from '../lib/api-client';
import { useJobsRoute, useJobDetailRoute } from '../lib/route-utils';
import { useIsRealEstate } from '../hooks/useIsRealEstate';
import { useQuery } from '@tanstack/react-query';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '../components/ui/dropdown-menu';
import { Button } from '../components/ui/button';
import { 
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '../components/ui/tooltip';
import { SaveStateIndicator, SaveState } from '../components/common/SaveStateIndicator';

interface ToolbarProps {
  jobId?: string;
  photoId?: string;
}

export function Toolbar({ jobId, photoId }: ToolbarProps = {}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCalibrationTool, setShowCalibrationTool] = useState(false);
  const [showKeyLegend, setShowKeyLegend] = useState(false);
  const isRealEstate = useIsRealEstate();
  const jobsRoute = useJobsRoute();
  const [showEnhancementDrawer, setShowEnhancementDrawer] = useState(false);
  const [lastSavedMaskState, setLastSavedMaskState] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(jobId);
  const [isSavingToJob, setIsSavingToJob] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPhotoSelection, setShowPhotoSelection] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [, navigate] = useLocation();
  
  // Handle ESC key to close legend
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showKeyLegend) {
        setShowKeyLegend(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showKeyLegend]);
  
  // Listen for keyboard shortcut events from NewEditor
  // Note: This effect must be after handleZoomIn, handleZoomOut, and handleSaveToJob are defined
  // So we'll move it later in the component
  
  const {
    photoSpace,
    containerSize,
    activeTool,
    state,
    zoomLabel,
    snappingEnabled,
    calibration,
    measurements,
    drawingMode,
    dispatch,
    getState,
    activeVariantId
  } = useEditorStore();
  
  // Check if viewing a variant (not the original image)
  // Only hide tools when viewing an enhanced variant, not when viewing the original
  const isViewingVariant = activeVariantId !== null && activeVariantId !== 'original';
  const { addTemplate } = useUnifiedTemplateStore();

  // Get job context from store if not provided as props - REACTIVE
  const jobContext = useEditorStore(state => state.jobContext);
  const effectiveJobId = jobId || jobContext?.jobId;
  const effectivePhotoId = photoId || jobContext?.photoId;
  
  // Fetch job to get orgId for quote modal
  const { data: job } = useQuery({
    queryKey: ['/api/jobs', effectiveJobId],
    queryFn: () => effectiveJobId ? apiClient.getJob(effectiveJobId) : Promise.resolve(null),
    enabled: !!effectiveJobId,
  });
  
  // Update selectedJobId when effectiveJobId changes
  useEffect(() => {
    if (effectiveJobId) {
      setSelectedJobId(effectiveJobId);
    }
  }, [effectiveJobId]);

  // Track unsaved changes - use mask store, not editor store
  const maskStore = useMaskStore();
  const currentMasks = Object.values(maskStore.masks);
  
  // Create stable comparison by sorting masks by ID and removing transient properties
  const normalizeMaskState = (masks: any[]) => {
    return JSON.stringify(
      masks
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(m => ({
          id: m.id,
          pts: m.pts,
          materialId: m.materialId,
          materialSettings: m.materialSettings
        }))
    );
  };
  
  const currentMaskState = normalizeMaskState(currentMasks);
  const hasUnsavedChanges = currentMaskState !== lastSavedMaskState;

  // Listen for masks loaded event to update saved state
  useEffect(() => {
    const handleMasksLoaded = (event: CustomEvent<{ photoId: string; maskCount: number }>) => {
      if (event.detail?.photoId === effectivePhotoId) {
        // Get current mask state after they've been loaded
        setTimeout(() => {
          const maskStore = useMaskStore.getState();
          const currentMasks = Object.values(maskStore.masks);
          
          // Normalize mask state for comparison
          const normalizeMaskState = (masks: any[]) => {
            return JSON.stringify(
              masks
                .sort((a, b) => a.id.localeCompare(b.id))
                .map(m => ({
                  id: m.id,
                  pts: m.pts,
                  materialId: m.materialId,
                  materialSettings: m.materialSettings
                }))
            );
          };
          
          const maskStateString = normalizeMaskState(currentMasks);
          console.log('[Toolbar] Masks loaded event received, updating saved state:', event.detail, 'mask state length:', maskStateString.length);
          setLastSavedMaskState(maskStateString);
        }, 100); // Small delay to ensure masks are fully loaded
      }
    };
    
    window.addEventListener('masksLoaded', handleMasksLoaded as EventListener);
    return () => {
      window.removeEventListener('masksLoaded', handleMasksLoaded as EventListener);
    };
  }, [effectivePhotoId]);

  // Update zoom label when photoSpace scale changes
  // Calculate percentage relative to fitScale (baseline for 100% zoom)
  useEffect(() => {
    let percentage: number;
    if (photoSpace.fitScale && photoSpace.fitScale > 0) {
      // Calculate relative to fitScale: if scale === fitScale, that's 100%
      percentage = Math.round((photoSpace.scale / photoSpace.fitScale) * 100);
    } else {
      // Fallback for backward compatibility: use absolute scale
      percentage = Math.round(photoSpace.scale * 100);
    }
    dispatch({
      type: 'SET_ZOOM_LABEL',
      payload: `${percentage}%`
    });
  }, [photoSpace.scale, photoSpace.fitScale, dispatch]);

  // Handle paste events
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = handlePasteEvent(event);
      if (file) {
        handleFileUpload(file);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Handle drag and drop
  useEffect(() => {
    const handleDrop = (event: DragEvent) => {
      try {
        const file = handleDropEvent(event);
        if (file) {
          handleFileUpload(file);
        }
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Invalid file');
      }
    };

    const handleDragOver = (event: DragEvent) => {
      handleDragOverEvent(event);
    };

    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragover', handleDragOver);
    
    return () => {
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('dragover', handleDragOver);
    };
  }, []);

  // Browser warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && jobId) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, jobId]);

  const handleFileUpload = async (file: File) => {
    // Validate file
    const validation = validatePhotoFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    try {
      dispatch({ type: 'SET_STATE', payload: 'loading' });
      
      // Process photo with EXIF orientation and downscaling
      const result = await processPhotoUpload(file, {
        maxDimension: 5120,
        quality: 0.9,
        onProgress: (progress) => {
          // Could show progress indicator here
          console.log(`Upload progress: ${progress}%`);
        }
      });
      
      // Calculate fit scale and center pan
      const fitScale = calculateFitScale(
        result.width,
        result.height,
        containerSize.width,
        containerSize.height
      );
      
      // Snap to 100% if close (within 5%)
      const finalScale = Math.abs(fitScale - 1.0) <= 0.05 ? 1.0 : fitScale;
      
      const { panX, panY } = calculateCenterPan(
        result.width,
        result.height,
        containerSize.width,
        containerSize.height,
        finalScale
      );
      
      // Update PhotoSpace
      dispatch({
        type: 'SET_PHOTO_SPACE',
        payload: { 
          scale: finalScale, 
          panX, 
          panY,
          imgW: result.width,
          imgH: result.height
        }
      });
      
      // CRITICAL FIX: Clear masks when uploading a new photo
      // This prevents masks from previous photos from appearing on new uploads
      const { useMaskStore } = await import('../maskcore/store');
      useMaskStore.setState({ masks: {}, selectedId: null, draft: null });
      console.log('[Toolbar] Cleared masks for new photo upload');
      
      // Set image URL
      dispatch({
        type: 'SET_IMAGE',
        payload: {
          url: result.url,
          width: result.width,
          height: result.height
        }
      });
      
      // Take snapshot
      dispatch({ type: 'SNAPSHOT' });
      
    } catch (error) {
      console.error('Photo upload failed:', error);
      dispatch({ type: 'SET_STATE', payload: 'error' });
      alert(`Failed to upload photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Clear input
    event.target.value = '';
  };

  const handleFit = () => {
    if (photoSpace.imgW <= 0 || photoSpace.imgH <= 0) return;
    if (containerSize.width <= 0 || containerSize.height <= 0) return;
    
    // Calculate scale to fit entire image in container (no padding - exact fit)
    // This matches the initial load behavior and is the "100% zoom" baseline
    const fitScale = calculateFitScale(
      photoSpace.imgW,
      photoSpace.imgH,
      containerSize.width,
      containerSize.height,
      1.0 // No padding - image should fit exactly
    );
    
    const { panX, panY } = calculateCenterPan(
      photoSpace.imgW,
      photoSpace.imgH,
      containerSize.width,
      containerSize.height,
      fitScale
    );
    
    dispatch({
      type: 'SET_PHOTO_SPACE',
      payload: { scale: fitScale, panX, panY, fitScale: fitScale } // Update fitScale when fitting
    });
  };

  const handleZoomIn = () => {
    // Calculate current relative percentage (based on fitScale for 100% baseline)
    const fitScale = photoSpace.fitScale || 1;
    const currentPercentage = Math.round((photoSpace.scale / fitScale) * 100);
    let nextPercentage = Math.min(500, currentPercentage + 10); // Max 500%
    
    // Snap to 100% if we're close (within 5%)
    if (Math.abs(nextPercentage - 100) <= 5) {
      nextPercentage = 100;
    }
    
    // Convert relative percentage back to absolute scale
    const newScale = (nextPercentage / 100) * fitScale;
    
    // Center zoom on the middle of the canvas
    const centerX = containerSize.width / 2;
    const centerY = containerSize.height / 2;
    
    // Calculate image coordinates at center
    const imageX = (centerX - photoSpace.panX) / photoSpace.scale;
    const imageY = (centerY - photoSpace.panY) / photoSpace.scale;
    
    // Calculate new pan to keep center point in place
    const newPanX = centerX - imageX * newScale;
    const newPanY = centerY - imageY * newScale;
    
    dispatch({
      type: 'SET_PHOTO_SPACE',
      payload: { scale: newScale, panX: newPanX, panY: newPanY }
    });
  };

  const handleZoomOut = () => {
    // Calculate current relative percentage (based on fitScale for 100% baseline)
    const fitScale = photoSpace.fitScale || 1;
    const currentPercentage = Math.round((photoSpace.scale / fitScale) * 100);
    let nextPercentage = Math.max(10, currentPercentage - 10); // Min 10%
    
    // Snap to 100% if we're close (within 5%)
    if (Math.abs(nextPercentage - 100) <= 5) {
      nextPercentage = 100;
    }
    
    // Convert relative percentage back to absolute scale
    const newScale = (nextPercentage / 100) * fitScale;
    
    // Center zoom on the middle of the canvas
    const centerX = containerSize.width / 2;
    const centerY = containerSize.height / 2;
    
    // Calculate image coordinates at center
    const imageX = (centerX - photoSpace.panX) / photoSpace.scale;
    const imageY = (centerY - photoSpace.panY) / photoSpace.scale;
    
    // Calculate new pan to keep center point in place
    const newPanX = centerX - imageX * newScale;
    const newPanY = centerY - imageY * newScale;
    
    dispatch({
      type: 'SET_PHOTO_SPACE',
      payload: { scale: newScale, panX: newPanX, panY: newPanY }
    });
  };

  const handleUndo = () => {
    dispatch({ type: 'UNDO' });
  };

  const handleRedo = () => {
    dispatch({ type: 'REDO' });
  };

  const canUndo = () => {
    const currentState = getState();
    return currentState.historyIndex > 0;
  };

  const canRedo = () => {
    const currentState = getState();
    return currentState.historyIndex < currentState.history.length - 1;
  };

  const handleToggleMeasurements = () => {
    dispatch({
      type: 'SET_MEASUREMENT_SETTINGS',
      payload: { showMeasurements: !measurements.showMeasurements }
    });
  };

  const handleToggleCosts = () => {
    dispatch({
      type: 'SET_MEASUREMENT_SETTINGS',
      payload: { showCosts: !measurements.showCosts }
    });
  };

  const handleExport = () => {
    // Create a temporary canvas to render the composite
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // Set canvas size to image size
    canvas.width = photoSpace.imgW;
    canvas.height = photoSpace.imgH;
    
    // Draw background image
    const img = new Image();
    // Set CORS to allow canvas export
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      ctx.drawImage(img, 0, 0);
      
      // Draw masks with materials
      const state = getState();
      for (const mask of state.masks) {
        if (mask.points.length < 3) continue;
        
        ctx.beginPath();
        ctx.moveTo(getMaskPointCoords(mask.points[0]).x, getMaskPointCoords(mask.points[0]).y);
        for (let i = 1; i < mask.points.length; i++) {
          ctx.lineTo(getMaskPointCoords(mask.points[i]).x, getMaskPointCoords(mask.points[i]).y);
        }
        ctx.closePath();
        
        // Draw mask fill if material is applied
        if (mask.material) {
          try {
            const tileScale = mask.material.tileScale ?? 1.0;
            
            // Get underwater settings for cache key (same as Canvas.tsx)
            const material = materialLibraryAdapter.getMaterialById(mask.material.id);
            const settings = mask.underwaterRealism || getDefaultUnderwaterRealismSettings(material?.category);
            
            const pattern = await materialLibraryAdapter.getPattern(mask.material.id, tileScale, {
              enabled: settings.enabled,
              blend: settings.blend,
              edgeSoftness: settings.edgeSoftness,
              depthBias: settings.depthBias,
              tint: settings.tint,
              edgeFeather: settings.edgeFeather,
              highlights: settings.highlights,
              ripple: settings.ripple,
              materialOpacity: settings.materialOpacity,
              contactOcclusion: settings.contactOcclusion,
              textureBoost: settings.textureBoost
            });
            
            if (pattern) {
              ctx.fillStyle = pattern;
              ctx.fill();
              
              // Apply underwater effect (same as Canvas.tsx)
              if (settings.enabled && settings.blend > 0) {
                if (PV_UNDERWATER_V16_POLISH) {
                  // v1.6: Polish pipeline with auto-calibrated defaults and enhanced realism
                  const intensity = settings.blend / 100;
                  
                  // Step 1: Material opacity (simple realism knob)
                  if (settings.materialOpacity < 100) {
                    ctx.globalAlpha = settings.materialOpacity / 100;
                    ctx.fillStyle = pattern;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                  }
                  
                  // Step 2: Contact occlusion (edge seating) - subtle inner darkening gradient
                  if (settings.contactOcclusion > 0) {
                    ctx.globalCompositeOperation = 'multiply';
                    
                    // DPR-aware contact occlusion size
                    const contactSize = Math.min(10, settings.contactOcclusion / 10) * photoSpace.dpr;
                    const contactStrength = settings.contactOcclusion / 100;
                    
                    // Create inner darkening gradient
                    const gradient = ctx.createRadialGradient(
                      photoSpace.imgW / 2,
                      photoSpace.imgH / 2,
                      0,
                      photoSpace.imgW / 2,
                      photoSpace.imgH / 2,
                      Math.max(photoSpace.imgW, photoSpace.imgH) / 2
                    );
                    
                    gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
                    gradient.addColorStop(0.7, `rgba(255, 255, 255, 0)`);
                    gradient.addColorStop(1, `rgba(0, 0, 0, ${contactStrength * 0.12})`);
                    
                    ctx.fillStyle = gradient;
                    ctx.fill();
                  }
                  
                  // Step 3: Photometric blend - Multiply texture over photo with alpha control
                  ctx.globalCompositeOperation = 'multiply';
                  ctx.globalAlpha = intensity;
                  
                  // Draw the pattern again with multiply blend
                  ctx.fillStyle = pattern;
                  ctx.fill();
                  
                  // Reset alpha
                  ctx.globalAlpha = 1;
                  
                  // Step 4: Aqua tint & attenuation (gentle cyan/teal tint) - clamped range
                  if (settings.tint > 0) {
                    ctx.globalCompositeOperation = 'multiply';
                    const tintIntensity = Math.min(40, settings.tint) / 100; // Clamp to 0-40%
                    
                    // Gentle cyan/teal tint
                    ctx.fillStyle = `rgba(${Math.floor(255 * 0.85)}, ${Math.floor(255 * 0.95)}, ${Math.floor(255 * 1.05)}, ${tintIntensity})`;
                    ctx.fill();
                  }
                  
                  // Step 5: Edge seating (inner feather) - soft inner shadow
                  if (settings.edgeFeather > 0) {
                    ctx.globalCompositeOperation = 'multiply';
                    
                    // DPR-aware feather size
                    const featherSize = settings.edgeFeather * photoSpace.dpr;
                    const featherSteps = 3;
                    
                    for (let i = 0; i < featherSteps; i++) {
                      const featherOffset = (featherSize * (i + 1)) / featherSteps;
                      const shadowOpacity = (intensity * 0.06 * (featherSteps - i)) / featherSteps;
                      
                      ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
                      
                      ctx.beginPath();
                      ctx.moveTo(mask.points[0].x + featherOffset, mask.points[0].y + featherOffset);
                      for (let j = 1; j < mask.points.length; j++) {
                        ctx.lineTo(getMaskPointCoords(mask.points[j]).x + featherOffset, getMaskPointCoords(mask.points[j]).y + featherOffset);
                      }
                      ctx.closePath();
                      ctx.fill();
                    }
                  }
                  
                  // Step 6: Highlight restoration (cap & anti-halo)
                  if (settings.highlights > 0) {
                    try {
                      // Sample background luminance for highlights
                      const imageData = ctx.getImageData(0, 0, photoSpace.imgW, photoSpace.imgH);
                      const data = imageData.data;
                      
                      // Detect bright, high-frequency components
                      let hasHighlights = false;
                      for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const luminance = (r * 0.299 + g * 0.587 + b * 0.114);
                        
                        if (luminance > 200) { // Very bright pixels (specular highlights)
                          hasHighlights = true;
                          break;
                        }
                      }
                      
                      if (hasHighlights) {
                        // Blend back highlights with screen mode, capped to avoid halos
                        ctx.globalCompositeOperation = 'screen';
                        const highlightIntensity = Math.min(40, settings.highlights) / 100; // Clamp to 0-40%
                        const cappedIntensity = Math.min(highlightIntensity * 0.3, 0.25); // Cap to ≤1.25× gain
                        ctx.fillStyle = `rgba(255, 255, 255, ${cappedIntensity})`;
                        ctx.fill();
                      }
                    } catch (error) {
                      // Fallback if sampling fails
                      console.warn('Highlight sampling failed:', error);
                    }
                  }
                  
                  // Step 7: (Optional) Ripple stability - low-freq, sub-pixel amplitude
                  if (settings.ripple > 0) {
                    // Simple sinusoidal ripple effect with fixed seed for stability
                    const rippleIntensity = Math.min(10, settings.ripple) / 100; // Clamp to 0-10%
                    const rippleScale = Math.min(1.0 * photoSpace.dpr, 1.0); // Max 1px at 1x
                    
                    ctx.globalCompositeOperation = 'multiply';
                    
                    // Create a subtle ripple pattern with fixed seed
                    const gradient = ctx.createRadialGradient(
                      photoSpace.imgW / 2,
                      photoSpace.imgH / 2,
                      0,
                      photoSpace.imgW / 2,
                      photoSpace.imgH / 2,
                      Math.max(photoSpace.imgW, photoSpace.imgH) / 2
                    );
                    
                    gradient.addColorStop(0, `rgba(255, 255, 255, ${rippleIntensity * 0.1})`);
                    gradient.addColorStop(0.5, `rgba(255, 255, 255, ${rippleIntensity * 0.05})`);
                    gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
                    
                    ctx.fillStyle = gradient;
                    ctx.fill();
                  }
                  
                  // Reset composite operation
                  ctx.globalCompositeOperation = 'source-over';
                } else if (PV_UNDERWATER_V15) {
                  // v1.5: Photometric blend pipeline
                  const intensity = settings.blend / 100;
                  
                  // Step 1: Photometric blend - Multiply texture over photo with alpha control
                  ctx.globalCompositeOperation = 'multiply';
                  ctx.globalAlpha = intensity;
                  
                  // Draw the pattern again with multiply blend
                  ctx.fillStyle = pattern;
                  ctx.fill();
                  
                  // Reset alpha
                  ctx.globalAlpha = 1;
                  
                  // Step 2: Aqua tint & attenuation (gentle cyan/teal tint)
                  if (settings.tint > 0) {
                    ctx.globalCompositeOperation = 'multiply';
                    const tintIntensity = settings.tint / 100;
                    
                    // Gentle cyan/teal tint
                    ctx.fillStyle = `rgba(${Math.floor(255 * 0.85)}, ${Math.floor(255 * 0.95)}, ${Math.floor(255 * 1.05)}, ${tintIntensity})`;
                    ctx.fill();
                  }
                  
                  // Step 3: Edge seating (inner feather) - soft inner shadow
                  if (settings.edgeFeather > 0) {
                    ctx.globalCompositeOperation = 'multiply';
                    
                    // DPR-aware feather size
                    const featherSize = settings.edgeFeather * photoSpace.dpr;
                    const featherSteps = 3;
                    
                    for (let i = 0; i < featherSteps; i++) {
                      const featherOffset = (featherSize * (i + 1)) / featherSteps;
                      const shadowOpacity = (intensity * 0.06 * (featherSteps - i)) / featherSteps;
                      
                      ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
                      
                      ctx.beginPath();
                      ctx.moveTo(mask.points[0].x + featherOffset, mask.points[0].y + featherOffset);
                      for (let j = 1; j < mask.points.length; j++) {
                        ctx.lineTo(getMaskPointCoords(mask.points[j]).x + featherOffset, getMaskPointCoords(mask.points[j]).y + featherOffset);
                      }
                      ctx.closePath();
                      ctx.fill();
                    }
                  }
                  
                  // Step 4: Highlight preservation - bring back high-frequency specular highlights
                  if (settings.highlights > 0) {
                    try {
                      // Sample background luminance for highlights
                      const imageData = ctx.getImageData(0, 0, photoSpace.imgW, photoSpace.imgH);
                      const data = imageData.data;
                      
                      // Detect bright, high-frequency components
                      let hasHighlights = false;
                      for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const luminance = (r * 0.299 + g * 0.587 + b * 0.114);
                        
                        if (luminance > 200) { // Very bright pixels (specular highlights)
                          hasHighlights = true;
                          break;
                        }
                      }
                      
                      if (hasHighlights) {
                        // Blend back highlights with screen mode
                        ctx.globalCompositeOperation = 'screen';
                        const highlightIntensity = settings.highlights / 100;
                        ctx.fillStyle = `rgba(255, 255, 255, ${highlightIntensity * 0.3})`;
                        ctx.fill();
                      }
                    } catch (error) {
                      // Fallback if sampling fails
                      console.warn('Highlight sampling failed:', error);
                    }
                  }
                  
                  // Step 5: (Optional) Micro-refraction - sub-pixel ripple displacement
                  if (settings.ripple > 0) {
                    // Simple sinusoidal ripple effect
                    const rippleIntensity = settings.ripple / 100;
                    const rippleScale = Math.min(1.5 * photoSpace.dpr, 1.5); // Max 1.5px at 1x
                    
                    ctx.globalCompositeOperation = 'multiply';
                    
                    // Create a subtle ripple pattern
                    const gradient = ctx.createRadialGradient(
                      photoSpace.imgW / 2,
                      photoSpace.imgH / 2,
                      0,
                      photoSpace.imgW / 2,
                      photoSpace.imgH / 2,
                      Math.max(photoSpace.imgW, photoSpace.imgH) / 2
                    );
                    
                    gradient.addColorStop(0, `rgba(255, 255, 255, ${rippleIntensity * 0.1})`);
                    gradient.addColorStop(0.5, `rgba(255, 255, 255, ${rippleIntensity * 0.05})`);
                    gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
                    
                    ctx.fillStyle = gradient;
                    ctx.fill();
                  }
                  
                  // Reset composite operation
                  ctx.globalCompositeOperation = 'source-over';
                } else {
                  // v1.0: Original underwater effect (fallback)
                  const intensity = settings.blend / 100;
                  
                  // Step 1: Inner feather and contact shadow (edge integration)
                  if (settings.edgeSoftness > 0) {
                    const featherSteps = 4;
                    const maxFeather = Math.min(settings.edgeSoftness, 8);
                    
                    for (let i = 0; i < featherSteps; i++) {
                      const featherOffset = (maxFeather * (i + 1)) / featherSteps;
                      const shadowOpacity = (intensity * 0.08 * (featherSteps - i)) / featherSteps;
                      
                      ctx.globalCompositeOperation = 'multiply';
                      ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
                      
                      ctx.beginPath();
                      ctx.moveTo(mask.points[0].x + featherOffset, mask.points[0].y + featherOffset);
                      for (let j = 1; j < mask.points.length; j++) {
                        ctx.lineTo(getMaskPointCoords(mask.points[j]).x + featherOffset, getMaskPointCoords(mask.points[j]).y + featherOffset);
                      }
                      ctx.closePath();
                      ctx.fill();
                    }
                  }
                  
                  // Step 2: Better underwater color math
                  ctx.globalCompositeOperation = 'multiply';
                  const underwaterTint = {
                    r: 0.65, // Reduce red significantly
                    g: 0.90, // Slight green boost
                    b: 1.15, // Blue boost
                    brightness: 0.80 // Overall dimming
                  };
                  
                  ctx.fillStyle = `rgba(${Math.floor(255 * underwaterTint.r)}, ${Math.floor(255 * underwaterTint.g)}, ${Math.floor(255 * underwaterTint.b)}, ${intensity})`;
                  ctx.fill();
                  
                  // Step 3: Saturation reduction
                  ctx.globalCompositeOperation = 'multiply';
                  ctx.fillStyle = `rgba(${Math.floor(255 * 0.85)}, ${Math.floor(255 * 0.85)}, ${Math.floor(255 * 0.85)}, ${intensity * 0.3})`;
                  ctx.fill();
                  
                  // Step 4: Depth falloff gradient
                  if (settings.depthBias > 0) {
                    ctx.globalCompositeOperation = 'multiply';
                    
                    const gradient = ctx.createLinearGradient(0, 0, 0, photoSpace.imgH);
                    const depthIntensity = settings.depthBias / 100;
                    gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
                    gradient.addColorStop(1, `rgba(${Math.floor(255 * 0.85)}, ${Math.floor(255 * 0.95)}, ${Math.floor(255 * 0.90)}, ${depthIntensity * intensity})`);
                    
                    ctx.fillStyle = gradient;
                    ctx.fill();
                  }
                  
                  // Reset composite operation
                  ctx.globalCompositeOperation = 'source-over';
                }
              }
            } else {
              // Fallback to neutral fill
              ctx.fillStyle = '#e5e7eb';
              ctx.fill();
            }
          } catch (error) {
            console.warn(`Failed to load material ${mask.material.id} for export:`, error);
            ctx.fillStyle = '#e5e7eb';
            ctx.fill();
          }
        }
      }
      
      // Use ExportService for export with options
      import('../services/export/exportService').then(({ ExportService }) => {
        const exportService = new ExportService();
        exportService.exportCanvas(canvas, {
          format: 'png',
          scale: 1,
          transparentBackground: false,
          watermark: {
            enabled: true,
            text: 'EasyFlow',
            position: 'bottom-right',
            opacity: 0.3
          }
        }).then((result) => {
          // Download the exported file
          const a = document.createElement('a');
          a.href = result.url;
          a.download = `pool-visualization-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(result.url);
          toast.success('Export completed', { description: `Exported ${(result.size / 1024 / 1024).toFixed(2)}MB PNG` });
        }).catch((error) => {
          console.error('[Toolbar] Export failed:', error);
          toast.error('Export failed', { description: error.message });
        });
      }).catch((error) => {
        console.error('[Toolbar] Failed to load ExportService:', error);
        // Fallback to original export
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'pool-visualization.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        }, 'image/png');
      });
    };
    
    // Load image from current state
    const currentState = getState();
    if (currentState.imageUrl) {
      img.src = currentState.imageUrl;
    }
  };

  const handleBackToJob = () => {
    if (hasUnsavedChanges && jobId) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?'
      );
      if (!confirmed) return;
    }
    
    const route = isRealEstate ? `/properties/${jobId}` : `/jobs/${jobId}`;
    navigate(route);
  };

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
    // Open photo selection modal when a job is selected
    setShowPhotoSelection(true);
  };

  const handlePhotoSelect = async (photoId: string) => {
    try {
      dispatch({ type: 'SET_STATE', payload: 'loading' });
      
      // Load the photo data
      const photo = await apiClient.getPhoto(photoId);
      if (!photo || !photo.originalUrl) {
        toast.error('Photo not found');
        dispatch({ type: 'SET_STATE', payload: 'error' });
        return;
      }

      // Convert local paths to proxy URLs for old photos (same as NewEditor does)
      let imageUrl = photo.originalUrl;
      if (imageUrl.startsWith('/uploads/')) {
        // Old photos with local paths - use proxy endpoint
        imageUrl = `/api/photos/${photoId}/image`;
        console.log('[Toolbar] Converting local path to proxy URL:', imageUrl);
      }

      // Clear existing masks when loading a new photo (same as handleFileUpload)
      const { useMaskStore } = await import('../maskcore/store');
      useMaskStore.setState({ masks: {}, selectedId: null, draft: null });
      console.log('[Toolbar] Cleared masks for new photo load');

      // Helper to check if URL is external (for CORS handling)
      const isExternalUrl = (url: string): boolean => {
        try {
          const urlObj = new URL(url, window.location.origin);
          const currentOrigin = window.location.origin;
          return urlObj.origin !== currentOrigin;
        } catch {
          return false;
        }
      };

      // Use proxy for external URLs to avoid CORS errors (same as exportCanvasToBlob)
      const urlToLoad = isExternalUrl(imageUrl)
        ? `/api/texture?url=${encodeURIComponent(imageUrl)}`
        : imageUrl;

      // Load image to get natural dimensions
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          // Use database dimensions as source of truth (same as NewEditor does)
          const dbWidth = photo.width || img.naturalWidth;
          const dbHeight = photo.height || img.naturalHeight;
          
          // Calculate fit scale and center pan (same as handleFileUpload)
          const fitScale = calculateFitScale(
            dbWidth,
            dbHeight,
            containerSize.width,
            containerSize.height
          );

          // Snap to 100% if close (within 5%)
          const finalScale = Math.abs(fitScale - 1.0) <= 0.05 ? 1.0 : fitScale;

          const { panX, panY } = calculateCenterPan(
            dbWidth,
            dbHeight,
            containerSize.width,
            containerSize.height,
            finalScale
          );

          // Update PhotoSpace first
          dispatch({
            type: 'SET_PHOTO_SPACE',
            payload: { 
              scale: finalScale, 
              panX, 
              panY,
              imgW: dbWidth,
              imgH: dbHeight
            }
          });

          // Update the editor store with the photo (same pattern as handleFileUpload)
          dispatch({
            type: 'SET_IMAGE',
            payload: {
              url: imageUrl,
              width: dbWidth,
              height: dbHeight,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight
            }
          });

          // Set job context
          dispatch({
            type: 'SET_JOB_CONTEXT',
            payload: {
              jobId: selectedJobId!,
              photoId: photoId
            }
          });

          // Take snapshot
          dispatch({ type: 'SNAPSHOT' });

          resolve();
        };
        img.onerror = () => {
          console.error('[Toolbar] Failed to load image from photo URL:', imageUrl);
          reject(new Error('Failed to load image'));
        };
        img.src = urlToLoad;
      });

      toast.success('Photo loaded successfully');
    } catch (error: any) {
      console.error('Failed to load photo:', error);
      dispatch({ type: 'SET_STATE', payload: 'error' });
      toast.error(error.message || 'Failed to load photo');
    }
  };

  const exportCanvasToBlob = async (onlyExportMaskIds?: Set<string>): Promise<File> => {
    return new Promise((resolve, reject) => {
      // Create a temporary canvas to render the composite
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Set canvas size to image size
      canvas.width = photoSpace.imgW;
      canvas.height = photoSpace.imgH;
      
      // Get current image URL from store
      const currentState = useEditorStore.getState();
      const imageUrl = currentState.imageUrl;
      
      if (!imageUrl) {
        reject(new Error('No image URL available'));
        return;
      }
      
      // Check if URL is external and use proxy preemptively to avoid CORS
      const isExternalUrl = (url: string): boolean => {
        try {
          const urlObj = new URL(url);
          const currentOrigin = window.location.origin;
          return urlObj.origin !== currentOrigin;
        } catch {
          return false;
        }
      };
      
      // Use proxy for external URLs to avoid CORS errors
      const urlToLoad = isExternalUrl(imageUrl)
        ? `/api/texture?url=${encodeURIComponent(imageUrl)}`
        : imageUrl;
      
      // Draw background image
      const img = new Image();
      // Set CORS to allow canvas export
      img.crossOrigin = "anonymous";
      img.onerror = () => {
        reject(new Error(`Failed to load image (CORS may be blocked): ${imageUrl}`));
      };
      img.onload = async () => {
        try {
          ctx.drawImage(img, 0, 0);
          
          // CRITICAL FIX: Don't export masks into the image - they are saved to database and render as interactive overlays
          // Exporting masks into the image causes duplicates:
          // 1. Baked-in mask in the image (pixels, unselectable)
          // 2. Konva overlay mask from store (interactive, selectable)
          // = Visual duplicate
          // 
          // Masks should ONLY be:
          // - Saved to database (for persistence)
          // - Rendered as Konva overlays (for interactivity)
          // - NOT baked into exported images
          
          if (onlyExportMaskIds && onlyExportMaskIds.size > 0) {
            console.log('[exportCanvasToBlob] Skipping mask export - masks remain as interactive overlays only');
          }
          
          // Convert to blob and create File
          // Use JPEG with quality 0.85 to reduce file size for uploads
          canvas.toBlob((blob) => {
            if (blob) {
              const file = new File([blob], 'edited-photo.jpg', { type: 'image/jpeg' });
              console.log('[exportCanvasToBlob] Successfully created blob:', blob.size, 'bytes');
              resolve(file);
            } else {
              reject(new Error('Failed to create blob'));
            }
          }, 'image/jpeg', 0.85); // JPEG at 85% quality for smaller file size
          
        } catch (error) {
          console.error('[exportCanvasToBlob] Error during export:', error);
          reject(error);
        }
      };
      
      // Load image using the URL we prepared earlier (with proxy if needed)
      img.src = urlToLoad;
    });
  };

  const handleSaveToJob = async () => {
    if (!selectedJobId) return;
    
    setIsSavingToJob(true);
    try {
      // CRITICAL FIX: Save masks to database FIRST, then export only saved masks
      // This ensures masks are persisted and can be reloaded, preventing "baked-in" unselectable masks
      
      // 1. Save masks to database BEFORE exporting
      const state = getState();
      const targetPhotoId = effectivePhotoId; // Always use original photo ID when editing
      
      // Get masks from the correct store (mask core store, not editor store)
      const maskStore = useMaskStore.getState();
      const masks = Object.values(maskStore.masks);
      
      console.log('[SaveToJob] Saving', masks.length, 'masks to database first');
      
      // Only fetch org member if we have masks to save
      let orgMember: { id: string } | null = null;
      
      if (masks.length > 0) {
        // Get user's org membership for createdBy field
        const { useAuthStore } = await import('../stores/auth-store');
        const authUser = useAuthStore.getState().user;
        
        if (!authUser) {
          toast.error('Authentication missing');
          return;
        }

        // Get the job to find its organization
        const job = await apiClient.getJob(selectedJobId);
        if (!job) {
          toast.error('Job not found');
          return;
        }
        
        // Get the user's organization membership for this specific job's org
        // If membership doesn't exist, automatically create it
        try {
          orgMember = await apiClient.getOrgMember(authUser.id, job.orgId);
          if (!orgMember) {
            console.log('[SaveToJob] User not a member of organization, automatically joining...');
            // Automatically join the organization with "estimator" role
            // Note: joinOrg checks for existing membership, so it's safe to call
            const existingMembership = await apiClient.joinOrg(job.orgId, 'estimator');
            orgMember = existingMembership;
            
            // Only show toast if this is a NEW membership (check if it was just created)
            // The server returns existing membership if it exists, so we can't tell easily
            // Instead, we'll only show toast on first 404, not on subsequent saves
            const membershipKey = `org_member_${job.orgId}_${authUser.id}`;
            const wasJustCreated = !localStorage.getItem(membershipKey);
            if (wasJustCreated) {
              localStorage.setItem(membershipKey, 'true');
              toast.success('You have been automatically added to this organization');
            }
            console.log('[SaveToJob] Organization membership obtained:', orgMember);
          }
        } catch (error) {
          console.error('[SaveToJob] Error with org membership:', error);
          // If it's a 404, try to join
          if ((error as any)?.status === 404 || (error as any)?.statusCode === 404) {
            try {
              console.log('[SaveToJob] Attempting to join organization...');
              const newMembership = await apiClient.joinOrg(job.orgId, 'estimator');
              orgMember = newMembership;
              
              // Only show toast if this is actually a new membership
              const membershipKey = `org_member_${job.orgId}_${authUser.id}`;
              const wasJustCreated = !localStorage.getItem(membershipKey);
              if (wasJustCreated) {
                localStorage.setItem(membershipKey, 'true');
                toast.success('You have been automatically added to this organization');
              }
              
              console.log('[SaveToJob] Successfully obtained organization membership:', orgMember);
            } catch (joinError) {
              console.error('[SaveToJob] Error joining organization:', joinError);
              toast.error('Cannot save: unable to join organization. Please contact an administrator.');
              setIsSavingToJob(false);
              return;
            }
          } else {
            toast.error('Cannot save: organization membership error. Masks will not be saved.');
            setIsSavingToJob(false);
            return;
          }
        }
      }
      
      // Save all masks to database and update their IDs
      const savedMaskIds = new Set<string>(); // Track successfully saved masks
      
      // Get image dimensions for coordinate clamping
      const photoSpace = getState().photoSpace;
      const imgWidth = photoSpace.imgW || 2048; // Fallback to reasonable default
      const imgHeight = photoSpace.imgH || 2048; // Fallback to reasonable default
      
      // Helper function to clamp coordinates to image bounds
      const clampToImageBounds = (x: number, y: number): { x: number; y: number } => ({
        x: Math.max(0, Math.min(x, imgWidth - 1)),
        y: Math.max(0, Math.min(y, imgHeight - 1))
      });
      
      for (const mask of masks) {
        // Clamp all mask points to image bounds before saving
        // This prevents negative coordinates or coordinates beyond image dimensions
        const clampedPts = mask.pts.map(pt => {
          const clamped = clampToImageBounds(pt.x, pt.y);
          const clampedPt: typeof pt = {
            ...pt,
            x: clamped.x,
            y: clamped.y
          };
          
          // Also clamp bezier handles if they exist
          if (pt.h1) {
            const clampedH1 = clampToImageBounds(pt.h1.x, pt.h1.y);
            clampedPt.h1 = {
              x: clampedH1.x,
              y: clampedH1.y
            };
          }
          if (pt.h2) {
            const clampedH2 = clampToImageBounds(pt.h2.x, pt.h2.y);
            clampedPt.h2 = {
              x: clampedH2.x,
              y: clampedH2.y
            };
          }
          
          return clampedPt;
        });
        
        // Log if any coordinates were clamped (for debugging)
        const wasClamped = mask.pts.some((pt, idx) => {
          const clamped = clampedPts[idx];
          return pt.x !== clamped.x || pt.y !== clamped.y ||
                 (pt.h1 && (pt.h1.x !== clamped.h1!.x || pt.h1.y !== clamped.h1!.y)) ||
                 (pt.h2 && (pt.h2.x !== clamped.h2!.x || pt.h2.y !== clamped.h2!.y));
        });
        if (wasClamped) {
          console.warn(`[SaveToJob] Mask ${mask.id} had coordinates clamped to image bounds (${imgWidth}x${imgHeight})`);
        }
        
        // Log detailed coordinate information for debugging
        const minX = Math.min(...clampedPts.map(p => p.x));
        const maxX = Math.max(...clampedPts.map(p => p.x));
        const minY = Math.min(...clampedPts.map(p => p.y));
        const maxY = Math.max(...clampedPts.map(p => p.y));
        console.log(`[SaveToJob] Saving mask ${mask.id}:`, {
          pointCount: clampedPts.length,
          boundingBox: { minX, minY, maxX, maxY },
          firstPoint: clampedPts[0],
          lastPoint: clampedPts[clampedPts.length - 1],
          photoDimensions: { width: imgWidth, height: imgHeight },
          wasClamped
        });
        
        const maskData = {
          photoId: targetPhotoId,
          type: 'area' as const,
          pathJson: JSON.stringify(clampedPts), // Use clamped coordinates
          materialId: mask.materialId,
          createdBy: orgMember!.id, // We know orgMember exists here
          calcMetaJson: mask.materialSettings || null,
          depthLevel: mask.depthLevel || 0,
          // elevationM is a numeric type in the database, which Zod expects as a string
          elevationM: (mask.elevationM ?? 0).toString(),
          zIndex: mask.zIndex || 0,
          isStepped: mask.isStepped || false
        };

        console.log('[SaveToJob] Creating mask in database:', maskData);
        
        const { useMaskStore } = await import('../maskcore/store');
        const maskStoreBeforeSave = useMaskStore.getState();
        const maskBeforeSave = maskStoreBeforeSave.masks[mask.id];
        
        if (!maskBeforeSave) {
          console.warn('[SaveToJob] Mask not found in store before save:', mask.id);
          continue;
        }
        
        const savedMask = await apiClient.createMask(maskData);
        console.log('[SaveToJob] Mask saved successfully with database ID:', savedMask?.id);
        
        // Update mask ID in store to use database ID
        if (savedMask && savedMask.id && savedMask.id !== mask.id) {
          useMaskStore.setState(prev => {
            const currentMask = prev.masks[mask.id];
            if (!currentMask) {
              console.warn('[SaveToJob] Mask was removed during save, skipping ID update:', mask.id);
              return prev;
            }
            
            // Verify it's the same mask (points haven't changed)
            const pointsMatch = currentMask.pts && maskBeforeSave.pts &&
              currentMask.pts.length === maskBeforeSave.pts.length &&
              JSON.stringify(currentMask.pts) === JSON.stringify(maskBeforeSave.pts);
            
            if (!pointsMatch) {
              console.warn('[SaveToJob] Mask was modified during save, skipping ID update:', mask.id);
              return prev;
            }
            
            // Create new mask with database ID
            const updatedMask = {
              ...currentMask,
              id: savedMask.id
            };
            
            const newMasks = { ...prev.masks };
            delete newMasks[mask.id];
            newMasks[savedMask.id] = updatedMask;
            
            const newSelectedId = prev.selectedId === mask.id ? savedMask.id : prev.selectedId;
            const newEditingMaskId = prev.editingMaskId === mask.id ? savedMask.id : prev.editingMaskId;
            
            savedMaskIds.add(savedMask.id);
            savedMaskIds.add(mask.id); // Track old ID too
            
            return {
              masks: newMasks,
              selectedId: newSelectedId,
              editingMaskId: newEditingMaskId
            };
          });
          
          console.log('[SaveToJob] Updated local mask ID from', mask.id, 'to', savedMask.id);
        } else if (savedMask && savedMask.id === mask.id) {
          savedMaskIds.add(savedMask.id);
          console.log('[SaveToJob] Mask already has database ID:', mask.id);
        }
      }
      
      // 2. Export canvas WITHOUT masks - masks are saved to database and remain interactive overlays
      // CRITICAL FIX: Don't bake masks into the exported image - this causes duplicates
      // (baked-in mask + Konva overlay = visual duplicate)
      // Masks should only be saved to database, not printed into the image
      const exportedBlob = await exportCanvasToBlob(); // No mask IDs = export base image only
      
      // 3. Upload/Update photo with exported blob
      let photoData;
      console.log('[SaveToJob] effectivePhotoId:', effectivePhotoId, 'jobContext:', jobContext);
      if (effectivePhotoId) {
        // Update existing photo with new edited version
        const formData = new FormData();
        formData.append('photo', exportedBlob);
        formData.append('jobId', selectedJobId);
        formData.append('width', photoSpace.imgW.toString());
        formData.append('height', photoSpace.imgH.toString());
        
        // Upload the edited image to get new URL
        const uploadResponse = await fetch('/api/photos', {
          method: 'POST',
          body: formData,
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload edited photo');
        }
        
        const uploadedPhoto = await uploadResponse.json();
        let tempPhotoId = uploadedPhoto.id; // Track for cleanup
        
        try {
          // Update the existing photo record with new URL and dimensions
          photoData = await apiClient.updatePhoto(effectivePhotoId, {
            originalUrl: uploadedPhoto.originalUrl,
            width: photoSpace.imgW,
            height: photoSpace.imgH
          });
          
          // CRITICAL FIX: Don't dispatch SET_IMAGE here - it causes premature remount
          // Wait until AFTER masks are saved to update the image URL
          // This prevents NewEditor from remounting and loading masks before current save completes
          
          // Clean up: Delete the temporary photo we just created
          console.log('[SaveToJob] About to delete temporary photo:', tempPhotoId);
          try {
            await apiClient.deletePhoto(tempPhotoId);
            console.log('[SaveToJob] Successfully cleaned up temporary photo:', tempPhotoId);
            tempPhotoId = null; // Mark as cleaned up
          } catch (cleanupError) {
            console.error('[SaveToJob] Failed to clean up temporary photo:', tempPhotoId, cleanupError);
            // Don't throw - this is cleanup, not critical to the main operation
          }
          
          console.log('Updated existing photo with new edited version');
        } catch (updateError) {
          // If updatePhoto fails, still try to clean up the orphaned temp photo
          console.error('[SaveToJob] Failed to update photo, cleaning up temp photo:', tempPhotoId);
          try {
            if (tempPhotoId) {
              await apiClient.deletePhoto(tempPhotoId);
              console.log('[SaveToJob] Cleaned up orphaned temp photo after update failure');
            }
          } catch (cleanupError) {
            console.error('[SaveToJob] Failed to clean up orphaned photo:', tempPhotoId, cleanupError);
          }
          throw updateError; // Re-throw to be caught by outer try/catch
        }
      } else {
        // Upload new photo
        photoData = await apiClient.uploadPhoto(exportedBlob, selectedJobId, {
          width: photoSpace.imgW,
          height: photoSpace.imgH
        });
        
        // CRITICAL FIX: Don't dispatch SET_IMAGE here - it causes premature remount
        // Wait until AFTER masks are saved to update the image URL
        // This prevents NewEditor from remounting and loading masks before current save completes
      }
      
      // 4. Save calibration if calibrated - USE ORIGINAL PHOTO ID
      // Note: 'state' and 'targetPhotoId' were already declared earlier in this function
      const editorState = getState(); // Get fresh state for calibration
      
      if (editorState.calibration?.isCalibrated) {
        await apiClient.updatePhotoCalibration(
          targetPhotoId,
          editorState.calibration.pixelsPerMeter,
          {
            samples: editorState.calibration.samples || [],
            stdevPct: 0
          }
        );
      }
      
      // 5. Update image URL AFTER all saves complete
      // This prevents NewEditor from remounting and loading masks before saves complete
      if (photoData && photoData.originalUrl) {
        dispatch({
          type: 'SET_IMAGE',
          payload: {
            url: photoData.originalUrl,
            width: photoSpace.imgW,
            height: photoSpace.imgH
          }
        });
        
        // CRITICAL: Notify NewEditor to skip mask reload
        // This prevents duplicate masks (baked-in image + Konva overlay) immediately after save
        window.dispatchEvent(new CustomEvent('saveComplete', {
          detail: { photoId: targetPhotoId }
        }));
        
        console.log('[SaveToJob] Updated image URL and notified save complete');
      }
      
      // Update save state tracking - use mask store state with normalized comparison
      const maskStoreForSave = useMaskStore.getState();
      const savedMasks = Object.values(maskStoreForSave.masks);
      
      // Normalize mask state for stable comparison
      const normalizeMaskState = (masks: any[]) => {
        return JSON.stringify(
          masks
            .sort((a, b) => a.id.localeCompare(b.id))
            .map(m => ({
              id: m.id,
              pts: m.pts,
              materialId: m.materialId,
              materialSettings: m.materialSettings
            }))
        );
      };
      
      const savedMaskState = normalizeMaskState(savedMasks);
      setLastSavedAt(new Date());
      setSaveError(null);
      setLastSavedMaskState(savedMaskState);
      console.log('[Toolbar] Saved mask state updated, length:', savedMaskState.length);
      
      toast.success(`Photo saved to job successfully!`);
      
      // Refresh the job photos list to ensure the updated photo is loaded
      if (effectivePhotoId) {
        // If we updated an existing photo, we should refresh the job photos
        // This will ensure the job page shows the updated photo
        window.dispatchEvent(new CustomEvent('refreshJobPhotos', { 
          detail: { jobId: selectedJobId } 
        }));
      }
      
    } catch (error) {
      console.error('Error saving to job:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSaveError(errorMessage);
      toast.error(`Failed to save to job: ${errorMessage}`);
    } finally {
      setIsSavingToJob(false);
    }
  };

  const handleSaveAsTemplate = () => {
    try {
      const state = getState();
      
      // Extract current design data
      const masks = state.masks || [];
      const assets = state.assets || [];
      const materials = state.materials || [];
      
      if (masks.length === 0) {
        toast.error('No pool design found. Please create a pool mask first.');
        return;
      }
      
      // Get the main pool mask (largest one)
      const mainMask = masks.reduce((largest, current) => {
        const currentArea = calculateMaskArea(current.points);
        const largestArea = calculateMaskArea(largest.points);
        return currentArea > largestArea ? current : largest;
      });
      
      // Calculate pool dimensions
      const bounds = calculateMaskBounds(mainMask.points);
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      
      // Determine pool type based on shape
      const aspectRatio = width / height;
      let poolType: 'rect' | 'lap' | 'kidney' | 'freeform' = 'rect';
      
      if (aspectRatio > 3) {
        poolType = 'lap';
      } else if (masks.length > 1) {
        poolType = 'freeform';
      }
      
      // Create template data
      const templateData = {
        name: `Pool Design ${new Date().toLocaleDateString()}`,
        description: `Custom pool design with ${masks.length} mask(s) and ${assets.length} asset(s)`,
        category: poolType === 'lap' ? 'lap' : poolType === 'freeform' ? 'freeform' : 'rectangular' as any,
        tags: ['custom', 'canvas-created'],
        thumbnailUrl: state.imageUrl || '/assets/pools/default-thumb.png',
        poolGeometry: {
          type: poolType,
          dimensions: { width: Math.round(width), height: Math.round(height) },
          cornerRadius: 20,
        },
        materials: {
          coping: materials.find(m => m.category === 'coping')?.id,
          waterline: materials.find(m => m.category === 'waterline_tile')?.id,
          interior: materials.find(m => m.category === 'interior')?.id,
          paving: materials.find(m => m.category === 'paving')?.id,
        },
        assets: assets.map(asset => ({
          assetId: asset.defId,
          position: { x: asset.x, y: asset.y },
          scale: asset.scale || 1,
          rotation: asset.rotation || 0,
        })),
        complexity: masks.length > 2 ? 'High' : masks.length > 1 ? 'Medium' : 'Low' as any,
        size: width > 1000 ? 'Large' : width > 600 ? 'Medium' : 'Small' as any,
        estimatedCost: materials.reduce((sum, material) => {
          const mask = masks.find(m => m.materialId === material.id);
          const area = mask ? calculateMaskArea(mask.points) : 0;
          return sum + (area * (material.price || 0));
        }, 0),
      };
      
      // Save template
      const templateId = addTemplate(templateData);
      
      toast.success('Template saved successfully!');
      
      // Navigate to Library to view the new template
      navigate('/library');
      
    } catch (error) {
      console.error('Failed to save template:', error);
      toast.error('Failed to save template');
    }
  };

  // Helper functions
  const calculateMaskArea = (points: any[]) => {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  };

  const calculateMaskBounds = (points: any[]) => {
    if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    
    let minX = points[0].x, minY = points[0].y, maxX = points[0].x, maxY = points[0].y;
    
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    
    return { minX, minY, maxX, maxY };
  };

  // Determine current workflow step
  const getCurrentStep = () => {
    if (state === 'loading' || !photoSpace) return 'upload';
    if (currentMasks.length === 0) return 'mockup';
    if (showEnhancementDrawer) return 'enhance';
    return 'export';
  };
  
  const currentStep = getCurrentStep();
  const workflowSteps = [
    { id: 'upload', label: 'Upload' },
    { id: 'mockup', label: 'Mock Up' },
    { id: 'enhance', label: 'Enhance' },
    { id: 'export', label: 'Export' }
  ];

  // Listen for keyboard shortcut events from NewEditor (after handlers are defined)
  useEffect(() => {
    const handleOpenCalibration = () => {
      if (state === 'ready') {
        setShowCalibrationTool(true);
      }
    };
    
    const handleTriggerSave = () => {
      if (state === 'ready' && selectedJobId && hasUnsavedChanges) {
        handleSaveToJob();
      }
    };
    
    const handleTriggerZoomIn = () => {
      if (state === 'ready') {
        handleZoomIn();
      }
    };
    
    const handleTriggerZoomOut = () => {
      if (state === 'ready') {
        handleZoomOut();
      }
    };
    
    window.addEventListener('openCalibrationTool', handleOpenCalibration);
    window.addEventListener('triggerSave', handleTriggerSave);
    window.addEventListener('triggerZoomIn', handleTriggerZoomIn);
    window.addEventListener('triggerZoomOut', handleTriggerZoomOut);
    
    return () => {
      window.removeEventListener('openCalibrationTool', handleOpenCalibration);
      window.removeEventListener('triggerSave', handleTriggerSave);
      window.removeEventListener('triggerZoomIn', handleTriggerZoomIn);
      window.removeEventListener('triggerZoomOut', handleTriggerZoomOut);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, selectedJobId, hasUnsavedChanges]);

  return (
    <TooltipProvider>
      <div className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100 safe-top" role="toolbar" aria-label="Canvas Editor Toolbar">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-4 px-2 md:px-6 py-2 md:py-3">
          {/* Left Section: File Operations */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {/* File Dropdown Menu */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center space-x-1 md:space-x-2 px-3 md:px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 active:bg-blue-800 transition-all duration-150 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 font-semibold h-11 md:h-auto tap-target"
                      aria-label="File Operations Menu"
                    >
                      <FileText size={16} />
                      <span className="hidden md:inline font-medium">File</span>
                      <ChevronDown className="hidden md:block" size={14} />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-2">
                    <span>File Operations</span>
                  </div>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Image
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleFit}
                  disabled={state !== 'ready'}
                >
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Fit to View
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* Calibrate Measurements - Hidden for real estate */}
                {!isRealEstate && (
                  <DropdownMenuItem 
                    onClick={() => setShowCalibrationTool(true)}
                    disabled={state !== 'ready'}
                  >
                    <Ruler className="mr-2 h-4 w-4" />
                    Calibrate Measurements
                  </DropdownMenuItem>
                )}
                {!isRealEstate && <DropdownMenuSeparator />}
                <DropdownMenuItem 
                  onClick={handleSaveAsTemplate}
                  disabled={state !== 'ready'}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save as Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Job Controls - only show when in job context */}
            {jobId && (
              <div className="hidden md:flex items-center border-l border-[var(--border-divider)] pl-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToJob}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft size={16} />
                  <span>Back to Job</span>
                </Button>
              </div>
            )}
          </div>

          {/* Center Section: Tools & Zoom (Combined) */}
          <div className="flex items-center gap-2 flex-1 justify-center flex-wrap">
            {/* Tools Group - Hide mask creation tools when viewing a variant */}
            {!isViewingVariant && (
              <div className="flex items-center bg-gray-50 rounded-xl p-0.5 md:p-1 border border-gray-200 shadow-sm">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' })}
                    className={`flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-1.5 rounded-[var(--radius-sm)] transition-colors h-11 md:h-auto tap-target ${
                      activeTool === 'select'
                        ? 'bg-[var(--surface-panel)] text-[var(--primary-default)] shadow-[var(--elevation-xs)]'
                        : 'text-gray-600 hover:text-gray-800 hover:bg-[var(--surface-panel)]'
                    }`}
                  >
                    <MousePointer size={16} />
                    <span className="text-xs md:text-sm font-medium">Select</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-2">
                    <span>Select Tool</span>
                    <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-slate-300 font-mono">V</kbd>
                  </div>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'area' })}
                    className={`flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-1.5 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 h-11 md:h-auto tap-target ${
                      activeTool === 'area'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-gray-600 hover:text-gray-800 hover:bg-white'
                    }`}
                    aria-label="Area Tool"
                  >
                    <Square size={16} />
                    <span className="text-xs md:text-sm font-medium">Area</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-2">
                    <span>Area Tool</span>
                    <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-slate-300 font-mono">A</kbd>
                  </div>
                </TooltipContent>
              </Tooltip>
              
              {/* Drawing Mode Toggle - Inline when Area tool is active */}
              {activeTool === 'area' && (
                <div className="flex items-center ml-1 pl-1 border-l border-[var(--border-divider)]">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => dispatch({ type: 'SET_DRAWING_MODE', payload: 'area' })}
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded-[var(--radius-sm)] transition-colors ${
                          drawingMode === 'area'
                            ? 'bg-primary/5 text-[var(--primary-default)]'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Area
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <span>Area Mode (Closed Polygon)</span>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => dispatch({ type: 'SET_DRAWING_MODE', payload: 'freehand' })}
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded-[var(--radius-sm)] transition-colors ${
                          drawingMode === 'freehand'
                            ? 'bg-primary/5 text-[var(--primary-default)]'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Free
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <span>Freehand Mode (Open Line)</span>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
              </div>
            )}
            
            {/* Zoom & Calibration Controls - Compact Toolbar Section */}
            <div className="flex items-center gap-1.5 md:gap-2 bg-gray-50 rounded-xl p-0.5 md:p-1 border border-gray-200 shadow-sm">
              {/* Zoom Controls */}
              <div className="flex items-center bg-white rounded-lg p-0.5 border border-gray-200">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleZoomOut}
                    disabled={state !== 'ready'}
                      className="p-2 md:p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 tap-target"
                      aria-label="Zoom Out"
                  >
                    <ZoomOut size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-2">
                    <span>Zoom Out</span>
                    <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-slate-300 font-mono">Ctrl+-</kbd>
                  </div>
                </TooltipContent>
              </Tooltip>
              
                <div className="px-2 py-1 text-xs font-mono text-gray-700 min-w-[45px] md:min-w-[50px] text-center">
                {zoomLabel}
              </div>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleZoomIn}
                    disabled={state !== 'ready'}
                      className="p-2 md:p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 tap-target"
                      aria-label="Zoom In"
                  >
                    <ZoomIn size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-2">
                    <span>Zoom In</span>
                    <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-slate-300 font-mono">Ctrl++</kbd>
                  </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              {/* Calibration Button - Hidden for real estate */}
              {!isRealEstate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowCalibrationTool(true)}
                      disabled={state !== 'ready'}
                      className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 h-11 md:h-auto tap-target ${
                        calibration.isCalibrated
                          ? 'bg-primary/5 text-primary border border-blue-300 hover:bg-primary/10'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      aria-label="Calibrate Measurements"
                    >
                      <Ruler size={14} />
                      <span className="hidden md:inline">
                        {calibration.isCalibrated 
                          ? `${calibration.pixelsPerMeter.toFixed(0)} px/m` 
                          : 'Calibrate'}
                      </span>
                      <span className="md:hidden">Cal</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span>Calibrate Measurements (C)</span>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        
          {/* Right Section: Actions (Simplified) */}
          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            {/* Job Selection - Replace Create Quote */}
            {!selectedJobId && (
              <div className="hidden md:block">
                <JobSelector onJobSelect={handleJobSelect} />
              </div>
            )}
            
            {/* Save State Indicator (Icon-only) and Save Button - Show when job selected */}
            {selectedJobId && (
              <>
                {/* Compact Save Indicator - Icon only */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={hasUnsavedChanges ? handleSaveToJob : undefined}
                      className={`p-2 rounded-[var(--radius-md)] transition-colors tap-target ${
                        isSavingToJob
                          ? 'text-primary'
                          : saveError
                            ? 'text-red-600'
                            : hasUnsavedChanges
                              ? 'text-yellow-600'
                              : 'text-green-600'
                      } hover:bg-[var(--surface-panel)]`}
                    >
                      {isSavingToJob ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : saveError ? (
                        <AlertCircle size={16} />
                      ) : hasUnsavedChanges ? (
                        <AlertCircle size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div>
                      {isSavingToJob && <p>Saving...</p>}
                      {saveError && <p className="text-red-600">{saveError}</p>}
                      {hasUnsavedChanges && <p>Unsaved changes - Click to save</p>}
                      {!hasUnsavedChanges && !isSavingToJob && !saveError && (
                        <p>All changes saved{lastSavedAt ? ` (${formatDistanceToNow(lastSavedAt, { addSuffix: true })})` : ''}</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
                
                {/* Save Button - Only show when there are unsaved changes */}
                {hasUnsavedChanges && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleSaveToJob}
                        disabled={state !== 'ready' || isSavingToJob}
                        className="flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-1.5 bg-primary text-white rounded-[var(--radius-md)] hover:bg-primary/90 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[var(--elevation-sm)] text-xs md:text-sm font-medium h-11 md:h-auto tap-target"
                      >
                        {isSavingToJob ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Save size={14} />
                        )}
                        <span>Save</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="flex items-center gap-2">
                        <span>Save Changes</span>
                        <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-slate-300 font-mono">Ctrl+S</kbd>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </>
            )}
            
            {/* Enhance button - Primary Action - Only show when viewing original image */}
            {!isViewingVariant && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowEnhancementDrawer(!showEnhancementDrawer)}
                    disabled={state !== 'ready'}
                    className="flex items-center space-x-1 md:space-x-2 px-3 md:px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-xs md:text-sm font-semibold h-11 md:h-auto tap-target"
                    aria-label="Enhance with AI"
                  >
                    <Sparkles size={16} />
                    <span>Enhance</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <span>AI Enhancements</span>
                </TooltipContent>
              </Tooltip>
            )}
            
            {/* Quote Button - Only show when job is selected, hidden for real estate */}
            {!isRealEstate && effectiveJobId && job && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowQuoteModal(true)}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-[var(--surface-panel)] rounded-[var(--radius-md)] transition-colors tap-target"
                    aria-label="View Quotes"
                  >
                    <Receipt size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <span>View Quotes</span>
                </TooltipContent>
              </Tooltip>
            )}
            
            {/* Controls Legend Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowKeyLegend(true)}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-[var(--surface-panel)] rounded-[var(--radius-md)] transition-colors"
                  aria-label="Show Controls Legend"
                >
                  <Key size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <span>Show Controls Legend</span>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        
        {/* Progress Indicator - Hide on mobile to reduce clutter */}
        <div className="hidden md:block px-6 py-2 border-t border-gray-100 bg-gray-50/50" role="progressbar" aria-label="Workflow Progress">
          <div className="flex items-center gap-2">
            {workflowSteps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-150 ${
                      currentStep === step.id
                        ? 'bg-primary text-white shadow-sm'
                        : workflowSteps.findIndex(s => s.id === currentStep) > index
                          ? 'bg-primary/10 text-primary'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <span>{step.label}</span>
                  </div>
                </div>
                {index < workflowSteps.length - 1 && (
                  <div className={`h-0.5 w-4 transition-all duration-150 ${
                    workflowSteps.findIndex(s => s.id === currentStep) > index
                      ? 'bg-primary'
                      : 'bg-gray-300'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      {/* Calibration Tool Modal */}
      {showCalibrationTool && (
        <CalibrationTool onClose={() => setShowCalibrationTool(false)} />
      )}
      
      {/* Key Legend Modal */}
      <KeyLegend 
        isOpen={showKeyLegend} 
        onClose={() => setShowKeyLegend(false)} 
      />
      
      {/* AI Enhancements Drawer */}
      {showEnhancementDrawer && (
        <JobsDrawer 
          onClose={() => setShowEnhancementDrawer(false)}
          onApplyEnhancedImage={async (data) => {
            // CRITICAL FIX: Check global enhancement lock
            const currentState = useEditorStore.getState();
            if (currentState.isEnhancing) {
              toast.warning('Enhancement in progress', { 
                description: 'Please wait for the current enhancement to complete before applying another.' 
              });
              return;
            }
            
            // CRITICAL FIX: Capture active variant at start to validate it hasn't changed
            const activeVariantIdAtStart = currentState.activeVariantId;
            
            // Preload image before adding variant
            const { preloadImage } = await import('../lib/imagePreloader');
            
            // Create new variant and set as active (will start in loading state)
            const variantId = `enhanced-${Date.now()}`;
            dispatch({
              type: 'ADD_VARIANT',
              payload: {
                id: variantId,
                label: data.label,
                imageUrl: data.imageUrl,
                loadingState: 'loading'
              }
            });
            
            // CRITICAL FIX: Track pending enhancement for cancellation
            dispatch({
              type: 'SET_PENDING_ENHANCEMENT',
              payload: {
                variantId,
                imageUrl: data.imageUrl,
                activeVariantIdAtStart
              }
            });
            
            // Preload image in background
            const result = await preloadImage(data.imageUrl, {
              maxRetries: 3,
              timeout: 30000
            });
            
            if (result.success) {
              // CRITICAL FIX: Validate variant hasn't changed during preload
              const stateAfterPreload = useEditorStore.getState();
              if (stateAfterPreload.activeVariantId !== activeVariantIdAtStart) {
                // Variant changed during preload - cancel enhancement
                dispatch({ type: 'CANCEL_PENDING_ENHANCEMENT' });
                toast.warning('Variant changed', { 
                  description: 'Enhancement was cancelled because you switched variants during loading.' 
                });
                return;
              }
              
              // Clear pending enhancement - it's now applied
              dispatch({ type: 'SET_PENDING_ENHANCEMENT', payload: null });
              dispatch({
                type: 'UPDATE_VARIANT_LOADING_STATE',
                payload: {
                  variantId,
                  loadingState: 'loaded',
                  loadedAt: Date.now()
                }
              });
              // Update canvas image
              dispatch({
                type: 'SET_IMAGE',
                payload: {
                  url: data.imageUrl,
                  width: result.image?.width || 0,
                  height: result.image?.height || 0,
                  naturalWidth: result.image?.naturalWidth,
                  naturalHeight: result.image?.naturalHeight
                }
              });
            } else {
              dispatch({
                type: 'UPDATE_VARIANT_LOADING_STATE',
                payload: {
                  variantId,
                  loadingState: 'error',
                  errorMessage: result.error?.message || 'Failed to load image'
                }
              });
              toast.error('Failed to load enhanced image', {
                description: result.error?.message || 'Please try again',
                action: {
                  label: 'Retry',
                  onClick: () => {
                    dispatch({
                      type: 'INCREMENT_VARIANT_RETRY',
                      payload: { variantId }
                    });
                    // Retry loading
                    onApplyEnhancedImage(data);
                  }
                }
              });
            }
          }}
        />
      )}

      {/* Photo Selection Modal */}
      {selectedJobId && (
        <PhotoSelectionModal
          open={showPhotoSelection}
          onClose={() => setShowPhotoSelection(false)}
          jobId={selectedJobId}
          onSelectPhoto={handlePhotoSelect}
        />
      )}
      
      {/* Quote Selection Modal - Hidden for real estate */}
      {!isRealEstate && effectiveJobId && job && (
        <QuoteSelectionModal
          open={showQuoteModal}
          onOpenChange={setShowQuoteModal}
          onSelectQuote={(quoteId) => {
            navigate(`/quotes/${quoteId}`);
            setShowQuoteModal(false);
          }}
          jobId={effectiveJobId}
          jobOrgId={job.orgId}
          allowCreateNew={true}
        />
      )}
    </TooltipProvider>
  );
}
