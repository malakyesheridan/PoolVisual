import { Texture, RepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace } from "three";

export function prepColorMap(tex?: Texture, scale = 1) {
  if (!tex) return tex;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.repeat.set(scale, scale);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function prepLinearMap(tex?: Texture, scale = 1) {
  if (!tex) return tex;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = LinearSRGBColorSpace;
  tex.repeat.set(scale, scale);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}
