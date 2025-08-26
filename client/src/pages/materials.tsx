import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TopNavigation } from "@/components/layout/top-navigation";
import { MaterialCard } from "@/components/materials/material-card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  Upload,
  Package,
  Filter
} from "lucide-react";

const materialCategories = [
  { value: 'coping', label: 'Coping' },
  { value: 'waterline_tile', label: 'Waterline Tile' },
  { value: 'interior', label: 'Interior Finish' },
  { value: 'paving', label: 'Paving' },
  { value: 'fencing', label: 'Fencing' },
];

const materialUnits = [
  { value: 'm2', label: 'Square Meters (m²)' },
  { value: 'lm', label: 'Linear Meters (lm)' },
  { value: 'each', label: 'Each' },
];

export default function Materials() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    unit: '',
    cost: '',
    price: '',
    defaultWastagePct: '10',
    defaultMarginPct: '30',
    notes: '',
  });

  const { toast } = useToast();

  const { data: orgs = [] } = useQuery({
    queryKey: ['/api/me/orgs'],
    queryFn: () => apiClient.getMyOrgs(),
  });

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['/api/materials', selectedOrgId, selectedCategory],
    queryFn: () => selectedOrgId ? apiClient.getMaterials(selectedOrgId, selectedCategory) : Promise.resolve([]),
    enabled: !!selectedOrgId,
  });

  const createMaterialMutation = useMutation({
    mutationFn: (data: any) => apiClient.createMaterial(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/materials'] });
      setShowAddForm(false);
      setFormData({
        name: '',
        sku: '',
        category: '',
        unit: '',
        cost: '',
        price: '',
        defaultWastagePct: '10',
        defaultMarginPct: '30',
        notes: '',
      });
      toast({
        title: "Material created",
        description: "The material has been added successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating material",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-select first org if available
  if (!selectedOrgId && orgs.length > 0) {
    setSelectedOrgId(orgs[0].id);
  }

  const filteredMaterials = materials.filter(material =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const materialData = {
      ...formData,
      orgId: selectedOrgId,
      cost: formData.cost ? parseFloat(formData.cost) : null,
      price: formData.price ? parseFloat(formData.price) : null,
      defaultWastagePct: parseFloat(formData.defaultWastagePct),
      defaultMarginPct: parseFloat(formData.defaultMarginPct),
    };

    createMaterialMutation.mutate(materialData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNavigation currentPage="materials" />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">
              Materials Library
            </h1>
            <p className="text-slate-600 mt-1">
              Manage your pool renovation materials and pricing
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              data-testid="button-import-materials"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            
            <Button 
              onClick={() => setShowAddForm(true)}
              data-testid="button-add-material"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Material
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search materials..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-materials"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48" data-testid="select-category-filter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {materialCategories.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {orgs.length > 1 && (
            <Select value={selectedOrgId || ''} onValueChange={setSelectedOrgId}>
              <SelectTrigger className="w-48" data-testid="select-organization">
                <SelectValue placeholder="Select Organization" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Materials Grid */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="p-4">
                    <div className="w-full h-32 bg-slate-100 rounded-md mb-3 animate-pulse" />
                    <div className="h-4 bg-slate-100 rounded mb-2 animate-pulse" />
                    <div className="h-3 bg-slate-100 rounded mb-2 animate-pulse w-2/3" />
                    <div className="flex justify-between items-center">
                      <div className="h-3 bg-slate-100 rounded w-1/3 animate-pulse" />
                      <div className="h-5 bg-slate-100 rounded w-16 animate-pulse" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredMaterials.length === 0 ? (
              <Card className="p-12 text-center">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No materials found</h3>
                <p className="text-slate-500 mb-4" data-testid="text-no-materials">
                  {searchTerm || selectedCategory 
                    ? 'No materials match your search criteria.' 
                    : 'Get started by adding your first material.'
                  }
                </p>
                <Button onClick={() => setShowAddForm(true)} data-testid="button-create-first-material">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Material
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredMaterials.map((material) => (
                  <MaterialCard 
                    key={material.id} 
                    material={material}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Add Material Form */}
          {showAddForm && (
            <div className="lg:col-span-1">
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Add New Material</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Material Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Travertine Silver"
                        required
                        data-testid="input-material-name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="sku">SKU</Label>
                      <Input
                        id="sku"
                        value={formData.sku}
                        onChange={(e) => handleInputChange('sku', e.target.value)}
                        placeholder="TRV-SIL-001"
                        required
                        data-testid="input-material-sku"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                        <SelectTrigger data-testid="select-material-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {materialCategories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="unit">Unit</Label>
                      <Select value={formData.unit} onValueChange={(value) => handleInputChange('unit', value)}>
                        <SelectTrigger data-testid="select-material-unit">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {materialUnits.map((unit) => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="cost">Cost ($)</Label>
                        <Input
                          id="cost"
                          type="number"
                          step="0.01"
                          value={formData.cost}
                          onChange={(e) => handleInputChange('cost', e.target.value)}
                          placeholder="65.00"
                          data-testid="input-material-cost"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="price">Price ($)</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => handleInputChange('price', e.target.value)}
                          placeholder="85.00"
                          data-testid="input-material-price"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="wastage">Wastage (%)</Label>
                        <Input
                          id="wastage"
                          type="number"
                          step="0.1"
                          value={formData.defaultWastagePct}
                          onChange={(e) => handleInputChange('defaultWastagePct', e.target.value)}
                          data-testid="input-material-wastage"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="margin">Margin (%)</Label>
                        <Input
                          id="margin"
                          type="number"
                          step="0.1"
                          value={formData.defaultMarginPct}
                          onChange={(e) => handleInputChange('defaultMarginPct', e.target.value)}
                          data-testid="input-material-margin"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        placeholder="Additional notes about this material..."
                        rows={3}
                        data-testid="textarea-material-notes"
                      />
                    </div>
                    
                    <div className="flex space-x-3 pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setShowAddForm(false)}
                        className="flex-1"
                        data-testid="button-cancel-material"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        className="flex-1"
                        disabled={createMaterialMutation.isPending}
                        data-testid="button-save-material"
                      >
                        {createMaterialMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
