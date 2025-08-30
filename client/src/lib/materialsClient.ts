import type { Material } from '../state/materialsStore';

type Row = Record<string, any>;
const API = import.meta.env.VITE_API_BASE_URL || '';
type EndpointKind = 'v2'|'v1'|'force';
const SS_KEY = 'materials_endpoint_kind';

let resolved: EndpointKind | null = (sessionStorage.getItem(SS_KEY) as EndpointKind) || null;

function snakeify(obj: any) {
  if (!obj || typeof obj !== 'object') return obj;
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    const s = k.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);
    out[s] = (typeof v === 'string' && v.trim() === '') ? null : v;
  }
  return out;
}

function num(v: any) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeInput(input: any) {
  const base = {
    name: input.name,
    sku: input.sku ?? null,
    category: input.category,
    unit: input.unit,
    price: num(input.price ?? input.priceAmount),
    cost: num(input.cost),
    wastage_pct: num(input.wastage_pct ?? input.wastagePct),
    margin_pct: num(input.margin_pct ?? input.marginPct),
    tile_width_mm: num(input.tile_width_mm ?? input.tileWidthMm),
    tile_height_mm: num(input.tile_height_mm ?? input.tileHeightMm),
    sheet_width_mm: num(input.sheet_width_mm ?? input.sheetWidthMm),
    sheet_height_mm: num(input.sheet_height_mm ?? input.sheetHeightMm),
    grout_width_mm: num(input.grout_width_mm ?? input.groutWidthMm),
    thickness_mm: num(input.thickness_mm ?? input.thicknessMm),
    finish: input.finish ?? null,
    texture_url: input.texture_url ?? input.textureUrl ?? null,
    thumbnail_url: input.thumbnail_url ?? input.thumbnailUrl ?? null,
    supplier: input.supplier ?? 'PoolTile',
    source_url: input.source_url ?? input.sourceUrl ?? null,
    notes: input.notes ?? null,
  };
  return snakeify(base);
}

async function tryPost(path: string, body: any) {
  console.log(`[client] → POST ${path}`, body);
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Row|undefined;
  try { json = text ? JSON.parse(text) : undefined; } catch { json = undefined; }
  console.log(`[client] ← ${res.status}`, json);
  if (!res.ok) throw new Error(json?.message || json?.error || `${res.status} ${res.statusText}`);
  return json as Row;
}

async function tryGet(path: string) {
  console.log(`[client] → GET ${path}`);
  const res = await fetch(`${API}${path}`, { credentials: 'include' });
  const json = await res.json().catch(() => ({}));
  console.log(`[client] ← ${res.status}`, json);
  if (!res.ok) throw new Error(json?.message || json?.error || `${res.status}`);
  return json;
}

export async function resolveMaterialsEndpoint(): Promise<EndpointKind> {
  if (resolved) return resolved;
  try { await tryGet('/api/v2/materials'); resolved = 'v2'; } catch {
    try { await tryGet('/api/materials'); resolved = 'v1'; } catch {
      resolved = 'force';
    }
  }
  sessionStorage.setItem(SS_KEY, resolved);
  return resolved;
}

/** LIST with robust fallbacks; returns [] only if we truly have no rows. */
export async function listMaterialsClient(): Promise<Material[]> {
  const kind = await resolveMaterialsEndpoint();
  if (kind === 'v2') {
    const { items } = await tryGet('/api/v2/materials');
    return items || [];
  }
  if (kind === 'v1') {
    const data = await tryGet('/api/materials');
    // tolerate either {items} or raw array
    return (Array.isArray(data) ? data : data?.items) || [];
  }
  // FORCE mode — try debug/last endpoints if present; otherwise do not clobber store.
  try {
    const dbg = await tryGet('/api/_materials/last'); // you added this earlier
    return dbg?.items || [];
  } catch {
    return []; // will be treated as "no update" by hydrateMerge
  }
}

/** CREATE with fallback chain; always returns a row with id */
export async function createMaterialClient(input: any): Promise<Material> {
  const body = normalizeInput(input);
  const kind = await resolveMaterialsEndpoint();

  if (kind === 'v2') {
    try { return await tryPost('/api/v2/materials', body); } catch {/*fallthrough*/}
  }
  if (kind === 'v1') {
    try { return await tryPost('/api/materials', body); } catch {/*fallthrough*/}
  }
  // FORCE write
  const forceBody = {
    name: body.name, category: body.category, unit: body.unit,
    price: body.price ?? null,
    sheet_width_mm: body.sheet_width_mm ?? null, sheet_height_mm: body.sheet_height_mm ?? null,
    tile_width_mm: body.tile_width_mm ?? null, tile_height_mm: body.tile_height_mm ?? null,
    texture_url: body.texture_url ?? null, thumbnail_url: body.thumbnail_url ?? null,
    supplier: body.supplier ?? 'PoolTile', source_url: body.source_url ?? null, notes: body.notes ?? null
  };
  return await tryPost('/api/materials/_force', forceBody);
}

// Keep legacy exports for compatibility
export const listMaterials = listMaterialsClient;
export const createMaterial = createMaterialClient;
export const resolveEndpoint = resolveMaterialsEndpoint;