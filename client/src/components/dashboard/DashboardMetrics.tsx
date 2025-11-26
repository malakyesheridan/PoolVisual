/**
 * Dashboard Metrics Component
 * Displays key project statistics and metrics
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { 
  Briefcase, 
  Activity, 
  DollarSign, 
  Calendar,
  TrendingUp,
  Clock
} from 'lucide-react';
import { formatCurrency } from '../../lib/measurement-utils';

interface DashboardMetricsProps {
  jobs: any[];
  quotes?: any[];
  className?: string;
}

export function DashboardMetrics({ jobs, quotes = [], className = '' }: DashboardMetricsProps) {
  // Calculate metrics
  const totalProjects = jobs.length;
  const activeProjects = jobs.filter(job => 
    ['new', 'estimating', 'sent', 'accepted', 'scheduled'].includes(job.status)
  ).length;
  const completedProjects = jobs.filter(job => job.status === 'completed').length;
  
  // Calculate total quote value
  const totalQuoteValue = quotes.reduce((sum, quote) => {
    return sum + parseFloat(quote.total || '0');
  }, 0);
  
  // Projects created this month
  const thisMonth = new Date();
  thisMonth.setDate(1); // First day of current month
  const projectsThisMonth = jobs.filter(job => 
    new Date(job.createdAt) >= thisMonth
  ).length;

  const metrics = [
    {
      title: "Total Projects",
      value: totalProjects,
      icon: Briefcase,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Active Projects", 
      value: activeProjects,
      icon: Activity,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "Total Value",
      value: formatCurrency(totalQuoteValue),
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    {
      title: "This Month",
      value: projectsThisMonth,
      icon: Calendar,
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    }
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {metrics.map((metric, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
              </div>
              <div className={`w-12 h-12 ${metric.bgColor} rounded-lg flex items-center justify-center`}>
                <metric.icon className={`w-6 h-6 ${metric.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
