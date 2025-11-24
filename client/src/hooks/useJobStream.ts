// client/src/hooks/useJobStream.ts
import { useEffect, useRef } from 'react';
import { openJobStream, getJob } from '../services/aiEnhancement';
import { useEnhancementStore } from '../state/useEnhancementStore';

/**
 * Industry-standard dual-channel job stream hook
 * - SSE (primary): Real-time updates when connected
 * - Polling (parallel): Validates and reconciles every 2 seconds
 * - Event deduplication: Prevents duplicate updates
 * - Server timestamp reconciliation: Server always wins
 * - Auto-apply: Automatically applies enhanced images when ready
 */
export function useJobStream(
  jobId?: string,
  onVariantsReady?: (job: any) => void | Promise<void>
) {
  const upsertJob = useEnhancementStore(s => s.upsertJob);
  const processedEvents = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!jobId) {
      console.log('[useJobStream] No jobId provided, skipping stream connection');
      return;
    }
    
    console.log(`[useJobStream] 🔌 Starting dual-channel updates for job ${jobId}`);
    
    // Event handler with deduplication and reconciliation
    const handleUpdate = (event: any, source: 'sse' | 'poll') => {
      // Deduplicate by event ID (if present)
      if (event.id) {
        if (processedEvents.current.has(event.id)) {
          console.log(`[useJobStream] ⏭️ Skipping duplicate event ${event.id} from ${source}`);
          return;
        }
        processedEvents.current.add(event.id);
        
        // Cleanup old event IDs (keep last 100)
        if (processedEvents.current.size > 100) {
          const oldest = Array.from(processedEvents.current).slice(0, 50);
          oldest.forEach(id => processedEvents.current.delete(id));
        }
      }
      
      // Build partial update
      const partial: any = { id: jobId };
      if (event.status) partial.status = event.status;
      if (typeof event.progress === 'number') partial.progress_percent = event.progress;
      if (event.variants) {
        console.log(`[useJobStream] ✅ Received ${event.variants.length} variant(s) for job ${jobId} from ${source}`);
        partial.variants = event.variants;
      }
      if (event.errorMessage || event.error) partial.error_message = event.errorMessage || event.error;
      if (event.error_code) partial.error_code = event.error_code;
      if (event.completed_at) partial.completed_at = event.completed_at;
      
      // CRITICAL: Use server timestamp if available, otherwise use current time
      // Server timestamp is source of truth for reconciliation
      if (event.timestamp) {
        partial.updated_at = event.timestamp;
      } else {
        partial.updated_at = new Date().toISOString();
      }
      
      // Server timestamp reconciliation
      const localJob = useEnhancementStore.getState().jobs[jobId];
      if (localJob?.updated_at) {
        const serverTime = new Date(partial.updated_at).getTime();
        const localTime = new Date(localJob.updated_at).getTime();
        
        // Only update if server is newer or equal (server wins)
        if (serverTime < localTime) {
          console.log(`[useJobStream] ⏭️ Skipping stale update from ${source} (server: ${partial.updated_at}, local: ${localJob.updated_at})`);
          return;
        }
      }
      
      console.log(`[useJobStream] 📝 Updating job in store from ${source}:`, {
        id: partial.id,
        status: partial.status,
        variantsCount: partial.variants?.length || 0,
        timestamp: partial.updated_at
      });
      
      upsertJob(partial);
      
      // Auto-apply when variants are ready (only for completed jobs)
      if (partial.status === 'completed' && 
          partial.variants && 
          partial.variants.length > 0 && 
          onVariantsReady) {
        // Get full job from store
        const fullJob = useEnhancementStore.getState().jobs[jobId];
        if (fullJob) {
          console.log(`[useJobStream] 🎨 Variants ready, triggering auto-apply callback...`);
          // Call callback asynchronously to avoid blocking
          Promise.resolve(onVariantsReady(fullJob)).catch(error => {
            console.error(`[useJobStream] ❌ Error in onVariantsReady callback:`, error);
          });
        }
      }
    };
    
    // Channel 1: SSE (primary, real-time)
    console.log(`[useJobStream] 📡 Connecting SSE stream for job ${jobId}`);
    const close = openJobStream(jobId, (evt) => {
      console.log(`[useJobStream] 📥 Received SSE event for job ${jobId}:`, {
        id: evt.id,
        status: evt.status,
        progress: evt.progress,
        variantsCount: evt.variants?.length || 0,
        hasVariants: !!evt.variants,
        timestamp: evt.timestamp
      });
      handleUpdate(evt, 'sse');
    });
    
    // Channel 2: Polling (parallel, not fallback)
    // Polls every 2 seconds to validate and reconcile
    const poll = async () => {
      try {
        const serverJob = await getJob(jobId);
        console.log(`[useJobStream] 🔍 Polling job ${jobId}:`, {
          status: serverJob.status,
          variantsCount: serverJob.variants?.length || 0,
          updated_at: serverJob.updated_at
        });
        
        // Convert server job to event format for handler
        handleUpdate({
          id: `poll-${jobId}-${Date.now()}`, // Generate poll event ID
          status: serverJob.status,
          progress: serverJob.progress_percent ?? 0, // Convert null to 0 for progress
          variants: serverJob.variants,
          errorMessage: serverJob.error_message, // Use errorMessage (not error_message) to match SSE format
          completed_at: serverJob.completed_at,
          timestamp: serverJob.updated_at || serverJob.created_at || new Date().toISOString()
        }, 'poll');
      } catch (error) {
        console.error(`[useJobStream] ❌ Polling error for job ${jobId}:`, error);
        // Continue polling on error - don't stop
      }
    };
    
    // Poll immediately, then every 2 seconds
    poll();
    const pollInterval = setInterval(poll, 2000);
    
    return () => {
      console.log(`[useJobStream] 🔌 Closing dual-channel updates for job ${jobId}`);
      close();
      clearInterval(pollInterval);
    };
  }, [jobId, upsertJob]);
}

