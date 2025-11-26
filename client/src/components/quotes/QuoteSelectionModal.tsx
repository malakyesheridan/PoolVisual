import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, FileText, Calendar, Plus, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { formatCurrency } from '@/lib/measurement-utils';
import { useLocation } from 'wouter';

interface QuoteSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectQuote: (quoteId: string) => void;
  jobId: string;
  jobOrgId: string;
  allowCreateNew?: boolean;
}

export function QuoteSelectionModal({
  open,
  onOpenChange,
  onSelectQuote,
  jobId,
  jobOrgId,
  allowCreateNew = true,
}: QuoteSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [, navigate] = useLocation();

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['/api/quotes', jobOrgId, jobId],
    queryFn: () => apiClient.getQuotes(jobOrgId, { jobId }),
    enabled: !!jobOrgId && !!jobId && open,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-50 text-gray-700 border border-gray-200';
      case 'sent': return 'bg-primary/5 text-primary border border-primary/20';
      case 'accepted': return 'bg-green-50 text-green-700 border border-green-200';
      case 'declined': return 'bg-red-50 text-red-700 border border-red-200';
      default: return 'bg-gray-50 text-gray-700 border border-gray-200';
    }
  };

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = 
      quote.id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleSelectQuote = (quoteId: string) => {
    onSelectQuote(quoteId);
    onOpenChange(false);
    setSearchTerm('');
    setStatusFilter('all');
  };

  const handleCreateNew = () => {
    // Navigate to quotes page to create a new quote for this job
    navigate(`/quotes?jobId=${jobId}`);
    onOpenChange(false);
  };

  const handleViewQuote = (quoteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/quotes/${quoteId}`);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Select a Quote"
      description="Choose a quote to add measurements to, or create a new one"
      size="lg"
      variant="default"
    >
      <div className="space-y-4">
        {/* Search and Filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search quotes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-600">Filter by status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-sm"
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>

        {/* Create New Quote Button */}
        {allowCreateNew && (
          <Button
            onClick={handleCreateNew}
            className="w-full bg-primary hover:bg-primary/90 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Quote
          </Button>
        )}

        {/* Quotes List */}
        <div className="border border-slate-200 rounded-lg max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-500">Loading quotes...</p>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No quotes found</h3>
              <p className="text-slate-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filters.' 
                  : 'Create a quote first to add measurements.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredQuotes.map((quote, index) => (
                <button
                  key={quote.id}
                  onClick={() => handleSelectQuote(quote.id)}
                  className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Quote #{index + 1}
                        </h3>
                        <Badge className={getStatusColor(quote.status)}>
                          {quote.status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span>Created {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}</span>
                        </div>
                        {quote.total && (
                          <div className="text-sm font-medium text-slate-900 mt-1">
                            Total: {formatCurrency(parseFloat(quote.total || '0'))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleViewQuote(quote.id, e)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                        <FileText className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

