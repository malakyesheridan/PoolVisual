/**
 * Recent Work Component
 * Displays recent canvas work, photos, and project activities
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useProjectStore, ProjectActivity } from '../../stores/projectStore';
import { useMaskStore } from '../../maskcore/store';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Clock,
  Calendar,
  User,
  Palette,
  Camera,
  FileText,
  Package,
  MapPin,
  Eye,
  Edit,
  Download,
  Share2,
  Activity,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RecentWorkProps {
  className?: string;
  projectId?: string;
  maxItems?: number;
}

interface RecentWorkItem {
  id: string;
  type: 'canvas_work' | 'photo_upload' | 'mask_creation' | 'quote_generation' | 'material_assignment' | 'project_update';
  title: string;
  description: string;
  timestamp: Date;
  photoId?: string;
  maskId?: string;
  quoteId?: string;
  projectId: string;
  thumbnail?: string;
  status?: 'completed' | 'in_progress' | 'pending';
}

export function RecentWork({ className = '', projectId, maxItems = 10 }: RecentWorkProps) {
  const [, navigate] = useLocation();
  const { project, getProjectActivities } = useProjectStore();
  const { masks, quotes } = useMaskStore();
  const [filterType, setFilterType] = useState<'all' | 'canvas' | 'photos' | 'quotes'>('all');
  const [isLoading, setIsLoading] = useState(false);

  const currentProject = projectId ? project : project;

  // Generate recent work items from project data
  const recentWorkItems = React.useMemo(() => {
    if (!currentProject) return [];

    const items: RecentWorkItem[] = [];

    // Add recent photos with canvas work
    currentProject.photos
      .filter(photo => currentProject.canvasStates[photo.id])
      .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime())
      .slice(0, 5)
      .forEach(photo => {
        const canvasState = currentProject.canvasStates[photo.id];
        items.push({
          id: `canvas-${photo.id}`,
          type: 'canvas_work',
          title: `Canvas Work: ${photo.name}`,
          description: `Updated ${formatDistanceToNow(new Date(photo.lastModified || photo.uploadedAt), { addSuffix: true })}`,
          timestamp: new Date(photo.lastModified || photo.uploadedAt),
          photoId: photo.id,
          projectId: currentProject.id,
          status: 'completed'
        });
      });

    // Add recent photos without canvas work
    currentProject.photos
      .filter(photo => !currentProject.canvasStates[photo.id])
      .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime())
      .slice(0, 3)
      .forEach(photo => {
        items.push({
          id: `photo-${photo.id}`,
          type: 'photo_upload',
          title: `Photo Uploaded: ${photo.name}`,
          description: `Uploaded ${formatDistanceToNow(new Date(photo.uploadedAt), { addSuffix: true })}`,
          timestamp: new Date(photo.uploadedAt),
          photoId: photo.id,
          projectId: currentProject.id,
          status: 'completed'
        });
      });

    // Add recent masks
    Object.values(masks)
      .sort((a, b) => (b.lastModified || b.createdAt) - (a.lastModified || a.createdAt))
      .slice(0, 5)
      .forEach(mask => {
        items.push({
          id: `mask-${mask.id}`,
          type: 'mask_creation',
          title: `Mask Created: ${mask.name}`,
          description: mask.materialId 
            ? `Material assigned: ${mask.materialId}`
            : 'No material assigned yet',
          timestamp: new Date(mask.lastModified || mask.createdAt),
          maskId: mask.id,
          projectId: currentProject.id,
          status: mask.materialId ? 'completed' : 'pending'
        });
      });

    // Add recent quotes
    Object.values(quotes)
      .sort((a, b) => (b.lastModified || b.createdAt) - (a.lastModified || a.createdAt))
      .slice(0, 3)
      .forEach(quote => {
        items.push({
          id: `quote-${quote.id}`,
          type: 'quote_generation',
          title: `Quote Generated: ${quote.name}`,
          description: `Status: ${quote.status} • ${quote.items.length} items`,
          timestamp: new Date(quote.lastModified || quote.createdAt),
          quoteId: quote.id,
          projectId: currentProject.id,
          status: quote.status === 'draft' ? 'pending' : 'completed'
        });
      });

    // Sort all items by timestamp and limit
    return items
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, maxItems);
  }, [currentProject, masks, quotes, maxItems]);

  // Filter items based on selected filter
  const filteredItems = React.useMemo(() => {
    if (filterType === 'all') return recentWorkItems;
    
    return recentWorkItems.filter(item => {
      switch (filterType) {
        case 'canvas': return item.type === 'canvas_work';
        case 'photos': return item.type === 'photo_upload';
        case 'quotes': return item.type === 'quote_generation';
        default: return true;
      }
    });
  }, [recentWorkItems, filterType]);

  const getItemIcon = (item: RecentWorkItem) => {
    switch (item.type) {
      case 'canvas_work': return <Palette className="w-4 h-4 text-purple-500" />;
      case 'photo_upload': return <Camera className="w-4 h-4 text-blue-500" />;
      case 'mask_creation': return <Package className="w-4 h-4 text-green-500" />;
      case 'quote_generation': return <FileText className="w-4 h-4 text-orange-500" />;
      case 'material_assignment': return <Package className="w-4 h-4 text-indigo-500" />;
      case 'project_update': return <Activity className="w-4 h-4 text-gray-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'in_progress': return <Clock className="w-3 h-3 text-blue-500" />;
      case 'pending': return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
      default: return <Info className="w-3 h-3 text-gray-500" />;
    }
  };

  const handleItemClick = (item: RecentWorkItem) => {
    if (item.photoId) {
      navigate(`/jobs/${currentProject?.jobId}/photo/${item.photoId}/edit`);
    } else if (item.maskId) {
      // Navigate to canvas editor with mask selected
      const firstPhoto = currentProject?.photos[0];
      if (firstPhoto) {
        navigate(`/jobs/${currentProject.jobId}/photo/${firstPhoto.id}/edit?selectMask=${item.maskId}`);
      }
    } else if (item.quoteId) {
      navigate(`/jobs/${currentProject?.jobId}/quotes`);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Work
            {filteredItems.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filteredItems.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {['all', 'canvas', 'photos', 'quotes'].map((type) => (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType(type as any)}
                  className="text-xs capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh"
            >
              <TrendingUp className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-sm font-medium">No recent work</p>
            <p className="text-xs text-slate-400 mt-1">
              {filterType === 'all' 
                ? 'Recent work will appear here as you work on projects'
                : `No ${filterType} work found`
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => handleItemClick(item)}
              >
                <div className="flex-shrink-0 mt-1">
                  {getItemIcon(item)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium text-slate-900 truncate">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {getStatusIcon(item.status)}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatDistanceToNow(item.timestamp, { addSuffix: true })}</span>
                    {item.projectId && (
                      <span>• Project: {item.projectId.slice(-8)}</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Eye className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {filteredItems.length > 0 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredItems.length} recent items</span>
              <Button variant="ghost" size="sm" className="text-xs h-6">
                View All
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
