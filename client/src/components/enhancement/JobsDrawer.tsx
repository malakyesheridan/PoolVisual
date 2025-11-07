// client/src/components/enhancement/JobsDrawer.tsx
import { useEffect, useState } from 'react';
import { X, Sparkles, Loader2, Waves, Sparkles as SparklesIcon } from 'lucide-react';
import { useEnhancementStore } from '../../state/useEnhancementStore';
import { getRecentJobs, createJob } from '../../services/aiEnhancement';
import { useJobStream } from '../../hooks/useJobStream';
import { JobProgress } from './JobProgress';
import { useEditorStore } from '../../new_editor/store';
import { useMaskStore } from '../../maskcore/store';

interface JobsDrawerProps {
  onClose?: () => void;
}

export function JobsDrawer({ onClose }: JobsDrawerProps) {
  const { order, setInitial, upsertJob } = useEnhancementStore();
  const [selectedMode, setSelectedMode] = useState<'add_pool' | 'add_decoration' | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | undefined>();

  // Stream updates for the active job
  useJobStream(activeJobId);

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
      // Get masks from the mask store and convert to format expected by server
      // Format matches server/lib/cacheNormalizer.ts: {id, points: [{x, y}], materialId?}
      const maskStore = useMaskStore.getState();
      const allMasks = Object.values(maskStore.masks || {});
      
      const masks = allMasks
        .filter(mask => mask.pts && mask.pts.length >= 3) // Only include valid masks with at least 3 points
        .map(mask => ({
          id: mask.id,
          points: mask.pts.map(pt => ({
            x: pt.x,
            y: pt.y
            // Note: Server only needs x, y for cache key - not h1, h2, or kind
          })),
          materialId: mask.materialId || undefined
        }));
      
      console.log(`[JobsDrawer] Extracted ${masks.length} masks for enhancement job`);
      
      const payload = {
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        photoId: effectivePhotoId,
        imageUrl: currentImageUrl,
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

      const { jobId } = await createJob(payload);
      upsertJob({ id: jobId, status: 'queued', progress_percent: 0 });
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
    <aside className="fixed right-4 top-20 w-[420px] max-h-[80vh] overflow-auto bg-white shadow-2xl rounded-xl border z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <div className="font-semibold text-base">AI Enhancements</div>
        </div>
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
        {order.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">
            No enhancements yet. Create your first one above!
          </div>
        ) : (
          order.map(id => <JobProgress key={id} jobId={id} />)
        )}
      </div>
    </aside>
  );
}

