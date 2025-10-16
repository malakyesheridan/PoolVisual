export interface Material {
  id: string;                // stable key (e.g., "marble_coping")
  name: string;
  textureUrl: string;        // absolute or app-relative URL to texture image
  scale?: number;            // optional tiling scale (image-space units per repeat)
  opacity?: number;          // optional 0..1
}
