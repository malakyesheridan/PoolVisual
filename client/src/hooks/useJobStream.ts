// client/src/hooks/useJobStream.ts
import { useEffect } from 'react';
import { openJobStream } from '../services/aiEnhancement';
import { useEnhancementStore } from '../state/useEnhancementStore';

export function useJobStream(jobId?: string) {
  const upsertJob = useEnhancementStore(s => s.upsertJob);

  useEffect(() => {
    if (!jobId) return;
    const close = openJobStream(jobId, (evt) => {
      const { status, progress, variants, errorMessage, error_code } = evt;
      const partial: any = { id: jobId };
      if (status) partial.status = status;
      if (typeof progress === 'number') partial.progress_percent = progress;
      if (variants) partial.variants = variants;
      if (errorMessage) partial.error_message = errorMessage;
      if (error_code) partial.error_code = error_code;
      // Update updated_at when receiving stream updates
      partial.updated_at = new Date().toISOString();
      upsertJob(partial);
    });
    return close;
  }, [jobId, upsertJob]);
}

