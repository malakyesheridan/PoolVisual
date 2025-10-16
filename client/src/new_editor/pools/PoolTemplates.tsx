// Pool Templates UI Component
import React, { useState, useEffect, useCallback } from 'react';
import { PoolTemplate, TemplateCategory } from './templateTypes';
import { templateSource } from './templateSource';
import { useEditorStore } from '../store';

interface PoolTemplatesProps {
  onTemplateApply?: (template: PoolTemplate, mode: 'replace' | 'merge') => void;
}

export function PoolTemplates({ onTemplateApply }: PoolTemplatesProps) {
  const [templates, setTemplates] = useState<PoolTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<PoolTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  const { dispatch } = useEditorStore();

  // Load templates on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        
        await templateSource.loadManifest();
        const loadedTemplates = templateSource.getTemplates();
        setTemplates(loadedTemplates);
        setFilteredTemplates(loadedTemplates);
      } catch (err) {
        console.error('Failed to load templates:', err);
        setError('Failed to load pool templates');
        setTemplates([]);
        setFilteredTemplates([]);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter templates based on search and category
  useEffect(() => {
    let filtered = templates;

    if (debouncedQuery) {
      filtered = templateSource.searchTemplates(debouncedQuery);
    }

    if (selectedCategory) {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    setFilteredTemplates(filtered);
  }, [templates, debouncedQuery, selectedCategory]);

  const handleTemplateApply = useCallback((template: PoolTemplate, mode: 'replace' | 'merge') => {
    if (onTemplateApply) {
      onTemplateApply(template, mode);
    } else {
      // Default implementation
      dispatch({
        type: 'APPLY_TEMPLATE',
        payload: { template, mode }
      });
    }
  }, [onTemplateApply, dispatch]);

  const categories = Array.from(new Set(templates.map(t => t.category)));

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading templates...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-500 text-center">
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <h3 className="text-lg font-semibold mb-4">Pool Templates</h3>
      
      {/* Source info */}
      <div className="mb-4 p-2 border rounded text-sm bg-green-50 border-green-200">
        <div className="font-medium text-green-800">
          Template Library Enabled
        </div>
        <div className="text-green-600">
          Source: {templateSource.getSourceInfo().type} ({templateSource.getSourceInfo().url})
        </div>
      </div>

      {/* Search and Filter */}
      <div className="mb-4 space-y-2">
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        {categories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as TemplateCategory | '')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        )}
        
        <div className="text-xs text-gray-500">
          Showing {filteredTemplates.length} of {templates.length} templates
        </div>
      </div>

      {/* Template Grid */}
      <div className="space-y-3">
        {filteredTemplates.length === 0 ? (
          <div className="text-gray-500 text-sm py-4 text-center">
            {templates.length === 0 ? (
              <div>
                <p>No templates available</p>
                <p className="text-xs mt-1">Templates will appear here when added to the library</p>
              </div>
            ) : (
              <div>
                <p>No templates match your search</p>
                <p className="text-xs mt-1">Try adjusting your search or category filter</p>
              </div>
            )}
          </div>
        ) : (
          filteredTemplates.map(template => (
            <div
              key={template.id}
              className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:bg-gray-50"
            >
              <div className="flex items-start space-x-3">
                <div className="w-16 h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={template.preview}
                    alt={template.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.backgroundColor = '#e5e7eb';
                      target.style.display = 'flex';
                      target.style.alignItems = 'center';
                      target.style.justifyContent = 'center';
                      target.textContent = '📋';
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">{template.name}</h4>
                  <p className="text-xs text-gray-500 mb-1">{template.description}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {template.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        const mode = window.confirm('Replace current scene? (Cancel to merge)') ? 'replace' : 'merge';
                        handleTemplateApply(template, mode);
                      }}
                      className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => {
                        // Preview functionality - could open modal or show details
                        alert(`Preview: ${template.name}\n\n${template.description}\n\nMasks: ${template.scene.masks.length}\nAssets: ${template.scene.assets.length}`);
                      }}
                      className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => {
                        alert(`Template: ${template.name}\nCategory: ${template.category}\nTags: ${template.tags.join(', ')}\n\nScene contains ${template.scene.masks.length} masks and ${template.scene.assets.length} assets.`);
                      }}
                      className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                    >
                      Info
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
