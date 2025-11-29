import { useState, useMemo } from 'react';
import React from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QuoteBuilder } from "@/components/quotes/quote-builder";
import { JobSelectionModal } from "@/components/quotes/JobSelectionModal";
import { PDFPreview } from "@/components/quotes/PDFPreview";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOrgs } from "@/hooks/useOrgs";
import { 
  ArrowLeft, 
  Search, 
  FileText, 
  Eye,
  DollarSign,
  Plus,
  Filter,
  User,
  Calendar,
  MoreHorizontal,
  Link as LinkIcon,
  Edit,
  Save,
  X,
  Trash2,
  Copy,
  Download,
  Send
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency } from "@/lib/measurement-utils";

export default function Quotes() {
  const [, params] = useRoute('/quotes/:id');
  const [, navigate] = useLocation();
  const quoteId = params?.id;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [showJobSelectionModal, setShowJobSelectionModal] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [isEditingQuoteName, setIsEditingQuoteName] = useState(false);
  const [quoteNameValue, setQuoteNameValue] = useState('');
  const [deleteConfirmQuoteId, setDeleteConfirmQuoteId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: orgs = [] } = useOrgs();

  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ['/api/quotes', quoteId],
    queryFn: () => quoteId ? apiClient.getQuote(quoteId) : Promise.resolve(null),
    enabled: !!quoteId,
    staleTime: 30 * 1000, // 30 seconds
  });

  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ['/api/quotes', selectedOrgId],
    queryFn: () => selectedOrgId ? apiClient.getQuotes(selectedOrgId) : Promise.resolve([]),
    enabled: !!selectedOrgId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Memoize filtered quotes for performance
  const filteredQuotes = React.useMemo(() => {
    if (!searchTerm) return quotes;
    const lowerSearch = searchTerm.toLowerCase();
    return quotes.filter(quote =>
      quote.clientName?.toLowerCase().includes(lowerSearch) ||
      quote.id.toLowerCase().includes(lowerSearch)
    );
  }, [quotes, searchTerm]);

  const recalculateQuoteMutation = useMutation({
    mutationFn: (id: string) => apiClient.recalculateQuote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', selectedOrgId] });
      toast({
        title: "Quote recalculated",
        description: "All totals have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error recalculating quote",
        description: error.message || "Failed to recalculate quote totals.",
        variant: "destructive",
      });
    },
  });

  // Quote item management mutations
  const addQuoteItemMutation = useMutation({
    mutationFn: (data: any) => apiClient.addQuoteItem(quoteId!, data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId, 'items'] });
      // Automatically recalculate totals after adding item
      if (quoteId) {
        try {
          await apiClient.recalculateQuote(quoteId);
          queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
        } catch (error) {
          console.error('Failed to auto-recalculate after adding item:', error);
        }
      }
      toast({
        title: "Item added",
        description: "The item has been added and totals recalculated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding item",
        description: error.message || "Failed to add item to quote.",
        variant: "destructive",
      });
    },
  });

  const updateQuoteItemMutation = useMutation({
    mutationFn: ({ itemId, updates }: { itemId: string; updates: any }) => 
      apiClient.updateQuoteItem(quoteId!, itemId, updates),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId, 'items'] });
      // Automatically recalculate totals after updating item
      if (quoteId) {
        try {
          await apiClient.recalculateQuote(quoteId);
          queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
        } catch (error) {
          console.error('Failed to auto-recalculate after updating item:', error);
        }
      }
      toast({
        title: "Item updated",
        description: "The item has been updated and totals recalculated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating item",
        description: error.message || "Failed to update item.",
        variant: "destructive",
      });
    },
  });

  const deleteQuoteItemMutation = useMutation({
    mutationFn: (itemId: string) => apiClient.removeQuoteItem(quoteId!, itemId),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId, 'items'] });
      // Automatically recalculate totals after removing item
      if (quoteId) {
        try {
          await apiClient.recalculateQuote(quoteId);
          queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
        } catch (error) {
          console.error('Failed to auto-recalculate after removing item:', error);
        }
      }
      toast({
        title: "Item removed",
        description: "The item has been removed and totals recalculated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error removing item",
        description: error.message || "Failed to remove item.",
        variant: "destructive",
      });
    },
  });

  const updateQuoteMutation = useMutation({
    mutationFn: (data: any) => apiClient.updateQuote(quoteId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', selectedOrgId] });
      setIsEditingQuoteName(false);
      toast({
        title: "Quote updated",
        description: "The quote has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating quote",
        description: error.message || "Failed to update quote.",
        variant: "destructive",
      });
    },
  });

  const handleStartEditName = () => {
    if (quote) {
      setQuoteNameValue(quote.name || `Quote #${quote.id.slice(-8).toUpperCase()}`);
      setIsEditingQuoteName(true);
    }
  };

  const handleSaveName = () => {
    if (!quoteNameValue.trim()) {
      toast({
        title: "Invalid name",
        description: "Quote name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    updateQuoteMutation.mutate({ name: quoteNameValue.trim() });
  };

  const handleCancelEditName = () => {
    setIsEditingQuoteName(false);
    setQuoteNameValue('');
  };

  const deleteQuoteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteQuote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', selectedOrgId] });
      setDeleteConfirmQuoteId(null);
      toast({
        title: "Quote deleted",
        description: "The quote has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting quote",
        description: error.message || "Failed to delete quote.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteQuote = (quoteId: string) => {
    setDeleteConfirmQuoteId(quoteId);
  };

  const confirmDeleteQuote = () => {
    if (deleteConfirmQuoteId) {
      deleteQuoteMutation.mutate(deleteConfirmQuoteId);
    }
  };

  const handleDuplicateQuote = async (quote: any) => {
    try {
      // Get the full quote with items
      const fullQuote = await apiClient.getQuote(quote.id);
      if (!fullQuote) {
        toast({
          title: "Error",
          description: "Could not load quote details.",
          variant: "destructive",
        });
        return;
      }

      // Create a new quote with the same job
      const newQuote = await apiClient.createQuote({
        jobId: fullQuote.jobId,
        name: `${fullQuote.name || `Quote #${fullQuote.id.slice(-8).toUpperCase()}`} (Copy)`,
        status: 'draft',
        subtotal: fullQuote.subtotal || '0',
        gst: fullQuote.gst || '0',
        total: fullQuote.total || '0',
        depositPct: fullQuote.depositPct || '0.3',
        validityDays: fullQuote.validityDays || 30,
      });

      // Copy all items
      if (fullQuote.items && fullQuote.items.length > 0) {
        for (const item of fullQuote.items) {
          await apiClient.addQuoteItem(newQuote.id, {
            kind: item.kind,
            description: item.description,
            unit: item.unit,
            qty: item.qty,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            materialId: item.materialId,
            laborRuleId: item.laborRuleId,
            calcMetaJson: item.calcMetaJson,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/quotes', selectedOrgId] });
      toast({
        title: "Quote duplicated",
        description: "The quote has been duplicated successfully.",
      });
      navigate(`/quotes/${newQuote.id}`);
    } catch (error: any) {
      toast({
        title: "Error duplicating quote",
        description: error.message || "Failed to duplicate quote.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPDF = async (quoteId: string) => {
    try {
      // Get quote details for better filename
      const quoteData = quotes.find(q => q.id === quoteId);
      const filename = quoteData 
        ? `quote-${quoteData.clientName?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'quote'}-${quoteId.substring(0, 8)}.pdf`
        : `quote-${quoteId.substring(0, 8)}.pdf`;
      
      // Get PDF blob (preview: false forces download)
      const blob = await apiClient.generateQuotePDF(quoteId, {
        watermark: false,
        terms: true,
        preview: false // Force download
      });
      
      if (!blob || blob.size === 0) {
        throw new Error('Received empty PDF blob');
      }
      
      // Create blob URL for download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      toast({
        title: "PDF Downloaded",
        description: "Quote PDF has been downloaded successfully",
      });
    } catch (error: any) {
      console.error('[Quotes] Error downloading PDF:', error);
      toast({
        title: "Error downloading PDF",
        description: error.message || "Failed to download PDF",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = (quote: any) => {
    if (!quote.publicToken) {
      toast({
        title: "No share link available",
        description: "This quote doesn't have a public share link yet.",
        variant: "destructive",
      });
      return;
    }
    const shareUrl = `${window.location.origin}/share/q/${quote.publicToken}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({
        title: "Link copied",
        description: "The share link has been copied to your clipboard.",
      });
    }).catch(() => {
      prompt("Copy this link:", shareUrl);
    });
  };

  const createQuoteMutation = useMutation({
    mutationFn: async (jobId: string) => {
      // First get the job details
      const job = await apiClient.getJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      // Create quote with job data
      const quoteData = {
        jobId: job.id,
        status: 'draft',
        subtotal: '0',
        gst: '0',
        total: '0',
        depositPct: '0.3',
        validityDays: 30,
      };

      return apiClient.createQuote(quoteData);
    },
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', selectedOrgId] });
      toast({
        title: "Quote created",
        description: "The quote has been created successfully.",
      });
      navigate(`/quotes/${quote.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error creating quote",
        description: error.message || "Failed to create quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleNewQuote = () => {
    if (!selectedOrgId) {
      toast({
        title: "No organization selected",
        description: "Please select an organization first.",
        variant: "destructive",
      });
      return;
    }
    setShowJobSelectionModal(true);
  };

  const handleSelectJob = (jobId: string) => {
    createQuoteMutation.mutate(jobId);
  };

  const sendQuoteMutation = useMutation({
    mutationFn: ({ quoteId, clientEmail }: { quoteId: string; clientEmail?: string }) => 
      apiClient.sendQuote(quoteId, clientEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', selectedOrgId] });
      toast({
        title: "Quote sent",
        description: "The quote has been sent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error sending quote",
        description: error.message || "Failed to send quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendQuote = () => {
    if (!quote) return;
    sendQuoteMutation.mutate({ 
      quoteId: quote.id, 
      clientEmail: quote.clientEmail 
    });
  };

  const handleShareQuote = () => {
    if (!quote?.publicToken) {
      toast({
        title: "No share link available",
        description: "This quote doesn't have a public share link yet.",
        variant: "destructive",
      });
      return;
    }
    const shareUrl = `${window.location.origin}/share/q/${quote.publicToken}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({
        title: "Link copied",
        description: "The share link has been copied to your clipboard.",
      });
    }).catch(() => {
      // Fallback: show the URL in a prompt
      prompt("Copy this link:", shareUrl);
    });
  };

  // Auto-select first org if available
  if (!selectedOrgId && orgs.length > 0) {
    setSelectedOrgId(orgs[0].id);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-primary/10 text-primary';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // If viewing a specific quote
  if (quoteId) {
    if (quoteLoading) {
      return (
        <div className="bg-slate-50">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-slate-200 rounded w-64"></div>
              <div className="h-96 bg-white rounded-2xl border border-slate-200"></div>
            </div>
          </div>
        </div>
      );
    }

    if (!quote) {
      return (
        <div className="bg-slate-50">
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
      <div className="bg-slate-50">        
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/quotes')}
                data-testid="button-back-to-quotes"
                className="h-9 w-9"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  {isEditingQuoteName ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={quoteNameValue}
                        onChange={(e) => setQuoteNameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveName();
                          } else if (e.key === 'Escape') {
                            handleCancelEditName();
                          }
                        }}
                        className="h-8 text-xl font-semibold px-2"
                        autoFocus
                        disabled={updateQuoteMutation.isPending}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSaveName}
                        disabled={updateQuoteMutation.isPending || !quoteNameValue.trim()}
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEditName}
                        disabled={updateQuoteMutation.isPending}
                        className="h-8 w-8 p-0 text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h1 
                        className="text-xl font-semibold text-slate-900 cursor-pointer hover:text-primary transition-colors flex items-center gap-2 group" 
                        data-testid="text-quote-title"
                        onClick={handleStartEditName}
                        title="Click to rename"
                      >
                        {quote.name || `Quote #${quote.id.slice(-8).toUpperCase()}`}
                        <Edit className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                      </h1>
                      <Badge className={`${getStatusColor(quote.status)} text-xs font-medium px-2.5 py-0.5`} data-testid="badge-quote-status">
                        {quote.status}
                      </Badge>
                    </>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  Created {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  data-testid="button-preview-quote"
                  onClick={() => setShowPDFPreview(true)}
                  className="h-9 text-sm"
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  Preview
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  data-testid="button-download-quote"
                  onClick={() => handleDownloadPDF(quote.id)}
                  className="h-9 text-sm"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download
                </Button>
              </div>
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
            onSendQuote={handleSendQuote}
            onPreviewPDF={() => setShowPDFPreview(true)}
            onItemAdd={(item) => addQuoteItemMutation.mutate(item)}
            onItemUpdate={(itemId, updates) => updateQuoteItemMutation.mutate({ itemId, updates })}
            onItemRemove={(itemId) => deleteQuoteItemMutation.mutate(itemId)}
            isRecalculating={recalculateQuoteMutation.isPending}
          />
        </div>

        {/* PDF Preview Modal */}
        {quote && (
          <PDFPreview
            quoteId={quote.id}
            isOpen={showPDFPreview}
            onClose={() => setShowPDFPreview(false)}
          />
        )}
      </div>
    );
  }

  // Quotes list view
  return (
    <div className="bg-slate-50 pb-20 md:pb-0">      
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-8">
        {/* Mobile Header */}
        <div className="md:hidden safe-top bg-white border-b border-gray-200 px-4 py-3 -mx-4 md:mx-0 mb-4">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold mobile-text-lg" data-testid="text-page-title">
              Quotes
            </h1>
            <Button 
              data-testid="button-new-quote"
              onClick={handleNewQuote}
              disabled={createQuoteMutation.isPending}
              size="sm"
              className="tap-target"
            >
              <Plus className="w-4 h-4 mr-2" />
              New
            </Button>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900" data-testid="text-page-title-desktop">
              Quotes
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage, send, and track your project quotes
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              data-testid="button-filters"
              onClick={() => {
                toast({
                  title: "Filters",
                  description: "Filter functionality coming soon.",
                });
              }}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            
            <Button 
              data-testid="button-new-quote-desktop"
              onClick={handleNewQuote}
              disabled={createQuoteMutation.isPending}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Quote
            </Button>
          </div>
        </div>

        {/* Search + Project Selector Bar */}
        <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:flex-wrap items-stretch md:items-center gap-3 rounded-2xl bg-white border border-slate-200 px-3 md:px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search quotes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 md:h-auto"
              data-testid="input-search-quotes"
            />
          </div>
          
          {orgs.length > 1 && (
            <select
              value={selectedOrgId || ''}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="w-full md:w-auto px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm h-11 md:h-auto"
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

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total</p>
              <p className="text-xl font-semibold text-slate-900 mt-1" data-testid="stat-total-quotes">
                {quotes.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">All quotes created</p>
            </div>
            <div className="h-9 w-9 rounded-full flex items-center justify-center bg-slate-50 text-slate-500">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Draft</p>
              <p className="text-xl font-semibold text-slate-900 mt-1" data-testid="stat-draft-quotes">
                {quotes.filter(q => q.status === 'draft').length}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Not yet sent</p>
            </div>
            <div className="h-9 w-9 rounded-full flex items-center justify-center bg-slate-50 text-slate-500">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sent</p>
              <p className="text-xl font-semibold text-slate-900 mt-1" data-testid="stat-sent-quotes">
                {quotes.filter(q => q.status === 'sent').length}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Waiting on client</p>
            </div>
            <div className="h-9 w-9 rounded-full flex items-center justify-center bg-slate-50 text-slate-500">
              <Send className="w-4 h-4" />
            </div>
          </div>
          
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Accepted</p>
              <p className="text-xl font-semibold text-slate-900 mt-1" data-testid="stat-accepted-quotes">
                {quotes.filter(q => q.status === 'accepted').length}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Approved by client</p>
            </div>
            <div className="h-9 w-9 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Recent Quotes Section */}
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-sm font-semibold text-slate-900">Recent Quotes</h2>
            <p className="text-xs text-slate-500">Your most recent activity</p>
          </div>
          
          {quotesLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-500">Loading quotes...</p>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="min-h-[220px] flex flex-col items-center justify-center px-6 py-10 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No quotes yet</h3>
              <p className="text-slate-500 mb-4" data-testid="text-no-quotes">
                {searchTerm ? 'No quotes match your search criteria.' : 'Create your first quote to send a polished proposal in minutes.'}
              </p>
              {!searchTerm && (
                <Button 
                  data-testid="button-create-first-quote"
                  onClick={handleNewQuote}
                  disabled={createQuoteMutation.isPending}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Quote
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {filteredQuotes.map((quote) => {
                  const getStatusPillColor = (status: string) => {
                    switch (status) {
                      case 'draft': return 'bg-slate-100 text-slate-600';
                      case 'sent': return 'bg-primary/10 text-primary';
                      case 'accepted': return 'bg-emerald-100 text-emerald-700';
                      case 'declined': return 'bg-red-100 text-red-700';
                      default: return 'bg-slate-100 text-slate-600';
                    }
                  };
                  
                  return (
                    <div 
                      key={quote.id}
                      className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer tap-target"
                      onClick={() => navigate(`/quotes/${quote.id}`)}
                      data-testid={`quote-item-${quote.id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-slate-900 truncate" data-testid={`text-quote-id-${quote.id}`}>
                              {quote.name || `Quote #${quote.id.slice(-8).toUpperCase()}`}
                            </p>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${getStatusPillColor(quote.status)}`} data-testid={`badge-quote-status-${quote.id}`}>
                              {quote.status}
                            </span>
                          </div>
                          {quote.clientName && (
                            <p className="text-xs text-slate-500 mb-1">{quote.clientName}</p>
                          )}
                          <p className="text-xs text-slate-400">
                            Updated {formatDistanceToNow(new Date(quote.updatedAt || quote.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          <div className="text-base font-bold text-slate-900" data-testid={`text-quote-total-${quote.id}`}>
                            {formatCurrency(parseFloat(quote.total || '0'))}
                          </div>
                          <div className="text-xs text-slate-500">
                            {quote.items?.length || 0} items
                          </div>
                        </div>
                      </div>
                      {quote.jobId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/jobs/${quote.jobId}`);
                          }}
                          className="flex items-center gap-1 text-xs text-primary hover:underline mt-2 tap-target"
                        >
                          <LinkIcon className="w-3 h-3" />
                          View Job
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop List View */}
              <div className="hidden md:block">
                {filteredQuotes.map((quote, index) => {
                  const getStatusPillColor = (status: string) => {
                    switch (status) {
                      case 'draft': return 'bg-slate-100 text-slate-600';
                      case 'sent': return 'bg-primary/10 text-primary';
                      case 'accepted': return 'bg-emerald-100 text-emerald-700';
                      case 'declined': return 'bg-red-100 text-red-700';
                      default: return 'bg-slate-100 text-slate-600';
                    }
                  };
                  
                  const getTimelineDotColor = (status: string) => {
                    switch (status) {
                      case 'accepted': return 'bg-emerald-500';
                      case 'sent': return 'bg-primary';
                      default: return 'bg-slate-400';
                    }
                  };
                  
                  return (
                    <div 
                      key={quote.id}
                      className="group flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 first:border-t-0 hover:bg-slate-50/60 transition-colors cursor-pointer"
                      onClick={() => navigate(`/quotes/${quote.id}`)}
                      data-testid={`quote-item-desktop-${quote.id}`}
                    >
                      {/* Left Side */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className={`h-2.5 w-2.5 rounded-full ${getTimelineDotColor(quote.status)} mt-1 flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-slate-900 truncate" data-testid={`text-quote-id-desktop-${quote.id}`}>
                              {quote.name || `Quote #${quote.id.slice(-8).toUpperCase()}`}
                            </p>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${getStatusPillColor(quote.status)}`} data-testid={`badge-quote-status-desktop-${quote.id}`}>
                              {quote.status}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Updated {formatDistanceToNow(new Date(quote.updatedAt || quote.createdAt), { addSuffix: true })}
                            {quote.clientName && ` · ${quote.clientName}`}
                            {quote.jobId && (
                              <span className="inline-flex items-center gap-1 ml-2">
                                <LinkIcon className="w-3 h-3" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/jobs/${quote.jobId}`);
                                  }}
                                  className="hover:underline"
                                >
                                  View Job
                                </button>
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      {/* Right Side */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-900" data-testid={`text-quote-total-desktop-${quote.id}`}>
                            {formatCurrency(parseFloat(quote.total || '0'))}
                          </div>
                          <div className="text-xs text-slate-500">
                            {quote.items?.length || 0} items
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/quotes/${quote.id}`);
                          }}
                          className="rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-colors"
                        data-testid={`button-view-quote-${quote.id}`}
                      >
                        View
                      </button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-400 hover:text-slate-700 transition-colors rounded-full p-1.5 hover:bg-slate-100"
                            data-testid={`button-quote-menu-${quote.id}`}
                            aria-label="Quote options"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateQuote(quote);
                            }}
                            className="cursor-pointer"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPDF(quote.id);
                            }}
                            className="cursor-pointer"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download PDF
                          </DropdownMenuItem>
                          {quote.publicToken && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyLink(quote);
                              }}
                              className="cursor-pointer"
                            >
                              <LinkIcon className="w-4 h-4 mr-2" />
                              Copy Share Link
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuote(quote.id);
                            }}
                            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Job Selection Modal */}
      <JobSelectionModal
        open={showJobSelectionModal}
        onOpenChange={setShowJobSelectionModal}
        onSelectJob={handleSelectJob}
        selectedOrgId={selectedOrgId}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirmQuoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirmQuoteId(null)} />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Delete Quote
            </h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete this quote? This action cannot be undone and will also delete all associated items.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmQuoteId(null)}
                disabled={deleteQuoteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteQuote}
                disabled={deleteQuoteMutation.isPending}
              >
                {deleteQuoteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
