/**
 * Project Overview Cards Component
 * Displays key project information in card format
 */

import React from 'react';
import { useLocation } from 'wouter';
import { useProjectStore, ProjectAnalytics } from '../../stores/projectStore';
import { useMaterialUsageStore } from '../../stores/materialUsageStore';
import { QuickActions } from './QuickActions';
import { ProjectHealthIndicators } from './ProjectHealthIndicators';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  TrendingUp,
  Zap,
  Eye,
  Edit,
  MapPin,
  Calendar,
  User,
  Clock,
  DollarSign,
  Package,
  Palette,
  FileText,
  Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProjectOverviewCardsProps {
  className?: string;
}

export function ProjectOverviewCards({ className = '' }: ProjectOverviewCardsProps) {
  const [, navigate] = useLocation();
  const { project, getProjectAnalytics } = useProjectStore();
  const { projectSummaries } = useMaterialUsageStore();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getProjectHealthColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-primary bg-primary/5';
      case 'draft': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getProjectHealthIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'in_progress': return '⚡';
      case 'draft': return '📝';
      default: return '⏳';
    }
  };

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 50) return 'text-primary';
    if (percentage >= 25) return 'text-yellow-600';
    return 'text-red-600';
  };

  const projectSummary = project ? projectSummaries[project.id] : null;
  const analytics = project ? getProjectAnalytics(project.id) : null;

  if (!project) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
        {/* Empty State Card */}
        <Card className="col-span-full">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Project Loaded</h3>
              <p className="text-gray-600 mb-4">Load a project to see overview cards</p>
              <Button onClick={() => navigate('/jobs')} variant="outline">
                Browse Projects
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {/* Current Project Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-primary">
              Current Project
            </CardTitle>
            <Badge className={getProjectHealthColor(project.status)}>
              {getProjectHealthIcon(project.status)} {project.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h3 className="font-semibold text-primary">{project.name}</h3>
            <p className="text-sm text-primary">{project.client.name}</p>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-primary">
            <MapPin className="w-4 h-4" />
            <span>{project.client.address || 'No address'}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-primary">
            <Calendar className="w-4 h-4" />
            <span>Created {formatDistanceToNow(project.createdAt, { addSuffix: true })}</span>
          </div>

          {analytics && (
            <div className="pt-2 border-t border-primary/20">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-primary">Completion:</span>
                <span className={`font-medium ${getCompletionColor(analytics.completionPercentage)}`}>
                  {analytics.completionPercentage}%
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${analytics.completionPercentage}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1"
              onClick={() => navigate(`/jobs/${project.jobId}`)}
            >
              <Eye className="w-4 h-4 mr-1" />
              View
            </Button>
            <Button 
              size="sm" 
              className="flex-1"
              onClick={() => navigate(`/jobs/${project.jobId}/edit`)}
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Project Stats Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Project Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Total Photos</span>
            <span className="font-semibold">{analytics?.totalPhotos || project.photos.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Canvas Work</span>
            <span className="font-semibold text-primary">
              {analytics?.photosWithCanvasWork || 0} photos
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Total Masks</span>
            <span className="font-semibold">{analytics?.totalMasks || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Quotes Generated</span>
            <span className="font-semibold text-purple-600">{analytics?.totalQuotes || 0}</span>
          </div>
          {analytics && analytics.timeSpent > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Time Spent</span>
              <span className="font-semibold text-orange-600">
                {Math.round(analytics.timeSpent)} min
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Overview Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Financial Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {projectSummary ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Materials Used</span>
                <span className="font-semibold">{projectSummary.uniqueMaterials}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Total Area</span>
                <span className="font-semibold">{projectSummary.totalArea.toFixed(2)} m²</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Material Cost</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(projectSummary.totalCost)}
                </span>
              </div>
              {analytics && analytics.estimatedValue > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Estimated Value</span>
                  <span className="font-semibold text-primary">
                    {formatCurrency(analytics.estimatedValue)}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-slate-500">
              <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No material data yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions Card */}
      <QuickActions projectId={project.id} />

      {/* Recent Activity Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-600" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics && analytics.lastActivity ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">
                  Last activity: {formatDistanceToNow(analytics.lastActivity, { addSuffix: true })}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Project is {analytics.completionPercentage}% complete
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500">
              <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Health Indicators */}
      <ProjectHealthIndicators projectId={project.id} />
    </div>
  );
}
