/**
 * Real-time Status Updates and Cross-page Notifications
 * Provides real-time synchronization of project status across different pages
 */

export interface StatusUpdate {
  id: string;
  type: 'project_update' | 'canvas_work' | 'quote_generated' | 'material_assigned' | 'mask_created' | 'mask_modified';
  projectId: string;
  photoId?: string;
  maskId?: string;
  quoteId?: string;
  materialId?: string;
  message: string;
  timestamp: Date;
  severity: 'info' | 'success' | 'warning' | 'error';
  data?: any; // Additional context data
}

export interface NotificationSettings {
  enabled: boolean;
  showInApp: boolean;
  showBrowser: boolean;
  soundEnabled: boolean;
  types: {
    project_update: boolean;
    canvas_work: boolean;
    quote_generated: boolean;
    material_assigned: boolean;
    mask_created: boolean;
    mask_modified: boolean;
  };
}

export interface StatusSyncStore {
  notifications: StatusUpdate[];
  settings: NotificationSettings;
  lastSyncTime: Date | null;
  isOnline: boolean;
  
  // Actions
  addNotification: (update: Omit<StatusUpdate, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  markAsRead: (id: string) => void;
  syncProjectStatus: (projectId: string) => Promise<void>;
  checkForUpdates: () => Promise<void>;
}
