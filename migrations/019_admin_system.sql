-- Migration 019: Admin System
-- Adds admin fields to users table and creates admin_actions audit table
-- This enables role-based admin access with full system permissions

-- Add admin fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS admin_permissions JSONB DEFAULT '[]'::jsonb;

-- Create admin_actions table for audit logging
CREATE TABLE IF NOT EXISTS admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient admin queries
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_user_id ON admin_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action_type ON admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_resource ON admin_actions(resource_type, resource_id) WHERE resource_type IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.is_admin IS 'Whether this user has admin privileges. Admins bypass RLS and have full system access.';
COMMENT ON COLUMN users.admin_permissions IS 'JSON array of permission strings. ["*"] grants all permissions.';
COMMENT ON TABLE admin_actions IS 'Audit log of all administrative actions for security and compliance.';
COMMENT ON COLUMN admin_actions.action_type IS 'Type of action performed (e.g., user.create, org.delete, settings.update)';
COMMENT ON COLUMN admin_actions.resource_type IS 'Type of resource affected (e.g., user, organization, job)';
COMMENT ON COLUMN admin_actions.resource_id IS 'ID of the resource affected by this action';

-- Create helper function to check if user is admin (for RLS policies)
CREATE OR REPLACE FUNCTION is_admin_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 FROM users 
        WHERE id = user_uuid AND is_admin = true AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for function
COMMENT ON FUNCTION is_admin_user(UUID) IS 'Returns true if the user is an active admin. Used in RLS policies to grant admin access.';

