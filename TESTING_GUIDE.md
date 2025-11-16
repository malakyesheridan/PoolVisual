# Testing Guide: System Mask Query Fix

This guide explains how to test the RLS bypass fix for the outbox processor.

## Problem

The outbox processor was finding 0 masks while the diagnostic endpoint found 1 mask for the same `photoId`. This was caused by Row Level Security (RLS) policies blocking queries from background processes that don't have user session context.

## Solution

Created a PostgreSQL function `get_masks_by_photo_system()` with `SECURITY DEFINER` that bypasses RLS policies. This allows system operations (like the outbox processor) to query masks without being blocked.

## Files Changed

1. **Migration**: `migrations/010_system_mask_query.sql`
   - Creates the `get_masks_by_photo_system()` function
   - Grants execute permission to all users

2. **TypeScript Wrapper**: `server/lib/systemQueries.ts`
   - Provides `getMasksByPhotoSystem()` function
   - Converts database column names to camelCase

3. **Outbox Processor**: `server/jobs/outboxProcessor.ts`
   - Now uses `getMasksByPhotoSystem()` instead of `storage.getMasksByPhoto()`
   - Includes fallback to regular method if system function fails

4. **Test Script**: `test-system-mask-query.ts`
   - Comprehensive test suite to verify the fix works

## Testing Steps

### Step 1: Run the Migration

First, apply the database migration to create the system function:

```bash
# Option 1: If using psql directly
psql $DATABASE_URL -f migrations/010_system_mask_query.sql

# Option 2: If using a migration tool, add this migration to your migration runner
```

### Step 2: Run the Test Suite

Run the automated test suite to verify everything works:

```bash
npm run test:system-masks
```

The test suite will:
1. ✅ Verify the function exists in the database
2. ✅ Check that it has `SECURITY DEFINER` (bypasses RLS)
3. ✅ Find a photo with masks in your database
4. ✅ Test the SQL function directly
5. ✅ Test the TypeScript wrapper function
6. ✅ Compare results with regular storage method
7. ✅ Test error handling with invalid photoId

### Step 3: Manual Testing

After the automated tests pass, test the actual enhancement flow:

1. **Create a mask on a photo** in the editor
2. **Save the mask** to the database
3. **Create an enhancement job** (click "Enhance")
4. **Check the Vercel logs** for the outbox processor:
   - Should see: `✅ getMasksByPhotoSystem succeeded: X masks`
   - Should see: `queryMethod: 'system_function_bypass_rls'`
5. **Verify the webhook payload** includes the composite image with masks applied

### Step 4: Verify in Production

1. Check that the webhook receives the correct composite image
2. Verify that masks are visible in the composite
3. Check Vercel logs to confirm no RLS-related errors

## Expected Test Results

```
=== System Mask Query Function Tests ===

Test 1: Checking if get_masks_by_photo_system function exists...
✅ PASS
   Details: {
     "name": "get_masks_by_photo_system",
     "isSecurityDefiner": true,
     "note": "✅ Function has SECURITY DEFINER (will bypass RLS)"
   }

Test 2: Finding a photo with masks in database...
✅ PASS
   Details: { "photoId": "d97bfeba-e660-4f08-a139-965091db9c81" }

Test 3: Testing system function with SQL...
✅ PASS
   Details: {
     "masksFound": 1,
     "maskIds": ["60892e63-0b6c-4354-83a7-385328a5e49a"]
   }

Test 4: Testing TypeScript wrapper function...
✅ PASS
   Details: {
     "masksFound": 1,
     "maskIds": ["60892e63-0b6c-4354-83a7-385328a5e49a"],
     "hasPhotoId": true,
     "hasPathJson": true
   }

Test 5: Comparing with regular storage.getMasksByPhoto()...
✅ PASS
   Details: {
     "regularMethodCount": 1,
     "systemMethodCount": 1,
     "countsMatch": true,
     "idsMatch": true,
     "note": "✅ Both methods return same results"
   }

Test 6: Testing with invalid photoId...
✅ PASS
   Details: {
     "masksFound": 0,
     "expected": 0
   }

=== Summary ===
Total tests: 6
Passed: 6
Failed: 0

✅ All tests passed! The system mask query function is working correctly.
```

## Troubleshooting

### Test Fails: "Function not found"
- **Solution**: Run the migration first: `psql $DATABASE_URL -f migrations/010_system_mask_query.sql`

### Test Fails: "No photos with masks found"
- **Solution**: Create a mask on a photo first, then run the test again

### Test Fails: "Function missing SECURITY DEFINER"
- **Solution**: The migration didn't apply correctly. Re-run it and check the function definition.

### Outbox Processor Still Finds 0 Masks
- **Check Vercel logs** for error messages
- **Verify** the migration was applied in production
- **Check** that `getMasksByPhotoSystem` is being called (look for log: `Calling getMasksByPhotoSystem`)

## Rollback Plan

If the fix causes issues, you can rollback:

1. **Revert code changes** in `server/jobs/outboxProcessor.ts` to use `storage.getMasksByPhoto()`
2. **Keep the migration** (the function won't hurt if unused)
3. **Or drop the function**: `DROP FUNCTION IF EXISTS get_masks_by_photo_system(UUID);`

## Additional Notes

- The system function only bypasses RLS for **reading** masks, not writing
- The function is read-only and safe to use in production
- Regular user-facing queries still use `storage.getMasksByPhoto()` which respects RLS
- Only system/background processes use the bypass function

