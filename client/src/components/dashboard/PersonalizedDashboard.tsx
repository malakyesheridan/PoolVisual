/**
 * Personalized Dashboard Component
 * 
 * Adapts dashboard layout and widgets based on user onboarding data
 */

import React, { useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useEnabledFeatures } from '@/hooks/useFeatureFlag';
import { getFilteredWidgets } from './DashboardWidgets';
import { getIndustryTerm } from '@/lib/industry-terminology';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Palette, Briefcase } from 'lucide-react';
import { UserRole } from '@/types/onboarding';

/**
 * Personalized dashboard that adapts to user onboarding data
 * CORRECTED: Proper error handling and fallbacks
 */
export function PersonalizedDashboard() {
  const { industry, role, useCase, experience } = useOnboarding();
  const enabledFeatures = useEnabledFeatures();
  const [, navigate] = useLocation();
  
  // Fetch jobs and quotes for widgets (user-centric)
  const { data: jobs = [] } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: () => apiClient.getJobs(),
    staleTime: 1 * 60 * 1000,
  });
  
  const { data: quotes = [] } = useQuery({
    queryKey: ['/api/quotes'],
    queryFn: () => apiClient.getQuotes(),
    staleTime: 1 * 60 * 1000,
  });
  
  const visibleWidgets = useMemo(() => {
    return getFilteredWidgets(
      { industry, role, useCase, experience },
      enabledFeatures
    );
  }, [industry, role, useCase, experience, enabledFeatures]);
  
  // Group widgets by priority (visual grouping)
  const priorityGroups = useMemo(() => {
    const groups: Record<number, typeof visibleWidgets> = {};
    visibleWidgets.forEach(widget => {
      const priority = Math.floor(widget.priority / 10) * 10; // Group by 10s
      if (!groups[priority]) groups[priority] = [];
      groups[priority].push(widget);
    });
    return groups;
  }, [visibleWidgets]);
  
  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0 px-4 md:px-0">
      {/* Welcome message based on onboarding */}
      <WelcomeMessage />
      
      {/* Quick actions based on use case */}
      <QuickActionsPanel />
      
      {/* Widget grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {Object.entries(priorityGroups)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([priority, widgets]) => (
            <React.Fragment key={priority}>
              {widgets.map(widget => {
                const WidgetComponent = widget.component;
                
                // Build props based on widget requirements
                const widgetProps: any = {
                  jobs,
                  quotes,
                  ...widget.config,
                };
                
                // Add navigation handlers for widgets that need them
                if (widget.id === 'activeProjects' || widget.id === 'projectPipeline') {
                  widgetProps.onView = (id: string) => navigate(`/jobs/${id}`);
                  widgetProps.onEdit = (id: string) => navigate(`/jobs/${id}/edit`);
                }
                
                if (widget.id === 'actionCenter') {
                  widgetProps.onNavigate = (path: string) => navigate(path);
                }
                
                return (
                  <Card key={widget.id} className={widgets.length > 1 ? 'md:col-span-2 lg:col-span-3' : ''}>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold">
                        {getWidgetTitle(widget.id, industry)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <WidgetComponent {...widgetProps} />
                    </CardContent>
                  </Card>
                );
              })}
            </React.Fragment>
          ))}
      </div>
    </div>
  );
}

/**
 * Get widget title based on widget ID and industry
 */
function getWidgetTitle(widgetId: string, industry: string): string {
  const titles: Record<string, string> = {
    recentQuotes: getIndustryTerm(industry, 'recent_quotes') || 'Recent Quotes',
    quoteMetrics: 'Quote Metrics',
    materialLibrary: 'Material Library',
    recentDesigns: 'Recent Designs',
    activeProjects: getIndustryTerm(industry, 'active_jobs') || 'Active Projects',
    projectMetrics: 'Project Metrics',
    workflowSuggestions: 'Workflow Suggestions',
    businessMetrics: 'Business Metrics',
    revenueIntelligence: 'Revenue Intelligence',
    performanceAnalytics: 'Performance Analytics',
    quickInsights: 'Quick Insights',
    smartInsights: 'Smart Insights',
    teamActivity: 'Team Activity',
    deadlineAlerts: 'Deadlines',
    collaborationNotifications: 'Collaboration',
    actionCenter: 'Quick Actions',
  };
  
  return titles[widgetId] || widgetId;
}

function WelcomeMessage() {
  const { industry, role, isNewUser } = useOnboarding();
  if (!isNewUser) return null;
  
  const jobTerm = getIndustryTerm(industry, 'job');
  const quoteTerm = getIndustryTerm(industry, 'quote');
  
  const messages: Record<UserRole, string> = {
    owner: `Welcome! As a business owner, you can manage your ${jobTerm.toLowerCase()}s and ${quoteTerm.toLowerCase()}s.`,
    manager: `Welcome! Coordinate projects and track team progress.`,
    estimator: `Welcome! Create ${quoteTerm.toLowerCase()}s and manage pricing efficiently.`,
    designer: `Welcome! Create stunning visualizations with our design tools.`,
    other: `Welcome to EasyFlow Studio!`,
  };
  
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardContent className="pt-4 md:pt-6 px-4 md:px-6">
        <h2 className="text-xl md:text-2xl font-bold mb-2 text-slate-900 mobile-text-xl">
          Welcome to EasyFlow Studio!
        </h2>
        <p className="text-slate-700 mobile-text-base">
          {messages[role] || messages.other}
        </p>
      </CardContent>
    </Card>
  );
}

function QuickActionsPanel() {
  const { useCase, industry } = useOnboarding();
  const [, navigate] = useLocation();
  
  const actions = useMemo(() => {
    const jobTerm = getIndustryTerm(industry, 'job');
    const quoteTerm = getIndustryTerm(industry, 'quote');
    const baseActions = [];
    
    if (useCase === 'quotes' || useCase === 'all') {
      baseActions.push({
        label: `Create ${quoteTerm}`,
        href: '/quotes/new',
        icon: FileText,
        onClick: () => navigate('/quotes/new'),
      });
    }
    
    if (useCase === 'design' || useCase === 'all') {
      baseActions.push({
        label: 'Start Design',
        href: '/jobs/new',
        icon: Palette,
        onClick: () => navigate('/jobs/new'),
      });
    }
    
    if (useCase === 'project_management' || useCase === 'all') {
      baseActions.push({
        label: `Create ${jobTerm}`,
        href: '/jobs/new',
        icon: Briefcase,
        onClick: () => navigate('/jobs/new'),
      });
    }
    
    return baseActions;
  }, [useCase, industry, navigate]);
  
  if (actions.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map(action => (
        <Button 
          key={action.href} 
          onClick={action.onClick}
          className="flex items-center gap-2 h-11 md:h-10 px-4 py-2.5 md:py-2 tap-target"
        >
          <action.icon className="w-4 h-4" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}

