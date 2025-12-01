import { useState, useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useAuthStore } from "@/stores/auth-store";
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
  Edit,
  Trash2,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  Clock,
  XCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency } from "@/lib/measurement-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";

export default function Opportunities() {
  const [, params] = useRoute('/opportunities/:id');
  const [, navigate] = useLocation();
  const opportunityId = params?.id;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuthStore();

  // Fetch opportunities
  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['/api/opportunities', statusFilter],
    queryFn: () => apiClient.getOpportunities(statusFilter ? { status: statusFilter } : undefined),
    staleTime: 1 * 60 * 1000,
  });

  const deleteOpportunityMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteOpportunity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
      toast({
        title: "Opportunity deleted",
        description: "The opportunity has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting opportunity",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter opportunities
  const filteredOpportunities = useMemo(() => {
    if (!searchTerm) return opportunities;
    const lowerSearch = searchTerm.toLowerCase();
    return opportunities.filter((opp: any) =>
      opp.clientName?.toLowerCase().includes(lowerSearch) ||
      opp.propertyAddress?.toLowerCase().includes(lowerSearch) ||
      opp.clientEmail?.toLowerCase().includes(lowerSearch) ||
      opp.clientPhone?.toLowerCase().includes(lowerSearch)
    );
  }, [opportunities, searchTerm]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-700',
      contacted: 'bg-yellow-100 text-yellow-700',
      qualified: 'bg-purple-100 text-purple-700',
      viewing: 'bg-orange-100 text-orange-700',
      offer: 'bg-indigo-100 text-indigo-700',
      closed_won: 'bg-green-100 text-green-700',
      closed_lost: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'closed_won') return CheckCircle;
    if (status === 'closed_lost') return XCircle;
    return Clock;
  };

  if (opportunityId) {
    // TODO: Implement opportunity detail view
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Button variant="ghost" onClick={() => navigate('/opportunities')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Opportunities
        </Button>
        <div className="mt-4">
          <p>Opportunity detail view coming soon...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 md:px-8 py-4 md:py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Opportunities</h1>
            <p className="text-sm text-slate-500">Manage your real estate opportunities and client pipeline</p>
          </div>
        </div>
        <Button onClick={() => navigate('/opportunities/new')}>
          <Plus className="w-4 h-4 mr-2" />
          New Opportunity
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search opportunities by client, property, or contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              {statusFilter || 'All Statuses'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter(null)}>
              All Statuses
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setStatusFilter('new')}>New</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('contacted')}>Contacted</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('qualified')}>Qualified</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('viewing')}>Viewing</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('offer')}>Offer</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('closed_won')}>Closed Won</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('closed_lost')}>Closed Lost</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Opportunities List */}
      {isLoading ? (
        <div className="text-center p-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-500">Loading opportunities...</p>
        </div>
      ) : filteredOpportunities.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No opportunities found"
          description={searchTerm || statusFilter 
            ? "Try adjusting your search or filters"
            : "Get started by creating your first opportunity"}
          primaryAction={{
            label: "New Opportunity",
            onClick: () => navigate('/opportunities/new'),
            icon: Plus
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOpportunities.map((opp: any) => {
            const StatusIcon = getStatusIcon(opp.status);
            return (
              <Card 
                key={opp.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/opportunities/${opp.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{opp.clientName}</CardTitle>
                      {opp.propertyAddress && (
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {opp.propertyAddress}
                        </p>
                      )}
                    </div>
                    <Badge className={getStatusColor(opp.status)}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {opp.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {opp.clientPhone && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="w-4 h-4" />
                        {opp.clientPhone}
                      </div>
                    )}
                    {opp.clientEmail && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail className="w-4 h-4" />
                        {opp.clientEmail}
                      </div>
                    )}
                    {opp.estimatedValue && (
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        <DollarSign className="w-4 h-4" />
                        {formatCurrency(parseFloat(opp.estimatedValue.toString()))}
                      </div>
                    )}
                    {opp.expectedCloseDate && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar className="w-4 h-4" />
                        Expected: {new Date(opp.expectedCloseDate).toLocaleDateString()}
                      </div>
                    )}
                    <div className="text-xs text-slate-400 pt-2 border-t">
                      Created {formatDistanceToNow(new Date(opp.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/opportunities/${opp.id}`);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => navigate(`/opportunities/${opp.id}`)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this opportunity?')) {
                              deleteOpportunityMutation.mutate(opp.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

