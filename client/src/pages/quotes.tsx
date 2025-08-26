import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TopNavigation } from "@/components/layout/top-navigation";
import { QuoteBuilder } from "@/components/quotes/quote-builder";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Search, 
  FileText, 
  Send,
  Eye,
  Share,
  DollarSign,
  Plus,
  Filter
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency } from "@/lib/measurement-utils";

export default function Quotes() {
  const [, params] = useRoute('/quotes/:id');
  const [, navigate] = useLocation();
  const quoteId = params?.id;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: orgs = [] } = useQuery({
    queryKey: ['/api/me/orgs'],
    queryFn: () => apiClient.getMyOrgs(),
  });

  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ['/api/quotes', quoteId],
    queryFn: () => quoteId ? apiClient.getQuote(quoteId) : Promise.resolve(null),
    enabled: !!quoteId,
  });

  const recalculateQuoteMutation = useMutation({
    mutationFn: (id: string) => apiClient.recalculateQuote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
      toast({
        title: "Quote recalculated",
        description: "All totals have been updated.",
      });
    },
  });

  // Auto-select first org if available
  if (!selectedOrgId && orgs.length > 0) {
    setSelectedOrgId(orgs[0].id);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // If viewing a specific quote
  if (quoteId) {
    if (quoteLoading) {
      return (
        <div className="min-h-screen bg-slate-50">
          <TopNavigation currentPage="quotes" />
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-slate-200 rounded w-64"></div>
              <Card className="h-96"></Card>
            </div>
          </div>
        </div>
      );
    }

    if (!quote) {
      return (
        <div className="min-h-screen bg-slate-50">
          <TopNavigation currentPage="quotes" />
          <div className="max-w-6xl mx-auto px-6 py-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-4">Quote not found</h1>
            <Button onClick={() => navigate('/quotes')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Quotes
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50">
        <TopNavigation currentPage="quotes" />
        
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/quotes')}
                data-testid="button-back-to-quotes"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-slate-900" data-testid="text-quote-title">
                    Quote #{quote.id.slice(-8).toUpperCase()}
                  </h1>
                  <Badge className={getStatusColor(quote.status)} data-testid="badge-quote-status">
                    {quote.status}
                  </Badge>
                </div>
                <p className="text-slate-600">
                  Created {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" data-testid="button-preview-quote">
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              
              {quote.publicToken && (
                <Button variant="outline" data-testid="button-share-quote">
                  <Share className="w-4 h-4 mr-2" />
                  Share Link
                </Button>
              )}
              
              {quote.status === 'draft' && (
                <Button data-testid="button-send-quote">
                  <Send className="w-4 h-4 mr-2" />
                  Send Quote
                </Button>
              )}
            </div>
          </div>

          {/* Quote Builder */}
          <QuoteBuilder
            quoteId={quote.id}
            items={quote.items || []}
            subtotal={parseFloat(quote.subtotal || '0')}
            gst={parseFloat(quote.gst || '0')}
            total={parseFloat(quote.total || '0')}
            depositPct={parseFloat(quote.depositPct || '0.3')}
            onRecalculate={() => recalculateQuoteMutation.mutate(quote.id)}
            onSendQuote={() => {
              toast({
                title: "Quote sent",
                description: "The quote has been sent to the client.",
              });
            }}
            onPreviewPDF={() => {
              // Open PDF preview
              console.log('Preview PDF');
            }}
          />
        </div>
      </div>
    );
  }

  // Quotes list view
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNavigation currentPage="quotes" />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">
              Quotes
            </h1>
            <p className="text-slate-600 mt-1">
              Manage and track your project quotes
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" data-testid="button-filters">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            
            <Button data-testid="button-new-quote">
              <Plus className="w-4 h-4 mr-2" />
              New Quote
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search quotes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-quotes"
            />
          </div>
          
          {orgs.length > 1 && (
            <select
              value={selectedOrgId || ''}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
              data-testid="select-organization"
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Quotes</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="stat-total-quotes">
                    12
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Pending</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="stat-pending-quotes">
                    3
                  </p>
                </div>
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Send className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Accepted</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="stat-accepted-quotes">
                    7
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Value</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="stat-total-value">
                    {formatCurrency(87650)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quotes List */}
        <Card>
          <CardHeader className="border-b border-slate-200">
            <CardTitle>Recent Quotes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No quotes found</h3>
              <p className="text-slate-500 mb-4" data-testid="text-no-quotes">
                Create your first quote from a job with photos and measurements.
              </p>
              <Button data-testid="button-create-first-quote">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Quote
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
