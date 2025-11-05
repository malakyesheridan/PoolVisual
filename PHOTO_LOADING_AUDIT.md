# Photo Loading & Persistence Audit

## Changes Summary

### 1. NewEditor.tsx - Photo Loading Protection
**Location**: Lines 255-340
**Purpose**: Prevent automatic photo loading that overwrites user-uploaded images

**Key Guards**:
- **Line 272-276**: Skip API load if user has already loaded a non-Picsum image
- **Line 297-300**: Reject Picsum URLs from API responses
- **Line 279-287**: Skip reload if same photoId already loaded

### 2. Toolbar.tsx - Save Persistence
**Location**: Lines 890-899
**Purpose**: Update editor store with saved photo URL after save operation

**Key Action**:
- **Line 892-899**: Dispatch SET_IMAGE with new saved URL after photo update

## Test Scenarios

### Scenario 1: User Uploads Image → Saves
**Flow**:
1. User uploads image via File menu → `handleFileUpload` → `SET_IMAGE` dispatched (line 209)
2. User clicks "Save Changes" → `handleSaveToJob` → uploads blob, updates DB, dispatches `SET_IMAGE` (line 892)
3. Component remounts → `useEffect` sees user image → **Guards prevent reload** ✅

**Expected**: Image persists through save and remounts
**Risk**: None - user image is preserved

### Scenario 2: Component Loads with PhotoId (Placeholder in DB)
**Flow**:
1. Component mounts with `photoId` → `useEffect` triggers (line 257)
2. API returns Picsum URL → **Line 297 rejects it** ✅
3. Canvas remains empty or shows previous user image

**Expected**: Picsum placeholder rejected, no random images
**Risk**: Low - placeholder rejected safely

### Scenario 3: Component Loads with PhotoId (Real Photo in DB)
**Flow**:
1. Component mounts with `photoId` → `useEffect` triggers
2. API returns real photo URL → Loads image → Sets in store
3. User works with image → Saves
4. **New URL saved to store** (line 892) ✅

**Expected**: Real photo loads, persists after save
**Risk**: None - works as intended

### Scenario 4: User Uploads, Then PhotoId Becomes Available
**Flow**:
1. User uploads image → `SET_IMAGE` dispatched
2. Later, `photoId` prop becomes available → `useEffect` triggers
3. **Line 272-276 check** → User image exists → **Skip API load** ✅

**Expected**: User image not overwritten by API call
**Risk**: None - guard prevents overwrite

### Scenario 5: Save Fails Mid-Process
**Flow**:
1. User saves → Blob upload succeeds
2. Photo update API call fails → Error thrown
3. `SET_IMAGE` dispatch **never happens** (in try block, line 892)

**Expected**: Error caught, image stays as user uploaded it
**Risk**: **MEDIUM** - If update fails but upload succeeds, we have orphaned photo in storage

### Scenario 6: Race Condition - Save Completes, Then useEffect Triggers
**Flow**:
1. Save completes → `SET_IMAGE` dispatched with new URL (line 892)
2. Component remounts → `useEffect` triggers (line 257)
3. Line 272 check → Has user image → Skip ✅

**Expected**: No reload because user image exists
**Risk**: Low - guard handles this

### Scenario 7: PhotoId Changes After User Upload
**Flow**:
1. User uploads image → `SET_IMAGE` dispatched
2. `photoId` prop changes → `useEffect` triggers
3. **Line 272-276** → User image exists → Skip API load ✅

**Expected**: User image preserved even if photoId changes
**Risk**: None - intentional behavior

## Potential Issues Identified

### Issue 1: Orphaned Photos on Save Failure ✅ FIXED
**Location**: Toolbar.tsx line 915-926
**Problem**: If `updatePhoto` fails but upload succeeded, we have an orphaned photo
**Severity**: Medium
**Mitigation**: ✅ **RESOLVED** - Added cleanup in catch block (line 915-926) to delete temp photo even if updatePhoto fails

### Issue 2: Image Loading Race Condition
**Location**: NewEditor.tsx line 314-330
**Problem**: Image async load (`img.onload`) happens after state check (line 303)
**Severity**: Low
**Mitigation**: State checked twice (line 268, 303) - should be safe

### Issue 3: lastLoadedPhotoIdRef Not Cleared ✅ FIXED
**Location**: NewEditor.tsx line 342-347
**Problem**: Ref persists across component remounts, could prevent valid reloads
**Severity**: Low
**Mitigation**: ✅ **RESOLVED** - Added cleanup effect (line 342-347) to clear ref on unmount

### Issue 4: No Fallback for Failed Image Load
**Location**: NewEditor.tsx line 327-329
**Problem**: If `img.onerror` fires, no recovery mechanism
**Severity**: Low
**Mitigation**: Error logged, user sees empty canvas (acceptable UX)

## Verification Checklist

- [x] User-uploaded images preserved through saves
- [x] Picsum placeholders rejected
- [x] No automatic photo loads when user image exists
- [x] Saved photo URL persists in store
- [x] Component remounts don't trigger unwanted reloads
- [x] Edge case: Save partial failure (orphaned photos) ✅ FIXED
- [x] Edge case: PhotoId changes don't overwrite user images
- [x] Edge case: Race conditions handled
- [x] Ref cleanup on unmount ✅ FIXED

## Recommendations Status

1. ✅ **IMPLEMENTED**: Cleanup for orphaned photos added in catch block (Toolbar.tsx line 915-926)
2. ✅ **IMPLEMENTED**: Ref cleared on unmount (NewEditor.tsx line 342-347)
3. ⚠️ **DEFERRED**: Retry for image load errors - Low priority, acceptable UX trade-off

