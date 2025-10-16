/**
 * Smart Filtering Panel
 * Provides UI for managing notification filtering and preferences
 */

import React, { useState, useEffect } from 'react';
import { useStatusSyncStore } from '../../stores/statusSyncStore';
import { UserNotificationPreferences, NotificationFilter } from '../../services/SmartNotificationEngine';
import { 
  Filter, 
  Settings, 
  Bell, 
  Clock, 
  Users, 
  Workflow, 
  AlertTriangle,
  CheckCircle,
  X,
  Plus,
  Edit,
  Trash2,
  BarChart3
} from 'lucide-react';

interface SmartFilteringPanelProps {
  projectId?: string;
}

export const SmartFilteringPanel: React.FC<SmartFilteringPanelProps> = ({ projectId }) => {
  const {
    userPreferences,
    customFilters,
    notificationGroups,
    getNotificationStats,
    updateUserPreferences,
    addCustomFilter,
    removeCustomFilter,
    updateFilter,
    applySmartFiltering
  } = useStatusSyncStore();

  const [activeTab, setActiveTab] = useState<'preferences' | 'filters' | 'stats'>('preferences');
  const [editingFilter, setEditingFilter] = useState<NotificationFilter | null>(null);
  const [showAddFilter, setShowAddFilter] = useState(false);

  const stats = getNotificationStats();

  useEffect(() => {
    // Apply smart filtering when preferences change
    applySmartFiltering();
  }, [userPreferences, applySmartFiltering]);

  const handlePreferenceChange = (key: keyof UserNotificationPreferences, value: any) => {
    updateUserPreferences({ [key]: value });
  };

  const handleCategoryFilterChange = (category: string, enabled: boolean) => {
    updateUserPreferences({
      categoryFilters: {
        ...userPreferences.categoryFilters,
        [category]: enabled
      }
    });
  };

  const handleBusinessHoursChange = (field: string, value: any) => {
    updateUserPreferences({
      timeBasedFiltering: {
        ...userPreferences.timeBasedFiltering,
        businessHours: {
          ...userPreferences.timeBasedFiltering.businessHours,
          [field]: value
        }
      }
    });
  };

  const handleFrequencyLimitChange = (category: string, limit: number) => {
    updateUserPreferences({
      frequencyLimits: {
        ...userPreferences.frequencyLimits,
        maxPerCategory: {
          ...userPreferences.frequencyLimits.maxPerCategory,
          [category]: limit
        }
      }
    });
  };

  const createCustomFilter = () => {
    const newFilter: NotificationFilter = {
      id: `custom-${Date.now()}`,
      name: 'New Custom Filter',
      description: 'Custom notification filter',
      conditions: [
        { field: 'category', operator: 'equals', value: 'workflow' }
      ],
      actions: [
        { type: 'hide', parameters: { condition: 'custom' } }
      ],
      enabled: true,
      priority: 10
    };
    
    addCustomFilter(newFilter);
    setEditingFilter(newFilter);
  };

  const deleteCustomFilter = (filterId: string) => {
    removeCustomFilter(filterId);
    if (editingFilter?.id === filterId) {
      setEditingFilter(null);
    }
  };

  const toggleFilterEnabled = (filterId: string) => {
    const filter = customFilters.find(f => f.id === filterId);
    if (filter) {
      updateFilter(filterId, { enabled: !filter.enabled });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'workflow': return <Workflow className="w-4 h-4" />;
      case 'deadline': return <Clock className="w-4 h-4" />;
      case 'collaboration': return <Users className="w-4 h-4" />;
      case 'system': return <Settings className="w-4 h-4" />;
      case 'achievement': return <CheckCircle className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Smart Filtering</h3>
          <p className="text-sm text-slate-600">Manage notification preferences and filters</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="text-sm text-slate-500">
            {stats.total} notifications
          </div>
          <button
            onClick={() => applySmartFiltering()}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center border-b border-slate-200">
        {[
          { id: 'preferences', label: 'Preferences', icon: Settings },
          { id: 'filters', label: 'Custom Filters', icon: Filter },
          { id: 'stats', label: 'Statistics', icon: BarChart3 }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-6">
            {/* Category Filters */}
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-3">Notification Categories</h4>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(userPreferences.categoryFilters).map(([category, enabled]) => (
                  <label key={category} className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => handleCategoryFilterChange(category, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(category)}
                      <span className="text-sm font-medium text-slate-700 capitalize">{category}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Time-based Filtering */}
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-3">Time-based Filtering</h4>
              <div className="space-y-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={userPreferences.timeBasedFiltering.enabled}
                    onChange={(e) => handlePreferenceChange('timeBasedFiltering', {
                      ...userPreferences.timeBasedFiltering,
                      enabled: e.target.checked
                    })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Enable time-based filtering</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={userPreferences.timeBasedFiltering.respectBusinessHours}
                    onChange={(e) => handlePreferenceChange('timeBasedFiltering', {
                      ...userPreferences.timeBasedFiltering,
                      respectBusinessHours: e.target.checked
                    })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Respect business hours</span>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Hours Start</label>
                    <input
                      type="time"
                      value={userPreferences.timeBasedFiltering.businessHours.start}
                      onChange={(e) => handleBusinessHoursChange('start', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Hours End</label>
                    <input
                      type="time"
                      value={userPreferences.timeBasedFiltering.businessHours.end}
                      onChange={(e) => handleBusinessHoursChange('end', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Frequency Limits */}
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-3">Frequency Limits</h4>
              <div className="space-y-3">
                {Object.entries(userPreferences.frequencyLimits.maxPerCategory).map(([category, limit]) => (
                  <div key={category} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(category)}
                      <span className="text-sm font-medium text-slate-700 capitalize">{category}</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={limit}
                      onChange={(e) => handleFrequencyLimitChange(category, parseInt(e.target.value))}
                      className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Smart Grouping */}
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-3">Smart Grouping</h4>
              <div className="space-y-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={userPreferences.smartGrouping.enabled}
                    onChange={(e) => handlePreferenceChange('smartGrouping', {
                      ...userPreferences.smartGrouping,
                      enabled: e.target.checked
                    })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Enable smart grouping</span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Group Threshold</label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={userPreferences.smartGrouping.batchThreshold}
                    onChange={(e) => handlePreferenceChange('smartGrouping', {
                      ...userPreferences.smartGrouping,
                      batchThreshold: parseInt(e.target.value)
                    })}
                    className="w-20 px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom Filters Tab */}
        {activeTab === 'filters' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-900">Custom Filters</h4>
              <button
                onClick={createCustomFilter}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Filter</span>
              </button>
            </div>

            <div className="space-y-3">
              {customFilters.map((filter) => (
                <div key={filter.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={filter.enabled}
                      onChange={() => toggleFilterEnabled(filter.id)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-slate-900">{filter.name}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(filter.priority.toString())}`}>
                          Priority {filter.priority}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{filter.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEditingFilter(filter)}
                      className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteCustomFilter(filter.id)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {customFilters.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No custom filters created yet</p>
                  <p className="text-sm">Create your first custom filter to get started</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-blue-700">Total Notifications</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{notificationGroups.length}</div>
                <div className="text-sm text-green-700">Notification Groups</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{customFilters.length}</div>
                <div className="text-sm text-purple-700">Custom Filters</div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-3">Notifications by Category</h4>
              <div className="space-y-2">
                {Object.entries(stats.byCategory).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(category)}
                      <span className="text-sm font-medium text-slate-700 capitalize">{category}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority Breakdown */}
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-3">Notifications by Priority</h4>
              <div className="space-y-2">
                {Object.entries(stats.byPriority).map(([priority, count]) => (
                  <div key={priority} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium text-slate-700 capitalize">{priority}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
