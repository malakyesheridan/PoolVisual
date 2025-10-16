// Unit Tests for Template Source
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { templateSource } from '../templateSource';
import type { PoolTemplate, TemplateManifest } from '../templateTypes';

// Mock fetch
global.fetch = vi.fn();

describe('TemplateSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load manifest successfully', async () => {
    const mockManifest: TemplateManifest = {
      version: 1,
      updatedAt: '2025-01-06T00:00:00Z',
      categories: ['rectangular', 'freeform'],
      templates: [
        {
          id: 'test_template',
          name: 'Test Template',
          category: 'rectangular',
          preview: '/templates/previews/test.png',
          description: 'Test description',
          tags: ['test'],
          scene: {
            masks: [],
            assets: []
          }
        }
      ]
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockManifest)
    });

    const result = await templateSource.loadManifest();
    
    expect(result).toEqual(mockManifest);
    expect(templateSource.getTemplates()).toHaveLength(1);
    expect(templateSource.getTemplateById('test_template')).toBeDefined();
  });

  it('should handle fetch errors gracefully', async () => {
    (fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const result = await templateSource.loadManifest();
    
    expect(result.templates).toHaveLength(0);
    expect(result.categories).toHaveLength(0);
    expect(templateSource.getSourceInfo().error).toContain('Network error');
  });

  it('should handle HTTP errors', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404
    });

    const result = await templateSource.loadManifest();
    
    expect(result.templates).toHaveLength(0);
    expect(templateSource.getSourceInfo().error).toContain('HTTP 404');
  });

  it('should filter templates by category', async () => {
    const mockManifest: TemplateManifest = {
      version: 1,
      updatedAt: '2025-01-06T00:00:00Z',
      categories: ['rectangular', 'freeform'],
      templates: [
        {
          id: 'rect_template',
          name: 'Rectangular Template',
          category: 'rectangular',
          preview: '/templates/previews/rect.png',
          description: 'Rectangular pool',
          tags: ['rectangular'],
          scene: { masks: [], assets: [] }
        },
        {
          id: 'freeform_template',
          name: 'Freeform Template',
          category: 'freeform',
          preview: '/templates/previews/freeform.png',
          description: 'Freeform pool',
          tags: ['freeform'],
          scene: { masks: [], assets: [] }
        }
      ]
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockManifest)
    });

    await templateSource.loadManifest();
    
    const rectangularTemplates = templateSource.getTemplatesByCategory('rectangular');
    expect(rectangularTemplates).toHaveLength(1);
    expect(rectangularTemplates[0].id).toBe('rect_template');
  });

  it('should search templates by name and tags', async () => {
    const mockManifest: TemplateManifest = {
      version: 1,
      updatedAt: '2025-01-06T00:00:00Z',
      categories: ['rectangular', 'spa'],
      templates: [
        {
          id: 'luxury_spa',
          name: 'Luxury Spa Pool',
          category: 'spa',
          preview: '/templates/previews/spa.png',
          description: 'Premium spa experience',
          tags: ['luxury', 'spa', 'premium'],
          scene: { masks: [], assets: [] }
        },
        {
          id: 'standard_pool',
          name: 'Standard Pool',
          category: 'rectangular',
          preview: '/templates/previews/standard.png',
          description: 'Basic rectangular pool',
          tags: ['standard', 'basic'],
          scene: { masks: [], assets: [] }
        }
      ]
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockManifest)
    });

    await templateSource.loadManifest();
    
    // Search by name
    const luxuryResults = templateSource.searchTemplates('luxury');
    expect(luxuryResults).toHaveLength(1);
    expect(luxuryResults[0].id).toBe('luxury_spa');
    
    // Search by tag
    const spaResults = templateSource.searchTemplates('spa');
    expect(spaResults).toHaveLength(1);
    expect(spaResults[0].id).toBe('luxury_spa');
    
    // Search by description
    const premiumResults = templateSource.searchTemplates('premium');
    expect(premiumResults).toHaveLength(1);
    expect(premiumResults[0].id).toBe('luxury_spa');
  });

  it('should return empty array for non-existent template', async () => {
    const mockManifest: TemplateManifest = {
      version: 1,
      updatedAt: '2025-01-06T00:00:00Z',
      categories: [],
      templates: []
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockManifest)
    });

    await templateSource.loadManifest();
    
    const template = templateSource.getTemplateById('non_existent');
    expect(template).toBeUndefined();
  });
});
