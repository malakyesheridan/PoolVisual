/**
 * Project Health Indicators Component
 * Displays project status, progress, and health metrics
 */

import React from 'react';
import { useProjectStore, ProjectAnalytics } from '../../stores/projectStore';
import { useMaterialUsageStore } from '../../stores/materialUsageStore';
import { useMaskStore } from '../../maskcore/store';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Clock,
  Calendar,
  User,
  MapPin,
  Package,
  Palette,
  FileText,
  Activity,
  Zap,
  Target,
  BarChart3,
  PieChart
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProjectHealthIndicatorsProps {
  className?: string;
  projectId?: string;
}

export function ProjectHealthIndicators({ className = '', projectId }: ProjectHealthIndicatorsProps) {
  const { project, getProjectAnalytics } = useProjectStore();
  const { projectSummaries } = useMaterialUsageStore();
  const { masks, quotes } = useMaskStore();

  const currentProject = projectId ? project : project;
  const analytics = currentProject ? getProjectAnalytics(currentProject.id) : null;
  const projectSummary = currentProject ? projectSummaries[currentProject.id] : null;

  // Calculate comprehensive health metrics
  const healthMetrics = React.useMemo(() => {
    if (!currentProject) return null;

    const masksWithMaterials = Object.values(masks).filter(mask => 
      mask.materialId && mask.isVisible !== false
    );
    const activeQuotes = Object.values(quotes).filter(quote => 
      quote.status !== 'draft'
    );
    const photosWithCanvasWork = currentProject.photos.filter(photo => 
      currentProject.canvasStates[photo.id]
    );

    // Calculate completion percentage based on multiple factors
    const photoCompletion = currentProject.photos.length > 0 
      ? (photosWithCanvasWork.length / currentProject.photos.length) * 40 // 40% weight
      : 0;
    
    const maskCompletion = masksWithMaterials.length > 0 
      ? Math.min((masksWithMaterials.length / Math.max(Object.keys(masks).length, 1)) * 30, 30) // 30% weight
      : 0;
    
    const quoteCompletion = activeQuotes.length > 0 
      ? Math.min((activeQuotes.length / Math.max(Object.keys(quotes).length, 1)) * 30, 30) // 30% weight
      : 0;

    const overallCompletion = Math.round(photoCompletion + maskCompletion + quoteCompletion);

    // Determine health status
    let healthStatus: 'excellent' | 'good' | 'warning' | 'critical' = 'excellent';
    let healthScore = 100;

    if (overallCompletion < 25) {
      healthStatus = 'critical';
      healthScore = 25;
    } else if (overallCompletion < 50) {
      healthStatus = 'warning';
      healthScore = 50;
    } else if (overallCompletion < 80) {
      healthStatus = 'good';
      healthScore = 75;
    }

    // Check for potential issues
    const issues = [];
    if (currentProject.photos.length === 0) {
      issues.push('No photos uploaded');
    }
    if (Object.keys(masks).length === 0) {
      issues.push('No masks created');
    }
    if (masksWithMaterials.length === 0 && Object.keys(masks).length > 0) {
      issues.push('Masks without materials');
    }
    if (Object.keys(quotes).length === 0 && masksWithMaterials.length > 0) {
      issues.push('No quotes generated');
    }

    return {
      overallCompletion,
      healthStatus,
      healthScore,
      issues,
      metrics: {
        totalPhotos: currentProject.photos.length,
        photosWithCanvasWork: photosWithCanvasWork.length,
        totalMasks: Object.keys(masks).length,
        masksWithMaterials: masksWithMaterials.length,
        totalQuotes: Object.keys(quotes).length,
        activeQuotes: activeQuotes.length,
        estimatedValue: projectSummary?.totalCost || 0,
        lastActivity: analytics?.lastActivity || currentProject.lastModified
      }
    };
  }, [currentProject, masks, quotes, analytics, projectSummary]);

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'good': return 'text-primary bg-primary/5 border-primary/20';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'good': return <TrendingUp className="w-5 h-5 text-primary" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-primary';
    if (percentage >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (!currentProject || !healthMetrics) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Project Health
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600">No project data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall Health Status */}
      <Card className={`border-2 ${getHealthColor(healthMetrics.healthStatus)}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {getHealthIcon(healthMetrics.healthStatus)}
              Project Health
            </CardTitle>
            <Badge className={getHealthColor(healthMetrics.healthStatus)}>
              {healthMetrics.healthStatus.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">Overall Progress</span>
              <span className="font-semibold">{healthMetrics.overallCompletion}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-500 ${getProgressColor(healthMetrics.overallCompletion)}`}
                style={{ width: `${healthMetrics.overallCompletion}%` }}
              ></div>
            </div>
          </div>

          {/* Health Score */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Health Score</span>
            <div className="flex items-center gap-2">
              <div className="w-16 bg-slate-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(healthMetrics.healthScore)}`}
                  style={{ width: `${healthMetrics.healthScore}%` }}
                ></div>
              </div>
              <span className="text-sm font-semibold">{healthMetrics.healthScore}/100</span>
            </div>
          </div>

          {/* Issues */}
          {healthMetrics.issues.length > 0 && (
            <div className="pt-2 border-t border-slate-200">
              <div className="text-sm font-medium text-slate-700 mb-2">Issues to Address</div>
              <div className="space-y-1">
                {healthMetrics.issues.map((issue, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <PieChart className="w-5 h-5 text-primary" />
            Detailed Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Photos Progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium">Photos & Canvas Work</span>
              <span className="text-slate-600">
                {healthMetrics.metrics.photosWithCanvasWork}/{healthMetrics.metrics.totalPhotos}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${healthMetrics.metrics.totalPhotos > 0 
                    ? (healthMetrics.metrics.photosWithCanvasWork / healthMetrics.metrics.totalPhotos) * 100 
                    : 0}%` 
                }}
              ></div>
            </div>
          </div>

          {/* Masks Progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium">Masks with Materials</span>
              <span className="text-slate-600">
                {healthMetrics.metrics.masksWithMaterials}/{healthMetrics.metrics.totalMasks}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${healthMetrics.metrics.totalMasks > 0 
                    ? (healthMetrics.metrics.masksWithMaterials / healthMetrics.metrics.totalMasks) * 100 
                    : 0}%` 
                }}
              ></div>
            </div>
          </div>

          {/* Quotes Progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium">Active Quotes</span>
              <span className="text-slate-600">
                {healthMetrics.metrics.activeQuotes}/{healthMetrics.metrics.totalQuotes}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${healthMetrics.metrics.totalQuotes > 0 
                    ? (healthMetrics.metrics.activeQuotes / healthMetrics.metrics.totalQuotes) * 100 
                    : 0}%` 
                }}
              ></div>
            </div>
          </div>

          {/* Financial Health */}
          {healthMetrics.metrics.estimatedValue > 0 && (
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Estimated Value</span>
                <span className="font-semibold text-green-600">
                  ${healthMetrics.metrics.estimatedValue.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Last Activity */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Activity className="w-4 h-4" />
              <span>
                Last activity: {formatDistanceToNow(healthMetrics.metrics.lastActivity, { addSuffix: true })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Health Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-green-600" />
            Health Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {healthMetrics.issues.length === 0 ? (
            <div className="text-center py-4">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-green-600 font-medium">Project is healthy!</p>
              <p className="text-xs text-slate-500 mt-1">All key metrics are on track</p>
            </div>
          ) : (
            <div className="space-y-2">
              {healthMetrics.issues.map((issue, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-blue-500" />
                  <span className="text-slate-700">
                    {issue === 'No photos uploaded' && 'Upload project photos to get started'}
                    {issue === 'No masks created' && 'Create masks to define work areas'}
                    {issue === 'Masks without materials' && 'Assign materials to masks for accurate costing'}
                    {issue === 'No quotes generated' && 'Generate quotes to finalize project estimates'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
