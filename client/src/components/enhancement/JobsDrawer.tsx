
// client/src/components/enhancement/JobsDrawer.tsx
import React, { useEffect, useState } from 'react';
import { X, Sparkles, Loader2, Waves, Sparkles as SparklesIcon, Search, Filter, ArrowUpDown, Palette, CheckSquare, Square, ChevronDown, ChevronUp, Layers2, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { useEnhancementStore, type SortOption, type StatusFilter, type TypeFilter, type DateFilter, type GroupBy } from '../../state/useEnhancementStore';
import { getRecentJobs, createJob, type Job } from '../../services/aiEnhancement';
import { useJobStream } from '../../hooks/useJobStream';
import { PreviewModal } from './PreviewModal';
import { BulkActionToolbar } from './BulkActionToolbar';
import { JobCard } from './JobCard';
import { useEditorStore } from '../../new_editor/store';
import { useMaskStore } from '../../maskcore/store';
import { toast } from '../../lib/toast';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useAuthStore } from '../../stores/auth-store';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Sunset, Home, Eraser } from 'lucide-react';
import { checkFeatureAccess, getUpgradeMessage } from '../../lib/featureAccess';
import { CreditDeductionModal } from '../credits/CreditDeductionModal';
import { apiClient } from '../../lib/api-client';
import { useLocation } from 'wouter';

interface JobsDrawerProps {
  onClose?: () => void;
  onApplyEnhancedImage?: (data: { imageUrl: string; label: string }) => void;
}

