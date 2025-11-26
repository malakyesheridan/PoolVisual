/**
 * Smart Insights Engine
 * Provides AI-powered insights and recommendations based on project data
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  Lightbulb, 
  Target,
  Clock,
  DollarSign,
  Users,
  CheckCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface SmartInsightsProps {
  jobs: any[];
  quotes: any[];
  className?: string;
}

interface InsightCardProps {
  type: 'success' | 'warning' | 'info' | 'tip';
  title: string;
  description: string;
  action?: string;
  icon: React.ComponentType<{ className?: string }>;
  priority: 'high' | 'medium' | 'low';
}

const InsightCard = ({ type, title, description, action, icon: Icon, priority }: InsightCardProps) => {
  const typeStyles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-primary/5 border-primary/20 text-primary',
    tip: 'bg-purple-50 border-purple-200 text-purple-800'
  };

  const iconStyles = {
    success: 'text-green-600',
    warning: 'text-yellow-600',
    info: 'text-primary',
    tip: 'text-purple-600'
  };

  const priorityStyles = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-orange-100 text-orange-800',
    low: 'bg-gray-100 text-gray-800'
  };

  return (
    <div className={`p-5 rounded-xl border ${typeStyles[type]} hover:shadow-md transition-all duration-200`} role="article" aria-labelledby={`insight-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconStyles[type]} bg-white shadow-sm flex-shrink-0`}>
          <Icon className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <h4 id={`insight-${title.replace(/\s+/g, '-').toLowerCase()}`} className="font-semibold text-sm">{title}</h4>
            <Badge className={`text-xs ${priorityStyles[priority]}`} aria-label={`${priority} priority`}>
              {priority} priority
            </Badge>
          </div>
          <p className="text-sm mb-4 leading-relaxed">{description}</p>
          {action && (
            <Button size="sm" variant="outline" className="text-xs" aria-label={`${action} for ${title}`}>
              {action}
              <ArrowRight className="w-3 h-3 ml-1" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export function SmartInsights({ jobs, quotes, className = '' }: SmartInsightsProps) {
  // Generate insights based on data
  const generateInsights = () => {
    const insights = [];

    // Revenue insights
    if (jobs.length === 0) {
      insights.push({
        type: 'tip' as const,
        title: 'Start Your First Project',
        description: 'Create your first pool visualization to begin tracking revenue and building your portfolio. Our AI will help optimize your quoting process.',
        action: 'Create Project',
        icon: Lightbulb,
        priority: 'high' as const
      });
    } else {
      const totalValue = quotes.reduce((sum, q) => sum + parseFloat(q.total || '0'), 0);
      const avgValue = totalValue / jobs.length;
      
      if (avgValue < 5000) {
        insights.push({
          type: 'warning' as const,
          title: 'Low Average Project Value',
          description: `Your average project value is $${avgValue.toFixed(0)}. Consider upselling premium materials or services to increase revenue per project.`,
          action: 'View Materials',
          icon: DollarSign,
          priority: 'medium' as const
        });
      }

      if (jobs.length > 0 && quotes.length === 0) {
        insights.push({
          type: 'info' as const,
          title: 'Missing Quote Data',
          description: 'You have projects but no quotes yet. Generate quotes to start tracking revenue and conversion metrics.',
          action: 'Generate Quotes',
          icon: Target,
          priority: 'high' as const
        });
      }
    }

    // Performance insights
    const conversionRate = jobs.length > 0 ? (quotes.filter(q => q.status === 'accepted').length / jobs.length) * 100 : 0;
    
    if (conversionRate > 0 && conversionRate < 30) {
      insights.push({
        type: 'warning' as const,
        title: 'Low Conversion Rate',
        description: `Your quote conversion rate is ${conversionRate.toFixed(1)}%. Consider improving your presentation quality or pricing strategy.`,
        action: 'View Analytics',
        icon: TrendingUp,
        priority: 'medium' as const
      });
    }

    // Growth insights
    if (jobs.length > 5) {
      insights.push({
        type: 'success' as const,
        title: 'Growing Portfolio',
        description: `You have ${jobs.length} projects in your portfolio. This is great momentum! Consider creating case studies to showcase your work.`,
        action: 'View Portfolio',
        icon: CheckCircle,
        priority: 'low' as const
      });
    }

    // Efficiency insights
    if (jobs.length > 0) {
      insights.push({
        type: 'tip' as const,
        title: 'Optimize Your Workflow',
        description: 'Use our canvas editor\'s "Add Changes to Quote" feature to streamline your quoting process and reduce manual data entry.',
        action: 'Learn More',
        icon: Clock,
        priority: 'low' as const
      });
    }

    return insights.slice(0, 4); // Limit to 4 insights
  };

  const insights = generateInsights();

  return (
    <Card className={`bg-gradient-to-br from-emerald-50 to-teal-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-md">
              <Brain className="w-5 h-5 text-white" />
            </div>
            Smart Insights
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 px-2 py-1">
              <Sparkles className="w-3 h-3 mr-1" />
              AI Powered
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Brain className="w-10 h-10 text-white" aria-hidden="true" />
            </div>
            <h4 className="text-xl font-semibold text-gray-700 mb-3">No Insights Yet</h4>
            <p className="text-gray-600 text-sm max-w-sm mx-auto leading-relaxed">
              Create some projects to unlock AI-powered insights and recommendations that will help optimize your business performance.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <InsightCard
                key={index}
                type={insight.type}
                title={insight.title}
                description={insight.description}
                action={insight.action}
                icon={insight.icon}
                priority={insight.priority}
              />
            ))}
          </div>
        )}
        
        {/* AI Status */}
        <div className="mt-6 bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-700">AI Engine Active</span>
            </div>
            <span className="text-xs text-gray-500">Analyzing {jobs.length} projects</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
