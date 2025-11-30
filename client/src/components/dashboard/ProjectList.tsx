/**
 * Clean Project List Component
 * Simple grid/list wrapper for project cards
 */

import React from 'react';
import { ProjectCard } from './ProjectCard';
import { useIndustryTerm } from '../../hooks/useIndustryTerm';

interface ProjectListProps {
  jobs: any[];
  onView: (id: string) => void;
  onCreateNew: () => void;
  limit?: number; // Limit number of projects shown (for dashboard view)
}

export function ProjectList({ jobs, onView, onCreateNew, limit }: ProjectListProps) {
  const { projects } = useIndustryTerm();
  const displayJobs = limit ? jobs.slice(0, limit) : jobs;
  const hasMore = limit ? jobs.length > limit : false;

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
            Showing {displayJobs.length} of {jobs.length} {projects.toLowerCase()}
          </p>
        </div>
      )}
    </>
  );
}

