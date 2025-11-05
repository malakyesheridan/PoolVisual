-- Migration 004: Password Reset and Email Verification
-- Adds password reset and email verification fields to existing users table

-- Add password reset fields
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN password_reset_token TEXT;
ALTER TABLE users ADD COLUMN password_reset_expires TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX idx_users_email_verified ON users(email_verified);

-- Add comments for documentation
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.password_reset_token IS 'Temporary token for password reset (hashed)';
COMMENT ON COLUMN users.password_reset_expires IS 'Expiration time for password reset token';

-- Create function to clean up expired password reset tokens
CREATE OR REPLACE FUNCTION cleanup_expired_password_resets()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    UPDATE users 
    SET password_reset_token = NULL, 
        password_reset_expires = NULL 
    WHERE password_reset_expires < NOW();
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate secure password reset token
CREATE OR REPLACE FUNCTION generate_password_reset_token()
RETURNS TEXT AS $$
BEGIN
    -- Generate a secure random token
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Add audit log entry for this migration
INSERT INTO audit_logs (org_id, user_id, action, entity, payload_json, created_at)
VALUES (
    NULL, -- System migration
    NULL, -- System migration
    'SCHEMA_MIGRATION',
    'users',
    '{"migration": "004_password_reset", "description": "Added password reset and email verification fields"}'::jsonb,
    NOW()
);
