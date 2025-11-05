-- migrations/007_ai_enhancement_system.sql

-- Main jobs table
CREATE TABLE ai_enhancement_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  photo_id UUID REFERENCES photos(id),
  photo_version_id UUID,
  
  -- External tracking
  job_ref TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  
  -- Input data
  input_url TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  
  -- Geometry & calibration
  masks JSONB NOT NULL CHECK (jsonb_typeof(masks) = 'array'),
  calibration_pixels_per_meter NUMERIC(10,4),
  
  -- Control assets
  control_canny_url TEXT,
  control_depth_url TEXT,
  control_normal_url TEXT,
  
  -- Options
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Provider details
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  seed BIGINT,
  
  -- Provider tracking
  provider_idempotency_key TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'downloading', 'preprocessing', 'rendering', 
               'postprocessing', 'uploading', 'completed', 'failed', 'canceled')
  ),
  
  -- Progress
  progress_stage TEXT,
  progress_percent INTEGER CHECK (progress_percent >= 0 AND progress_percent <= 100),
  
  -- Cost & attempts
  cost_micros BIGINT DEFAULT 0,
  reserved_cost_micros BIGINT DEFAULT 0,
  attempts INT DEFAULT 0,
  
  -- Error tracking
  error_type TEXT,
  error_message TEXT,
  error_code TEXT,
  error_stack TEXT,
  error_context JSONB,
  warnings JSONB,
  
  -- Timing
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  canceled_at TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Variants table
CREATE TABLE ai_enhancement_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES ai_enhancement_jobs(id) ON DELETE CASCADE,
  
  output_url TEXT NOT NULL,
  output_hash TEXT,
  
  rank INTEGER DEFAULT 1,
  score NUMERIC,
  
  variant_type TEXT,
  variant_index INTEGER,
  
  accepted_photo_version_id UUID REFERENCES photos(id),
  accepted_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_jobs_tenant_created ON ai_enhancement_jobs(tenant_id, created_at DESC);
CREATE INDEX idx_ai_jobs_status ON ai_enhancement_jobs(status) WHERE status IN ('queued', 'rendering');
CREATE INDEX idx_ai_jobs_hash ON ai_enhancement_jobs(input_hash) WHERE status = 'completed';
CREATE INDEX idx_ai_jobs_idempotency ON ai_enhancement_jobs(idempotency_key);
CREATE INDEX idx_ai_variants_job ON ai_enhancement_variants(job_id);

-- Tenant isolation trigger
CREATE OR REPLACE FUNCTION ensure_ai_job_tenant_isolation()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members 
    WHERE user_id = NEW.user_id AND org_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'User % does not belong to tenant %', NEW.user_id, NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_ai_job_tenant_check
  BEFORE INSERT ON ai_enhancement_jobs
  FOR EACH ROW
  EXECUTE FUNCTION ensure_ai_job_tenant_isolation();

