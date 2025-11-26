/**
 * Test Component for Project-Aware Canvas Editor
 * This component helps verify that the implementation works correctly
 */

import React from 'react';
import { ProjectCanvasEditor } from '../components/project/ProjectCanvasEditor';

interface ProjectCanvasEditorTestProps {
  jobId: string;
  photoId?: string;
}

export function ProjectCanvasEditorTest({ jobId, photoId }: ProjectCanvasEditorTestProps) {
  console.log('[ProjectCanvasEditorTest] Rendering with:', { jobId, photoId });
  
  return (
    <div className="h-screen">
      <div className="bg-primary/5 border-b border-primary/20 px-4 py-2 text-sm">
        <strong>Test Mode:</strong> Project Canvas Editor - Job: {jobId}, Photo: {photoId || 'None'}
      </div>
      <ProjectCanvasEditor jobId={jobId} photoId={photoId} />
    </div>
  );
}

export default ProjectCanvasEditorTest;
