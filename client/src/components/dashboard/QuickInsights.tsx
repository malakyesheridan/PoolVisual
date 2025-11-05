/**
 * Quick Insights Component
 * Simple dashboard insights showing what needs attention
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { AlertCircle, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';

interface QuickInsightsProps {
  jobs: any[];
  className?: string;
}

export function QuickInsights({ jobs, className = '' }: QuickInsightsProps) {
  // Calculate insights
  const activeJobs = jobs.filter(job => 
    ['new', 'estimating', 'sent', 'accepted', 'scheduled'].includes(job.status)
  );
  
  const needsQuote = activeJobs.filter(job => 
    !job.quotes || job.quotes.length === 0 || 
    job.status === 'new' || job.status === 'estimating'
  ).length;
  
  const pendingResponse = activeJobs.filter(job => 
    job.status === 'sent'
  ).length;
  
  const readyToSchedule = activeJobs.filter(job => 
    job.status === 'accepted'
  ).length;

  const insights = [];
  
  if (needsQuote > 0) {
    insights.push({
      type: 'quote',
      message: `${needsQuote} ${needsQuote === 1 ? 'project needs' : 'projects need'} a quote`,
      icon: AlertCircle,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      action: 'Create Quote'
    });
  }
  
  if (pendingResponse > 0) {
    insights.push({
      type: 'pending',
      message: `${pendingResponse} ${pendingResponse === 1 ? 'quote is' : 'quotes are'} pending client response`,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      action: 'Follow Up'
    });
  }
  
  if (readyToSchedule > 0) {
    insights.push({
      type: 'ready',
      message: `${readyToSchedule} ${readyToSchedule === 1 ? 'project is' : 'projects are'} ready to schedule`,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      action: 'Schedule'
    });
  }

  if (insights.length === 0) {
    return (
      <Card className={`border border-gray-200 shadow-sm ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            Quick Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-500">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">All caught up! No action items.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border border-gray-200 shadow-sm ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gray-600" />
          Quick Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, index) => (
            <div 
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className={`w-10 h-10 ${insight.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <insight.icon className={`w-5 h-5 ${insight.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{insight.message}</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {insight.action}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

