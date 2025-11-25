-- Migration 016: Authentication Security Enhancements
-- Adds security fields to users table and creates login attempt audit table

-- Add security fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

-- Set default values for existing users
UPDATE users 
SET is_active = TRUE, 
    failed_login_attempts = 0,
    login_count = 0
WHERE is_active IS NULL OR failed_login_attempts IS NULL OR login_count IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_verified_at ON users(email_verified_at) WHERE email_verified_at IS NOT NULL;

-- Create login_attempts audit table
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for login_attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success ON login_attempts(success);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address) WHERE ip_address IS NOT NULL;

-- Create security_events table for audit trail
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    event_type TEXT NOT NULL, -- 'login', 'logout', 'password_reset', 'account_locked', 'account_unlocked', etc.
    ip_address TEXT,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for security_events
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- Create verification_tokens table for email verification
CREATE TABLE IF NOT EXISTS verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- Email address
    token TEXT NOT NULL UNIQUE, -- 64-char hex token
    expires TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for verification_tokens
CREATE INDEX IF NOT EXISTS idx_verification_tokens_identifier ON verification_tokens(identifier);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON verification_tokens(expires);

-- Add comments for documentation
COMMENT ON COLUMN users.locked_until IS 'Account lockout expiration timestamp. Account is locked if this is in the future.';
COMMENT ON COLUMN users.failed_login_attempts IS 'Number of consecutive failed login attempts. Resets on successful login.';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of last successful login.';
COMMENT ON COLUMN users.login_count IS 'Total number of successful logins.';
COMMENT ON COLUMN users.is_active IS 'Whether the account is active. Inactive accounts cannot log in.';
COMMENT ON COLUMN users.email_verified_at IS 'Timestamp when email was verified. NULL means not verified.';

COMMENT ON TABLE login_attempts IS 'Audit trail of all login attempts (successful and failed)';
COMMENT ON TABLE security_events IS 'Security event audit trail for compliance and monitoring';
COMMENT ON TABLE verification_tokens IS 'Email verification and password reset tokens';

