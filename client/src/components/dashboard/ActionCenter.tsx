/**
 * Action Center
 * Quick actions and workflow shortcuts for efficient project management
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Zap, 
  Plus, 
  Upload, 
  FileText, 
  Send, 
  Download,
  Settings,
  Users,
  Calendar,
  BarChart3,
  Palette,
  Camera,
  Edit,
  Share2,
  Clock,
  Star
} from 'lucide-react';
import { useIndustryTerm } from '../../hooks/useIndustryTerm';

interface ActionCenterProps {
  jobs: any[];
  quotes: any[];
  onNavigate: (path: string) => void;
  className?: string;
}

interface ActionButtonProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'accent';
  badge?: string;
  disabled?: boolean;
}

const ActionButton = ({ title, description, icon: Icon, onClick, variant = 'secondary', badge, disabled }: ActionButtonProps) => {
  const variantStyles = {
    primary: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl',
    secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md',
    accent: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl'
  };

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={`p-6 h-auto flex flex-col items-center text-center gap-4 transition-all duration-200 hover:scale-105 min-h-[120px] ${variantStyles[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      aria-label={`${title}: ${description}`}
    >
      <div className="relative">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${variant === 'primary' || variant === 'accent' ? 'bg-white/20' : 'bg-gray-100'}`}>
          <Icon className={`w-7 h-7 ${variant === 'primary' || variant === 'accent' ? 'text-white' : 'text-gray-600'}`} />
        </div>
        {badge && (
          <Badge className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 font-semibold">
            {badge}
          </Badge>
        )}
      </div>
      <div className="space-y-2">
        <h4 className="font-semibold text-sm leading-tight">{title}</h4>
        <p className="text-xs opacity-80 leading-relaxed">{description}</p>
      </div>
    </Button>
  );
};

export function ActionCenter({ jobs, quotes, onNavigate, className = '' }: ActionCenterProps) {
  const { project, projects, quote, quotes: quotesTerm, createJob, createQuote, uploadPhoto } = useIndustryTerm();
  const hasJobs = jobs.length > 0;
  const hasQuotes = quotes.length > 0;
  const pendingQuotes = quotes.filter(q => q.status === 'sent').length;

  const quickActions = [
    {
      title: createJob,
      description: `Start a new ${project.toLowerCase()}`,
      icon: Plus,
      onClick: () => onNavigate('/jobs/new'),
      variant: 'primary' as const
    },
    {
      title: uploadPhoto,
      description: `Add photos to existing ${project.toLowerCase()}`,
      icon: Upload,
      onClick: () => onNavigate('/jobs'),
      variant: 'secondary' as const,
      disabled: !hasJobs
    },
    {
      title: 'Canvas Editor',
      description: 'Edit materials and areas',
      icon: Palette,
      onClick: () => onNavigate('/canvas'),
      variant: 'secondary' as const,
      disabled: !hasJobs
    },
    {
      title: `Generate ${quote}`,
      description: `Create professional ${quotesTerm.toLowerCase()}`,
      icon: FileText,
      onClick: () => onNavigate('/quotes'),
      variant: 'secondary' as const,
      disabled: !hasJobs
    }
  ];

  const workflowActions = [
    {
      title: `Send ${quote}`,
      description: `Email ${quote.toLowerCase()} to client`,
      icon: Send,
      onClick: () => onNavigate('/quotes'),
      variant: 'accent' as const,
      badge: pendingQuotes > 0 ? pendingQuotes.toString() : undefined,
      disabled: !hasQuotes
    },
    {
      title: 'Export PDF',
      description: `Download ${quote.toLowerCase()} as PDF`,
      icon: Download,
      onClick: () => onNavigate('/quotes'),
      variant: 'secondary' as const,
      disabled: !hasQuotes
    },
    {
      title: 'View Analytics',
      description: `${project} performance metrics`,
      icon: BarChart3,
      onClick: () => onNavigate('/dashboard'),
      variant: 'secondary' as const,
      disabled: !hasJobs
    },
    {
      title: 'Client Portal',
      description: 'Share with clients',
      icon: Share2,
      onClick: () => onNavigate('/clients'),
      variant: 'secondary' as const,
      disabled: !hasJobs
    }
  ];

  const managementActions = [
    {
      title: 'Schedule Meeting',
      description: 'Book client consultation',
      icon: Calendar,
      onClick: () => onNavigate('/calendar'),
      variant: 'secondary' as const
    },
    {
      title: 'Team Settings',
      description: 'Manage team members',
      icon: Users,
      onClick: () => onNavigate('/settings/team'),
      variant: 'secondary' as const
    },
    {
      title: 'App Settings',
      description: 'Configure preferences',
      icon: Settings,
      onClick: () => onNavigate('/settings'),
      variant: 'secondary' as const
    },
    {
      title: 'Help Center',
      description: 'Get support & tutorials',
      icon: Star,
      onClick: () => onNavigate('/help'),
      variant: 'secondary' as const
    }
  ];

  return (
    <Card className={`bg-gradient-to-br from-orange-50 to-red-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center shadow-md">
            <Zap className="w-5 h-5 text-white" />
          </div>
          Action Center
          <Badge className="bg-orange-100 text-orange-800 border-orange-200 px-2 py-1">
            Quick Actions
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Quick Actions */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Quick Actions
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {quickActions.map((action, index) => (
                <ActionButton
                  key={index}
                  title={action.title}
                  description={action.description}
                  icon={action.icon}
                  onClick={action.onClick}
                  variant={action.variant}
                  disabled={action.disabled}
                />
              ))}
            </div>
          </div>

          {/* Workflow Actions */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Workflow Tools
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {workflowActions.map((action, index) => (
                <ActionButton
                  key={index}
                  title={action.title}
                  description={action.description}
                  icon={action.icon}
                  onClick={action.onClick}
                  variant={action.variant}
                  badge={action.badge}
                  disabled={action.disabled}
                />
              ))}
            </div>
          </div>

          {/* Management Actions */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Management
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {managementActions.map((action, index) => (
                <ActionButton
                  key={index}
                  title={action.title}
                  description={action.description}
                  icon={action.icon}
                  onClick={action.onClick}
                  variant={action.variant}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="mt-6 bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-primary">{jobs.length}</div>
                <div className="text-xs text-gray-600">Projects</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{quotes.length}</div>
                <div className="text-xs text-gray-600">Quotes</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600">{pendingQuotes}</div>
                <div className="text-xs text-gray-600">Pending</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-700">Ready for Action</div>
              <div className="text-xs text-gray-500">All systems operational</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
