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
import { Upload, Maximize2, MousePointer, Square, Undo2, Redo2, Download, ZoomIn, ZoomOut, Ruler, Eye, EyeOff, DollarSign, Key, FileText, ChevronDown, Save } from 'lucide-react';
import { PV_PRECISE_MASKS } from './featureFlags';
import { CalibrationTool } from './CalibrationTool';
import { KeyLegend } from './KeyLegend';
import { useMaskStore } from '../maskcore/store';
import { useProjectStore } from '../stores/projectStore';
import { useUnifiedTemplateStore } from '../stores/unifiedTemplateStore';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '../components/ui/dropdown-menu';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '../components/ui/tooltip';

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCalibrationTool, setShowCalibrationTool] = useState(false);
  const [showKeyLegend, setShowKeyLegend] = useState(false);
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
  
  const {
    photoSpace,
    containerSize,
    activeTool,
    state,
    zoomLabel,
    snappingEnabled,
    calibration,
    measurements,
    dispatch,
    getState
  } = useEditorStore();
  const { addTemplate } = useUnifiedTemplateStore();

  // Update zoom label when photoSpace scale changes
  useEffect(() => {
    const percentage = Math.round(photoSpace.scale * 100);
    dispatch({
      type: 'SET_ZOOM_LABEL',
      payload: `${percentage}%`
    });
  }, [photoSpace.scale, dispatch]);

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
      
      const { panX, panY } = calculateCenterPan(
        result.width,
        result.height,
        containerSize.width,
        containerSize.height,
        fitScale
      );
      
      // Update PhotoSpace
      dispatch({
        type: 'SET_PHOTO_SPACE',
        payload: {
          scale: fitScale,
          panX,
          panY,
          imgW: result.width,
          imgH: result.height
        }
      });
      
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
    
    // Always fit to 100% zoom for calibration compatibility
    const fitScale = 1.0;
    
    const { panX, panY } = calculateCenterPan(
      photoSpace.imgW,
      photoSpace.imgH,
      containerSize.width,
      containerSize.height,
      fitScale
    );
    
    dispatch({
      type: 'SET_PHOTO_SPACE',
      payload: { scale: fitScale, panX, panY }
    });
  };

  const handleZoomIn = () => {
    // Use 10% increments instead of exponential scaling
    const currentPercentage = Math.round(photoSpace.scale * 100);
    const nextPercentage = Math.min(500, currentPercentage + 10); // Max 500%
    const newScale = nextPercentage / 100;
    
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
    // Use 10% increments instead of exponential scaling
    const currentPercentage = Math.round(photoSpace.scale * 100);
    const nextPercentage = Math.max(10, currentPercentage - 10); // Min 10%
    const newScale = nextPercentage / 100;
    
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
      
      // Convert to blob and download
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
    };
    
    // Load image from current state
    const currentState = getState();
    if (currentState.imageUrl) {
      img.src = currentState.imageUrl;
    }
  };

  const handleCreateQuoteFromCanvas = async () => {
    const { project, currentPhoto } = useProjectStore.getState();
    const { masks, calibration, CREATE_QUOTE, ADD_QUOTE_ITEM, SET_ACTIVE_QUOTE } = useMaskStore.getState();
    
    if (!project || !currentPhoto) {
      toast.error('No project context available');
      return;
    }

    try {
      // Generate quote name with timestamp
      const timestamp = new Date().toLocaleDateString();
      const quoteName = `${project.name} - ${currentPhoto.name} - ${timestamp}`;
      
      // Create quote
      const quoteId = CREATE_QUOTE(quoteName);
      
      // Auto-populate with canvas data
      const masksWithMaterials = Object.values(masks).filter(mask => 
        mask.materialId && mask.isVisible !== false
      );
      
      // Add all canvas items to quote
      for (const mask of masksWithMaterials) {
        ADD_QUOTE_ITEM(quoteId, mask.id, mask.materialId, calibration.pixelsPerMeter);
      }
      
      // Set as active quote
      SET_ACTIVE_QUOTE(quoteId);
      
      // Navigate to quotes page
      navigate('/quotes');
      
      toast.success(`Quote "${quoteName}" created with ${masksWithMaterials.length} items`);
      
    } catch (error) {
      console.error('Error creating quote:', error);
      toast.error('Failed to create quote');
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

  return (
    <TooltipProvider>
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left Section: File Operations */}
          <div className="flex items-center space-x-3">
            {/* File Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                  title="File Operations"
                >
                  <FileText size={16} />
                  <span className="font-medium">File</span>
                  <ChevronDown size={14} />
                </button>
              </DropdownMenuTrigger>
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
                <DropdownMenuItem 
                  onClick={() => setShowCalibrationTool(true)}
                  disabled={state !== 'ready'}
                >
                  <Ruler className="mr-2 h-4 w-4" />
                  Calibrate Measurements
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleSaveAsTemplate}
                  disabled={state !== 'ready'}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save as Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        
        {/* Center Section: Tools */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' })}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                activeTool === 'select'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
              title="Select Tool (V)"
            >
              <MousePointer size={16} />
              <span className="font-medium">Select</span>
            </button>
            
            <button
              onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'area' })}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                activeTool === 'area'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
              title="Area Tool (A)"
            >
              <Square size={16} />
              <span className="font-medium">Area</span>
            </button>
          </div>
          
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={handleZoomOut}
              disabled={state !== 'ready'}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            
            <div className="px-3 py-2 text-sm font-mono text-gray-700 bg-white rounded-md shadow-sm min-w-[60px] text-center">
              {zoomLabel}
            </div>
            
            <button
              onClick={handleZoomIn}
              disabled={state !== 'ready'}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
        
        {/* Right Section: Status & Actions */}
        <div className="flex items-center space-x-3">
          {/* Compact Status Badge */}
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            calibration.isCalibrated 
              ? 'bg-green-100 text-green-700' 
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {calibration.isCalibrated 
              ? `✓ ${calibration.pixelsPerMeter.toFixed(0)} px/m` 
              : 'Not Calibrated'
            }
          </div>
          
          {/* Icon-only Action Buttons with Tooltips */}
          <div className="flex items-center space-x-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleMeasurements}
                  className={`p-2 rounded-lg transition-colors ${
                    measurements.showMeasurements
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  {measurements.showMeasurements ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Measurements</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleCosts}
                  className={`p-2 rounded-lg transition-colors ${
                    measurements.showCosts
                      ? 'bg-green-100 text-green-600'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <DollarSign size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Costs</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleUndo}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Undo2 size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Undo (Ctrl+Z)</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleRedo}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Redo2 size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Redo (Ctrl+Shift+Z)</p>
              </TooltipContent>
            </Tooltip>
            
            {/* Create Quote Button */}
            <button
              onClick={handleCreateQuoteFromCanvas}
              disabled={state !== 'ready'}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              title="Create Quote from Canvas"
            >
              <FileText size={16} />
              <span className="font-medium">Create Quote</span>
            </button>
            
            {/* Keep Export prominent */}
            <button
              onClick={handleExport}
              disabled={state !== 'ready'}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              title="Export PNG"
            >
              <Download size={16} />
              <span className="font-medium">Export</span>
            </button>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowKeyLegend(true)}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Key size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show Canvas Controls Legend</p>
              </TooltipContent>
            </Tooltip>
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
      </div>
    </TooltipProvider>
  );
}
