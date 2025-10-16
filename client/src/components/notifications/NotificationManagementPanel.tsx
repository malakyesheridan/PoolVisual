/**
 * Notification Management Panel
 * Comprehensive notification management with action buttons and smart filtering
 */

import React, { useState, useEffect } from 'react';
import { useStatusSyncStore } from '../../stores/statusSyncStore';
import { EnhancedNotificationPanel } from './EnhancedNotificationPanel';
import { SmartFilteringPanel } from '../dashboard/SmartFilteringPanel';
import { 
  Bell, 
  Settings, 
  Filter, 
  BarChart3, 
  RefreshCw,
  Eye,
  EyeOff,
  Archive,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Info,
  Star,
  Clock,
  Users,
  Workflow
} from 'lucide-react';

interface NotificationManagementPanelProps {
  projectId?: string;
  className?: string;
}

export const NotificationManagementPanel: React.FC<NotificationManagementPanelProps> = ({
  projectId,
  className = ''
}) => {
  const {
    smartNotifications,
    notificationGroups,
    getNotificationStats,
    applySmartFiltering,
    clearNotifications,
    userPreferences,
    updateUserPreferences
  } = useStatusSyncStore();

  const [activeTab, setActiveTab] = useState<'notifications' | 'filtering' | 'settings'>('notifications');
  const [showArchived, setShowArchived] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const stats = getNotificationStats();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      interval = setInterval(() => {
        applySmartFiltering();
      }, 30000); // Refresh every 30 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoRefresh, applySmartFiltering]);

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all notifications?')) {
      clearNotifications();
    }
  };

  const handleToggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'notifications': return <Bell className="w-4 h-4" />;
      case 'filtering': return <Filter className="w-4 h-4" />;
      case 'settings': return <Settings className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'medium': return <Info className="w-4 h-4 text-yellow-600" />;
      case 'low': return <CheckCircle className="w-4 h-4 text-green-600" />;
      default: return <Info className="w-4 h-4 text-gray-600" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'workflow': return <Workflow className="w-4 h-4" />;
      case 'deadline': return <Clock className="w-4 h-4" />;
      case 'collaboration': return <Users className="w-4 h-4" />;
      case 'system': return <Settings className="w-4 h-4" />;
      case 'achievement': return <Star className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Notification Center</h2>
          <p className="text-sm text-slate-600">
            Manage your notifications and workflow suggestions
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleToggleAutoRefresh}
            className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors ${
              autoRefresh 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            <span>{autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}</span>
          </button>
          
          <button
            onClick={() => applySmartFiltering()}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <Bell className="w-6 h-6 mx-auto mb-2 text-blue-600" />
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-blue-700">Total</div>
        </div>
        
        {Object.entries(stats.byPriority).map(([priority, count]) => (
          <div key={priority} className="bg-slate-50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              {getPriorityIcon(priority)}
            </div>
            <div className="text-2xl font-bold text-slate-900">{count}</div>
            <div className="text-sm text-slate-600 capitalize">{priority}</div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center border-b border-slate-200">
        {[
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'filtering', label: 'Smart Filtering', icon: Filter },
          { id: 'settings', label: 'Settings', icon: Settings }
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
        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Show archived</span>
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleClearAll}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear All</span>
                </button>
              </div>
            </div>

            {/* Enhanced Notification Panel */}
            <EnhancedNotificationPanel
              projectId={projectId}
              maxNotifications={100}
              showFilters={true}
              showGroups={true}
            />
          </div>
        )}

        {/* Smart Filtering Tab */}
        {activeTab === 'filtering' && (
          <SmartFilteringPanel projectId={projectId} />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Notification Preferences</h3>
              
              <div className="space-y-4">
                {/* Enable/Disable Categories */}
                <div>
                  <h4 className="text-sm font-medium text-slate-900 mb-3">Notification Categories</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(userPreferences.categoryFilters).map(([category, enabled]) => (
                      <label key={category} className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => updateUserPreferences({
                            categoryFilters: {
                              ...userPreferences.categoryFilters,
                              [category]: e.target.checked
                            }
                          })}
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

                {/* Priority Threshold */}
                <div>
                  <h4 className="text-sm font-medium text-slate-900 mb-3">Priority Threshold</h4>
                  <select
                    value={userPreferences.priorityThreshold}
                    onChange={(e) => updateUserPreferences({
                      priorityThreshold: e.target.value as any
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Show all notifications</option>
                    <option value="medium">Medium and above</option>
                    <option value="high">High and urgent only</option>
                    <option value="urgent">Urgent only</option>
                  </select>
                </div>

                {/* Quiet Hours */}
                <div>
                  <h4 className="text-sm font-medium text-slate-900 mb-3">Quiet Hours</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={userPreferences.quietHours.start}
                        onChange={(e) => updateUserPreferences({
                          quietHours: {
                            ...userPreferences.quietHours,
                            start: e.target.value
                          }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                      <input
                        type="time"
                        value={userPreferences.quietHours.end}
                        onChange={(e) => updateUserPreferences({
                          quietHours: {
                            ...userPreferences.quietHours,
                            end: e.target.value
                          }
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Daily Limit */}
                <div>
                  <h4 className="text-sm font-medium text-slate-900 mb-3">Daily Notification Limit</h4>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={userPreferences.maxNotificationsPerDay}
                    onChange={(e) => updateUserPreferences({
                      maxNotificationsPerDay: parseInt(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
