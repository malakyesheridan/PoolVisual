// src/materials/registry.ts
type MaterialRec = {
  id: string;
  name: string;
  albedoURL: string;        // texture to render
  defaultTileScale?: number;
};

type Registry = {
  byId: Record<string, MaterialRec>;
  loaded: boolean;
  loading: Promise<void> | null;
};

const REG: Registry = { byId: {}, loaded: false, loading: null };

export async function ensureMaterialsLoaded(): Promise<void> {
  if (REG.loaded) return;
  if (REG.loading) return REG.loading;

  REG.loading = (async () => {
    try {
      const res = await fetch('/materials/materials.json', { cache: 'no-cache' });
      const json = await res.json();
      const arr = Array.isArray(json) ? json : (Array.isArray(json.materials) ? json.materials : []);
      const map: Record<string, MaterialRec> = {};
      for (const it of arr) {
        if (it?.id && it?.albedoURL) {
          map[it.id] = {
            id: it.id,
            name: it.name ?? it.id,
            albedoURL: it.albedoURL,
            defaultTileScale: typeof it.defaultTileScale === 'number' ? it.defaultTileScale : undefined,
          };
        }
      }
      REG.byId = map;
      REG.loaded = true;
      // Debug
      console.log('[MaterialsLoaded]', { count: Object.keys(map).length });
    } catch (e) {
      console.warn('[MaterialsLoadError]', e);
      REG.byId = {};
      REG.loaded = true; // prevent infinite retries
    }
  })();

  return REG.loading;
}

export function getTextureUrl(materialId: string | null | undefined): string | null {
  if (!materialId) return null;
  const rec = REG.byId[materialId];
  if (!rec?.albedoURL) {
    console.log('[MaterialTextureMissing]', { materialId, available: Object.keys(REG.byId) });
    return null;
  }
  return rec.albedoURL;
}
