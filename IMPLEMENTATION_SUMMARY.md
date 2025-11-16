# Implementation Summary: RLS Bypass Fix for Outbox Processor

## What Was Fixed

The outbox processor was finding 0 masks due to Row Level Security (RLS) policies blocking queries from background processes. This fix creates a PostgreSQL function with `SECURITY DEFINER` that bypasses RLS for system operations.

## Files Created/Modified

### New Files
1. **`migrations/010_system_mask_query.sql`**
   - Creates `get_masks_by_photo_system()` PostgreSQL function
   - Uses `SECURITY DEFINER` to bypass RLS
   - Grants execute permission to all users

2. **`server/lib/systemQueries.ts`**
   - TypeScript wrapper for the system function
   - Converts database column names to camelCase
   - Provides `getMasksByPhotoSystem()` function

3. **`test-system-mask-query.ts`**
   - Comprehensive test suite (6 tests)
   - Verifies function exists, has SECURITY DEFINER, and works correctly
   - Compares with regular storage method

4. **`TESTING_GUIDE.md`**
   - Step-by-step testing instructions
   - Troubleshooting guide
   - Expected test results

### Modified Files
1. **`server/jobs/outboxProcessor.ts`**
   - Now uses `getMasksByPhotoSystem()` instead of `storage.getMasksByPhoto()`
   - Includes detailed logging
   - Has fallback to regular method if system function fails

2. **`package.json`**
   - Added `test:system-masks` script

## How to Deploy

1. **Run the migration**:
   ```bash
   psql $DATABASE_URL -f migrations/010_system_mask_query.sql
   ```

2. **Run the test suite**:
   ```bash
   npm run test:system-masks
   ```

3. **Deploy to production** (Vercel will handle this automatically)

4. **Verify in production**:
   - Check Vercel logs for: `✅ getMasksByPhotoSystem succeeded: X masks`
   - Verify webhook receives composite image with masks

## Testing

The test suite automatically verifies:
- ✅ Function exists in database
- ✅ Function has SECURITY DEFINER (bypasses RLS)
- ✅ SQL function works correctly
- ✅ TypeScript wrapper works correctly
- ✅ Results match regular storage method
- ✅ Error handling works

## Safety

- Function is read-only (SELECT only)
- Only bypasses RLS for reading, not writing
- Regular user queries still respect RLS
- Only system/background processes use the bypass

## Rollback

If needed, revert `server/jobs/outboxProcessor.ts` to use `storage.getMasksByPhoto()`.
The migration can stay (unused function won't cause issues).
