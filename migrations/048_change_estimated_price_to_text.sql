-- Migration 048: Change estimated_price from numeric to text
-- Allows storing special values like "POA", "$600,000", "Contact for price", etc.

-- Change the column type from numeric to text
ALTER TABLE jobs 
  ALTER COLUMN estimated_price TYPE TEXT USING estimated_price::TEXT;

-- Add a comment explaining the change
COMMENT ON COLUMN jobs.estimated_price IS 'Property estimated price. Can be a number (e.g., "600000") or special text (e.g., "POA", "$600,000", "Contact for price").';

