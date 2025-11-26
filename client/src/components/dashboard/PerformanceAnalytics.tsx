/**
 * Performance Analytics Component
 * Displays key performance metrics with visual indicators
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Clock, 
  Star,
  Target,
  Users,
  CheckCircle
} from 'lucide-react';
import { formatCurrency } from '../../lib/measurement-utils';

interface PerformanceAnalyticsProps {
  jobs: any[];
  quotes: any[];
  className?: string;
}

interface MetricCardProps {
  title: string;
  value: string;
  trend: string;
  trendDirection: 'up' | 'down' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
}

const MetricCard = ({ title, value, trend, trendDirection, icon: Icon, subtitle }: MetricCardProps) => (
  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-2">
      <Icon className="w-5 h-5 text-gray-600" />
      <div className={`flex items-center gap-1 text-xs ${
        trendDirection === 'up' ? 'text-green-600' :
        trendDirection === 'down' ? 'text-red-600' :
        'text-gray-600'
      }`}>
        {trendDirection === 'up' ? <TrendingUp className="w-3 h-3" /> :
         trendDirection === 'down' ? <TrendingDown className="w-3 h-3" /> :
         null}
        <span>{trend}</span>
      </div>
    </div>
    <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
    <div className="text-sm font-medium text-gray-700">{title}</div>
    {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
  </div>
);

export function PerformanceAnalytics({ jobs, quotes, className = '' }: PerformanceAnalyticsProps) {
  // Calculate performance metrics
  const totalJobs = jobs.length;
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted');
  const conversionRate = totalJobs > 0 ? (acceptedQuotes.length / totalJobs) * 100 : 0;
  
  const avgProjectValue = totalJobs > 0 
    ? quotes.reduce((sum, q) => sum + parseFloat(q.total || '0'), 0) / totalJobs
    : 0;

  // Calculate average response time (mock data for now)
  const avgResponseTime = 2.3; // days
  const responseTimeTrend = -0.5; // improvement

  // Calculate client satisfaction (mock data for now)
  const clientSatisfaction = 4.8;
  const satisfactionTrend = 0.2;

  // Calculate on-time delivery rate (mock data for now)
  const onTimeRate = 98;
  const onTimeTrend = 2;

  const metrics = [
    {
      title: "Quote Conversion",
      value: jobs.length > 0 ? `${conversionRate.toFixed(1)}%` : "0%",
      trend: jobs.length > 0 ? "+5%" : "0%",
      trendDirection: 'up' as const,
      icon: Target,
      subtitle: jobs.length > 0 ? `${acceptedQuotes.length} of ${totalJobs} projects` : "No projects yet"
    },
    {
      title: "Avg Project Value",
      value: jobs.length > 0 ? formatCurrency(avgProjectValue) : "$0.00",
      trend: jobs.length > 0 ? "+12%" : "0%",
      trendDirection: 'up' as const,
      icon: DollarSign,
      subtitle: "Per project"
    },
    {
      title: "Client Satisfaction",
      value: jobs.length > 0 ? `${clientSatisfaction}/5` : "0/5",
      trend: jobs.length > 0 ? `+${satisfactionTrend}` : "0",
      trendDirection: 'up' as const,
      icon: Star,
      subtitle: "Average rating"
    },
    {
      title: "Response Time",
      value: jobs.length > 0 ? `${avgResponseTime} days` : "0 days",
      trend: jobs.length > 0 ? `${responseTimeTrend}` : "0",
      trendDirection: 'up' as const, // Negative trend is good for response time
      icon: Clock,
      subtitle: "Average quote time"
    },
    {
      title: "On-Time Delivery",
      value: jobs.length > 0 ? `${onTimeRate}%` : "0%",
      trend: jobs.length > 0 ? `+${onTimeTrend}%` : "0%",
      trendDirection: 'up' as const,
      icon: CheckCircle,
      subtitle: "Project completion"
    },
    {
      title: "Active Clients",
      value: `${totalJobs}`,
      trend: jobs.length > 0 ? "+3" : "0",
      trendDirection: 'up' as const,
      icon: Users,
      subtitle: "Current projects"
    }
  ];

  return (
    <Card className={`bg-gradient-to-br from-amber-50 to-yellow-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-md">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          Performance Analytics
          <Badge className="bg-green-100 text-green-800 border-green-200 px-3 py-1">
            {onTimeRate}% On-Time
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric, index) => (
            <MetricCard
              key={index}
              title={metric.title}
              value={metric.value}
              trend={metric.trend}
              trendDirection={metric.trendDirection}
              icon={metric.icon}
              subtitle={metric.subtitle}
            />
          ))}
        </div>
        
        {/* Performance summary */}
        <div className="mt-6 bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Performance Summary</h4>
            <Badge className="bg-green-100 text-green-800 text-xs">
              Excellent Performance
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-green-600">{jobs.length > 0 ? conversionRate.toFixed(0) : 0}%</div>
              <div className="text-xs text-gray-600">Conversion Rate</div>
            </div>
            <div>
              <div className="text-lg font-bold text-primary">{jobs.length > 0 ? clientSatisfaction : 0}</div>
              <div className="text-xs text-gray-600">Client Rating</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-600">{jobs.length > 0 ? onTimeRate : 0}%</div>
              <div className="text-xs text-gray-600">On-Time Delivery</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
