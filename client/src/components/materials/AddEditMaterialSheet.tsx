import { useState, useMemo } from 'react';
import { createMaterial } from '../../lib/materialsClient';
import { useMaterialsStore } from '../../stores/materialsStore';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { X, Upload, Link, Info } from 'lucide-react';

type Props = { open: boolean; onClose: () => void; initial?: any };

export function AddEditMaterialSheet({ open, onClose, initial }: Props) {
  const upsert = useMaterialsStore(s => s.upsert);

  const [tab, setTab] = useState<'details'|'prefill'|'texture'>('details');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    name: initial?.name || '',
    sku: initial?.sku || '',
    category: initial?.category || 'waterline_tile',
    unit: initial?.unit || 'm2',
    price: initial?.price ?? '',
    cost: initial?.cost ?? '',
    wastage_pct: initial?.wastage_pct ?? '8',
    margin_pct: initial?.margin_pct ?? '',
    sheet_width_mm: initial?.sheet_width_mm ?? '',
    sheet_height_mm: initial?.sheet_height_mm ?? '',
    tile_width_mm: initial?.tile_width_mm ?? '',
    tile_height_mm: initial?.tile_height_mm ?? '',
    grout_width_mm: initial?.grout_width_mm ?? '',
    thickness_mm: initial?.thickness_mm ?? '',
    finish: initial?.finish ?? '',
    texture_url: initial?.texture_url ?? '',
    thumbnail_url: initial?.thumbnail_url ?? '',
    supplier: initial?.supplier ?? 'PoolTile',
    source_url: initial?.source_url ?? '',
    notes: initial?.notes ?? ''
  });

  const [prefillUrl, setPrefillUrl] = useState('');
  const [prefillLoading, setPrefillLoading] = useState(false);

  const requiredOk = useMemo(() => !!form.name && !!form.category && !!form.unit, [form]);

  const updateForm = (updates: any) => {
    setForm((f: any) => ({ ...f, ...updates }));
  };

  async function handlePrefill() {
    if (!prefillUrl.trim()) {
      toast.error('Please enter a URL to prefill from');
      return;
    }

    setPrefillLoading(true);
    try {
      const response = await fetch(`/api/import/prefill?url=${encodeURIComponent(prefillUrl)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch product data');
      }
      
      const data = await response.json();
      
      // Update form with prefilled data
      updateForm({
        name: data.name || form.name,
        sku: data.sku || form.sku,
        category: data.categoryHint || form.category,
        unit: data.unit || form.unit,
        price: data.normalizedPrice?.toString() || data.price?.toString() || form.price,
        finish: data.finish || form.finish,
        tile_width_mm: data.sizes?.tileW?.toString() || form.tile_width_mm,
        tile_height_mm: data.sizes?.tileH?.toString() || form.tile_height_mm,
        sheet_width_mm: data.sizes?.sheetW?.toString() || form.sheet_width_mm,
        sheet_height_mm: data.sizes?.sheetH?.toString() || form.sheet_height_mm,
        supplier: data.supplier || form.supplier,
        source_url: prefillUrl
      });

      // Handle texture if available
      if (data.imageUrl) {
        try {
          const textureResponse = await fetch('/api/materials/upload-texture-from-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: data.imageUrl }),
          });
          
          if (textureResponse.ok) {
            const { textureUrl, thumbnailUrl } = await textureResponse.json();
            updateForm({
              texture_url: textureUrl,
              thumbnail_url: thumbnailUrl
            });
          }
        } catch (e) {
          console.warn('[prefill] Texture upload failed:', e);
        }
      }
      
      toast.success('Product data prefilled successfully');
    } catch (error: any) {
      console.error('[prefill] Failed:', error);
      toast.error(error.message || 'Failed to prefill product data');
    } finally {
      setPrefillLoading(false);
    }
  }

  async function onSave(e?: React.FormEvent) {
    e?.preventDefault();
    if (!requiredOk) { 
      toast.error('Name, Category, and Unit are required'); 
      return; 
    }
    
    setSaving(true);
    try {
      console.log('[sheet] Saving material:', form);
      const row = await createMaterial(form);
      
      if (!row?.id) {
        throw new Error('No ID returned from server');
      }
      
      // Update store immediately
      upsert(row);
      
      toast.success(`Saved "${row.name}"`);
      onClose();
    } catch (err: any) {
      console.error('[sheet] Save failed:', err);
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <div className="relative bg-white dark:bg-zinc-900 w-full h-full md:max-w-4xl md:h-[85vh] md:rounded-2xl shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="font-semibold text-lg">Add Material</div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-2 flex gap-1 text-sm border-b">
          {(['details', 'prefill', 'texture'] as const).map((t) => (
            <button
              key={t}
              className={`px-4 py-2 rounded-t-lg capitalize transition-colors ${
                tab === t 
                  ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {tab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  placeholder="Material name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={form.sku}
                  onChange={(e) => updateForm({ sku: e.target.value })}
                  placeholder="Product code"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={form.category} onValueChange={(value) => updateForm({ category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coping">Coping</SelectItem>
                    <SelectItem value="waterline_tile">Waterline Tile</SelectItem>
                    <SelectItem value="interior">Interior</SelectItem>
                    <SelectItem value="paving">Paving</SelectItem>
                    <SelectItem value="fencing">Fencing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <Select value={form.unit} onValueChange={(value) => updateForm({ unit: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m2">m²</SelectItem>
                    <SelectItem value="lm">Linear meter</SelectItem>
                    <SelectItem value="each">Each</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => updateForm({ price: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost">Cost</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => updateForm({ cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sheet_width_mm">Sheet Width (mm)</Label>
                <Input
                  id="sheet_width_mm"
                  type="number"
                  value={form.sheet_width_mm}
                  onChange={(e) => updateForm({ sheet_width_mm: e.target.value })}
                  placeholder="300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sheet_height_mm">Sheet Height (mm)</Label>
                <Input
                  id="sheet_height_mm"
                  type="number"
                  value={form.sheet_height_mm}
                  onChange={(e) => updateForm({ sheet_height_mm: e.target.value })}
                  placeholder="300"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => updateForm({ notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {tab === 'prefill' && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900">Auto-fill from Product URL</span>
                </div>
                <p className="text-sm text-blue-700 mb-3">
                  Paste a product URL to automatically extract name, price, dimensions, and other details.
                </p>
                
                <div className="flex gap-2">
                  <Input
                    value={prefillUrl}
                    onChange={(e) => setPrefillUrl(e.target.value)}
                    placeholder="https://example.com/product/..."
                    className="flex-1"
                  />
                  <Button 
                    onClick={handlePrefill} 
                    disabled={prefillLoading || !prefillUrl.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {prefillLoading ? 'Loading...' : 'Import'}
                  </Button>
                </div>
              </div>

              {/* Show current form values */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-2">Current Values</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Name:</strong> {form.name || 'Not set'}</div>
                  <div><strong>SKU:</strong> {form.sku || 'Not set'}</div>
                  <div><strong>Category:</strong> {form.category}</div>
                  <div><strong>Price:</strong> {form.price || 'Not set'}</div>
                  <div><strong>Dimensions:</strong> {form.sheet_width_mm && form.sheet_height_mm ? `${form.sheet_width_mm}×${form.sheet_height_mm}mm` : 'Not set'}</div>
                  <div><strong>Texture:</strong> {form.texture_url ? 'Set' : 'Not set'}</div>
                </div>
              </div>
            </div>
          )}

          {tab === 'texture' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="texture_url">Texture URL</Label>
                <Input
                  id="texture_url"
                  value={form.texture_url}
                  onChange={(e) => updateForm({ texture_url: e.target.value, thumbnail_url: e.target.value })}
                  placeholder="https://example.com/texture.jpg"
                />
              </div>

              {form.texture_url && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <Label className="block mb-2">Preview</Label>
                  <img 
                    src={form.texture_url} 
                    alt="Texture preview"
                    className="w-32 h-32 object-cover rounded border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {!requiredOk && <span className="text-red-500">* Required fields missing</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={onSave} 
              disabled={saving || !requiredOk}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? 'Saving...' : 'Save Material'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}