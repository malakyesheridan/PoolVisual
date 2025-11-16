/**
 * AI Enhancement Routes
 */

import { Router } from 'express';
import multer from 'multer';
import { storage } from '../storage.js';
import { storageService } from '../lib/storageService.js';
import { enhancementQueue } from '../jobs/aiEnhancementQueue.js';
import { CreditsManager } from '../lib/creditsManager.js';
import { generateCacheKey } from '../lib/cacheNormalizer.js';
import { verifyWebhookSignature } from '../middleware/hmacVerification.js';
import { SSEManager } from '../lib/sseManager.js';
import { executeQuery, transaction } from '../lib/dbHelpers.js';
import { randomUUID } from 'crypto';

export const router = Router();

const MAX_MP = 25;
const MAX_MB = 50;

// Mock authenticateSession for now - replace with actual auth middleware
function authenticateSession(req: any, res: any, next: any) {
  // TODO: Implement actual authentication
  req.session = { user: { id: '027a7c88-9d4b-4ee4-9246-c5da53a120ab' } };
  next();
}

// Multer configuration for composite upload
const getUpload = () => {
  if (process.env.VERCEL) {
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: parseInt(process.env.MAX_IMAGE_SIZE || '52428800'), // 50MB
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(',');
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
        }
      },
    });
  } else {
    const uploadDir = 'uploads/';
    return multer({
      dest: uploadDir,
      limits: {
        fileSize: parseInt(process.env.MAX_IMAGE_SIZE || '52428800'), // 50MB
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(',');
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
        }
      },
    });
  }
};

