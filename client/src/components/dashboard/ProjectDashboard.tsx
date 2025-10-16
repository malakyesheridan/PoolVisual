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
import { ProjectOverviewCards } from './ProjectOverviewCards';
import { ActivityFeed } from './ActivityFeed';
import { RecentWork } from './RecentWork';
import { WorkflowSuggestions } from './WorkflowSuggestions';
import { DeadlineAlerts } from './DeadlineAlerts';
import { CollaborationNotifications } from './CollaborationNotifications';
import { SmartFilteringPanel } from './SmartFilteringPanel';
import { NotificationManagementPanel } from '../notifications/NotificationManagementPanel';
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
  Users
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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'draft'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'recent' | 'suggestions' | 'deadlines' | 'collaboration' | 'filtering' | 'notifications'>('overview');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // Fetch organizations
  const { data: orgs = [] } = useQuery({
    queryKey: ['/api/me/orgs'],
    queryFn: () => apiClient.getMyOrgs(),
  });

  // Auto-select first org if only one exists
  useEffect(() => {
    if (orgs.length === 1 && !selectedOrgId) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  // Fetch jobs for the selected organization
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/jobs', selectedOrgId],
    queryFn: () => selectedOrgId ? apiClient.getJobs(selectedOrgId) : Promise.resolve([]),
    enabled: !!selectedOrgId,
  });

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

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchTerm || 
      job.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  if (jobsLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Project Dashboard</h1>
          <p className="text-slate-600 mt-1">Manage and track your pool renovation projects</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          
          <Button onClick={() => navigate('/jobs/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {orgs.length > 1 && (
          <select
            value={selectedOrgId || ''}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
          >
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        )}
        
        <div className="flex gap-2">
          {['All', 'Active', 'Completed', 'Draft'].map((status) => (
            <Button
              key={status}
              variant={filterStatus === status.toLowerCase() ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(status.toLowerCase() as any)}
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {/* Projects List */}
      {filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Projects Found</h3>
              <p className="text-gray-600 mb-4">
                {jobs.length === 0 
                  ? "Create your first project to get started" 
                  : "Try adjusting your search or filter criteria"
                }
              </p>
              <Button onClick={() => navigate('/jobs/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
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
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4" />
                  <span>{job.address || 'No address'}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>Created {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                </div>

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
      )}
    </div>
  );
}
