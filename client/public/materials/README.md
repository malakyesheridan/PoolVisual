# PBR Materials Folder

Put your PBR texture sets here, e.g.:

```
/materials/demo/tile_albedo.jpg
/materials/demo/tile_normal.jpg
/materials/demo/tile_rough.jpg
/materials/demo/tile_ao.jpg
/materials/demo/tile_disp.jpg
```

## Recommended naming:
- `*_albedo` - Color/diffuse texture
- `*_normal` - Normal map
- `*_rough` - Roughness map
- `*_ao` - Ambient occlusion map
- `*_disp` - Displacement map

## File formats:
- JPG/PNG are fine
- Keep sizes 1k–4k
- Use square textures; they tile better

## Color correction:
- Use neutral, balanced albedo textures
- The "Match Photo" feature will automatically adjust tint to match your background
- Avoid overly saturated or warm/cool biased textures for best results

## Example structure:
```
/materials/
  /demo/
    tile_albedo.jpg
    tile_normal.jpg
    tile_rough.jpg
    tile_ao.jpg
    tile_disp.jpg
  /stone/
    stone_albedo.jpg
    stone_normal.jpg
    stone_rough.jpg
    stone_ao.jpg
```

## Recommended sources:
- **AmbientCG**: https://ambientcg.com/ (free)
- **Poly Haven**: https://polyhaven.com/materials (free)
- **3D Textures**: https://3dtextures.me/ (free)
- **Texture Haven**: https://texturehaven.com/ (free)
