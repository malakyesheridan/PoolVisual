// Unified Templates Panel for Canvas Editor
// Replaces the old PoolTemplates component with unified template system

import React, { useState, useEffect } from 'react';
import { useUnifiedTemplateStore, useTemplateSelectors } from '../stores/unifiedTemplateStore';
import { useEditorStore } from './store';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '../components/ui/tooltip';
import { Search, MoreVertical } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { TemplateInspector } from './components/TemplateInspector';

export function UnifiedTemplatesPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Unified template store
  const { 
    loadTemplates, 
    applyTemplate, 
    duplicateTemplate, 
    deleteTemplate,
    setSearchQuery: setStoreSearchQuery,
    setCategoryFilter 
  } = useUnifiedTemplateStore();
  
  const { templates, loading, error } = useTemplateSelectors();
  
  // Editor store for template application
  const { dispatch } = useEditorStore();

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Sync search query
  useEffect(() => {
    setStoreSearchQuery(searchQuery);
  }, [searchQuery, setStoreSearchQuery]);

  // Sync category filter
  useEffect(() => {
    setCategoryFilter(selectedCategory);
  }, [selectedCategory, setCategoryFilter]);

  const handleApplyTemplate = async (templateId: string) => {
    try {
      await applyTemplate(templateId);
      console.log('Template applied successfully:', templateId);
    } catch (error) {
      console.error('Failed to apply template:', error);
    }
  };

  const handleDuplicateTemplate = (templateId: string) => {
    duplicateTemplate(templateId);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      deleteTemplate(templateId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-500">Loading templates...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="absolute inset-0 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-100 bg-white">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Pool Templates</h3>
              {templates.length > 0 && (
                <div className="text-xs text-gray-500">
                  {templates.length} templates
                </div>
              )}
            </div>
          
          {/* Search and Filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 pl-10 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150"
                aria-label="Search templates"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="rectangular">Rectangular</SelectItem>
                <SelectItem value="freeform">Freeform</SelectItem>
                <SelectItem value="lap">Lap</SelectItem>
                <SelectItem value="kidney">Kidney</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {templates.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 text-sm mb-2">No templates found</div>
              <div className="text-xs text-gray-400">
                Create templates in the Library or save designs from the Canvas
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white border border-gray-200 rounded-xl hover:shadow-md hover:scale-[1.02] transition-all duration-150 hover:border-gray-300 flex gap-2 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-1"
                  role="button"
                  tabIndex={0}
                  aria-label={`Template: ${template.name}`}
                >
                  {/* Template Preview */}
                  <div className="w-16 h-16 bg-gray-100 rounded-lg relative flex-shrink-0">
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-gray-300 text-[10px]">Preview</div>
                    </div>
                    
                    <div className="absolute top-1 right-1">
                      <button className="p-0.5 bg-white/90 hover:bg-white rounded shadow-sm">
                        <MoreVertical className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Template Info */}
                  <div className="flex-1 p-2 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <h4 className="font-medium text-xs text-gray-900 line-clamp-1" title={template.name}>
                          {template.name}
                        </h4>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                          {template.category}
                        </Badge>
                      </div>
                      
                      <p className="text-[10px] text-gray-600 line-clamp-1 mb-1.5">
                        {template.description}
                      </p>
                      
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {template.size}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {template.complexity}
                        </Badge>
                        <span className="text-[10px] text-gray-500 ml-auto">
                          {template.usageCount} uses
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleApplyTemplate(template.id)}
                      className="mt-2 w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Phase 2: Template Section Parametric Controls */}
        <TemplateInspector />
      </div>
    </TooltipProvider>
  );
}
