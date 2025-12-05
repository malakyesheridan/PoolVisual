-- Migration 042: Add Referral Rewards System
-- Implements referral tracking and rewards for user referrals

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded')),
  referrer_rewarded BOOLEAN DEFAULT FALSE,
  referee_rewarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(referee_user_id) -- Prevent duplicate referrals for same referee
);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- Add referral tracking fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referral_rewards_earned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_rewards_limit INTEGER DEFAULT 200;

-- Generate unique referral codes for existing users (using user ID as base)
-- This will be handled in the application code, but we ensure the column exists

-- Add comment for documentation
COMMENT ON TABLE referrals IS 'Tracks user referrals and reward status';
COMMENT ON COLUMN referrals.referrer_user_id IS 'User who made the referral';
COMMENT ON COLUMN referrals.referee_user_id IS 'User who was referred';
COMMENT ON COLUMN referrals.status IS 'Status: pending (signup), completed (onboarding done), rewarded (enhancements given)';
COMMENT ON COLUMN referrals.referrer_rewarded IS 'Whether referrer has received their 20 enhancement reward';
COMMENT ON COLUMN referrals.referee_rewarded IS 'Whether referee has received their optional 10 enhancement reward';
COMMENT ON COLUMN users.referral_code IS 'Unique referral code for this user';
COMMENT ON COLUMN users.referral_rewards_earned IS 'Total enhancements earned from referrals (max 200)';
COMMENT ON COLUMN users.referral_rewards_limit IS 'Maximum enhancements that can be earned from referrals (default 200)';

