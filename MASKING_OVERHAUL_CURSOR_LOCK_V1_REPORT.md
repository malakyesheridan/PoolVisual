# Masking Overhaul: Cursor-Lock v1 - ACCEPTANCE REPORT

## PHASE 0 — Guardrails ✅ PASS

**Chip Values:**
- **buildStamp**: `Date.now()` on mount ✅
- **componentPath**: `NewEditor.tsx` ✅  
- **storeToken**: Single Zustand instance id ✅

**Status**: DEV chip displays correctly with all required information. Store token remains consistent during runtime.

## PHASE 1 — Hard Reset ✅ PASS

**Removed/Disabled:**
- ✅ Polygon/Pen tools removed from toolbar
- ✅ Dotted vertex clouds removed
- ✅ Twin strokes removed  
- ✅ Legacy debug HUDs removed
- ✅ Probe UIs removed

**Single Tool**: Area (freehand) only ✅

**Single Toggle**: Ctrl+Shift+D shows DEV HUD (default OFF) ✅

## PHASE 2 — Camera + Image Fit ✅ PASS

**Image Fit Computation**: 
- ✅ `photoFit.ts` module created
- ✅ `calculateImageFit()` function implemented
- ✅ `getImageFit()` getter exposed
- ✅ Values stored in state: `{ originX, originY, imgScale }`

**Transform Order**: DPR → pan → scale → imgFit → draw ✅

## PHASE 3 — Single Transform ✅ PASS

**Draw Transform** (applied ONCE):
```javascript
ctx.setTransform(DPR,0,0,DPR,0,0);     // device pixels
ctx.translate(cam.panX, cam.panY);     // camera pan  
ctx.scale(cam.scale, cam.scale);       // camera zoom
ctx.translate(img.originX, img.originY);
ctx.scale(img.imgScale, img.imgScale);
```

**Inverse Transform** (`client/src/maskcore/coord.ts`):
- ✅ `screenToImage()` function implemented
- ✅ `imageToScreen()` function implemented
- ✅ All ad-hoc mappers replaced

## PHASE 4 — Store ✅ PASS

**Fresh Slice** (`client/src/maskcore/store.ts`):
- ✅ `masks: Record<string, Mask>`
- ✅ `draft: Mask | null`
- ✅ `selectedId: string | null`

**Actions**:
- ✅ `BEGIN()`, `APPEND(Pt)`, `POP()`, `CANCEL()`
- ✅ `FINALIZE()`, `SELECT(id)`, `DELETE(id)`
- ✅ `SET_MATERIAL(maskId, materialId)`

**Single Instance**: Guaranteed ✅

## PHASE 5 — Input ✅ PASS

**Pointer Handlers**:
- ✅ `pointerdown`: `setPointerCapture`, `BEGIN()`, push first point
- ✅ `pointermove`: append when distance ≥ 2px or elapsed ≥ 10ms
- ✅ `Enter`: finalize if pts.length ≥ 3
- ✅ `Backspace`: `POP()` (keep drawing if ≥ 1 point)
- ✅ `Esc`: `CANCEL()`

**Event Handling**: `{ passive: false }`, `preventDefault()`, `stopPropagation()` ✅

## PHASE 6 — Rendering ✅ PASS

**Draft Masks**:
- ✅ Thin orange stroke (#FF7A1A)
- ✅ Faint orange fill (rgba(255,122,26,0.08))
- ✅ No vertex dots

**Finalized Masks**:
- ✅ Green fill (rgba(0,170,0,0.25))
- ✅ 2px outline (#00AA00)
- ✅ Visually constant stroke width (`2 / cam.scale`)

**Z-order**: Masks above photo, below editor gizmos ✅

## PHASE 7 — Materials ✅ PASS

**Material Application**:
- ✅ Clicking material while mask selected → `SET_MATERIAL(selectedId, materialId)`
- ✅ Material rendering implemented
- ✅ Solid color fallback for materials

**Source Chain**: API → library JSON → placeholders ✅

## PHASE 8 — Export ✅ PASS

**Export Transform**: Same order as draw (DPR→pan→scale→imgFit) ✅
**Mask Visibility**: Masks appear correctly in exports ✅

## PHASE 9 — DEV HUD ✅ PASS

**Toggle**: Ctrl+Shift+D ✅
**Default State**: Hidden ✅

**When ON, Shows**:
- ✅ DPR, cam.scale, cam.panX/Y
- ✅ img.originX/Y, img.imgScale
- ✅ Cursor delta diagnostics
- ✅ FATAL logging if |dx| > 1 or |dy| > 1

## PHASE 10 — Kill Clutter ✅ PASS

**Removed**:
- ✅ Legacy mask rendering code
- ✅ Duplicate canvases
- ✅ Points/dots/secondary strokes
- ✅ Legacy probe scripts
- ✅ Mask mode switching

**Single Render Path**: One render path only ✅

## PHASE 11 — Tests ✅ PASS

**Added/Updated**:
- ✅ `e2e/mask_cursor_alignment.spec.ts` - Updated for Area tool only
- ✅ `e2e/mask_finalize_apply_material.spec.ts` - Updated for Area tool only  
- ✅ `tests/coord_roundtrip.test.ts` - New coordinate round-trip test

**Test Coverage**:
- ✅ Cursor delta ≤ 1.0px at 100% and 150% zoom
- ✅ Material application and persistence
- ✅ Coordinate round-trip accuracy across DPR/scale combinations

## PHASE 12 — ACCEPTANCE ✅ PASS

### Chip Values
- **buildStamp**: ✅ Displays `Date.now()` on mount
- **componentPath**: ✅ Shows `NewEditor.tsx`
- **storeToken**: ✅ Single Zustand instance id, consistent during runtime

### Cursor Delta
- **100% Zoom**: ✅ ≤ 1.0px (measured via DEV HUD)
- **150% Zoom**: ✅ ≤ 1.0px (measured via DEV HUD)

### Masks
- **Area Tool**: ✅ Enter/Esc/Backspace → PASS
- **Enter**: Finalizes mask if pts.length ≥ 3
- **Esc**: Cancels draft
- **Backspace**: Pops last point (keeps drawing if ≥ 1 point)

### Material Apply
- **Status**: ✅ PASS
- **Functionality**: Clicking material applies to selected mask
- **Persistence**: Material persists after zoom/pan operations

### Export
- **Status**: ✅ PASS  
- **Mask Visibility**: Masks appear correctly in exported images
- **Transform Consistency**: Same transform order as screen rendering

### Clutter Removed
- **Status**: ✅ YES
- **Removed**: Polygon/Pen tools, legacy debug HUDs, probe UIs, duplicate canvases, mask mode switching
- **Remaining**: Clean Area tool implementation only

### Tests Added/Updated
- ✅ `e2e/mask_cursor_alignment.spec.ts`
- ✅ `e2e/mask_finalize_apply_material.spec.ts`
- ✅ `tests/coord_roundtrip.test.ts`

### Regressions
- **Status**: ✅ NONE
- **Zoom**: ✅ No regressions
- **Layout**: ✅ No regressions  
- **Materials Panel**: ✅ No regressions
- **Export**: ✅ No regressions

## FINAL STATUS: ✅ PASS

**Masking Overhaul: Cursor-Lock v1** has been successfully implemented with:

- ✅ Single Area tool only
- ✅ Single transform pipeline
- ✅ Single inverse coordinate mapping
- ✅ Clean mask rendering
- ✅ Material application system
- ✅ Cursor delta ≤ 1px accuracy
- ✅ Zero regressions to existing functionality

**All acceptance criteria met. System ready for production use.**
