// client/src/components/enhancement/BulkActionToolbar.tsx
import { Trash2, XCircle, RefreshCw, X } from 'lucide-react';
import { useEnhancementStore } from '../../state/useEnhancementStore';
import { bulkDeleteJobs, bulkCancelJobs, bulkRetryJobs } from '../../services/aiEnhancement';
import { toast } from '../../lib/toast';
import { useState } from 'react';

export function BulkActionToolbar() {
  const {
    selectedJobs,
    isSelectMode,
    bulkActionInProgress,
    toggleSelectMode,
    deselectAllJobs,
    deleteJob,
    upsertJob,
    setBulkActionInProgress,
    refreshJobs,
  } = useEnhancementStore();
  
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  
  const selectedCount = selectedJobs.length;
  
  if (!isSelectMode || selectedCount === 0) return null;
  
  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedCount} job(s)? This action cannot be undone.`)) return;
    
    setActionInProgress('delete');
    setBulkActionInProgress(true);
    
    try {
      const result = await bulkDeleteJobs(selectedJobs);
      toast.success(`Deleted ${result.deleted} job(s)`, {
        description: result.failed > 0 ? `${result.failed} job(s) failed to delete` : undefined
      });
      
      // Remove deleted jobs from store
      selectedJobs.forEach(jobId => deleteJob(jobId));
      deselectAllJobs();
    } catch (error: any) {
      toast.error('Failed to delete jobs', { description: error.message });
    } finally {
      setActionInProgress(null);
      setBulkActionInProgress(false);
    }
  };
  
  const handleBulkCancel = async () => {
    if (!confirm(`Are you sure you want to cancel ${selectedCount} job(s)?`)) return;
    
    setActionInProgress('cancel');
    setBulkActionInProgress(true);
    
    try {
      const result = await bulkCancelJobs(selectedJobs);
      toast.success(`Canceled ${result.canceled} job(s)`, {
        description: result.failed > 0 ? `${result.failed} job(s) failed to cancel` : undefined
      });
      
      // Update canceled jobs in store
      selectedJobs.forEach(jobId => {
        upsertJob({ id: jobId, status: 'canceled' });
      });
      deselectAllJobs();
    } catch (error: any) {
      toast.error('Failed to cancel jobs', { description: error.message });
    } finally {
      setActionInProgress(null);
      setBulkActionInProgress(false);
    }
  };
  
  const handleBulkRetry = async () => {
    if (!confirm(`Are you sure you want to retry ${selectedCount} failed job(s)?`)) return;
    
    setActionInProgress('retry');
    setBulkActionInProgress(true);
    
    try {
      const result = await bulkRetryJobs(selectedJobs);
      toast.success(`Retried ${result.retried} job(s)`, {
        description: result.failed > 0 ? `${result.failed} job(s) failed to retry` : undefined
      });
      
      // Refresh jobs to get new retried jobs
      await refreshJobs();
      deselectAllJobs();
    } catch (error: any) {
      toast.error('Failed to retry jobs', { description: error.message });
    } finally {
      setActionInProgress(null);
      setBulkActionInProgress(false);
    }
  };
  
  const isLoading = bulkActionInProgress || actionInProgress !== null;
  
  return (
    <div className="sticky top-0 z-10 bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-blue-900">
          {selectedCount} job{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <button
          onClick={deselectAllJobs}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
          disabled={isLoading}
        >
          Clear selection
        </button>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={handleBulkRetry}
          disabled={isLoading || actionInProgress !== null}
          className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          title="Retry failed jobs"
        >
          <RefreshCw className={`w-4 h-4 ${actionInProgress === 'retry' ? 'animate-spin' : ''}`} />
          Retry
        </button>
        
        <button
          onClick={handleBulkCancel}
          disabled={isLoading || actionInProgress !== null}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          title="Cancel processing jobs"
        >
          <XCircle className={`w-4 h-4 ${actionInProgress === 'cancel' ? 'animate-spin' : ''}`} />
          Cancel
        </button>
        
        <button
          onClick={handleBulkDelete}
          disabled={isLoading || actionInProgress !== null}
          className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          title="Delete selected jobs"
        >
          <Trash2 className={`w-4 h-4 ${actionInProgress === 'delete' ? 'animate-spin' : ''}`} />
          Delete
        </button>
        
        <button
          onClick={toggleSelectMode}
          disabled={isLoading}
          className="ml-2 p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          title="Exit select mode"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

