import { Material } from './types';

// Demo materials for MVP with data URL textures
export const DEMO_MATERIALS: Material[] = [
  {
    id: 'tile-1',
    name: 'Ceramic Tile',
    textureUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgZmlsbD0iI0U1RTdFQSIvPgo8cmVjdCB4PSIzMiIgeT0iMzIiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgZmlsbD0iI0U1RTdFQSIvPgo8cmVjdCB4PSIzMiIgeT0iMCIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjAiIHk9IjMyIiB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIGZpbGw9IiNGM0Y0RjYiLz4KPHN2Zz4=',
    scale: 0.5
  },
  {
    id: 'stone-1', 
    name: 'Natural Stone',
    textureUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjNjc3NDc0Ii8+CjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjQiIGZpbGw9IiM1NzU3NTciLz4KPGNpcmNsZSBjeD0iNDgiIGN5PSIyMCIgcj0iMyIgZmlsbD0iIzU3NTc1NyIvPgo8Y2lyY2xlIGN4PSIzMiIgY3k9IjQwIiByPSI1IiBmaWxsPSIjNTc1NzU3Ii8+CjxjaXJjbGUgY3g9IjEyIiBjeT0iNDgiIHI9IjIiIGZpbGw9IiM1NzU3NTciLz4KPGNpcmNsZSBjeD0iNTIiIGN5PSI1MiIgcj0iNCIgZmlsbD0iIzU3NTc1NyIvPgo8L3N2Zz4=',
    scale: 0.3
  },
  {
    id: 'wood-1',
    name: 'Wood Decking',
    textureUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjOEQ2QjM5Ii8+CjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSI2NCIgaGVpZ2h0PSI4IiBmaWxsPSIjN0M1QjI5Ii8+CjxyZWN0IHg9IjAiIHk9IjE2IiB3aWR0aD0iNjQiIGhlaWdodD0iOCIgZmlsbD0iIzdDNUIyOSIvPgo8cmVjdCB4PSIwIiB5PSIzMiIgd2lkdGg9IjY0IiBoZWlnaHQ9IjgiIGZpbGw9IiM3QzVCMjkiLz4KPHJlY3QgeD0iMCIgeT0iNDgiIHdpZHRoPSI2NCIgaGVpZ2h0PSI4IiBmaWxsPSIjN0M1QjI5Ii8+CjxsaW5lIHgxPSIwIiB5MT0iMCIgeDI9IjY0IiB5Mj0iMCIgc3Ryb2tlPSIjNjQ0NjM0IiBzdHJva2Utd2lkdGg9IjEiLz4KPGxpbmUgeDE9IjAiIHkxPSIxNiIgeDI9IjY0IiB5Mj0iMTYiIHN0cm9rZT0iIzY0NDYzNCIgc3Ryb2tlLXdpZHRoPSIxIi8+CjxsaW5lIHgxPSIwIiB5MT0iMzIiIHgyPSI2NCIgeTI9IjMyIiBzdHJva2U9IiM2NDQ2MzQiIHN0cm9rZS13aWR0aD0iMSIvPgo8bGluZSB4MT0iMCIgeTE9IjQ4IiB4Mj0iNjQiIHkyPSI0OCIgc3Ryb2tlPSIjNjQ0NjM0IiBzdHJva2Utd2lkdGg9IjEiLz4KPC9zdmc+',
    scale: 0.4
  }
];

// Fallback material if textures fail to load
export const FALLBACK_MATERIAL: Material = {
  id: 'fallback',
  name: 'Solid Color',
  textureUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  scale: 1.0
};

export function getMaterial(id: string): Material {
  return DEMO_MATERIALS.find(m => m.id === id) || FALLBACK_MATERIAL;
}
