// client/src/components/enhancement/JobProgress.tsx
import { Download, RefreshCw, Eye, XCircle, CheckCircle, Clock, Loader2, Trash2, Waves, Sparkles } from 'lucide-react';
import { useEnhancementStore } from '../../state/useEnhancementStore';
import { useState } from 'react';

export function JobProgress({ jobId }: { jobId: string }) {
  const job = useEnhancementStore(s => s.jobs[jobId]);
  const deleteJob = useEnhancementStore(s => s.deleteJob);
  const [isDeleting, setIsDeleting] = useState(false);
  
  if (!job) return null;

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
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
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

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Status Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
        <div className="flex items-center gap-2 flex-1 min-w-0">
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
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  <span className="text-gray-700">Decor</span>
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
          {/* Delete Button */}
          {(status === 'completed' || status === 'failed' || status === 'canceled') && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
              title="Delete job"
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

      {/* Progress Bar */}
      {(status !== 'completed' && status !== 'failed' && status !== 'canceled') && (
        <div className="px-3 pt-3 pb-2">
          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${config.color} rounded-full transition-all duration-300 flex items-center justify-end pr-1`}
              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
            >
              {pct > 10 && (
                <span className="text-[10px] text-white font-medium">{Math.round(pct)}%</span>
              )}
            </div>
          </div>
          {/* Loading message for processing states */}
          {isProcessing && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Please allow up to 2 minutes for your enhancement</span>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {job.error_message && (
        <div className="px-3 py-2 bg-red-50 border-l-4 border-red-400">
          <div className="text-xs text-red-700">{job.error_message}</div>
        </div>
      )}

      {/* Variants/Results */}
      {status === 'completed' && job.variants && job.variants.length > 0 && (
        <div className="p-3 space-y-2">
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

      {/* Actions for failed jobs */}
      {status === 'failed' && (
        <div className="p-3 border-t bg-gray-50 flex items-center justify-between">
          <button 
            onClick={() => {
              // TODO: Implement retry functionality
              alert('Retry functionality coming soon');
            }}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
          {job.error_message && (
            <span className="text-xs text-gray-500 truncate max-w-[200px]" title={job.error_message}>
              {job.error_message}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

