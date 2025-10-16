import React, { useRef } from 'react';
import { useEditor } from './store';

export function Toolbar() {
  const { doc, dispatch } = useEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      dispatch({ type: 'bg/load-fail', message: 'Please select an image file' });
      return;
    }

    dispatch({ type: 'bg/load-start', file });

    try {
      const url = URL.createObjectURL(file);
      
      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        dispatch({ 
          type: 'bg/load-success', 
          url, 
          w: img.naturalWidth, 
          h: img.naturalHeight 
        });
      };
      img.onerror = () => {
        dispatch({ type: 'bg/load-fail', message: 'Failed to load image' });
      };
      img.src = url;
    } catch (error) {
      dispatch({ type: 'bg/load-fail', message: 'Failed to process image' });
    }
  };

  const handleExport = () => {
    // Get the PixiJS app from the stage
    const stageElement = document.querySelector('[data-editor-stage] canvas');
    if (!stageElement) {
      console.error('Canvas not found');
      return;
    }
    
    // Create a temporary link to download the canvas as PNG
    const link = document.createElement('a');
    link.download = 'canvas-export.png';
    link.href = stageElement.toDataURL('image/png');
    link.click();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      dispatch({ type: 'mask/cancel' });
    } else if (event.key === 'Enter') {
      dispatch({ type: 'mask/commit' });
    } else if (event.key === 'a' || event.key === 'A') {
      event.preventDefault();
      dispatch({ type: 'mode/set', mode: 'draw-area' });
    } else if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      dispatch({ type: 'mode/set', mode: 'select' });
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      dispatch({ type: 'undo' });
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) {
      event.preventDefault();
      dispatch({ type: 'redo' });
    }
  };

  const canUndo = doc.history.past.length > 0;
  const canRedo = doc.history.future.length > 0;

  return (
    <div 
      className="flex items-center gap-2 p-4 bg-gray-900 text-white border-b border-gray-700"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Upload */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
      >
        Upload Photo
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Fit */}
      <button
        onClick={() => {
          const container = document.querySelector('[data-editor-stage]')?.getBoundingClientRect();
          if (container) {
            dispatch({ 
              type: 'view/fit', 
              containerW: container.width, 
              containerH: container.height 
            });
          }
        }}
        disabled={doc.status !== 'ready'}
        className="px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-500 rounded text-sm font-medium"
      >
        Fit
      </button>

      <div className="w-px h-6 bg-gray-600" />

      {/* Tools */}
      <button
        onClick={() => dispatch({ type: 'mode/set', mode: 'select' })}
        className={`px-3 py-2 rounded text-sm font-medium ${
          doc.mode === 'select' 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-600 hover:bg-gray-700'
        }`}
      >
        Select
      </button>

      <button
        onClick={() => dispatch({ type: 'mode/set', mode: 'draw-area' })}
        className={`px-3 py-2 rounded text-sm font-medium ${
          doc.mode === 'draw-area' 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-600 hover:bg-gray-700'
        }`}
      >
        Area (A)
      </button>

      <div className="w-px h-6 bg-gray-600" />

      {/* History */}
      <button
        onClick={() => dispatch({ type: 'undo' })}
        disabled={!canUndo}
        className="px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-500 rounded text-sm font-medium"
      >
        Undo (Ctrl+Z)
      </button>

      <button
        onClick={() => dispatch({ type: 'redo' })}
        disabled={!canRedo}
        className="px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-500 rounded text-sm font-medium"
      >
        Redo (Ctrl+Shift+Z)
      </button>

      <div className="flex-1" />

      {/* Export */}
      <button
        onClick={handleExport}
        disabled={doc.status !== 'ready'}
        className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-500 rounded text-sm font-medium"
      >
        Export PNG
      </button>

      {/* Status indicator */}
      <div className="text-sm text-gray-400">
        {doc.status === 'idle' && 'Upload a photo to start'}
        {doc.status === 'loading' && 'Loading...'}
        {doc.status === 'ready' && `${Object.keys(doc.masks).length} masks`}
        {doc.status === 'error' && `Error: ${doc.error}`}
      </div>
    </div>
  );
}
