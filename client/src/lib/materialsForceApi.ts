export async function createMaterialForce(input: any) {
  const payload = {
    name: input.name,
    category: input.category,
    unit: input.unit,
    price: input.price ?? null,
    sheet_width_mm: input.sheet_width_mm ?? input.sheetWidthMm ?? null,
    sheet_height_mm: input.sheet_height_mm ?? input.sheetHeightMm ?? null,
    tile_width_mm: input.tile_width_mm ?? input.tileWidthMm ?? null,
    tile_height_mm: input.tile_height_mm ?? input.tileHeightMm ?? null,
    texture_url: input.texture_url ?? input.textureUrl ?? null,
    thumbnail_url: input.thumbnail_url ?? input.thumbnailUrl ?? null,
    supplier: input.supplier ?? 'PoolTile',
    source_url: input.source_url ?? input.sourceUrl ?? null,
    notes: input.notes ?? null
  };

  console.log('[force] → POST /api/materials/_force', payload);
  const res = await fetch('/api/materials/_force', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  
  const text = await res.text();
  let data: any; 
  try { 
    data = text ? JSON.parse(text) : null; 
  } catch { 
    data = { raw: text }; 
  }
  
  console.log('[force] ←', res.status, data);
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Force create failed ${res.status}`);
  }
  return data; // should include id
}

export async function debugMaterials() {
  console.log('[force] → GET /api/_materials/debug');
  const res = await fetch('/api/_materials/debug', { 
    credentials: 'include' 
  });
  const data = await res.json();
  console.log('[force] ← debug response:', data);
  return data;
}