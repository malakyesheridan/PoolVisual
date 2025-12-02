import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  
  // NEW: Local state to manage opportunities - single source of truth
  const [localOpportunities, setLocalOpportunities] = useState<Opportunity[]>([]);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(true);
  const hasLoadedOnce = useRef(false);
  const isRefetchingRef = useRef(false);
  // Track recently created opportunities by timestamp to prevent them from being wiped during race conditions
  // This persists across page refreshes by checking createdAt timestamps
  const recentlyCreatedTimestamps = useRef<Map<string, number>>(new Map());

  // Redirect trades users to quotes page
  if (!isRealEstate) {
    return <Redirect to="/quotes" />;
  }

  // Fetch default pipeline
  const { data: pipelines = [] } = useQuery({
    queryKey: ['/api/pipelines'],
    queryFn: () => apiClient.getPipelines(),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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

  // NEW: Manual data fetching - load once, then manage locally
  // Use useCallback to memoize and prevent stale closures
  const loadOpportunities = useCallback(async (force = false) => {
    // Prevent multiple simultaneous loads
    if (isRefetchingRef.current && !force) return;
    
    isRefetchingRef.current = true;
    setIsLoadingOpportunities(true);
    
    try {
      const data = await apiClient.getOpportunities(statusFilter ? { status: statusFilter } : undefined);
      const opportunities = Array.isArray(data) ? data : [];
      
      console.log('[Opportunities] Loaded from server:', opportunities.length, 'opportunities');
      console.log('[Opportunities] Server opportunity IDs:', opportunities.map(o => o.id));
      
      // Update local state - merge with recently created opportunities that might not be in server response yet
      setLocalOpportunities(prev => {
        console.log('[Opportunities] Previous local state:', prev.length, 'opportunities');
        console.log('[Opportunities] Previous local IDs:', prev.map(o => o.id));
        
        // Create a map of server opportunities by ID
        const serverMap = new Map(opportunities.map(opp => [opp.id, opp]));
        const serverIds = new Set(opportunities.map(o => o.id));
        
        const now = Date.now();
        const RECENT_THRESHOLD = 60000; // 60 seconds
        
        // Keep recently created opportunities that aren't in server response yet
        // Check both: 1) if they're in our timestamp map, and 2) if they have a recent createdAt timestamp
        const recentlyCreated = prev.filter(opp => {
          // If it's in server response, use server version
          if (serverMap.has(opp.id)) {
            // Clean up from timestamp map since it's now in server
            recentlyCreatedTimestamps.current.delete(opp.id);
            return false; // Will be included from opportunities array
          }
          
          // Check if it was marked as recently created
          const createdTimestamp = recentlyCreatedTimestamps.current.get(opp.id);
          if (createdTimestamp && (now - createdTimestamp) < RECENT_THRESHOLD) {
            console.log('[Opportunities] Keeping recently created opportunity:', opp.id, 'created', Math.round((now - createdTimestamp) / 1000), 'seconds ago');
            return true;
          }
          
          // Also check createdAt timestamp if available (for opportunities created in this session)
          if (opp.createdAt) {
            const createdAt = new Date(opp.createdAt).getTime();
            if (!isNaN(createdAt) && (now - createdAt) < RECENT_THRESHOLD) {
              console.log('[Opportunities] Keeping opportunity with recent createdAt:', opp.id);
              // Add to timestamp map for future reference
              recentlyCreatedTimestamps.current.set(opp.id, createdAt);
              return true;
            }
          }
          
          return false;
        });
        
        // Combine: server data (most up-to-date) + recently created not in server
        const merged = [
          ...opportunities,
          ...recentlyCreated.filter(opp => !serverIds.has(opp.id))
        ];
        
        // Clean up old timestamps (older than threshold)
        recentlyCreatedTimestamps.current.forEach((timestamp, id) => {
          if ((now - timestamp) >= RECENT_THRESHOLD) {
            recentlyCreatedTimestamps.current.delete(id);
          }
        });
        
        console.log('[Opportunities] Merged result:', merged.length, 'opportunities');
        console.log('[Opportunities] Merged IDs:', merged.map(o => o.id));
        
        return merged;
      });
      
      hasLoadedOnce.current = true;
    } catch (error) {
      console.error('Failed to load opportunities:', error);
      toast({
        title: 'Error',
        description: 'Failed to load opportunities',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingOpportunities(false);
      isRefetchingRef.current = false;
    }
  }, [statusFilter, toast]);

  // Load opportunities on mount
  useEffect(() => {
    if (!hasLoadedOnce.current) {
      loadOpportunities(true);
    }
  }, [loadOpportunities]);

  // Load opportunities when statusFilter changes (after initial load)
  useEffect(() => {
    if (hasLoadedOnce.current) {
      loadOpportunities(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Fetch tasks for each opportunity to get task counts
  const { data: allTasks = {} } = useQuery({
    queryKey: ['/api/opportunities/tasks', localOpportunities.map(o => o.id).join(',')],
    queryFn: async () => {
      const tasksByOpportunity: Record<string, any[]> = {};
      for (const opp of localOpportunities) {
        try {
          const tasks = await apiClient.getOpportunityTasks(opp.id);
          tasksByOpportunity[opp.id] = tasks || [];
        } catch (error) {
          tasksByOpportunity[opp.id] = [];
        }
      }
      return tasksByOpportunity;
    },
    enabled: localOpportunities.length > 0,
    staleTime: 30 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Enrich opportunities with task counts and contact info
  const enrichedOpportunities = useMemo(() => {
    return localOpportunities.map((opp: any) => {
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
        // Preserve stageId - keep original stageId, don't override with pipelineStage
        // pipelineStage is a legacy string field, stageId is the UUID reference
        stageId: opp.stageId,
        stageName: stages.find((s: Stage) => s.id === opp.stageId)?.name || opp.pipelineStage,
      };
    });
  }, [localOpportunities, allTasks, stages]);

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

  // NEW: Manual mutation - update local state immediately, then sync with backend
  const moveOpportunityMutation = useMutation({
    mutationFn: ({ opportunityId, newStageId }: { opportunityId: string; newStageId: string }) => {
      return apiClient.updateOpportunity(opportunityId, { stageId: newStageId });
    },
    onSuccess: async () => {
      // Reload from backend to get fresh data
      await loadOpportunities(true);
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

  // NEW: Manual update handler - reload from backend
  const handleOpportunityUpdated = async () => {
    await loadOpportunities(true);
  };

  // NEW: After creation, add to local state immediately, then verify with backend
  const handleOpportunityCreated = async (createdOpportunity: Opportunity) => {
    if (!createdOpportunity?.id) {
      toast({
        title: 'Error',
        description: 'Failed to create opportunity - no ID returned',
        variant: 'destructive',
      });
      return;
    }

    // Wait for DB commit
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Verify it exists by fetching it back
    try {
      const verified = await apiClient.getOpportunity(createdOpportunity.id);
      if (verified) {
        // Mark as recently created with timestamp to prevent it from being wiped during race conditions
        const now = Date.now();
        recentlyCreatedTimestamps.current.set(verified.id, now);
        console.log('[Opportunities] Marked opportunity as recently created:', verified.id, 'at', new Date(now).toISOString());
        
        // Add to local state immediately
        setLocalOpportunities(prev => {
          // Check if already exists
          if (prev.some(o => o.id === verified.id)) {
            return prev.map(o => o.id === verified.id ? verified : o);
          }
          // Add to beginning
          return [verified, ...prev];
        });
        
        // Clean up the timestamp after 60 seconds
        setTimeout(() => {
          recentlyCreatedTimestamps.current.delete(verified.id);
        }, 60000);
        
        // Update selected opportunity
        setSelectedOpportunity({
          ...verified,
          title: verified.title || 'Untitled Opportunity',
          status: verified.status || 'open',
          tags: verified.tags || [],
        } as Opportunity);
        setIsDrawerOpen(true);
      } else {
        // If not found, reload all
        await loadOpportunities(true);
        setSelectedOpportunity({
          ...createdOpportunity,
          title: createdOpportunity.title || 'Untitled Opportunity',
          status: createdOpportunity.status || 'open',
          tags: createdOpportunity.tags || [],
        } as Opportunity);
        setIsDrawerOpen(true);
      }
    } catch (error) {
      // If verification fails, still add to local state and reload
      // Mark as recently created with timestamp to prevent it from being wiped
      const now = Date.now();
      recentlyCreatedTimestamps.current.set(createdOpportunity.id, now);
      console.log('[Opportunities] Marked opportunity as recently created (error case):', createdOpportunity.id);
      
      setLocalOpportunities(prev => {
        if (prev.some(o => o.id === createdOpportunity.id)) {
          return prev;
        }
        return [createdOpportunity, ...prev];
      });
      
      // Clean up the timestamp after 60 seconds
      setTimeout(() => {
        recentlyCreatedTimestamps.current.delete(createdOpportunity.id);
      }, 60000);
      await loadOpportunities(true);
      setSelectedOpportunity({
        ...createdOpportunity,
        title: createdOpportunity.title || 'Untitled Opportunity',
        status: createdOpportunity.status || 'open',
        tags: createdOpportunity.tags || [],
      } as Opportunity);
      setIsDrawerOpen(true);
    }
  };

  const isLoading = isLoadingOpportunities || stagesLoading;

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
