/**
 * Enhanced Notification Panel with Action Buttons
 * Provides a comprehensive notification management interface
 */

import React, { useState, useEffect } from 'react';
import { useStatusSyncStore } from '../../stores/statusSyncStore';
import { EnhancedNotificationItem, NotificationGroupItem } from './EnhancedNotificationItem';
import { 
  Bell, 
  Filter, 
  Search, 
  CheckCircle, 
  X, 
  Archive, 
  Flag, 
  Settings,
  RefreshCw,
  Eye,
  EyeOff,
  MoreHorizontal,
  SortAsc,
  SortDesc,
  Calendar,
  Clock,
  AlertTriangle,
  Info,
  CheckCircle2,
  Star
} from 'lucide-react';

interface EnhancedNotificationPanelProps {
  projectId?: string;
  maxNotifications?: number;
  showFilters?: boolean;
  showGroups?: boolean;
}

export const EnhancedNotificationPanel: React.FC<EnhancedNotificationPanelProps> = ({
  projectId,
  maxNotifications = 50,
  showFilters = true,
  showGroups = true
}) => {
  const {
    smartNotifications,
    notificationGroups,
    getFilteredNotifications,
    applySmartFiltering,
    getNotificationStats
  } = useStatusSyncStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'workflow' | 'deadline' | 'collaboration' | 'system' | 'achievement'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showArchived, setShowArchived] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const stats = getNotificationStats();

  useEffect(() => {
    // Apply smart filtering when component mounts or filters change
    applySmartFiltering();
  }, [applySmartFiltering]);

  const filteredNotifications = smartNotifications.filter(notification => {
    // Search filter
    if (searchTerm && !notification.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !notification.message.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Priority filter
    if (filterPriority !== 'all' && notification.priority !== filterPriority) {
      return false;
    }

    // Category filter
    if (filterCategory !== 'all' && notification.category !== filterCategory) {
      return false;
    }

    // Project filter
    if (projectId && notification.context?.projectId !== projectId) {
      return false;
    }

    return true;
  }).slice(0, maxNotifications);

  const filteredGroups = notificationGroups.filter(group => {
    // Search filter
    if (searchTerm && !group.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Priority filter
    if (filterPriority !== 'all' && group.priority !== filterPriority) {
      return false;
    }

    // Category filter
    if (filterCategory !== 'all' && group.category !== filterCategory) {
      return false;
    }

    return true;
  });

  const sortedNotifications = [...filteredNotifications].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'priority':
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleMarkAsRead = (id: string) => {
    // TODO: Implement mark as read functionality
    console.log('Mark as read:', id);
  };

  const handleDismiss = (id: string) => {
    // TODO: Implement dismiss functionality
    console.log('Dismiss:', id);
  };

  const handleArchive = (id: string) => {
    // TODO: Implement archive functionality
    console.log('Archive:', id);
  };

  const handleFlag = (id: string) => {
    // TODO: Implement flag functionality
    console.log('Flag:', id);
  };

  const handleExpandGroup = (groupId: string) => {
    setExpandedGroups(prev => new Set([...prev, groupId]));
  };

  const handleCollapseGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      newSet.delete(groupId);
      return newSet;
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'workflow': return <RefreshCw className="w-4 h-4" />;
      case 'deadline': return <Clock className="w-4 h-4" />;
      case 'collaboration': return <Bell className="w-4 h-4" />;
      case 'system': return <Settings className="w-4 h-4" />;
      case 'achievement': return <Star className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'medium': return <Info className="w-4 h-4 text-yellow-600" />;
      case 'low': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      default: return <Info className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Notifications</h3>
          <p className="text-sm text-slate-600">
            {stats.total} total notifications
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => applySmartFiltering()}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-slate-50 rounded-lg p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="workflow">Workflow</option>
                <option value="deadline">Deadline</option>
                <option value="collaboration">Collaboration</option>
                <option value="system">System</option>
                <option value="achievement">Achievement</option>
              </select>
            </div>

            {/* Sort Controls */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sort By</label>
              <div className="flex space-x-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="date">Date</option>
                  <option value="priority">Priority</option>
                  <option value="category">Category</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                >
                  {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(stats.byPriority).map(([priority, count]) => (
          <div key={priority} className="bg-slate-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              {getPriorityIcon(priority)}
            </div>
            <div className="text-lg font-bold text-slate-900">{count}</div>
            <div className="text-xs text-slate-600 capitalize">{priority}</div>
          </div>
        ))}
      </div>

      {/* Notification Groups */}
      {showGroups && filteredGroups.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-slate-900">Notification Groups</h4>
          <div className="space-y-3">
            {filteredGroups.map((group) => (
              <NotificationGroupItem
                key={group.id}
                group={group}
                onExpand={handleExpandGroup}
                onCollapse={handleCollapseGroup}
                isExpanded={expandedGroups.has(group.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Individual Notifications */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-slate-900">
          Individual Notifications ({sortedNotifications.length})
        </h4>
        
        {sortedNotifications.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No notifications found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedNotifications.map((notification) => (
              <EnhancedNotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                onDismiss={handleDismiss}
                onArchive={handleArchive}
                onFlag={handleFlag}
                showActions={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
