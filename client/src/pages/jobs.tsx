import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  FolderOpen,
  Eye
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
  const queryClient = useQueryClient();

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
            
            // Check for masks on each photo to determine canvas work
            const photosWithCanvasWork = await Promise.all(
              photos.map(async (photo) => {
                try {
                  const masks = await apiClient.getMasks(photo.id);
                  return masks.length > 0 ? { ...photo, maskCount: masks.length } : null;
                } catch (error) {
                  console.warn(`Failed to fetch masks for photo ${photo.id}:`, error);
                  return null;
                }
              })
            );
            
            const validPhotosWithWork = photosWithCanvasWork.filter(p => p !== null);
            
            // Get the most recent mask creation date for lastCanvasWork
            let lastCanvasWork: number | null = null;
            for (const photo of validPhotosWithWork) {
              try {
                const masks = await apiClient.getMasks(photo!.id);
                if (masks.length > 0) {
                  const maxCreatedAt = Math.max(...masks.map(m => new Date(m.createdAt || 0).getTime()));
                  if (maxCreatedAt > 0 && (!lastCanvasWork || maxCreatedAt > lastCanvasWork)) {
                    lastCanvasWork = maxCreatedAt;
                  }
                }
              } catch (error) {
                // Ignore errors for individual photos
              }
            }
            
            return {
              ...job,
              photos,
              photosWithCanvasWork: validPhotosWithWork,
              canvasWorkProgress: {
                totalPhotos: photos.length,
                photosWithCanvasWork: validPhotosWithWork.length,
                completionPercentage: photos.length > 0 ? Math.round((validPhotosWithWork.length / photos.length) * 100) : 0,
                lastCanvasWork: lastCanvasWork
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

  // Calculate job health indicator (green if no issues, yellow/red if there are)
  const hasOverdueJobs = filteredJobs.some(job => {
    // Consider jobs that are in progress but haven't been updated in a while as potentially overdue
    const isActive = ['estimating', 'sent', 'accepted', 'scheduled'].includes(job.status);
    if (!isActive) return false;
    
    const lastUpdate = job.canvasWorkProgress.lastCanvasWork 
      ? new Date(job.canvasWorkProgress.lastCanvasWork)
      : new Date(job.createdAt);
    const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Consider overdue if active job hasn't been updated in 30+ days
    return daysSinceUpdate > 30;
  });

  const jobHealthStatus = hasOverdueJobs ? 'warning' : 'healthy';

  // Mutation to update job status
  const updateJobStatusMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: string; status: string }) => {
      return apiClient.updateJob(jobId, { status });
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Job Updated",
        description: `Job status updated to ${variables.status}.`,
      });
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/canvas-status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update job status",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'estimating': return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
      case 'sent': return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'accepted': return 'bg-green-50 text-green-700 border border-green-200';
      case 'declined': return 'bg-red-50 text-red-700 border border-red-200';
      case 'scheduled': return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      case 'completed': return 'bg-gray-50 text-gray-700 border border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border border-gray-200';
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
    
    // If we have photos but no canvas work yet, the job has been started
    // (photos are uploaded), so show "Started" instead of "Not Started"
    return { 
      status: 'started', 
      label: 'Started', 
      color: 'text-blue-600',
      icon: Clock 
    };
  };

  // If viewing a specific job (redirect to job detail)
  if (jobId) {
    navigate(`/jobs/${jobId}`);
    return null;
  }

  // Jobs list view
  return (
    <div className="min-h-screen bg-[#F6F7F9] px-8 py-6">
      {/* Jobs Header Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900" data-testid="text-page-title">
              Jobs
            </h1>
          <div className={`w-1.5 h-1.5 rounded-full ${
            jobHealthStatus === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
          }`} aria-label={jobHealthStatus === 'healthy' ? 'All jobs healthy' : 'Some jobs need attention'} />
          </div>
          
        <Button 
          onClick={() => navigate('/jobs/new')} 
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 h-9 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          data-testid="button-new-job"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Job
            </Button>
        </div>

      <div className="max-w-6xl mx-auto w-full px-6">
        {/* Search + Filters Strip */}
        <div className="mb-6 rounded-2xl bg-white shadow-sm border border-slate-100 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search jobs by client or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-full border border-slate-200 bg-slate-50 focus:bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 transition-all duration-150"
              data-testid="input-search-jobs"
              aria-label="Search jobs"
            />
          </div>
          
          {orgs.length > 1 && (
            <select
              value={selectedOrgId || ''}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="px-3 py-1.5 h-9 border border-slate-200 rounded-full bg-white text-sm text-slate-900 focus:border-blue-500 focus:ring-blue-500 transition-all duration-150"
              data-testid="select-organization"
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
          
          <Button 
            variant="outline" 
            size="sm"
            className="rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 px-3 py-1.5 flex items-center gap-2 transition-all duration-150"
            data-testid="button-filters"
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
          </Button>
        </div>

        {/* Metrics Row - Compact Stat Chips */}
        <div className="mb-6 rounded-2xl bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] border border-slate-100 px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div className="rounded-xl bg-slate-50/70 hover:bg-slate-100 transition-colors px-3 py-2 flex items-center gap-3 cursor-default">
              <div className="rounded-full bg-white shadow-sm w-8 h-8 flex items-center justify-center text-slate-500 flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <p className="text-base font-semibold text-slate-900 leading-none" data-testid="stat-total-jobs">
                    {jobs.length}
                  </p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Total</p>
                </div>
                </div>
            
            <div className="rounded-xl bg-slate-50/70 hover:bg-slate-100 transition-colors px-3 py-2 flex items-center gap-3 cursor-default">
              <div className="rounded-full bg-white shadow-sm w-8 h-8 flex items-center justify-center text-slate-500 flex-shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <p className="text-base font-semibold text-slate-900 leading-none" data-testid="stat-in-progress">
                    {jobs.filter(j => ['estimating', 'sent'].includes(j.status)).length}
                  </p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">In Progress</p>
                </div>
                </div>
            
            <div className="rounded-xl bg-slate-50/70 hover:bg-slate-100 transition-colors px-3 py-2 flex items-center gap-3 cursor-default">
              <div className="rounded-full bg-white shadow-sm w-8 h-8 flex items-center justify-center text-slate-500 flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <p className="text-base font-semibold text-slate-900 leading-none" data-testid="stat-accepted">
                    {jobs.filter(j => j.status === 'accepted').length}
                  </p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Accepted</p>
                </div>
                </div>
            
            <div className="rounded-xl bg-slate-50/70 hover:bg-slate-100 transition-colors px-3 py-2 flex items-center gap-3 cursor-default">
              <div className="rounded-full bg-white shadow-sm w-8 h-8 flex items-center justify-center text-slate-500 flex-shrink-0">
                <Palette className="w-4 h-4" />
              </div>
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <p className="text-base font-semibold text-slate-900 leading-none" data-testid="stat-canvas-work">
                    {jobsWithCanvasStatus.filter(j => j.canvasWorkProgress.photosWithCanvasWork > 0).length}
                  </p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Canvas Work</p>
                </div>
                </div>
            
            <div className="rounded-xl bg-slate-50/70 hover:bg-slate-100 transition-colors px-3 py-2 flex items-center gap-3 cursor-default">
              <div className="rounded-full bg-white shadow-sm w-8 h-8 flex items-center justify-center text-slate-500 flex-shrink-0">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <p className="text-base font-semibold text-slate-900 leading-none" data-testid="stat-completed">
                    {jobs.filter(j => j.status === 'completed').length}
                  </p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Jobs Section - Clean Card */}
        <section className="mt-6 rounded-2xl bg-white border border-slate-200 shadow-[0_10px_30px_rgba(15,23,42,0.04)] overflow-hidden">
          {/* Header Row */}
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-sm font-semibold text-slate-900">Recent Jobs</h2>
            <p className="text-xs text-slate-500">Your most recent activity</p>
          </div>
          
          {/* Jobs List - Timeline List */}
          <div className="divide-y divide-slate-100">
            {isLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-4 py-3">
                    <JobCardSkeleton />
                  </div>
                ))}
              </>
            ) : filteredJobs.length === 0 ? (
              <div className="flex items-center justify-center min-h-[280px] px-6 py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FolderOpen className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1.5">
                    {searchTerm ? "No jobs found" : "No jobs yet"}
                  </h3>
                  <p className="text-sm text-gray-600 mb-5 max-w-md mx-auto">
                    {searchTerm 
                  ? "No jobs match your search criteria. Try adjusting your filters." 
                  : "Get started by creating your first job. Track projects, manage photos, and generate quotes all in one place."}
                  </p>
                  {!searchTerm ? (
                    <Button
                      onClick={() => navigate('/jobs/new')}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 h-9 text-sm font-medium transition-all duration-150"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Create Your First Job
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setSearchTerm('')}
                      className="border-gray-200 hover:bg-gray-50 rounded-lg px-3 py-1.5 h-9 text-sm transition-all duration-150"
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {filteredJobs.map((job, index) => {
                  const canvasStatus = getCanvasWorkStatus(job);
                  const StatusIcon = canvasStatus.icon;
                  
                  // Determine which badges to show
                  const hasPhotos = job.canvasWorkProgress.totalPhotos > 0;
                  const canvasWorkActive = canvasStatus.status === 'in-progress' || canvasStatus.status === 'complete' || canvasStatus.status === 'started';
                  const shouldShowCanvasBadge = hasPhotos && canvasStatus.status !== 'no-photos';
                  // Don't show job status badge if canvas work is active (started, in-progress, or complete)
                  const shouldShowJobStatus = !canvasWorkActive;
                  
                  return (
                    <div 
                      key={job.id}
                      className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                      data-testid={`job-item-${job.id}`}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    >
                      {/* Left Side: Timeline + Job Info */}
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        {/* Timeline Column */}
                        <div className="flex flex-col items-center pt-1 flex-shrink-0">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                          <div className="flex-1 w-px bg-slate-200"></div>
                        </div>
                        
                        {/* Job Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-medium text-slate-900 truncate" data-testid={`text-client-name-${job.id}`}>
                              {job.clientName}
                            </h3>
                            {shouldShowJobStatus && (
                              <Badge 
                                className={`inline-flex items-center gap-1 rounded-full text-xs font-medium px-2 py-0.5 ${job.status === 'estimating' ? getStatusColor(job.status).replace('text-yellow-700', 'text-orange-600/90') : getStatusColor(job.status)}`}
                                data-testid={`badge-status-${job.id}`}
                              >
                                {job.status}
                              </Badge>
                            )}
                            {shouldShowCanvasBadge && (
                              <Badge 
                                variant="outline"
                                className={`inline-flex items-center gap-1 rounded-full text-xs font-medium px-2 py-0.5 border-slate-200 ${canvasStatus.color}`}
                                data-testid={`badge-canvas-status-${job.id}`}
                              >
                                <StatusIcon className="w-2.5 h-2.5" />
                                {canvasStatus.label}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500" data-testid={`text-created-${job.id}`}>
                            Updated {formatDistanceToNow(new Date(job.canvasWorkProgress.lastCanvasWork || job.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                              </div>
                      
                      {/* Right Side: Actions Cluster */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {job.photos.length > 0 && job.photos.length > 1 && (
                          <span className="rounded-full bg-slate-100 text-slate-600 text-xs px-3 py-1">
                            {job.photos.length} photos
                          </span>
                        )}
                          
                        <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/jobs/${job.id}`);
                            }}
                            data-testid={`button-view-job-${job.id}`}
                          className="text-slate-400 hover:text-slate-700 transition-colors"
                          aria-label="View job"
                          >
                          <Eye className="w-4 h-4" />
                        </button>
                          
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              data-testid={`button-job-menu-${job.id}`}
                              className="text-slate-400 hover:text-slate-700 transition-colors"
                              aria-label="Job options"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            {job.status !== 'completed' && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    updateJobStatusMutation.mutate({ jobId: job.id, status: 'completed' });
                                  }}
                                  disabled={updateJobStatusMutation.isPending}
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Mark as Completed
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => navigate(`/jobs/${job.id}`)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {job.status === 'completed' && (
                              <DropdownMenuItem
                                onClick={() => {
                                  updateJobStatusMutation.mutate({ jobId: job.id, status: 'new' });
                                }}
                                disabled={updateJobStatusMutation.isPending}
                              >
                                <Clock className="w-4 h-4 mr-2" />
                                Reopen Job
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

