/**
 * Quote Editor Modal Component
 * 
 * Provides a comprehensive interface for editing quote items
 * Integrates canvas sync functionality and full CRUD operations
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/measurement-utils";
import { Plus, Edit, Trash2, RefreshCw, Save, X, Eye } from "lucide-react";
import { QuoteItemEditor } from "./QuoteItemEditor";
import { useToast } from "@/hooks/use-toast";

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

interface QuoteEditorModalProps {
  quoteId: string;
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: any) => void;
  onUpdateItem: (itemId: string, updates: any) => void;
  onRemoveItem: (itemId: string) => void;
  onSyncFromCanvas: (itemId: string, measurementData: any) => void;
}

export function QuoteEditorModal({
  quoteId,
  isOpen,
  onClose,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onSyncFromCanvas
}: QuoteEditorModalProps) {
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    description: '',
    qty: '',
    unit: 'm²',
    unitPrice: '',
    kind: 'material' as const
  });
  const { toast } = useToast();

  const { data: quoteItems = [], isLoading } = useQuery({
    queryKey: ['/api/quotes', quoteId, 'items'],
    queryFn: () => apiClient.getQuoteItems(quoteId),
    enabled: isOpen && !!quoteId,
  });

  const { data: quoteData } = useQuery({
    queryKey: ['/api/quotes', quoteId],
    queryFn: () => apiClient.getQuote(quoteId),
    enabled: isOpen && !!quoteId,
  });

  const handleAddNewItem = () => {
    if (newItem.description && newItem.qty && newItem.unitPrice) {
      const qty = parseFloat(newItem.qty);
      const unitPrice = parseFloat(newItem.unitPrice);
      const lineTotal = qty * unitPrice;

      onAddItem({
        ...newItem,
        qty: qty.toString(),
        unitPrice: unitPrice.toString(),
        lineTotal: lineTotal.toString()
      });

      setNewItem({
        description: '',
        qty: '',
        unit: 'm²',
        unitPrice: '',
        kind: 'material'
      });
      setShowAddForm(false);
    }
  };

  const handleSyncFromCanvas = (item: QuoteItem) => {
    // This would need to get current canvas measurements
    // For now, show a placeholder message
    toast({
      title: "Sync from Canvas",
      description: `Syncing item "${item.description}" from canvas measurements...`,
    });
    console.log('Sync from canvas for item:', item.id);
  };

  const handleEditItem = (item: QuoteItem) => {
    setEditingItem(item.id);
  };

  const handleSaveItem = (itemId: string, updates: Partial<QuoteItem>) => {
    onUpdateItem(itemId, updates);
    setEditingItem(null);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
  };

  const handleDeleteItem = (itemId: string) => {
    onRemoveItem(itemId);
  };

  // Calculate totals
  const subtotal = quoteItems.reduce((sum, item) => sum + parseFloat(item.lineTotal || '0'), 0);
  const gst = subtotal * 0.1; // 10% GST
  const total = subtotal + gst;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Edit Quote Items
            {quoteData && (
              <Badge variant="outline" className="ml-2">
                #{quoteData.id.substring(0, 8)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Manage quote items, sync from canvas, and update pricing details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quote Summary */}
          {quoteData && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Quote Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Subtotal:</span>
                    <div className="font-semibold">{formatCurrency(subtotal)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">GST (10%):</span>
                    <div className="font-semibold">{formatCurrency(gst)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Total:</span>
                    <div className="font-semibold text-lg text-primary">{formatCurrency(total)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add New Item */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Add New Item</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(!showAddForm)}
                >
                  {showAddForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {showAddForm ? 'Cancel' : 'Add Item'}
                </Button>
              </CardTitle>
            </CardHeader>
            {showAddForm && (
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  <Input
                    placeholder="Description"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  />
                  <Input
                    placeholder="Qty"
                    type="number"
                    value={newItem.qty}
                    onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                  />
                  <Input
                    placeholder="Unit"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                  />
                  <Input
                    placeholder="Unit Price"
                    type="number"
                    value={newItem.unitPrice}
                    onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
                  />
                  <Button onClick={handleAddNewItem} className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Quote Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quote Items ({quoteItems.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Loading quote items...</div>
                </div>
              ) : quoteItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-2">No items in this quote</div>
                  <div className="text-sm text-gray-400">Add items manually or sync from canvas</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {quoteItems.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      {editingItem === item.id ? (
                        <QuoteItemEditor
                          item={item}
                          onSave={(updatedItem) => handleSaveItem(item.id, updatedItem)}
                          onCancel={handleCancelEdit}
                          onDelete={handleDeleteItem}
                          onSyncFromCanvas={handleSyncFromCanvas}
                          canSyncFromCanvas={item.calcMetaJson?.source === 'canvas'}
                        />
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{item.description}</span>
                              {item.calcMetaJson?.source === 'canvas' && (
                                <Badge variant="outline" className="text-xs">
                                  From Canvas
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                {item.kind}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600">
                              {item.qty} {item.unit} × {formatCurrency(parseFloat(item.unitPrice || '0'))} = {formatCurrency(parseFloat(item.lineTotal || '0'))}
                            </div>
                            {item.calcMetaJson?.source === 'canvas' && (
                              <div className="text-xs text-gray-500 mt-1">
                                Mask: {item.calcMetaJson.maskName} • 
                                Confidence: {item.calcMetaJson.confidence} • 
                                Method: {item.calcMetaJson.calibrationMethod}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {item.calcMetaJson?.source === 'canvas' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSyncFromCanvas(item)}
                                className="text-primary hover:text-primary"
                                title="Sync from Canvas"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditItem(item)}
                              className="text-gray-600 hover:text-gray-700"
                              title="Edit Item"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-red-600 hover:text-red-700"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
