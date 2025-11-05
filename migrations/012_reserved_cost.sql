-- migrations/012_reserved_cost.sql

ALTER TABLE ai_enhancement_jobs
ADD COLUMN IF NOT EXISTS reserved_cost_micros BIGINT DEFAULT 0;

