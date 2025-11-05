# Freeform Pool Drawing Integration Plan

## Overview
Enable users to draw custom freeform pool shapes in the template creation workflow, alongside preset shapes.

## Implementation Steps

### 1. Update PoolShapePreview Component ✓
- Add `customPoints?: Array<{ x: number; y: number }>` prop
- Use custom points if provided (freeform type)
- Scale custom points to fit canvas properly

### 2. Create FreeformPoolCanvas Component ✓
- Interactive drawing canvas (400x300px)
- Mouse down/move/up handlers for drawing
- Visual feedback with stroke and fill
- Clear button to reset
- Pass drawn points to parent

### 3. Update TemplateCreationForm
- Add state for custom freeform points
- Show FreeformPoolCanvas when type is 'freeform'
- Toggle between preset and custom for freeform
- Store custom points in formData
- Pass custom points to preview

### 4. Wire Up Preview
- Pass customPoints to PoolShapePreview
- Use custom points when type is freeform and customPoints exist
- Apply proper scaling and materials to custom shape

### 5. Save Custom Shapes
- Store custom points in template geometry
- On load, render custom points if available
- Ensure compatibility with existing templates

## File Changes

**Modified:**
- `client/src/components/library/PoolShapePreview.tsx` - Add customPoints support
- `client/src/components/library/TemplateCreationForm.tsx` - Integrate FreeformPoolCanvas

**Created:**
- `client/src/components/library/FreeformPoolCanvas.tsx` ✓ Already created

## Testing Checklist
- [ ] Can draw freeform shape
- [ ] Preview updates with custom shape
- [ ] Materials render on custom shape
- [ ] Preset shapes still work (rect, kidney, lap)
- [ ] Can clear and redraw
- [ ] Shape saves in template
- [ ] Shape loads correctly when editing template

