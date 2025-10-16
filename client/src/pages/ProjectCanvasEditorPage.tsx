/**
 * Project Canvas Editor Page
 * Wrapper page that extracts route parameters and passes them to ProjectCanvasEditor
 */

import React from 'react';
import { useRoute } from 'wouter';
import { ProjectCanvasEditor } from '../components/project/ProjectCanvasEditor';

export default function ProjectCanvasEditorPage() {
  const [, params] = useRoute('/jobs/:jobId/photo/:photoId/edit');
  
  const jobId = params?.jobId;
  const photoId = params?.photoId;

  if (!jobId) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Invalid Job ID</h1>
          <p className="text-slate-600">The job ID is missing from the URL.</p>
        </div>
      </div>
    );
  }

  return (
    <ProjectCanvasEditor 
      jobId={jobId} 
      photoId={photoId} 
    />
  );
}
