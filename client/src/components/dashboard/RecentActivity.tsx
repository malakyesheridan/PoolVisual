/**
 * Recent Activity Component
 * Shows recent project activities and updates
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  Activity, 
  Plus, 
  Edit, 
  FileText, 
  Eye,
  Calendar,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RecentActivityProps {
  jobs: any[];
  className?: string;
}

export function RecentActivity({ jobs, className = '' }: RecentActivityProps) {
  // Helper to validate date
  const isValidDate = (date: any): boolean => {
    if (!date) return false;
    const d = new Date(date);
    return !isNaN(d.getTime());
  };

  // Generate recent activities from jobs
  // Filter out jobs with invalid dates and ensure all required fields exist
  const activities = jobs
    .filter(job => {
      // Only include jobs with valid updatedAt dates and required fields
      return job && 
             job.id && 
             isValidDate(job.updatedAt) && 
             job.clientName && 
             job.status;
    })
    .sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA;
    })
    .slice(0, 5)
    .map(job => ({
      id: job.id,
      type: 'project_update',
      title: `${job.clientName} project updated`,
      description: `Status changed to ${job.status}`,
      timestamp: job.updatedAt,
      icon: Activity,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    }));

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'project_update': return Activity;
      case 'quote_created': return FileText;
      case 'project_created': return Plus;
      case 'project_viewed': return Eye;
      default: return Activity;
    }
  };

  if (activities.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No recent activity</p>
            <p className="text-sm">Activity will appear here as you work on projects</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className={`w-8 h-8 ${activity.bgColor} rounded-full flex items-center justify-center flex-shrink-0`}>
                <activity.icon className={`w-4 h-4 ${activity.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {activity.title}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {activity.description}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-400">
                    {activity.timestamp && isValidDate(activity.timestamp)
                      ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })
                      : 'Recently'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