// POST /api/ai/enhancement/upload-composite
// Upload composite image exported from client canvas
router.post('/upload-composite', authenticateSession, getUpload().single('composite'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const jobId = req.body.jobId;
    if (!jobId) {
      return res.status(400).json({ error: 'jobId required' });
    }
    
    // Get file buffer
    let imageBuffer: Buffer;
    if (req.file.buffer) {
      // Memory storage (Vercel)
      imageBuffer = req.file.buffer;
    } else if (req.file.path) {
      // Disk storage (local)
      const fs = await import('fs');
      imageBuffer = fs.readFileSync(req.file.path);
    } else {
      return res.status(400).json({ error: 'No file buffer or path available' });
    }
    
    // Upload to cloud storage
    const path = `ai-enhancements/composite/${jobId}-${Date.now()}.png`;
    const url = await storageService.put(
      path,
      imageBuffer,
      req.file.mimetype || 'image/png'
    );
    
    console.log(`[UploadComposite] Uploaded composite image for job ${jobId}: ${url}`);
    
    res.json({ url });
  } catch (error: any) {
    console.error('[UploadComposite] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/enhancement/upload-url
router.post('/upload-url', authenticateSession, async (req, res) => {
  try {
    const { photoId, contentHash, size, width, height } = req.body || {};
    
    if (width && height) {
      const mp = (width * height) / 1_000_000;
      if (mp > MAX_MP) {
        return res.status(413).json({ 
          message: `Image too large. Max ${MAX_MP} MP`, 
          currentMP: mp 
        });
      }
    }
    
    if (size && size > MAX_MB * 1024 * 1024) {
      return res.status(413).json({ 
        message: `File too large. Max ${MAX_MB} MB` 
      });
    }
    
    const path = `ai-enhancements/${photoId}/${contentHash}.png`;
    const url = await storageService.getSignedUploadUrl(path, 3600);
    
    res.json({ 
      uploadUrl: url, 
      objectPath: path, 
      expiresAt: Date.now() + 3600000 
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/ai/enhancement
router.post('/', authenticateSession, async (req, res) => {
  try {
    const user = req.session.user;
    
    // Log the incoming request to debug mask issues
    console.log('[Create Enhancement] Received request:', {
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      masksInBody: req.body?.masks ? req.body.masks.length : 0,
      masksPreview: req.body?.masks ? req.body.masks.slice(0, 2).map((m: any) => ({
        id: m.id,
        pointsCount: m.points?.length || 0,
        materialId: m.materialId
      })) : []
    });
    
    const {
      tenantId,
      photoId,
      imageUrl,
      compositeImageUrl, // Client-exported canvas (optional)
      inputHash,
      masks = [],
      options = {},
      calibration,
      width,
      height
    } = req.body || {};

    // Basic input validation
    if (!tenantId || !imageUrl || !inputHash) {
      return res.status(400).json({ message: 'tenantId, imageUrl, inputHash are required' });
    }

    // Enforce size/MP if client provided dimensions (defensive)
    if (width && height) {
      const mp = (width * height) / 1_000_000;
      if (mp > MAX_MP) {
        return res.status(413).json({ message: `Image too large. Max ${MAX_MP} MP`, currentMP: mp });
      }
    }

    // Normalized cache key (provider + model are fixed here)
    const cacheKey = generateCacheKey({
      inputHash,
      masks,
      calibration,
      options,
      provider: 'comfy:inpaint',
      model: 'sdxl'
    });

    // Tenant-scoped cache lookup
    const cached = await executeQuery(
      `
      SELECT j.id,
             array_agg(v.id) AS variant_ids,
             array_agg(v.output_url) AS variant_urls
      FROM ai_enhancement_jobs j
      LEFT JOIN ai_enhancement_variants v ON v.job_id = j.id
      WHERE j.tenant_id = $1
        AND j.normalized_cache_key = $2
        AND j.status = 'completed'
      GROUP BY j.id
      ORDER BY j.completed_at DESC
      LIMIT 1
      `,
      [tenantId, cacheKey]
    );

    if (cached.length > 0) {
      return res.json({
        jobId: cached[0].id,
        cached: true,
        variants: (cached[0].variant_ids || []).map((id: string, i: number) => ({
          id,
          url: cached[0].variant_urls[i]
        }))
      });
    }

    // Estimate & reserve credits (fallback MP if no dims)
    const imageMP = width && height ? ((width * height) / 1_000_000) : 8;
    const estimatedCost = CreditsManager.estimateCost({
      imageMegapixels: imageMP,
      regionCount: masks.length,
      hasControlNets: true
    });

    // TODO: Implement transaction-based credit reservation
    const reserved = true;
    const newBalance = 1000000;
    if (!reserved) {
      return res.status(402).json({
        message: 'Insufficient credits',
        required: estimatedCost,
        balance: newBalance
      });
    }

    // Create job + outbox atomically
    let result;
    try {
      result = await transaction(async (tx: any) => {
      const insert = await tx.execute(
        `
        INSERT INTO ai_enhancement_jobs (
          tenant_id, user_id, photo_id,
          idempotency_key,
          input_url, input_hash,
          masks, calibration_pixels_per_meter, options,
          provider, model,
          normalized_cache_key, provider_idempotency_key,
          reserved_cost_micros, status, progress_stage
        ) VALUES (
          $1,$2,$3,
          gen_random_uuid()::text,
          $4,$5,
          $6,$7,$8,
          $9,$10,
          $11,$12,
          $13,'queued','queued'
        )
        RETURNING id
        `,
        [
          tenantId,
          user.id,
          photoId || null,
          imageUrl,
          inputHash,
          JSON.stringify(masks),
          calibration ?? null,
          JSON.stringify(options),
          process.env.SAFE_MODE === '1' ? 'mock:inpaint' : 'comfy:inpaint', // Use mock in SAFE_MODE
          process.env.SAFE_MODE === '1' ? 'test-model' : 'sdxl',
          cacheKey,
          null, // provider_idempotency_key (will be set when provider acks)
          estimatedCost
        ]
      );

      const jobId = insert[0].id;

      // Construct callback URL for n8n webhook
      const appUrl = process.env.APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
      const callbackUrl = `${appUrl}/api/ai/enhancement/${jobId}/callback`;
      const callbackSecret = process.env.N8N_WEBHOOK_SECRET || 'secret';

      // CRITICAL FIX: Fetch photo from database to get correct dimensions
      // Client-provided dimensions may not match database
      let finalWidth = width;
      let finalHeight = height;

      if (photoId) {
        try {
          const photo = await storage.getPhoto(photoId);
          if (photo) {
            finalWidth = photo.width;
            finalHeight = photo.height;
            
            // Log warning if client provided different dimensions
            if (width && height) {
              const widthDiff = Math.abs(width - finalWidth);
              const heightDiff = Math.abs(height - finalHeight);
              if (widthDiff > 1 || heightDiff > 1) {
                console.warn(`[AIEnhancement] Dimension mismatch: client provided ${width}x${height}, database ${finalWidth}x${finalHeight}. Using database dimensions.`);
              }
            }
          }
        } catch (error) {
          console.warn(`[AIEnhancement] Failed to fetch photo ${photoId} for dimensions, using client-provided:`, error);
          // Fallback to client-provided dimensions
        }
      }

      const outboxPayload = {
        jobId,
        tenantId,
        userId: user.id,
        photoId,
        imageUrl,
        compositeImageUrl, // Client-exported canvas (image with masks applied)
        inputHash,
        masks,
        options,
        calibration,
        width: finalWidth,   // Use database dimensions
        height: finalHeight, // Use database dimensions
        callbackUrl,
        callbackSecret,
        provider: 'comfy:inpaint',
        model: 'sdxl'
      };

      console.log('[Create Enhancement] Creating outbox event for job:', jobId);
      console.log('[Create Enhancement] Masks received from client:', {
        masksCount: masks.length,
        masks: masks.map((m: any) => ({
          id: m.id,
          pointsCount: m.points?.length || 0,
          materialId: m.materialId
        }))
      });
      console.log('[Create Enhancement] Outbox payload preview:', JSON.stringify({
        jobId: outboxPayload.jobId,
        mode: outboxPayload.options?.mode,
        hasImageUrl: !!outboxPayload.imageUrl,
        masksCount: outboxPayload.masks.length,
        masks: outboxPayload.masks.map((m: any) => ({
          id: m.id,
          pointsCount: m.points?.length || 0,
          materialId: m.materialId
        })),
        callbackUrl: outboxPayload.callbackUrl
      }));

      await tx.execute(
        `INSERT INTO outbox (job_id, event_type, payload) VALUES ($1, 'enqueue_enhancement', $2)`,
        [
          jobId,
          JSON.stringify(outboxPayload)
        ]
      );

      console.log('[Create Enhancement] ✅ Outbox event created successfully');

      // CRITICAL FIX: Trigger outbox processor immediately instead of waiting for interval
      // This ensures webhook is sent promptly, especially important in Vercel serverless
      // where setInterval may not run reliably
      console.log('[Create Enhancement] 🔄 Triggering outbox processor immediately...');
      import('../jobs/outboxProcessor.js').then(({ processOutboxEvents }) => {
        console.log('[Create Enhancement] ✅ Outbox processor imported, calling processOutboxEvents()...');
        return processOutboxEvents();
      }).then(() => {
        console.log('[Create Enhancement] ✅ Outbox processor completed successfully');
      }).catch((e) => {
        console.error('[Create Enhancement] ❌ Failed to trigger outbox processor immediately:', e);
        console.error('[Create Enhancement] Error stack:', e instanceof Error ? e.stack : 'No stack trace');
        // Don't fail the request - processor will retry via interval if needed
      });

      return { id: jobId };
      });
    } catch (txErr: any) {
      console.error('[Create Enhancement] Transaction failed:', txErr.message);
      throw txErr;
    }
    
    const jobId = result?.[0]?.id || result?.id;
    
    if (!jobId) {
      console.error('[Create Enhancement] Job creation returned no ID');
      return res.status(500).json({ message: 'Failed to create job' });
    }

    res.json({ jobId, status: 'queued' });
  } catch (err: any) {
    console.error('[Create Enhancement] Error:', err?.message || err);
    console.error('[Create Enhancement] Stack:', err?.stack);
    return res.status(500).json({ message: 'Internal error creating enhancement job', error: err?.message });
  }
});

// GET /api/ai/enhancement - List recent jobs
router.get('/', authenticateSession, async (req, res) => {
  try {
    const user = req.session.user;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const rows = await executeQuery(
      `SELECT 
        id, status, progress_stage, progress_percent,
        error_message, created_at, updated_at, completed_at, options
      FROM ai_enhancement_jobs 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2`,
      [user.id, limit]
    );
    
    // Fetch variants for completed jobs and extract mode from options
    const jobs = await Promise.all(rows.map(async (job: any) => {
      // Extract mode from options JSONB
      let mode: 'add_pool' | 'add_decoration' | undefined;
      if (job.options) {
        try {
          const options = typeof job.options === 'string' ? JSON.parse(job.options) : job.options;
          mode = options.mode;
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      const jobWithMode = { ...job, mode };
      
      if (job.status === 'completed') {
        const variants = await executeQuery(
          `SELECT id, output_url as url, rank FROM ai_enhancement_variants WHERE job_id = $1 ORDER BY rank`,
          [job.id]
        );
        return { ...jobWithMode, variants };
      }
      return jobWithMode;
    }));
    
    res.json({ jobs });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to fetch jobs' });
  }
});

// GET /api/ai/enhancement/:id/stream
router.get('/:id/stream', authenticateSession, (req, res) => {
  const jobId = req.params.id;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');
  
  SSEManager.register(jobId, res);
  
  const ping = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);
  
  req.on('close', () => {
    clearInterval(ping);
    SSEManager.close(jobId);
  });
});

// POST /api/ai/enhancement/:id/cancel
router.post('/:id/cancel', authenticateSession, async (req, res) => {
  try {
    const jobId = req.params.id;
    const user = req.session.user;

    const rows = await executeQuery(
      `SELECT * FROM ai_enhancement_jobs WHERE id = $1`,
      [jobId]
    );
    
    if (!rows.length) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    if (rows[0].user_id !== user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    if (['completed', 'failed', 'canceled'].includes(rows[0].status)) {
      return res.status(400).json({ message: 'Job already finished' });
    }

    await executeQuery(
      `UPDATE ai_enhancement_jobs SET status = 'canceled', progress_stage = 'canceled', updated_at = NOW(), canceled_at = NOW() WHERE id = $1`,
      [jobId]
    );

    // Remove from Bull
    try {
      if (enhancementQueue) {
        const bullJob = await enhancementQueue.getJob(jobId);
        if (bullJob) await bullJob.remove();
      }
    } catch (error) {
      // Ignore
    }

    // Refund credits
    const refund = rows[0].reserved_cost_micros || rows[0].cost_micros || 0;
    if (refund > 0) {
      await CreditsManager.refundCredits(storage.db, rows[0].tenant_id, refund);
    }

    SSEManager.emit(jobId, { status: 'canceled', progress: 0 });
    res.json({ ok: true, status: 'canceled' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/ai/enhancement/:id/callback
router.post('/:id/callback', async (req, res) => {
  try {
    const jobId = req.params.id;
    // Support both header names for compatibility
    const sig = (req.headers['x-n8n-signature'] || req.headers['x-signature']) as string;
    const ts = req.headers['x-timestamp'] as string;
    const nonce = req.headers['x-nonce'] as string;

    // Nonce check (optional - skip if not provided for backward compatibility)
    if (nonce) {
      const nonceRows = await executeQuery(
        `SELECT 1 FROM webhook_nonces WHERE nonce = $1`,
        [nonce]
      );
      
      if (nonceRows.length) {
        return res.status(400).json({ message: 'Nonce already used' });
      }
      
      await executeQuery(
        `INSERT INTO webhook_nonces (nonce, job_id) VALUES ($1, $2)`,
        [nonce, jobId]
      );
    }

    // Verify signature
    if (!sig || !ts) {
      return res.status(400).json({ message: 'Missing signature or timestamp' });
    }

    const payload = JSON.stringify(req.body || {});
    const { valid } = verifyWebhookSignature(
      payload, 
      sig, 
      ts, 
      process.env.N8N_WEBHOOK_SECRET || 'secret'
    );
    
    if (!valid) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const cur = await executeQuery(
      `SELECT status FROM ai_enhancement_jobs WHERE id = $1`,
      [jobId]
    );
    
    if (!cur.length) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    if (['completed', 'failed', 'canceled'].includes(cur[0].status)) {
      return res.json({ ok: true, ignored: true });
    }

    // Process update
    const nextStatus = req.body.status || 'rendering';
    // Default progress to 100 if completed, otherwise use provided value or 50
    const nextProgress = nextStatus === 'completed' ? 100 : (req.body.progress ?? 50);
    
    // Handle error messages
    const errorMessage = req.body.error || req.body.errorMessage || req.body.error_message || null;
    const errorCode = req.body.error_code || req.body.errorCode || null;
    
    await executeQuery(
      `UPDATE ai_enhancement_jobs SET status = $2, progress_stage = $2, progress_percent = $3, 
       error_message = $4, error_code = $5, updated_at = NOW() WHERE id = $1`,
      [jobId, nextStatus, nextProgress, errorMessage, errorCode]
    );

    // Save variants if provided and status is completed
    // Handle both formats: variants array OR urls array (from n8n workflow)
    if (nextStatus === 'completed') {
      let variantsToSave: Array<{ url: string; rank: number }> = [];
      
      // Check for variants array format: [{ url, rank }]
      if (req.body.variants && Array.isArray(req.body.variants) && req.body.variants.length > 0) {
        variantsToSave = req.body.variants.map((v: any, index: number) => ({
          url: v.url || v,
          rank: v.rank !== undefined ? v.rank : index
        }));
      } 
      // Check for urls array format: ["url1", "url2"] (from n8n workflow)
      else if (req.body.urls && Array.isArray(req.body.urls) && req.body.urls.length > 0) {
        variantsToSave = req.body.urls.map((url: string, index: number) => ({
          url: url,
          rank: index
        }));
      }
      // Check for enhancedImageUrl (single URL)
      else if (req.body.enhancedImageUrl) {
        variantsToSave = [{ url: req.body.enhancedImageUrl, rank: 0 }];
      }

      // Save variants to database
      if (variantsToSave.length > 0) {
        for (const variant of variantsToSave) {
          try {
            await executeQuery(
              `INSERT INTO ai_enhancement_variants (job_id, output_url, rank) 
               VALUES ($1, $2, $3)`,
              [jobId, variant.url, variant.rank]
            );
          } catch (variantError: any) {
            console.error(`[Callback] Failed to save variant for job ${jobId}:`, variantError.message);
            // Continue with other variants even if one fails
          }
        }
        console.log(`[Callback] Saved ${variantsToSave.length} variant(s) for job ${jobId}`);
      }
    }

    // Update completed_at if status is completed
    if (nextStatus === 'completed') {
      await executeQuery(
        `UPDATE ai_enhancement_jobs SET completed_at = NOW() WHERE id = $1`,
        [jobId]
      );
    }
    
    SSEManager.emit(jobId, { status: nextStatus, progress: nextProgress });

    res.json({ ok: true });
  } catch (error: any) {
    console.error('[Callback] Error processing callback:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;

