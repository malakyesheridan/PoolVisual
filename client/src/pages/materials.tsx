import { useState, useCallback, useRef, useEffect } from 'react';
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
  Filter,
  Image,
  X,
  Link2,
  FileText,
  Zap,
  Download,
  Check
} from "lucide-react";
import { useMaterialsStore } from "@/stores/materialsSlice";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [texturePreview, setTexturePreview] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [productUrl, setProductUrl] = useState('');
  const [pasteSpecs, setPasteSpecs] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [allImageUrls, setAllImageUrls] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedSpecs, setDetectedSpecs] = useState<any>(null);
  const [saveAndNext, setSaveAndNext] = useState(false);
  const pasteAreaRef = useRef<HTMLTextAreaElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    unit: '',
    cost: '',
    price: '',
    wastagePct: '10',
    marginPct: '30',
    supplier: '',
    color: '',
    finish: '',
    tileWidthMm: '',
    tileHeightMm: '',
    sheetWidthMm: '',
    sheetHeightMm: '',
    groutWidthMm: '',
    thicknessMm: '',
    notes: '',
    makeSeamless: true
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
    mutationFn: async (data: any) => {
      console.log('[materials] Creating material:', data);
      
      // If we have a preview image but no texture_url, include imageUrlFallback
      const payload = {
        ...data,
        orgId: selectedOrgId,
        imageUrlFallback: !data.texture_url && imageUrl ? imageUrl : undefined
      };
      
      const result = await apiClient.createMaterial(payload);
      console.log('[materials] Created material response:', result);
      return result;
    },
    onSuccess: (material: any) => {
      // Update materials store immediately
      if (useMaterialsStore.getState) {
        useMaterialsStore.getState().upsert(material);
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/materials'] });
      
      toast({
        title: "Material saved",
        description: `${material.name} has been added to your library.`,
      });
      
      // Handle form state based on save type
      if (!saveAndNext) {
        setShowAddForm(false);
        // Clear form
        setFormData({
          name: '',
          sku: '',
          category: '',
          unit: '',
          cost: '',
          price: '',
          wastagePct: '8',
          marginPct: '',
          supplier: 'PoolTile',
          color: '',
          finish: '',
          tileWidthMm: '',
          tileHeightMm: '',
          sheetWidthMm: '',
          sheetHeightMm: '',
          groutWidthMm: '',
          thicknessMm: '',
          notes: '',
          makeSeamless: true
        });
        setTexturePreview(null);
        setFileKey(null);
      } else {
        resetFormForNext();
        setSaveAndNext(false);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error creating material",
        description: error?.response?.data?.error || error.message,
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
    
    // Validate required fields
    if (!formData.name || !formData.category || !formData.unit) {
      toast({
        title: "Validation Error",
        description: "Please fill in Name, Category, and Unit fields.",
        variant: "destructive",
      });
      return;
    }
    
    const materialData = {
      name: formData.name,
      sku: formData.sku || null,
      category: formData.category,
      unit: formData.unit,
      supplier: formData.supplier || "PoolTile",
      source_url: formData.sourceUrl || null,
      finish: formData.finish || null,
      cost: formData.cost ? parseFloat(formData.cost) : null,
      price: formData.price ? parseFloat(formData.price) : null,
      wastage_pct: formData.wastagePct ? parseFloat(formData.wastagePct) : 8,
      margin_pct: formData.marginPct ? parseFloat(formData.marginPct) : null,
      tile_width_mm: formData.tileWidthMm ? parseInt(formData.tileWidthMm) : null,
      tile_height_mm: formData.tileHeightMm ? parseInt(formData.tileHeightMm) : null,
      sheet_width_mm: formData.sheetWidthMm ? parseInt(formData.sheetWidthMm) : null,
      sheet_height_mm: formData.sheetHeightMm ? parseInt(formData.sheetHeightMm) : null,
      grout_width_mm: formData.groutWidthMm ? parseInt(formData.groutWidthMm) : null,
      thickness_mm: formData.thicknessMm ? parseInt(formData.thicknessMm) : null,
      notes: formData.notes || null,
      texture_url: texturePreview || null,
      thumbnail_url: texturePreview || null,
      fileKey: fileKey,
      orgId: selectedOrgId
    };

    createMaterialMutation.mutate(materialData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle file upload
  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|jpg)$/)) {
      toast({
        title: "Invalid file type",
        description: "Please select a JPEG or PNG image.",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setTexturePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    try {
      const formData = new FormData();
      formData.append('texture', file);
      
      const response = await fetch('/api/materials/upload-texture', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const { fileKey } = await response.json();
      setFileKey(fileKey);
      
      toast({
        title: "Texture uploaded",
        description: "Ready to create material with texture."
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Could not upload texture. Please try again.",
        variant: "destructive"
      });
      setSelectedFile(null);
      setTexturePreview(null);
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const calculateRepeatM = useCallback(() => {
    if (formData.sheetWidthMm && parseFloat(formData.sheetWidthMm) > 0) {
      return (parseFloat(formData.sheetWidthMm) / 1000).toFixed(3);
    } else if (formData.tileWidthMm && parseFloat(formData.tileWidthMm) > 0) {
      return (parseFloat(formData.tileWidthMm) / 1000).toFixed(3);
    }
    return '0.300'; // Default 30cm
  }, [formData.sheetWidthMm, formData.tileWidthMm]);

  const clearTexture = () => {
    setSelectedFile(null);
    setTexturePreview(null);
    setFileKey(null);
  };

  // Prefill from URL
  const handlePrefillFromUrl = async () => {
    if (!productUrl.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a valid product URL.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/import/prefill?url=${encodeURIComponent(productUrl)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch product data');
      }
      
      const data = await response.json();
      
      // Prefill form data
      setFormData(prev => ({
        ...prev,
        name: data.name || prev.name,
        sku: data.sku || prev.sku,
        category: data.categoryHint || prev.category,
        unit: data.unit || prev.unit,
        price: data.normalizedPrice?.toString() || data.price?.toString() || prev.price,
        finish: data.finish || prev.finish,
        tileWidthMm: data.sizes.tileW?.toString() || prev.tileWidthMm,
        tileHeightMm: data.sizes.tileH?.toString() || prev.tileHeightMm,
        sheetWidthMm: data.sizes.sheetW?.toString() || prev.sheetWidthMm,
        sheetHeightMm: data.sizes.sheetH?.toString() || prev.sheetHeightMm,
        groutWidthMm: data.sizes.grout?.toString() || prev.groutWidthMm,
        thicknessMm: data.sizes.thickness?.toString() || prev.thicknessMm
      }));
      
      // Set image URLs if available
      if (data.allImageUrls && data.allImageUrls.length > 0) {
        setAllImageUrls(data.allImageUrls);
        setImageUrl(data.allImageUrls[0]);
        setSelectedImageIndex(0);
        
        // Auto-process the first image
        await handleImageFromUrl(data.allImageUrls[0]);
      } else if (data.imageUrl) {
        setImageUrl(data.imageUrl);
        setAllImageUrls([data.imageUrl]);
        
        // Auto-process the image
        await handleImageFromUrl(data.imageUrl);
      }
      
      toast({
        title: "Product data loaded",
        description: "Form has been prefilled with product information."
      });
      
    } catch (error) {
      console.error('Prefill error:', error);
      toast({
        title: "Prefill failed",
        description: "Could not fetch product data from URL.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Parse specs text
  const handleSpecsParse = async () => {
    if (!pasteSpecs.trim()) return;
    
    try {
      const response = await fetch('/api/import/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteSpecs })
      });
      
      if (!response.ok) throw new Error('Parse failed');
      
      const data = await response.json();
      setDetectedSpecs(data);
      
      // Auto-fill detected specs
      setFormData(prev => ({
        ...prev,
        category: data.category || prev.category,
        unit: data.unit || prev.unit,
        price: data.normalizedPrice?.toString() || prev.price,
        finish: data.finish || prev.finish,
        tileWidthMm: data.tileW?.toString() || prev.tileWidthMm,
        tileHeightMm: data.tileH?.toString() || prev.tileHeightMm,
        sheetWidthMm: data.sheetW?.toString() || prev.sheetWidthMm,
        sheetHeightMm: data.sheetH?.toString() || prev.sheetHeightMm,
        groutWidthMm: data.grout?.toString() || prev.groutWidthMm,
        thicknessMm: data.thickness?.toString() || prev.thicknessMm
      }));
      
    } catch (error) {
      console.error('Parse error:', error);
    }
  };

  // Auto-parse on blur
  useEffect(() => {
    if (pasteSpecs.trim() && pasteSpecs.length > 10) {
      const timeoutId = setTimeout(handleSpecsParse, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [pasteSpecs]);

  // Handle image from URL
  const handleImageFromUrl = async (urlToProcess?: string) => {
    const urlToUse = urlToProcess || imageUrl;
    if (!urlToUse.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a valid image URL.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch('/api/materials/upload-texture-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: urlToUse })
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      setTexturePreview(data.thumbnailUrl);
      setFileKey(data.textureUrl); // Use texture URL as file key for this case
      
      toast({
        title: "Image processed",
        description: "Texture has been processed and is ready to use."
      });
      
    } catch (error) {
      console.error('Image URL error:', error);
      toast({
        title: "Image processing failed",
        description: "Could not process image from URL.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle clipboard paste for images
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        handleFileSelect(file);
      }
    }
  }, [handleFileSelect]);

  // Add clipboard listener
  useEffect(() => {
    if (showAddForm) {
      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }
  }, [showAddForm, handlePaste]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showAddForm) return;
      
      if (e.key === 'Escape') {
        setShowAddForm(false);
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSaveAndNext(true);
        handleSubmit(e as any);
      } else if (e.key === 'Enter' && !e.shiftKey && e.target instanceof HTMLInputElement) {
        e.preventDefault();
        handleSubmit(e as any);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showAddForm]);

  // Reset form for "Save & Add Next"
  const resetFormForNext = () => {
    const stickyCategory = formData.category;
    const stickyUnit = formData.unit;
    
    setFormData({
      name: '',
      sku: '',
      category: stickyCategory, // Keep category sticky
      unit: stickyUnit, // Keep unit sticky
      cost: '',
      price: '',
      wastagePct: '10',
      marginPct: '30',
      supplier: '',
      color: '',
      finish: '',
      tileWidthMm: '',
      tileHeightMm: '',
      sheetWidthMm: '',
      sheetHeightMm: '',
      groutWidthMm: '',
      thicknessMm: '',
      notes: '',
      makeSeamless: true
    });
    
    // Clear import fields
    setProductUrl('');
    setPasteSpecs('');
    setImageUrl('');
    setAllImageUrls([]);
    setSelectedImageIndex(0);
    setDetectedSpecs(null);
    clearTexture();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <div className="hidden md:block">
        <TopNavigation currentPage="materials" />
      </div>
      
      {/* Mobile header */}
      <div className="md:hidden safe-top bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold mobile-text-lg">Materials</h1>
          <Button
            onClick={() => setShowAddForm(true)}
            className="tap-target"
            size="sm"
            data-testid="button-add-material"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto mobile-container md:px-6 mobile-spacing md:py-8">
        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between mb-8">
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
              data-testid="button-add-material-desktop"
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
              <SelectItem value="all">All Categories</SelectItem>
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
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
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
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-600" />
                    Manual Import Turbo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* Quick Import Section */}
                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-blue-600" />
                        <Label className="font-medium text-blue-900">Quick Import</Label>
                      </div>
                      
                      {/* Product URL */}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Paste PoolTile product URL..."
                          value={productUrl}
                          onChange={(e) => setProductUrl(e.target.value)}
                          className="flex-1"
                          data-testid="input-product-url"
                        />
                        <Button
                          type="button"
                          onClick={handlePrefillFromUrl}
                          disabled={isProcessing || !productUrl.trim()}
                          size="sm"
                          data-testid="button-prefill"
                        >
                          {isProcessing ? (
                            <Download className="w-4 h-4 animate-spin" />
                          ) : (
                            <>Prefill</>
                          )}
                        </Button>
                      </div>
                      
                      {/* Paste Specs */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Paste Specs</Label>
                        <Textarea
                          ref={pasteAreaRef}
                          placeholder="Paste product specifications text...
e.g. 'Sheet 300×300mm, Tile 25×25mm, $149/m², Tumbled finish'"
                          value={pasteSpecs}
                          onChange={(e) => setPasteSpecs(e.target.value)}
                          rows={3}
                          className="text-sm"
                          data-testid="textarea-paste-specs"
                        />
                        
                        {/* Detected Specs */}
                        {detectedSpecs && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {detectedSpecs.sheetW && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                <Check className="w-3 h-3" />
                                Sheet {detectedSpecs.sheetW}×{detectedSpecs.sheetH}mm
                              </span>
                            )}
                            {detectedSpecs.tileW && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                <Check className="w-3 h-3" />
                                Tile {detectedSpecs.tileW}×{detectedSpecs.tileH}mm
                              </span>
                            )}
                            {detectedSpecs.normalizedPrice && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                <Check className="w-3 h-3" />
                                ${detectedSpecs.normalizedPrice.toFixed(2)}/{detectedSpecs.priceUnit}
                              </span>
                            )}
                            {detectedSpecs.finish && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                <Check className="w-3 h-3" />
                                {detectedSpecs.finish}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Texture Section */}
                    <div className="space-y-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex items-center gap-2">
                        <Image className="w-4 h-4 text-amber-600" />
                        <Label className="font-medium text-amber-900">Texture</Label>
                      </div>
                      
                      <div className="flex gap-2">
                        <Input
                          placeholder="Image URL..."
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          className="flex-1"
                          data-testid="input-image-url"
                        />
                        <Button
                          type="button"
                          onClick={() => handleImageFromUrl()}
                          disabled={isUploading || !imageUrl.trim()}
                          size="sm"
                          data-testid="button-use-image-url"
                        >
                          {isUploading ? (
                            <Download className="w-4 h-4 animate-spin" />
                          ) : (
                            <>Use URL</>
                          )}
                        </Button>
                      </div>
                      
                      {/* Image Picker for Multiple Detected Images */}
                      {allImageUrls.length > 1 && (
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Detected Images ({allImageUrls.length})</Label>
                          <div className="flex gap-2 overflow-x-auto">
                            {allImageUrls.map((imgUrl, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  setSelectedImageIndex(index);
                                  setImageUrl(imgUrl);
                                }}
                                className={`relative flex-shrink-0 w-16 h-16 border-2 rounded overflow-hidden ${
                                  selectedImageIndex === index 
                                    ? 'border-blue-500 ring-2 ring-blue-200' 
                                    : 'border-gray-300 hover:border-gray-400'
                                }`}
                                data-testid={`image-option-${index}`}
                              >
                                <img
                                  src={imgUrl}
                                  alt={`Option ${index + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling?.removeAttribute('style');
                                  }}
                                />
                                <div className="absolute inset-0 bg-gray-200 flex items-center justify-center text-xs text-gray-500" style={{ display: 'none' }}>
                                  No preview
                                </div>
                                {selectedImageIndex === index && (
                                  <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">
                                    ✓
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-sm text-amber-700">
                        💡 Tip: Paste images from clipboard with Ctrl/Cmd+V or upload files below
                      </div>
                    </div>
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
                          value={formData.wastagePct}
                          onChange={(e) => handleInputChange('wastagePct', e.target.value)}
                          data-testid="input-material-wastage"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="margin">Margin (%)</Label>
                        <Input
                          id="margin"
                          type="number"
                          step="0.1"
                          value={formData.marginPct}
                          onChange={(e) => handleInputChange('marginPct', e.target.value)}
                          data-testid="input-material-margin"
                        />
                      </div>
                    </div>

                    {/* Texture Upload Section */}
                    <div className="space-y-3">
                      <Label>Texture</Label>
                      
                      {!texturePreview ? (
                        <div
                          className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-slate-400 transition-colors cursor-pointer"
                          onDrop={handleFileDrop}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => document.getElementById('texture-upload')?.click()}
                          data-testid="texture-upload-zone"
                        >
                          <input
                            id="texture-upload"
                            type="file"
                            accept="image/jpeg,image/png,image/jpg"
                            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                            className="hidden"
                          />
                          <Image className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                          <p className="text-sm text-slate-600">
                            {isUploading ? 'Uploading...' : 'Drop texture image or click to browse'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            JPEG or PNG, up to 50MB
                          </p>
                        </div>
                      ) : (
                        <div className="relative">
                          <img
                            src={texturePreview}
                            alt="Texture preview"
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={clearTexture}
                            data-testid="button-clear-texture"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Physical Dimensions */}
                    <div className="space-y-3">
                      <Label>Physical Dimensions (Optional)</Label>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="tileWidth" className="text-xs">Tile Width (mm)</Label>
                          <Input
                            id="tileWidth"
                            type="number"
                            value={formData.tileWidthMm}
                            onChange={(e) => handleInputChange('tileWidthMm', e.target.value)}
                            placeholder="300"
                            data-testid="input-tile-width"
                          />
                        </div>
                        <div>
                          <Label htmlFor="tileHeight" className="text-xs">Tile Height (mm)</Label>
                          <Input
                            id="tileHeight"
                            type="number"
                            value={formData.tileHeightMm}
                            onChange={(e) => handleInputChange('tileHeightMm', e.target.value)}
                            placeholder="300"
                            data-testid="input-tile-height"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="sheetWidth" className="text-xs">Sheet Width (mm)</Label>
                          <Input
                            id="sheetWidth"
                            type="number"
                            value={formData.sheetWidthMm}
                            onChange={(e) => handleInputChange('sheetWidthMm', e.target.value)}
                            placeholder="315"
                            data-testid="input-sheet-width"
                          />
                        </div>
                        <div>
                          <Label htmlFor="sheetHeight" className="text-xs">Sheet Height (mm)</Label>
                          <Input
                            id="sheetHeight"
                            type="number"
                            value={formData.sheetHeightMm}
                            onChange={(e) => handleInputChange('sheetHeightMm', e.target.value)}
                            placeholder="315"
                            data-testid="input-sheet-height"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="groutWidth" className="text-xs">Grout Width (mm)</Label>
                          <Input
                            id="groutWidth"
                            type="number"
                            value={formData.groutWidthMm}
                            onChange={(e) => handleInputChange('groutWidthMm', e.target.value)}
                            placeholder="3"
                            data-testid="input-grout-width"
                          />
                        </div>
                        <div>
                          <Label htmlFor="thicknessMm" className="text-xs">Thickness (mm)</Label>
                          <Input
                            id="thicknessMm"
                            type="number"
                            value={formData.thicknessMm}
                            onChange={(e) => handleInputChange('thicknessMm', e.target.value)}
                            placeholder="6"
                            data-testid="input-thickness"
                          />
                        </div>
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
                    
                    <div className="space-y-2 pt-4">
                      <div className="flex gap-2">
                        <Button 
                          type="submit" 
                          className="flex-1"
                          disabled={createMaterialMutation.isPending}
                          data-testid="button-save-material"
                        >
                          {createMaterialMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                        <Button 
                          type="submit" 
                          onClick={() => setSaveAndNext(true)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                          disabled={createMaterialMutation.isPending}
                          data-testid="button-save-and-next"
                        >
                          Save & Add Next
                        </Button>
                      </div>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setShowAddForm(false)}
                        className="w-full"
                        data-testid="button-cancel-material"
                      >
                        Cancel (Esc)
                      </Button>
                      <div className="text-xs text-slate-500 text-center">
                        💡 Enter = Save • Cmd/Ctrl+Enter = Save & Add Next • Esc = Cancel
                      </div>
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
