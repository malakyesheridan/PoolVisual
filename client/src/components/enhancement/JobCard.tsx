// JobCard component for displaying enhancement jobs with thumbnails and actions
import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  Eye, 
  ExternalLink,
  Sparkles,
  RefreshCw,
  X,
  Trash2
} from 'lucide-react';
import { Job, cancelJob } from '../../services/aiEnhancement';
import { useEditorStore } from '../../new_editor/store';
import { useEnhancementStore } from '../../state/useEnhancementStore';
import { toast } from '../../lib/toast';

interface JobCardProps {
  job: Job;
  isActive?: boolean;
  onApply?: (job: Job) => void;
  onViewInVariants?: (variantId: string) => void;
  onRerun?: (job: Job) => void;
  onRetry?: (job: Job) => void;
  onCancel?: (job: Job) => void;
  onDelete?: (job: Job) => void;
  getEnhancementTypeIcon: (mode?: string) => React.ComponentType<any>;
  getEnhancementTypeLabel: (mode?: string) => string;
  formatRelativeTime: (dateString?: string) => string;
}

export function JobCard({
  job,
  isActive = false,
  onApply,
  onViewInVariants,
  onRerun,
  onRetry,
  onCancel,
  onDelete,
  getEnhancementTypeIcon,
  getEnhancementTypeLabel,
  formatRelativeTime
}: JobCardProps) {
  const { activeVariantId, variants: storeVariants } = useEditorStore();
  const deleteJob = useEnhancementStore(s => s.deleteJob);
  const [showHoverPreview, setShowHoverPreview] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const TypeIcon = getEnhancementTypeIcon(job.mode);
  const isProcessing = ['queued', 'downloading', 'preprocessing', 'rendering', 'postprocessing', 'uploading'].includes(job.status);
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isCanceled = job.status === 'canceled';
  
  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this enhancement job?')) return;
    setIsCanceling(true);
    try {
      await cancelJob(job.id);
      // Clear enhancement lock if this was the active job
      const currentState = useEditorStore.getState();
      if (currentState.isEnhancing && isActive) {
        useEditorStore.getState().dispatch({ type: 'SET_ENHANCING', payload: false });
      }
      if (onCancel) {
        onCancel(job);
      }
      toast.success('Job canceled', { description: `Job ${job.id.slice(0, 8)}... has been canceled` });
    } catch (error: any) {
      toast.error('Failed to cancel job', { description: error.message });
    } finally {
      setIsCanceling(false);
    }
  };
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this enhancement job? This action cannot be undone.')) return;
    setIsDeleting(true);
    try {
      // Use bulk delete endpoint for single job
      const { bulkDeleteJobs } = await import('../../services/aiEnhancement');
      await bulkDeleteJobs([job.id]);
      // Clear enhancement lock if this was the active job
      const currentState = useEditorStore.getState();
      if (currentState.isEnhancing && isActive) {
        useEditorStore.getState().dispatch({ type: 'SET_ENHANCING', payload: false });
      }
      deleteJob(job.id);
      if (onDelete) {
        onDelete(job);
      }
      toast.success('Job deleted', { description: `Job ${job.id.slice(0, 8)}... has been deleted` });
    } catch (error: any) {
      toast.error('Failed to delete job', { description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Check if any variant from this job is active on canvas
  const jobVariants = job.variants || [];
  const activeVariantFromJob = jobVariants.find(v => v.id === activeVariantId);
  const isVariantActive = !!activeVariantFromJob;
  
  // Get first variant thumbnail
  const firstVariant = jobVariants.length > 0 ? jobVariants[0] : null;
  
  // Fade in animation for new variants
  useEffect(() => {
    if (firstVariant?.id) {
      // Reset loading and new states when variant changes
      setThumbnailLoading(true);
      setIsNew(true);
      const timer = setTimeout(() => setIsNew(false), 500);
      return () => clearTimeout(timer);
    } else {
      // No variant yet, reset states
      setThumbnailLoading(true);
      setIsNew(true);
    }
  }, [firstVariant?.id]);
  
  let StatusIcon = Clock;
  let statusColor = 'bg-primary/10 text-primary border-primary/20';
  let statusLabel = 'Processing';
  
  if (isCompleted) {
    StatusIcon = CheckCircle;
    statusColor = 'bg-green-100 text-green-700 border-green-200';
    statusLabel = 'Complete';
  } else if (isFailed) {
    StatusIcon = XCircle;
    statusColor = 'bg-red-100 text-red-700 border-red-200';
    statusLabel = 'Failed';
  }
  
  return (
    <div className={`rounded-lg border transition-all duration-200 ${
      isActive 
        ? 'border-primary bg-primary/5 shadow-md' 
        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
    } p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TypeIcon className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-semibold text-gray-900">
            {getEnhancementTypeLabel(job.mode)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isVariantActive && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary text-white">
              <Sparkles className="w-3 h-3" />
              <span>Active on Canvas</span>
            </div>
          )}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${statusColor}`}>
            {isProcessing && <Loader2 className="w-3 h-3 animate-spin" />}
            {!isProcessing && <StatusIcon className="w-3 h-3" />}
            <span>{statusLabel}</span>
          </div>
          {/* Cancel/Delete buttons */}
          <div className="flex items-center gap-1">
            {isProcessing && (
              <button
                onClick={handleCancel}
                disabled={isCanceling}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title="Cancel job"
              >
                {isCanceling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              title="Delete job"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Progress bar for processing */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, job.progress_percent || 0))}%` }}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Processing... {Math.round(job.progress_percent || 0)}%</span>
          </div>
        </div>
      )}
      
      {/* Variant thumbnail and actions for completed */}
      {isCompleted && firstVariant && (
        <div className="space-y-3">
          {/* Thumbnail with hover preview */}
          <div 
            className={`relative group transition-opacity duration-300 ${
              isNew ? 'opacity-0 animate-fadeIn' : 'opacity-100'
            }`}
            onMouseEnter={() => setShowHoverPreview(true)}
            onMouseLeave={() => setShowHoverPreview(false)}
          >
            <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
              {thumbnailLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              )}
              <img
                src={firstVariant.url}
                alt="Enhanced preview"
                className={`w-full h-full object-cover ${thumbnailLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
                onLoad={() => setThumbnailLoading(false)}
                onError={(e) => {
                  setThumbnailLoading(false);
                  setThumbnailError(true);
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-family="sans-serif" font-size="14"%3EFailed to load%3C/text%3E%3C/svg%3E';
                }}
              />
              {showHoverPreview && !thumbnailError && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                  <div className="bg-white rounded-lg p-2 max-w-xs max-h-64 overflow-hidden">
                    <img
                      src={firstVariant.url}
                      alt="Preview"
                      className="max-w-full max-h-full rounded object-contain"
                    />
                  </div>
                </div>
              )}
              {isVariantActive && (
                <div className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded-full font-medium z-20">
                  Active
                </div>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            {!isVariantActive && onApply && (
              <button
                onClick={() => onApply(job)}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Apply to Canvas
              </button>
            )}
            {onViewInVariants && firstVariant.id && (
              <button
                onClick={() => onViewInVariants(firstVariant.id)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View in Variants
              </button>
            )}
            {onRerun && (
              <button
                onClick={() => onRerun(job)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Re-run
              </button>
            )}
          </div>
          
          {/* Variant count */}
          {jobVariants.length > 1 && (
            <div className="text-xs text-gray-500 text-center">
              {jobVariants.length} variants available
            </div>
          )}
        </div>
      )}
      
      {/* Error and retry for failed */}
      {isFailed && (
        <div className="space-y-2">
          {job.error_message && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
              {job.error_message.length > 100 
                ? `${job.error_message.substring(0, 100)}...`
                : job.error_message}
            </div>
          )}
          {onRetry && (
            <button
              onClick={() => onRetry(job)}
              className="w-full px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          )}
        </div>
      )}
      
      {/* Timestamp */}
      <div className="text-xs text-gray-500">
        {formatRelativeTime(job.completed_at || job.created_at || job.updated_at)}
      </div>
    </div>
  );
}

