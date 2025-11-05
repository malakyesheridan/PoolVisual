// Template Creation Form Component
// Multi-step form for creating new pool templates

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { ChevronLeft, ChevronRight, Save, X } from 'lucide-react';
import { UnifiedTemplate } from '../../stores/unifiedTemplateStore';
import { useUnifiedTemplateStore } from '../../stores/unifiedTemplateStore';
import { useMaterialsStore } from '../../stores/materialsSlice';
import { useUnifiedAssetStore } from '../../stores/unifiedAssetStore';
import { CompactMaterialCard } from './CompactMaterialCard';
import { MaterialBrowserModal } from './MaterialBrowserModal';
import { DimensionHelper } from './DimensionHelper';
import { PoolShapePreview } from './PoolShapePreview';
import { FreeformPoolCanvas } from './FreeformPoolCanvas';
import { getAll } from '../../materials/registry';

interface TemplateCreationFormProps {
  onSave: (template: Omit<UnifiedTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => void;
  onCancel: () => void;
  editingTemplate?: UnifiedTemplate | null;
}

type FormStep = 'basic' | 'geometry' | 'materials' | 'assets' | 'preview';

export function TemplateCreationForm({ onSave, onCancel, editingTemplate }: TemplateCreationFormProps) {
  const [currentStep, setCurrentStep] = useState<FormStep>('basic');
  const [browseModalOpen, setBrowseModalOpen] = useState(false);
  const [browseModalCategory, setBrowseModalCategory] = useState<'coping' | 'waterline_tile' | 'interior' | 'paving'>('coping');
  const [customPoints, setCustomPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [useDrawing, setUseDrawing] = useState(false);
  const [formData, setFormData] = useState<Partial<UnifiedTemplate>>({
    name: editingTemplate?.name || '',
    description: editingTemplate?.description || '',
    category: editingTemplate?.category || 'rectangular',
    tags: editingTemplate?.tags || [],
    thumbnailUrl: editingTemplate?.thumbnailUrl || '',
    poolGeometry: editingTemplate?.poolGeometry || {
      type: 'rect',
      dimensions: { width: 800, height: 400 },
      cornerRadius: 20,
    },
    materials: editingTemplate?.materials || {},
    assets: editingTemplate?.assets || [],
    complexity: editingTemplate?.complexity || 'Medium',
    size: editingTemplate?.size || 'Medium',
    estimatedCost: editingTemplate?.estimatedCost,
  });

  const { materials } = useMaterialsStore();
  const { assets } = useUnifiedAssetStore();

  // Helper to get material object from ID
  const getMaterialById = (id?: string) => {
    if (!id) return null;
    try {
      const allMaterials = getAll();
      return allMaterials[id] || null;
    } catch {
      return null;
    }
  };

  // Open browse modal for a specific category
  const handleBrowseMaterial = (category: 'coping' | 'waterline_tile' | 'interior' | 'paving') => {
    setBrowseModalCategory(category);
    setBrowseModalOpen(true);
  };

  const steps: { key: FormStep; title: string; description: string }[] = [
    { key: 'basic', title: 'Basic Info', description: 'Name and description' },
    { key: 'geometry', title: 'Pool Shape', description: 'Geometry and dimensions' },
    { key: 'materials', title: 'Materials', description: 'Select materials' },
    { key: 'assets', title: 'Assets', description: 'Add decorative elements' },
    { key: 'preview', title: 'Preview', description: 'Review and save' },
  ];

  const currentStepIndex = steps.findIndex(step => step.key === currentStep);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].key);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].key);
    }
  };

  const handleSave = () => {
    if (!formData.name?.trim()) {
      alert('Please enter a template name');
      return;
    }

    onSave(formData as Omit<UnifiedTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>);
  };

  const updateFormData = (updates: Partial<UnifiedTemplate>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !formData.tags?.includes(tag.trim())) {
      updateFormData({ tags: [...(formData.tags || []), tag.trim()] });
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateFormData({ tags: formData.tags?.filter(tag => tag !== tagToRemove) || [] });
  };

  const addAsset = (assetId: string) => {
    const asset = assets[assetId];
    if (asset) {
      updateFormData({
        assets: [
          ...(formData.assets || []),
          {
            assetId,
            position: { x: 100, y: 100 },
            scale: 1,
            rotation: 0,
          }
        ]
      });
    }
  };

  const removeAsset = (index: number) => {
    updateFormData({
      assets: formData.assets?.filter((_, i) => i !== index) || []
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {editingTemplate ? 'Edit Template' : 'Create New Template'}
          </h3>
          <p className="text-sm text-gray-600">
            Step {currentStepIndex + 1} of {steps.length}: {steps[currentStepIndex].description}
          </p>
        </div>
        <Button onClick={onCancel} variant="outline" size="sm">
          <X className="w-4 h-4 mr-1" />
          Cancel
        </Button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              index <= currentStepIndex 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              {index + 1}
            </div>
            <div className="ml-2">
              <div className={`text-sm font-medium ${
                index <= currentStepIndex ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {step.title}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-8 h-px ml-4 ${
                index < currentStepIndex ? 'bg-blue-500' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Form Content */}
      <div className="space-y-6">
        {/* Step 1: Basic Information */}
        {currentStep === 'basic' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name *
              </label>
              <Input
                value={formData.name || ''}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder="e.g., Modern Rectangular Pool"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => updateFormData({ description: e.target.value })}
                placeholder="Describe this template..."
                rows={3}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <Select 
                value={formData.category || 'rectangular'} 
                onValueChange={(value) => updateFormData({ category: value as any })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rectangular">Rectangular</SelectItem>
                  <SelectItem value="freeform">Freeform</SelectItem>
                  <SelectItem value="lap">Lap</SelectItem>
                  <SelectItem value="kidney">Kidney</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags?.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Add a tag and press Enter"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Step 2: Pool Geometry */}
        {currentStep === 'geometry' && (
          <div className="space-y-6">
            {/* Pool Shape Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pool Shape
              </label>
              <Select 
                value={formData.poolGeometry?.type || 'rect'} 
                onValueChange={(value) => {
                  setCustomPoints([]);
                  setUseDrawing(false);
                  updateFormData({ 
                    poolGeometry: { 
                      ...formData.poolGeometry!, 
                      type: value as any 
                    } 
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rect">Rectangular</SelectItem>
                  <SelectItem value="lap">Lap Pool</SelectItem>
                  <SelectItem value="kidney">Kidney</SelectItem>
                  <SelectItem value="freeform">Freeform</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Freeform Drawing Option */}
            {(formData.poolGeometry?.type || 'rect') === 'freeform' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Create Method:</label>
                  <button
                    onClick={() => {
                      setUseDrawing(false);
                      setCustomPoints([]);
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      !useDrawing
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Preset Shape
                  </button>
                  <button
                    onClick={() => setUseDrawing(true)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      useDrawing
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Draw Custom
                  </button>
                </div>

                {useDrawing && (
                  <FreeformPoolCanvas
                    onPointsChange={setCustomPoints}
                    width={400}
                    height={300}
                  />
                )}
              </div>
            )}

            {/* Visual Pool Preview */}
            <PoolShapePreview
              type={formData.poolGeometry?.type || 'rect'}
              dimensions={formData.poolGeometry?.dimensions || { width: 800, height: 400 }}
              cornerRadius={formData.poolGeometry?.cornerRadius || 20}
              materials={formData.materials}
              customPoints={useDrawing && customPoints.length > 0 ? customPoints : undefined}
            />

            {/* Dimension Helper */}
            <DimensionHelper
              pixelsPerMeter={100} // Default calibration - this could be made dynamic
              width={formData.poolGeometry?.dimensions.width || 800}
              height={formData.poolGeometry?.dimensions.height || 400}
              onDimensionChange={(width, height) => updateFormData({ 
                poolGeometry: { 
                  ...formData.poolGeometry!, 
                  dimensions: { width, height } 
                } 
              })}
            />

            {/* Size and Complexity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size Category
                </label>
                <Select 
                  value={formData.size || 'Medium'} 
                  onValueChange={(value) => updateFormData({ size: value as any })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Small">Small</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Large">Large</SelectItem>
                    <SelectItem value="Extra Large">Extra Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Complexity
                </label>
                <Select 
                  value={formData.complexity || 'Medium'} 
                  onValueChange={(value) => updateFormData({ complexity: value as any })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Materials */}
        {currentStep === 'materials' && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select Materials</h3>
              <p className="text-sm text-gray-600">
                Choose materials for different parts of the pool. These will be applied when the template is used.
              </p>
            </div>
            
            <div className="space-y-3">
              <CompactMaterialCard
                category="coping"
                material={getMaterialById(formData.materials?.coping)}
                onBrowse={() => handleBrowseMaterial('coping')}
                onClear={() => updateFormData({ 
                  materials: { 
                    ...formData.materials, 
                    coping: undefined 
                  } 
                })}
              />

              <CompactMaterialCard
                category="waterline_tile"
                material={getMaterialById(formData.materials?.waterline)}
                onBrowse={() => handleBrowseMaterial('waterline_tile')}
                onClear={() => updateFormData({ 
                  materials: { 
                    ...formData.materials, 
                    waterline: undefined 
                  } 
                })}
              />

              <CompactMaterialCard
                category="interior"
                material={getMaterialById(formData.materials?.interior)}
                onBrowse={() => handleBrowseMaterial('interior')}
                onClear={() => updateFormData({ 
                  materials: { 
                    ...formData.materials, 
                    interior: undefined 
                  } 
                })}
              />

              <CompactMaterialCard
                category="paving"
                material={getMaterialById(formData.materials?.paving)}
                onBrowse={() => handleBrowseMaterial('paving')}
                onClear={() => updateFormData({ 
                  materials: { 
                    ...formData.materials, 
                    paving: undefined 
                  } 
                })}
              />
            </div>

            {/* Live preview with materials */}
            <div className="mt-6">
              <PoolShapePreview
                type={formData.poolGeometry?.type || 'rect'}
                dimensions={formData.poolGeometry?.dimensions || { width: 800, height: 400 }}
                cornerRadius={formData.poolGeometry?.cornerRadius || 20}
                materials={formData.materials}
              />
            </div>
          </div>
        )}

        {/* Step 4: Assets */}
        {currentStep === 'assets' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Add decorative elements and features to your template.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              {Object.values(assets).map(asset => (
                <div key={asset.id} className="border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                      <img 
                        src={asset.thumbnailUrl} 
                        alt={asset.name}
                        className="w-8 h-8 object-cover rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{asset.name}</h4>
                      <p className="text-xs text-gray-500">{asset.category}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addAsset(asset.id)}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {formData.assets && formData.assets.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-sm mb-2">Selected Assets:</h4>
                <div className="space-y-2">
                  {formData.assets.map((asset, index) => {
                    const assetData = assets[asset.assetId];
                    return assetData ? (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <span className="text-sm">{assetData.name}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeAsset(index)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Preview */}
        {currentStep === 'preview' && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Template Preview</h4>
            
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Name:</span> {formData.name}
                </div>
                <div>
                  <span className="font-medium">Category:</span> {formData.category}
                </div>
                <div>
                  <span className="font-medium">Size:</span> {formData.size}
                </div>
                <div>
                  <span className="font-medium">Complexity:</span> {formData.complexity}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Description:</span> {formData.description}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Tags:</span> {formData.tags?.join(', ') || 'None'}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Pool Dimensions:</span> {formData.poolGeometry?.dimensions.width} x {formData.poolGeometry?.dimensions.height} px
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Materials:</span> {Object.values(formData.materials || {}).filter(Boolean).length} selected
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Assets:</span> {formData.assets?.length || 0} selected
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <Button
          onClick={handlePrevious}
          disabled={currentStepIndex === 0}
          variant="outline"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        <div className="flex gap-2">
          {currentStep === 'preview' ? (
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-1" />
              {editingTemplate ? 'Update Template' : 'Save Template'}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Material Browser Modal */}
      <MaterialBrowserModal
        open={browseModalOpen}
        onOpenChange={setBrowseModalOpen}
        category={browseModalCategory}
        selectedMaterialId={
          browseModalCategory === 'coping' ? formData.materials?.coping :
          browseModalCategory === 'waterline_tile' ? formData.materials?.waterline :
          browseModalCategory === 'interior' ? formData.materials?.interior :
          formData.materials?.paving
        }
        onSelect={(materialId) => {
          updateFormData({
            materials: {
              ...formData.materials,
              [browseModalCategory === 'waterline_tile' ? 'waterline' : browseModalCategory]: materialId
            }
          });
        }}
      />
    </div>
  );
}
