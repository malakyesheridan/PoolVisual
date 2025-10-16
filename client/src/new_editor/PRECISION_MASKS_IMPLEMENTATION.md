# Precision Masks v1 - Implementation Guide

## Overview

Precision Masks v1 adds straight-line drawing, smoothing, snapping, and vertex editing capabilities to the new editor while maintaining full backward compatibility with existing functionality.

## Features Implemented

### 🎯 **Precision Drawing Tools**
- **Polygon Tool (P)**: Click to add vertices, Enter to commit, Esc to cancel
- **Pen Tool (E)**: Curved drawing with bezier handles (data model ready)
- **Enhanced Area Tool**: Freehand with smoothing and path simplification

### 🔧 **Snapping System**
- **Grid Snapping (G)**: Snap to configurable grid (default 24px)
- **Angle Snapping (Shift+A)**: Snap to 0°/45°/90° angles (15° increments)
- **Edge Snapping (Shift+E)**: Snap to detected image edges (experimental)
- **Orthogonal Snapping (O)**: Horizontal/vertical constraints

### ✏️ **Vertex Editing**
- **Click to select**: Click vertex to select for editing
- **Drag to move**: Drag selected vertex to new position
- **Double-click edge**: Insert new vertex at edge midpoint
- **Delete key**: Remove selected vertex (maintains polygon validity)
- **C key**: Toggle between corner and smooth vertex types

### 🎨 **Freehand Improvements**
- **Lazy Mouse**: Moving average smoothing (4-8px radius)
- **Path Simplification**: Ramer-Douglas-Peucker algorithm (1-2px epsilon)
- **Live Preview**: Smooth drawing with simplified commit

## Data Model

### Extended MaskPoint Structure
```typescript
interface MaskPoint {
  x: number; // image px
  y: number; // image px
  kind: 'corner' | 'smooth'; // smooth = bezier corner
  h1?: { x: number; y: number }; // optional bezier handle
  h2?: { x: number; y: number };
}
```

### Backward Compatibility
- Existing masks continue to work unchanged
- Legacy Point[] arrays are automatically converted to MaskPoint[]
- All geometry remains in image space (PhotoSpace applies only at draw time)

## Keyboard Shortcuts

### Tools
- **A**: Area tool (freehand)
- **P**: Polygon tool (precision)
- **E**: Pen tool (curved)
- **V**: Select tool

### Snapping Toggles
- **G**: Toggle grid snapping
- **Shift+A**: Toggle angle snapping
- **Shift+E**: Toggle edge snapping
- **O**: Toggle orthogonal snapping

### Editing
- **Enter**: Commit current drawing
- **Esc**: Cancel current drawing
- **Delete/Backspace**: Delete selected vertex
- **C**: Toggle vertex type (corner/smooth)

### Modifiers (while drawing)
- **Shift**: Constrain to 0°/45°/90° angles
- **Ctrl/Cmd**: Constrain to horizontal/vertical
- **Alt**: Relax snapping temporarily
- **Space**: Pan (existing behavior)

## Implementation Details

### Files Modified/Created
- `precisionMasks.ts` - Core precision tools implementation
- `types.ts` - Extended with MaskPoint and precision state
- `store.ts` - Added precision actions and state management
- `Canvas.tsx` - Integrated precision tools and snapping
- `Toolbar.tsx` - Added precision tool buttons and snapping controls
- `featureFlags.ts` - Added PV_PRECISE_MASKS flag

### Performance Optimizations
- **Edge Detection**: Cached Sobel edge map at 1/6 resolution
- **Snapping**: Local queries around cursor (no full-image scans)
- **Smoothing**: Efficient moving average algorithm
- **Simplification**: Ramer-Douglas-Peucker with 1-2px epsilon

### Coordinate System
- All geometry remains in image pixels
- PhotoSpace transform applied only at draw time
- Snapping operates in image space for precision
- Screen-space rendering for UI elements

## Usage Examples

### Drawing a Precise Rectangle
1. Select Polygon tool (P)
2. Enable grid snapping (G)
3. Click four corners
4. Press Enter to commit

### Editing Existing Mask
1. Select mask with Select tool (V)
2. Click vertex to select
3. Drag to move or Delete to remove
4. Double-click edge to add vertex

### Freehand with Smoothing
1. Select Area tool (A)
2. Draw freehand path
3. System automatically applies smoothing
4. Press Enter to commit simplified path

## Testing Checklist

### ✅ **Basic Functionality**
- [ ] Polygon tool draws straight lines
- [ ] Snapping works for all types
- [ ] Vertex editing (move, insert, delete)
- [ ] Freehand smoothing reduces wobble
- [ ] Path simplification preserves shape

### ✅ **Keyboard Shortcuts**
- [ ] All tool shortcuts work
- [ ] Snapping toggles work
- [ ] Modifier keys constrain drawing
- [ ] Editing shortcuts function

### ✅ **Performance**
- [ ] Smooth 60fps while drawing
- [ ] No memory growth after heavy use
- [ ] Snapping doesn't stall UI
- [ ] Export matches canvas exactly

### ✅ **Compatibility**
- [ ] Existing masks render unchanged
- [ ] Undo/redo works with precision tools
- [ ] Export parity maintained
- [ ] No regressions in existing features

## Future Enhancements

### Planned Features
- **Shape Tools**: Rectangle, Circle, Rounded Rect helpers
- **Measurement HUD**: Length and angle readouts when calibrated
- **Advanced Snapping**: Snap to existing mask edges/vertices
- **Bezier Handles**: Visual bezier control points for Pen tool
- **Grid Visualization**: Visual grid overlay when enabled

### Performance Improvements
- **Web Worker**: Move edge detection to background thread
- **Caching**: Cache edge maps and snapping results
- **Optimization**: Reduce memory allocations in hot paths

## Troubleshooting

### Common Issues
1. **Snapping not working**: Check if feature flag is enabled
2. **Vertex editing not responding**: Ensure mask is selected first
3. **Performance issues**: Disable edge snapping for large images
4. **Export mismatch**: Verify PhotoSpace transform consistency

### Debug Mode
- Press **J** to enable debug mode
- Shows coordinate transformation details
- Logs snapping and smoothing operations
- Displays performance metrics
