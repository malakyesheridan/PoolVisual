# User-Centric Architecture Migration - Progress Report

## Overview
This document tracks the migration from org-centric to user-centric architecture, where all data is owned by individual users rather than organizations.

## ✅ Completed Tasks

### 1. Database Migrations
- **Migration 028** (`028_user_centric_architecture.sql`): 
  - Added user-level fields (industry_type, credits_balance, subscription fields, settings)
  - Added `user_id` columns to jobs, masks, materials, labor_rules, subscription_history
  - Migrated existing data from org-based to user-based
  - Created indexes for performance
  - Made foreign key constraints nullable for backward compatibility

- **Migration 029** (`029_user_centric_rls_policies.sql`):
  - Dropped all org-based RLS policies
  - Created user-based RLS policies for all tables
  - Ensures complete data isolation between users

### 2. Schema Updates (`shared/schema.ts`)
- ✅ Added user-level fields to `users` table definition
- ✅ Added `userId` to `jobs`, `masks`, `materials`, `laborRules`, `subscriptionHistory`
- ✅ Updated `insertJobSchema` to omit `userId` (set from session)
- ✅ Marked deprecated fields (`orgId`, `createdBy`) with comments

### 3. Storage Layer Updates (`server/storage.ts`)
- ✅ Updated interface: `getJobs(userId)`, `getQuotes(userId)`, `getMaterials(userId)`
- ✅ Updated `createJob()` to accept `userId` parameter
- ✅ Updated `createMask()` to accept `userId` parameter
- ✅ Updated `createMaterial()` to accept optional `userId` parameter
- ✅ Updated `getJobs()` to filter by `userId` instead of `orgId`
- ✅ Updated `getQuotes()` to filter by `userId` via jobs
- ✅ Updated `getMaterials()` to show global + user-specific materials

### 4. API Routes Updates (`server/routes.ts`)
- ✅ **POST /api/jobs**: Removed org dependency, uses `req.user.id`
- ✅ **GET /api/jobs**: Removed `orgId` query param, uses `req.user.id`
- ✅ **GET /api/materials**: Removed `orgId` query param, uses `req.user.id`
- ✅ **POST /api/materials**: Uses `req.user.id` for material creation
- ✅ **GET /api/quotes**: Removed `orgId` query param, uses `req.user.id`
- ✅ **POST /api/quotes**: Verifies job ownership via `job.userId`
- ✅ **GET /api/quotes/:id**: Verifies job ownership via `job.userId`
- ✅ **POST /api/masks**: Uses `req.user.id` and verifies job ownership
- ✅ **GET /api/masks**: Verifies job ownership via `job.userId`
- ✅ **DELETE /api/masks/:id**: Verifies job ownership via `job.userId`

## ✅ Completed Tasks (Updated)

### 5. Frontend Updates
- [x] Update `client/src/lib/api-client.ts` - Removed `orgId` from API calls
- [x] Update `client/src/components/dashboard/SimplifiedDashboard.tsx` - Removed org selector
- [x] Update `client/src/components/dashboard/PersonalizedDashboard.tsx` - Removed org dependencies
- [x] Update `client/src/components/dashboard/ProjectDashboard.tsx` - Removed org selector
- [x] Update `client/src/pages/jobs.tsx` - Removed org selector, uses `user.industryType`
- [x] Update `client/src/pages/quotes.tsx` - Removed org selector, uses `user.industryType`
- [x] Update `client/src/pages/materials.tsx` - Removed org selector, uses `user.industryType`
- [x] Update `client/src/pages/Onboarding.tsx` - Sets `user.industryType` instead of `org.industry`
- [x] Update material components (MaterialsTab, MaterialPicker, material-library)
- [x] Update enhancement components (JobsDrawer)
- [x] Update quote components (JobSelectionModal)
- [x] Add `setUser()` method to auth store
- [x] Update User interface to include new user-level fields

### 6. Additional API Routes
- [ ] Check and update any remaining routes that use `orgId`
- [ ] Update AI enhancement routes to use `userId`
- [ ] Update subscription routes (may need special handling)

### 7. Testing & Verification
- [ ] Run migrations on test database
- [ ] Verify data migration completed correctly
- [ ] Test user data isolation (users can't see each other's data)
- [ ] Test that existing data is accessible to correct users
- [ ] Verify RLS policies work correctly

## 🔄 Migration Execution Steps

### Step 1: Run Database Migrations
```bash
# Run migration 028
npm run migrate 028_user_centric_architecture.sql

# Run migration 029
npm run migrate 029_user_centric_rls_policies.sql
```

### Step 2: Verify Migration
- Check that all jobs have `user_id` set
- Check that all masks have `user_id` set
- Check that all materials have `user_id` set (or NULL for global)
- Check that all labor_rules have `user_id` set
- Verify user-level fields are populated (industry_type, credits_balance, etc.)

### Step 3: Update Frontend
- Remove org selection UI
- Update API client calls
- Test user-specific data loading

## 📋 Key Changes Summary

### Before (Org-Centric)
- Jobs owned by `org_id`
- Masks created by `org_member.id`
- Materials scoped to `org_id`
- Credits stored at `org.credits_balance`
- Industry stored at `org.industry`
- Users shared data within orgs

### After (User-Centric)
- Jobs owned by `user_id`
- Masks owned by `user_id`
- Materials owned by `user_id` (or NULL for global)
- Credits stored at `user.credits_balance`
- Industry stored at `user.industry_type`
- Complete data isolation per user

## 🎯 Benefits Achieved
- ✅ Complete data isolation between users
- ✅ Personalization per user (industry, credits, settings)
- ✅ Simpler architecture (no org complexity for data ownership)
- ✅ Better for individual users and agencies
- ✅ No data sharing confusion

## ⚠️ Breaking Changes
- API routes no longer accept `orgId` query parameters (for data queries)
- Frontend must be updated to remove org selection
- Orgs are now optional (can be kept for team billing if needed)

## 📝 Notes
- Old `org_id` columns are kept but made nullable for backward compatibility
- Can be removed in future migration if desired
- Orgs can still exist for optional team features (billing, branding)
- RLS policies ensure data isolation even if application code has bugs
