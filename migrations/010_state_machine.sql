-- migrations/010_state_machine.sql

CREATE OR REPLACE FUNCTION enforce_enhancement_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "queued": ["downloading", "rendering", "canceled", "failed"],
    "downloading": ["preprocessing", "canceled", "failed"],
    "preprocessing": ["rendering", "canceled", "failed"],
    "rendering": ["postprocessing", "canceled", "failed"],
    "postprocessing": ["uploading", "canceled", "failed"],
    "uploading": ["completed", "canceled", "failed"],
    "completed": [],
    "failed": [],
    "canceled": []
  }'::JSONB;
  
  allowed_statuses TEXT[];
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  
  allowed_statuses := ARRAY(
    SELECT jsonb_array_elements_text(
      valid_transitions->COALESCE(OLD.status, 'queued')
    )
  );
  
  IF NOT (NEW.status = ANY(allowed_statuses)) THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %. Allowed: %', 
      OLD.status, NEW.status, allowed_statuses;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enhancement_status_check
BEFORE UPDATE ON ai_enhancement_jobs
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION enforce_enhancement_status_transition();

