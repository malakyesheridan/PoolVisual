import { useState, useMemo, useEffect } from 'react';
import React from 'react';
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
import { ClientInfoModal } from "@/components/jobs/ClientInfoModal";
import { EmptyState } from "@/components/common/EmptyState";
import { JobCardSkeleton } from "@/components/ui/skeleton-variants";
import { formatDistanceToNow } from "date-fns";
import { getIndustryTerm } from "@/lib/industry-terminology";
import { useIsRealEstate } from "@/hooks/useIsRealEstate";
import { formatCurrency } from "@/lib/measurement-utils";
import { useNewJobRoute, useJobDetailRoute } from "@/lib/route-utils";

export default function Properties() {
  const [, params] = useRoute('/properties/:id');
  const [, navigate] = useLocation();
  const jobId = params?.id;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [clientInfoModalOpen, setClientInfoModalOpen] = useState(false);
  const [selectedJobForClientInfo, setSelectedJobForClientInfo] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  // Get industry-specific terminology from user (user-centric)
  const userIndustry = user?.industryType || 'real_estate';
  const jobTerm = getIndustryTerm(userIndustry, 'job');
  const jobsTerm = getIndustryTerm(userIndustry, 'jobs');
  const createJobText = getIndustryTerm(userIndustry, 'createJob');
  const isRealEstate = useIsRealEstate();

  // Fetch jobs for current user (user-centric architecture)
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: () => apiClient.getJobs(),
    staleTime: 1 * 60 * 1000, // 1 minute - jobs list changes infrequently
  });

  // Fetch canvas work status using optimized batch endpoint (replaces N+1 queries)
  const { data: canvasStatusMap = {}, isLoading: isLoadingCanvasStatus } = useQuery({
    queryKey: ['/api/jobs/canvas-status', jobs.map(j => j.id).sort().join(',')],
    queryFn: async () => {
      if (jobs.length === 0) return {};
      
      // Use batch endpoint to fetch all canvas status in one request
      const canvasStatus = await apiClient.getJobsCanvasStatus(
        jobs.map(j => j.id)
      );
      
      // Convert array to map for O(1) lookup
      return canvasStatus.reduce((acc: Record<string, any>, status: any) => {
        acc[status.jobId] = status.canvasWorkProgress;
        return acc;
      }, {});
    },
    enabled: jobs.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes - canvas status doesn't change frequently
  });

  // Merge jobs with canvas status (memoized for performance)
  const jobsWithCanvasStatus = useMemo(() => {
    return jobs.map(job => ({
      ...job,
      canvasWorkProgress: canvasStatusMap[job.id] || {
        totalPhotos: 0,
        photosWithCanvasWork: 0,
        completionPercentage: 0,
        lastCanvasWork: null
      }
    }));
  }, [jobs, canvasStatusMap]);


  // Memoize filtered jobs to prevent unnecessary recalculations
  const filteredJobs = useMemo(() => {
    if (!searchTerm) return jobsWithCanvasStatus;
    
    const lowerSearch = searchTerm.toLowerCase();
    return jobsWithCanvasStatus.filter(job =>
      job.clientName.toLowerCase().includes(lowerSearch) ||
      job.address?.toLowerCase().includes(lowerSearch)
    );
  }, [jobsWithCanvasStatus, searchTerm]);

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
      case 'new': return 'bg-primary/5 text-primary border border-primary/20';
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
        color: 'text-primary',
        icon: Clock 
      };
    }
    
    // If we have photos but no canvas work yet, the job has been started
    // (photos are uploaded), so show "Started" instead of "Not Started"
    return { 
      status: 'started', 
      label: 'Started', 
      color: 'text-primary',
      icon: Clock 
    };
  };

  // If viewing a specific job (redirect to job detail)
  if (jobId) {
      navigate(`/properties/${jobId}`);
    return null;
  }

  // Jobs list view
  return (
    <div className="min-h-screen bg-[#F6F7F9] px-4 md:px-8 py-4 md:py-6 pb-20 md:pb-6">
      {/* Mobile Header */}
      <div className="md:hidden safe-top bg-white border-b border-gray-200 px-4 py-3 -mx-4 md:mx-0 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold mobile-text-lg" data-testid="text-page-title-mobile">
              {jobsTerm}
            </h1>
            <div className={`w-1.5 h-1.5 rounded-full ${
              jobHealthStatus === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
            }`} aria-label={jobHealthStatus === 'healthy' ? 'All jobs healthy' : 'Some jobs need attention'} />
          </div>
          <Button 
            onClick={() => navigate('/properties/new')} 
            className="bg-primary hover:bg-primary/90 text-white rounded-lg px-3 py-2 h-11 md:h-9 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 tap-target"
            data-testid="button-new-job-mobile"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {createJobText}
          </Button>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900" data-testid="text-page-title">
            {jobsTerm}
          </h1>
          <div className={`w-1.5 h-1.5 rounded-full ${
            jobHealthStatus === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
          }`} aria-label={jobHealthStatus === 'healthy' ? 'All jobs healthy' : 'Some jobs need attention'} />
        </div>
        
        <Button 
          onClick={() => navigate(useNewJobRoute())} 
          className="bg-primary hover:bg-primary/90 text-white rounded-lg px-3 py-1.5 h-9 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          data-testid="button-new-job"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          {createJobText}
        </Button>
      </div>

      <div className="max-w-6xl mx-auto w-full px-0 md:px-6">
        {/* Search + Filters Strip */}
        <div className="mb-6 rounded-2xl bg-white shadow-sm border border-slate-100 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={`Search ${jobsTerm.toLowerCase()} by client or address...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-full border border-slate-200 bg-slate-50 focus:bg-white px-4 py-3 md:py-2 h-11 md:h-auto text-sm md:text-sm mobile-text-base text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-primary transition-all duration-150"
              data-testid="input-search-jobs"
              aria-label="Search jobs"
            />
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            className="rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 px-3 py-2.5 md:py-1.5 h-11 md:h-auto flex items-center gap-2 transition-all duration-150 tap-target"
            data-testid="button-filters"
          >
            <Filter className="w-4 h-4 md:w-3.5 md:h-3.5" />
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
          <div className="px-4 md:px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-sm md:text-sm mobile-text-base font-semibold text-slate-900">Recent Jobs</h2>
            <p className="text-xs md:text-xs mobile-text-base text-slate-500">Your most recent activity</p>
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
                  <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FolderOpen className="w-6 h-6 text-primary" />
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
                      onClick={() => navigate('/properties/new')}
                      className="bg-primary hover:bg-primary/90 text-white rounded-lg px-4 py-3 md:py-2 h-11 md:h-9 text-sm font-medium transition-all duration-150 tap-target"
                    >
                      <Plus className="w-4 h-4 md:w-3.5 md:h-3.5 mr-1.5" />
                      Create Your First Job
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setSearchTerm('')}
                      className="border-gray-200 hover:bg-gray-50 rounded-lg px-3 py-2.5 md:py-1.5 h-11 md:h-9 text-sm transition-all duration-150 tap-target"
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
                      className="flex items-center justify-between px-4 md:px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer tap-target"
                      data-testid={`job-item-${job.id}`}
                      onClick={() => navigate(`/properties/${job.id}`)}
                    >
                      {/* Left Side: Timeline + Job Info */}
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        {/* Timeline Column */}
                        <div className="flex flex-col items-center pt-1 flex-shrink-0">
                          <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                          <div className="flex-1 w-px bg-slate-200"></div>
                        </div>
                        
                        {/* Job Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm md:text-sm mobile-text-base font-medium text-slate-900 truncate" data-testid={`text-client-name-${job.id}`}>
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
                          {/* Property Details for Real Estate */}
                          {isRealEstate && (job.bedrooms || job.bathrooms || job.estimatedPrice) && (
                            <div className="flex items-center gap-3 mb-1 text-xs text-slate-600">
                              {job.bedrooms && (
                                <span>{job.bedrooms} bed{job.bedrooms !== 1 ? 's' : ''}</span>
                              )}
                              {job.bathrooms && (
                                <span>{parseFloat(job.bathrooms.toString())} bath{parseFloat(job.bathrooms.toString()) !== 1 ? 's' : ''}</span>
                              )}
                              {job.garageSpaces && (
                                <span>{job.garageSpaces} garage{job.garageSpaces !== 1 ? 's' : ''}</span>
                              )}
                              {job.estimatedPrice && (
                                <span className="font-medium text-slate-900">
                                  {formatCurrency(parseFloat(job.estimatedPrice.toString()))}
                                </span>
                              )}
                            </div>
                          )}
                          {job.address && (
                            <p className="text-xs md:text-xs mobile-text-base text-slate-500 truncate" data-testid={`text-address-${job.id}`}>
                              <MapPin className="w-3 h-3 inline mr-1" />
                              {job.address}
                            </p>
                          )}
                          <p className="text-xs md:text-xs mobile-text-base text-slate-500" data-testid={`text-created-${job.id}`}>
                            Updated {formatDistanceToNow(new Date(job.canvasWorkProgress.lastCanvasWork || job.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                              </div>
                      
                      {/* Right Side: Actions Cluster */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {job.canvasWorkProgress.totalPhotos > 0 && job.canvasWorkProgress.totalPhotos > 1 && (
                          <span className="rounded-full bg-slate-100 text-slate-600 text-xs px-3 py-1">
                            {job.canvasWorkProgress.totalPhotos} photos
                          </span>
                        )}
                        
                        {/* View Client Info Button */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedJobForClientInfo(job);
                            setClientInfoModalOpen(true);
                          }}
                          data-testid={`button-view-client-info-${job.id}`}
                          className="p-2.5 md:p-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/5 rounded-md transition-all duration-150 tap-target"
                          aria-label="View client information"
                          title="View client information"
                        >
                          <User className="w-5 h-5 md:w-4 md:h-4" />
                        </button>
                          
                        <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/properties/${job.id}`);
                            }}
                            data-testid={`button-view-job-${job.id}`}
                          className="p-2.5 md:p-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-150 tap-target"
                          aria-label="View job"
                          title="View job"
                          >
                          <Eye className="w-5 h-5 md:w-4 md:h-4" />
                        </button>
                          
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              data-testid={`button-job-menu-${job.id}`}
                              className="p-2.5 md:p-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors tap-target"
                              aria-label="Job options"
                            >
                              <MoreHorizontal className="w-5 h-5 md:w-4 md:h-4" />
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
                              onClick={() => navigate(`/properties/${job.id}`)}
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

      {/* Client Info Modal */}
      {selectedJobForClientInfo && (
        <ClientInfoModal
          isOpen={clientInfoModalOpen}
          onClose={() => {
            setClientInfoModalOpen(false);
            setSelectedJobForClientInfo(null);
          }}
          job={selectedJobForClientInfo}
        />
      )}
    </div>
  );
}

