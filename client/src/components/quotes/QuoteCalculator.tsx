/**
 * Quote Calculator Component
 * 
 * Handles quote generation from job mask data
 * Provides interface for generating and managing quotes
 */

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/measurement-utils";
import { 
  Calculator, 
  FileText, 
  Package, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  ArrowRight
} from "lucide-react";

interface QuoteCalculatorProps {
  jobId: string;
  jobName?: string;
  onQuoteGenerated?: (quoteId: string) => void;
  className?: string;
}

interface GeneratedQuote {
  quote: {
    id: string;
    jobId: string;
    status: string;
    subtotal: string;
    gst: string;
    total: string;
    depositPct: string;
  };
  items: Array<{
    id: string;
    kind: string;
    description: string;
    unit: string;
    qty: string;
    unitPrice: string;
    lineTotal: string;
    materialId?: string;
  }>;
}

export function QuoteCalculator({
  jobId,
  jobName,
  onQuoteGenerated,
  className = ''
}: QuoteCalculatorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatedQuote, setGeneratedQuote] = useState<GeneratedQuote | null>(null);

  const generateQuoteMutation = useMutation({
    mutationFn: () => apiClient.generateQuoteFromJob(jobId),
    onSuccess: (data) => {
      setGeneratedQuote(data);
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      
      toast({
        title: "Quote Generated Successfully",
        description: `Quote created with ${data.items.length} items`,
      });

      if (onQuoteGenerated) {
        onQuoteGenerated(data.quote.id);
      }
    },
    onError: (error: any) => {
      console.error('Quote generation error:', error);
      toast({
        title: "Quote Generation Failed",
        description: error.message || "Failed to generate quote from job data",
        variant: "destructive",
      });
    },
  });

  const handleGenerateQuote = () => {
    generateQuoteMutation.mutate();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-primary/10 text-primary';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getKindIcon = (kind: string) => {
    switch (kind) {
      case 'material': return <Package className="w-4 h-4" />;
      case 'labor': return <Calculator className="w-4 h-4" />;
      case 'adjustment': return <FileText className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
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

  if (generatedQuote) {
    const subtotal = parseFloat(generatedQuote.quote.subtotal);
    const gst = parseFloat(generatedQuote.quote.gst);
    const total = parseFloat(generatedQuote.quote.total);
    const depositPct = parseFloat(generatedQuote.quote.depositPct);
    const depositAmount = total * depositPct;

    return (
      <Card className={className}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Quote Generated Successfully
            </CardTitle>
            <Badge className={getStatusColor(generatedQuote.quote.status)}>
              {generatedQuote.quote.status}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Quote Items Summary */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-900">Generated Items</h4>
            <div className="space-y-2">
              {generatedQuote.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getKindIcon(item.kind)}
                    <div>
                      <p className="font-medium text-slate-900">{item.description}</p>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Badge className={getKindColor(item.kind)}>
                          {item.kind}
                        </Badge>
                        <span>{item.qty} {item.unit}</span>
                        <span>× {formatCurrency(parseFloat(item.unitPrice))}</span>
                      </div>
                    </div>
                  </div>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(parseFloat(item.lineTotal))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Quote Totals */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">GST (10%)</span>
              <span className="font-medium">{formatCurrency(gst)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Total</span>
              <span className="font-bold text-lg text-slate-900">{formatCurrency(total)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Deposit ({Math.round(depositPct * 100)}%)</span>
              <span className="font-medium text-slate-700">{formatCurrency(depositAmount)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setGeneratedQuote(null)}
            >
              Generate New Quote
            </Button>
            <Button
              onClick={() => {
                // Navigate to quote editor
                window.location.href = `/quotes/${generatedQuote.quote.id}`;
              }}
              className="flex items-center gap-2"
            >
              Edit Quote
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Generate Quote from Job Data
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {jobName && (
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">Job:</p>
            <p className="font-medium text-slate-900">{jobName}</p>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-900 mb-1">What this will do:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Extract mask data from all photos in this job</li>
                <li>Calculate material quantities and costs</li>
                <li>Generate quote items with pricing</li>
                <li>Apply tax calculations and deposit percentage</li>
                <li>Create a draft quote ready for editing</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center pt-4">
          <Button
            onClick={handleGenerateQuote}
            disabled={generateQuoteMutation.isPending}
            className="flex items-center gap-2"
            size="lg"
          >
            {generateQuoteMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Quote...
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                Generate Quote
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
