-- Migration 023: User Onboarding System
-- Creates user_onboarding table to track onboarding progress for new users
-- This enables the multi-step onboarding flow for EasyFlow Studio

-- Create user_onboarding table
CREATE TABLE IF NOT EXISTS user_onboarding (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  step TEXT NOT NULL DEFAULT 'welcome',
  completed BOOLEAN DEFAULT FALSE,
  responses JSONB DEFAULT '{}'::jsonb,
  first_job_id UUID REFERENCES jobs(id),
  first_photo_id UUID REFERENCES photos(id),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_onboarding_completed ON user_onboarding(completed);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_step ON user_onboarding(step);

-- Add comments for documentation
COMMENT ON TABLE user_onboarding IS 'Tracks onboarding progress for new users';
COMMENT ON COLUMN user_onboarding.step IS 'Current onboarding step: welcome, industry_selection, questionnaire, preview, upload, material_demo, workspace_setup, completed';
COMMENT ON COLUMN user_onboarding.responses IS 'JSONB object storing user responses: {industry, role, useCase, experience}';
COMMENT ON COLUMN user_onboarding.first_job_id IS 'First job created during onboarding';
COMMENT ON COLUMN user_onboarding.first_photo_id IS 'First photo uploaded during onboarding';

