# Save Process Audit Report

## Executive Summary
Complete audit of the save process fixes for:
1. **Organization join toast appearing every time** - FIXED ✓
2. **Masks being "printed" into canvas causing duplicates** - FIXED ✓

## 1. Organization Join Logic Audit

### Files Involved:
- `client/src/new_editor/Toolbar.tsx` (lines 957-1008)
- `server/storage.ts` (lines 191-213)

### Flow:
1. **Check for existing membership** (`apiClient.getOrgMember`)
   - Returns `OrgMember | undefined`
   - If `undefined`, proceed to join logic

2. **Join organization** (`apiClient.joinOrg`)
   - Calls `server/storage.ts::createOrgMember`
   - Server checks for existing membership before creating (lines 192-196)
   - If exists, returns existing membership
   - If not, creates new membership

3. **Toast display logic** (lines 971-976, 989-993)
   - Uses `localStorage` key: `org_member_${job.orgId}_${authUser.id}`
   - Only shows toast if key doesn't exist (first-time join)
   - Sets key after showing toast
   - **Result**: Toast appears only once per user/org combination

### Verification:
✅ **Correct**: Server-side deduplication ensures no duplicate memberships  
✅ **Correct**: Client-side localStorage prevents repeated toasts  
✅ **Edge case handled**: If localStorage is cleared, toast may appear again (acceptable)

## 2. Mask Export Removal Audit

### Files Involved:
- `client/src/new_editor/Toolbar.tsx`:
  - `exportCanvasToBlob` function (lines 764-825)
  - `handleSaveToJob` function (lines 827-1113)

### Current Flow:

#### Step 1: Save Masks to Database (lines 991-998)
```
- Iterate through all masks in store
- Create mask data with proper schema
- Save to database via apiClient.createMask
- Update local mask IDs from temp IDs to database IDs
- Track saved mask IDs in savedMaskIds Set
```

✅ **Correct**: Masks saved to database first

#### Step 2: Export Canvas WITHOUT Masks (lines 1000-1004)
```
- Call exportCanvasToBlob() with NO arguments
- Function signature: exportCanvasToBlob(onlyExportMaskIds?: Set<string>)
- Since no argument passed, onlyExportMaskIds is undefined
- Inside function: Lines 785-798
  - Logs that masks are skipped
  - NO mask rendering code executed
  - Only draws base image: ctx.drawImage(img, 0, 0)
  - Converts to blob and returns
```

✅ **Correct**: No masks exported into image

#### Step 3: Upload Image (lines 1006-1030)
```
- Upload exported blob (base image only) to server
- Update photo record with new originalUrl
```

✅ **Correct**: Base image only is uploaded

#### Step 4: Dispatch SET_IMAGE (lines 1094-1113)
```
- Dispatch SET_IMAGE with new photo URL
- Dispatch saveComplete event to notify NewEditor
- NewEditor listens and skips mask reload for 3 seconds
```

✅ **Correct**: Image updated after all saves complete

### Mask Rendering Verification:

#### Konva Overlay Rendering:
- **MaskTextureLayer.tsx** (lines 31-36): Renders masks with materials from `useMaskStore`
- **MaskPolygonsLayer.tsx** (lines 125-133): Renders masks without materials from `useMaskStore`
- Both respect `mask.isVisible === false` to skip hidden masks
- Both read from `useMaskStore.getState().masks`

✅ **Correct**: Masks render as interactive Konva overlays from store

### Other Export Functions Checked:

1. **`exportCanvas` from `exportUtils.ts`**:
   - DOES export masks (lines 60-102)
   - ✅ **Not used in save flow** - Only `exportCanvasToBlob` is called
   - Used for standalone export/download functionality (acceptable)

2. **`handleExport` function in Toolbar.tsx** (lines 340-380):
   - DOES export masks (lines 356-380)
   - ✅ **Separate function** - Not part of save flow
   - Used for downloading current canvas state (acceptable)

3. **`compositeGenerator.ts`** (server-side):
   - DOES include masks in composite generation
   - ✅ **Separate purpose** - Used for generating preview composites, not save flow

✅ **All export functions verified**: Only `exportCanvasToBlob` is used in save flow, and it correctly excludes masks

## 3. NewEditor Mask Loading Logic Audit

### Files Involved:
- `client/src/new_editor/NewEditor.tsx` (lines 158-397)

### Flow:

#### Save Completion Event Listener (lines 159-180)
```
- Listens for 'saveComplete' custom event
- Sets justSavedRef with photoId and timestamp
- Clears flag after 3 seconds
```

✅ **Correct**: Event-driven coordination

#### Mask Loading Effect (lines 183-397)
```
Early Exit Check (lines 193-200):
- If justSavedRef indicates recent save (< 3 seconds):
  - Logs: "Just saved this photo, skipping mask reload"
  - Returns immediately (no API calls, no mask updates)

If not just saved:
- Fetches masks from server
- Deduplicates with existing masks in store
- Updates store with server masks
```

✅ **Correct**: Prevents duplicate mask loading immediately after save

### Deduplication Logic (lines 202-368):
1. Checks for existing database masks in store
2. Compares with server response
3. If masks match, skips reload entirely
4. If masks don't match, converts and updates store
5. Handles temporary mask cleanup

✅ **Correct**: Robust deduplication prevents duplicates

## 4. Complete Save Flow Summary

```
1. User clicks "Save Changes"
   ↓
2. Get organization membership
   - Check if exists → if not, join (toast only on first join)
   ↓
3. Save all masks to database
   - Create masks with database IDs
   - Update local mask IDs in store
   ↓
4. Export canvas WITHOUT masks
   - Only base image exported
   - No mask rendering code executed
   ↓
5. Upload exported image
   - Update photo record with new URL
   ↓
6. Dispatch SET_IMAGE
   - Updates editor state with new image URL
   ↓
7. Dispatch saveComplete event
   - Notifies NewEditor to skip mask reload for 3 seconds
   ↓
8. Masks remain in store
   - Rendered as interactive Konva overlays
   - No duplicates (no baked-in + overlay)
```

## 5. Potential Issues & Edge Cases

### ✅ Handled Edge Cases:
1. **User not in organization**: Auto-joins with "estimator" role
2. **Membership already exists**: Server returns existing, toast only shows once
3. **Mask modified during save**: Point comparison prevents ID update if modified
4. **Multiple saves quickly**: `justSavedRef` prevents duplicate reloads for 3 seconds
5. **Temporary masks during save**: Deduplication logic handles cleanup

### ⚠️ Potential Edge Cases (Non-Critical):
1. **localStorage cleared**: Toast may appear again (acceptable - user sees it once per session)
2. **Network failure during save**: Error handling in place, masks remain in store
3. **Mask save fails but image upload succeeds**: Masks remain in store with temp IDs (will be saved on next attempt)

## 6. Verification Checklist

- [x] Masks are NOT exported into saved images
- [x] Masks ARE saved to database
- [x] Masks ARE rendered as interactive Konva overlays
- [x] Organization join toast appears only once
- [x] NewEditor skips mask reload immediately after save
- [x] Deduplication logic prevents duplicate masks
- [x] No other export functions interfere with save flow
- [x] Error handling is in place for all critical steps

## Conclusion

✅ **All fixes verified and correct**

The save process now:
1. Saves masks to database for persistence
2. Exports base image only (no baked-in masks)
3. Renders masks as interactive overlays (no duplicates)
4. Shows organization join toast only once
5. Prevents duplicate mask loading after save

**No regressions detected. All functionality intact.**

