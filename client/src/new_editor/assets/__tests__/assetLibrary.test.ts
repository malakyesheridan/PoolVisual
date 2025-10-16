// Unit tests for Asset Library v1
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssetSource } from '../assetSource';
import { LRUImageCache } from '../imageCache';
import { useAssetStore } from '../assetStore';
import { AssetSourceItem } from '../types';

// Mock fetch
global.fetch = vi.fn();

describe('AssetSource', () => {
  let assetSource: AssetSource;

  beforeEach(() => {
    assetSource = new AssetSource();
    vi.clearAllMocks();
  });

  it('should load manifest from local JSON', async () => {
    const mockManifest = {
      version: 1,
      updatedAt: '2025-01-06T00:00:00Z',
      categories: ['tree', 'lawn'],
      items: [
        {
          id: 'test_asset',
          name: 'Test Asset',
          category: 'tree',
          thumb: '/assets/thumbs/test.png',
          src: '/assets/full/test.png',
          w: 100,
          h: 100,
          author: 'Test',
          license: 'test'
        }
      ]
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockManifest)
    });

    await assetSource.loadManifest();

    expect(assetSource.getItems()).toHaveLength(1);
    expect(assetSource.getItemById('test_asset')).toBeDefined();
    expect(assetSource.getSourceInfo().type).toBe('LOCAL');
  });

  it('should search items by name', () => {
    const items: AssetSourceItem[] = [
      {
        id: 'tree_1',
        name: 'Palm Tree',
        category: 'tree',
        thumb: '/thumb1.png',
        src: '/full1.png',
        w: 100,
        h: 100,
        author: 'Test',
        license: 'test',
        tags: ['palm', 'tropical']
      },
      {
        id: 'chair_1',
        name: 'Pool Chair',
        category: 'furniture',
        thumb: '/thumb2.png',
        src: '/full2.png',
        w: 100,
        h: 100,
        author: 'Test',
        license: 'test',
        tags: ['chair', 'pool']
      }
    ];

    // Mock the items
    vi.spyOn(assetSource, 'getItems').mockReturnValue(items);

    const results = assetSource.searchItems('palm');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Palm Tree');
  });

  it('should filter items by category', () => {
    const items: AssetSourceItem[] = [
      {
        id: 'tree_1',
        name: 'Palm Tree',
        category: 'tree',
        thumb: '/thumb1.png',
        src: '/full1.png',
        w: 100,
        h: 100,
        author: 'Test',
        license: 'test'
      },
      {
        id: 'chair_1',
        name: 'Pool Chair',
        category: 'furniture',
        thumb: '/thumb2.png',
        src: '/full2.png',
        w: 100,
        h: 100,
        author: 'Test',
        license: 'test'
      }
    ];

    vi.spyOn(assetSource, 'getItems').mockReturnValue(items);

    const treeItems = assetSource.getItemsByCategory('tree');
    expect(treeItems).toHaveLength(1);
    expect(treeItems[0].category).toBe('tree');
  });
});

describe('LRUImageCache', () => {
  let cache: LRUImageCache;

  beforeEach(() => {
    cache = new LRUImageCache(3);
  });

  it('should store and retrieve items', () => {
    const entry = {
      img: new Image(),
      w: 100,
      h: 100,
      status: 'ready' as const
    };

    cache.set('test-key', entry);
    const retrieved = cache.get('test-key');

    expect(retrieved).toEqual(entry);
  });

  it('should evict least recently used items when over capacity', () => {
    // Fill cache to capacity
    for (let i = 0; i < 3; i++) {
      cache.set(`key-${i}`, {
        img: new Image(),
        w: 100,
        h: 100,
        status: 'ready'
      });
    }

    // Add one more item to trigger eviction
    cache.set('key-3', {
      img: new Image(),
      w: 100,
      h: 100,
      status: 'ready'
    });

    // First item should be evicted
    expect(cache.get('key-0')).toBeNull();
    expect(cache.get('key-3')).toBeDefined();
  });

  it('should move accessed items to head', () => {
    // Add items
    cache.set('key-0', { img: new Image(), w: 100, h: 100, status: 'ready' });
    cache.set('key-1', { img: new Image(), w: 100, h: 100, status: 'ready' });
    cache.set('key-2', { img: new Image(), w: 100, h: 100, status: 'ready' });

    // Access first item
    cache.get('key-0');

    // Add new item to trigger eviction
    cache.set('key-3', { img: new Image(), w: 100, h: 100, status: 'ready' });

    // key-1 should be evicted (not key-0 since it was accessed)
    expect(cache.get('key-0')).toBeDefined();
    expect(cache.get('key-1')).toBeNull();
  });
});

