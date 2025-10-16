import React from 'react';
import { EditorProvider } from './store';
import { Toolbar } from './Toolbar';
import { EditorStage } from './EditorStage';
import { MaterialsPanel } from './MaterialsPanel';

export function CanvasEditorV2() {
  return (
    <EditorProvider>
      <div className="h-screen flex flex-col bg-gray-900">
        <Toolbar />
        <div className="flex-1 flex">
          <div className="flex-1 relative" data-editor-stage>
            <EditorStage />
          </div>
          <MaterialsPanel />
        </div>
      </div>
    </EditorProvider>
  );
}
