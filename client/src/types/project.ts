/**
 * Project Context Types for Phase 1 Implementation
 * These types define the project-based architecture for canvas editor synchronization
 */

export interface ClientInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

export interface Photo {
  id: string;
  jobId: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: Date;
  lastModified: Date;
  canvasState?: CanvasState;
}

export interface CanvasState {
  photoId: string;
  masks: any[]; // Will use existing mask types from maskcore/store
  calibration: any; // Will use existing calibration types
  photoSpace: any; // Will use existing photoSpace types
  materials: any[]; // Will use existing material types
  lastSaved: Date;
  version: number;
}

export interface Project {
  id: string;
  jobId: string;
  name: string;
  client: ClientInfo;
  photos: Photo[];
  canvasStates: Record<string, CanvasState>; // photoId -> canvas data
  quotes: any[]; // Will use existing quote types
  materials: any[]; // Will use existing material types
  status: 'draft' | 'in_progress' | 'completed';
  createdAt: Date;
  lastModified: Date;
}

export interface ProjectContext {
  project: Project | null;
  currentPhoto: Photo | null;
  isLoading: boolean;
  error: string | null;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
}

export interface ProjectActions {
  loadProject: (jobId: string) => Promise<void>;
  loadPhoto: (photoId: string) => Promise<void>;
  saveCanvasState: (photoId: string, canvasState: CanvasState) => Promise<void>;
  createPhoto: (photoData: Partial<Photo>) => Promise<Photo>;
  updateProject: (updates: Partial<Project>) => Promise<void>;
}
