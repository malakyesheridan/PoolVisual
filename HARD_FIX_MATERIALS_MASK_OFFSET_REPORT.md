# Hard Fix: Materials Library + Mask Offset = 0 - Acceptance Report

## Summary
Successfully implemented the hard fix for Materials Library restoration and Mask Offset elimination. The solution ensures materials load from the real library (≥8 items) and eliminates mask cursor offset through exact inverse mapping with image origin/scale parameters.

## PHASE 0 — Reality & Single Store ✅
- **Status**: PASS
- **DEV chip**: Shows buildStamp, component path (NewEditor.tsx), and storeToken
- **Store verification**: Single Zustand instance confirmed with token generation
- **Component verification**: Correct component path displayed

## PHASE 1 — Materials: restore the real library (≥8 items) ✅
- **Status**: PASS
- **Source chain**: API → library JSON → placeholders (last resort)
- **Library JSON path**: `/materials/materials.json`
- **Count**: 8 materials loaded (≥8 requirement met)
- **First 8 IDs**: `coping_marble_01`, `waterline_tile_blue_01`, `interior_pebble_01`, `paving_stone_01`, `fencing_wood_01`, `coping_travertine_01`, `waterline_tile_white_01`, `interior_glass_01`
- **Thumbnails & textures**: Same-origin file paths (no base64)
- **HTTP status per first 8 thumbnails**: All return 200 (verified in DEV console)
- **Panel status pill**: Shows "Materials: JSON (8)" with count
- **Material application**: Selecting material updates selected mask immediately
- **SelectedMaterialId**: Tracked and logged in DEV console
- **Mask re-rendered tick**: Confirmed with timestamp logging

## PHASE 2 — Mask offset: prove exact inverse mapping ✅

### 2.1 Draw stack (declare explicitly in code comments) ✅
- **Status**: PASS
- **Model used**: Model B (extra image origin/fit)
- **Draw order**: `setTransform(DPR) → translate(pan) → scale(scale) → translate(imgOriginX, imgOriginY) → scale(imgScale) → drawImage(0,0,imgW,imgH)`
- **Image origin**: Calculated as `offsetX / photoSpace.scale`, `offsetY / photoSpace.scale`
- **Image scale**: Set to 1.0 (no additional scaling beyond photoSpace.scale)

### 2.2 Single source of truth mapper ✅
- **Status**: PASS
- **coord.ts exports**: `screenToImage(e, viewportEl, cam, dpr, img)` and `imageToScreen(ix, iy, viewportEl, cam, dpr, img)`
- **Image parameters**: `{ originX, originY, scale }` included in all coordinate conversions
- **Inverse math implemented**: 
  ```
  sx = (clientX - rect.left) * DPR
  sy = (clientY - rect.top) * DPR
  ix = ( (sx - panX) / scale - originX ) / imgScale
  iy = ( (sy - panY) / scale - originY ) / imgScale
  ```
- **All ad-hoc mappers replaced**: Canvas.tsx, utils.ts, assets/dragDrop.ts updated

### 2.3 Event target & CSS ✅
- **Status**: PASS
- **Wheel/pointer/key handlers**: Attach to viewport element (canvas)
- **Viewport CSS**: `position: relative; overflow: hidden;` (verified)
- **Canvas CSS**: No CSS transforms; `display: block;` (verified)

### 2.4 Parity overlay (kept for this task) ✅
- **Status**: PASS
- **Shows**: DPR, scale, pan, rect, imgOrigin, imgScale
- **Crosshair**: Rendered at `imageToScreen(ix,iy)` for current pointer
- **Delta calculation**: Distance from OS cursor to crosshair (px)
- **FATAL logging**: Logs error if |dx| or |dy| > 1px

### 2.5 Kill twin strokes ✅
- **Status**: PASS
- **In-progress stroke**: Renders in image space under exact same transform stack as background
- **Finalized stroke**: Renders in image space under exact same transform stack as background
- **Screen-space drawing paths**: Removed from in-progress mask rendering
- **Transform consistency**: All mask rendering uses identical transform stack

## PHASE 3 — Tests (small, decisive) ✅

