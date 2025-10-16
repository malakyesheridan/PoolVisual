// Pool Template Source Adapter
import { PoolTemplate, TemplateManifest, TemplateSourceInfo } from './templateTypes';

class TemplateSource {
  private templates: PoolTemplate[] = [];
  private sourceInfo: TemplateSourceInfo = { type: 'local' };

  async loadManifest(): Promise<TemplateManifest> {
    try {
      // Try local manifest first
      const response = await fetch('/templates/template-index.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const manifest: TemplateManifest = await response.json();
      this.templates = manifest.templates;
      this.sourceInfo = { type: 'local', url: '/templates/template-index.json' };
      
      return manifest;
    } catch (error) {
      console.error('Failed to load template manifest:', error);
      this.sourceInfo = { 
        type: 'local', 
        url: '/templates/template-index.json',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      // Return empty manifest as fallback
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        categories: [],
        templates: []
      };
    }
  }

  getTemplates(): PoolTemplate[] {
    return this.templates;
  }

  getTemplateById(id: string): PoolTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  getTemplatesByCategory(category: string): PoolTemplate[] {
    return this.templates.filter(t => t.category === category);
  }

  searchTemplates(query: string): PoolTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.templates.filter(t => 
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  getSourceInfo(): TemplateSourceInfo {
    return this.sourceInfo;
  }
}

export const templateSource = new TemplateSource();
