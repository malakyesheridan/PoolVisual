import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, Calendar, Filter, Home, User, ClipboardList, X } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface Action {
  id: string;
  actionType: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high';
  contactId: string | null;
  opportunityId: string | null;
  propertyId: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface GroupedActions {
  property: Array<{ entityId: string; entityName: string; actions: Action[] }>;
  opportunity: Array<{ entityId: string; entityName: string; actions: Action[] }>;
  contact: Array<{ entityId: string; entityName: string; actions: Action[] }>;
}

export default function Actions() {
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<{ type: 'property' | 'opportunity' | 'contact'; id: string; name: string } | null>(null);
  const [entityActions, setEntityActions] = useState<Action[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filters: { priority?: string; type?: string; grouped?: boolean } = { grouped: true };
  if (priorityFilter !== 'all') filters.priority = priorityFilter;
  if (typeFilter !== 'all') filters.type = typeFilter;

  const { data: groupedActions = { property: [], opportunity: [], contact: [] }, isLoading } = useQuery<GroupedActions>({
    queryKey: ['/api/actions', filters],
    queryFn: () => apiClient.getActions(filters),
  });

  const completeMutation = useMutation({
    mutationFn: (actionId: string) => apiClient.completeAction(actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      if (selectedEntity) {
        // Refresh entity actions
        apiClient.getActionsForEntity(selectedEntity.id).then(setEntityActions);
      }
      toast({
        title: 'Action completed',
        description: 'The action has been marked as completed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEntityIcon = (type: 'property' | 'opportunity' | 'contact') => {
    switch (type) {
      case 'property':
        return Home;
      case 'opportunity':
        return ClipboardList;
      case 'contact':
        return User;
    }
  };

  const handleViewAllActions = async (type: 'property' | 'opportunity' | 'contact', entityId: string, entityName: string) => {
    setSelectedEntity({ type, id: entityId, name: entityName });
    const actions = await apiClient.getActionsForEntity(entityId);
    setEntityActions(actions);
  };

  const handleComplete = (actionId: string) => {
    completeMutation.mutate(actionId);
  };

  const renderEntityCard = (
    type: 'property' | 'opportunity' | 'contact',
    entity: { entityId: string; entityName: string; actions: Action[] }
  ) => {
    const Icon = getEntityIcon(type);
    const firstAction = entity.actions[0];
    
    return (
      <Card key={`${type}-${entity.entityId}`} className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-gray-600" />
              <CardTitle className="text-base font-semibold">{entity.entityName}</CardTitle>
            </div>
            {firstAction && (
              <Badge className={getPriorityColor(firstAction.priority)}>
                {firstAction.priority}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {firstAction ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">{firstAction.description || firstAction.actionType.replace(/_/g, ' ')}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                {formatDistanceToNow(new Date(firstAction.createdAt), { addSuffix: true })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No pending actions</p>
          )}
        </CardContent>
        <CardFooter className="pt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => handleViewAllActions(type, entity.entityId, entity.entityName)}
          >
            View all actions ({entity.actions.length})
          </Button>
        </CardFooter>
      </Card>
    );
  };

  const allEntities = [
    ...groupedActions.property.map(e => ({ ...e, type: 'property' as const })),
    ...groupedActions.opportunity.map(e => ({ ...e, type: 'opportunity' as const })),
    ...groupedActions.contact.map(e => ({ ...e, type: 'contact' as const })),
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2">Actions</h1>
          <p className="text-gray-600">Track and manage your action items</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <Filter className="w-4 h-4 text-gray-500" />
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Priority:</label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Type:</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="seller_report_opened">Seller Report Opened</SelectItem>
                  <SelectItem value="opportunity_stalled">Opportunity Stalled</SelectItem>
                  <SelectItem value="new_buyer_match">New Buyer Match</SelectItem>
                  <SelectItem value="seller_interest_reengaged">Seller Interest Re-engaged</SelectItem>
                  <SelectItem value="appraisal_follow_up">Appraisal Follow-Up</SelectItem>
                  <SelectItem value="missing_property_fields">Missing Property Fields</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Grouped Cards */}
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading actions...</div>
        ) : allEntities.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No actions found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allEntities.map((entity) => renderEntityCard(entity.type, entity))}
          </div>
        )}

        {/* Action Modal */}
        <Dialog open={!!selectedEntity} onOpenChange={() => setSelectedEntity(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Actions for {selectedEntity?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              {entityActions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No actions found</p>
              ) : (
                entityActions.map((action) => (
                  <div
                    key={action.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      action.completedAt
                        ? 'bg-gray-50 border-gray-200 opacity-60'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Checkbox
                      checked={!!action.completedAt}
                      onCheckedChange={() => {
                        if (!action.completedAt) {
                          handleComplete(action.id);
                        }
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-medium ${action.completedAt ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {action.description || action.actionType.replace(/_/g, ' ')}
                        </p>
                        <Badge className={getPriorityColor(action.priority)}>
                          {action.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{action.actionType.replace(/_/g, ' ')}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(action.createdAt), 'MMM d, yyyy')}
                        </span>
                        {action.completedAt && (
                          <span className="text-green-600">Completed {format(new Date(action.completedAt), 'MMM d, yyyy')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
