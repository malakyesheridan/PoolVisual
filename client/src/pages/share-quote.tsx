import { useState } from 'react';
import { useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { 
  FileText, 
  Check, 
  X, 
  MessageSquare,
  Download,
  Calendar,
  DollarSign,
  CreditCard,
  Building
} from "lucide-react";
import { formatCurrency } from "@/lib/measurement-utils";
import { Logo } from "@/components/brand/Logo";
// Stripe imports removed - payments handled externally

// Stripe integration removed - payments handled externally
// const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

function PaymentForm({ amount }: { amount: number }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Payment will be processed through external payment system.
        Deposit amount: {formatCurrency(amount)}
      </p>
      <Button 
        className="w-full"
        data-testid="button-pay-deposit"
        disabled
      >
        External Payment Required
      </Button>
    </div>
  );
}

export default function ShareQuote() {
  const [, params] = useRoute('/share/q/:token');
  const token = params?.token;
  const [showPayment, setShowPayment] = useState(false);

  const { data: quote, isLoading } = useQuery({
    queryKey: ['/api/share/q', token],
    queryFn: () => token ? apiClient.getSharedQuote(token) : Promise.resolve(null),
    enabled: !!token,
  });

  const handleAcceptQuote = async () => {
    if (!quote) return;
    // Payment handled externally - just show payment section
    setShowPayment(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Quote not found</h1>
            <p className="text-slate-600">
              This quote link may have expired or been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const depositAmount = parseFloat(quote.total) * parseFloat(quote.depositPct || '0.3');
  const remainingAmount = parseFloat(quote.total) - depositAmount;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Logo variant="full" size="md" />
          </div>
          
          <Badge variant="outline" data-testid="badge-quote-status">
            Quote #{quote.id.slice(-8).toUpperCase()}
          </Badge>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Quote Header */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Pool Renovation Quote</CardTitle>
                <p className="text-slate-600 mt-1">
                  Valid for {quote.validityDays} days from quote date
                </p>
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-900" data-testid="text-quote-total">
                  {formatCurrency(parseFloat(quote.total))}
                </div>
                <div className="text-sm text-slate-600">Total (inc. GST)</div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quote Items */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Before/After Images */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Project Visualization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
                  <p className="text-slate-500" data-testid="text-project-images">
                    Before/After comparison images will be displayed here
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quote Items */}
            <Card>
              <CardHeader>
                <CardTitle>Quote Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {quote.items && quote.items.length > 0 ? (
                  <div className="space-y-4">
                    {quote.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-start py-3 border-b border-slate-100 last:border-0">
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900" data-testid={`text-item-description-${item.id}`}>
                            {item.description}
                          </h4>
                          <div className="text-sm text-slate-600 mt-1">
                            {item.qty && item.unit && (
                              <span data-testid={`text-item-qty-${item.id}`}>
                                {item.qty} {item.unit}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-slate-900" data-testid={`text-item-total-${item.id}`}>
                            {formatCurrency(parseFloat(item.lineTotal || '0'))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-8" data-testid="text-no-items">
                    No items in this quote
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quote Summary & Actions */}
          <div className="space-y-6">
            
            {/* Quote Totals */}
            <Card>
              <CardHeader>
                <CardTitle>Quote Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal:</span>
                  <span data-testid="text-quote-subtotal">
                    {formatCurrency(parseFloat(quote.subtotal || '0'))}
                  </span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">GST (10%):</span>
                  <span data-testid="text-quote-gst">
                    {formatCurrency(parseFloat(quote.gst || '0'))}
                  </span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span data-testid="text-quote-total-summary">
                    {formatCurrency(parseFloat(quote.total))}
                  </span>
                </div>
                
                <Separator />
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Deposit Required:</span>
                    <span className="font-medium text-primary" data-testid="text-deposit-amount">
                      {formatCurrency(depositAmount)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-600">Remaining on Completion:</span>
                    <span data-testid="text-remaining-amount">
                      {formatCurrency(remainingAmount)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Form */}
            {showPayment ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Pay Deposit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PaymentForm amount={depositAmount} />
                </CardContent>
              </Card>
            ) : (
              /* Quote Actions */
              <Card>
                <CardHeader>
                  <CardTitle>Quote Response</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={handleAcceptQuote}
                    data-testid="button-accept-quote"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Accept & Pay Deposit
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    data-testid="button-request-changes"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Request Changes
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid="button-decline-quote"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Decline Quote
                  </Button>
                  
                  <Separator />
                  
                  <Button 
                    variant="ghost" 
                    className="w-full"
                    data-testid="button-download-pdf"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Quote Validity */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-amber-800">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Valid for {quote.validityDays} days
                  </span>
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  This quote expires and prices may change after the validity period.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
