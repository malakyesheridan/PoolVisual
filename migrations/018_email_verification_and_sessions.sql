-- Migration 018: Email Verification and Active Sessions Management
-- Adds email verification fields to users table and creates user_sessions table

-- Add email verification fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

-- Create user_sessions table for tracking active sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    device_info JSONB,
    ip_address TEXT,
    user_agent TEXT,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON user_sessions(last_active);

-- Add comments for documentation
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address.';
COMMENT ON COLUMN users.email_verified_at IS 'Timestamp when the user verified their email.';
COMMENT ON TABLE user_sessions IS 'Tracks active user sessions for security and management.';
COMMENT ON COLUMN user_sessions.device_info IS 'JSON object containing device type, browser, OS information.';
COMMENT ON COLUMN user_sessions.session_id IS 'Iron session ID for tracking specific sessions.';

