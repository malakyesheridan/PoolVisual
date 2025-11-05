/**
 * Minimal Project Card Component
 * Clean, simple project card with essential information only
 */

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Eye, Palette } from 'lucide-react';

interface ProjectCardProps {
  job: any;
  onView: (id: string) => void;
}

export function ProjectCard({ job, onView }: ProjectCardProps) {
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

  return (
    <Card className="hover:shadow-md transition-shadow border border-gray-200">
      <CardContent className="p-0">
        {/* Photo thumbnail */}
        <div className="w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden rounded-t-lg">
          {job.photos && job.photos.length > 0 && job.photos[0].url ? (
            <img 
              src={job.photos[0].url} 
              alt={job.clientName || 'Project preview'} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center text-gray-400">
              <Palette className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm">No photo</p>
            </div>
          )}
        </div>
        
        {/* Card content */}
        <div className="p-4 space-y-3">
          {/* Client name and status */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg text-gray-900 truncate flex-1">
              {job.clientName || 'Unnamed Project'}
            </h3>
            <Badge className={`ml-2 ${getStatusColor(job.status || 'new')}`}>
              {job.status || 'new'}
            </Badge>
          </div>
          
          {/* View button */}
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700"
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

