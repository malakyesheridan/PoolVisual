/**
 * Project Dashboard - Central Hub for Project Management
 * Provides overview, activity feed, and quick actions for all projects
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useProjectStore } from '../../stores/projectStore';
import { useStatusSyncStore } from '../../stores/statusSyncStore';
import { useMaterialUsageStore } from '../../stores/materialUsageStore';
import { useOrgStore } from '../../stores/orgStore';
import { useIndustryTerm } from '../../hooks/useIndustryTerm';
import { ProjectOverviewCards } from './ProjectOverviewCards';
import { ActivityFeed } from './ActivityFeed';
import { RecentWork } from './RecentWork';
import { WorkflowSuggestions } from './WorkflowSuggestions';
import { DeadlineAlerts } from './DeadlineAlerts';
import { CollaborationNotifications } from './CollaborationNotifications';
import { SmartFilteringPanel } from './SmartFilteringPanel';
import { NotificationManagementPanel } from '../notifications/NotificationManagementPanel';
import { DashboardMetrics } from './DashboardMetrics';
import { RecentActivity } from './RecentActivity';
import { RevenueIntelligence } from './RevenueIntelligence';
import { ProjectPipeline } from './ProjectPipeline';
import { PerformanceAnalytics } from './PerformanceAnalytics';
import { SmartInsights } from './SmartInsights';
import { ActionCenter } from './ActionCenter';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  MapPin, 
  Clock, 
  TrendingUp,
  Activity,
  Zap,
  Eye,
  Edit,
  FileText,
  Package,
  Palette,
  Lightbulb,
  Bell,
  Users,
  Play
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProjectDashboardProps {
  className?: string;
}

export function ProjectDashboard({ className = '' }: ProjectDashboardProps) {
  const [, navigate] = useLocation();
  const { project, isLoading, error } = useProjectStore();
  const { notifications } = useStatusSyncStore();
  const { projectSummaries } = useMaterialUsageStore();
  const { project: projectTerm, projects: projectsTerm, createJob } = useIndustryTerm();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'draft'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'recent' | 'suggestions' | 'deadlines' | 'collaboration' | 'filtering' | 'notifications'>('overview');
  // Use centralized org store
  const { selectedOrgId, setSelectedOrgId, setCurrentOrg } = useOrgStore();

  // Fetch organizations
  const { data: orgs = [] } = useQuery({
    queryKey: ['/api/me/orgs'],
    queryFn: () => apiClient.getMyOrgs(),
  });

  // Auto-select first org if only one exists and update store
  useEffect(() => {
    if (orgs.length === 1 && !selectedOrgId) {
      setSelectedOrgId(orgs[0].id);
      setCurrentOrg(orgs[0]);
    } else if (orgs.length > 0 && selectedOrgId && !orgs.find(o => o.id === selectedOrgId)) {
      // If selected org no longer exists, select first available
      setSelectedOrgId(orgs[0].id);
      setCurrentOrg(orgs[0]);
    } else if (orgs.length > 0 && selectedOrgId) {
      // Update current org if it exists
      const current = orgs.find(o => o.id === selectedOrgId);
      if (current) setCurrentOrg(current);
    }
  }, [orgs, selectedOrgId, setSelectedOrgId, setCurrentOrg]);

  // Fetch jobs for the selected organization
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/jobs', selectedOrgId],
    queryFn: () => selectedOrgId ? apiClient.getJobs(selectedOrgId) : Promise.resolve([]),
    enabled: !!selectedOrgId,
  });

  // Fetch quotes for metrics calculation
  const { data: quotes = [] } = useQuery({
    queryKey: ['/api/quotes', selectedOrgId],
    queryFn: () => selectedOrgId ? apiClient.getQuotes(selectedOrgId) : Promise.resolve([]),
    enabled: !!selectedOrgId,
  });

  const startGuidedTour = () => {
    // TODO: Implement guided tour functionality
    console.log('Starting guided tour...');
    // For now, just navigate to create a new project
    navigate('/jobs/new');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-primary/10 text-primary';
      case 'estimating': return 'bg-yellow-100 text-yellow-800';
      case 'sent': return 'bg-purple-100 text-purple-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'scheduled': return 'bg-indigo-100 text-indigo-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchTerm || 
      job.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  if (jobsLoading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6"></div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Loading Dashboard</h3>
              <p className="text-slate-600">Fetching your project data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{projectTerm} Dashboard</h1>
            <p className="text-slate-600 text-lg">Manage and track your {projectsTerm.toLowerCase()}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" className="hidden sm:flex">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            
            <Button onClick={() => navigate('/jobs/new')} className="bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200">
              <Plus className="w-4 h-4 mr-2" />
              {createJob}
            </Button>
          </div>
        </div>

        {/* High-End Dashboard Components - Always Show */}
        <div className="space-y-8">
          {/* Phase 1: Core Business Intelligence */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
            {/* Revenue Intelligence */}
            <RevenueIntelligence jobs={jobs} quotes={quotes} />
            
            {/* Performance Analytics */}
            <PerformanceAnalytics jobs={jobs} quotes={quotes} />
          </div>
          
          {/* Project Pipeline */}
          <ProjectPipeline 
            jobs={jobs} 
            onView={(id) => navigate(`/jobs/${id}`)}
            onEdit={(id) => navigate(`/jobs/${id}/edit`)}
          />
          
          {/* Phase 2: Advanced Features */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
            {/* Smart Insights Engine */}
            <SmartInsights jobs={jobs} quotes={quotes} />
            
            {/* Action Center */}
            <ActionCenter 
              jobs={jobs} 
              quotes={quotes} 
              onNavigate={(path) => navigate(path)}
            />
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-200 focus:border-primary focus:ring-primary"
              />
            </div>
            
            {orgs.length > 1 && (
              <select
                value={selectedOrgId || ''}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-lg bg-white text-sm focus:border-primary focus:ring-primary"
              >
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            )}
            
            <div className="flex gap-2 flex-wrap">
              {['All', 'Active', 'Completed', 'Draft'].map((status) => (
                <Button
                  key={status}
                  variant={filterStatus === status.toLowerCase() ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(status.toLowerCase() as any)}
                  className="transition-all duration-200 hover:scale-105"
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Projects List */}
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-slate-200">
              <div className="text-center max-w-2xl mx-auto">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Palette className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">Welcome to PoolVisual!</h3>
                <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                  {jobs.length === 0 
                    ? "Transform your pool renovation business with professional visualizations and accurate quotes. Upload photos, draw material areas, and generate stunning presentations that win more clients." 
                    : "No projects match your current search criteria. Try adjusting your filters or search terms."
                  }
                </p>
              
              {jobs.length === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="flex flex-col items-center text-center p-6 bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-4 shadow-md">
                        <span className="text-white font-bold text-lg">1</span>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">Upload Photo</h4>
                      <p className="text-sm text-gray-600">Upload a clear photo of the pool area</p>
                    </div>
                    <div className="flex flex-col items-center text-center p-6 bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center mb-4 shadow-md">
                        <span className="text-white font-bold text-lg">2</span>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">Draw Areas</h4>
                      <p className="text-sm text-gray-600">Mark material areas with precision tools</p>
                    </div>
                    <div className="flex flex-col items-center text-center p-6 bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mb-4 shadow-md">
                        <span className="text-white font-bold text-lg">3</span>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">Generate Quote</h4>
                      <p className="text-sm text-gray-600">Create professional quotes instantly</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button 
                      size="lg" 
                      onClick={startGuidedTour}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Take Interactive Tour
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline"
                      onClick={() => navigate('/jobs/new')}
                      className="border-2 border-blue-600 text-primary hover:bg-primary hover:text-white px-8 py-4 text-lg font-semibold transition-all duration-200 hover:scale-105"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Create Your First Project
                    </Button>
                  </div>
                </div>
              )}
              
              {jobs.length > 0 && (
                <div className="text-center">
                  <Button 
                    onClick={() => navigate('/jobs/new')}
                    className="bg-primary hover:bg-primary/90 px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Project
                  </Button>
                </div>
              )}
              </div>
            </div>
          </div>
      ) : (
        <div className="space-y-6">
          {/* Recent Activity Section */}
          <RecentActivity jobs={jobs} />
          
          {/* Projects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <Card key={job.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{job.clientName}</CardTitle>
                  <Badge className={getStatusColor(job.status)}>
                    {job.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Project thumbnail */}
                <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                  {job.photos && job.photos.length > 0 ? (
                    <img 
                      src={job.photos[0].url} 
                      alt="Project preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-gray-400">
                      <Palette className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">No photo</p>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{job.address || 'No address'}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>Created {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                </div>

                {/* Quote info if available */}
                {job.quotes && job.quotes.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Quote Value:</span>
                    <span className="font-semibold text-green-600">
                      ${parseFloat(job.quotes[0].total || '0').toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => navigate(`/jobs/${job.id}/edit`)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
