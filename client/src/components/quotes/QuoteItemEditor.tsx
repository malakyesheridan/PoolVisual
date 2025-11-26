/**
 * Quote Item Editor Component
 * 
 * Provides interface for editing individual quote items
 * Integrates with the existing quote builder
 */

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/measurement-utils";
import { X, Save, Calculator, Package, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface QuoteItem {
  id: string;
  kind: 'material' | 'labor' | 'adjustment';
  description: string;
  unit?: string;
  qty?: number;
  unitPrice?: number;
  lineTotal?: number;
  materialId?: string;
  laborRuleId?: string;
  calcMetaJson?: any;
}

interface Material {
  id: string;
  name: string;
  category: string;
  price?: number;
  unit?: string;
}

interface QuoteItemEditorProps {
  item?: QuoteItem;
  materials?: Material[];
  onSave: (item: QuoteItem) => void;
  onCancel: () => void;
  onDelete?: (itemId: string) => void;
  onSyncFromCanvas?: (itemId: string) => void;
  canSyncFromCanvas?: boolean;
}

export function QuoteItemEditor({
  item,
  materials = [],
  onSave,
  onCancel,
  onDelete,
  onSyncFromCanvas,
  canSyncFromCanvas = false
}: QuoteItemEditorProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<QuoteItem>>({
    kind: 'material',
    description: '',
    unit: 'm²',
    qty: 0,
    unitPrice: 0,
    lineTotal: 0,
    ...item
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate line total when qty or unitPrice changes
  useEffect(() => {
    const qty = formData.qty || 0;
    const unitPrice = formData.unitPrice || 0;
    const lineTotal = qty * unitPrice;
    
    setFormData(prev => ({
      ...prev,
      lineTotal: roundToPrecision(lineTotal, 2)
    }));
  }, [formData.qty, formData.unitPrice]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.description?.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.qty || formData.qty <= 0) {
      newErrors.qty = 'Quantity must be greater than 0';
    }

    if (!formData.unitPrice || formData.unitPrice < 0) {
      newErrors.unitPrice = 'Unit price must be 0 or greater';
    }

    if (!formData.unit?.trim()) {
      newErrors.unit = 'Unit is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving",
        variant: "destructive",
      });
      return;
    }

    const itemToSave: QuoteItem = {
      id: formData.id || `item_${Date.now()}`,
      kind: formData.kind || 'material',
      description: formData.description || '',
      unit: formData.unit || '',
      qty: formData.qty || 0,
      unitPrice: formData.unitPrice || 0,
      lineTotal: formData.lineTotal || 0,
      materialId: formData.materialId,
      laborRuleId: formData.laborRuleId,
      calcMetaJson: formData.calcMetaJson
    };

    onSave(itemToSave);
    
    toast({
      title: "Quote Item Saved",
      description: "The quote item has been saved successfully",
    });
  };

  const handleMaterialChange = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (material) {
      setFormData(prev => ({
        ...prev,
        materialId: material.id,
        description: material.name,
        unitPrice: material.price || 0,
        unit: material.unit || 'm²'
      }));
    }
  };

  const getKindColor = (kind: string) => {
    switch (kind) {
      case 'material': return 'bg-primary/10 text-primary';
      case 'labor': return 'bg-green-100 text-green-800';
      case 'adjustment': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5" />
            {item ? 'Edit Quote Item' : 'Add Quote Item'}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Item Type */}
        <div className="space-y-2">
          <Label htmlFor="kind">Item Type</Label>
          <Select
            value={formData.kind}
            onValueChange={(value) => setFormData(prev => ({ ...prev, kind: value as any }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select item type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="material">Material</SelectItem>
              <SelectItem value="labor">Labor</SelectItem>
              <SelectItem value="adjustment">Adjustment</SelectItem>
            </SelectContent>
          </Select>
          <Badge className={getKindColor(formData.kind || 'material')}>
            {formData.kind || 'material'}
          </Badge>
        </div>

        {/* Material Selection (only for material items) */}
        {formData.kind === 'material' && materials.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="material">Material</Label>
            <Select
              value={formData.materialId || ''}
              onValueChange={handleMaterialChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a material" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{material.name}</span>
                      <span className="text-sm text-slate-500 ml-2">
                        {formatCurrency(material.price || 0)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Enter item description"
            className={errors.description ? 'border-red-500' : ''}
          />
          {errors.description && (
            <p className="text-sm text-red-600">{errors.description}</p>
          )}
        </div>

        {/* Quantity and Unit */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="qty">Quantity</Label>
            <Input
              id="qty"
              type="number"
              step="0.01"
              min="0"
              value={formData.qty || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, qty: parseFloat(e.target.value) || 0 }))}
              className={errors.qty ? 'border-red-500' : ''}
            />
            {errors.qty && (
              <p className="text-sm text-red-600">{errors.qty}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input
              id="unit"
              value={formData.unit || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
              placeholder="m², lm, each"
              className={errors.unit ? 'border-red-500' : ''}
            />
            {errors.unit && (
              <p className="text-sm text-red-600">{errors.unit}</p>
            )}
          </div>
        </div>

        {/* Unit Price */}
        <div className="space-y-2">
          <Label htmlFor="unitPrice">Unit Price</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">
              $
            </span>
            <Input
              id="unitPrice"
              type="number"
              step="0.01"
              min="0"
              value={formData.unitPrice || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
              className={`pl-8 ${errors.unitPrice ? 'border-red-500' : ''}`}
            />
          </div>
          {errors.unitPrice && (
            <p className="text-sm text-red-600">{errors.unitPrice}</p>
          )}
        </div>

        <Separator />

        {/* Line Total */}
        <div className="space-y-2">
          <Label htmlFor="lineTotal">Line Total</Label>
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-slate-500" />
            <span className="text-lg font-semibold text-slate-900">
              {formatCurrency(formData.lineTotal || 0)}
            </span>
            <span className="text-sm text-slate-500">
              ({formData.qty || 0} × {formatCurrency(formData.unitPrice || 0)})
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-2">
            {item && onDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(item.id)}
              >
                Delete Item
              </Button>
            )}
            {item && canSyncFromCanvas && onSyncFromCanvas && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSyncFromCanvas(item.id)}
                    className="text-primary hover:text-primary hover:bg-primary/5"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sync from Canvas</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {item ? 'Update Item' : 'Add Item'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to round to precision
function roundToPrecision(value: number, precision: number): number {
  return Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
}
