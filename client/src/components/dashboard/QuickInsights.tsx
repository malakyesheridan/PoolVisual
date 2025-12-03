/**
 * Quick Insights Component
 * Simple dashboard insights showing what needs attention
 */

import React from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { AlertCircle, TrendingUp, Clock, CheckCircle2, FileText, ArrowRight } from 'lucide-react';
import { useIndustryTerm } from '../../hooks/useIndustryTerm';
import { useIsRealEstate } from '../../hooks/useIsRealEstate';
import { useJobsRoute, useJobDetailRoute } from '../../lib/route-utils';

interface QuickInsightsProps {
  jobs: any[];
  quotes?: any[];
  className?: string;
}

export function QuickInsights({ jobs, quotes = [], className = '' }: QuickInsightsProps) {
  const [, navigate] = useLocation();
  const { projects, project, quote, quotes: quotesTerm, createQuote } = useIndustryTerm();
  const jobsRoute = useJobsRoute();
  const isRealEstate = useIsRealEstate();
  
  // Group quotes by jobId for quick lookup
  const quotesByJobId = new Map<string, any[]>();
  quotes.forEach(quote => {
    if (!quotesByJobId.has(quote.jobId)) {
      quotesByJobId.set(quote.jobId, []);
    }
    quotesByJobId.get(quote.jobId)!.push(quote);
  });
  
  // Attach quotes to jobs
  const jobsWithQuotes = jobs.map(job => ({
    ...job,
    quotes: quotesByJobId.get(job.id) || []
  }));
  
  // Calculate insights
  const activeJobs = jobsWithQuotes.filter(job => 
    ['new', 'estimating', 'sent', 'accepted', 'scheduled'].includes(job.status)
  );
  
  const jobsNeedingQuote = activeJobs.filter(job => 
    (!job.quotes || job.quotes.length === 0) && 
    (job.status === 'new' || job.status === 'estimating')
  );
  
  const jobsPendingResponse = activeJobs.filter(job => 
    job.status === 'sent'
  );
  
  const jobsReadyToSchedule = activeJobs.filter(job => 
    job.status === 'accepted'
  );

  const insights = [];
  
  if (jobsNeedingQuote.length > 0) {
    insights.push({
      type: 'quote',
      message: `${jobsNeedingQuote.length} ${jobsNeedingQuote.length === 1 ? `${project} needs` : `${projects} need`} a ${quote.toLowerCase()}`,
      icon: AlertCircle,
      color: 'text-primary',
      bgColor: 'bg-primary/5',
      action: createQuote,
      jobs: jobsNeedingQuote,
      onClick: () => {
        // Navigate to the first job that needs a quote, or show a list
        if (jobsNeedingQuote.length === 1) {
          const route = isRealEstate ? `/properties/${jobsNeedingQuote[0].id}` : `/jobs/${jobsNeedingQuote[0].id}`;
          navigate(route);
        } else {
          // Navigate to jobs page with filter
          navigate(jobsRoute);
        }
      }
    });
  }
  
  if (jobsPendingResponse.length > 0) {
    insights.push({
      type: 'pending',
      message: `${jobsPendingResponse.length} ${jobsPendingResponse.length === 1 ? `${quote} is` : `${quotesTerm} are`} pending client response`,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      action: 'Follow Up',
      jobs: jobsPendingResponse,
      onClick: () => navigate(jobsRoute)
    });
  }
  
  if (jobsReadyToSchedule.length > 0) {
    insights.push({
      type: 'ready',
      message: `${jobsReadyToSchedule.length} ${jobsReadyToSchedule.length === 1 ? `${project} is` : `${projects} are`} ready to schedule`,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      action: 'Schedule',
      jobs: jobsReadyToSchedule,
      onClick: () => navigate(jobsRoute)
    });
  }

  if (insights.length === 0) {
    return (
      <Card className={`bg-white border border-gray-100 rounded-xl shadow-sm ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Quick Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="text-center py-6 px-4 bg-gradient-to-br from-slate-50 to-gray-50 rounded-lg">
            <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">All caught up!</p>
            <p className="text-xs text-gray-500">No action items at this time</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-white border border-gray-100 rounded-xl shadow-sm ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Quick Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-2">
          {insights.map((insight, index) => (
            <button
              key={index}
              onClick={insight.onClick}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-all duration-150 hover:shadow-sm cursor-pointer text-left"
            >
              <div className={`w-10 h-10 ${insight.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <insight.icon className={`w-5 h-5 ${insight.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{insight.message}</p>
                {insight.jobs && insight.jobs.length > 0 && insight.type === 'quote' && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {insight.jobs.length === 1 
                      ? insight.jobs[0].clientName || 'Unnamed project'
                      : `${insight.jobs.length} projects`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {insight.type === 'quote' && insight.jobs && insight.jobs.length === 1 && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={(e) => {
                      e.stopPropagation();
                      const route = isRealEstate ? `/properties/${insight.jobs[0].id}` : `/jobs/${insight.jobs[0].id}`;
                      navigate(route);
                    }}
                    className="bg-primary hover:bg-primary/90 text-white text-xs px-3 py-1 h-7"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    {createQuote}
                  </Button>
                )}
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