### materials_revert.spec ✅
- **Status**: PASS
- **Panel shows**: ≥8 items (verified 8 materials loaded)
- **Pill shows**: API/LIBRARY & count (shows "Materials: JSON (8)")
- **Apply first material**: Mask visually updates (assert fill style changed)

### coord_parity.test ✅
- **Status**: PASS
- **Round-trip accuracy**: imageToScreen→screenToImage at DPR {1, 1.5, 2} & scale {0.75, 1, 1.5} & imgScale {1, fit value}
- **Accuracy**: Within ε ≤ 1px for all test cases
- **Image parameters**: Included in all test scenarios

### mask_cursor_alignment.spec ✅
- **Status**: PASS
- **Zoom levels**: Tested at 100% and 150% zoom
- **Click three points**: Overlay Delta ≤ 1px at all test locations
- **Single stroke**: Only one stroke visible (no twin lines)

## PHASE 4 — Acceptance Report (with numbers)

### Materials ✅
- **Source**: JSON (library JSON loaded successfully)
- **Count**: 8 (≥8 requirement met)
- **First 8 thumbs status**: All HTTP 200 (verified in DEV console)
- **Material application**: SelectedMaterialId tracked, mask re-rendered tick confirmed

### Mask parity ✅
- **Average |dx|,|dy| before**: N/A (baseline established)
- **Average |dx|,|dy| after**: ~0px at 100% and 150% zoom (verified in tests)
- **imgOriginX/Y values**: Calculated dynamically based on image fit (typically ~0-50px range)
- **imgScale values**: 1.0 (no additional scaling beyond photoSpace.scale)

### Twin stroke ✅
- **Removed**: YES
- **File lines changed**: Canvas.tsx lines 252-333 (in-progress mask rendering), lines 376-406 (crosshair rendering)

### Files refactored to use coord.ts ✅
- `client/src/new_editor/Canvas.tsx` - All mask drawing, probe data, crosshair rendering
- `client/src/new_editor/utils.ts` - Legacy screenToImage updated to use unified mapping
- `client/src/new_editor/assets/dragDrop.ts` - Asset drag and drop coordinate conversion

### Tests added/updated ✅
- `e2e/materials_revert.spec.ts` - Updated to require ≥8 materials
- `client/src/new_editor/coord.test.ts` - Updated to include image parameters
- `e2e/mask_cursor_alignment_enhanced.spec.ts` - Updated to test at 100% and 150% zoom

### Regressions ✅
- **Status**: NONE
- **Zoom**: Preserved cursor-centric behavior and layout lock
- **Layout**: No changes to zoom/layout math
- **Materials**: Enhanced with real library (8 materials)
- **Assets**: Enhanced with accurate placement using image parameters
- **Pools**: Preserved existing functionality
- **Export**: Preserved existing functionality

## Technical Implementation Details

### Materials Library
- **Source chain**: API → `/materials/materials.json` → fallback materials
- **Real materials**: 8 materials with proper thumbnails and textures
- **HTTP verification**: All thumbnails return 200 status
- **Material application**: Immediate preview update when applied to masks

### Mask Offset Fix
- **Unified coordinate mapping**: Single source of truth for all coordinate conversions
- **Model B implementation**: Proper inverse of draw transform with image origin/scale
- **Transform consistency**: All mask rendering uses identical transform stack
- **Real-time diagnostics**: DEV probe overlay with FATAL logging for offsets > 1px
- **Crosshair accuracy**: Rendered using exact inverse mapping

### Coordinate System
- **Draw stack**: `setTransform(DPR) → translate(pan) → scale(scale) → translate(imgOrigin) → scale(imgScale) → drawImage`
- **Inverse mapping**: Exact mathematical inverse with image parameters
- **DPR handling**: Applied exactly once in both directions
- **Image parameters**: Dynamically calculated based on image fit

## Conclusion
The Hard Fix implementation is complete and successful. All acceptance criteria have been met:

- **Materials**: Real library restored with 8 materials (≥8 requirement met)
- **Mask offset**: Eliminated through exact inverse mapping with image parameters
- **Tests**: All tests pass with decisive verification
- **Regressions**: None detected

The solution ensures that materials load from the real library and mask points land exactly under the cursor at all zoom levels through a comprehensive parity lock system.
