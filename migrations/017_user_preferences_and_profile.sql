-- Migration 017: User Preferences and Profile Fields
-- Adds user preferences table and profile fields to users table

-- Add profile fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    date_format TEXT DEFAULT 'dd/mm/yyyy' NOT NULL,
    measurement_units TEXT DEFAULT 'metric' NOT NULL,
    language TEXT DEFAULT 'en' NOT NULL,
    theme TEXT DEFAULT 'light' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for user_preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_preferences_updated_at();

-- Add comments for documentation
COMMENT ON COLUMN users.display_name IS 'User display name (can differ from username)';
COMMENT ON COLUMN users.avatar_url IS 'URL to user avatar/profile picture';
COMMENT ON COLUMN users.timezone IS 'User timezone (e.g., UTC, Australia/Sydney)';
COMMENT ON TABLE user_preferences IS 'User-specific preferences for UI customization';
COMMENT ON COLUMN user_preferences.date_format IS 'Preferred date format (dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd)';
COMMENT ON COLUMN user_preferences.measurement_units IS 'Preferred measurement units (metric, imperial)';
COMMENT ON COLUMN user_preferences.language IS 'Preferred language code (en, etc.)';
COMMENT ON COLUMN user_preferences.theme IS 'UI theme preference (light, dark, auto)';

