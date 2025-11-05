/**
 * Simplified Metric Cards Component
 * Displays 4 essential metrics in clean, simple cards
 */

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { 
  Briefcase, 
  Activity, 
  DollarSign, 
  Calendar
} from 'lucide-react';
import { formatCurrency } from '../../lib/measurement-utils';

interface MetricCardsProps {
  jobs: any[];
  quotes?: any[];
  className?: string;
}

export function MetricCards({ jobs, quotes = [], className = '' }: MetricCardsProps) {
  // Calculate metrics
  const totalProjects = jobs.length;
  const activeProjects = jobs.filter(job => 
    ['new', 'estimating', 'sent', 'accepted', 'scheduled'].includes(job.status)
  ).length;
  
  // Calculate total quote value
  const totalQuoteValue = quotes.reduce((sum, quote) => {
    return sum + parseFloat(quote.total || '0');
  }, 0);
  
  // Projects created this month
  const thisMonth = new Date();
  thisMonth.setDate(1); // First day of current month
  const projectsThisMonth = jobs.filter(job => {
    if (!job.createdAt) return false;
    const createdAt = new Date(job.createdAt);
    return !isNaN(createdAt.getTime()) && createdAt >= thisMonth;
  }).length;

  const metrics = [
    {
      title: "Total Projects",
      value: totalProjects,
      icon: Briefcase,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Active Projects", 
      value: activeProjects,
      icon: Activity,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "This Month",
      value: projectsThisMonth,
      icon: Calendar,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      title: "Total Value",
      value: formatCurrency(totalQuoteValue),
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ];

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {metrics.map((metric, index) => (
        <Card key={index} className="border border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{metric.title}</p>
                <p className="text-3xl font-bold text-gray-900">{metric.value}</p>
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

