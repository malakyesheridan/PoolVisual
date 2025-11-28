import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Loader2, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Shield,
  User,
  Building2,
  Settings
} from 'lucide-react';
// Format date relative to now
const formatDistanceToNow = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
};

const actionTypeIcons: Record<string, typeof Shield> = {
  'user.create': User,
  'user.update': User,
  'user.delete': User,
  'user.impersonate': User,
  'user.reset_password': User,
  'user.activate': User,
  'user.deactivate': User,
  'org.create': Building2,
  'org.update': Building2,
  'org.delete': Building2,
  'settings.update': Settings,
  'analytics.view': Activity,
  'audit.view': Activity,
  default: Shield,
};

const actionTypeColors: Record<string, string> = {
  'user.create': 'bg-green-100 text-green-800',
  'user.update': 'bg-blue-100 text-blue-800',
  'user.delete': 'bg-red-100 text-red-800',
  'user.impersonate': 'bg-purple-100 text-purple-800',
  'user.reset_password': 'bg-orange-100 text-orange-800',
  'user.activate': 'bg-green-100 text-green-800',
  'user.deactivate': 'bg-red-100 text-red-800',
  'org.create': 'bg-green-100 text-green-800',
  'org.update': 'bg-blue-100 text-blue-800',
  'org.delete': 'bg-red-100 text-red-800',
  'settings.update': 'bg-indigo-100 text-indigo-800',
  'analytics.view': 'bg-slate-100 text-slate-800',
  'audit.view': 'bg-slate-100 text-slate-800',
  default: 'bg-slate-100 text-slate-800',
};

export function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('all');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'audit-logs', page, actionTypeFilter],
    queryFn: () => apiClient.getAdminAuditLogs({ 
      page, 
      limit: 50,
      actionType: actionTypeFilter !== 'all' ? actionTypeFilter : undefined
    }),
    staleTime: 5 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-600">
          <AlertCircle className="h-8 w-8 mx-auto mb-4" />
          <p>Error loading audit logs: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </CardContent>
      </Card>
    );
  }

  const logs = data?.logs || [];
  const pagination = data?.pagination || { page: 1, limit: 50 };

  // Get unique action types for filter
  const actionTypes = Array.from(new Set(logs.map((log: any) => log.actionType)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Audit Logs
        </CardTitle>
        <CardDescription>View all administrative actions and system events</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filter */}
        <div className="mb-6">
          <select
            value={actionTypeFilter}
            onChange={(e) => {
              setActionTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All Actions</option>
            {actionTypes.map((type: string) => (
              <option key={type} value={type}>
                {type.replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        {/* Audit Logs List */}
        <div className="space-y-4">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No audit logs found
            </div>
          ) : (
            logs.map((log: any) => {
              const Icon = actionTypeIcons[log.actionType] || actionTypeIcons.default;
              const colorClass = actionTypeColors[log.actionType] || actionTypeColors.default;
              
              return (
                <div key={log.id} className="border rounded-lg p-4 bg-slate-50">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={colorClass}>
                          {log.actionType.replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {formatDistanceToNow(new Date(log.createdAt))}
                        </span>
                      </div>
                      {log.resourceType && (
                        <div className="text-sm text-slate-600 mb-1">
                          <span className="font-medium">Resource:</span> {log.resourceType}
                          {log.resourceId && <span className="text-slate-400"> ({log.resourceId.substring(0, 8)}...)</span>}
                        </div>
                      )}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="text-xs text-slate-500 mt-2">
                          <details>
                            <summary className="cursor-pointer hover:text-slate-700">View Details</summary>
                            <pre className="mt-2 p-2 bg-white rounded border text-xs overflow-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                      {log.ipAddress && (
                        <div className="text-xs text-slate-400 mt-1">
                          IP: {log.ipAddress}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-slate-500">
              Page {pagination.page}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={pagination.page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={logs.length < pagination.limit}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

