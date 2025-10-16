import { PhotoSpace } from "@/types/photo";

// image coords -> screen coords
export function i2s(ps: PhotoSpace, x: number, y: number) {
  return { x: ps.panX + x * ps.scale, y: ps.panY + y * ps.scale };
}

// screen coords -> image coords
export function s2i(ps: PhotoSpace, sx: number, sy: number) {
  return { x: (sx - ps.panX) / ps.scale, y: (sy - ps.panY) / ps.scale };
}
