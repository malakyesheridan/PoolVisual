export async function createMaterialApi(input: any) {
  const num = (v: any) => (v === '' || v === undefined || v === null ? null : Number(v));
  const payload = {
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
    org_id: input.org_id ?? input.orgId ?? null
  };

  console.log('[materials] → POST /api/materials', payload);
  const res = await fetch(`/api/materials`, {
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

  console.log('[materials] ←', res.status, data);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Create failed ${res.status}`);
  }
  return data;
}