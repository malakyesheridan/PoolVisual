import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Plus, Search, Filter, FileText, MoreVertical, Trash2, Edit, Copy, Play } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { useUnifiedTemplateStore, useTemplateSelectors } from '../../stores/unifiedTemplateStore';
import { UnifiedTemplate } from '../../stores/unifiedTemplateStore';
import { TemplateCreationForm } from './TemplateCreationForm';

export const TemplatesTab = forwardRef<{ triggerAdd: () => void }, {}>((props, ref) => {
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<UnifiedTemplate | null>(null);

  // Template store
  const { 
    loadTemplates, 
    deleteTemplate, 
    duplicateTemplate, 
    applyTemplate,
    addTemplate,
    updateTemplate,
    setSearchQuery,
    setCategoryFilter,
    categoryFilter 
  } = useUnifiedTemplateStore();
  
  const { templates, loading, error } = useTemplateSelectors();

  // Expose triggerAdd function to parent component
  useImperativeHandle(ref, () => ({
    triggerAdd: () => {
      setShowAddForm(true);
      setEditingTemplate(null);
    }
  }));

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Update search query in store
  useEffect(() => {
    setSearchQuery(search);
  }, [search, setSearchQuery]);

  const handleDeleteTemplate = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      deleteTemplate(id);
    }
  };

  const handleDuplicateTemplate = (id: string) => {
    duplicateTemplate(id);
  };

  const handleUseTemplate = async (id: string) => {
    await applyTemplate(id);
    // TODO: Navigate to canvas or show success message
  };

  const handleSaveTemplate = (templateData: Omit<UnifiedTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
    if (editingTemplate) {
      // Update existing template
      updateTemplate(editingTemplate.id, templateData);
      setEditingTemplate(null);
    } else {
      // Create new template
      addTemplate(templateData);
    }
    setShowAddForm(false);
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
    setEditingTemplate(null);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
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

      {/* Content */}
      <div>
        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-500">Loading templates...</div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="text-red-500">Error: {error}</div>
          </div>
        ) : templates.length === 0 ? (
          // Empty state
          <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No templates yet
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create and save pool design templates to speed up your design process.
            </p>
            <Button 
              onClick={() => setShowAddForm(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Template
            </Button>
          </div>
        ) : (
          // Templates grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.isArray(templates) && templates.length > 0 ? templates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Template Preview */}
                <div className="aspect-square bg-gray-100 rounded-t-lg relative overflow-hidden">
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText className="w-12 h-12 text-gray-300" />
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
                          onClick={() => handleUseTemplate(template.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                        >
                          <Play className="w-3 h-3" />
                          Use Template
                        </button>
                        <button 
                          onClick={() => handleDuplicateTemplate(template.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                        >
                          <Copy className="w-3 h-3" />
                          Duplicate
                        </button>
                        <button 
                          onClick={() => setEditingTemplate(template)}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
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

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                    {template.name}
                  </h3>
                  
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {template.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {template.size}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {template.complexity}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      Used {template.usageCount} times
                    </div>
                  </div>
                </div>
              </div>
            )) : null}
          </div>
        )}
      </div>

      {/* Template Creation/Edit Form */}
      {(showAddForm || editingTemplate) && (
        <TemplateCreationForm
          onSave={handleSaveTemplate}
          onCancel={handleCancelForm}
          editingTemplate={editingTemplate}
        />
      )}
    </div>
  );
});

TemplatesTab.displayName = 'TemplatesTab';
