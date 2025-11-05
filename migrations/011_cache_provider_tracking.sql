-- migrations/011_cache_provider_tracking.sql

ALTER TABLE ai_enhancement_jobs
ADD COLUMN normalized_cache_key TEXT,
ADD COLUMN provider_idempotency_key TEXT;

CREATE INDEX idx_enhancement_cache_key ON ai_enhancement_jobs(normalized_cache_key) 
WHERE normalized_cache_key IS NOT NULL;

CREATE INDEX idx_enhancement_provider_idempotency ON ai_enhancement_jobs(provider_idempotency_key) 
WHERE provider_idempotency_key IS NOT NULL;

CREATE INDEX idx_enhancement_cache_tenant ON ai_enhancement_jobs(tenant_id, normalized_cache_key, status) 
WHERE normalized_cache_key IS NOT NULL AND status = 'completed';

ALTER TABLE ai_enhancement_jobs
ADD CONSTRAINT unique_provider_job UNIQUE(provider, job_ref);

