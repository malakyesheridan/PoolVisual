/**
 * Material Usage Panel
 * Displays material usage tracking for the current project
 */

import React from 'react';
import { useMaterialUsageStore } from '../../stores/materialUsageStore';
import { useProjectStore } from '../../stores/projectStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Package, 
  TrendingUp, 
  DollarSign, 
  MapPin, 
  Calendar,
  RefreshCw,
  Download,
  Eye
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MaterialUsagePanelProps {
  className?: string;
}

export function MaterialUsagePanel({ className = '' }: MaterialUsagePanelProps) {
  const { 
    projectSummaries, 
    getProjectMaterialSummary, 
    getMaterialUsageByProject 
  } = useMaterialUsageStore();
  
  const { project, currentPhoto } = useProjectStore();

  if (!project) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="text-center text-gray-500 py-8">
          <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No project context available</p>
        </div>
      </div>
    );
  }

  const projectSummary = getProjectMaterialSummary(project.id);
  const projectUsages = getMaterialUsageByProject(project.id);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatArea = (area: number) => {
    return `${area.toFixed(2)} m²`;
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Material Usage</h3>
          <p className="text-xs text-gray-500 mt-1">
            Project: {project.name}
          </p>
        </div>
        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="sm" className="h-6 px-2">
            <RefreshCw className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2">
            <Download className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {!projectSummary ? (
        <div className="text-center text-gray-500 py-6">
          <Package className="w-6 h-6 mx-auto mb-2 text-gray-300" />
          <p className="text-xs">No material usage tracked yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Assign materials to masks to start tracking usage
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/5 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-primary font-medium">Total Materials</p>
                  <p className="text-lg font-bold text-primary">
                    {projectSummary.totalMaterials}
                  </p>
                </div>
                <Package className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 font-medium">Total Cost</p>
                  <p className="text-lg font-bold text-green-900">
                    {formatCurrency(projectSummary.totalCost)}
                  </p>
                </div>
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </div>

          {/* Material Breakdown */}
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-2">Material Breakdown</h4>
            <div className="space-y-2">
              {Object.entries(projectSummary.materialBreakdown).map(([materialId, breakdown]) => (
                <div key={materialId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-900">
                        {breakdown.materialName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {breakdown.usageCount} uses
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{formatArea(breakdown.totalArea)}</span>
                      <span>{formatCurrency(breakdown.totalCost)}</span>
                      <span>{breakdown.photos.length} photos</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 px-2">
                    <Eye className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Usage */}
          {projectUsages.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-2">Recent Usage</h4>
              <div className="space-y-1">
                {projectUsages
                  .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
                  .slice(0, 3)
                  .map((usage) => (
                    <div key={usage.maskId} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                      <div>
                        <span className="font-medium text-gray-900">{usage.materialName}</span>
                        <span className="text-gray-500 ml-2">in {usage.maskName}</span>
                      </div>
                      <div className="text-gray-500">
                        {formatDistanceToNow(usage.lastModified, { addSuffix: true })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Last Updated */}
          <div className="text-xs text-gray-400 text-center pt-2 border-t">
            Last updated: {formatDistanceToNow(projectSummary.lastUpdated, { addSuffix: true })}
          </div>
        </div>
      )}
    </div>
  );
}
