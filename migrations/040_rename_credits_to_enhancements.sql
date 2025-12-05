-- Migration 040: Rename Credits to Enhancements
-- Replaces the credit system with a simpler enhancement quota system
-- All enhancements now cost 1 enhancement (no variable pricing)

-- Step 1: Rename the constraint (drop old, add new)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credits_balance_non_negative') THEN
    ALTER TABLE users DROP CONSTRAINT credits_balance_non_negative;
  END IF;
END $$;

-- Step 2: Rename credits_balance column to enhancements_balance
ALTER TABLE users 
  RENAME COLUMN credits_balance TO enhancements_balance;

-- Step 3: Add new constraint with enhancements name
ALTER TABLE users 
  ADD CONSTRAINT enhancements_balance_non_negative 
  CHECK (enhancements_balance >= 0);

-- Step 4: Rename trial_credits_granted to trial_enhancements_granted
ALTER TABLE users 
  RENAME COLUMN trial_credits_granted TO trial_enhancements_granted;

-- Step 5: Add comment for documentation
COMMENT ON CONSTRAINT enhancements_balance_non_negative ON users IS 'Ensures enhancements_balance cannot be negative. Enforced at database level for data integrity.';

-- Step 6: Update any indexes that reference credits_balance
-- (If any exist, they will be automatically updated by the column rename)

