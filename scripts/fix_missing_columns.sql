-- Fix missing columns in ai_enhancement_jobs
ALTER TABLE ai_enhancement_jobs
ADD COLUMN IF NOT EXISTS normalized_cache_key TEXT;

ALTER TABLE ai_enhancement_jobs
ADD COLUMN IF NOT EXISTS provider_idempotency_key TEXT;

ALTER TABLE ai_enhancement_jobs
ADD COLUMN IF NOT EXISTS reserved_cost_micros INTEGER;

