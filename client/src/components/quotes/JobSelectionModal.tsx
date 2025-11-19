import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, FolderOpen, User, MapPin, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface JobSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectJob: (jobId: string) => void;
  selectedOrgId: string | null;
}

export function JobSelectionModal({
  open,
  onOpenChange,
  onSelectJob,
  selectedOrgId,
}: JobSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['/api/jobs', selectedOrgId],
    queryFn: () => selectedOrgId ? apiClient.getJobs(selectedOrgId) : Promise.resolve([]),
    enabled: !!selectedOrgId && open,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'estimating': return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
      case 'sent': return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'accepted': return 'bg-green-50 text-green-700 border border-green-200';
      case 'declined': return 'bg-red-50 text-red-700 border border-red-200';
      case 'scheduled': return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      case 'completed': return 'bg-gray-50 text-gray-700 border border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border border-gray-200';
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      job.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleSelectJob = (jobId: string) => {
    onSelectJob(jobId);
    onOpenChange(false);
    setSearchTerm('');
    setStatusFilter('all');
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Select a Job"
      description="Choose a job to create a quote for"
      size="lg"
      variant="default"
    >
      <div className="space-y-4">
        {/* Search and Filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by client name or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-600">Filter by status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-sm"
            >
              <option value="all">All</option>
              <option value="new">New</option>
              <option value="estimating">Estimating</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Jobs List */}
        <div className="border border-slate-200 rounded-lg max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-500">Loading jobs...</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-8 text-center">
              <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No jobs found</h3>
              <p className="text-slate-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filters.' 
                  : 'Create a job first to generate quotes.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => handleSelectJob(job.id)}
                  className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {job.clientName || 'Unnamed Job'}
                        </h3>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-xs text-slate-500">
                        {job.address && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{job.address}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span>Created {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <FolderOpen className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

