/**
 * Simplified Dashboard - Clean and Focused
 * Shows only essential information: metrics, search, and projects
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { MetricCards } from './MetricCards';
import { ProjectList } from './ProjectList';
import { QuickInsights } from './QuickInsights';
import { RecentActivityCompact } from './RecentActivityCompact';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Plus, Eye } from 'lucide-react';

interface SimplifiedDashboardProps {
  className?: string;
}

export function SimplifiedDashboard({ className = '' }: SimplifiedDashboardProps) {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'draft'>('all');
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

  // Fetch quotes for metrics calculation
  const { data: quotes = [] } = useQuery({
    queryKey: ['/api/quotes', selectedOrgId],
    queryFn: () => selectedOrgId ? apiClient.getQuotes(selectedOrgId) : Promise.resolve([]),
    enabled: !!selectedOrgId,
  });

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchTerm || 
      job.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  if (jobsLoading) {
    return (
      <div className={`min-h-screen bg-gray-50 ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6"></div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Loading Projects</h3>
              <p className="text-gray-600">Fetching your project data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">Overview of your pool renovation projects</p>
          </div>
          
          <Button 
            onClick={() => navigate('/jobs/new')} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="mb-6">
          <MetricCards jobs={jobs} quotes={quotes} />
        </div>

        {/* Dashboard Insights Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <QuickInsights jobs={jobs} />
          </div>
          <div>
            <RecentActivityCompact jobs={jobs} />
          </div>
        </div>

        {/* Projects Section Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
          {filteredJobs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/jobs')}
              className="text-blue-600 hover:text-blue-700"
            >
              View All
              <Eye className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            
            {orgs.length > 1 && (
              <select
                value={selectedOrgId || ''}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:border-blue-500 focus:ring-blue-500"
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
                  className={filterStatus === status.toLowerCase() ? 'bg-blue-600 hover:bg-blue-700' : ''}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Projects List - Limited to 6 for dashboard overview */}
        <ProjectList 
          jobs={filteredJobs}
          onView={(id) => navigate(`/jobs/${id}`)}
          onCreateNew={() => navigate('/jobs/new')}
          limit={6}
        />
      </div>
    </div>
  );
}

