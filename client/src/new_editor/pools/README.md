# Unified Pool Template System - Phase 3

## Implementation Summary

This implementation adds a minimal unified template system that works with existing masks and stores without introducing new data types.

## Files Created

### 1. `helpers.ts`
- `getCalibrationInfo()` - Gets calibration from editor store, returns fallback (100 px/m) if invalid
- `mmToPx(mm, calibration?)` - Converts millimeters to pixels using calibration
- `validateSectionWidth(sectionType, widthMm)` - Validates section widths against industry standards

### 2. `validation.ts`
- `validateInteriorMask(mask)` - Validates interior mask (≥3 points, area ≥100 px²)

### 3. `BatchSectionCreator.tsx`
- Batch creates all pool sections (waterline, coping, paving) as a single operation
- Uses cumulative offsets:
  - Waterline = inward from interior
  - Coping = outward from waterline (if exists) else interior
  - Paving = outward from coping (if exists) else waterline else interior
- Proper z-ordering: paving (0), coping (1), waterline (2), interior (3)
- Validates widths and skips invalid sections
- Groups all creation in a single transaction for undo/redo

## Files Modified

### `MaterialsPanel.tsx`
- Added "Create All Sections (Batch)" button
- Integrated `BatchSectionCreator` component
- Shows batch button when no sections exist
- Validates interior before batch creation

## Key Features

1. **No Disruption**: Works with existing mask system, no new types
2. **Calibration Aware**: Uses calibration when available, falls back to 100 px/m
3. **Validation**: Width limits (waterline: 50-300mm, coping: 100-400mm, paving: 300-2000mm)
4. **Error Handling**: Skips invalid sections with dev-only warnings
5. **Undo/Redo Safe**: All sections created in single transaction
6. **Z-Order**: Proper rendering order (paving → coping → waterline → interior)
7. **Cumulative Offsets**: Each section builds on the previous one correctly

## Usage

1. Select an interior mask (or convert a mask to pool interior)
2. Click "Create All Sections (Batch)" button
3. All sections created with proper metadata and z-ordering
4. Undo removes all sections at once

## Acceptance Criteria

✅ Works with existing mask system
✅ No circular imports
✅ Proper z-ordering (paving zIndex: 0, coping: 1, waterline: 2, interior: 3)
✅ Validation of widths
✅ Fallback when no calibration
✅ Dev-only warnings (wrapped in `process.env.NODE_ENV !== 'production'`)
✅ Undo/redo grouped (all sections in one transaction)

## Testing

To test:
1. Create or select a mask
2. Convert to pool interior (in MaterialsPanel)
3. Click "Create All Sections (Batch)"
4. Verify 3 new masks created with correct names and z-index
5. Undo - all 3 sections should be removed
6. Redo - all 3 sections should be restored

