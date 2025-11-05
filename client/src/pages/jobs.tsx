import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Search, 
  User, 
  MapPin, 
  Phone, 
  Mail,
  Calendar,
  FileText,
  Plus,
  Filter,
  Camera,
  Edit,
  Trash2,
  MoreHorizontal,
  Palette,
  CheckCircle,
  Clock,
  AlertCircle,
  FolderOpen
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { JobCardSkeleton } from "@/components/ui/skeleton-variants";
import { formatDistanceToNow } from "date-fns";

export default function Jobs() {
  const [, params] = useRoute('/jobs/:id');
  const [, navigate] = useLocation();
  const jobId = params?.id;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: orgs = [] } = useQuery({
    queryKey: ['/api/me/orgs'],
    queryFn: () => apiClient.getMyOrgs(),
  });

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['/api/jobs', selectedOrgId],
    queryFn: () => selectedOrgId ? apiClient.getJobs(selectedOrgId) : Promise.resolve([]),
    enabled: !!selectedOrgId,
  });

  // Fetch photos and canvas work status for each job
  const { data: jobsWithCanvasStatus = [], isLoading: isLoadingCanvasStatus } = useQuery({
    queryKey: ['/api/jobs/canvas-status', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      
      const jobsWithStatus = await Promise.all(
        jobs.map(async (job) => {
          try {
            const photos = await apiClient.getJobPhotos(job.id);
            const photosWithCanvasWork = photos.filter(photo => photo.canvasState);
            
            return {
              ...job,
              photos,
              photosWithCanvasWork,
              canvasWorkProgress: {
                totalPhotos: photos.length,
                photosWithCanvasWork: photosWithCanvasWork.length,
                completionPercentage: photos.length > 0 ? Math.round((photosWithCanvasWork.length / photos.length) * 100) : 0,
                lastCanvasWork: photosWithCanvasWork.length > 0 
                  ? Math.max(...photosWithCanvasWork.map(p => new Date(p.lastModified || p.uploadedAt).getTime()))
                  : null
              }
            };
          } catch (error) {
            console.warn(`Failed to fetch canvas status for job ${job.id}:`, error);
            return {
              ...job,
              photos: [],
              photosWithCanvasWork: [],
              canvasWorkProgress: {
                totalPhotos: 0,
                photosWithCanvasWork: 0,
                completionPercentage: 0,
                lastCanvasWork: null
              }
            };
          }
        })
      );
      
      return jobsWithStatus;
    },
    enabled: !!selectedOrgId && jobs.length > 0,
  });

  // Auto-select first org if available
  if (!selectedOrgId && orgs.length > 0) {
    setSelectedOrgId(orgs[0].id);
  }

  const filteredJobs = jobsWithCanvasStatus.filter(job =>
    job.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'estimating': return 'bg-yellow-100 text-yellow-800';
      case 'sent': return 'bg-purple-100 text-purple-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'scheduled': return 'bg-indigo-100 text-indigo-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCanvasWorkStatus = (job: any) => {
    const { canvasWorkProgress } = job;
    
    if (canvasWorkProgress.totalPhotos === 0) {
      return { 
        status: 'no-photos', 
        label: 'No Photos', 
        color: 'text-slate-400',
        icon: Camera 
      };
    }
    
    if (canvasWorkProgress.completionPercentage === 100) {
      return { 
        status: 'complete', 
        label: 'Canvas Complete', 
        color: 'text-green-600',
        icon: CheckCircle 
      };
    }
    
    if (canvasWorkProgress.completionPercentage > 0) {
      return { 
        status: 'in-progress', 
        label: `${canvasWorkProgress.completionPercentage}% Complete`, 
        color: 'text-blue-600',
        icon: Clock 
      };
    }
    
    return { 
      status: 'not-started', 
      label: 'Not Started', 
      color: 'text-orange-600',
      icon: AlertCircle 
    };
  };

  // If viewing a specific job (redirect to job detail)
  if (jobId) {
    navigate(`/jobs/${jobId}`);
    return null;
  }

  // Jobs list view
  return (
    <div className="bg-slate-50">      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">
              Jobs
            </h1>
            <p className="text-slate-600 mt-1">
              Manage and track your pool renovation projects
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" data-testid="button-filters">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            
            <Button onClick={() => navigate('/jobs/new')} data-testid="button-new-job">
              <Plus className="w-4 h-4 mr-2" />
              New Job
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search jobs by client or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-jobs"
            />
          </div>
          
          {orgs.length > 1 && (
            <select
              value={selectedOrgId || ''}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
              data-testid="select-organization"
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Jobs</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="stat-total-jobs">
                    {jobs.length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">In Progress</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="stat-in-progress">
                    {jobs.filter(j => ['estimating', 'sent'].includes(j.status)).length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Accepted</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="stat-accepted">
                    {jobs.filter(j => j.status === 'accepted').length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Canvas Work</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="stat-canvas-work">
                    {jobsWithCanvasStatus.filter(j => j.canvasWorkProgress.photosWithCanvasWork > 0).length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Palette className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Completed</p>
                  <p className="text-2xl font-bold text-slate-900" data-testid="stat-completed">
                    {jobs.filter(j => j.status === 'completed').length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Jobs List */}
        <Card>
          <CardHeader className="border-b border-slate-200">
            <CardTitle>Recent Jobs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y divide-slate-100">
                {[1, 2, 3].map((i) => (
                  <JobCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredJobs.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title={searchTerm ? "No jobs found" : "No jobs yet"}
                description={searchTerm 
                  ? "No jobs match your search criteria. Try adjusting your filters." 
                  : "Get started by creating your first job. Track projects, manage photos, and generate quotes all in one place."}
                primaryAction={!searchTerm ? {
                  label: "Create Your First Job",
                  onClick: () => navigate('/jobs/new'),
                  icon: Plus
                } : undefined}
                secondaryAction={searchTerm ? {
                  label: "Clear search",
                  onClick: () => setSearchTerm(''),
                  variant: 'button'
                } : undefined}
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredJobs.map((job) => {
                  const canvasStatus = getCanvasWorkStatus(job);
                  const StatusIcon = canvasStatus.icon;
                  
                  // Determine which badges to show
                  // Clean logic: avoid redundant badges when job has started
                  const hasPhotos = job.canvasWorkProgress.totalPhotos > 0;
                  const canvasWorkActive = canvasStatus.status === 'in-progress' || canvasStatus.status === 'complete';
                  
                  // Show canvas badge if there are photos and status is meaningful
                  const shouldShowCanvasBadge = hasPhotos && canvasStatus.status !== 'no-photos';
                  
                  // Show job status badge only if:
                  // - Canvas work is active (show canvas status instead), OR
                  // - Job is "new" AND has photos with "Not Started" canvas (avoid redundancy), OR
                  // - Job is not "new" (always show meaningful statuses like "estimating", "accepted", etc.)
                  const isRedundant = job.status === 'new' && hasPhotos && canvasStatus.status === 'not-started';
                  const shouldShowJobStatus = !canvasWorkActive && !isRedundant;
                  
                  return (
                    <div 
                      key={job.id}
                      className="p-6 hover:bg-slate-50 transition-colors"
                      data-testid={`job-item-${job.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-slate-900" data-testid={`text-client-name-${job.id}`}>
                              {job.clientName}
                            </h3>
                            {shouldShowJobStatus && (
                              <Badge 
                                className={`text-xs ${getStatusColor(job.status)}`}
                                data-testid={`badge-status-${job.id}`}
                              >
                                {job.status}
                              </Badge>
                            )}
                            {shouldShowCanvasBadge && (
                              <Badge 
                                variant="outline"
                                className={`text-xs ${canvasStatus.color}`}
                                data-testid={`badge-canvas-status-${job.id}`}
                              >
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {canvasStatus.label}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                            {job.address && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                <span data-testid={`text-address-${job.id}`}>{job.address}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span data-testid={`text-created-${job.id}`}>
                                {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            
                            {job.canvasWorkProgress.lastCanvasWork && (
                              <div className="flex items-center gap-1">
                                <Palette className="w-4 h-4" />
                                <span>
                                  Last canvas work: {formatDistanceToNow(new Date(job.canvasWorkProgress.lastCanvasWork), { addSuffix: true })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Quick Canvas Edit Button */}
                          {job.photos.length > 0 && (
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                const firstPhoto = job.photos[0];
                                navigate(`/jobs/${job.id}/photo/${firstPhoto.id}/edit-canvas`);
                              }}
                              data-testid={`button-edit-canvas-${job.id}`}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <Palette className="w-4 h-4 mr-1" />
                              Edit Canvas
                              {job.photos.length > 1 && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  {job.photos.length} photos
                                </Badge>
                              )}
                            </Button>
                          )}
                          
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/jobs/${job.id}`);
                            }}
                            data-testid={`button-view-job-${job.id}`}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              // TODO: Add job menu functionality
                            }}
                            data-testid={`button-job-menu-${job.id}`}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
