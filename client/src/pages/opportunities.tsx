import { useState, useMemo, useEffect } from 'react';
import { useLocation, Redirect } from 'wouter';
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { useIsRealEstate } from "@/hooks/useIsRealEstate";
import { 
  ArrowLeft, 
  Search, 
  Plus, 
  Filter,
  CheckCircle,
} from "lucide-react";
import { KanbanBoard } from "@/components/opportunities/KanbanBoard";
import { OpportunityDetailDrawer } from "@/components/opportunities/OpportunityDetailDrawer";
import { EmptyState } from "@/components/common/EmptyState";
import { FileText } from "lucide-react";

interface Opportunity {
  id: string;
  title: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  value?: number | string;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  stageId?: string;
  stageName?: string;
  tags?: string[];
  taskCount?: number;
  completedTaskCount?: number;
  ownerId?: string;
  ownerName?: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
  order: number;
}

export default function Opportunities() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuthStore();
  const isRealEstate = useIsRealEstate();
  const queryClient = useQueryClient();

  // Redirect trades users to quotes page
  if (!isRealEstate) {
    return <Redirect to="/quotes" />;
  }

  // Fetch default pipeline
  const { data: pipelines = [] } = useQuery({
    queryKey: ['/api/pipelines'],
    queryFn: () => apiClient.getPipelines(),
    staleTime: 5 * 60 * 1000,
  });

  const defaultPipeline = useMemo(() => {
    return pipelines.find((p: any) => p.isDefault) || pipelines[0];
  }, [pipelines]);

  // Fetch stages for the default pipeline
  const { data: stages = [], isLoading: stagesLoading } = useQuery({
    queryKey: ['/api/pipelines', defaultPipeline?.id, 'stages'],
    queryFn: () => apiClient.getPipelineStages(defaultPipeline?.id),
    enabled: !!defaultPipeline?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Create default pipeline and stages if they don't exist
  const createDefaultPipelineMutation = useMutation({
    mutationFn: async () => {
      const pipeline = await apiClient.createPipeline({
        name: 'Sales Pipeline',
        isDefault: true,
      });

      const defaultStages = [
        { name: 'New', color: '#3B82F6', order: 0 },
        { name: 'Contacted', color: '#8B5CF6', order: 1 },
        { name: 'Qualified', color: '#10B981', order: 2 },
        { name: 'Viewing', color: '#F59E0B', order: 3 },
        { name: 'Offer', color: '#EF4444', order: 4 },
        { name: 'Closed', color: '#6B7280', order: 5 },
      ];

      for (const stage of defaultStages) {
        await apiClient.createPipelineStage(pipeline.id, stage);
      }

      return pipeline;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
      toast({
        title: 'Default pipeline created',
        description: 'A default sales pipeline has been set up for you.',
      });
    },
  });

  useEffect(() => {
    if (pipelines.length === 0 && !createDefaultPipelineMutation.isPending && !createDefaultPipelineMutation.isError) {
      createDefaultPipelineMutation.mutate();
    }
  }, [pipelines.length, createDefaultPipelineMutation.isPending, createDefaultPipelineMutation.isError]);

  // REBUILT: Simple, robust data fetching - fetch from backend, no complex cache logic
  const { data: opportunities = [], isLoading: opportunitiesLoading, refetch: refetchOpportunities } = useQuery({
    queryKey: ['/api/opportunities', statusFilter],
    queryFn: async () => {
      const data = await apiClient.getOpportunities(statusFilter ? { status: statusFilter } : undefined);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30 * 1000, // 30 seconds - short stale time for fresh data
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Fetch tasks for each opportunity to get task counts
  const { data: allTasks = {} } = useQuery({
    queryKey: ['/api/opportunities/tasks', opportunities.map(o => o.id).join(',')],
    queryFn: async () => {
      const tasksByOpportunity: Record<string, any[]> = {};
      for (const opp of opportunities) {
        try {
          const tasks = await apiClient.getOpportunityTasks(opp.id);
          tasksByOpportunity[opp.id] = tasks || [];
        } catch (error) {
          tasksByOpportunity[opp.id] = [];
        }
      }
      return tasksByOpportunity;
    },
    enabled: opportunities.length > 0,
    staleTime: 30 * 1000,
  });

  // Enrich opportunities with task counts and contact info
  const enrichedOpportunities = useMemo(() => {
    return opportunities.map((opp: any) => {
      const tasks = allTasks[opp.id] || [];
      const pendingTasks = tasks.filter((t: any) => t.status === 'pending');
      const completedTasks = tasks.filter((t: any) => t.status === 'completed');

      return {
        ...opp,
        title: opp.title || opp.clientName || 'Untitled Opportunity',
        contactName: opp.contactName || opp.clientName,
        contactPhone: opp.contactPhone || opp.clientPhone,
        contactEmail: opp.contactEmail || opp.clientEmail,
        value: opp.value || opp.estimatedValue,
        status: opp.status || 'open',
        taskCount: tasks.length,
        completedTaskCount: completedTasks.length,
        stageId: opp.stageId || opp.pipelineStage,
        stageName: stages.find((s: Stage) => s.id === opp.stageId)?.name || opp.pipelineStage,
      };
    });
  }, [opportunities, allTasks, stages]);

  // Filter opportunities
  const filteredOpportunities = useMemo(() => {
    let filtered = enrichedOpportunities;

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter((opp: Opportunity) =>
        opp.title?.toLowerCase().includes(lowerSearch) ||
        opp.contactName?.toLowerCase().includes(lowerSearch) ||
        opp.contactPhone?.toLowerCase().includes(lowerSearch) ||
        opp.contactEmail?.toLowerCase().includes(lowerSearch)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((opp: Opportunity) => opp.status === statusFilter);
    }

    return filtered;
  }, [enrichedOpportunities, searchTerm, statusFilter]);

  // REBUILT: Simple mutation - save to backend, then refetch
  const moveOpportunityMutation = useMutation({
    mutationFn: ({ opportunityId, newStageId }: { opportunityId: string; newStageId: string }) => {
      return apiClient.updateOpportunity(opportunityId, { stageId: newStageId });
    },
    onSuccess: async () => {
      // Refetch opportunities from backend - single source of truth
      await refetchOpportunities();
      toast({
        title: 'Opportunity moved',
        description: 'The opportunity has been moved to a new stage.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to move opportunity',
        variant: 'destructive',
      });
    },
  });

  const handleOpportunityClick = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setIsDrawerOpen(true);
  };

  const handleOpportunityMove = (opportunityId: string, newStageId: string) => {
    moveOpportunityMutation.mutate({ opportunityId, newStageId });
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedOpportunity(null);
  };

  // REBUILT: Simple handler - just refetch from backend
  const handleOpportunityUpdated = async () => {
    await refetchOpportunities();
  };

  // REBUILT: After creation, refetch from backend and update selected opportunity
  const handleOpportunityCreated = async (createdOpportunity: Opportunity) => {
    // Refetch from backend to get the real saved opportunity
    await refetchOpportunities();
    
    // Find the newly created opportunity in the refetched data
    const refreshedOpportunities = await queryClient.fetchQuery({
      queryKey: ['/api/opportunities', statusFilter],
      queryFn: async () => {
        const data = await apiClient.getOpportunities(statusFilter ? { status: statusFilter } : undefined);
        return Array.isArray(data) ? data : [];
      },
    });
    
    const newOpp = refreshedOpportunities.find((o: any) => o.id === createdOpportunity.id);
    if (newOpp) {
      setSelectedOpportunity({
        ...newOpp,
        title: newOpp.title || 'Untitled Opportunity',
        status: newOpp.status || 'open',
        tags: newOpp.tags || [],
      } as Opportunity);
      setIsDrawerOpen(true);
    }
  };

  const isLoading = opportunitiesLoading || stagesLoading;

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
            <p className="text-sm text-slate-500">Manage your real estate pipeline with Kanban board</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => {
            setSelectedOpportunity({
              id: '',
              title: '',
              status: 'open',
              tags: [],
            } as Opportunity);
            setIsDrawerOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            New Opportunity
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search opportunities by title, contact, or property..."
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
            <DropdownMenuItem onClick={() => setStatusFilter('open')}>Open</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('won')}>Won</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('lost')}>Lost</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('abandoned')}>Abandoned</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="text-center p-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-500">Loading opportunities...</p>
        </div>
      ) : stages.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No pipeline stages"
          description="Setting up your default pipeline..."
          primaryAction={{
            label: "Refresh",
            onClick: () => queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] }),
            icon: CheckCircle
          }}
        />
      ) : filteredOpportunities.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No opportunities found"
          description={searchTerm || statusFilter 
            ? "Try adjusting your search or filters"
            : "Get started by creating your first opportunity"}
          primaryAction={{
            label: "New Opportunity",
            onClick: () => {
              setSelectedOpportunity({
                id: '',
                title: '',
                status: 'open',
                tags: [],
              } as Opportunity);
              setIsDrawerOpen(true);
            },
            icon: Plus
          }}
        />
      ) : (
        <KanbanBoard
          opportunities={filteredOpportunities}
          stages={stages}
          onOpportunityClick={handleOpportunityClick}
          onOpportunityMove={handleOpportunityMove}
          isLoading={isLoading}
        />
      )}

      {/* Drawer */}
      <OpportunityDetailDrawer
        opportunity={selectedOpportunity}
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        stages={stages}
        onOpportunityUpdated={handleOpportunityUpdated}
        onOpportunityCreated={handleOpportunityCreated}
      />
    </div>
  );
}

