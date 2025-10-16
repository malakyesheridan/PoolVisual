import { useMaskStore } from '../../client/src/maskcore/store';
import { useEditorStore } from '../../client/src/new_editor/store';

export function getCamera(): { scale: number; panX: number; panY: number } {
  const editorState = useEditorStore.getState();
  return {
    scale: editorState.photoSpace?.scale || 1,
    panX: editorState.photoSpace?.panX || 0,
    panY: editorState.photoSpace?.panY || 0
  };
}

export function getImageFit(): { originX: number; originY: number; imgScale: number } {
  // Default image fit parameters - these would come from the image loading logic
  return {
    originX: 0,
    originY: 0,
    imgScale: 1
  };
}

export function getMasks(): Record<string, { id: string; mode: 'area' | 'polygon'; pts: { x: number; y: number }[] }> {
  const maskState = useMaskStore.getState();
  const result: Record<string, { id: string; mode: 'area' | 'polygon'; pts: { x: number; y: number }[] }> = {};
  
  Object.entries(maskState.masks).forEach(([id, mask]) => {
    result[id] = {
      id: mask.id,
      mode: 'area', // Default mode since the old store doesn't have mode
      pts: mask.pts || []
    };
  });
  
  return result;
}

export function getSelectedId(): string | null {
  const maskState = useMaskStore.getState();
  return maskState.selectedId;
}

export function setSelected(id: string | null): void {
  const maskState = useMaskStore.getState();
  
  if (typeof maskState.SELECT === 'function') {
    maskState.SELECT(id);
  } else {
    useMaskStore.setState({ selectedId: id });
  }
}

export function getActiveTool(): 'area' | 'polygon' | 'select' | null {
  const editorState = useEditorStore.getState();
  return editorState.activeTool === 'area' ? 'area' : 'select';
}
