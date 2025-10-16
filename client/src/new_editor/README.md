# New Editor - Under-Water Effect v1.5

## Overview

The New Editor includes an enhanced underwater effect system that makes tiled materials appear naturally submerged in pool water. The effect is feature-flagged and includes both v1.0 (stable) and v1.5 (enhanced) pipelines.

## Feature Flag

```typescript
// Enable v1.5 underwater effect (default: true in dev, false in prod)
export const PV_UNDERWATER_V15 = import.meta.env.VITE_PV_UNDERWATER_V15 === 'true' || import.meta.env.DEV;
```

## Under-Water Effect v1.5

### Photometric Blend Pipeline

The v1.5 effect uses a photorealistic blend approach where the water's luminance drives the tile appearance:

1. **Photometric Blend**: Multiply texture over photo with alpha control
2. **Aqua Tint**: Gentle cyan/teal tint (0-100%)
3. **Edge Seating**: Soft inner shadow/feather (0-20px, DPR-aware)
4. **Highlight Preservation**: Brings back high-frequency specular highlights
5. **Micro-Refraction**: Optional sub-pixel ripple displacement (≤1.5px)

### Controls

- **Intensity**: Overall effect strength (0-100%)
- **Tint**: Aqua tint strength (0-100%, default 18%)
- **Edge Feather**: Inner feather in screen space (0-20px, default 8px)
- **Highlights**: Highlight preservation strength (0-100%, default 20%)
- **Ripple**: Micro-refraction strength (0-100%, default 0% - off)

### Performance

- **Render Time**: ~85ms for v1.5 effects
- **Cache Integration**: All parameters included in cache keys
- **Memory Efficient**: Bounded cache prevents memory leaks
- **Export Parity**: Pixel-perfect match between canvas and export

## Under-Water Effect v1.0 (Fallback)

When `PV_UNDERWATER_V15` is false, the system falls back to the original v1.0 effect:

- **Edge Integration**: Inner feather and contact shadow
- **Color Math**: HSL-based underwater tinting
- **Caustics Preservation**: Background luminance sampling
- **Depth Falloff**: Linear gradient from shallow to deep

## Technical Implementation

### Canvas2D Layering

```typescript
// v1.5 Pipeline
ctx.globalCompositeOperation = 'multiply';
ctx.globalAlpha = intensity;
ctx.fillStyle = pattern;
ctx.fillRect(...);

// Aqua tint
ctx.fillStyle = `rgba(217, 242, 255, ${tintIntensity})`;

// Edge feather
for (let i = 0; i < featherSteps; i++) {
  // Draw slightly smaller version for inner shadow
}

// Highlight preservation
ctx.globalCompositeOperation = 'screen';
ctx.fillStyle = `rgba(255, 255, 255, ${highlightIntensity * 0.3})`;
```

### Cache Key Generation

```typescript
const underwaterKey = `@uw${enabled ? '1' : '0'}${blend}${edgeSoftness}${depthBias}${tint}${edgeFeather}${highlights}${ripple}`;
const cacheKey = `${materialId}@${tileScale}@${updatedAt}${underwaterKey}`;
```

### Export Parity

The export function uses the identical pipeline as the canvas renderer, ensuring pixel-perfect matches between on-screen and exported results.

## Dev Diagnostics

In development mode, the Materials Panel shows comprehensive debugging information:

```
pipeline: underwater-v1.5
reason: active
cache: miss
ms: ~85
uw: on • blend: multiply • tint: 18% • feather: 8px • hi: 20% • ripple: 0%
params: {tileScale: 1.0, effect: {enabled: true, intensity: 65, ...}}
```

## Usage

1. **Draw a mask** on a pool area using the Area tool (A)
2. **Apply a material** - underwater effect auto-enables for pool interior materials
3. **Adjust controls** - fine-tune intensity, tint, feather, highlights, and ripple
4. **Export** - PNG export includes all underwater effects

## Disabling the Effect

To disable the underwater effect:

1. **Per-mask**: Toggle the "Under-Water Effect" switch to OFF
2. **Global**: Set `VITE_PV_UNDERWATER_V15=false` in environment variables
3. **Fallback**: System automatically falls back to v1.0 when v1.5 is disabled

## Browser Compatibility

The effect uses standard Canvas2D composite operations:
- `multiply`: Widely supported
- `screen`: Widely supported
- Graceful degradation to alpha+tint if composite modes unavailable

## Performance Notes

- **60fps interactions** on 4-6MP photos
- **Export ≤ 2s** for typical pool images
- **Memory bounded** by LRU cache (50 entries, 80% eviction threshold)
- **No GC spikes** - efficient canvas operations
- **DPR-aware** - all effects scale properly with device pixel ratio