// client/src/components/enhancement/JobProgress.tsx
import { Download, RefreshCw, Eye, XCircle, CheckCircle, Clock, Loader2, Trash2, Waves, Sparkles, Palette, X, ChevronDown, ChevronUp, Copy, ExternalLink, Layers } from 'lucide-react';
import { useEnhancementStore } from '../../state/useEnhancementStore';
import { cancelJob, createJob, getJob } from '../../services/aiEnhancement';
import { useState, memo } from 'react';
import { toast } from '../../lib/toast';
import { VariantComparisonModal } from './VariantComparisonModal';
import { useEditorStore } from '../../new_editor/store';

function JobProgressComponent({ jobId }: { jobId: string }) {
  const job = useEnhancementStore(s => s.jobs[jobId]);
  const deleteJob = useEnhancementStore(s => s.deleteJob);
  const upsertJob = useEnhancementStore(s => s.upsertJob);
  const isSelectMode = useEnhancementStore(s => s.isSelectMode);
  const selectedJobs = useEnhancementStore(s => s.selectedJobs);
  const toggleJobSelection = useEnhancementStore(s => s.toggleJobSelection);
  const isSelected = selectedJobs.includes(jobId);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [jobDetails, setJobDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [errorExpanded, setErrorExpanded] = useState(false);
  const [copiedError, setCopiedError] = useState(false);
  const [showVariantComparison, setShowVariantComparison] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const currentState = useEditorStore.getState();
  const originalImageUrl = currentState.imageUrl || '';
  
  if (!job) return null;

  // Error categorization
  const categorizeError = (error: string, code?: string): 'network' | 'timeout' | 'validation' | 'provider' | 'unknown' => {
    if (!error) return 'unknown';
    const errorLower = error.toLowerCase();
    if (errorLower.includes('timeout') || errorLower.includes('timed out')) return 'timeout';
    if (errorLower.includes('network') || errorLower.includes('fetch') || errorLower.includes('connection')) return 'network';
    if (code?.startsWith('VALIDATION_') || errorLower.includes('invalid') || errorLower.includes('validation')) return 'validation';
    if (code?.startsWith('PROVIDER_') || errorLower.includes('provider') || errorLower.includes('service')) return 'provider';
    return 'unknown';
  };

  const getErrorSuggestions = (category: 'network' | 'timeout' | 'validation' | 'provider' | 'unknown'): string[] => {
    const suggestions = {
      network: ['Check your internet connection', 'Try again in a moment'],
      timeout: ['The enhancement took too long', 'Try again or contact support'],
      validation: ['Check your image and masks', 'Ensure all required fields are filled'],
      provider: ['The AI service encountered an error', 'Please retry'],
      unknown: ['An unexpected error occurred', 'Please contact support']
    };
    return suggestions[category];
  };

  const sanitizeError = (error: string): string => {
    // Escape HTML to prevent XSS
    const div = document.createElement('div');
    div.textContent = error;
    return div.innerHTML;
  };

  const handleCopyError = async () => {
    if (!job.error_message) return;
    try {
      await navigator.clipboard.writeText(job.error_message);
      setCopiedError(true);
      setTimeout(() => setCopiedError(false), 2000);
    } catch (error) {
      console.error('[JobProgress] Failed to copy error:', error);
    }
  };

  const pct = job.progress_percent ?? 0;
  const status = job.status ?? 'queued';
  const isProcessing = ['queued', 'downloading', 'preprocessing', 'rendering', 'postprocessing', 'uploading'].includes(status);

  const statusConfig = {
    queued: { label: 'Queued', color: 'bg-gray-500', icon: Clock, textColor: 'text-gray-700' },
    downloading: { label: 'Downloading', color: 'bg-blue-500', icon: Clock, textColor: 'text-blue-700' },
    preprocessing: { label: 'Preprocessing', color: 'bg-blue-500', icon: Clock, textColor: 'text-blue-700' },
    rendering: { label: 'Rendering', color: 'bg-blue-500', icon: Clock, textColor: 'text-blue-700' },
    postprocessing: { label: 'Postprocessing', color: 'bg-blue-500', icon: Clock, textColor: 'text-blue-700' },
    uploading: { label: 'Uploading', color: 'bg-blue-500', icon: Clock, textColor: 'text-blue-700' },
    completed: { label: 'Completed', color: 'bg-green-500', icon: CheckCircle, textColor: 'text-green-700' },
    failed: { label: 'Failed', color: 'bg-red-500', icon: XCircle, textColor: 'text-red-700' },
    canceled: { label: 'Canceled', color: 'bg-gray-500', icon: XCircle, textColor: 'text-gray-700' },
  };

  const config = statusConfig[status] || statusConfig.queued;
  const StatusIcon = config.icon;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    
    // Parse the date string
    const date = new Date(dateString);
    
    // Validate the date is valid
    if (isNaN(date.getTime())) {
      console.warn('[JobProgress] Invalid date string:', dateString);
      return 'Invalid date';
    }
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Handle future dates (timezone issues or clock skew)
    if (diff < 0) {
      // If date is in the future, treat it as "just now"
      return 'Just now';
    }
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this enhancement job?')) return;
    setIsDeleting(true);
    try {
      deleteJob(jobId);
      toast.success('Job deleted', { description: `Job ${jobId.slice(0, 8)}... has been removed` });
    } catch (error: any) {
      toast.error('Failed to delete job', { description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `enhancement-${jobId.slice(0, 8)}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleView = (url: string) => {
    window.open(url, '_blank');
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this enhancement job?')) return;
    setIsCanceling(true);
    try {
      await cancelJob(jobId);
      // Update local state optimistically
      upsertJob({ id: jobId, status: 'canceled' });
      toast.success('Job canceled', { description: `Job ${jobId.slice(0, 8)}... has been canceled` });
    } catch (error: any) {
      toast.error('Failed to cancel job', { description: error.message });
    } finally {
      setIsCanceling(false);
    }
  };

  const handleToggleExpand = async () => {
    if (!expanded) {
      // Fetch full job details when expanding
      setLoadingDetails(true);
      try {
        const details = await getJob(jobId);
        setJobDetails(details);
      } catch (error) {
        console.error('[JobProgress] Failed to fetch job details:', error);
      } finally {
        setLoadingDetails(false);
      }
    }
    setExpanded(!expanded);
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(jobId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (error) {
      console.error('[JobProgress] Failed to copy job ID:', error);
    }
  };

  const handleRetry = async () => {
    if (!job) return;
    setIsRetrying(true);
    try {
      // Use the job from store (already has mode)
      const jobMode = job.mode || 'add_decoration';
      
      // Get current editor state to create new job
      const { useEditorStore } = await import('../../new_editor/store');
      const currentState = useEditorStore.getState();
      const currentImageUrl = currentState.imageUrl;
      const photoSpace = currentState.photoSpace;
      const effectivePhotoId = currentState.jobContext?.photoId || '134468b9-648e-4eb1-8434-d7941289fccf';
      
      if (!currentImageUrl) {
        alert('Please load an image in the canvas first');
        return;
      }

      // Load masks from database
      const { apiClient } = await import('../../lib/api-client');
      const dbMasks = await apiClient.getMasks(effectivePhotoId);
      
      // Prepare masks with materialSettings
      const masks = dbMasks.map(m => {
        let materialSettings = null;
        if (m.calcMetaJson) {
          try {
            materialSettings = typeof m.calcMetaJson === 'string' 
              ? JSON.parse(m.calcMetaJson) 
              : m.calcMetaJson;
          } catch (e) {
            console.warn('[JobProgress] Failed to parse calcMetaJson for mask', m.id);
          }
        }
        
        return {
          id: m.id,
          points: typeof m.pathJson === 'string' ? JSON.parse(m.pathJson) : m.pathJson,
          materialId: m.materialId,
          materialSettings
        };
      });

      if (masks.length === 0) {
        alert('No masks found. Please draw masks before retrying.');
        return;
      }

      // Export composite (reuse logic from JobsDrawer)
      let compositeImageUrl: string | null = null;
      const konvaStageRef = currentState.konvaStageRef;

      if (konvaStageRef && currentImageUrl) {
        try {
          const originalWidth = photoSpace.imgW || 2000;
          const originalHeight = photoSpace.imgH || 1500;
          
          const worldGroup = konvaStageRef.findOne((node: any) => node.name() === 'world-group') as any;
          const originalTransform = worldGroup ? {
            x: worldGroup.x(),
            y: worldGroup.y(),
            scaleX: worldGroup.scaleX(),
            scaleY: worldGroup.scaleY()
          } : null;
          
          try {
            if (worldGroup) {
              worldGroup.x(0);
              worldGroup.y(0);
              worldGroup.scaleX(1);
              worldGroup.scaleY(1);
              worldGroup.getLayer()?.batchDraw();
            }
            
            const konvaDataURL = konvaStageRef.toDataURL({
              pixelRatio: 2,
              mimeType: 'image/png',
              width: originalWidth,
              height: originalHeight,
              x: 0,
              y: 0
            });
            
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
            
            const compositeCanvas = document.createElement('canvas');
            compositeCanvas.width = originalWidth;
            compositeCanvas.height = originalHeight;
            const ctx = compositeCanvas.getContext('2d');
            
            if (!ctx) throw new Error('Failed to get canvas context');
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bgImg, 0, 0, originalWidth, originalHeight);
            ctx.drawImage(konvaImg, 0, 0, originalWidth, originalHeight);
            
            const blob = await new Promise<Blob>((resolve, reject) => {
              compositeCanvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to convert canvas to blob'));
              }, 'image/png');
            });
            
            const tempJobId = `temp-${Date.now()}`;
            const formData = new FormData();
            formData.append('composite', blob, 'composite.png');
            formData.append('jobId', tempJobId);
            
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
          } finally {
            if (worldGroup && originalTransform) {
              worldGroup.x(originalTransform.x);
              worldGroup.y(originalTransform.y);
              worldGroup.scaleX(originalTransform.scaleX);
              worldGroup.scaleY(originalTransform.scaleY);
              worldGroup.getLayer()?.batchDraw();
            }
          }
        } catch (exportError: any) {
          console.error('[JobProgress] Failed to export composite:', exportError);
          compositeImageUrl = currentImageUrl;
        }
      } else {
        compositeImageUrl = currentImageUrl;
      }

      // Create new job with same mode
      const payload = {
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        photoId: effectivePhotoId,
        imageUrl: currentImageUrl,
        compositeImageUrl: compositeImageUrl,
        inputHash: `enhancement-retry-${Date.now()}`,
        masks: masks,
        options: {
          mode: jobMode,
        },
        calibration: 1000,
        width: photoSpace.imgW || 2000,
        height: photoSpace.imgH || 1500,
        idempotencyKey: `enhancement-retry-${jobId}-${Date.now()}`
      };

      const { jobId: newJobId } = await createJob(payload);
      
      // The new job will be added via the stream/refresh
      toast.success('Retry job created', { description: `New job ${newJobId.slice(0, 8)}... is now queued` });
    } catch (error: any) {
      console.error('[JobProgress] Retry failed:', error);
      toast.error('Failed to retry job', { description: error.message });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDuplicate = async () => {
    if (!job) return;
    setIsDuplicating(true);
    try {
      const jobMode = job.mode || 'add_decoration';
      const currentState = useEditorStore.getState();
      const currentImageUrl = currentState.imageUrl;
      const photoSpace = currentState.photoSpace;
      const effectivePhotoId = currentState.jobContext?.photoId || '134468b9-648e-4eb1-8434-d7941289fccf';
      
      if (!currentImageUrl) {
        toast.error('Please load an image in the canvas first');
        return;
      }

      const { apiClient } = await import('../../lib/api-client');
      const dbMasks = await apiClient.getMasks(effectivePhotoId);
      
      const masks = dbMasks.map(m => {
        let materialSettings = null;
        if (m.calcMetaJson) {
          try {
            materialSettings = typeof m.calcMetaJson === 'string' 
              ? JSON.parse(m.calcMetaJson) 
              : m.calcMetaJson;
          } catch (e) {
            console.warn('[JobProgress] Failed to parse calcMetaJson for mask', m.id);
          }
        }
        
        return {
          id: m.id,
          points: typeof m.pathJson === 'string' ? JSON.parse(m.pathJson) : m.pathJson,
          materialId: m.materialId,
          materialSettings
        };
      });

      if (masks.length === 0) {
        toast.error('No masks found. Please draw masks before duplicating.');
        return;
      }

      // Export composite
      let compositeImageUrl: string | null = null;
      const konvaStageRef = currentState.konvaStageRef;
      if (konvaStageRef && currentImageUrl) {
        try {
          const originalWidth = photoSpace.imgW || 2000;
          const originalHeight = photoSpace.imgH || 1500;
          const worldGroup = konvaStageRef.findOne((node: any) => node.name() === 'world-group') as any;
          const originalTransform = worldGroup ? {
            x: worldGroup.x(),
            y: worldGroup.y(),
            scaleX: worldGroup.scaleX(),
            scaleY: worldGroup.scaleY()
          } : null;
          
          try {
            if (worldGroup) {
              worldGroup.x(0);
              worldGroup.y(0);
              worldGroup.scaleX(1);
              worldGroup.scaleY(1);
              worldGroup.getLayer()?.batchDraw();
            }
            
            const konvaDataURL = konvaStageRef.toDataURL({
              pixelRatio: 2,
              mimeType: 'image/png',
              width: originalWidth,
              height: originalHeight,
              x: 0,
              y: 0
            });
            
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
            
            const compositeCanvas = document.createElement('canvas');
            compositeCanvas.width = originalWidth;
            compositeCanvas.height = originalHeight;
            const ctx = compositeCanvas.getContext('2d');
            
            if (!ctx) throw new Error('Failed to get canvas context');
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bgImg, 0, 0, originalWidth, originalHeight);
            ctx.drawImage(konvaImg, 0, 0, originalWidth, originalHeight);
            
            const blob = await new Promise<Blob>((resolve, reject) => {
              compositeCanvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to convert canvas to blob'));
              }, 'image/png');
            });
            
            const tempJobId = `temp-${Date.now()}`;
            const formData = new FormData();
            formData.append('composite', blob, 'composite.png');
            formData.append('jobId', tempJobId);
            
            const uploadRes = await fetch('/api/ai/enhancement/upload-composite', {
              method: 'POST',
              body: formData
            });
            
            if (uploadRes.ok) {
              const uploadResult = await uploadRes.json();
              compositeImageUrl = uploadResult.url;
            }
          } finally {
            if (worldGroup && originalTransform) {
              worldGroup.x(originalTransform.x);
              worldGroup.y(originalTransform.y);
              worldGroup.scaleX(originalTransform.scaleX);
              worldGroup.scaleY(originalTransform.scaleY);
              worldGroup.getLayer()?.batchDraw();
            }
          }
        } catch (exportError: any) {
          console.error('[JobProgress] Failed to export composite:', exportError);
          compositeImageUrl = currentImageUrl;
        }
      } else {
        compositeImageUrl = currentImageUrl;
      }

      const payload = {
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        photoId: effectivePhotoId,
        imageUrl: currentImageUrl,
        compositeImageUrl: compositeImageUrl,
        inputHash: `enhancement-duplicate-${Date.now()}`,
        masks: masks,
        options: {
          mode: jobMode,
        },
        calibration: 1000,
        width: photoSpace.imgW || 2000,
        height: photoSpace.imgH || 1500,
        idempotencyKey: `enhancement-duplicate-${jobId}-${Date.now()}`
      };

      const { jobId: newJobId } = await createJob(payload);
      toast.success('Job duplicated', { description: `New job ${newJobId.slice(0, 8)}... created` });
    } catch (error: any) {
      console.error('[JobProgress] Duplicate failed:', error);
      toast.error('Failed to duplicate job', { description: error.message });
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Status Header */}
      <div className={`flex items-center justify-between p-3 bg-gray-50 border-b ${isSelected ? 'bg-blue-50 border-blue-200' : ''}`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Selection Checkbox */}
          {isSelectMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleJobSelection(jobId)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
              aria-label={`Select job ${jobId.slice(0, 8)}`}
            />
          )}
          {/* Expand/Collapse Button */}
          {!isSelectMode && (
            <button
              onClick={handleToggleExpand}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title={expanded ? 'Collapse details' : 'Expand details'}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
          {/* Loading Spinner for Processing States */}
          {isProcessing ? (
            <Loader2 className={`w-4 h-4 ${config.textColor} animate-spin flex-shrink-0`} />
          ) : (
            <StatusIcon className={`w-4 h-4 ${config.textColor} flex-shrink-0`} />
          )}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className={`text-sm font-medium ${config.textColor} truncate`}>
            {config.label}
          </span>
          {pct > 0 && pct < 100 && (
              <span className="text-xs text-gray-500 whitespace-nowrap">({pct}%)</span>
            )}
          </div>
          {/* Enhancement Type Badge */}
          {job.mode && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-gray-300 text-xs">
              {job.mode === 'add_pool' ? (
                <>
                  <Waves className="w-3 h-3 text-blue-600" />
                  <span className="text-gray-700">Pool</span>
                </>
              ) : job.mode === 'add_decoration' ? (
                <>
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  <span className="text-gray-700">Decor</span>
                </>
              ) : (
                <>
                  <Palette className="w-3 h-3 text-green-600" />
                  <span className="text-gray-700">Blend</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2">
        {status === 'completed' && job.variants?.length && (
            <div className="text-xs text-gray-500 whitespace-nowrap">
            {job.variants.length} variant{job.variants.length !== 1 ? 's' : ''}
          </div>
        )}
          {/* Cancel Button for Processing Jobs */}
          {isProcessing && (
            <button
              onClick={handleCancel}
              disabled={isCanceling}
              className="p-1 text-gray-400 hover:text-orange-600 transition-colors disabled:opacity-50"
              title="Cancel job"
              aria-label="Cancel job"
            >
              {isCanceling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
            </button>
          )}
          {/* Duplicate Button */}
          {(status === 'completed' || status === 'failed' || status === 'canceled') && (
            <button
              onClick={handleDuplicate}
              disabled={isDuplicating}
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
              title="Duplicate job"
              aria-label="Duplicate job"
            >
              {isDuplicating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          )}
          {/* Delete Button */}
          {(status === 'completed' || status === 'failed' || status === 'canceled') && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
              title="Delete job"
              aria-label="Delete job"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Timestamp */}
      {(job.created_at || job.updated_at) && (
        <div className="px-3 py-1.5 bg-gray-50/50 border-b text-xs text-gray-500">
          {job.created_at && (
            <span>Created {formatDate(job.created_at)}</span>
          )}
          {job.updated_at && job.updated_at !== job.created_at && (
            <span className="ml-2">• Updated {formatDate(job.updated_at)}</span>
          )}
        </div>
      )}

      {/* Progress Bar with Circular Indicator */}
      {(status !== 'completed' && status !== 'failed' && status !== 'canceled') && (
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-3">
            {/* Circular Progress Indicator */}
            <div className="relative w-12 h-12 flex-shrink-0">
              <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke={
                    config.color === 'bg-blue-500' ? '#3b82f6' :
                    config.color === 'bg-gray-500' ? '#6b7280' :
                    config.color === 'bg-green-500' ? '#10b981' :
                    config.color === 'bg-red-500' ? '#ef4444' :
                    '#3b82f6'
                  }
                  strokeWidth="3"
                  strokeDasharray={`${(pct / 100) * 100.53}, 100.53`}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-gray-700">{Math.round(pct)}%</span>
              </div>
            </div>
            {/* Linear Progress Bar */}
            <div className="flex-1">
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${config.color} rounded-full transition-all duration-300`}
                  style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                />
              </div>
              {/* Loading message for processing states */}
              {isProcessing && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Please allow up to 2 minutes for your enhancement</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Error Message */}
      {job.error_message && (
        <div className="px-3 py-2 bg-red-50 border-l-4 border-red-400">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span className="text-xs font-medium text-red-800">
                  {categorizeError(job.error_message, job.error_code) === 'network' ? 'Network Error' :
                   categorizeError(job.error_message, job.error_code) === 'timeout' ? 'Timeout Error' :
                   categorizeError(job.error_message, job.error_code) === 'validation' ? 'Validation Error' :
                   categorizeError(job.error_message, job.error_code) === 'provider' ? 'Service Error' :
                   'Error'}
                </span>
                {job.error_code && (
                  <span className="text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                    {job.error_code}
                  </span>
                )}
              </div>
              <div className="text-xs text-red-700 mb-2">
                {errorExpanded ? (
                  <div className="whitespace-pre-wrap break-words">{job.error_message}</div>
                ) : (
                  <div className="truncate">{job.error_message}</div>
                )}
              </div>
              {!errorExpanded && job.error_message.length > 50 && (
                <button
                  onClick={() => setErrorExpanded(true)}
                  className="text-xs text-red-600 hover:text-red-700 underline"
                >
                  Show full error
                </button>
              )}
              {errorExpanded && (
                <div className="mt-2 space-y-2">
                  <div className="text-xs text-red-600">
                    <strong>Suggested actions:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {getErrorSuggestions(categorizeError(job.error_message, job.error_code)).map((suggestion, idx) => (
                        <li key={idx}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyError}
                      className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedError ? 'Copied!' : 'Copy error'}
                    </button>
                    <button
                      onClick={() => setErrorExpanded(false)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Show less
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Variants/Results */}
      {status === 'completed' && job.variants && job.variants.length > 0 && (
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-700">
              {job.variants.length} variant{job.variants.length !== 1 ? 's' : ''}
            </div>
            <button
              onClick={() => setShowVariantComparison(true)}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors flex items-center gap-1.5"
              title="Compare variants"
            >
              <Layers className="w-3 h-3" />
              Compare
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {job.variants.map((v, idx) => (
              <div key={v.id || idx} className="relative group">
                <img 
                  src={v.url} 
                  alt={`Variant ${idx + 1}`} 
                  className="w-full rounded-lg border-2 border-gray-200 object-cover aspect-square hover:border-blue-400 transition-colors"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => handleView(v.url)}
                    className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-transform hover:scale-110"
                    title="View full size"
                  >
                    <Eye className="w-4 h-4 text-gray-700" />
                  </button>
                  <button
                    onClick={() => handleDownload(v.url)}
                    className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-transform hover:scale-110"
                    title="Download"
                  >
                    <Download className="w-4 h-4 text-gray-700" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variant Comparison Modal */}
      {status === 'completed' && job.variants && job.variants.length > 0 && (
        <VariantComparisonModal
          open={showVariantComparison}
          onOpenChange={setShowVariantComparison}
          originalImageUrl={originalImageUrl}
          variants={job.variants}
          jobId={jobId}
        />
      )}

      {/* Actions for failed jobs */}
      {status === 'failed' && (
        <div className="p-3 border-t bg-gray-50 flex items-center justify-between">
          <button 
            onClick={handleRetry}
            disabled={isRetrying}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRetrying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
          {job.error_message && (
            <span className="text-xs text-gray-500 truncate max-w-[200px]" title={job.error_message}>
              {job.error_message}
            </span>
          )}
        </div>
      )}

      {/* Expandable Details Section */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {expanded && (
          <div className="p-4 border-t bg-gray-50 space-y-4">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* Job ID */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-600">Job ID</label>
                    <button
                      onClick={handleCopyId}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedId ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="text-xs font-mono text-gray-900 bg-white px-2 py-1 rounded border border-gray-300 break-all">
                    {jobId}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-4">
                  {job.created_at && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Created</label>
                      <div className="text-xs text-gray-900">
                        {new Date(job.created_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {job.updated_at && job.updated_at !== job.created_at && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Updated</label>
                      <div className="text-xs text-gray-900">
                        {new Date(job.updated_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {job.completed_at && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Completed</label>
                      <div className="text-xs text-gray-900">
                        {new Date(job.completed_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Job Details from API */}
                {jobDetails && (
                  <>
                    {/* Image URLs */}
                    {(jobDetails.imageUrl || jobDetails.compositeImageUrl) && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600">Image URLs</label>
                        <div className="space-y-1">
                          {jobDetails.imageUrl && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 flex-shrink-0">Original:</span>
                              <a
                                href={jobDetails.imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-700 truncate flex items-center gap-1"
                              >
                                <span className="truncate">{jobDetails.imageUrl.substring(0, 60)}...</span>
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              </a>
                            </div>
                          )}
                          {jobDetails.compositeImageUrl && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 flex-shrink-0">Composite:</span>
                              <a
                                href={jobDetails.compositeImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-700 truncate flex items-center gap-1"
                              >
                                <span className="truncate">{jobDetails.compositeImageUrl.substring(0, 60)}...</span>
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Options/Configuration */}
                    {jobDetails.options && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600">Configuration</label>
                        <pre className="text-xs bg-white px-2 py-1 rounded border border-gray-300 overflow-auto max-h-32">
                          {JSON.stringify(jobDetails.options, null, 2)}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
// Note: Removed custom comparator - component subscribes to store changes via useEnhancementStore,
// so it will re-render when job data changes even if jobId prop stays the same.
// React's default shallow comparison will handle prop changes correctly.
export const JobProgress = memo(JobProgressComponent);

