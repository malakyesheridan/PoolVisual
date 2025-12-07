import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Calendar, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

export default function Actions() {
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filters: { priority?: string; type?: string } = {};
  if (priorityFilter !== 'all') filters.priority = priorityFilter;
  if (typeFilter !== 'all') filters.type = typeFilter;

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ['/api/actions', filters],
    queryFn: () => apiClient.getActions(filters),
  });

  const completeMutation = useMutation({
    mutationFn: (actionId: string) => apiClient.completeAction(actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
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

  const getRelatedEntityName = (action: Action): string => {
    if (action.propertyId) return `Property ${action.propertyId.substring(0, 8)}`;
    if (action.contactId) return `Contact ${action.contactId.substring(0, 8)}`;
    if (action.opportunityId) return `Opportunity ${action.opportunityId.substring(0, 8)}`;
    return '—';
  };

  const handleComplete = (actionId: string) => {
    completeMutation.mutate(actionId);
  };

  const handleEntityClick = (action: Action) => {
    // TODO: Open drawer for the related entity
    // This will be implemented when drawers are available
    console.log('Open drawer for:', {
      propertyId: action.propertyId,
      contactId: action.contactId,
      opportunityId: action.opportunityId,
    });
  };

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
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Actions Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading actions...</div>
          ) : actions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No actions found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Related Entity</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.map((action: Action) => (
                  <TableRow key={action.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      {action.description || action.actionType}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {action.actionType.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleEntityClick(action)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {getRelatedEntityName(action)}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(action.priority)}>
                        {action.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleComplete(action.id)}
                        disabled={completeMutation.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Complete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

