/**
 * Simplified Dashboard - Clean and Focused
 * Shows only essential information: metrics, search, and projects
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useOrgs } from '../../hooks/useOrgs';
import { useOrgStore } from '../../stores/orgStore';
import { MetricCards } from './MetricCards';
import { ProjectList } from './ProjectList';
import { QuickInsights } from './QuickInsights';
import { RecentActivityCompact } from './RecentActivityCompact';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Plus, Eye } from 'lucide-react';
import { useIndustryTerm } from '../../hooks/useIndustryTerm';

interface SimplifiedDashboardProps {
  className?: string;
}

export function SimplifiedDashboard({ className = '' }: SimplifiedDashboardProps) {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'draft'>('all');
  const { projects, createJob } = useIndustryTerm();

  // Fetch jobs for current user (user-centric architecture)
  const { data: jobs = [], isLoading: jobsLoading, error: jobsError } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: () => apiClient.getJobs(),
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Fetch quotes for metrics calculation (user-centric)
  const { data: quotes = [], isLoading: quotesLoading, error: quotesError } = useQuery({
    queryKey: ['/api/quotes'],
    queryFn: () => apiClient.getQuotes(),
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Memoize filtered jobs for performance
  const filteredJobs = React.useMemo(() => {
    if (!searchTerm && filterStatus === 'all') return jobs;
    
    const lowerSearch = searchTerm?.toLowerCase() || '';
    return jobs.filter(job => {
      const matchesSearch = !searchTerm || 
        job.clientName?.toLowerCase().includes(lowerSearch) ||
        job.address?.toLowerCase().includes(lowerSearch);
      
      const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchTerm, filterStatus]);

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
    <div className={`min-h-screen bg-gray-50 pb-20 md:pb-0 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* Mobile Header */}
        <div className="md:hidden safe-top bg-white border-b border-gray-200 px-4 py-3 -mx-4 sm:mx-0 mb-4">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold mobile-text-lg">Dashboard</h1>
            <Button 
              onClick={() => navigate('/jobs/new')} 
              className="bg-primary hover:bg-primary/90 text-white rounded-lg px-3 py-2 h-11 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 tap-target"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {createJob}
            </Button>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">Overview of your {projects.toLowerCase()}</p>
          </div>
          
          <Button 
            onClick={() => navigate('/jobs/new')} 
            className="bg-primary hover:bg-primary/90 text-white rounded-lg px-5 py-2 shadow-md hover:shadow-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Plus className="w-4 h-4 mr-2" />
            {createJob}
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="mt-8">
          <MetricCards 
            jobs={jobs} 
            quotes={quotes} 
            isLoading={jobsLoading || quotesLoading}
            error={jobsError || quotesError}
          />
        </div>

        {/* Dashboard Insights Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2">
            <QuickInsights jobs={jobs} quotes={quotes} />
          </div>
          <div className="space-y-6">
            <RecentActivityCompact jobs={jobs} />
          </div>
        </div>

        {/* Recent Projects Section */}
        <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent {projects}</h2>
          {filteredJobs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/jobs')}
                className="text-primary hover:text-primary hover:bg-primary/5 transition-all duration-150"
            >
              View All
              <Eye className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>

          {/* Search and Filters - Unified Container */}
          <div className="w-full bg-white border border-gray-100 shadow-sm rounded-xl p-4 mb-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-gray-200 rounded-lg focus:border-primary focus:ring-primary transition-all duration-150 h-11 md:h-auto py-3 md:py-2 mobile-text-base"
                  aria-label="Search projects"
              />
            </div>
            
            
            <div className="flex gap-2 flex-wrap">
                {['All', 'Active', 'Completed', 'Draft'].map((status) => {
                  const isActive = filterStatus === status.toLowerCase();
                  return (
                    <button
                  key={status}
                  onClick={() => setFilterStatus(status.toLowerCase() as any)}
                      className={`px-3 py-2.5 md:py-1.5 h-11 md:h-auto text-xs md:text-xs mobile-text-base font-medium rounded-full transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 tap-target ${
                        isActive
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      aria-pressed={isActive}
                >
                  {status}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Projects Container Card */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl">
            {filteredJobs.length === 0 ? (
              <div className="flex items-center justify-center min-h-[280px] px-6 py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects found</h3>
                  <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                    {searchTerm || filterStatus !== 'all'
                      ? 'Try adjusting your search or filters to find projects'
                      : 'Get started by creating your first project'}
                  </p>
                  {!searchTerm && filterStatus === 'all' && (
                    <Button
                      onClick={() => navigate('/jobs/new')}
                      className="bg-primary hover:bg-primary/90 text-white rounded-lg px-5 py-3 md:py-2 h-11 md:h-auto shadow-md hover:shadow-lg transition-all duration-150 tap-target"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Project
                    </Button>
                  )}
          </div>
        </div>
            ) : (
              <div className="p-6">
        <ProjectList 
          jobs={filteredJobs}
          onView={(id) => navigate(`/jobs/${id}`)}
          onCreateNew={() => navigate('/jobs/new')}
          limit={6}
        />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

