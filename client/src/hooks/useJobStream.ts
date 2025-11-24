// client/src/hooks/useJobStream.ts
import { useEffect } from 'react';
import { openJobStream } from '../services/aiEnhancement';
import { useEnhancementStore } from '../state/useEnhancementStore';

export function useJobStream(jobId?: string) {
  const upsertJob = useEnhancementStore(s => s.upsertJob);

  useEffect(() => {
    if (!jobId) {
      console.log('[useJobStream] No jobId provided, skipping stream connection');
      return;
    }
    
    console.log(`[useJobStream] 🔌 Connecting to SSE stream for job ${jobId}`);
    const close = openJobStream(jobId, (evt) => {
      console.log(`[useJobStream] 📥 Received SSE event for job ${jobId}:`, {
        status: evt.status,
        progress: evt.progress,
        variantsCount: evt.variants?.length || 0,
        hasVariants: !!evt.variants
      });
      
      const { status, progress, variants, errorMessage, error_code } = evt;
      const partial: any = { id: jobId };
      if (status) partial.status = status;
      if (typeof progress === 'number') partial.progress_percent = progress;
      if (variants) {
        console.log(`[useJobStream] ✅ Received ${variants.length} variant(s) for job ${jobId}`);
        partial.variants = variants;
      }
      if (errorMessage) partial.error_message = errorMessage;
      if (error_code) partial.error_code = error_code;
      // Update updated_at when receiving stream updates
      partial.updated_at = new Date().toISOString();
      
      console.log(`[useJobStream] 📝 Updating job in store:`, {
        id: partial.id,
        status: partial.status,
        variantsCount: partial.variants?.length || 0
      });
      
      upsertJob(partial);
    });
    
    return () => {
      console.log(`[useJobStream] 🔌 Closing SSE stream for job ${jobId}`);
      close();
    };
  }, [jobId, upsertJob]);
}

