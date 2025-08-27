/**
 * Enhanced Editor Store Hook
 * Provides centralized state management for the Canvas Editor
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
// Use the existing editor store for now
import { useEditorStore as existingStore } from './editorSlice';

export const useEditorStore = existingStore;

// Editor store is already defined in editorSlice.ts

// Set up keyboard shortcuts
if (typeof window !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    const store = useEditorStore.getState();
    
    // Ctrl/Cmd + Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      store.undo();
    }
    
    // Ctrl/Cmd + Shift + Z for redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      store.redo();
    }
    
    // Tool shortcuts
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault();
          store.setActiveTool('area');
          break;
        case 'l':
          e.preventDefault();
          store.setActiveTool('linear');
          break;
        case 'w':
          e.preventDefault();
          store.setActiveTool('waterline');
          break;
        case 'e':
          e.preventDefault();
          store.setActiveTool('eraser');
          break;
        case 'h':
          e.preventDefault();
          store.setActiveTool('hand');
          break;
        case 'm':
          e.preventDefault();
          // Focus materials tab - this would need to be implemented in the UI
          break;
      }
    }
  });
}