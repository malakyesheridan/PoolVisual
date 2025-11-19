import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Plus, Edit, X, Save } from "lucide-react";
import { formatCurrency } from "@/lib/measurement-utils";

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
}

interface QuoteBuilderProps {
  quoteId?: string;
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
  isRecalculating?: boolean;
}

export function QuoteBuilder({
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
  isRecalculating = false
}: QuoteBuilderProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    description: '',
    kind: 'material' as const,
    qty: '',
    unit: 'm²',
    unitPrice: '',
  });
  const [editingItem, setEditingItem] = useState<Partial<QuoteItem>>({});

  const depositAmount = total * depositPct;

  const handleAddItem = () => {
    if (!newItem.description || !newItem.qty || !newItem.unitPrice) {
      return;
    }

    const qty = parseFloat(newItem.qty);
    const unitPrice = parseFloat(newItem.unitPrice);
    const lineTotal = qty * unitPrice;

    // Convert numbers to strings for database numeric fields
    onItemAdd?.({
      kind: newItem.kind,
      description: newItem.description,
      unit: newItem.unit || undefined,
      qty: qty.toString(),
      unitPrice: unitPrice.toString(),
      lineTotal: lineTotal.toString(),
    });

    setNewItem({
      description: '',
      kind: 'material',
      qty: '',
      unit: 'm²',
      unitPrice: '',
    });
    setShowAddForm(false);
  };

  const handleStartEdit = (item: QuoteItem) => {
    setEditingItemId(item.id);
    setEditingItem({
      description: item.description,
      kind: item.kind,
      qty: item.qty?.toString() || '',
      unit: item.unit || '',
      unitPrice: item.unitPrice?.toString() || '',
    });
  };

  const handleSaveEdit = (itemId: string) => {
    // Validate required fields before parsing (same validation as handleAddItem)
    if (!editingItem.description || !editingItem.qty || !editingItem.unitPrice) {
      return;
    }

    const qty = parseFloat(editingItem.qty as string);
    const unitPrice = parseFloat(editingItem.unitPrice as string);
    
    // Additional validation: ensure parsed values are valid numbers
    if (isNaN(qty) || isNaN(unitPrice)) {
      return;
    }
    
    const lineTotal = qty * unitPrice;

    // Convert numbers to strings for database numeric fields
    onItemUpdate?.(itemId, {
      description: editingItem.description,
      kind: editingItem.kind,
      unit: editingItem.unit || undefined,
      qty: qty.toString(),
      unitPrice: unitPrice.toString(),
      lineTotal: lineTotal.toString(),
    });

    setEditingItemId(null);
    setEditingItem({});
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingItem({});
  };

  return (
    <div className="space-y-6">
      {/* Quote Items Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Quote Items
          </h3>
          {onItemAdd && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddForm(true)}
              className="h-8 text-xs"
            >
              <Plus className="w-3 h-3 mr-1.5" />
              Add Item
            </Button>
          )}
        </div>
        <div className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200">
                  <TableHead className="text-xs font-medium text-slate-600 p-4">
                    Description
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-600 p-4 text-center">
                    Qty
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-600 p-4 text-center">
                    Unit
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-600 p-4 text-right">
                    Unit Price
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-600 p-4 text-right">
                    Line Total
                  </TableHead>
                  <TableHead className="w-12 p-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showAddForm && (
                  <TableRow className="bg-blue-50/30">
                    <TableCell colSpan={6} className="p-4">
                      <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-4">
                          <Input
                            placeholder="Description"
                            value={newItem.description}
                            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Qty"
                            value={newItem.qty}
                            onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            placeholder="Unit"
                            value={newItem.unit}
                            onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Unit Price"
                            value={newItem.unitPrice}
                            onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="col-span-2 flex items-center gap-1">
                          <Button
                            size="sm"
                            onClick={handleAddItem}
                            className="h-9 text-xs"
                            disabled={!newItem.description || !newItem.qty || !newItem.unitPrice}
                          >
                            <Save className="w-3 h-3 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setShowAddForm(false);
                              setNewItem({
                                description: '',
                                kind: 'material',
                                qty: '',
                                unit: 'm²',
                                unitPrice: '',
                              });
                            }}
                            className="h-9 text-xs"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {items.length === 0 && !showAddForm ? (
                  <TableRow>
                    <TableCell 
                      colSpan={6} 
                      className="text-center p-8 text-slate-500"
                      data-testid="text-no-quote-items"
                    >
                      No items added to quote yet
                      {onItemAdd && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddForm(true)}
                          className="mt-4"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Your First Item
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow 
                      key={item.id} 
                      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                    >
                      <TableCell className="p-4">
                        {editingItemId === item.id ? (
                          <Input
                            value={editingItem.description || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                            className="h-9 text-sm"
                          />
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span 
                              className="font-medium text-slate-900"
                              data-testid={`text-item-description-${item.id}`}
                            >
                              {item.description}
                            </span>
                            <Badge 
                              variant="outline" 
                              className="w-fit text-xs"
                              data-testid={`badge-item-kind-${item.id}`}
                            >
                              {item.kind}
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="p-4 text-center">
                        {editingItemId === item.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editingItem.qty || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, qty: e.target.value })}
                            className="h-9 text-sm w-20"
                          />
                        ) : (
                          <span data-testid={`text-item-qty-${item.id}`}>
                            {item.qty ? parseFloat(item.qty).toFixed(2) : '-'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="p-4 text-center">
                        {editingItemId === item.id ? (
                          <Input
                            value={editingItem.unit || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                            className="h-9 text-sm w-16"
                          />
                        ) : (
                          <span data-testid={`text-item-unit-${item.id}`}>
                            {item.unit || '-'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="p-4 text-right">
                        {editingItemId === item.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editingItem.unitPrice || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, unitPrice: e.target.value })}
                            className="h-9 text-sm w-24"
                          />
                        ) : (
                          <span data-testid={`text-item-unit-price-${item.id}`}>
                            {item.unitPrice ? formatCurrency(parseFloat(item.unitPrice)) : '-'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="p-4 text-right font-medium">
                        <span data-testid={`text-item-line-total-${item.id}`}>
                          {item.lineTotal ? formatCurrency(parseFloat(item.lineTotal)) : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="p-4">
                        <div className="flex items-center gap-1">
                          {editingItemId === item.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSaveEdit(item.id)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 w-8 p-0"
                                disabled={!editingItem.description || !editingItem.qty || !editingItem.unitPrice}
                              >
                                <Save className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEdit}
                                className="text-slate-600 hover:text-slate-700 hover:bg-slate-50 h-8 w-8 p-0"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              {onItemUpdate && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStartEdit(item)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8 p-0"
                                  data-testid={`button-edit-item-${item.id}`}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                              )}
                              {onItemRemove && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onItemRemove(item.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                  data-testid={`button-remove-item-${item.id}`}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Quote Totals */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-5">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Subtotal:</span>
              <span 
                className="text-sm font-medium text-slate-900"
                data-testid="text-quote-subtotal"
              >
                {formatCurrency(subtotal)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">GST (10%):</span>
              <span 
                className="text-sm font-medium text-slate-900"
                data-testid="text-quote-gst"
              >
                {formatCurrency(gst)}
              </span>
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-slate-900">Total:</span>
              <span 
                className="text-lg font-semibold text-slate-900"
                data-testid="text-quote-total"
              >
                {formatCurrency(total)}
              </span>
            </div>
            
            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <span className="text-sm text-slate-600">Deposit Required ({(depositPct * 100).toFixed(0)}%):</span>
              <span 
                className="text-sm font-semibold text-blue-600"
                data-testid="text-deposit-amount"
              >
                {formatCurrency(depositAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quote Actions - Only Recalculate, other actions in header */}
      {onRecalculate && (
        <div className="flex items-center justify-end">
          <Button
            onClick={onRecalculate}
            variant="outline"
            size="sm"
            disabled={isRecalculating}
            className="text-slate-600 border-slate-200 hover:bg-slate-50"
            data-testid="button-recalculate"
          >
            {isRecalculating ? 'Recalculating...' : 'Recalculate Totals'}
          </Button>
        </div>
      )}
    </div>
  );
}
