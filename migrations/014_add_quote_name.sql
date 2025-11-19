-- Add name column to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS name TEXT;

