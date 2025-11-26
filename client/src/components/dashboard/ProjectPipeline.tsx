/**
 * Project Pipeline Visualization
 * Kanban-style view of projects across different stages
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Circle, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Eye,
  Edit,
  Calendar,
  Target
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProjectPipelineProps {
  jobs: any[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  className?: string;
}

interface ProjectCardProps {
  project: any;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}

const ProjectCard = ({ project, onView, onEdit }: ProjectCardProps) => (
  <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-2">
      <h4 className="font-medium text-sm text-gray-900 truncate">{project.clientName}</h4>
      <Badge 
        className={`text-xs ${
          project.status === 'new' ? 'bg-primary/10 text-primary' :
          project.status === 'estimating' ? 'bg-yellow-100 text-yellow-800' :
          project.status === 'sent' ? 'bg-purple-100 text-purple-800' :
          project.status === 'accepted' ? 'bg-green-100 text-green-800' :
          'bg-gray-100 text-gray-800'
        }`}
      >
        {project.status}
      </Badge>
    </div>
    
    {project.address && (
      <p className="text-xs text-gray-600 mb-2 truncate">{project.address}</p>
    )}
    
    <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
      <Calendar className="w-3 h-3" />
      <span>{formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</span>
    </div>
    
    <div className="flex gap-1">
      <Button 
        size="sm" 
        variant="outline" 
        className="flex-1 h-7 text-xs"
        onClick={() => onView(project.id)}
      >
        <Eye className="w-3 h-3 mr-1" />
        View
      </Button>
      <Button 
        size="sm" 
        className="flex-1 h-7 text-xs"
        onClick={() => onEdit(project.id)}
      >
        <Edit className="w-3 h-3 mr-1" />
        Edit
      </Button>
    </div>
  </div>
);

export function ProjectPipeline({ jobs, onView, onEdit, className = '' }: ProjectPipelineProps) {
  // Group jobs by status
  const projectsByStage = {
    'new': jobs.filter(job => job.status === 'new'),
    'estimating': jobs.filter(job => job.status === 'estimating'),
    'sent': jobs.filter(job => job.status === 'sent'),
    'accepted': jobs.filter(job => job.status === 'accepted')
  };

  const stages = [
    { 
      key: 'new', 
      title: 'New Projects', 
      icon: Circle, 
      color: 'text-primary',
      bgColor: 'bg-primary/5',
      borderColor: 'border-primary/20'
    },
    { 
      key: 'estimating', 
      title: 'Estimating', 
      icon: Clock, 
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    { 
      key: 'sent', 
      title: 'Quotes Sent', 
      icon: AlertCircle, 
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    { 
      key: 'accepted', 
      title: 'Accepted', 
      icon: CheckCircle, 
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    }
  ];


  return (
    <Card className={`bg-gradient-to-br from-purple-50 to-pink-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-md">
            <Target className="w-5 h-5 text-white" />
          </div>
          Project Pipeline
          <Badge className="bg-purple-100 text-purple-800 border-purple-200 px-3 py-1">
            {jobs.length} Active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stages.map((stage) => {
            const projects = projectsByStage[stage.key as keyof typeof projectsByStage];
            return (
              <div 
                key={stage.key} 
                className={`${stage.bgColor} ${stage.borderColor} border rounded-lg p-3 min-h-[200px]`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <stage.icon className={`w-4 h-4 ${stage.color}`} />
                  <h3 className="font-semibold text-sm text-gray-800">{stage.title}</h3>
                  <Badge className="bg-white text-gray-600 text-xs">
                    {projects.length}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  {projects.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="text-gray-400 text-xs">No projects</div>
                    </div>
                  ) : (
                    projects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onView={onView}
                        onEdit={onEdit}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
