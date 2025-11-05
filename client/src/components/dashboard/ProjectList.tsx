/**
 * Clean Project List Component
 * Simple grid/list wrapper for project cards
 */

import React from 'react';
import { ProjectCard } from './ProjectCard';
import { Button } from '../ui/button';
import { Plus, Palette } from 'lucide-react';

interface ProjectListProps {
  jobs: any[];
  onView: (id: string) => void;
  onCreateNew: () => void;
  limit?: number; // Limit number of projects shown (for dashboard view)
}

export function ProjectList({ jobs, onView, onCreateNew, limit }: ProjectListProps) {
  const displayJobs = limit ? jobs.slice(0, limit) : jobs;
  const hasMore = limit ? jobs.length > limit : false;

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Palette className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-600 mb-6">
            Get started by creating your first project
          </p>
          <Button 
            onClick={onCreateNew}
            className="bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Your First Project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayJobs.map((job) => (
          <ProjectCard 
            key={job.id} 
            job={job} 
            onView={onView}
          />
        ))}
      </div>
      {hasMore && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Showing {displayJobs.length} of {jobs.length} projects
          </p>
        </div>
      )}
    </>
  );
}