describe('Asset Store', () => {
  beforeEach(() => {
    // Reset store state
    useAssetStore.setState({
      assets: {},
      order: [],
      selected: [],
      history: [],
      historyIndex: -1,
      maxHistorySize: 50
    });
  });

  it('should add asset to store', () => {
    const sourceItem: AssetSourceItem = {
      id: 'test_asset',
      name: 'Test Asset',
      category: 'tree',
      thumb: '/thumb.png',
      src: '/full.png',
      w: 100,
      h: 100,
      author: 'Test',
      license: 'test'
    };

    const assetId = useAssetStore.getState().addAsset(sourceItem, 50, 50);
    const asset = useAssetStore.getState().getAsset(assetId);

    expect(asset).toBeDefined();
    expect(asset?.x).toBe(50);
    expect(asset?.y).toBe(50);
    expect(asset?.sourceId).toBe('test_asset');
  });

  it('should move asset', () => {
    const sourceItem: AssetSourceItem = {
      id: 'test_asset',
      name: 'Test Asset',
      category: 'tree',
      thumb: '/thumb.png',
      src: '/full.png',
      w: 100,
      h: 100,
      author: 'Test',
      license: 'test'
    };

    const assetId = useAssetStore.getState().addAsset(sourceItem, 50, 50);
    useAssetStore.getState().moveAsset(assetId, 100, 100);

    const asset = useAssetStore.getState().getAsset(assetId);
    expect(asset?.x).toBe(100);
    expect(asset?.y).toBe(100);
  });

  it('should transform asset', () => {
    const sourceItem: AssetSourceItem = {
      id: 'test_asset',
      name: 'Test Asset',
      category: 'tree',
      thumb: '/thumb.png',
      src: '/full.png',
      w: 100,
      h: 100,
      author: 'Test',
      license: 'test'
    };

    const assetId = useAssetStore.getState().addAsset(sourceItem, 50, 50);
    useAssetStore.getState().transformAsset(assetId, { scale: 2.0, opacity: 0.5 });

    const asset = useAssetStore.getState().getAsset(assetId);
    expect(asset?.scale).toBe(2.0);
    expect(asset?.opacity).toBe(0.5);
  });

  it('should delete asset', () => {
    const sourceItem: AssetSourceItem = {
      id: 'test_asset',
      name: 'Test Asset',
      category: 'tree',
      thumb: '/thumb.png',
      src: '/full.png',
      w: 100,
      h: 100,
      author: 'Test',
      license: 'test'
    };

    const assetId = useAssetStore.getState().addAsset(sourceItem, 50, 50);
    useAssetStore.getState().deleteAsset(assetId);

    const asset = useAssetStore.getState().getAsset(assetId);
    expect(asset).toBeUndefined();
  });

  it('should manage selection', () => {
    const sourceItem: AssetSourceItem = {
      id: 'test_asset',
      name: 'Test Asset',
      category: 'tree',
      thumb: '/thumb.png',
      src: '/full.png',
      w: 100,
      h: 100,
      author: 'Test',
      license: 'test'
    };

    const assetId = useAssetStore.getState().addAsset(sourceItem, 50, 50);
    useAssetStore.getState().selectAsset(assetId);

    const selectedAsset = useAssetStore.getState().getSelectedAsset();
    expect(selectedAsset?.id).toBe(assetId);
  });

  it('should manage history', () => {
    const sourceItem: AssetSourceItem = {
      id: 'test_asset',
      name: 'Test Asset',
      category: 'tree',
      thumb: '/thumb.png',
      src: '/full.png',
      w: 100,
      h: 100,
      author: 'Test',
      license: 'test'
    };

    const store = useAssetStore.getState();
    
    // Add asset and push history
    const assetId = store.addAsset(sourceItem, 50, 50);
    store.pushHistory();

    // Move asset
    store.moveAsset(assetId, 100, 100);
    store.pushHistory();

    // Undo
    store.undo();
    const asset = store.getAsset(assetId);
    expect(asset?.x).toBe(50);
    expect(asset?.y).toBe(50);

    // Redo
    store.redo();
    const assetAfterRedo = store.getAsset(assetId);
    expect(assetAfterRedo?.x).toBe(100);
    expect(assetAfterRedo?.y).toBe(100);
  });
});
