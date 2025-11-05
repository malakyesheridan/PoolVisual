import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FileText, Send, DollarSign } from "lucide-react";
import { formatCurrency, roundToPrecision } from "@/lib/measurement-utils";

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
  onPreviewPDF
}: QuoteBuilderProps) {
  const [isEditingDeposit, setIsEditingDeposit] = useState(false);
  const [depositValue, setDepositValue] = useState((depositPct * 100).toString());

  const depositAmount = total * depositPct;

  const handleDepositChange = (value: string) => {
    const percentage = parseFloat(value) / 100;
    if (!isNaN(percentage) && percentage >= 0 && percentage <= 1) {
      // Update deposit percentage
      setIsEditingDeposit(false);
    }
    setDepositValue(value);
  };

  return (
    <div className="space-y-6">
      {/* Quote Items Table */}
      <Card>
        <CardHeader className="p-6">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Quote Items
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell 
                      colSpan={6} 
                      className="text-center p-8 text-slate-500"
                      data-testid="text-no-quote-items"
                    >
                      No items added to quote yet
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow 
                      key={item.id} 
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <TableCell className="p-4">
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
                      </TableCell>
                      <TableCell className="p-4 text-center">
                        <span data-testid={`text-item-qty-${item.id}`}>
                          {item.qty ? parseFloat(item.qty).toFixed(2) : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="p-4 text-center">
                        <span data-testid={`text-item-unit-${item.id}`}>
                          {item.unit || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="p-4 text-right">
                        <span data-testid={`text-item-unit-price-${item.id}`}>
                          {item.unitPrice ? formatCurrency(parseFloat(item.unitPrice)) : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="p-4 text-right font-medium">
                        <span data-testid={`text-item-line-total-${item.id}`}>
                          {item.lineTotal ? formatCurrency(parseFloat(item.lineTotal)) : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onItemRemove?.(item.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          data-testid={`button-remove-item-${item.id}`}
                        >
                          ×
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Quote Totals */}
      <Card className="bg-slate-50/50">
        <CardContent className="p-6">
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
            
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Deposit Required:</span>
                {isEditingDeposit ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={depositValue}
                      onChange={(e) => setDepositValue(e.target.value)}
                      onBlur={() => handleDepositChange(depositValue)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleDepositChange(depositValue);
                        }
                      }}
                      className="w-16 h-6 text-xs"
                      min="0"
                      max="100"
                      data-testid="input-deposit-percentage"
                    />
                    <span className="text-xs">%</span>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingDeposit(true)}
                    className="text-xs h-auto p-0 text-primary hover:bg-transparent"
                    data-testid="button-edit-deposit"
                  >
                    {(depositPct * 100).toFixed(0)}%
                  </Button>
                )}
              </div>
              <span 
                className="text-sm font-medium text-primary"
                data-testid="text-deposit-amount"
              >
                {formatCurrency(depositAmount)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quote Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={onRecalculate}
          variant="outline"
          className="text-slate-700 bg-white border-slate-300 hover:bg-slate-50"
          data-testid="button-recalculate"
        >
          Recalculate
        </Button>
        
        <Button
          onClick={onPreviewPDF}
          variant="outline"
          className="text-slate-700 bg-white border-slate-300 hover:bg-slate-50"
          data-testid="button-preview-pdf"
        >
          <FileText className="w-4 h-4 mr-2" />
          Preview PDF
        </Button>
        
        <Button
          onClick={onSendQuote}
          className="bg-primary hover:bg-primary/90 text-white"
          data-testid="button-send-quote"
        >
          <Send className="w-4 h-4 mr-2" />
          Send Quote
        </Button>
      </div>
    </div>
  );
}