export function JobsDrawer({ onClose, onApplyEnhancedImage }: JobsDrawerProps) {
  const { industry } = useOnboarding();
  const { user } = useAuthStore();
  const [, setLocation] = useLocation();
  const { 
    setInitial, 
    upsertJob, 
    sortBy,
    statusFilter,
    typeFilter,
    dateFilter,
    searchQuery,
    setSortBy,
    setStatusFilter,
    setTypeFilter,
    setDateFilter,
    setSearchQuery,
    setCurrentPage,
    isSelectMode,
    toggleSelectMode,
    groupBy,
    setGroupBy
  } = useEnhancementStore();
  
  // Get valid modes based on industry
  const getValidModes = (): Array<
    'add_pool' | 'add_decoration' | 'blend_materials' | 
    'image_enhancement' | 'day_to_dusk' | 'stage_room' | 'item_removal'
  > => {
    const effectiveIndustry = user?.industryType || industry;
    if (effectiveIndustry === 'real_estate') {
      return ['image_enhancement', 'day_to_dusk', 'stage_room', 'item_removal'];
    }
    return ['add_pool', 'add_decoration', 'blend_materials'];
  };

  // Get enhancement type label
  const getEnhancementTypeLabel = (mode?: string): string => {
    const labels: Record<string, string> = {
      // Trades
      'add_pool': 'Add Pool',
      'add_decoration': 'Add Decoration',
      'blend_materials': 'Blend Materials',
      // Real Estate
      'image_enhancement': 'Image Enhancement',
      'day_to_dusk': 'Day to Dusk',
      'stage_room': 'Virtual Staging',
      'item_removal': 'Item Removal',
    };
    return labels[mode || ''] || 'Enhancement';
  };

  // Get enhancement type icon
  const getEnhancementTypeIcon = (mode?: string) => {
    const icons: Record<string, any> = {
      'add_pool': Waves,
      'add_decoration': SparklesIcon,
      'blend_materials': Palette,
      'image_enhancement': Sparkles,
      'day_to_dusk': Sunset,
      'stage_room': Home,
      'item_removal': Eraser,
    };
    return icons[mode || ''] || Sparkles;
  };
  
  // Add prompt state
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  
  // Credit state
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [pendingEnhancement, setPendingEnhancement] = useState<{
    mode: 'add_pool' | 'add_decoration' | 'blend_materials' | 'image_enhancement' | 'day_to_dusk' | 'stage_room' | 'item_removal';
    hasMask: boolean;
  } | null>(null);
  
  const [isCreating, setIsCreating] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const [previewData, setPreviewData] = useState<{
    compositeImageUrl: string | null;
    compositeBlob: Blob | null;
    maskCount: number;
    materials: Array<{ id: string; name?: string }>;
    imageDimensions: { width: number; height: number };
    mode: 'add_pool' | 'add_decoration' | 'blend_materials' | 'image_enhancement' | 'day_to_dusk' | 'stage_room' | 'item_removal';
    payload: any | null; // Will be created on confirm
    masks: any[]; // Store masks for payload creation
    effectivePhotoId: string;
    currentImageUrl: string;
    photoSpace: any;
    jobContext: any;
  } | null>(null);

  // Stream updates for the active job with auto-apply callback
  useJobStream(activeJobId, async (job) => {
    // Auto-apply enhanced image when variants are ready
    if (job.status === 'completed' && 
        job.variants && 
        job.variants.length > 0 && 
        onApplyEnhancedImage && 
        job.variants[0]?.url) {
      console.log(`[JobsDrawer] 🎨 Auto-applying enhanced image to canvas...`);
      const enhancedImageUrl = job.variants[0].url;
      const currentState = useEditorStore.getState();
      const enhancedCount = currentState.variants.filter(v => v.id !== 'original').length;
      const label = `AI Enhanced ${enhancedCount + 1}`;
      
      // Preload and apply
      try {
        const { preloadImage } = await import('../../lib/imagePreloader');
        const result = await preloadImage(enhancedImageUrl, {
          maxRetries: 3,
          timeout: 30000
        });
        
        if (result.success && result.image) {
          console.log(`[JobsDrawer] ✅ Image preloaded successfully, applying to canvas...`);
          onApplyEnhancedImage({
            imageUrl: enhancedImageUrl,
            label
          });
          toast.success('Enhanced image applied', { description: `${label} is now active on the canvas.` });
        } else {
          console.warn(`[JobsDrawer] ⚠️ Image preload failed, user can manually apply`);
        }
      } catch (error) {
        console.error(`[JobsDrawer] ❌ Error auto-applying image:`, error);
        // Don't show error toast - user can manually apply
      }
    }
  });
  
  // Find the most recent active enhancement (processing or just completed)
  // Use a selector that returns a stable string key to avoid infinite loops
  const jobsKeys = useEnhancementStore(s => Object.keys(s.jobs).sort().join(','));
  const jobsCount = useEnhancementStore(s => Object.keys(s.jobs).length);
  
  // Phase 1: Auto-archive threshold (5 minutes)
  const ARCHIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  
  // Compute activeEnhancement when jobs actually change (using keys as dependency)
  // Phase 1: Updated to use 5-minute threshold instead of 1 hour
  const activeEnhancement = React.useMemo(() => {
    const store = useEnhancementStore.getState();
    const allJobs = Object.values(store.jobs);
    if (allJobs.length === 0) return undefined;
    
    // Sort by created_at descending, find first processing or recently completed (within last 5 minutes)
    const sorted = [...allJobs].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });
    
    const now = Date.now();
    const archiveThreshold = now - ARCHIVE_THRESHOLD_MS;
    
    return sorted.find(job => {
      const isProcessing = ['queued', 'downloading', 'preprocessing', 'rendering', 'postprocessing', 'uploading'].includes(job.status);
      const isRecentlyCompleted = job.status === 'completed' && 
        job.completed_at && 
        new Date(job.completed_at).getTime() > archiveThreshold;
      return isProcessing || isRecentlyCompleted;
    });
  }, [jobsKeys, jobsCount]);
  
  // Phase 1: Recently completed jobs (completed within 5 min, but not active)
  const recentlyCompletedJobs = React.useMemo(() => {
    const store = useEnhancementStore.getState();
    const allJobs = Object.values(store.jobs);
    const now = Date.now();
    const archiveThreshold = now - ARCHIVE_THRESHOLD_MS;
    
    return allJobs
      .filter(job => {
        const isCompleted = job.status === 'completed';
        const completedTime = job.completed_at ? new Date(job.completed_at).getTime() : 0;
        const isRecent = completedTime > archiveThreshold;
        const isNotActive = job.id !== activeEnhancement?.id;
        return isCompleted && isRecent && isNotActive;
      })
      .sort((a, b) => {
        const aTime = new Date(a.completed_at || 0).getTime();
        const bTime = new Date(b.completed_at || 0).getTime();
        return bTime - aTime;
      });
  }, [jobsKeys, jobsCount, activeEnhancement?.id]);
  
  // Set activeJobId when activeEnhancement changes to enable SSE streaming
  useEffect(() => {
    if (activeEnhancement?.id) {
      console.log(`[JobsDrawer] 🎯 Setting activeJobId to: ${activeEnhancement.id} (status: ${activeEnhancement.status})`);
      setActiveJobId(activeEnhancement.id);
    } else {
      console.log(`[JobsDrawer] 🎯 Clearing activeJobId (no active enhancement)`);
      setActiveJobId(undefined);
    }
  }, [activeEnhancement?.id, activeEnhancement?.status]);
  
  // NOTE: Polling is now handled by useJobStream hook (dual-channel pattern)
  // This ensures parallel SSE + polling for maximum reliability
  // No duplicate polling needed here - useJobStream handles it all
  
  // Phase 1: History jobs (exclude active and recently completed)
  const historyJobs = React.useMemo(() => {
    const store = useEnhancementStore.getState();
    const allJobs = Object.values(store.jobs);
    const activeId = activeEnhancement?.id;
    const recentIds = new Set(recentlyCompletedJobs.map(j => j.id));
    
    return allJobs
      .filter(job => job.id !== activeId && !recentIds.has(job.id))
      .sort((a, b) => {
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 10); // Limit to last 10
  }, [jobsKeys, jobsCount, activeEnhancement?.id, recentlyCompletedJobs]);
  
  // Phase 1: Auto-archive timer to periodically check and update job categorization
  useEffect(() => {
    // Re-check job categorization every 30 seconds
    // This ensures jobs auto-archive when they cross the 5-minute threshold
    const interval = setInterval(() => {
      // Force re-computation by updating a dummy state
      // The useMemo dependencies will trigger re-computation
      setActiveJobId(prev => prev); // Trigger re-render
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  const [historyExpanded, setHistoryExpanded] = React.useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(debouncedSearchQuery);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [debouncedSearchQuery, setSearchQuery, setCurrentPage]);

  // Load credit balance on mount
  useEffect(() => {
    loadCreditBalance();
  }, []);

  const loadCreditBalance = async () => {
    try {
      const response = await apiClient.getCreditBalance();
      setCreditBalance(response.balance.total);
    } catch (error) {
      console.error('Failed to load credit balance:', error);
    }
  };

  // Load jobs on mount
  useEffect(() => {
    setIsLoading(true);
    getRecentJobs(100) // Load more jobs for pagination
      .then(d => {
        setInitial(d.jobs);
        console.log(`[JobsDrawer] Loaded ${d.jobs.length} jobs, checking for completed jobs without variants...`);
        
        // BULLETPROOF: Aggressively fetch variants for any completed jobs without them
        const completedJobsWithoutVariants = d.jobs.filter(job => 
          job.status === 'completed' && (!job.variants || job.variants.length === 0)
        );
        
        if (completedJobsWithoutVariants.length > 0) {
          console.log(`[JobsDrawer] 🔄 Found ${completedJobsWithoutVariants.length} completed job(s) without variants, fetching with retries...`);
          
          // Fetch with retry logic for each job
          completedJobsWithoutVariants.forEach(async (job) => {
            let retries = 0;
            const maxRetries = 5;
            
            const fetchWithRetry = async (): Promise<void> => {
              try {
                const { getJob } = await import('../../services/aiEnhancement');
                const fullJob = await getJob(job.id);
                
                if (fullJob.variants && fullJob.variants.length > 0) {
                  upsertJob(fullJob);
                  console.log(`[JobsDrawer] ✅ Fetched ${fullJob.variants.length} variant(s) for job ${job.id} (attempt ${retries + 1})`);
                } else if (retries < maxRetries) {
                  // No variants yet, retry with exponential backoff
                  retries++;
                  const delay = Math.min(1000 * Math.pow(2, retries), 10000); // Max 10 seconds
                  console.log(`[JobsDrawer] ⏳ No variants for job ${job.id}, retrying in ${delay}ms (attempt ${retries}/${maxRetries})`);
                  setTimeout(fetchWithRetry, delay);
                } else {
                  console.error(`[JobsDrawer] ❌ Gave up fetching variants for job ${job.id} after ${maxRetries} attempts`);
                }
              } catch (error) {
                if (retries < maxRetries) {
                  retries++;
                  const delay = Math.min(1000 * Math.pow(2, retries), 10000);
                  console.error(`[JobsDrawer] ❌ Error fetching variants for job ${job.id} (attempt ${retries}), retrying in ${delay}ms:`, error);
                  setTimeout(fetchWithRetry, delay);
                } else {
                  console.error(`[JobsDrawer] ❌ Failed to fetch variants for job ${job.id} after ${maxRetries} attempts:`, error);
                }
              }
            };
            
            // Start fetching
            fetchWithRetry();
          });
        }
        
        toast.success('Enhancement jobs loaded', { description: `Loaded ${d.jobs.length} jobs` });
      })
      .catch((err) => {
        console.error('[JobsDrawer] Failed to load jobs:', err);
        toast.error('Failed to load jobs', { description: err.message });
      })
      .finally(() => setIsLoading(false));
  }, [setInitial, upsertJob]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when drawer is open and not typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Escape to close
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"][placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }
      // Ctrl/Cmd + F to toggle filters
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowFilters(!showFilters);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showFilters]);

  const handleCreateEnhancement = async (mode: 'add_pool' | 'add_decoration' | 'blend_materials' | 'image_enhancement' | 'day_to_dusk' | 'stage_room' | 'item_removal') => {
    const currentState = useEditorStore.getState();
    const currentImageUrl = currentState.imageUrl;
    const photoSpace = currentState.photoSpace;
    
    if (!currentImageUrl) {
      alert('Please load an image in the canvas first');
      return;
    }
    
    // Validate image aspect ratio - square images are not supported
    const imgW = photoSpace.imgW || 0;
    const imgH = photoSpace.imgH || 0;
    if (imgW > 0 && imgH > 0 && Math.abs(imgW - imgH) < 1) {
      // Image is square (width === height within 1px tolerance)
      toast.error('Square images not supported', {
        description: 'AI enhancement requires landscape or portrait images. Please use an image with a different aspect ratio.'
      });
      return;
    }
    
    if (isCreating) return;

    // Check if masks are required and exist
    const effectiveIndustry = user?.industryType || industry;
    const masksRequired = effectiveIndustry !== 'real_estate';
    const maskStore = useMaskStore.getState();
    const localMasks = Object.values(maskStore.masks || {});
    const hasMask = localMasks.length > 0;

    // Check credits before proceeding
    if (creditBalance !== null) {
      try {
        const creditResponse = await apiClient.calculateCredits(mode, hasMask);
        const requiredCredits = creditResponse.credits;
        
        if (creditBalance < requiredCredits) {
          // Show credit modal or upgrade prompt
          setPendingEnhancement({ mode, hasMask });
          setShowCreditModal(true);
          return;
        }
      } catch (error) {
        console.error('Failed to calculate credits:', error);
        // Continue anyway - server will check
      }
    }
    
    setIsCreating(true);
    const effectivePhotoId = currentState.jobContext?.photoId || '134468b9-648e-4eb1-8434-d7941289fccf';
    
    try {
      // CRITICAL FIX: Load masks from database, not just local store
      // Local store might be empty if user navigated away and came back
      // Always use database as source of truth for enhancement jobs
      const { apiClient } = await import('../../lib/api-client');
      const dbMasks = await apiClient.getMasks(effectivePhotoId);
      console.log(`[JobsDrawer] Loaded ${dbMasks.length} masks from database for photo ${effectivePhotoId}`);
      // Log raw database response to verify calcMetaJson is present
      dbMasks.forEach(m => {
        console.log(`[JobsDrawer] Raw DB mask ${m.id}:`, {
          hasMaterialId: !!m.materialId,
          hasCalcMetaJson: !!m.calcMetaJson,
          calcMetaJsonType: m.calcMetaJson ? typeof m.calcMetaJson : 'null',
          calcMetaJsonValue: m.calcMetaJson 
            ? (typeof m.calcMetaJson === 'string' 
                ? m.calcMetaJson.substring(0, 150) 
                : JSON.stringify(m.calcMetaJson).substring(0, 150))
            : 'null'
        });
      });
      
      // Also check local store for any unsaved masks AND to get materialSettings
      // Local store may have materialSettings even if database doesn't (if user adjusted settings but didn't save)
      // IMPORTANT: Get fresh state from store to ensure we have latest materialSettings
      const maskStore = useMaskStore.getState();
      const localMasks = Object.values(maskStore.masks || {});
      console.log(`[JobsDrawer] Local store has ${localMasks.length} masks`);
      console.log(`[JobsDrawer] Local store mask IDs:`, localMasks.map(m => m.id));
      console.log(`[JobsDrawer] Database mask IDs:`, dbMasks.map(m => m.id));
      
      // Create a map of local masks by ID for quick lookup of materialSettings
      const localMasksMap = new Map(localMasks.map(m => [m.id, m]));
      
      // Log materialSettings from local masks
      localMasks.forEach(m => {
        console.log(`[JobsDrawer] Local mask ${m.id}:`, {
          hasMaterialId: !!m.materialId,
          materialId: m.materialId,
          hasMaterialSettings: !!m.materialSettings,
          materialSettings: m.materialSettings ? {
            textureScale: m.materialSettings.textureScale,
            intensity: m.materialSettings.intensity,
            opacity: m.materialSettings.opacity,
            fullKeys: Object.keys(m.materialSettings),
            fullSettings: m.materialSettings
          } : null
        });
      });
      
      // Combine database masks with any unsaved local masks (by ID to avoid duplicates)
      const dbMaskIds = new Set(dbMasks.map(m => m.id));
      const unsavedLocalMasks = localMasks.filter(m => !dbMaskIds.has(m.id));
      
      // Convert database masks to the format expected by server
      const allMasks = [
        ...dbMasks.map(m => {
          // Parse pathJson if it's a string
          let points: any[] = [];
          try {
            const pathData = typeof m.pathJson === 'string' ? JSON.parse(m.pathJson) : m.pathJson;
            points = Array.isArray(pathData) ? pathData : [];
          } catch (e) {
            console.warn(`[JobsDrawer] Failed to parse pathJson for mask ${m.id}:`, e);
          }
          
          // CRITICAL FIX: Extract materialSettings from calcMetaJson OR local store
          // Priority: local store > database calcMetaJson (local store has latest user adjustments)
          let materialSettings: any = undefined;
          
          // First, check local store for materialSettings (may have unsaved adjustments)
          const localMask = localMasksMap.get(m.id);
          if (localMask?.materialSettings) {
            materialSettings = localMask.materialSettings;
            console.log(`[JobsDrawer] ✅ Using materialSettings from local store for mask ${m.id}:`, {
              hasTextureScale: !!materialSettings.textureScale,
              hasIntensity: !!materialSettings.intensity,
              textureScale: materialSettings.textureScale,
              intensity: materialSettings.intensity,
              fullKeys: Object.keys(materialSettings),
              fullSettings: materialSettings
            });
          } else if (m.calcMetaJson) {
            // Fallback to database calcMetaJson if local store doesn't have it
            try {
              materialSettings = typeof m.calcMetaJson === 'string' 
                ? JSON.parse(m.calcMetaJson) 
                : m.calcMetaJson;
              console.log(`[JobsDrawer] Extracted materialSettings from calcMetaJson for mask ${m.id}:`, {
                hasTextureScale: !!materialSettings.textureScale,
                hasIntensity: !!materialSettings.intensity,
                textureScale: materialSettings.textureScale,
                intensity: materialSettings.intensity,
                fullKeys: Object.keys(materialSettings)
              });
            } catch (e) {
              console.warn(`[JobsDrawer] Failed to parse calcMetaJson for mask ${m.id}:`, e);
            }
          }
          
          // If mask has materialId but no materialSettings, use defaults
          // This ensures textures are applied even if settings weren't explicitly saved
          if (m.materialId && !materialSettings) {
            console.log(`[JobsDrawer] ⚠️ Mask ${m.id} has materialId but no materialSettings - using defaults`);
            materialSettings = {
              textureScale: 100, // Default 1.0x scale
              intensity: 50, // Default neutral intensity
              opacity: 70, // Default opacity
            };
          }
          
          if (!m.materialId && !materialSettings) {
            console.log(`[JobsDrawer] Mask ${m.id} has no materialId and no materialSettings`);
          }
          
          return {
            id: m.id,
            pts: points,
            materialId: m.materialId || undefined,
            materialSettings: materialSettings, // Include materialSettings (from local store or database)
            isVisible: true, // Database masks are always visible
            zIndex: m.zIndex || 0
          };
        }),
        ...unsavedLocalMasks.map(m => ({
          // Preserve materialSettings from local masks
          id: m.id,
          pts: m.pts || [],
          materialId: m.materialId || undefined,
          materialSettings: m.materialSettings || undefined, // Preserve from local store
          isVisible: m.isVisible !== false,
          zIndex: m.zIndex || 0
        }))
      ];
      
      console.log(`[JobsDrawer] Total masks (${dbMasks.length} from DB + ${unsavedLocalMasks.length} unsaved):`, {
        totalMasks: allMasks.length,
        maskIds: allMasks.map(m => m.id),
        maskDetails: allMasks.map(m => ({
          id: m.id,
          ptsCount: m.pts?.length || 0,
          isVisible: m.isVisible !== false,
          hasMaterialId: !!m.materialId,
          hasMaterialSettings: !!m.materialSettings,
          materialSettings: m.materialSettings ? {
            textureScale: m.materialSettings.textureScale,
            intensity: m.materialSettings.intensity,
            opacity: m.materialSettings.opacity
          } : null,
          source: dbMaskIds.has(m.id) ? 'database' : 'local'
        }))
      });
      
      // Filter masks: only include visible, valid masks with at least 3 points
      const masks = allMasks
        .filter(mask => {
          // Only include visible masks (isVisible defaults to true, so check !== false)
          if (mask.isVisible === false) {
            console.log(`[JobsDrawer] Skipping hidden mask: ${mask.id}`);
            return false;
          }
          // Only include masks with valid points
          if (!mask.pts || mask.pts.length < 3) {
            console.log(`[JobsDrawer] Skipping invalid mask: ${mask.id} (pts: ${mask.pts?.length || 0})`);
            return false;
          }
          return true;
        })
        .map(mask => ({
          id: mask.id,
          points: mask.pts.map(pt => ({
            x: pt.x,
            y: pt.y
            // Note: Server only needs x, y for cache key - not h1, h2, or kind
          })),
          materialId: mask.materialId || undefined,
          materialSettings: mask.materialSettings || undefined // CRITICAL: Include materialSettings in payload
        }));
      
      console.log(`[JobsDrawer] Extracted ${masks.length} masks for enhancement job:`, masks.map(m => ({
        id: m.id,
        pointsCount: m.points.length,
        materialId: m.materialId,
        hasMaterialSettings: !!m.materialSettings,
        materialSettings: m.materialSettings ? {
          textureScale: m.materialSettings.textureScale,
          intensity: m.materialSettings.intensity,
          opacity: m.materialSettings.opacity,
          fullKeys: Object.keys(m.materialSettings)
        } : null
      })));
      
      // CRITICAL: Log the actual payload being sent to verify materialSettings are included
      const payloadMasks = masks.map(mask => ({
        id: mask.id,
        points: mask.points.map(pt => ({ x: pt.x, y: pt.y })),
        materialId: mask.materialId || undefined,
        materialSettings: mask.materialSettings || undefined
      }));
      
      console.log(`[JobsDrawer] 🔍 FINAL PAYLOAD MASKS (being sent to API):`, JSON.stringify(payloadMasks, null, 2));
      
      // Check if masks are required for this mode
      const effectiveIndustry = user?.industryType || industry;
      const masksRequired = effectiveIndustry !== 'real_estate';
      
      if (masksRequired && masks.length === 0) {
        toast.error('Masks required', {
          description: 'Please create at least one mask before enhancing.',
        });
        setIsCreating(false);
        return;
      }

      // Validate prompt if provided
      if (showPromptInput && userPrompt) {
        if (userPrompt.length > 500) {
          setPromptError('Prompt must be under 500 characters');
          setIsCreating(false);
          return;
        }
        setPromptError(null);
      }
      
      // NEW: Export composite (background image + Konva masks) - what user sees
      // Use data URL for preview immediately, upload only on confirm
      let compositeDataURL: string | null = null;
      let compositeBlob: Blob | null = null; // Store blob for upload on confirm
      const konvaStageRef = currentState.konvaStageRef;
      
      if (konvaStageRef && currentImageUrl) {
        try {
          console.log('[JobsDrawer] Exporting composite (background + masks)...');
          const originalWidth = photoSpace.imgW || 2000;
          const originalHeight = photoSpace.imgH || 1500;
          
          // Get the WorldGroup node to temporarily reset camera transform
          // This ensures masks export at their true image coordinates (world space)
          // matching how the background image is drawn (no transforms)
          const worldGroup = konvaStageRef.findOne((node: any) => node.name() === 'world-group') as any;
          const originalTransform = worldGroup ? {
            x: worldGroup.x(),
            y: worldGroup.y(),
            scaleX: worldGroup.scaleX(),
            scaleY: worldGroup.scaleY()
          } : null;
          
          console.log('[JobsDrawer] Current camera transform:', originalTransform);
          
          try {
            // Temporarily reset camera transform to identity (scale=1, pan=0)
            // This ensures masks export in world space, matching the background
            if (worldGroup) {
              worldGroup.x(0);
              worldGroup.y(0);
              worldGroup.scaleX(1);
              worldGroup.scaleY(1);
              worldGroup.getLayer()?.batchDraw(); // Force redraw with new transform
              console.log('[JobsDrawer] Camera transform reset for export');
            }
            
            // Step 1: Export Konva stage (masks layer) as data URL at full image dimensions
            // Now the masks are in world space (no camera transform), matching the background
            const konvaDataURL = konvaStageRef.toDataURL({
              pixelRatio: 2, // High quality
              mimeType: 'image/png',
              width: originalWidth,
              height: originalHeight,
              x: 0,
              y: 0
            });
            
            console.log('[JobsDrawer] Konva stage exported, loading images...');
            
            // Step 2: Load both images in parallel (faster)
            const [bgImg, konvaImg] = await Promise.all([
              new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = currentImageUrl;
              }),
              new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = konvaDataURL;
              })
            ]);
            
            console.log('[JobsDrawer] Images loaded, compositing...');
            
            // Step 3: Composite both layers onto new canvas
            const compositeCanvas = document.createElement('canvas');
            compositeCanvas.width = originalWidth;
            compositeCanvas.height = originalHeight;
            const ctx = compositeCanvas.getContext('2d');
            
            if (!ctx) {
              throw new Error('Failed to get canvas context');
            }
            
            // Enable high-quality image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Draw background first (full size, no transforms)
            ctx.drawImage(bgImg, 0, 0, originalWidth, originalHeight);
            // Draw masks on top (now also in world space, no transforms)
            ctx.drawImage(konvaImg, 0, 0, originalWidth, originalHeight);
            
            console.log('[JobsDrawer] Composite created, generating data URL...');
            
            // Step 4: Generate data URL for immediate preview (no upload needed yet)
            compositeDataURL = compositeCanvas.toDataURL('image/png');
            
            // Also create blob for upload on confirm
            // Use JPEG with quality 0.85 to reduce file size and prevent 413 errors
            // JPEG is much smaller than PNG for photos while maintaining good quality
            compositeBlob = await new Promise<Blob>((resolve, reject) => {
              compositeCanvas.toBlob((blob) => {
                if (blob) {
                  console.log(`[JobsDrawer] Composite blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
                  resolve(blob);
                } else {
                  reject(new Error('Failed to convert canvas to blob'));
                }
              }, 'image/jpeg', 0.85); // JPEG with 85% quality for good compression
            });
            
            console.log('[JobsDrawer] ✅ Composite exported successfully (data URL ready for preview)');
          } finally {
            // ALWAYS restore the original camera transform, even if export fails
            // This ensures the UI never gets stuck with a reset transform
            if (worldGroup && originalTransform) {
              worldGroup.x(originalTransform.x);
              worldGroup.y(originalTransform.y);
              worldGroup.scaleX(originalTransform.scaleX);
              worldGroup.scaleY(originalTransform.scaleY);
              worldGroup.getLayer()?.batchDraw(); // Restore visual state immediately
              console.log('[JobsDrawer] Camera transform restored');
            }
          }
        } catch (exportError: any) {
          console.error('[JobsDrawer] ❌ Failed to export composite:', exportError);
          // Don't set compositeDataURL - will fall back to original image
        }
      }
      
      // Extract unique materials for preview
      const uniqueMaterials = Array.from(
        new Map(
          masks
            .filter(m => m.materialId)
            .map(m => [m.materialId, { id: m.materialId }])
        ).values()
      );

      // Show preview modal with data URL (immediate preview, no upload needed)
      // Upload will happen on confirm
      setPreviewData({
        compositeImageUrl: compositeDataURL || currentImageUrl, // Use data URL for preview
        compositeBlob: compositeBlob, // Store blob for upload on confirm
        maskCount: masks.length,
        materials: uniqueMaterials,
        imageDimensions: {
          width: photoSpace.imgW || 2000,
          height: photoSpace.imgH || 1500,
        },
        mode,
        payload: null, // Will be created on confirm with uploaded URL
        masks: masks, // Store masks for payload creation
        effectivePhotoId,
        currentImageUrl,
        photoSpace,
        jobContext: currentState.jobContext,
      });
      setShowPreview(true);
      setIsCreating(false); // Reset creating state since we're showing preview
    } catch (error: any) {
      console.error('Failed to prepare enhancement:', error);
      alert(`Failed: ${error.message}`);
      setIsCreating(false);
    }
  };

  const handleConfirmPreview = async () => {
    if (!previewData) return;
    
    setIsCreating(true);
    setShowPreview(false);
    
    try {
      // Upload composite blob on confirm (if available)
      let compositeImageUrl: string | null = null;
      if (previewData.compositeBlob) {
        try {
          const tempJobId = `temp-${Date.now()}`;
          const formData = new FormData();
          // Use .jpg extension since we're uploading JPEG format
          formData.append('composite', previewData.compositeBlob, 'composite.jpg');
          formData.append('jobId', tempJobId);
          
          const blobSizeMB = (previewData.compositeBlob.size / 1024 / 1024).toFixed(2);
          console.log(`[JobsDrawer] Uploading composite image (${blobSizeMB} MB)...`);
          
          console.log('[JobsDrawer] Uploading composite image on confirm...');
          const uploadRes = await fetch('/api/ai/enhancement/upload-composite', {
            method: 'POST',
            body: formData
          });
          
          if (uploadRes.ok) {
            const uploadResult = await uploadRes.json();
            compositeImageUrl = uploadResult.url;
            console.log('[JobsDrawer] ✅ Composite uploaded on confirm:', compositeImageUrl);
          } else {
            const errorText = await uploadRes.text();
            console.warn('[JobsDrawer] ⚠️ Upload failed on confirm:', errorText);
            // CRITICAL: Never use data URL in payload - it causes 413 errors
            // If upload fails, use original image URL and let server generate composite
            console.log('[JobsDrawer] Using original image URL - server will generate composite');
            compositeImageUrl = null; // Will fall back to original image
          }
        } catch (uploadError: any) {
          console.error('[JobsDrawer] ❌ Upload error on confirm:', uploadError);
          // CRITICAL: Never use data URL in payload - it causes 413 errors
          // If upload fails, use original image URL and let server generate composite
          console.log('[JobsDrawer] Using original image URL - server will generate composite');
          compositeImageUrl = null; // Will fall back to original image
        }
      } else {
        // No blob available, use original image (server will generate composite)
        compositeImageUrl = null;
      }
      
      // CRITICAL: Never include data URLs in payload - they cause 413 errors
      // Only include compositeImageUrl if we successfully uploaded it
      // If upload failed, omit it and let the server generate the composite from masks
      let finalCompositeImageUrl: string | undefined = undefined;
      
      if (compositeImageUrl) {
        // Verify we're not sending a data URL (safety check)
        if (compositeImageUrl.startsWith('data:')) {
          console.error('[JobsDrawer] ❌ ERROR: Upload returned data URL! This should not happen. Server will generate composite.');
          finalCompositeImageUrl = undefined; // Server will generate composite
        } else {
          // Only use successfully uploaded URLs (not data URLs, not original image URL)
          finalCompositeImageUrl = compositeImageUrl;
        }
      } else {
        // Upload failed or no blob - don't send compositeImageUrl, server will generate it from masks
        console.log('[JobsDrawer] No composite URL available - server will generate composite from masks');
        finalCompositeImageUrl = undefined; // Server will generate composite
      }
      
      // Map mode value to match n8n workflow expectations
      // Trades: 'blend_material' (singular), 'add_decoration', 'add_pool'
      // Real Estate: pass through as-is
      const effectiveIndustry = user?.industryType || industry;
      let n8nMode: string = previewData.mode;
      if (effectiveIndustry !== 'real_estate') {
        const modeMapping: Record<string, string> = {
          'blend_materials': 'blend_material',
          'add_decoration': 'add_decoration',
          'add_pool': 'add_pool'
        };
        n8nMode = modeMapping[previewData.mode] || 'add_decoration';
      }
      
      // Check if masks are required for this mode
      const effectiveIndustryForPayload = user?.industryType || industry;
      const masksRequiredForPayload = effectiveIndustryForPayload !== 'real_estate';
      
      // Create payload - mode must be at top level for n8n workflow routing
      const payload: any = {
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        photoId: previewData.effectivePhotoId,
        imageUrl: previewData.currentImageUrl, // Original image (for reference)
        inputHash: `enhancement-${Date.now()}`,
        masks: masksRequiredForPayload ? previewData.masks : [], // Only include if required
        mode: n8nMode, // Top-level mode field (required by n8n workflow for routing)
        options: {
          ...previewData.jobContext ? { jobId: previewData.jobContext.jobId } : {},
          userPrompt: showPromptInput && userPrompt ? userPrompt : undefined, // Include user prompt if provided
        },
        userPrompt: showPromptInput && userPrompt ? userPrompt : undefined, // Also at top level for API
        calibration: 1000,
        width: previewData.photoSpace.imgW || 2000,
        height: previewData.photoSpace.imgH || 1500,
        idempotencyKey: `enhancement-${Date.now()}`
      };
      
      // Only include compositeImageUrl if it's a successfully uploaded URL (never data URLs, never original image URL)
      if (finalCompositeImageUrl && !finalCompositeImageUrl.startsWith('data:')) {
        payload.compositeImageUrl = finalCompositeImageUrl;
      }

      // CRITICAL: Log the actual payload being sent to verify materialSettings are included
      // Note: Never log full data URLs as they can be huge
      const logPayload: any = {
        masksCount: payload.masks.length,
        masks: payload.masks.map(m => ({
          id: m.id,
          pointsCount: m.points.length,
          materialId: m.materialId,
          hasMaterialSettings: !!m.materialSettings,
          materialSettings: m.materialSettings
        })),
        imageUrl: payload.imageUrl.substring(0, 80) + '...',
        mode: payload.options.mode
      };
      
      if (payload.compositeImageUrl) {
        // Only log first 80 chars to avoid logging huge data URLs
        logPayload.compositeImageUrl = payload.compositeImageUrl.startsWith('data:') 
          ? 'data:image/... (data URL - should not be in payload!)'
          : payload.compositeImageUrl.substring(0, 80) + '...';
      } else {
        logPayload.compositeImageUrl = 'undefined (server will generate)';
      }
      
      console.log(`[JobsDrawer] 🔍 FULL PAYLOAD (with materialSettings):`, JSON.stringify(logPayload, null, 2));
      
      const { jobId } = await createJob(payload);
      
      // Update composite URL with actual jobId if needed (optional - temp ID works fine)
      if (previewData.compositeImageUrl && previewData.compositeImageUrl.includes('temp-')) {
        console.log('[JobsDrawer] Note: Composite URL uses temp jobId, but that\'s fine - URL is already uploaded');
      }
      // Store job with current timestamp (will be updated when API returns actual dates)
      const now = new Date().toISOString();
      upsertJob({ 
        id: jobId, 
        status: 'queued', 
        progress_percent: 0,
        mode: previewData.mode, // Store the enhancement type
        created_at: now,
        updated_at: now
      });
      setActiveJobId(jobId);
      
      toast.success('Enhancement job created', { 
        description: `Job ${jobId.slice(0, 8)}... is now queued` 
      });
      
      // Refresh job list to get actual dates from database
      // This will update the job with database timestamps, but our formatDate
      // function now handles timezone issues and invalid dates properly
      getRecentJobs(100).then(d => setInitial(d.jobs)).catch(() => {});
      
      // Refresh credit balance after enhancement
      loadCreditBalance();
    } catch (error: any) {
      console.error('Failed to create enhancement:', error);
      
      // Handle insufficient credits (402)
      if (error.status === 402 || error.statusCode === 402 || error.error === 'INSUFFICIENT_CREDITS') {
        const required = error.required || 0;
        const balance = error.balance || 0;
        toast.error('Insufficient Credits', {
          description: `You need ${required} credits but only have ${balance}. Please purchase more credits.`,
          action: {
            label: 'Purchase Credits',
            onClick: () => {
              setLocation('/billing');
            }
          },
          duration: 10000
        });
      } 
      // Handle usage limit exceeded (402)
      else if (error.code === 'USAGE_LIMIT_EXCEEDED' || error.details) {
        const details = error.details || {};
        toast.error('Usage Limit Exceeded', {
          description: `You've used ${details.used || 0} of ${details.limit || 0} enhancements. ${details.remaining || 0} remaining.`,
          action: details.upgradeRequired ? {
            label: 'Upgrade Plan',
            onClick: () => {
              // TODO: Navigate to billing/upgrade page
              window.location.href = '/settings/billing';
            }
          } : undefined,
          duration: 10000
        });
      } else {
        toast.error('Failed to create enhancement', { description: error.message });
      }
    } finally {
      setIsCreating(false);
      setPreviewData(null);
    }
  };

  const handleConfirmCreditDeduction = async () => {
    if (!pendingEnhancement) return;
    setShowCreditModal(false);
    await handleCreateEnhancement(pendingEnhancement.mode);
    setPendingEnhancement(null);
  };

  const handleCancelCreditDeduction = () => {
    setShowCreditModal(false);
    setPendingEnhancement(null);
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setPreviewData(null);
    setIsCreating(false);
  };
  
  // Helper function to format relative time
  const formatRelativeTime = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = Date.now();
    const diff = now - date.getTime();
    if (diff < 0) return 'Just now';
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };
  
  
  // Handle Apply to Canvas with preloading
  const handleApplyToCanvas = async (job: Job) => {
    if (!job || !onApplyEnhancedImage) return;
    
    // Get the first variant URL (or fallback)
    const enhancedImageUrl = job.variants && job.variants.length > 0 
      ? job.variants[0]?.url || null
      : null;
    
    if (!enhancedImageUrl) {
      toast.error('No enhanced image available', { description: 'The enhancement job has no variants yet.' });
      return;
    }
    
    // Count existing enhanced variants to generate label
    const currentState = useEditorStore.getState();
    const enhancedCount = currentState.variants.filter(v => v.id !== 'original').length;
    const label = `AI Enhanced ${enhancedCount + 1}`;
    
    // Preload image before applying
    const { preloadImage } = await import('../../lib/imagePreloader');
    const loadingToast = toast.loading('Loading enhanced image...', { description: 'Preparing image for canvas' });
    
    try {
      const result = await preloadImage(enhancedImageUrl, {
        maxRetries: 3,
        timeout: 30000
      });
      
      if (result.success && result.image) {
        toast.dismiss(loadingToast);
        onApplyEnhancedImage({
          imageUrl: enhancedImageUrl,
          label
        });
        toast.success('Applied to Canvas', { description: `${label} is now active on the canvas.` });
      } else {
        toast.dismiss(loadingToast);
        toast.error('Failed to load image', { 
          description: result.error?.message || 'Image failed to load after retries. Please try again.',
          action: {
            label: 'Retry',
            onClick: () => handleApplyToCanvas(job)
          }
        });
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to load image', { 
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        action: {
          label: 'Retry',
          onClick: () => handleApplyToCanvas(job)
        }
      });
    }
  };
  
  // Handle Re-run enhancement
  const handleRerunEnhancement = async (job: Job) => {
    if (!job || !job.mode) return;
    await handleCreateEnhancement(job.mode);
  };
  
  // Handle Retry failed job
  const handleRetryFailed = async (job: Job) => {
    if (!job || !job.mode) return;
    await handleCreateEnhancement(job.mode);
  };
  
  // Phase 3: Handler to navigate to variants tab and highlight specific variant
  const handleViewInVariants = (variantId: string) => {
    // Emit a custom event that NewEditor can listen to
    // This will switch to variants tab and scroll to/highlight the variant
    window.dispatchEvent(new CustomEvent('navigateToVariant', {
      detail: { variantId }
    }));
    
    toast.success('Opening variants tab', { 
      description: 'The variant will be highlighted in the sidebar.' 
    });
  };

  return (
    <aside className="fixed right-4 top-20 w-[480px] max-h-[85vh] overflow-hidden bg-white/95 backdrop-blur-sm shadow-lg rounded-xl border border-gray-100 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm rounded-t-xl z-10">
        <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <div className="font-semibold text-base text-gray-900">AI Enhancements</div>
        </div>
        <div className="flex items-center gap-2">
          {/* Select Mode Toggle */}
          <button
            onClick={toggleSelectMode}
            className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${isSelectMode ? 'bg-primary/5 text-primary' : 'text-gray-600'}`}
            title="Select mode"
          >
            {isSelectMode ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${showFilters ? 'bg-gray-100 text-gray-900' : 'text-gray-600'}`}
            title="Toggle filters (Ctrl+F)"
          >
            <Filter className="w-4 h-4" />
          </button>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        )}
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar />
      
      {/* Search and Filters */}
      <div className={`border-b border-gray-100 bg-gray-50/50 transition-all duration-200 ${showFilters ? 'max-h-96' : 'max-h-0'} overflow-hidden`}>
        <div className="px-6 py-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by job ID or date... (Ctrl+K)"
              value={debouncedSearchQuery}
              onChange={(e) => setDebouncedSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
          
          {/* Filter Chips */}
          <div className="space-y-3">
            {/* Status Filter */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Status</label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'completed', 'processing', 'failed'] as StatusFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
                      statusFilter === filter
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter === 'processing' ? 'Processing' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Type Filter */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Type</label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'add_pool', 'add_decoration', 'blend_materials'] as TypeFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTypeFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 flex items-center gap-1.5 ${
                      typeFilter === filter
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter === 'add_pool' ? (
                      <>
                        <Waves className="w-3.5 h-3.5" />
                        Pool
                      </>
                    ) : filter === 'add_decoration' ? (
                      <>
                        <SparklesIcon className="w-3.5 h-3.5" />
                        Decor
                      </>
                    ) : (
                      <>
                        <Palette className="w-3.5 h-3.5" />
                        Blend
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Group By */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Group By</label>
              <div className="flex flex-wrap gap-2">
                {(['none', 'date', 'status', 'type'] as GroupBy[]).map((group) => (
                  <button
                    key={group}
                    onClick={() => setGroupBy(group)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 flex items-center gap-1.5 ${
                      groupBy === group
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                    aria-label={`Group by ${group}`}
                  >
                    <Layers2 className="w-3.5 h-3.5" />
                    {group === 'none' ? 'None' : group === 'date' ? 'Date' : group === 'status' ? 'Status' : 'Type'}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Date Filter */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Date</label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'today', 'week', 'month'] as DateFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDateFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
                      dateFilter === filter
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {filter === 'all' ? 'All Time' : filter === 'week' ? 'This Week' : filter === 'month' ? 'This Month' : 'Today'}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Sort */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Sort By</label>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none transition-all"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="status">By Status</option>
                  <option value="progress">By Progress</option>
                </select>
                <ArrowUpDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create New Enhancement Form */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-900 mb-3 block">
              Select Enhancement Type
            </label>
            <div className={`grid gap-3 ${getValidModes().length === 3 ? 'grid-cols-3' : getValidModes().length === 4 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {getValidModes().map((mode) => {
                const Icon = getEnhancementTypeIcon(mode);
                const label = getEnhancementTypeLabel(mode);
                const descriptions: Record<string, string> = {
                  'add_pool': 'Add a realistic pool to your design',
                  'add_decoration': 'Add furniture and decor',
                  'blend_materials': 'Blend materials seamlessly',
                  'image_enhancement': 'Enhance image quality and colors',
                  'day_to_dusk': 'Transform day photos to dusk',
                  'stage_room': 'Add virtual furniture and staging',
                  'item_removal': 'Remove unwanted objects',
                };
                const colors: Record<string, string> = {
                  'add_pool': 'bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-blue-300 text-primary',
                  'add_decoration': 'bg-purple-50 border-purple-200 hover:bg-purple-100 hover:border-purple-300 text-purple-600',
                  'blend_materials': 'bg-green-50 border-green-200 hover:bg-green-100 hover:border-green-300 text-green-600',
                  'image_enhancement': 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300 text-blue-600',
                  'day_to_dusk': 'bg-orange-50 border-orange-200 hover:bg-orange-100 hover:border-orange-300 text-orange-600',
                  'stage_room': 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 text-indigo-600',
                  'item_removal': 'bg-red-50 border-red-200 hover:bg-red-100 hover:border-red-300 text-red-600',
                };
                return (
                  <button
                    key={mode}
                    onClick={() => handleCreateEnhancement(mode)}
                    disabled={isCreating}
                    className={`flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 hover:shadow-sm ${colors[mode] || 'bg-gray-50 border-gray-200'}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-sm text-gray-900">{label}</span>
                    <span className="text-xs text-gray-600 text-center leading-tight">{descriptions[mode] || ''}</span>
                  </button>
                );
              })}
            </div>
            
            {/* Prompt Input Toggle */}
            <div className="flex items-center justify-between mt-4">
              <Label htmlFor="show-prompt" className="flex items-center gap-2 cursor-pointer">
                <input
                  id="show-prompt"
                  type="checkbox"
                  checked={showPromptInput}
                  onChange={(e) => {
                    setShowPromptInput(e.target.checked);
                    if (!e.target.checked) {
                      setUserPrompt('');
                      setPromptError(null);
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm">Add custom prompt (Advanced)</span>
              </Label>
            </div>
            
            {/* Prompt Input */}
            {showPromptInput && (
              <div className="mt-4 space-y-2">
                <Label htmlFor="user-prompt">
                  Custom Prompt (Optional)
                  <span className="text-xs text-slate-500 ml-2">
                    Describe how you want to enhance the image
                  </span>
                </Label>
                <Textarea
                  id="user-prompt"
                  value={userPrompt}
                  onChange={(e) => {
                    const value = e.target.value;
                    setUserPrompt(value);
                    if (value.length > 500) {
                      setPromptError('Prompt must be under 500 characters');
                    } else {
                      setPromptError(null);
                    }
                  }}
                  placeholder="e.g., 'Make the sky more dramatic with warm sunset colors'"
                  maxLength={500}
                  rows={3}
                  className={promptError ? 'border-destructive' : ''}
                />
                <div className="flex items-center justify-between text-xs">
                  <span className={promptError ? 'text-destructive' : 'text-slate-500'}>
                    {userPrompt.length}/500 characters
                  </span>
                  {promptError && (
                    <span className="text-destructive">{promptError}</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Adding a prompt gives you more control over the enhancement result.
                </p>
              </div>
            )}
          </div>
          
          {isCreating && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Creating enhancement...</span>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Active Enhancement - Phase 2: Using JobCard */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white">
        {isLoading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ) : activeEnhancement ? (
          <JobCard
            job={activeEnhancement}
            isActive={true}
            onApply={onApplyEnhancedImage ? () => handleApplyToCanvas(activeEnhancement) : undefined}
            onViewInVariants={handleViewInVariants}
            onRerun={handleRerunEnhancement}
            onRetry={handleRetryFailed}
            getEnhancementTypeIcon={getEnhancementTypeIcon}
            getEnhancementTypeLabel={getEnhancementTypeLabel}
            formatRelativeTime={formatRelativeTime}
          />
        ) : (
          <div className="text-center py-6 text-sm text-gray-500">
            No active enhancement
          </div>
        )}
      </div>
      
      {/* Phase 1 & 2: Recently Completed Jobs Section */}
      {recentlyCompletedJobs.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-100 bg-white">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Just Completed</h3>
          <div className="space-y-3">
            {recentlyCompletedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isActive={false}
                onApply={onApplyEnhancedImage ? () => handleApplyToCanvas(job) : undefined}
                onViewInVariants={handleViewInVariants}
                onRerun={handleRerunEnhancement}
                getEnhancementTypeIcon={getEnhancementTypeIcon}
                getEnhancementTypeLabel={getEnhancementTypeLabel}
                formatRelativeTime={formatRelativeTime}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Section 3: History (Collapsible) - Phase 2: Using JobCard */}
      {historyJobs.length > 0 && (
        <div className="flex-1 overflow-auto px-6 py-4 border-t border-gray-100">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="w-full flex items-center justify-between py-2 text-sm font-semibold text-gray-900 hover:text-gray-700 transition-colors"
          >
            <span>Previous enhancements</span>
            {historyExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          
          {historyExpanded && (
            <div className="mt-3 space-y-3">
              {historyJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isActive={false}
                  onApply={onApplyEnhancedImage ? () => handleApplyToCanvas(job) : undefined}
                  onViewInVariants={handleViewInVariants}
                  onRerun={handleRerunEnhancement}
                  getEnhancementTypeIcon={getEnhancementTypeIcon}
                  getEnhancementTypeLabel={getEnhancementTypeLabel}
                  formatRelativeTime={formatRelativeTime}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewData && (
        <PreviewModal
          open={showPreview}
          onOpenChange={setShowPreview}
          compositeImageUrl={previewData.compositeImageUrl}
          maskCount={previewData.maskCount}
          materials={previewData.materials}
          imageDimensions={previewData.imageDimensions}
          mode={previewData.mode}
          userPrompt={userPrompt}
          showPromptInput={showPromptInput}
          onConfirm={handleConfirmPreview}
          onCancel={handleCancelPreview}
          loading={isCreating}
        />
      )}

      {/* Credit Deduction Modal */}
      {pendingEnhancement && creditBalance !== null && (
        <CreditDeductionModal
          open={showCreditModal}
          onOpenChange={setShowCreditModal}
          enhancementType={pendingEnhancement.mode}
          hasMask={pendingEnhancement.hasMask}
          currentBalance={creditBalance}
          onConfirm={handleConfirmCreditDeduction}
          onCancel={handleCancelCreditDeduction}
        />
      )}
    </aside>
  );
}

