-- Migration 039: Prevent Negative Credits
-- Adds CHECK constraint to ensure credits_balance cannot go negative
-- This provides database-level enforcement in addition to application logic

-- Step 1: Ensure all existing balances are non-negative (safety check)
UPDATE users 
SET credits_balance = 0 
WHERE credits_balance < 0;

-- Step 2: Add CHECK constraint to prevent negative credits
-- Drop existing constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credits_balance_non_negative') THEN
    ALTER TABLE users DROP CONSTRAINT credits_balance_non_negative;
  END IF;
END $$;

-- Add CHECK constraint
ALTER TABLE users 
  ADD CONSTRAINT credits_balance_non_negative 
  CHECK (credits_balance >= 0);

-- Add comment for documentation
COMMENT ON CONSTRAINT credits_balance_non_negative ON users IS 'Ensures credits_balance cannot be negative. Enforced at database level for data integrity.';

