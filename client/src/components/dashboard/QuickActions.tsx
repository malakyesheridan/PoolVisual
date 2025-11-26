/**
 * Quick Actions Component
 * Provides one-click access to common project tasks
 */

import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useProjectStore } from '../../stores/projectStore';
import { useMaskStore } from '../../maskcore/store';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Zap,
  Palette,
  FileText,
  Package,
  User,
  Camera,
  Plus,
  Download,
  Share2,
  Settings,
  Eye,
  Edit,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface QuickActionsProps {
  className?: string;
  projectId?: string;
}

export function QuickActions({ className = '', projectId }: QuickActionsProps) {
  const [, navigate] = useLocation();
  const { project } = useProjectStore();
  const { masks, quotes } = useMaskStore();
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);

  const currentProject = projectId ? project : project;

  // Calculate project stats
  const projectStats = React.useMemo(() => {
    if (!currentProject) return null;

    const masksWithMaterials = Object.values(masks).filter(mask => 
      mask.materialId && mask.isVisible !== false
    );
    const activeQuotes = Object.values(quotes).filter(quote => 
      quote.status !== 'draft'
    );

    return {
      totalPhotos: currentProject.photos.length,
      photosWithCanvasWork: currentProject.photos.filter(photo => 
        currentProject.canvasStates[photo.id]
      ).length,
      totalMasks: Object.keys(masks).length,
      masksWithMaterials: masksWithMaterials.length,
      totalQuotes: Object.keys(quotes).length,
      activeQuotes: activeQuotes.length,
      completionPercentage: currentProject.photos.length > 0 
        ? Math.round((currentProject.photos.filter(photo => 
            currentProject.canvasStates[photo.id]
          ).length / currentProject.photos.length) * 100)
        : 0
    };
  }, [currentProject, masks, quotes]);

  const handleGenerateQuote = async () => {
    if (!currentProject) return;
    
    setIsGeneratingQuote(true);
    try {
      // Navigate to quotes page with auto-generation
      navigate(`/jobs/${currentProject.jobId}/quotes?auto-generate=true`);
    } catch (error) {
      console.error('Failed to generate quote:', error);
    } finally {
      setIsGeneratingQuote(false);
    }
  };

  const handleOpenCanvasEditor = () => {
    if (!currentProject || !currentProject.photos.length) return;
    
    const firstPhoto = currentProject.photos[0];
    navigate(`/jobs/${currentProject.jobId}/photo/${firstPhoto.id}/edit`);
  };

  const handleContactClient = (method: 'email' | 'phone') => {
    if (!currentProject) return;
    
    if (method === 'email' && currentProject.client.email) {
      window.open(`mailto:${currentProject.client.email}`, '_blank');
    } else if (method === 'phone' && currentProject.client.phone) {
      window.open(`tel:${currentProject.client.phone}`, '_blank');
    }
  };

  const handleViewProject = () => {
    if (!currentProject) return;
    navigate(`/jobs/${currentProject.jobId}`);
  };

  const handleEditProject = () => {
    if (!currentProject) return;
    navigate(`/jobs/${currentProject.jobId}/edit`);
  };

  const handleManageMaterials = () => {
    navigate('/library');
  };

  const handleAddPhoto = () => {
    if (!currentProject) return;
    navigate(`/jobs/${currentProject.jobId}/photos/add`);
  };

  const handleExportProject = () => {
    if (!currentProject) return;
    // TODO: Implement project export functionality
    console.log('Export project:', currentProject.id);
  };

  const handleShareProject = () => {
    if (!currentProject) return;
    // TODO: Implement project sharing functionality
    console.log('Share project:', currentProject.id);
  };

  if (!currentProject) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 mb-4">No project loaded</p>
          <Button onClick={() => navigate('/jobs')} variant="outline">
            Browse Projects
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            Quick Actions
          </CardTitle>
          {projectStats && (
            <Badge variant="secondary" className="text-xs">
              {projectStats.completionPercentage}% Complete
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Primary Actions */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Primary Actions</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              size="sm"
              onClick={handleOpenCanvasEditor}
              disabled={!currentProject.photos.length}
            >
              <Palette className="w-4 h-4 mr-2" />
              Canvas Editor
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              size="sm"
              onClick={handleGenerateQuote}
              disabled={isGeneratingQuote || !projectStats?.masksWithMaterials}
            >
              {isGeneratingQuote ? (
                <Clock className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Generate Quote
            </Button>
          </div>
        </div>

        {/* Project Management */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Project Management</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              size="sm"
              onClick={handleViewProject}
            >
              <Eye className="w-4 h-4 mr-2" />
              View Project
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              size="sm"
              onClick={handleEditProject}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Project
            </Button>
          </div>
        </div>

        {/* Client Communication */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Client Communication</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              size="sm"
              onClick={() => handleContactClient('email')}
              disabled={!currentProject.client.email}
            >
              <Mail className="w-4 h-4 mr-2" />
              Email Client
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              size="sm"
              onClick={() => handleContactClient('phone')}
              disabled={!currentProject.client.phone}
            >
              <Phone className="w-4 h-4 mr-2" />
              Call Client
            </Button>
          </div>
        </div>

        {/* Resources */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Resources</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              size="sm"
              onClick={handleManageMaterials}
            >
              <Package className="w-4 h-4 mr-2" />
              Library
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              size="sm"
              onClick={handleAddPhoto}
            >
              <Camera className="w-4 h-4 mr-2" />
              Add Photo
            </Button>
          </div>
        </div>

        {/* Project Stats */}
        {projectStats && (
          <div className="pt-3 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Project Status</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Photos:</span>
                <span className="font-medium">{projectStats.totalPhotos}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Canvas Work:</span>
                <span className="font-medium text-primary">{projectStats.photosWithCanvasWork}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Masks:</span>
                <span className="font-medium">{projectStats.totalMasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Quotes:</span>
                <span className="font-medium text-purple-600">{projectStats.totalQuotes}</span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Progress</span>
                <span>{projectStats.completionPercentage}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${projectStats.completionPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Additional Actions */}
        <div className="pt-3 border-t border-slate-200">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="ghost" 
              className="w-full justify-start" 
              size="sm"
              onClick={handleExportProject}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start" 
              size="sm"
              onClick={handleShareProject}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
