/**
 * Minimal Project Card Component
 * Clean, simple project card with essential information only
 */

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Eye, Palette } from 'lucide-react';

interface ProjectCardProps {
  job: any;
  onView: (id: string) => void;
}

export function ProjectCard({ job, onView }: ProjectCardProps) {

  return (
    <Card className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-150 overflow-hidden">
      <CardContent className="p-0">
        {/* Photo thumbnail */}
        <div className="w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
          {job.photos && job.photos.length > 0 && job.photos[0] ? (
            <img 
              src={
                job.photos[0].originalUrl?.startsWith('/uploads/')
                  ? `/api/photos/${job.photos[0].id}/image`
                  : job.photos[0].originalUrl || job.photos[0].url
              }
              alt={job.clientName || 'Project preview'} 
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to placeholder if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.photo-placeholder')) {
                  parent.innerHTML = `
                    <div class="photo-placeholder text-center text-gray-400">
                      <svg class="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p class="text-sm">No photo</p>
                    </div>
                  `;
                }
              }}
            />
          ) : (
            <div className="text-center text-gray-400">
              <Palette className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm">No photo</p>
            </div>
          )}
        </div>
        
        {/* Card content */}
        <div className="p-5 space-y-3">
          {/* Client name */}
          <div>
            <h3 className="font-semibold text-lg text-gray-900 truncate">
              {job.clientName || 'Unnamed Project'}
            </h3>
          </div>
          
          {/* View button */}
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onClick={() => onView(job.id)}
          >
            <Eye className="w-4 h-4 mr-2" />
            View Project
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

