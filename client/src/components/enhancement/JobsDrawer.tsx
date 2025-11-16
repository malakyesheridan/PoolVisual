// client/src/components/enhancement/JobsDrawer.tsx
import { useEffect, useState } from 'react';
import { X, Sparkles, Loader2, Waves, Sparkles as SparklesIcon, Search, Filter, ArrowUpDown } from 'lucide-react';
import { useEnhancementStore, type SortOption, type StatusFilter, type TypeFilter, type DateFilter } from '../../state/useEnhancementStore';
import { getRecentJobs, createJob } from '../../services/aiEnhancement';
import { useJobStream } from '../../hooks/useJobStream';
import { JobProgress } from './JobProgress';
import { useEditorStore } from '../../new_editor/store';
import { useMaskStore } from '../../maskcore/store';

interface JobsDrawerProps {
  onClose?: () => void;
}

export function JobsDrawer({ onClose }: JobsDrawerProps) {
  const { 
    setInitial, 
    upsertJob, 
    getFilteredAndSortedJobs,
    sortBy,
    statusFilter,
    typeFilter,
    dateFilter,
    searchQuery,
    setSortBy,
    setStatusFilter,
    setTypeFilter,
    setDateFilter,
    setSearchQuery
  } = useEnhancementStore();
  
  const [selectedMode, setSelectedMode] = useState<'add_pool' | 'add_decoration' | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  // Stream updates for the active job
  useJobStream(activeJobId);
  
  const filteredJobs = getFilteredAndSortedJobs();

  useEffect(() => {
    getRecentJobs(20).then(d => setInitial(d.jobs)).catch(() => {});
  }, [setInitial]);

  const handleCreateEnhancement = async (mode: 'add_pool' | 'add_decoration') => {
    const currentState = useEditorStore.getState();
    const currentImageUrl = currentState.imageUrl;
    const photoSpace = currentState.photoSpace;
    
    if (!currentImageUrl) {
      alert('Please load an image in the canvas first');
      return;
    }
    
    if (isCreating) return;
    
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
      
      // Also check local store for any unsaved masks (fallback)
      const maskStore = useMaskStore.getState();
      const localMasks = Object.values(maskStore.masks || {});
      console.log(`[JobsDrawer] Local store has ${localMasks.length} masks`);
      // Log materialSettings from local masks
      localMasks.forEach(m => {
        console.log(`[JobsDrawer] Local mask ${m.id}:`, {
          hasMaterialId: !!m.materialId,
          hasMaterialSettings: !!m.materialSettings,
          materialSettings: m.materialSettings ? {
            textureScale: m.materialSettings.textureScale,
            intensity: m.materialSettings.intensity,
            opacity: m.materialSettings.opacity
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
          
          // CRITICAL FIX: Extract materialSettings from calcMetaJson
          let materialSettings: any = undefined;
          if (m.calcMetaJson) {
            try {
              materialSettings = typeof m.calcMetaJson === 'string' 
                ? JSON.parse(m.calcMetaJson) 
                : m.calcMetaJson;
              console.log(`[JobsDrawer] Extracted materialSettings from calcMetaJson for mask ${m.id}:`, {
                hasTextureScale: !!materialSettings.textureScale,
                hasIntensity: !!materialSettings.intensity,
                textureScale: materialSettings.textureScale,
                intensity: materialSettings.intensity
              });
            } catch (e) {
              console.warn(`[JobsDrawer] Failed to parse calcMetaJson for mask ${m.id}:`, e);
            }
          } else {
            console.log(`[JobsDrawer] Mask ${m.id} has no calcMetaJson (no material settings)`);
          }
          
          return {
            id: m.id,
            pts: points,
            materialId: m.materialId || undefined,
            materialSettings: materialSettings, // Include materialSettings from database
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
      
      // NEW: Export composite (background image + Konva masks) - what user sees
      let compositeImageUrl: string | null = null;
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
            
            console.log('[JobsDrawer] Composite created, converting to blob...');
            
            // Step 4: Convert to blob and upload
            const blob = await new Promise<Blob>((resolve, reject) => {
              compositeCanvas.toBlob((blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error('Failed to convert canvas to blob'));
                }
              }, 'image/png');
            });
            
            const tempJobId = `temp-${Date.now()}`;
            const formData = new FormData();
            formData.append('composite', blob, 'composite.png');
            formData.append('jobId', tempJobId);
            
            console.log('[JobsDrawer] Uploading composite image to server...');
            const uploadRes = await fetch('/api/ai/enhancement/upload-composite', {
              method: 'POST',
              body: formData
            });
            
            if (!uploadRes.ok) {
              const errorText = await uploadRes.text();
              throw new Error(`Upload failed: ${uploadRes.status} ${errorText}`);
            }
            
            const uploadResult = await uploadRes.json();
            compositeImageUrl = uploadResult.url;
            
            console.log('[JobsDrawer] ✅ Composite image uploaded successfully:', compositeImageUrl);
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
          console.error('[JobsDrawer] ❌ Failed to export/upload composite:', exportError);
          // Fallback to original image URL - job will still be created
          compositeImageUrl = currentImageUrl;
          console.warn('[JobsDrawer] ⚠️ Using original image URL as fallback for compositeImageUrl');
        }
      } else {
        console.warn('[JobsDrawer] ⚠️ Konva stage or image URL not available, using original image URL');
        compositeImageUrl = currentImageUrl;
      }
      
      const payload = {
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        photoId: effectivePhotoId,
        imageUrl: currentImageUrl, // Original image (for reference)
        compositeImageUrl: compositeImageUrl, // ✅ Client-exported canvas (what user sees)
        inputHash: `enhancement-${Date.now()}`,
        masks: masks,
        options: {
          mode: mode, // Send mode to n8n workflow
          ...currentState.jobContext ? { jobId: currentState.jobContext.jobId } : {}
        },
        calibration: 1000,
        width: photoSpace.imgW || 2000,
        height: photoSpace.imgH || 1500,
        idempotencyKey: `enhancement-${Date.now()}`
      };

      // CRITICAL: Log full payload with materialSettings to verify they're included
      console.log(`[JobsDrawer] 🔍 FULL PAYLOAD (with materialSettings):`, JSON.stringify({
        masksCount: payload.masks.length,
        masks: payload.masks.map(m => ({
          id: m.id,
          pointsCount: m.points.length,
          materialId: m.materialId,
          hasMaterialSettings: !!m.materialSettings,
          materialSettings: m.materialSettings
        })),
        imageUrl: payload.imageUrl.substring(0, 80) + '...',
        compositeImageUrl: payload.compositeImageUrl?.substring(0, 80) + '...',
        mode: payload.options.mode
      }, null, 2));

      const { jobId } = await createJob(payload);
      
      // Update composite URL with actual jobId if needed (optional - temp ID works fine)
      if (compositeImageUrl && compositeImageUrl.includes('temp-')) {
        console.log('[JobsDrawer] Note: Composite URL uses temp jobId, but that\'s fine - URL is already uploaded');
      }
      upsertJob({ 
        id: jobId, 
        status: 'queued', 
        progress_percent: 0,
        mode: mode, // Store the enhancement type
        created_at: new Date().toISOString()
      });
      setActiveJobId(jobId);
      setSelectedMode(null); // Reset selection after creation
      
      // Refresh job list
      getRecentJobs(20).then(d => setInitial(d.jobs)).catch(() => {});
    } catch (error: any) {
      console.error('Failed to create enhancement:', error);
      alert(`Failed: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <aside className="fixed right-4 top-20 w-[480px] max-h-[85vh] overflow-hidden bg-white shadow-2xl rounded-xl border z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-xl z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <div className="font-semibold text-base">AI Enhancements</div>
          {filteredJobs.length > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {filteredJobs.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${showFilters ? 'bg-gray-100' : ''}`}
            title="Toggle filters"
          >
            <Filter className="w-4 h-4 text-gray-600" />
          </button>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        )}
        </div>
      </div>
      
      {/* Search and Filters */}
      <div className={`border-b bg-gray-50 transition-all duration-200 ${showFilters ? 'max-h-96' : 'max-h-0'} overflow-hidden`}>
        <div className="p-3 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by job ID or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Filter Chips */}
          <div className="space-y-2">
            {/* Status Filter */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'completed', 'processing', 'failed'] as StatusFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      statusFilter === filter
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter === 'processing' ? 'Processing' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Type Filter */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'add_pool', 'add_decoration'] as TypeFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTypeFilter(filter)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${
                      typeFilter === filter
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter === 'add_pool' ? (
                      <>
                        <Waves className="w-3 h-3" />
                        Pool
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="w-3 h-3" />
                        Decor
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Date Filter */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">Date</label>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'today', 'week', 'month'] as DateFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDateFilter(filter)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      dateFilter === filter
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {filter === 'all' ? 'All Time' : filter === 'week' ? 'This Week' : filter === 'month' ? 'This Month' : 'Today'}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Sort */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">Sort By</label>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
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
      <div className="p-4 border-b bg-gray-50">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">
              Select Enhancement Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleCreateEnhancement('add_pool')}
                disabled={isCreating}
                className="flex flex-col items-center justify-center gap-2 px-4 py-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg hover:bg-gradient-to-br hover:from-blue-100 hover:to-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-md"
              >
                <Waves className="w-6 h-6 text-blue-600" />
                <span className="font-semibold text-sm text-gray-800">Add Pool</span>
                <span className="text-xs text-gray-600 text-center">Add a realistic pool to your design</span>
              </button>
              
              <button
                onClick={() => handleCreateEnhancement('add_decoration')}
                disabled={isCreating}
                className="flex flex-col items-center justify-center gap-2 px-4 py-6 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-lg hover:bg-gradient-to-br hover:from-purple-100 hover:to-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-md"
              >
                <SparklesIcon className="w-6 h-6 text-purple-600" />
                <span className="font-semibold text-sm text-gray-800">Add Decoration</span>
                <span className="text-xs text-gray-600 text-center">Add furniture and decor elements</span>
              </button>
            </div>
          </div>
          
          {isCreating && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating enhancement...
            </div>
          )}
        </div>
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-12">
            {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || dateFilter !== 'all' ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">No jobs found</h3>
                <p className="text-xs text-gray-500 mb-4">Try adjusting your filters or search</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setTypeFilter('all');
                    setDateFilter('all');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Clear all filters
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">No enhancements yet</h3>
                <p className="text-xs text-gray-500">Create your first one above!</p>
              </>
            )}
          </div>
        ) : (
          filteredJobs.map(job => <JobProgress key={job.id} jobId={job.id} />)
        )}
      </div>
    </aside>
  );
}

