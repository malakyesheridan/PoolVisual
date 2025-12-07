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
import { CheckCircle2, Calendar, Filter, Home, User, ClipboardList, X, FileText, Sparkles, Lightbulb } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useLocation } from 'wouter';

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
  const [coldStartAction, setColdStartAction] = useState<Action | null>(null);
  const [coldStartProperty, setColdStartProperty] = useState<any>(null);
  const [checklistItems, setChecklistItems] = useState<Array<{ id: string; label: string; completed: boolean }>>([
    { id: '1', label: 'Review matched buyers', completed: false },
    { id: '2', label: 'Contact top 3 buyers marked "high intent"', completed: false },
    { id: '3', label: 'Upload enhanced versions of key photos', completed: false },
    { id: '4', label: 'Generate the first seller report draft', completed: false },
    { id: '5', label: 'Send seller the Listing Launch Summary', completed: false },
  ]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

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

  const handleViewColdStart = async (action: Action) => {
    setColdStartAction(action);
    // Reset checklist when opening
    setChecklistItems([
      { id: '1', label: 'Review matched buyers', completed: false },
      { id: '2', label: 'Contact top 3 buyers marked "high intent"', completed: false },
      { id: '3', label: 'Upload enhanced versions of key photos', completed: false },
      { id: '4', label: 'Generate the first seller report draft', completed: false },
      { id: '5', label: 'Send seller the Listing Launch Summary', completed: false },
    ]);
    if (action.propertyId) {
      try {
        const property = await apiClient.getJob(action.propertyId);
        setColdStartProperty(property);
      } catch (error) {
        console.error('Failed to load property:', error);
        toast({
          title: 'Error',
          description: 'Failed to load property details',
          variant: 'destructive',
        });
      }
    }
  };

  const handleToggleChecklistItem = (itemId: string) => {
    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleViewReportDraft = (propertyId: string) => {
    navigate(`/seller-report-builder/${propertyId}`);
    setColdStartAction(null);
  };

  const renderEntityCard = (
    type: 'property' | 'opportunity' | 'contact',
    entity: { entityId: string; entityName: string; actions: Action[] }
  ) => {
    const Icon = getEntityIcon(type);
    const firstAction = entity.actions[0];
    const isColdStart = firstAction?.actionType === 'LISTING_COLD_START';
    const isNudge = firstAction?.actionType?.startsWith('NUDGE_');
    const isSuggestion = firstAction?.actionType?.startsWith('INTEL_');
    
    return (
      <Card key={`${type}-${entity.entityId}`} className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isColdStart ? (
                <Sparkles className="w-5 h-5 text-purple-600" />
              ) : isSuggestion ? (
                <Lightbulb className="w-5 h-5 text-blue-500" />
              ) : (
                <Icon className="w-5 h-5 text-gray-600" />
              )}
              <CardTitle className="text-base font-semibold">{entity.entityName}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {isSuggestion && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                  Suggestion
                </Badge>
              )}
              {firstAction && (
                <Badge className={getPriorityColor(firstAction.priority)}>
                  {firstAction.priority}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {firstAction ? (
            <div className="space-y-2">
              {isColdStart ? (
                <>
                  <p className="text-sm text-gray-700 font-medium">{firstAction.description || 'Listing Cold Start'}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(firstAction.createdAt), { addSuffix: true })}
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-600 font-medium">Checklist Preview:</p>
                    <ul className="text-xs text-gray-500 space-y-0.5">
                      <li>• Review matched buyers</li>
                      <li>• Contact top 3 buyers marked "high intent"</li>
                    </ul>
                  </div>
                </>
              ) : isNudge || isSuggestion ? (
                <>
                  <p className="text-sm text-gray-700 font-medium">{firstAction.description || firstAction.actionType.replace(/_/g, ' ')}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(firstAction.createdAt), { addSuffix: true })}
                  </div>
                  {firstAction.opportunityId && (
                    <Button
                      variant={isSuggestion ? "default" : "outline"}
                      size="sm"
                      className={`mt-2 w-full ${isSuggestion ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                      onClick={() => {
                        navigate(`/opportunities`);
                        toast({
                          title: 'Opening Opportunities',
                          description: 'Please find and open the opportunity from the list.',
                        });
                      }}
                    >
                      View Opportunity
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-700">{firstAction.description || firstAction.actionType.replace(/_/g, ' ')}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(firstAction.createdAt), { addSuffix: true })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No pending actions</p>
          )}
        </CardContent>
        <CardFooter className="pt-3 flex flex-col gap-2">
          {isColdStart && firstAction ? (
            <>
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={() => handleViewColdStart(firstAction)}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                View Cold Start Details
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleViewAllActions(type, entity.entityId, entity.entityName)}
              >
                View all actions ({entity.actions.length})
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => handleViewAllActions(type, entity.entityId, entity.entityName)}
            >
              View all actions ({entity.actions.length})
            </Button>
          )}
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
                          <SelectItem value="past_appraisal_demand_spike">Past Appraisal Demand Spike</SelectItem>
                          <SelectItem value="LISTING_COLD_START">Listing Cold Start</SelectItem>
                          <SelectItem value="NUDGE_SELLER_UPDATE">Nudge: Seller Update</SelectItem>
                          <SelectItem value="NUDGE_APPRAISAL_FOLLOWUP">Nudge: Appraisal Follow-Up</SelectItem>
                          <SelectItem value="NUDGE_OPPORTUNITY_INACTIVE">Nudge: Opportunity Inactive</SelectItem>
                          <SelectItem value="INTEL_NO_PRICE_GUIDE">Suggestion: No Price Guide</SelectItem>
                          <SelectItem value="INTEL_LOW_BUYER_MATCH_COUNT">Suggestion: Low Buyer Matches</SelectItem>
                          <SelectItem value="INTEL_STALE_OPPORTUNITY">Suggestion: Stale Opportunity</SelectItem>
                          <SelectItem value="INTEL_LOW_RECENT_SELLER_ENGAGEMENT">Suggestion: Low Seller Engagement</SelectItem>
                          <SelectItem value="INTEL_NEEDS_APPRAISAL_FOLLOWUP">Suggestion: Appraisal Follow-Up</SelectItem>
                          <SelectItem value="INTEL_PHOTO_QUALITY_IMPROVEMENT">Suggestion: Photo Quality</SelectItem>
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

        {/* Cold Start Modal */}
        <Dialog open={!!coldStartAction} onOpenChange={(open) => {
          if (!open) {
            setColdStartAction(null);
            setColdStartProperty(null);
            // Reset checklist when closing
            setChecklistItems([
              { id: '1', label: 'Review matched buyers', completed: false },
              { id: '2', label: 'Contact top 3 buyers marked "high intent"', completed: false },
              { id: '3', label: 'Upload enhanced versions of key photos', completed: false },
              { id: '4', label: 'Generate the first seller report draft', completed: false },
              { id: '5', label: 'Send seller the Listing Launch Summary', completed: false },
            ]);
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Listing Cold Start - {coldStartProperty?.address || 'Property'}
              </DialogTitle>
            </DialogHeader>
            
            {coldStartAction && (
              <div className="mt-4 space-y-6">
                {/* Buyer Match Summary */}
                {coldStartProperty?.sellerLaunchInsights && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Buyer Match Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <p className="text-2xl font-bold text-purple-600">
                            {coldStartProperty.sellerLaunchInsights.buyerMatchCount}
                          </p>
                          <p className="text-sm text-gray-600">Matched Buyers</p>
                        </div>
                        {coldStartProperty.sellerLaunchInsights.topMatchedBuyers?.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">Top Matched Buyers:</p>
                            <div className="space-y-2">
                              {coldStartProperty.sellerLaunchInsights.topMatchedBuyers.map((buyer: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <span className="text-sm font-medium">{buyer.name}</span>
                                  <span className="text-sm text-gray-600">{buyer.budget}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Checklist */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Initial Listing Checklist</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {checklistItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          onClick={() => handleToggleChecklistItem(item.id)}
                        >
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => handleToggleChecklistItem(item.id)}
                            className="mt-1"
                          />
                          <label className="flex-1 text-sm text-gray-700 cursor-pointer">
                            <span className={item.completed ? 'line-through text-gray-500' : ''}>
                              {item.label}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {coldStartAction.propertyId && (
                    <Button
                      variant="default"
                      className="flex-1"
                      onClick={() => handleViewReportDraft(coldStartAction.propertyId!)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Report Draft
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      if (coldStartAction && !coldStartAction.completedAt) {
                        handleComplete(coldStartAction.id);
                        setColdStartAction(null);
                        setColdStartProperty(null);
                      }
                    }}
                    disabled={!!coldStartAction.completedAt}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {coldStartAction.completedAt ? 'Completed' : 'Mark Cold Start Completed'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
