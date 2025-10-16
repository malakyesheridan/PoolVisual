// Unit Tests for Manifest Validation
import { describe, it, expect, vi } from 'vitest';
import { assetSource } from '../assets/assetSource';

// Mock fetch
global.fetch = vi.fn();

describe('Manifest Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle invalid URLs gracefully', async () => {
    const mockManifest = {
      version: 1,
      updatedAt: '2025-01-06T00:00:00Z',
      categories: ['test'],
      items: [
        {
          id: 'invalid_asset',
          name: 'Invalid Asset',
          category: 'test',
          thumb: '/assets/thumbs/invalid.png',
          src: '/assets/full/invalid.png',
          w: 100,
          h: 100,
          author: 'Test',
          license: 'test',
          tags: ['test']
        }
      ]
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockManifest)
    });

    await assetSource.loadManifest();
    const items = assetSource.getItems();
    
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('invalid_asset');
  });

  it('should handle network errors without throwing', async () => {
    (fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const manifest = await assetSource.loadManifest();
    
    expect(manifest.templates).toHaveLength(0);
    expect(manifest.categories).toHaveLength(0);
    expect(assetSource.getSourceInfo().error).toContain('Network error');
  });

  it('should handle HTTP errors gracefully', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404
    });

    const manifest = await assetSource.loadManifest();
    
    expect(manifest.templates).toHaveLength(0);
    expect(assetSource.getSourceInfo().error).toContain('HTTP 404');
  });

  it('should validate asset dimensions', async () => {
    const mockManifest = {
      version: 1,
      updatedAt: '2025-01-06T00:00:00Z',
      categories: ['test'],
      items: [
        {
          id: 'valid_asset',
          name: 'Valid Asset',
          category: 'test',
          thumb: '/assets/thumbs/valid.png',
          src: '/assets/full/valid.png',
          w: 200,
          h: 300,
          author: 'Test',
          license: 'test',
          tags: ['test']
        }
      ]
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockManifest)
    });

    await assetSource.loadManifest();
    const items = assetSource.getItems();
    
    expect(items[0].w).toBe(200);
    expect(items[0].h).toBe(300);
  });

  it('should handle missing optional fields', async () => {
    const mockManifest = {
      version: 1,
      updatedAt: '2025-01-06T00:00:00Z',
      categories: ['test'],
      items: [
        {
          id: 'minimal_asset',
          name: 'Minimal Asset',
          category: 'test',
          thumb: '/assets/thumbs/minimal.png',
          src: '/assets/full/minimal.png',
          w: 100,
          h: 100
          // Missing optional fields: author, license, tags
        }
      ]
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockManifest)
    });

    await assetSource.loadManifest();
    const items = assetSource.getItems();
    
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('minimal_asset');
    expect(items[0].author).toBeUndefined();
    expect(items[0].license).toBeUndefined();
    expect(items[0].tags).toBeUndefined();
  });
});
