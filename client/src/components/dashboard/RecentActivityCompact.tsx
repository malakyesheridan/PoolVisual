/**
 * Compact Recent Activity Component
 * Shows last 3-4 recent updates in a simple format
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Activity, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RecentActivityCompactProps {
  jobs: any[];
  className?: string;
}

export function RecentActivityCompact({ jobs, className = '' }: RecentActivityCompactProps) {
  // Helper to validate date
  const isValidDate = (date: any): boolean => {
    if (!date) return false;
    const d = new Date(date);
    return !isNaN(d.getTime());
  };

  // Get recent activities from jobs
  const activities = jobs
    .filter(job => {
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
    .slice(0, 4)
    .map(job => ({
      id: job.id,
      title: job.clientName,
      status: job.status,
      timestamp: job.updatedAt,
    }));

  if (activities.length === 0) {
    return null; // Don't show if no activity
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'new': 'Created',
      'estimating': 'In Estimation',
      'sent': 'Quote Sent',
      'accepted': 'Accepted',
      'declined': 'Declined',
      'scheduled': 'Scheduled',
      'completed': 'Completed'
    };
    return labels[status] || status;
  };

  return (
    <Card className={`bg-white border border-gray-100 rounded-xl shadow-sm ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="space-y-2">
          {activities.map((activity) => (
            <div 
              key={activity.id} 
              className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-slate-50 transition-all duration-150 border-b border-gray-100 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {activity.title}
                </p>
                <p className="text-xs text-gray-500">
                  {getStatusLabel(activity.status)}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-4 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                <span>
                  {activity.timestamp && isValidDate(activity.timestamp)
                    ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })
                    : 'Recently'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

