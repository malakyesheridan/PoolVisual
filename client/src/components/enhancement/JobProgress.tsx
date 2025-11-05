// client/src/components/enhancement/JobProgress.tsx
import { Download, RefreshCw, Eye, XCircle, CheckCircle, Clock } from 'lucide-react';
import { useEnhancementStore } from '../../state/useEnhancementStore';

export function JobProgress({ jobId }: { jobId: string }) {
  const job = useEnhancementStore(s => s.jobs[jobId]);
  if (!job) return null;

  const pct = job.progress_percent ?? 0;
  const status = job.status ?? 'queued';

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
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Status Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-4 h-4 ${config.textColor}`} />
          <span className={`text-sm font-medium ${config.textColor}`}>
            {config.label}
          </span>
          {pct > 0 && pct < 100 && (
            <span className="text-xs text-gray-500 ml-1">({pct}%)</span>
          )}
        </div>
        {status === 'completed' && job.variants?.length && (
          <div className="text-xs text-gray-500">
            {job.variants.length} variant{job.variants.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {(status !== 'completed' && status !== 'failed' && status !== 'canceled') && (
        <div className="px-3 pt-3 pb-2">
          <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${config.color} rounded-full transition-all duration-300`}
              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
            />
          </div>
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
                  className="w-full rounded-lg border-2 border-gray-200 object-cover aspect-square"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => handleView(v.url)}
                    className="p-1.5 bg-white rounded-md shadow hover:bg-gray-50"
                    title="View full size"
                  >
                    <Eye className="w-3.5 h-3.5 text-gray-700" />
                  </button>
                  <button
                    onClick={() => handleDownload(v.url)}
                    className="p-1.5 bg-white rounded-md shadow hover:bg-gray-50"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5 text-gray-700" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions for failed jobs */}
      {status === 'failed' && (
        <div className="p-3 border-t bg-gray-50">
          <button className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

