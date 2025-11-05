# Photo Loading Test Scenarios

## Test Cases

### TC1: Fresh Load with PhotoId (Has Picsum Placeholder)
**Setup**: Database has photo with `originalUrl: "https://picsum.photos/2000/1500"`
**Steps**:
1. Navigate to editor with `photoId` prop
2. Component mounts, `useEffect` triggers
3. API returns Picsum URL

**Expected**: 
- `[NewEditor] Photo has Picsum placeholder URL, rejecting`
- Canvas remains empty or shows previous state
- ❌ NO random Picsum image loaded

**Pass Criteria**: ✅ Picsum rejected, no image loaded

---

### TC2: User Uploads Image → Saves → Component Remounts
**Setup**: User uploads image via File menu
**Steps**:
1. User uploads image → `SET_IMAGE` dispatched
2. User edits canvas, adds masks
3. User clicks "Save Changes"
4. `handleSaveToJob` uploads blob, updates DB
5. `SET_IMAGE` dispatched with saved URL (line 892)
6. Component remounts (e.g., due to error or state change)
7. `useEffect` triggers (line 257)

**Expected**:
- Save succeeds
- `[NewEditor] User has already loaded an image, skipping API photo load`
- Same image persists ✅

**Pass Criteria**: ✅ Image persists through save and remount

---

### TC3: Component Loads with PhotoId (Real Photo in DB)
**Setup**: Database has photo with real S3/storage URL
**Steps**:
1. Navigate to editor with `photoId` prop
2. Component mounts, `useEffect` triggers
3. API returns real photo URL (e.g., `https://s3.../photo.jpg`)

**Expected**:
- `[NewEditor] Photo loaded from API: [real URL]`
- `[NewEditor] Setting image in store: [real URL]`
- Image loads in canvas ✅

**Pass Criteria**: ✅ Real photo loads successfully

---

### TC4: User Uploads, Then PhotoId Becomes Available
**Setup**: User uploads image, then `photoId` prop arrives
**Steps**:
1. User uploads image → `SET_IMAGE` dispatched
2. Component receives `photoId` prop → `useEffect` triggers
3. Guard check at line 272

**Expected**:
- `[NewEditor] User has already loaded an image, skipping API photo load`
- User image NOT overwritten ✅

**Pass Criteria**: ✅ User image preserved

---

### TC5: Save Creates New Photo (No effectivePhotoId)
**Setup**: No existing photo, user uploads and saves
**Steps**:
1. User uploads image
2. User saves (no `effectivePhotoId`)
3. `uploadPhoto` called (line 914)
4. New photo created in DB

**Expected**:
- Photo uploaded successfully
- `SET_IMAGE` dispatched with new photo URL (line 920-928) ✅
- Photo persists in store

**Pass Criteria**: ✅ New photo URL saved to store

---

### TC6: Save Updates Existing Photo
**Setup**: Photo exists in DB, user saves edited version
**Steps**:
1. User loads existing photo
2. User edits and saves
3. `updatePhoto` called (line 884)
4. `SET_IMAGE` dispatched with updated URL (line 892)

**Expected**:
- Photo updated in DB
- Store updated with new URL ✅
- Image persists

**Pass Criteria**: ✅ Updated URL persisted

---

### TC7: Multiple Remounts Don't Reload
**Setup**: User has image loaded, component remounts multiple times
**Steps**:
1. User uploads image
2. Component remounts → `useEffect` triggers
3. Component remounts again → `useEffect` triggers again

**Expected**:
- Each remount: `[NewEditor] User has already loaded an image, skipping`
- No API calls ✅
- No image reloads ✅

**Pass Criteria**: ✅ No unnecessary reloads

---

### TC8: PhotoId Changes but User Has Image
**Setup**: User uploads image, then `photoId` prop changes
**Steps**:
1. User uploads image
2. `photoId` prop changes → `useEffect` triggers (dependency change)

**Expected**:
- `[NewEditor] User has already loaded an image, skipping API photo load`
- User image preserved ✅

**Pass Criteria**: ✅ Image not overwritten by new photoId

---

## Edge Cases

### EC1: API Returns Null/Undefined originalUrl
**Setup**: Photo record exists but `originalUrl` is null
**Steps**: `useEffect` calls API, gets photo with null `originalUrl`

**Expected**:
- `[NewEditor] Photo data missing originalUrl`
- No image loaded ✅

**Pass Criteria**: ✅ Graceful handling, no crash

---

### EC2: Image Load Fails After API Call
**Setup**: API returns valid URL, but image fails to load (404, CORS, etc.)
**Steps**: `img.onerror` fires

**Expected**:
- `[NewEditor] Failed to load image from photo URL`
- Canvas remains in previous state ✅

**Pass Criteria**: ✅ Error handled gracefully

---

### EC3: Save Fails Partway Through
**Setup**: Upload succeeds, but `updatePhoto` fails
**Steps**:
1. Blob upload succeeds
2. `updatePhoto` throws error
3. `SET_IMAGE` dispatch never happens (in try block)

**Expected**:
- Error caught, toast shown
- Current image stays in store (user's uploaded image) ✅
- Orphaned photo in storage (acceptable trade-off)

**Pass Criteria**: ✅ Failure handled gracefully

---

### EC4: Race Condition - Save Completes, Then useEffect
**Setup**: Save finishes, component remounts immediately
**Steps**:
1. Save completes → `SET_IMAGE` dispatched
2. Component remounts → `useEffect` triggers

**Expected**:
- Line 272 check: `hasUserImage = true` (non-Picsum URL) ✅
- Skip API call ✅

**Pass Criteria**: ✅ Guard prevents reload

---

## Regression Tests

### RT1: File Upload Still Works
**Test**: User can still upload images via File menu
**Pass Criteria**: ✅ Upload works, image appears

### RT2: Photo Loading From DB Still Works
**Test**: Real photos from database still load
**Pass Criteria**: ✅ Real photos load when no user image exists

### RT3: Save Functionality Intact
**Test**: Save button still works
**Pass Criteria**: ✅ Save succeeds, data persisted

---

## Automated Test Checklist

Run these tests in order:

```
[ ] TC1: Picsum rejection
[ ] TC2: Save persistence  
[ ] TC3: Real photo loading
[ ] TC4: User upload protection
[ ] TC5: New photo creation
[ ] TC6: Existing photo update
[ ] TC7: Multiple remounts
[ ] TC8: PhotoId change protection
[ ] EC1: Null originalUrl
[ ] EC2: Image load failure
[ ] EC3: Save partial failure
[ ] EC4: Race condition
[ ] RT1: File upload works
[ ] RT2: DB photo loading works
[ ] RT3: Save works
```

