type Row = Record<string, any>;
const API = import.meta.env.VITE_API_BASE_URL || '';

type EndpointKind = 'v2'|'v1'|'force'|null;
let resolved: EndpointKind = null;

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

export async function resolveEndpoint(): Promise<EndpointKind> {
  if (resolved) return resolved;
  
  // Try v2 first
  try { 
    await tryGet('/api/v2/materials'); 
    resolved = 'v2'; 
    console.log('[client] Resolved endpoint: v2');
    return resolved; 
  } catch {}
  
  // Try v1
  try { 
    await tryGet('/api/materials');   
    resolved = 'v1'; 
    console.log('[client] Resolved endpoint: v1');
    return resolved; 
  } catch {}
  
  // Fall back to force mode
  resolved = 'force';
  console.log('[client] Resolved endpoint: force');
  return resolved;
}

export async function listMaterials(): Promise<Row[]> {
  const kind = await resolveEndpoint();
  
  if (kind === 'v2') {
    try {
      const { items } = await tryGet('/api/v2/materials');
      return items || [];
    } catch (e) {
      console.warn('[client] v2 list failed, trying fallback:', e);
    }
  }
  
  if (kind === 'v1') {
    try {
      const data = await tryGet('/api/materials');
      return data?.items || data || [];
    } catch (e) {
      console.warn('[client] v1 list failed:', e);
    }
  }
  
  // Force mode fallback - try any available list endpoint
  try { 
    const data = await tryGet('/api/_materials/list'); 
    return data?.items || []; 
  } catch { 
    return []; 
  }
}

export async function createMaterial(input: any): Promise<Row> {
  const body = normalizeInput(input);
  const kind = await resolveEndpoint();

  // Try resolved endpoint first
  if (kind === 'v2') {
    try { 
      return await tryPost('/api/v2/materials', body); 
    } catch (e) { 
      console.warn('[client] v2 create failed, trying fallback:', e);
    }
  }
  
  if (kind === 'v1') {
    try { 
      return await tryPost('/api/materials', body); 
    } catch (e) { 
      console.warn('[client] v1 create failed, trying fallback:', e);
    }
  }
  
  // Final fallback — force insert with guaranteed fields
  const forceBody = {
    name: body.name,
    category: body.category,
    unit: body.unit,
    price: body.price ?? null,
    sheet_width_mm: body.sheet_width_mm ?? null,
    sheet_height_mm: body.sheet_height_mm ?? null,
    tile_width_mm: body.tile_width_mm ?? null,
    tile_height_mm: body.tile_height_mm ?? null,
    texture_url: body.texture_url ?? null,
    thumbnail_url: body.thumbnail_url ?? null,
    supplier: body.supplier ?? 'PoolTile',
    source_url: body.source_url ?? null,
    notes: body.notes ?? null
  };
  
  console.log('[client] Using force save fallback');
  const row = await tryPost('/api/materials/_force', forceBody);
  return row;
}

export function getResolvedEndpoint(): EndpointKind {
  return resolved;
}