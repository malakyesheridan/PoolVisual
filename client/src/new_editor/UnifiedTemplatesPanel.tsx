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
import { Search, Filter, Play, Copy, Edit, Trash2, MoreVertical } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

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
      
      // TODO: Implement actual template application to canvas
      // This will involve:
      // 1. Creating masks based on template geometry
      // 2. Applying materials to masks
      // 3. Placing assets at specified positions
      // 4. Updating editor state
      
      console.log('Template applied:', templateId);
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
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b">
          <h3 className="font-semibold text-gray-900 mb-3">Pool Templates</h3>
          
          {/* Search and Filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full">
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
        <div className="flex-1 overflow-y-auto p-4">
          {templates.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-2">No templates found</div>
              <div className="text-sm text-gray-400">
                Create templates in the Library or save designs from the Canvas
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Template Preview */}
                  <div className="aspect-square bg-gray-100 rounded-t-lg relative overflow-hidden">
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-gray-300 text-xs">Preview</div>
                    </div>
                    
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {template.category}
                      </Badge>
                      
                      {/* Actions menu */}
                      <div className="relative group">
                        <button className="p-1 bg-white/80 hover:bg-white rounded shadow-sm">
                          <MoreVertical className="w-3 h-3" />
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-white rounded shadow-lg border opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button 
                            onClick={() => handleApplyTemplate(template.id)}
                            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                          >
                            <Play className="w-3 h-3" />
                            Apply Template
                          </button>
                          <button 
                            onClick={() => handleDuplicateTemplate(template.id)}
                            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                          >
                            <Copy className="w-3 h-3" />
                            Duplicate
                          </button>
                          <button 
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Template Info */}
                  <div className="p-3">
                    <h4 className="font-medium text-sm text-gray-900 mb-1 line-clamp-2">
                      {template.name}
                    </h4>
                    
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {template.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {template.size}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {template.complexity}
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        {template.usageCount} uses
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
