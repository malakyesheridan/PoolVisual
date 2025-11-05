import React, { useState, useEffect } from 'react';
import { FileText, Plus, Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '../components/ui/dropdown-menu';

interface Job {
  id: string;
  name?: string;
  clientName?: string;
  status?: string;
  createdAt: string;
}

interface JobSelectorProps {
  onJobSelect: (jobId: string) => void;
  onCancel?: () => void;
}

export function JobSelector({ onJobSelect, onCancel }: JobSelectorProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      // Get user's organizations
      const userOrgs = await apiClient.getMyOrgs();
      
      // Load jobs from all organizations
      const allJobs = await Promise.all(
        userOrgs.map(async (org) => {
          try {
            const orgJobs = await apiClient.getJobs(org.id);
            return orgJobs.map(job => ({
              ...job,
              orgName: org.name
            }));
          } catch (error) {
            console.warn(`Failed to load jobs for org ${org.id}:`, error);
            return [];
          }
        })
      );
      
      // Flatten and sort by creation date (newest first)
      const flattenedJobs = allJobs.flat().sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setJobs(flattenedJobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleJobSelect = (jobId: string) => {
    onJobSelect(jobId);
    const job = jobs.find(j => j.id === jobId);
    const jobName = job?.name || job?.clientName || `Job ${jobId.slice(0, 8)}`;
    toast.success(`Selected job: ${jobName}`);
  };

  const handleCreateNewJob = () => {
    navigate('/jobs/new');
  };

  const getJobDisplayName = (job: Job) => {
    if (job.name) return job.name;
    if (job.clientName) return `${job.clientName}'s Job`;
    return `Job ${job.id.slice(0, 8)}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          disabled={loading}
          className="flex items-center space-x-2"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FileText size={16} />
          )}
          <span className="font-medium">
            {loading ? 'Loading...' : 'Select Job'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto">
        {jobs.length === 0 && !loading ? (
          <DropdownMenuItem disabled>
            <span className="text-gray-500">No jobs found</span>
          </DropdownMenuItem>
        ) : (
          jobs.map((job) => (
            <DropdownMenuItem 
              key={job.id}
              onClick={() => handleJobSelect(job.id)}
              className="flex flex-col items-start py-2"
            >
              <div className="font-medium text-sm">
                {getJobDisplayName(job)}
              </div>
              {job.clientName && job.name && (
                <div className="text-xs text-gray-500">
                  {job.clientName}
                </div>
              )}
              {job.status && (
                <div className="text-xs text-gray-400">
                  Status: {job.status}
                </div>
              )}
            </DropdownMenuItem>
          ))
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleCreateNewJob}>
          <Plus size={16} className="mr-2" />
          <span>Create New Job</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
