/**
 * Status Sync Store
 * Manages real-time status updates and cross-page notifications with smart intelligence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StatusUpdate, NotificationSettings, StatusSyncStore } from '../types/statusSync';
import { useProjectStore } from './projectStore';
import { useMaskStore } from '../maskcore/store';
import { 
  smartNotificationEngine, 
  SmartNotification, 
  NotificationContext, 
  WorkflowSuggestion,
  UserNotificationPreferences,
  NotificationGroup,
  NotificationFilter
} from '../services/SmartNotificationEngine';

interface EnhancedStatusSyncStore extends StatusSyncStore {
  // Smart notification features
  smartNotifications: SmartNotification[];
  workflowSuggestions: WorkflowSuggestion[];
  userPreferences: UserNotificationPreferences;
  notificationGroups: NotificationGroup[];
  customFilters: NotificationFilter[];
  
  // Enhanced actions
  addSmartNotification: (notification: StatusUpdate, context: NotificationContext) => void;
  generateWorkflowSuggestions: (projectId: string) => WorkflowSuggestion[];
  executeSuggestion: (suggestionId: string) => void;
  updateUserPreferences: (preferences: Partial<UserNotificationPreferences>) => void;
  getContextualNotifications: () => SmartNotification[];
  markSuggestionCompleted: (suggestionId: string) => void;
  
  // Smart filtering actions
  applySmartFiltering: () => void;
  getFilteredNotifications: () => { notifications: SmartNotification[]; groups: NotificationGroup[] };
  addCustomFilter: (filter: NotificationFilter) => void;
  removeCustomFilter: (filterId: string) => void;
  updateFilter: (filterId: string, updates: Partial<NotificationFilter>) => void;
  getNotificationStats: () => { total: number; byCategory: Record<string, number>; byPriority: Record<string, number> };
}

export const useStatusSyncStore = create<EnhancedStatusSyncStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      smartNotifications: [],
      workflowSuggestions: [],
      userPreferences: {
        enableWorkflowSuggestions: true,
        enableDeadlineAlerts: true,
        enableCollaborationNotifications: true,
        enableAchievementNotifications: true,
        quietHours: { start: '22:00', end: '08:00' },
        maxNotificationsPerDay: 50,
        priorityThreshold: 'medium',
        categoryFilters: {
          workflow: true,
          deadline: true,
          collaboration: true,
          system: true,
          achievement: true
        },
        projectFilters: {
          enabled: false,
          projectIds: [],
          excludeProjectIds: []
        },
        timeBasedFiltering: {
          enabled: true,
          maxAgeHours: 72,
          respectBusinessHours: true,
          businessHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] }
        },
        frequencyLimits: {
          maxPerCategory: { workflow: 10, deadline: 5, collaboration: 8, system: 3, achievement: 2 },
          maxPerProject: {},
          cooldownMinutes: 30
        },
        smartGrouping: {
          enabled: true,
          groupSimilar: true,
          batchThreshold: 3
        }
      },
      notificationGroups: [],
      customFilters: [],
      settings: {
        enabled: true,
        showInApp: true,
        showBrowser: false,
        soundEnabled: true,
        types: {
          project_update: true,
          canvas_work: true,
          quote_generated: true,
          material_assigned: true,
          mask_created: true,
          mask_modified: true,
        },
      },
      lastSyncTime: null,
      isOnline: navigator.onLine,

      addNotification: (updateData) => {
        const { settings } = get();
        
        // Check if this type of notification is enabled
        if (!settings.enabled || !settings.types[updateData.type]) {
          return;
        }

        const notification: StatusUpdate = {
          ...updateData,
          id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
        };

        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 50), // Keep last 50
        }));

        // Show browser notification if enabled
        if (settings.showBrowser && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.message, {
            icon: '/favicon.ico',
            tag: notification.id,
          });
        }

        // Play sound if enabled
        if (settings.soundEnabled) {
          // Simple beep sound (you could replace with a proper audio file)
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);
        }

        console.log('[StatusSync] Notification added:', notification);
      },

      addSmartNotification: (notification, context) => {
        const { userPreferences } = get();
        
        // Generate smart notification using the engine
        const smartNotification = smartNotificationEngine.generateSmartNotification(
          notification,
          context
        );

        // Check if notification should be shown
        if (!smartNotificationEngine.shouldShowNotification(smartNotification)) {
          return;
        }

        set((state) => ({
          smartNotifications: [smartNotification, ...state.smartNotifications].slice(0, 100),
        }));

        // Generate workflow suggestions if enabled
        if (userPreferences.enableWorkflowSuggestions && context.projectId) {
          get().generateWorkflowSuggestions(context.projectId);
        }

        console.log('[SmartNotification] Added:', smartNotification);
      },

      generateWorkflowSuggestions: (projectId) => {
        const projectStore = useProjectStore.getState();
        const maskStore = useMaskStore.getState();
        
        const project = projectStore.project;
        if (!project || project.id !== projectId) {
          return [];
        }

        const projectData = {
          photos: project.photos,
          masks: Object.values(maskStore.masks),
          masksWithMaterials: Object.values(maskStore.masks).filter(m => m.materialId).length,
          quotes: Object.values(maskStore.quotes),
          jobId: project.jobId
        };

        const recentActivities = projectStore.getProjectActivities(projectId);
        const suggestions = smartNotificationEngine.generateWorkflowSuggestions(
          projectId,
          projectData,
          recentActivities
        );

        set((state) => ({
          workflowSuggestions: [...suggestions, ...state.workflowSuggestions].slice(0, 20),
        }));

        return suggestions;
      },

      executeSuggestion: (suggestionId) => {
        const { workflowSuggestions } = get();
        const suggestion = workflowSuggestions.find(s => s.id === suggestionId);
        
        if (!suggestion) {
          console.warn('[SmartNotification] Suggestion not found:', suggestionId);
          return;
        }

        // Execute the suggestion based on action type
        switch (suggestion.actionType) {
          case 'navigate':
            if (suggestion.actionData?.path) {
              window.location.href = suggestion.actionData.path;
            }
            break;
          case 'execute':
            console.log('[SmartNotification] Executing action:', suggestion.actionData);
            // TODO: Implement specific execution logic
            break;
          case 'schedule':
            console.log('[SmartNotification] Scheduling action:', suggestion.actionData);
            // TODO: Implement scheduling logic
            break;
          case 'contact':
            console.log('[SmartNotification] Contacting:', suggestion.actionData);
            // TODO: Implement contact logic
            break;
        }

        // Mark suggestion as completed
        get().markSuggestionCompleted(suggestionId);
      },

      updateUserPreferences: (preferences) => {
        set((state) => ({
          userPreferences: { ...state.userPreferences, ...preferences }
        }));
      },

      getContextualNotifications: () => {
        const { smartNotifications, userPreferences } = get();
        
        return smartNotifications.filter(notification => {
          // Filter based on user preferences
          if (!userPreferences.enableWorkflowSuggestions && notification.category === 'workflow') {
            return false;
          }
          if (!userPreferences.enableDeadlineAlerts && notification.category === 'deadline') {
            return false;
          }
          if (!userPreferences.enableCollaborationNotifications && notification.category === 'collaboration') {
            return false;
          }
          if (!userPreferences.enableAchievementNotifications && notification.category === 'achievement') {
            return false;
          }

          // Check if notification has expired
          if (notification.expiresAt && new Date() > notification.expiresAt) {
            return false;
          }

          return true;
        });
      },

      markSuggestionCompleted: (suggestionId) => {
        set((state) => ({
          workflowSuggestions: state.workflowSuggestions.filter(s => s.id !== suggestionId)
        }));
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id),
        }));
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map(n => 
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      syncProjectStatus: async (projectId) => {
        try {
          const projectStore = useProjectStore.getState();
          const maskStore = useMaskStore.getState();
          
          // Get current project data
          const project = projectStore.project;
          if (!project || project.id !== projectId) {
            return;
          }

          // Check for changes since last sync
          const lastSync = get().lastSyncTime;
          const now = new Date();
          
          // Simulate checking for updates (in real implementation, this would be an API call)
          const hasUpdates = !lastSync || (now.getTime() - lastSync.getTime()) > 30000; // 30 seconds
          
          if (hasUpdates) {
            // Add notification about project sync
            get().addNotification({
              type: 'project_update',
              projectId,
              message: `Project "${project.name}" status synchronized`,
              severity: 'info',
            });

            set({ lastSyncTime: now });
          }
        } catch (error) {
          console.error('[StatusSync] Error syncing project status:', error);
        }
      },

      checkForUpdates: async () => {
        try {
          const projectStore = useProjectStore.getState();
          const maskStore = useMaskStore.getState();
          
          if (!projectStore.project) {
            return;
          }

          // Check for various types of updates
          const project = projectStore.project;
          const masks = Object.values(maskStore.masks);
          
          // Check for new canvas work
          const recentCanvasWork = masks.filter(mask => 
            mask.lastModified && 
            mask.lastModified > (get().lastSyncTime?.getTime() || 0)
          );

          if (recentCanvasWork.length > 0) {
            get().addNotification({
              type: 'canvas_work',
              projectId: project.id,
              message: `${recentCanvasWork.length} mask(s) updated in "${project.name}"`,
              severity: 'success',
              data: { maskCount: recentCanvasWork.length },
            });
          }

          // Check for new quotes
          const quotes = Object.values(maskStore.quotes);
          const recentQuotes = quotes.filter(quote => 
            quote.createdAt > (get().lastSyncTime?.getTime() || 0)
          );

          if (recentQuotes.length > 0) {
            get().addNotification({
              type: 'quote_generated',
              projectId: project.id,
              message: `New quote generated for "${project.name}"`,
              severity: 'success',
              data: { quoteCount: recentQuotes.length },
            });
          }

          set({ lastSyncTime: new Date() });
        } catch (error) {
          console.error('[StatusSync] Error checking for updates:', error);
        }
      },

      // Smart filtering actions
      applySmartFiltering: () => {
        const { smartNotifications, userPreferences } = get();
        
        // Update the smart notification engine with current preferences
        smartNotificationEngine.updateUserPreferences(userPreferences);
        
        // Apply smart filtering
        const { filtered, grouped } = smartNotificationEngine.applySmartFiltering(
          smartNotifications,
          smartNotifications.slice(0, 20) // Recent notifications for context
        );

        set((state) => ({
          smartNotifications: filtered,
          notificationGroups: grouped
        }));

        console.log('[SmartFiltering] Applied filtering:', { 
          original: smartNotifications.length, 
          filtered: filtered.length, 
          grouped: grouped.length 
        });
      },

      getFilteredNotifications: () => {
        const { smartNotifications, notificationGroups } = get();
        
        // Apply real-time filtering
        get().applySmartFiltering();
        
        return {
          notifications: smartNotifications,
          groups: notificationGroups
        };
      },

      addCustomFilter: (filter) => {
        set((state) => ({
          customFilters: [...state.customFilters, filter]
        }));
        
        // Add to smart notification engine
        smartNotificationEngine.addCustomFilter(filter);
        
        console.log('[SmartFiltering] Custom filter added:', filter.id);
      },

      removeCustomFilter: (filterId) => {
        set((state) => ({
          customFilters: state.customFilters.filter(f => f.id !== filterId)
        }));
        
        // Remove from smart notification engine
        smartNotificationEngine.removeCustomFilter(filterId);
        
        console.log('[SmartFiltering] Custom filter removed:', filterId);
      },

      updateFilter: (filterId, updates) => {
        set((state) => ({
          customFilters: state.customFilters.map(f => 
            f.id === filterId ? { ...f, ...updates } : f
          )
        }));
        
        console.log('[SmartFiltering] Custom filter updated:', filterId);
      },

      getNotificationStats: () => {
        const { smartNotifications } = get();
        
        const stats = {
          total: smartNotifications.length,
          byCategory: {} as Record<string, number>,
          byPriority: {} as Record<string, number>
        };

        smartNotifications.forEach(notification => {
          // Count by category
          stats.byCategory[notification.category] = (stats.byCategory[notification.category] || 0) + 1;
          
          // Count by priority
          stats.byPriority[notification.priority] = (stats.byPriority[notification.priority] || 0) + 1;
        });

        return stats;
      },
    }),
    {
      name: 'poolVisual-status-sync-store',
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 20), // Only persist last 20
        smartNotifications: state.smartNotifications.slice(0, 30), // Persist last 30 smart notifications
        workflowSuggestions: state.workflowSuggestions.slice(0, 10), // Persist last 10 suggestions
        userPreferences: state.userPreferences,
        notificationGroups: state.notificationGroups.slice(0, 10), // Persist last 10 groups
        customFilters: state.customFilters, // Persist all custom filters
        settings: state.settings,
        lastSyncTime: state.lastSyncTime,
      }),
    }
  )
);

// Request notification permission on store initialization
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Listen for online/offline events
window.addEventListener('online', () => {
  useStatusSyncStore.setState({ isOnline: true });
});

window.addEventListener('offline', () => {
  useStatusSyncStore.setState({ isOnline: false });
});
