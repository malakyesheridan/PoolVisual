// client/src/state/useEnhancementStore.ts
import { create } from 'zustand';
import type { Job } from '../services/aiEnhancement';

export type SortOption = 'newest' | 'oldest' | 'status' | 'progress';
export type StatusFilter = 'all' | 'completed' | 'processing' | 'failed';
export type TypeFilter = 'all' | 'add_pool' | 'add_decoration' | 'blend_materials';
export type DateFilter = 'all' | 'today' | 'week' | 'month';
export type GroupBy = 'none' | 'date' | 'status' | 'type';

type State = {
  jobs: Record<string, Job>;
  order: string[];
  sortBy: SortOption;
  statusFilter: StatusFilter;
  typeFilter: TypeFilter;
  dateFilter: DateFilter;
  searchQuery: string;
  // Pagination
  pageSize: number;
  currentPage: number;
  // Statistics
  stats: {
    total: number;
    completed: number;
    processing: number;
    failed: number;
    byType: Record<string, number>;
  } | null;
  // Bulk Operations
  selectedJobs: string[];
  isSelectMode: boolean;
  bulkActionInProgress: boolean;
  // Auto-refresh
  autoRefreshInterval: number | null; // milliseconds, null = disabled
  lastRefreshTime: number | null;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  // Analytics
  analyticsData: {
    timeline: Array<{ date: string; jobs: number; completed: number; failed: number }>;
    successRates: { daily: number; weekly: number; monthly: number };
    processingTimes: { byType: Record<string, number>; average: number };
    materialUsage: Record<string, number>;
    errorBreakdown: Record<string, number>;
  } | null;
  // Grouping
  groupBy: GroupBy;
  expandedGroups: Set<string>;
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
  // Pagination
  setPageSize: (size: number) => void;
  setCurrentPage: (page: number) => void;
  getPaginatedJobs: () => { jobs: Job[]; total: number; totalPages: number; currentPage: number };
  // Statistics
  calculateStats: () => void;
  // Bulk Operations
  toggleSelectMode: () => void;
  toggleJobSelection: (jobId: string) => void;
  selectAllJobs: () => void;
  deselectAllJobs: () => void;
  setBulkActionInProgress: (inProgress: boolean) => void;
  // Auto-refresh
  setAutoRefreshInterval: (interval: number | null) => void;
  refreshJobs: () => Promise<void>;
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
  // Analytics
  calculateAnalytics: () => void;
  // Grouping
  setGroupBy: (groupBy: GroupBy) => void;
  toggleGroup: (groupId: string) => void;
  getGroupedJobs: () => Array<{ groupId: string; label: string; jobs: Job[]; count: number }>;
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
  pageSize: 10,
  currentPage: 1,
  stats: null,
  // Bulk Operations
  selectedJobs: [],
  isSelectMode: false,
  bulkActionInProgress: false,
  // Auto-refresh
  autoRefreshInterval: null,
  lastRefreshTime: null,
  connectionStatus: 'connected',
  // Analytics
  analyticsData: null,
  // Grouping
  groupBy: 'none',
  expandedGroups: new Set<string>(),
  
  setInitial: (jobs) => {
    set({
      jobs: Object.fromEntries(jobs.map(j => [j.id, j])),
      order: jobs.map(j => j.id),
      currentPage: 1, // Reset to first page when loading new jobs
    });
    // Calculate stats and analytics after setting initial jobs
    setTimeout(() => {
      get().calculateStats();
      get().calculateAnalytics();
    }, 0);
  },
  
  upsertJob: (partial) => {
    const { jobs, order } = get();
    const existing = jobs[partial.id] || { id: partial.id } as Job;
    const merged: Job = { ...existing, ...partial };
    set({
      jobs: { ...jobs, [partial.id]: merged },
      order: order.includes(partial.id) ? order : [partial.id, ...order],
    });
    // Recalculate stats and analytics after job update
    setTimeout(() => {
      get().calculateStats();
      get().calculateAnalytics();
    }, 0);
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
    // Recalculate stats and analytics after deletion
    setTimeout(() => {
      get().calculateStats();
      get().calculateAnalytics();
    }, 0);
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

  setPageSize: (size) => {
    set({ pageSize: size, currentPage: 1 }); // Reset to first page when changing page size
  },

  setCurrentPage: (page) => {
    set({ currentPage: page });
  },

  getPaginatedJobs: () => {
    const { pageSize, currentPage } = get();
    const allJobs = get().getFilteredAndSortedJobs();
    const total = allJobs.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const jobs = allJobs.slice(startIndex, endIndex);
    
    return { jobs, total, totalPages, currentPage };
  },

  calculateStats: () => {
    const { jobs, order } = get();
    const allJobs = order.map(id => jobs[id]).filter(Boolean);
    
    const stats = {
      total: allJobs.length,
      completed: allJobs.filter(j => j.status === 'completed').length,
      processing: allJobs.filter(j => isProcessing(j.status)).length,
      failed: allJobs.filter(j => j.status === 'failed').length,
      byType: {
        add_pool: allJobs.filter(j => j.mode === 'add_pool').length,
        add_decoration: allJobs.filter(j => j.mode === 'add_decoration').length,
        blend_materials: allJobs.filter(j => j.mode === 'blend_materials').length,
      },
    };
    
    set({ stats });
  },
  
  // Bulk Operations
  toggleSelectMode: () => {
    const { isSelectMode, selectedJobs } = get();
    set({ 
      isSelectMode: !isSelectMode,
      selectedJobs: !isSelectMode ? [] : selectedJobs, // Clear selection when disabling
    });
  },
  
  toggleJobSelection: (jobId: string) => {
    const { selectedJobs } = get();
    if (selectedJobs.includes(jobId)) {
      set({ selectedJobs: selectedJobs.filter(id => id !== jobId) });
    } else {
      set({ selectedJobs: [...selectedJobs, jobId] });
    }
  },
  
  selectAllJobs: () => {
    const { getFilteredAndSortedJobs } = get();
    const allJobs = getFilteredAndSortedJobs();
    set({ selectedJobs: allJobs.map(j => j.id) });
  },
  
  deselectAllJobs: () => {
    set({ selectedJobs: [] });
  },
  
  setBulkActionInProgress: (inProgress: boolean) => {
    set({ bulkActionInProgress: inProgress });
  },
  
  // Auto-refresh
  setAutoRefreshInterval: (interval: number | null) => {
    set({ autoRefreshInterval: interval });
  },
  
  refreshJobs: async () => {
    try {
      const { getRecentJobs } = await import('../services/aiEnhancement');
      const { setInitial } = get();
      const limit = get().pageSize * 10; // Load enough for pagination
      const data = await getRecentJobs(limit);
      setInitial(data.jobs);
      set({ lastRefreshTime: Date.now(), connectionStatus: 'connected' });
    } catch (error) {
      console.error('[EnhancementStore] Failed to refresh jobs:', error);
      set({ connectionStatus: 'disconnected' });
    }
  },
  
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting') => {
    set({ connectionStatus: status });
  },
  
  // Analytics
  calculateAnalytics: () => {
    const { jobs, order } = get();
    const allJobs = order.map(id => jobs[id]).filter(Boolean);
    
    if (allJobs.length === 0) {
      set({ analyticsData: null });
      return;
    }
    
    // Group jobs by date
    const jobsByDate = new Map<string, { jobs: number; completed: number; failed: number }>();
    allJobs.forEach(job => {
      if (!job.created_at) return;
      const date = new Date(job.created_at).toISOString().split('T')[0];
      const existing = jobsByDate.get(date) || { jobs: 0, completed: 0, failed: 0 };
      existing.jobs++;
      if (job.status === 'completed') existing.completed++;
      if (job.status === 'failed') existing.failed++;
      jobsByDate.set(date, existing);
    });
    
    const timeline = Array.from(jobsByDate.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days
    
    // Calculate success rates
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const calculateSuccessRate = (since: Date) => {
      const filtered = allJobs.filter(j => {
        if (!j.created_at) return false;
        const jobDate = new Date(j.created_at);
        return jobDate >= since;
      });
      if (filtered.length === 0) return 0;
      const completed = filtered.filter(j => j.status === 'completed').length;
      return (completed / filtered.length) * 100;
    };
    
    const successRates = {
      daily: calculateSuccessRate(oneDayAgo),
      weekly: calculateSuccessRate(oneWeekAgo),
      monthly: calculateSuccessRate(oneMonthAgo),
    };
    
    // Calculate processing times (simplified - would need actual timing data)
    const processingTimesByType: Record<string, number[]> = {};
    allJobs.forEach(job => {
      if (job.status !== 'completed' || !job.created_at || !job.completed_at) return;
      const start = new Date(job.created_at).getTime();
      const end = new Date(job.completed_at).getTime();
      const duration = (end - start) / 1000; // seconds
      
      const type = job.mode || 'unknown';
      if (!processingTimesByType[type]) {
        processingTimesByType[type] = [];
      }
      processingTimesByType[type].push(duration);
    });
    
    const processingTimes = {
      byType: Object.fromEntries(
        Object.entries(processingTimesByType).map(([type, times]) => [
          type,
          times.reduce((sum, t) => sum + t, 0) / times.length,
        ])
      ),
      average: 0, // Would need actual timing data
    };
    
    // Material usage (would need to extract from job payloads)
    const materialUsage: Record<string, number> = {};
    
    // Error breakdown
    const errorBreakdown: Record<string, number> = {
      network: 0,
      timeout: 0,
      validation: 0,
      provider: 0,
      unknown: 0,
    };
    
    allJobs.forEach(job => {
      if (job.status !== 'failed' || !job.error_message) return;
      const error = job.error_message.toLowerCase();
      if (error.includes('timeout') || error.includes('timed out')) {
        errorBreakdown.timeout++;
      } else if (error.includes('network') || error.includes('fetch') || error.includes('connection')) {
        errorBreakdown.network++;
      } else if (error.includes('invalid') || error.includes('validation')) {
        errorBreakdown.validation++;
      } else if (error.includes('provider') || error.includes('service')) {
        errorBreakdown.provider++;
      } else {
        errorBreakdown.unknown++;
      }
    });
    
    set({
      analyticsData: {
        timeline,
        successRates,
        processingTimes,
        materialUsage,
        errorBreakdown,
      },
    });
  },
  
  // Grouping
  setGroupBy: (groupBy) => {
    set({ groupBy, expandedGroups: new Set<string>() });
  },
  
  toggleGroup: (groupId) => {
    const { expandedGroups } = get();
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    set({ expandedGroups: newExpanded });
  },
  
  getGroupedJobs: () => {
    const { groupBy, getFilteredAndSortedJobs, expandedGroups } = get();
    const jobs = getFilteredAndSortedJobs();
    
    if (groupBy === 'none') {
      return [{ groupId: 'all', label: 'All Jobs', jobs, count: jobs.length }];
    }
    
    const groups = new Map<string, Job[]>();
    
    jobs.forEach(job => {
      let groupId = '';
      let label = '';
      
      if (groupBy === 'date') {
        if (!job.created_at) {
          groupId = 'unknown';
          label = 'Unknown Date';
        } else {
          const date = new Date(job.created_at);
          const now = new Date();
          const diff = now.getTime() - date.getTime();
          const days = Math.floor(diff / (24 * 60 * 60 * 1000));
          
          if (days === 0) {
            groupId = 'today';
            label = 'Today';
          } else if (days === 1) {
            groupId = 'yesterday';
            label = 'Yesterday';
          } else if (days < 7) {
            groupId = 'this-week';
            label = 'This Week';
          } else if (days < 30) {
            groupId = 'this-month';
            label = 'This Month';
          } else {
            groupId = 'older';
            label = 'Older';
          }
        }
      } else if (groupBy === 'status') {
        const status = job.status;
        groupId = status;
        label = status === 'completed' ? 'Completed' :
                status === 'failed' ? 'Failed' :
                status === 'canceled' ? 'Canceled' :
                isProcessing(status) ? 'Processing' :
                'Queued';
      } else if (groupBy === 'type') {
        const type = job.mode || 'unknown';
        groupId = type;
        label = type === 'add_pool' ? 'Add Pool' :
                type === 'add_decoration' ? 'Add Decoration' :
                type === 'blend_materials' ? 'Blend Materials' :
                'Unknown Type';
      }
      
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId)!.push(job);
    });
    
    // Sort groups by priority
    const groupOrder: Record<string, number> = {
      // Date order
      'today': 0, 'yesterday': 1, 'this-week': 2, 'this-month': 3, 'older': 4,
      // Status order
      'completed': 0, 'queued': 1, 'downloading': 2, 'preprocessing': 3, 'rendering': 4, 'postprocessing': 5, 'uploading': 6, 'failed': 7, 'canceled': 8,
      // Type order
      'add_pool': 0, 'add_decoration': 1, 'blend_materials': 2, 'unknown': 3,
    };
    
    return Array.from(groups.entries())
      .map(([groupId, groupJobs]) => {
        let label = '';
        if (groupBy === 'date') {
          label = groupId === 'today' ? 'Today' : 
                  groupId === 'yesterday' ? 'Yesterday' : 
                  groupId === 'this-week' ? 'This Week' : 
                  groupId === 'this-month' ? 'This Month' : 
                  'Older';
        } else if (groupBy === 'status') {
          label = groupId === 'completed' ? 'Completed' : 
                  groupId === 'failed' ? 'Failed' : 
                  groupId === 'canceled' ? 'Canceled' : 
                  isProcessing(groupId as Job['status']) ? 'Processing' : 
                  'Queued';
        } else if (groupBy === 'type') {
          label = groupId === 'add_pool' ? 'Add Pool' : 
                  groupId === 'add_decoration' ? 'Add Decoration' : 
                  groupId === 'blend_materials' ? 'Blend Materials' : 
                  'Unknown Type';
        } else {
          label = groupId;
        }
        
        return {
          groupId,
          label,
          jobs: groupJobs,
          count: groupJobs.length,
        };
      })
      .sort((a, b) => {
        const aOrder = groupOrder[a.groupId] ?? 999;
        const bOrder = groupOrder[b.groupId] ?? 999;
        return aOrder - bOrder;
      });
  },
}));

