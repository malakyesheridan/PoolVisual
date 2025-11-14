// client/src/state/useEnhancementStore.ts
import { create } from 'zustand';
import type { Job } from '../services/aiEnhancement';

export type SortOption = 'newest' | 'oldest' | 'status' | 'progress';
export type StatusFilter = 'all' | 'completed' | 'processing' | 'failed';
export type TypeFilter = 'all' | 'add_pool' | 'add_decoration';
export type DateFilter = 'all' | 'today' | 'week' | 'month';

type State = {
  jobs: Record<string, Job>;
  order: string[];
  sortBy: SortOption;
  statusFilter: StatusFilter;
  typeFilter: TypeFilter;
  dateFilter: DateFilter;
  searchQuery: string;
};

type Actions = {
  upsertJob: (partial: Partial<Job> & { id: string }) => void;
  setInitial: (jobs: Job[]) => void;
  setSortBy: (sort: SortOption) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  setTypeFilter: (filter: TypeFilter) => void;
  setDateFilter: (filter: DateFilter) => void;
  setSearchQuery: (query: string) => void;
  deleteJob: (id: string) => void;
  getFilteredAndSortedJobs: () => Job[];
};

const isProcessing = (status: Job['status']) => {
  return ['queued', 'downloading', 'preprocessing', 'rendering', 'postprocessing', 'uploading'].includes(status);
};

export const useEnhancementStore = create<State & Actions>((set, get) => ({
  jobs: {},
  order: [],
  sortBy: 'newest',
  statusFilter: 'all',
  typeFilter: 'all',
  dateFilter: 'all',
  searchQuery: '',
  
  setInitial: (jobs) => set({
    jobs: Object.fromEntries(jobs.map(j => [j.id, j])),
    order: jobs.map(j => j.id),
  }),
  
  upsertJob: (partial) => {
    const { jobs, order } = get();
    const existing = jobs[partial.id] || { id: partial.id } as Job;
    const merged: Job = { ...existing, ...partial };
    set({
      jobs: { ...jobs, [partial.id]: merged },
      order: order.includes(partial.id) ? order : [partial.id, ...order],
    });
  },
  
  setSortBy: (sort) => set({ sortBy: sort }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setTypeFilter: (filter) => set({ typeFilter: filter }),
  setDateFilter: (filter) => set({ dateFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  deleteJob: (id) => {
    const { jobs, order } = get();
    const newJobs = { ...jobs };
    delete newJobs[id];
    set({
      jobs: newJobs,
      order: order.filter(jobId => jobId !== id),
    });
  },
  
  getFilteredAndSortedJobs: () => {
    const { jobs, order, sortBy, statusFilter, typeFilter, dateFilter, searchQuery } = get();
    
    let filtered = order
      .map(id => jobs[id])
      .filter(job => {
        if (!job) return false;
        
        // Status filter
        if (statusFilter !== 'all') {
          if (statusFilter === 'completed' && job.status !== 'completed') return false;
          if (statusFilter === 'processing' && !isProcessing(job.status)) return false;
          if (statusFilter === 'failed' && job.status !== 'failed') return false;
        }
        
        // Type filter
        if (typeFilter !== 'all' && job.mode !== typeFilter) return false;
        
        // Date filter
        if (dateFilter !== 'all' && job.created_at) {
          const jobDate = new Date(job.created_at);
          const now = new Date();
          const diff = now.getTime() - jobDate.getTime();
          
          if (dateFilter === 'today' && diff > 24 * 60 * 60 * 1000) return false;
          if (dateFilter === 'week' && diff > 7 * 24 * 60 * 60 * 1000) return false;
          if (dateFilter === 'month' && diff > 30 * 24 * 60 * 60 * 1000) return false;
        }
        
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const jobIdMatch = job.id.toLowerCase().includes(query);
          const dateMatch = job.created_at && new Date(job.created_at).toLocaleDateString().toLowerCase().includes(query);
          if (!jobIdMatch && !dateMatch) return false;
        }
        
        return true;
      });
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        case 'oldest':
          const aTime2 = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime2 = b.created_at ? new Date(b.created_at).getTime() : 0;
          return aTime2 - bTime2;
        case 'status':
          const statusOrder = ['completed', 'queued', 'downloading', 'preprocessing', 'rendering', 'postprocessing', 'uploading', 'failed', 'canceled'];
          return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
        case 'progress':
          const aProgress = a.progress_percent ?? 0;
          const bProgress = b.progress_percent ?? 0;
          return bProgress - aProgress;
        default:
          return 0;
      }
    });
    
    return filtered;
  },
}));

