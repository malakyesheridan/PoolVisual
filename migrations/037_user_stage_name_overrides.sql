-- Migration: Add user-specific stage name overrides
-- Allows users to customize stage display names without changing stage IDs

-- User stage name overrides table
CREATE TABLE IF NOT EXISTS user_stage_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  stage_id UUID REFERENCES pipeline_stages(id) ON DELETE CASCADE NOT NULL,
  custom_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, stage_id)
);

-- Indexes for user_stage_names
CREATE INDEX IF NOT EXISTS idx_user_stage_names_user ON user_stage_names(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stage_names_stage ON user_stage_names(stage_id);
CREATE INDEX IF NOT EXISTS idx_user_stage_names_user_stage ON user_stage_names(user_id, stage_id);

-- Add comments
COMMENT ON TABLE user_stage_names IS 'User-specific custom names for pipeline stages. If a user has a custom name for a stage, it will be used instead of the default stage name.';

