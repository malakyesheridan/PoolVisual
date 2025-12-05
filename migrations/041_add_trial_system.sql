-- Migration 041: Add Free Trial System
-- Implements 7-day free trial with 30 enhancements, no credit card required

-- Add trial fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS trial_enhancements INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE;

-- Add index for efficient trial expiration queries
CREATE INDEX IF NOT EXISTS idx_users_trial_active ON users(is_trial, trial_start_date) 
WHERE is_trial = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN users.is_trial IS 'True if user is currently in their 7-day free trial';
COMMENT ON COLUMN users.trial_start_date IS 'Timestamp when the trial began';
COMMENT ON COLUMN users.trial_enhancements IS 'Number of trial enhancements remaining (starts at 30)';
COMMENT ON COLUMN users.has_used_trial IS 'True if user has already used their free trial (prevents duplicate trials)';

