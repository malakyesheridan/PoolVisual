# Assets Library Feature

## Overview
Zero-regression Asset Library for the Canvas Editor that allows placing trees, plants, and furniture on the canvas while maintaining full compatibility with the existing masking and materials system.

## Feature Flags
- **Environment**: `VITE_PV_ASSETS=true` (defaults to `true` in development)
- **URL Parameter**: `?assets=1` to enable via URL
- **Kill Switch**: Call `disableAssetsFeature()` to completely disable

## Architecture
- **Isolated Store**: Separate Zustand slice (`useAssetsStore`) with no coupling to masks/materials
- **Layer Isolation**: Assets render in their own Konva Layer above textures but below UI overlays
- **Pointer Safety**: Assets are locked by default; users must toggle "Edit Assets" to interact
- **Persistence**: localStorage-based with session-scoped keys

## Components
- `AssetsLayer`: Konva layer for rendering asset instances
- `AssetsPanel`: UI panel with asset library and placed assets list
- `useAssetsStore`: Zustand store for asset state management
- `imageLoader`: Cached image loading with CORS support

## Usage
1. Enable feature flag (`VITE_PV_ASSETS=true` or `?assets=1`)
2. Click "Assets" tab in sidebar
3. Toggle "Edit Assets" to enable interaction
4. Click asset cards to place on canvas
5. Use transformer to move/scale/rotate (when editing)
6. Assets persist across page reloads

## Safety Features
- **Zero Regressions**: No changes to existing mask/materials code
- **Feature Flagged**: Entire feature can be disabled
- **Pointer Isolation**: Assets don't interfere with mask interactions when locked
- **Graceful Fallbacks**: Missing images show placeholders, don't crash

## File Structure
```
client/src/new_editor/assets/
├── store.ts          # Zustand store for asset state
├── definitions.ts    # Static asset definitions
├── imageLoader.ts    # Cached image loading
├── AssetsLayer.tsx   # Konva rendering layer
├── AssetsPanel.tsx   # UI panel component
├── index.ts          # Module exports
└── README.md         # This file

public/assets/
├── trees/            # Tree asset images
├── plants/           # Plant asset images
└── furniture/        # Furniture asset images
```

## Reverting
To completely remove the assets feature:
1. Set `VITE_PV_ASSETS=false`
2. Remove `?assets=1` from URL
3. Call `disableAssetsFeature()` if needed
4. The app will render identically to the original behavior
