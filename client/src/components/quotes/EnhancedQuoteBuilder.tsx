/**
 * Enhanced Quote Builder
 * 
 * Integrates quote generation from job data with manual quote editing
 * Combines QuoteCalculator and QuoteItemEditor with existing quote builder
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/measurement-utils";
import { QuoteCalculator } from "./QuoteCalculator";
import { QuoteItemEditor } from "./QuoteItemEditor";
import { PDFPreview } from "./PDFPreview";
import { 
  FileText, 
  Send, 
  DollarSign, 
  Plus,
  Edit,
  Calculator,
  Package,
  Download
} from "lucide-react";

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

interface EnhancedQuoteBuilderProps {
  quoteId?: string;
  jobId?: string;
  jobName?: string;
  items?: QuoteItem[];
  subtotal?: number;
  gst?: number;
  total?: number;
  depositPct?: number;
  onItemAdd?: (item: Omit<QuoteItem, 'id'>) => void;
  onItemUpdate?: (itemId: string, updates: Partial<QuoteItem>) => void;
  onItemRemove?: (itemId: string) => void;
  onRecalculate?: () => void;
  onSendQuote?: () => void;
  onPreviewPDF?: () => void;
  className?: string;
}

export function EnhancedQuoteBuilder({
  quoteId,
  jobId,
  jobName,
  items = [],
  subtotal = 0,
  gst = 0,
  total = 0,
  depositPct = 0.3,
  onItemAdd,
  onItemUpdate,
  onItemRemove,
  onRecalculate,
  onSendQuote,
  onPreviewPDF,
  className = ''
}: EnhancedQuoteBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showItemEditor, setShowItemEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<QuoteItem | null>(null);
  const [showQuoteCalculator, setShowQuoteCalculator] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);

  // Fetch materials for the item editor
  const { data: materials = [] } = useQuery({
    queryKey: ['/api/materials'],
    queryFn: () => apiClient.getMaterials(),
    enabled: showItemEditor || !!editingItem,
  });

  // Recalculate quote mutation
  const recalculateMutation = useMutation({
    mutationFn: () => {
      if (!quoteId) throw new Error('Quote ID required for recalculation');
      return apiClient.recalculateQuote(quoteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
      toast({
        title: "Quote Recalculated",
        description: "All totals have been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Recalculation Failed",
        description: error.message || "Failed to recalculate quote",
        variant: "destructive",
      });
    },
  });

  const handleAddItem = () => {
    setEditingItem(null);
    setShowItemEditor(true);
  };

  const handleEditItem = (item: QuoteItem) => {
    setEditingItem(item);
    setShowItemEditor(true);
  };

  const handleSaveItem = async (item: QuoteItem) => {
    try {
      if (editingItem) {
        // Update existing item
        if (onItemUpdate) {
          onItemUpdate(item.id, item);
        } else if (quoteId) {
          await apiClient.updateQuoteItem(quoteId, item.id, item);
          queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
        }
      } else {
        // Add new item
        if (onItemAdd) {
          onItemAdd(item);
        } else if (quoteId) {
          await apiClient.addQuoteItem(quoteId, item);
          queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
        }
      }

      setShowItemEditor(false);
      setEditingItem(null);
      
      toast({
        title: "Quote Item Saved",
        description: editingItem ? "Item updated successfully" : "Item added successfully",
      });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save quote item",
        variant: "destructive",
      });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      if (onItemRemove) {
        onItemRemove(itemId);
      } else if (quoteId) {
        await apiClient.removeQuoteItem(quoteId, itemId);
        queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
      }

      setShowItemEditor(false);
      setEditingItem(null);
      
      toast({
        title: "Item Deleted",
        description: "Quote item removed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete quote item",
        variant: "destructive",
      });
    }
  };

  const handleQuoteGenerated = (newQuoteId: string) => {
    setShowQuoteCalculator(false);
    // Navigate to the new quote or refresh current view
    if (onRecalculate) {
      onRecalculate();
    }
  };

  const getKindColor = (kind: string) => {
    switch (kind) {
      case 'material': return 'bg-blue-100 text-blue-800';
      case 'labor': return 'bg-green-100 text-green-800';
      case 'adjustment': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const depositAmount = total * depositPct;

  if (showItemEditor) {
    return (
      <QuoteItemEditor
        item={editingItem || undefined}
        materials={materials}
        onSave={handleSaveItem}
        onCancel={() => {
          setShowItemEditor(false);
          setEditingItem(null);
        }}
        onDelete={editingItem ? handleDeleteItem : undefined}
      />
    );
  }

  if (showQuoteCalculator && jobId) {
    return (
      <QuoteCalculator
        jobId={jobId}
        jobName={jobName}
        onQuoteGenerated={handleQuoteGenerated}
        className={className}
      />
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Actions */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Quote Builder
            </CardTitle>
            <div className="flex items-center gap-2">
              {jobId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuoteCalculator(true)}
                  className="flex items-center gap-2"
                >
                  <Calculator className="w-4 h-4" />
                  Generate from Job
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quote Items */}
      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium mb-2">No items in quote yet</p>
              <p className="text-sm mb-4">
                {jobId 
                  ? "Generate items from job data or add items manually"
                  : "Add items manually to build your quote"
                }
              </p>
              <div className="flex items-center justify-center gap-2">
                {jobId && (
                  <Button
                    variant="outline"
                    onClick={() => setShowQuoteCalculator(true)}
                    className="flex items-center gap-2"
                  >
                    <Calculator className="w-4 h-4" />
                    Generate from Job
                  </Button>
                )}
                <Button
                  onClick={handleAddItem}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Item Manually
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-4 text-xs font-medium text-slate-600">Description</th>
                    <th className="text-center p-4 text-xs font-medium text-slate-600">Qty</th>
                    <th className="text-center p-4 text-xs font-medium text-slate-600">Unit</th>
                    <th className="text-right p-4 text-xs font-medium text-slate-600">Unit Price</th>
                    <th className="text-right p-4 text-xs font-medium text-slate-600">Line Total</th>
                    <th className="w-12 p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-900">{item.description}</span>
                          <Badge className={`w-fit text-xs ${getKindColor(item.kind)}`}>
                            {item.kind}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span>{item.qty?.toFixed(2) || '-'}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span>{item.unit || '-'}</span>
                      </td>
                      <td className="p-4 text-right">
                        <span>{item.unitPrice ? formatCurrency(item.unitPrice) : '-'}</span>
                      </td>
                      <td className="p-4 text-right font-medium">
                        <span>{item.lineTotal ? formatCurrency(item.lineTotal) : '-'}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditItem(item)}
                            className="text-slate-600 hover:text-slate-700 hover:bg-slate-100"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            ×
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote Totals */}
      {items.length > 0 && (
        <Card className="bg-slate-50/50">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Subtotal:</span>
                <span className="text-sm font-medium text-slate-900">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">GST (10%):</span>
                <span className="text-sm font-medium text-slate-900">
                  {formatCurrency(gst)}
                </span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-slate-900">Total:</span>
                <span className="text-lg font-semibold text-slate-900">
                  {formatCurrency(total)}
                </span>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-sm text-slate-600">Deposit Required ({(depositPct * 100).toFixed(0)}%):</span>
                <span className="text-sm font-medium text-primary">
                  {formatCurrency(depositAmount)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quote Actions */}
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <Button
            onClick={() => recalculateMutation.mutate()}
            variant="outline"
            disabled={recalculateMutation.isPending}
            className="text-slate-700 bg-white border-slate-300 hover:bg-slate-50"
          >
            {recalculateMutation.isPending ? "Recalculating..." : "Recalculate"}
          </Button>
          
          <Button
            onClick={() => setShowPDFPreview(true)}
            variant="outline"
            className="text-slate-700 bg-white border-slate-300 hover:bg-slate-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            Preview PDF
          </Button>
          
          <Button
            onClick={onSendQuote}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            <Send className="w-4 h-4 mr-2" />
            Send Quote
          </Button>
        </div>
      )}
      
      {/* PDF Preview Modal */}
      {quoteId && (
        <PDFPreview
          quoteId={quoteId}
          isOpen={showPDFPreview}
          onClose={() => setShowPDFPreview(false)}
          filename={`quote-${quoteId.substring(0, 8)}.pdf`}
        />
      )}
    </div>
  );
}
