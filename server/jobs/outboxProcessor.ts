/**
 * Outbox Processor - Processes outbox events with retry backoff
 */

import { executeQuery } from '../lib/dbHelpers.js';
import { CreditsManager } from '../lib/creditsManager.js';
import { metrics } from '../lib/metrics.js';
import { createCanvas } from 'canvas';
import { storageService } from '../lib/storageService.js';
import { randomUUID } from 'crypto';
import { CompositeGenerator } from '../compositeGenerator.js';
import { storage } from '../storage.js';
import { getMasksByPhotoSystem } from '../lib/systemQueries.js';

function calcBackoff(attempts: number) {
  const base = 5000;
  const jitter = Math.random() * 1000;
  return Math.min(base * Math.pow(2, attempts) + jitter, 30000);
}

/**
 * Generate a mask image from mask coordinates
 * Creates a black/white PNG where white = mask regions, black = background
 */
async function generateMaskImage(
  masks: Array<{ id: string; points: Array<{ x: number; y: number }> }>,
  width: number,
  height: number
): Promise<string | null> {
  try {
    if (!masks || masks.length === 0) {
      console.log('[Outbox] No masks to generate mask image');
      return null;
    }

    if (!width || !height) {
      console.warn('[Outbox] Missing width/height for mask image generation');
      return null;
    }

    console.log(`[Outbox] Generating mask image: ${masks.length} masks, ${width}x${height}`);

    // Create canvas with image dimensions
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fill with black (background)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Draw each mask as white region
    ctx.fillStyle = '#FFFFFF';
    for (const mask of masks) {
      if (!mask.points || mask.points.length < 3) {
        console.warn(`[Outbox] Skipping mask ${mask.id} - insufficient points`);
        continue;
      }

      // Normalize points to image coordinates (clamp to bounds)
      const normalizedPoints = mask.points.map(pt => ({
        x: Math.max(0, Math.min(width - 1, pt.x)),
        y: Math.max(0, Math.min(height - 1, pt.y))
      }));

      // Draw polygon
      ctx.beginPath();
      ctx.moveTo(normalizedPoints[0].x, normalizedPoints[0].y);
      for (let i = 1; i < normalizedPoints.length; i++) {
        ctx.lineTo(normalizedPoints[i].x, normalizedPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Convert to PNG buffer
    const buffer = canvas.toBuffer('image/png');
    console.log(`[Outbox] Generated mask image: ${buffer.length} bytes`);

    // Upload to cloud storage
    const maskId = randomUUID();
    const path = `ai-enhancements/masks/${maskId}.png`;
    const url = await storageService.put(path, buffer, {
      contentType: 'image/png',
      cacheControl: 'public, max-age=3600'
    });

    console.log(`[Outbox] Mask image uploaded: ${url}`);
    return url;
  } catch (error: any) {
    console.error('[Outbox] Error generating mask image:', error);
    return null; // Don't fail the entire job if mask generation fails
  }
}

export async function processOutboxEvents() {
  try {
    console.log('[Outbox] ========================================');
    console.log('[Outbox] processOutboxEvents() called');
    console.log('[Outbox] Timestamp:', new Date().toISOString());
    console.log('[Outbox] ========================================');
    
    // Check if we have N8N_WEBHOOK_URL configured
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      console.log('[Outbox] ❌ N8N_WEBHOOK_URL not set, skipping webhook processing');
      return;
    }
    console.log('[Outbox] ✅ N8N_WEBHOOK_URL is set');
    
    const events = await executeQuery(`
      WITH next_batch AS (
        SELECT id
        FROM outbox
        WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        ORDER BY created_at
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox
      SET status = 'processing', attempts = attempts + 1 
      FROM next_batch
      WHERE outbox.id = next_batch.id
      RETURNING outbox.*
    `);

    if (events.length === 0) {
      // No events to process - this is normal, don't log every time
      // Only log occasionally to confirm processor is running
      if (Math.random() < 0.01) { // Log ~1% of the time
        console.log('[Outbox] No pending events to process (processor is running)');
      }
      return;
    }

    console.log(`[Outbox] Processing ${events.length} event(s)`);
    console.log(`[Outbox] Event IDs:`, events.map((e: any) => e.id));

    for (const ev of events) {
      console.log(`[Outbox] ========================================`);
      console.log(`[Outbox] Processing event ${ev.id}, type: ${ev.event_type}, job_id: ${ev.job_id}`);
      console.log(`[Outbox] Event status: ${ev.status}, attempts: ${ev.attempts}`);
      try {
        if (ev.event_type === 'enqueue_enhancement') {
          const payload = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload;
        
        // CRITICAL FIX: Get photoId from job table (source of truth) instead of payload
        // The payload photoId might not match the job's photo_id where masks are actually stored
        console.log(`[Outbox] 🔍 Querying job table for photo_id (job_id: ${ev.job_id})...`);
        const jobRows = await executeQuery(
          `SELECT photo_id FROM ai_enhancement_jobs WHERE id = $1`,
          [ev.job_id]
        );
        const jobPhotoId = jobRows.length > 0 ? jobRows[0].photo_id : null;
        const effectivePhotoId = jobPhotoId || payload.photoId;
        
        console.log(`[Outbox] 📊 PhotoId resolution:`, {
          payloadPhotoId: payload.photoId,
          jobPhotoId: jobPhotoId,
          effectivePhotoId: effectivePhotoId,
          usingJobPhotoId: !!jobPhotoId && jobPhotoId !== payload.photoId,
          jobRowsFound: jobRows.length
        });
        
        if (!jobPhotoId && payload.photoId) {
          console.warn(`[Outbox] ⚠️ WARNING: Job ${ev.job_id} has no photo_id in database, using payload.photoId as fallback`);
        }
        if (jobPhotoId && jobPhotoId !== payload.photoId) {
          console.warn(`[Outbox] ⚠️ WARNING: PhotoId mismatch! Job.photo_id (${jobPhotoId}) != payload.photoId (${payload.photoId})`);
        }
        
        console.log(`[Outbox] Parsed payload for job ${payload.jobId}:`, {
          hasMasks: !!payload.masks,
          masksCount: payload.masks?.length || 0,
          masks: payload.masks?.map((m: any) => ({
            id: m.id,
            pointsCount: m.points?.length || 0,
            materialId: m.materialId,
            hasMaterialSettings: !!m.materialSettings,
            materialSettings: m.materialSettings ? {
              textureScale: m.materialSettings.textureScale,
              intensity: m.materialSettings.intensity,
              opacity: m.materialSettings.opacity
            } : null
          })) || []
        });
        
        // Check if we should use n8n webhook (if N8N_WEBHOOK_URL is set) or fallback to Bull queue
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
        
        if (n8nWebhookUrl) {
          // Use n8n webhook instead of Bull queue
          try {
            // Construct n8n webhook payload
            // Note: n8n workflow expects 'mode' at root level (not nested in options)
            const mode = payload.options?.mode || 'add_decoration';
            
            // Convert relative imageUrl to absolute URL if needed
            let absoluteImageUrl = payload.imageUrl;
            if (absoluteImageUrl && !absoluteImageUrl.startsWith('http')) {
              const appUrl = process.env.APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
              // Ensure imageUrl starts with / and appUrl doesn't end with /
              const cleanAppUrl = appUrl.replace(/\/$/, '');
              const cleanImageUrl = absoluteImageUrl.startsWith('/') ? absoluteImageUrl : `/${absoluteImageUrl}`;
              absoluteImageUrl = `${cleanAppUrl}${cleanImageUrl}`;
            }
            
            // Prepare options object without mode (mode goes at root level)
            const { mode: _modeInOptions, ...optionsWithoutMode } = payload.options || {};
            
            // Ensure mode is at root level and not in options
            const finalOptions = {
              ...optionsWithoutMode,
              model: payload.options?.model || 'seedream',
              variants: payload.options?.variants || 1
            };
            
            // Explicitly remove mode from finalOptions if it somehow got back in
            delete finalOptions.mode;
            
            // Generate composite image (image with masks already applied) if photoId is present
            // CRITICAL FIX: Use job's photo_id (from database) as source of truth for mask queries
            // This ensures we query masks using the same photoId that masks are actually stored under
            let compositeImageUrl: string | null = null;
            let maskImageUrl: string | null = null;
            
            console.log(`[Outbox] Composite generation check:`, {
              hasEffectivePhotoId: !!effectivePhotoId,
              effectivePhotoId: effectivePhotoId,
              payloadPhotoId: payload.photoId,
              jobPhotoId: jobPhotoId,
              payloadMaskCount: payload.masks?.length || 0,
              note: 'Using job.photo_id as source of truth for mask queries'
            });
            
            // NEW: Use client-exported composite image if available (simpler, faster, more reliable)
            if (payload.compositeImageUrl) {
              console.log(`[Outbox] ✅ Using client-exported composite image from payload`);
              console.log(`[Outbox] Composite URL: ${payload.compositeImageUrl.substring(0, 100)}...`);
              compositeImageUrl = payload.compositeImageUrl;
              
              // Ensure URL is absolute
              if (!compositeImageUrl.startsWith('http')) {
                const appUrl = process.env.APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
                const cleanAppUrl = appUrl.replace(/\/$/, '');
                const cleanCompositeUrl = compositeImageUrl.startsWith('/') ? compositeImageUrl : `/${compositeImageUrl}`;
                compositeImageUrl = `${cleanAppUrl}${cleanCompositeUrl}`;
                console.log(`[Outbox] Converted relative composite URL to absolute: ${compositeImageUrl.substring(0, 100)}...`);
              }
              
              // Still generate mask image if needed (for AI inpainting)
              if (effectivePhotoId && payload.masks && payload.masks.length > 0) {
                try {
                  const photo = await storage.getPhoto(effectivePhotoId);
                  if (photo) {
                    const maskImagePoints = payload.masks.map((m: any) => ({
                      id: m.id,
                      points: m.points || []
                    }));
                    maskImageUrl = await generateMaskImage(maskImagePoints, photo.width, photo.height);
                  }
                } catch (maskError) {
                  console.warn(`[Outbox] Failed to generate mask image:`, maskError);
                }
              }
            } else if (effectivePhotoId) {
              // FALLBACK: Generate composite server-side if client didn't provide one
              // This maintains backward compatibility
              console.log(`[Outbox] ⚠️ No compositeImageUrl in payload, falling back to server-side generation`);
              console.log(`[Outbox] ⚠️ This is slower and less reliable - client should export canvas`);
              
              // Check database for masks using job's photo_id (source of truth)
              console.log(`[Outbox] ========================================`);
              console.log(`[Outbox] 🔍 MASK QUERY START`);
              console.log(`[Outbox] 🔍 Querying database for masks (photoId: ${effectivePhotoId})...`);
              let dbMasks: any[] = [];
              
              // CRITICAL FIX: Use system query function that bypasses RLS
              try {
                dbMasks = await getMasksByPhotoSystem(effectivePhotoId);
                console.log(`[Outbox] ✅ getMasksByPhotoSystem succeeded: ${dbMasks.length} masks`);
              } catch (queryError: any) {
                console.error(`[Outbox] ❌ getMasksByPhotoSystem failed:`, queryError);
                // Fallback to regular storage method
                try {
                  dbMasks = await storage.getMasksByPhoto(effectivePhotoId);
                console.log(`[Outbox] 🔄 Fallback found ${dbMasks.length} masks`);
                } catch (fallbackError: any) {
                  console.error(`[Outbox] ❌ Fallback also failed:`, fallbackError);
                }
              }
              
              if (dbMasks.length === 0) {
                console.warn(`[Outbox] ⚠️ No masks found in database, using original image URL`);
                compositeImageUrl = absoluteImageUrl;
              } else {
                try {
                  const photo = await storage.getPhoto(effectivePhotoId);
                  if (!photo) {
                    compositeImageUrl = absoluteImageUrl;
                  } else {
                    const generator = new CompositeGenerator();
                    const photoPxPerMeter = payload.calibration || undefined;
                    
                    const compositePromise = generator.generateComposite(
                      effectivePhotoId, 
                      true,
                      undefined,
                      photoPxPerMeter
                    );
                    
                    const maskImagePoints = dbMasks.map(m => {
                      let points: any[] = [];
                      try {
                        const pathData = typeof m.pathJson === 'string' ? JSON.parse(m.pathJson) : m.pathJson;
                        points = Array.isArray(pathData) ? pathData : [];
                      } catch (e) {
                        console.warn(`[Outbox] Failed to parse pathJson:`, e);
                      }
                      return {
                        id: m.id,
                        points: points.map((pt: any) => ({ x: pt.x, y: pt.y }))
                      };
                    });
                    const maskImagePromise = generateMaskImage(maskImagePoints, photo.width, photo.height);
                    
                    const [compositeResult, maskResult] = await Promise.allSettled([
                      Promise.race([
                        compositePromise,
                        new Promise((_, reject) => 
                          setTimeout(() => reject(new Error('Composite generation timeout (15s)')), 15000)
                        )
                      ]),
                      Promise.race([
                        maskImagePromise,
                        new Promise((_, reject) => 
                          setTimeout(() => reject(new Error('Mask image generation timeout (5s)')), 5000)
                        )
                      ])
                    ]);
                    
                    if (compositeResult.status === 'fulfilled') {
                      const result = compositeResult.value;
                      if (result.status === 'completed' && result.afterUrl) {
                        let finalCompositeUrl = result.afterUrl;
                        if (!finalCompositeUrl.startsWith('http')) {
                          const appUrl = process.env.APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
                          const cleanAppUrl = appUrl.replace(/\/$/, '');
                          const cleanCompositeUrl = finalCompositeUrl.startsWith('/') ? finalCompositeUrl : `/${finalCompositeUrl}`;
                          finalCompositeUrl = `${cleanAppUrl}${cleanCompositeUrl}`;
                        }
                        compositeImageUrl = finalCompositeUrl;
                      } else {
                        compositeImageUrl = absoluteImageUrl;
                      }
                    } else {
                      compositeImageUrl = absoluteImageUrl;
                    }
                    
                    if (maskResult.status === 'fulfilled') {
                      maskImageUrl = maskResult.value;
                    }
                  }
                } catch (error: any) {
                  console.error(`[Outbox] ❌ Error generating composite:`, error);
                  compositeImageUrl = absoluteImageUrl;
                }
              }
            } else {
              // No photoId - use original image
              console.warn(`[Outbox] ⚠️ No photoId in payload, cannot generate composite. Using original image.`);
              compositeImageUrl = absoluteImageUrl;
              
              // Try to generate mask image from payload if available (fallback for cases without photoId)
              if (payload.masks && payload.masks.length > 0 && payload.width && payload.height) {
                try {
                  maskImageUrl = await generateMaskImage(payload.masks, payload.width, payload.height);
                } catch (error) {
                  console.warn(`[Outbox] Failed to generate mask image from payload:`, error);
                }
              }
            }
            
            // Ensure compositeImageUrl is set (fallback to original if not set)
            if (!compositeImageUrl) {
              compositeImageUrl = absoluteImageUrl;
            }
            
            const n8nPayload = {
              jobId: payload.jobId,
              tenantId: payload.tenantId,
              photoId: effectivePhotoId || payload.photoId, // Use effectivePhotoId (job's photo_id) as source of truth
              imageUrl: absoluteImageUrl, // Original image URL (for reference)
              compositeImageUrl: compositeImageUrl, // Image with masks already applied (USE THIS FOR DOWNLOAD)
              masks: payload.masks || [],
              maskImageUrl: maskImageUrl, // Generated mask image URL for AI inpainting (if needed)
              mode: mode, // Top-level mode field (required by n8n workflow)
              options: finalOptions,
              calibration: payload.calibration,
              width: payload.width,
              height: payload.height,
              callbackUrl: payload.callbackUrl,
              callbackSecret: payload.callbackSecret
            };

            const isFallback = compositeImageUrl === absoluteImageUrl;
            console.log(`[Outbox] ========================================`);
            console.log(`[Outbox] 📤 Sending enhancement job ${payload.jobId} to n8n webhook`);
            console.log(`[Outbox] Webhook URL: ${n8nWebhookUrl}`);
            console.log(`[Outbox] Payload mode: ${mode}`);
            console.log(`[Outbox] ========================================`);
            console.log(`[Outbox] 🖼️ IMAGE URLS:`);
            console.log(`[Outbox]   Original (imageUrl): ${absoluteImageUrl.substring(0, 100)}...`);
            console.log(`[Outbox]   Composite (compositeImageUrl): ${compositeImageUrl ? compositeImageUrl.substring(0, 100) + '...' : 'NULL'}`);
            console.log(`[Outbox]   Mask Image (maskImageUrl): ${maskImageUrl ? maskImageUrl.substring(0, 100) + '...' : 'NULL'}`);
            console.log(`[Outbox]   ⚠️ n8n should use: compositeImageUrl (image with masks applied)`);
            console.log(`[Outbox] ========================================`);
            console.log(`[Outbox] 📦 PAYLOAD SUMMARY:`);
            console.log(`[Outbox]   Masks count: ${n8nPayload.masks.length}`);
            console.log(`[Outbox]   Photo ID: ${n8nPayload.photoId || 'MISSING'}`);
            console.log(`[Outbox]   Job Photo ID: ${jobPhotoId || 'NULL'}`);
            console.log(`[Outbox]   Payload Photo ID: ${payload.photoId || 'NULL'}`);
            console.log(`[Outbox]   Has compositeImageUrl: ${!!n8nPayload.compositeImageUrl}`);
            console.log(`[Outbox]   Composite URL matches original: ${isFallback ? '⚠️⚠️⚠️ YES (FALLBACK - NO MASKS FOUND!)' : '✅ NO (GENERATED WITH MASKS)'}`);
            if (isFallback) {
              console.error(`[Outbox] ❌❌❌ CRITICAL: Composite image is same as original!`);
              console.error(`[Outbox] ❌❌❌ This means no masks were found in database for photoId: ${effectivePhotoId}`);
              console.error(`[Outbox] ❌❌❌ Check diagnostic endpoint: GET /api/debug/enhancement/${payload.jobId}`);
              console.error(`[Outbox] ❌❌❌ Verify masks exist in database for this photoId`);
            }
            console.log(`[Outbox] ========================================`);
            console.log(`[Outbox] Full payload:`, JSON.stringify(n8nPayload, null, 2));
            console.log(`[Outbox] Payload preview:`, JSON.stringify({
              jobId: n8nPayload.jobId,
              mode: n8nPayload.mode,
              imageUrl: n8nPayload.imageUrl.substring(0, 80) + '...',
              hasCompositeImageUrl: !!n8nPayload.compositeImageUrl,
              compositeImageUrl: n8nPayload.compositeImageUrl ? n8nPayload.compositeImageUrl.substring(0, 80) + '...' : null,
              masksCount: n8nPayload.masks.length,
              hasMaskImageUrl: !!n8nPayload.maskImageUrl,
              maskImageUrl: n8nPayload.maskImageUrl ? n8nPayload.maskImageUrl.substring(0, 80) + '...' : null,
              masks: n8nPayload.masks.map((m: any) => ({
                id: m.id,
                pointsCount: m.points?.length || 0,
                materialId: m.materialId,
                hasMaterialSettings: !!m.materialSettings,
                materialSettings: m.materialSettings ? {
                  textureScale: m.materialSettings.textureScale,
                  intensity: m.materialSettings.intensity
                } : null
              })),
              hasCallbackUrl: !!n8nPayload.callbackUrl,
              width: n8nPayload.width,
              height: n8nPayload.height
            }));
            
            // POST to n8n webhook
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            // Final verification - ensure mode is at root and not in options
            const finalPayloadToSend = {
              ...n8nPayload,
              mode: mode, // Ensure mode is definitely at root
              options: {
                ...n8nPayload.options,
              }
            };
            // Remove mode from options if it exists
            delete finalPayloadToSend.options.mode;
            
            console.log(`[Outbox] Final payload verification - mode at root: ${finalPayloadToSend.mode}, mode in options: ${finalPayloadToSend.options.mode}`);
            
            const response = await fetch(n8nWebhookUrl, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'PoolVisual/1.0'
              },
              body: JSON.stringify(finalPayloadToSend),
              signal: controller.signal
            }).finally(() => {
              clearTimeout(timeoutId);
            });

            if (!response.ok) {
              const errorText = await response.text().catch(() => 'Unknown error');
              console.error(`[Outbox] n8n webhook HTTP error: ${response.status} ${response.statusText}`);
              console.error(`[Outbox] Error response body:`, errorText);
              throw new Error(`N8N webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const responseData = await response.json().catch(() => ({}));
            console.log(`[Outbox] ✅ n8n webhook responded successfully:`, responseData);
            
          } catch (webhookError: any) {
            // Check if it's a timeout error
            if (webhookError.name === 'AbortError' || webhookError.name === 'TimeoutError') {
              console.error('[Outbox] ❌ n8n webhook timeout after 30 seconds');
            } else if (webhookError.code === 'ECONNREFUSED' || webhookError.code === 'ENOTFOUND') {
              console.error('[Outbox] ❌ n8n webhook connection failed - check URL and network');
            } else {
              console.error('[Outbox] ❌ n8n webhook error:', webhookError.message);
            }
            console.error('[Outbox] Full error:', webhookError);
            throw webhookError; // Re-throw to trigger retry logic
          }
        } else {
          // Fallback to Bull queue if N8N_WEBHOOK_URL is not set
          // Lazy import to avoid Redis connection errors when using n8n webhooks
          const { enhancementQueue } = await import('./aiEnhancementQueue.js');
          if (!enhancementQueue) {
            console.warn('[Outbox] Enhancement queue not available and N8N_WEBHOOK_URL not set, skipping');
            continue;
          }
          await enhancementQueue.add('enhance', ev.payload, {
            jobId: ev.job_id,
            removeOnComplete: true
          });
        }
      }
      
      await executeQuery(
        `UPDATE outbox SET status = 'completed', processed_at = NOW() WHERE id = $1`,
        [ev.id]
      );
      metrics.outboxProcessedSuccess.inc({ event_type: ev.event_type });
    } catch (e) {
      const attempt = Number(ev.attempts || 0);
      
      if (attempt >= 3) {
        // Terminal failure
        await executeQuery(`UPDATE outbox SET status = 'failed' WHERE id = $1`, [ev.id]);
        
        const rows = await executeQuery(`
          UPDATE ai_enhancement_jobs 
          SET status = 'failed', error_message = 'Outbox processing failed after 3 attempts', error_code = 'OUTBOX_FAILED'
          WHERE id = $1
          RETURNING tenant_id, reserved_cost_micros
        `, [ev.job_id]);
        
        if (rows.length && rows[0].reserved_cost_micros > 0) {
          // TODO: Implement actual credit refund
          console.log('[Outbox] Would refund credits:', rows[0].reserved_cost_micros);
        }
        
        metrics.outboxProcessedFailed.inc({ event_type: ev.event_type, error_type: 'terminal' });
      } else {
        // Retry with backoff
        const delay = calcBackoff(attempt);
        await executeQuery(
          `UPDATE outbox SET status = 'pending', next_retry_at = NOW() + INTERVAL '${delay} milliseconds' WHERE id = $1`,
          [ev.id]
        );
        metrics.outboxRetry.inc({ attempt: String(attempt + 1) });
      }
    }
    }
  } catch (error: any) {
    console.error('[Outbox] Fatal error in processOutboxEvents:', error);
    console.error('[Outbox] Error stack:', error.stack);
  }
}

