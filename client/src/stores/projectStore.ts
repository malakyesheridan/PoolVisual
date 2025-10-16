/**
 * Project Context Store for Phase 1 Implementation
 * Manages project state and provides project-aware functionality
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProjectContext, Project, Photo, CanvasState, ProjectActions } from '../types/project';
import { apiClient } from '../lib/api-client';

// Activity tracking interfaces
export interface ProjectActivity {
  id: string;
  projectId: string;
  type: 'project_created' | 'photo_uploaded' | 'canvas_work' | 'quote_generated' | 'material_assigned' | 'status_changed' | 'client_contacted';
  message: string;
  timestamp: Date;
  data?: any; // Additional context data
  userId?: string;
}

export interface ProjectAnalytics {
  projectId: string;
  totalPhotos: number;
  photosWithCanvasWork: number;
  totalMasks: number;
  totalQuotes: number;
  lastActivity: Date | null;
  completionPercentage: number;
  estimatedValue: number;
  timeSpent: number; // in minutes
}

interface ProjectStoreState extends ProjectContext, ProjectActions {
  // Activity tracking
  activities: ProjectActivity[];
  analytics: Record<string, ProjectAnalytics>;
  
  // Activity actions
  addActivity: (activity: Omit<ProjectActivity, 'id' | 'timestamp'>) => void;
  getProjectActivities: (projectId: string) => ProjectActivity[];
  updateAnalytics: (projectId: string, updates: Partial<ProjectAnalytics>) => void;
  getProjectAnalytics: (projectId: string) => ProjectAnalytics | null;
}

const initialState: ProjectContext = {
  project: null,
  currentPhoto: null,
  isLoading: false,
  error: null,
  lastSaved: null,
  hasUnsavedChanges: false,
};

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Activity tracking state
      activities: [],
      analytics: {},

      loadProject: async (jobId: string) => {
        set({ isLoading: true, error: null });
        
        try {
          // Load job data from API
          const job = await apiClient.getJob(jobId);
          
          // Transform job data to project format
          const project: Project = {
            id: job.id,
            jobId: job.id,
            name: job.name || `Job ${job.id}`,
            client: {
              id: job.clientId || 'unknown',
              name: job.clientName || 'Unknown Client',
              email: job.clientEmail || '',
              phone: job.clientPhone,
              address: job.clientAddress,
            },
            photos: job.photos || [],
            canvasStates: {}, // Will be loaded separately
            quotes: job.quotes || [],
            materials: job.materials || [],
            status: job.status || 'draft',
            createdAt: new Date(job.createdAt || Date.now()),
            lastModified: new Date(job.lastModified || Date.now()),
          };

          set({
            project,
            isLoading: false,
            hasUnsavedChanges: false
          });

          // Add project loaded activity
          get().addActivity({
            projectId: project.id,
            type: 'project_created',
            message: `Project "${project.name}" loaded`,
            data: { projectName: project.name, clientName: project.client.name }
          });

          console.log('[ProjectStore] Project loaded:', project.name);
        } catch (error) {
          console.error('[ProjectStore] Failed to load project:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to load project',
            isLoading: false
          });
        }
      },

      loadPhoto: async (photoId: string) => {
        const { project } = get();
        if (!project) {
          set({ error: 'No project loaded' });
          return;
        }

        const photo = project.photos.find(p => p.id === photoId);
        if (!photo) {
          set({ error: 'Photo not found' });
          return;
        }

        // Load canvas state if it exists
        let canvasState: CanvasState | undefined;
        if (project.canvasStates[photoId]) {
          canvasState = project.canvasStates[photoId];
        }

        set({ 
          currentPhoto: photo,
          hasUnsavedChanges: false 
        });

        console.log('[ProjectStore] Photo loaded:', photo.name);
      },

      saveCanvasState: async (photoId: string, canvasState: CanvasState) => {
        const { project } = get();
        if (!project) {
          set({ error: 'No project loaded' });
          return;
        }

        try {
          // Update local state
          const updatedProject = {
            ...project,
            canvasStates: {
              ...project.canvasStates,
              [photoId]: {
                ...canvasState,
                lastSaved: new Date(),
                version: (project.canvasStates[photoId]?.version || 0) + 1,
              }
            },
            lastModified: new Date(),
          };

          set({ 
            project: updatedProject,
            lastSaved: new Date(),
            hasUnsavedChanges: false 
          });

          // TODO: Save to API when backend is ready
          console.log('[ProjectStore] Canvas state saved for photo:', photoId);
        } catch (error) {
          console.error('[ProjectStore] Failed to save canvas state:', error);
          set({ error: 'Failed to save canvas state' });
        }
      },

      createPhoto: async (photoData: Partial<Photo>) => {
        const { project } = get();
        if (!project) {
          set({ error: 'No project loaded' });
          throw new Error('No project loaded');
        }

        try {
          // Create photo via API
          const newPhoto = await apiClient.createPhoto({
            jobId: project.jobId,
            ...photoData,
          });

          // Update local state
          const updatedProject = {
            ...project,
            photos: [...project.photos, newPhoto],
            lastModified: new Date(),
          };

          set({ project: updatedProject });
          console.log('[ProjectStore] Photo created:', newPhoto.name);
          
          return newPhoto;
        } catch (error) {
          console.error('[ProjectStore] Failed to create photo:', error);
          set({ error: 'Failed to create photo' });
          throw error;
        }
      },

      updateProject: async (updates: Partial<Project>) => {
        const { project } = get();
        if (!project) {
          set({ error: 'No project loaded' });
          return;
        }

        try {
          const updatedProject = {
            ...project,
            ...updates,
            lastModified: new Date(),
          };

          set({ 
            project: updatedProject,
            hasUnsavedChanges: false 
          });

          // TODO: Save to API when backend is ready
          console.log('[ProjectStore] Project updated');
        } catch (error) {
          console.error('[ProjectStore] Failed to update project:', error);
          set({ error: 'Failed to update project' });
        }
      },

      // Activity tracking methods
      addActivity: (activityData) => {
        const activity: ProjectActivity = {
          ...activityData,
          id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
        };

        set((state) => ({
          activities: [activity, ...state.activities].slice(0, 100), // Keep last 100 activities
        }));

        // Update analytics
        get().updateAnalytics(activity.projectId, {
          lastActivity: activity.timestamp,
        });

        console.log('[ProjectStore] Activity added:', activity);
      },

      getProjectActivities: (projectId) => {
        const { activities } = get();
        return activities.filter(activity => activity.projectId === projectId);
      },

      updateAnalytics: (projectId, updates) => {
        set((state) => ({
          analytics: {
            ...state.analytics,
            [projectId]: {
              projectId,
              totalPhotos: 0,
              photosWithCanvasWork: 0,
              totalMasks: 0,
              totalQuotes: 0,
              lastActivity: null,
              completionPercentage: 0,
              estimatedValue: 0,
              timeSpent: 0,
              ...state.analytics[projectId],
              ...updates,
            },
          },
        }));
      },

      getProjectAnalytics: (projectId) => {
        const { analytics } = get();
        return analytics[projectId] || null;
      },
    }),
    {
      name: 'poolVisual-project-store',
      partialize: (state) => ({
        project: state.project,
        currentPhoto: state.currentPhoto,
        lastSaved: state.lastSaved,
        activities: state.activities.slice(0, 50), // Persist last 50 activities
        analytics: state.analytics,
      }),
    }
  )
);
