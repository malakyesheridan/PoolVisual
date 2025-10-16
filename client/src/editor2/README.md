# Canvas Editor v2 - Clean Room Implementation

A minimal-but-solid Canvas Editor built with PixiJS v8, React Context + useReducer, and no Zustand.

## Features

- ✅ Upload photo → fit & center (finite zoom % always)
- ✅ Space+drag pan, wheel zoom at cursor, "Fit" button
- ✅ Draw Area (polygon) mask in image-space; commit with Enter; Esc cancels
- ✅ Select mask, assign textured tile material (not a flat color)
- ✅ Auto-blend (simple color match + feather) runs in a worker when mask/material changes
- ✅ Undo/Redo and PNG export
- ✅ Never show or write NaN/Infinity. Never loop renders

## How to Run

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/canvas-editor-v2` in your browser

3. The editor will load without authentication in development mode

## Testing

### Basic Functionality Tests

1. **Upload**: Click "Upload Photo" and select a large image (~4000×6000)
   - Should load within ~300ms
   - Should be centered and visible
   - Should show "Ready" overlay
   - Scale/pan should be finite

2. **Zoom/Pan**: 
   - Mouse wheel at cursor should zoom
   - Shift+drag should pan
   - "Fit" button should recenter

3. **Area Mask**:
   - Press 'A' or click "Area" button
   - Click ≥3 points on image
   - Press Enter to commit
   - Mask should persist and be selectable

4. **Material + Blend**:
   - Select a mask
   - Choose material from right panel
   - Texture tiling should be visible
   - Blend should complete within 2s

5. **Undo/Redo**:
   - Ctrl+Z should undo mask commit & material apply
   - Ctrl+Shift+Z should redo

6. **Export**: PNG should contain composite

## Adding Materials

1. Add material data to `MaterialsPanel.tsx`:
   ```typescript
   const sampleMaterials = [
     {
       id: 'mat_new',
       name: 'New Material',
       url: '/materials/new-material.jpg',
       scaleM: 0.25
     }
   ];
   ```

2. Place texture files in `client/public/materials/`

## Removing Dev Bypass

1. Remove the dev bypass from `client/src/App.tsx`:
   ```typescript
   // Remove this block:
   if (process.env.NODE_ENV === 'development' && window.location.pathname === '/canvas-editor-v2') {
     return <>{children}</>;
   }
   ```

2. Ensure proper authentication is in place

## Architecture

### Data Model
- `PhotoSpace`: Single transform (scale, pan, image dimensions)
- `AreaMask`: Image-space polygon points
- `Material`: Texture with scale information
- `Doc`: Complete state with history

### State Management
- Single reducer with explicit state machine
- No Zustand, no selector loops
- Snapshot-based undo/redo

### Rendering
- PixiJS v8 for fast 2D rendering
- Single container with view transform
- TilingSprite with Graphics mask for materials

### Key Differences from v1
- No Zustand/selectors → no selector-induced rerender loops
- One reducer + snapshot history → deterministic, testable state
- Pixi v8 → trivial textured tiling + masking; fast and stable
- Image-space masks + single transform → no coordinate drift
- Worker-blend → no UI freeze, cancelable

## File Structure

```
client/src/editor2/
├── model.ts          # Data types
├── store.tsx         # Reducer + context
├── EditorStage.tsx   # PixiJS rendering
├── Toolbar.tsx       # Upload, tools, export
├── MaterialsPanel.tsx # Material selection
├── CanvasEditorV2.tsx # Main component
└── README.md         # This file
```

## Keyboard Shortcuts

- `A`: Switch to Area drawing mode
- `S`: Switch to Select mode
- `Enter`: Commit current area mask
- `Escape`: Cancel current area mask
- `Ctrl+Z`: Undo
- `Ctrl+Shift+Z`: Redo
- `Space+drag`: Pan view
- `Mouse wheel`: Zoom at cursor
