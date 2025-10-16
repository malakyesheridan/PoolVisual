/**
 * Activity Feed Component
 * Displays real-time project activities and notifications
 */

import React, { useState, useEffect } from 'react';
import { useProjectStore, ProjectActivity } from '../../stores/projectStore';
import { useStatusSyncStore } from '../../stores/statusSyncStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Activity,
  Clock,
  User,
  Palette,
  FileText,
  Package,
  Mail,
  CheckCircle,
  AlertTriangle,
  Info,
  XCircle,
  RefreshCw,
  Filter,
  Search
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityFeedProps {
  className?: string;
  projectId?: string;
  maxItems?: number;
}

export function ActivityFeed({ className = '', projectId, maxItems = 20 }: ActivityFeedProps) {
  const { getProjectActivities, activities } = useProjectStore();
  const { notifications } = useStatusSyncStore();
  const [filterType, setFilterType] = useState<'all' | 'project' | 'notifications'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get project activities if projectId is provided
  const projectActivities = projectId ? getProjectActivities(projectId) : [];

  // Combine activities and notifications
  const allActivities = React.useMemo(() => {
    const combined = [];
    
    // Add project activities
    if (filterType === 'all' || filterType === 'project') {
      projectActivities.forEach(activity => {
        combined.push({
          id: activity.id,
          type: 'project_activity',
          timestamp: activity.timestamp,
          message: activity.message,
          activityType: activity.type,
          data: activity.data,
          source: 'project'
        });
      });
    }
    
    // Add notifications
    if (filterType === 'all' || filterType === 'notifications') {
      notifications.forEach(notification => {
        combined.push({
          id: notification.id,
          type: 'notification',
          timestamp: notification.timestamp,
          message: notification.message,
          severity: notification.severity,
          notificationType: notification.type,
          data: notification.data,
          source: 'notification'
        });
      });
    }
    
    // Sort by timestamp (newest first)
    return combined
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, maxItems);
  }, [projectActivities, notifications, filterType, maxItems]);

  const getActivityIcon = (item: any) => {
    if (item.type === 'notification') {
      switch (item.severity) {
        case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
        case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
        case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
        case 'info': return <Info className="w-4 h-4 text-blue-500" />;
        default: return <Info className="w-4 h-4 text-gray-500" />;
      }
    } else {
      switch (item.activityType) {
        case 'project_created': return <CheckCircle className="w-4 h-4 text-green-500" />;
        case 'photo_uploaded': return <Package className="w-4 h-4 text-blue-500" />;
        case 'canvas_work': return <Palette className="w-4 h-4 text-purple-500" />;
        case 'quote_generated': return <FileText className="w-4 h-4 text-orange-500" />;
        case 'material_assigned': return <Package className="w-4 h-4 text-indigo-500" />;
        case 'status_changed': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
        case 'client_contacted': return <Mail className="w-4 h-4 text-cyan-500" />;
        default: return <Activity className="w-4 h-4 text-gray-500" />;
      }
    }
  };

  const getActivityColor = (item: any) => {
    if (item.type === 'notification') {
      switch (item.severity) {
        case 'error': return 'border-red-200 bg-red-50';
        case 'warning': return 'border-yellow-200 bg-yellow-50';
        case 'success': return 'border-green-200 bg-green-50';
        case 'info': return 'border-blue-200 bg-blue-50';
        default: return 'border-gray-200 bg-gray-50';
      }
    } else {
      return 'border-gray-200 bg-white';
    }
  };

  const getSourceBadge = (item: any) => {
    if (item.source === 'project') {
      return <Badge variant="outline" className="text-xs">Project</Badge>;
    } else if (item.source === 'notification') {
      return <Badge variant="secondary" className="text-xs">System</Badge>;
    }
    return null;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Activity Feed
            {allActivities.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {allActivities.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {['all', 'project', 'notifications'].map((type) => (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType(type as any)}
                  className="text-xs capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {allActivities.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Activity className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs text-slate-400 mt-1">
              {filterType === 'all' 
                ? 'Activity will appear here as you work on projects'
                : `No ${filterType} activity found`
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {allActivities.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-4 hover:bg-slate-50 transition-colors ${getActivityColor(item)}`}
              >
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(item)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 break-words">
                      {item.message}
                    </p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {getSourceBadge(item)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatDistanceToNow(item.timestamp, { addSuffix: true })}</span>
                    {item.data?.projectName && (
                      <span>• {item.data.projectName}</span>
                    )}
                    {item.data?.maskName && (
                      <span>• {item.data.maskName}</span>
                    )}
                  </div>
                  {item.data && Object.keys(item.data).length > 0 && (
                    <div className="mt-2 text-xs text-slate-600">
                      {item.data.projectName && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{item.data.projectName}</span>
                        </div>
                      )}
                      {item.data.maskName && (
                        <div className="flex items-center gap-1">
                          <Palette className="w-3 h-3" />
                          <span>{item.data.maskName}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {allActivities.length > 0 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Showing {allActivities.length} recent activities</span>
              <Button variant="ghost" size="sm" className="text-xs h-6">
                View All
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
