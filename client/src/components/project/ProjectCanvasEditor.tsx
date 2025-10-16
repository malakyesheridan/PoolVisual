/**
 * Project-Aware Canvas Editor Component
 * Extends the existing NewEditor with project context and auto-save functionality
 */

import React, { useEffect, useRef } from 'react';
import { useRoute } from 'wouter';
import { NewEditor } from '../../new_editor/NewEditor';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../new_editor/store';
import { useMaskStore } from '../../maskcore/store';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Save, Clock, User, MapPin, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { QuoteGenerator } from '../editor/QuoteGenerator';

interface ProjectCanvasEditorProps {
  jobId: string;
  photoId?: string;
}

export function ProjectCanvasEditor({ jobId, photoId }: ProjectCanvasEditorProps) {
  const [, params] = useRoute('/jobs/:jobId/photo/:photoId/edit');
  const { 
    project, 
    currentPhoto, 
    isLoading, 
    error, 
    lastSaved, 
    hasUnsavedChanges,
    loadProject, 
    loadPhoto, 
    saveCanvasState 
  } = useProjectStore();

  const { getState: getEditorState } = useEditorStore();
  const { getState: getMaskState } = useMaskStore();
  
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveStateRef = useRef<string>('');

  // Load project on mount
  useEffect(() => {
    if (jobId && !project) {
      loadProject(jobId);
    }
  }, [jobId, project, loadProject]);

  // Load photo when project is loaded and photoId is provided
  useEffect(() => {
    if (project && photoId && (!currentPhoto || currentPhoto.id !== photoId)) {
      loadPhoto(photoId);
    }
  }, [project, photoId, currentPhoto, loadPhoto]);

  // Auto-save functionality
  useEffect(() => {
    if (!project || !currentPhoto) return;

    // Clear existing interval
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    // Set up auto-save every 30 seconds
    autoSaveIntervalRef.current = setInterval(() => {
      try {
        const editorState = getEditorState();
        const maskState = getMaskState();
        
        // Create a hash of the current state to detect changes
        const currentStateHash = JSON.stringify({
          masks: maskState.masks,
          calibration: editorState.calibration,
          photoSpace: editorState.photoSpace,
        });

        // Only save if state has changed
        if (currentStateHash !== lastSaveStateRef.current) {
          const canvasState = {
            photoId: currentPhoto.id,
            masks: Object.values(maskState.masks),
            calibration: editorState.calibration,
            photoSpace: editorState.photoSpace,
            materials: [], // Will be populated from materials store
            lastSaved: new Date(),
            version: 1,
          };

          saveCanvasState(currentPhoto.id, canvasState);
          lastSaveStateRef.current = currentStateHash;
        }
      } catch (error) {
        console.error('[ProjectCanvasEditor] Auto-save error:', error);
      }
    }, 30000); // 30 seconds

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [project, currentPhoto, saveCanvasState, getEditorState, getMaskState]);

  // Manual save function
  const handleManualSave = () => {
    if (!project || !currentPhoto) return;

    try {
      const editorState = getEditorState();
      const maskState = getMaskState();

      const canvasState = {
        photoId: currentPhoto.id,
        masks: Object.values(maskState.masks),
        calibration: editorState.calibration,
        photoSpace: editorState.photoSpace,
        materials: [],
        lastSaved: new Date(),
        version: 1,
      };

      saveCanvasState(currentPhoto.id, canvasState);
    } catch (error) {
      console.error('[ProjectCanvasEditor] Manual save error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">{error}</p>
            <Button onClick={() => loadProject(jobId)}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Project Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">The requested project could not be found.</p>
            <Button onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Project Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Job
            </Button>
            
            <div className="flex items-center space-x-3">
              <div>
                <h1 className="text-lg font-semibold text-slate-900">
                  {project.name}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-slate-500">
                  <div className="flex items-center space-x-1">
                    <User className="w-4 h-4" />
                    <span>{project.client.name}</span>
                  </div>
                  {project.client.address && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-4 h-4" />
                      <span>{project.client.address}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <Badge variant={project.status === 'completed' ? 'default' : 'secondary'}>
                {project.status}
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Save Status */}
            <div className="flex items-center space-x-2 text-sm text-slate-500">
              {hasUnsavedChanges ? (
                <>
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Unsaved changes</span>
                </>
              ) : lastSaved ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Saved {formatDistanceToNow(lastSaved)} ago</span>
                </>
              ) : null}
            </div>

            {/* Manual Save Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSave}
              disabled={!hasUnsavedChanges}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Now
            </Button>
          </div>
        </div>

        {/* Photo Info */}
        {currentPhoto && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-md font-medium text-slate-900">
                  {currentPhoto.name}
                </h2>
                <p className="text-sm text-slate-500">
                  Last modified: {formatDistanceToNow(currentPhoto.lastModified)} ago
                </p>
              </div>
              
              {/* Photo Navigation */}
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  Previous Photo
                </Button>
                <Button variant="outline" size="sm">
                  Next Photo
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Canvas Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Canvas Area */}
        <div className="flex-1">
          <NewEditor />
        </div>
        
        {/* Quote Generator Sidebar */}
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Quote Generator
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Generate quotes from your measurements
            </p>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto">
            <QuoteGenerator />
          </div>
        </div>
      </div>
    </div>
  );
}
