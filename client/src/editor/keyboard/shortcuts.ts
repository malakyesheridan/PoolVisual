// client/src/editor/keyboard/shortcuts.ts
export function shouldIgnoreShortcut(target: EventTarget | null): boolean {
  if (!target) return false;
  
  const element = target as HTMLElement;
  
  // Prevent triggers inside input, textarea, contenteditable, or [role="textbox"]
  if (element.tagName === 'INPUT' || 
      element.tagName === 'TEXTAREA' ||
      element.isContentEditable ||
      element.getAttribute('role') === 'textbox') {
    return true;
  }
  
  // Check if inside a contenteditable container
  let parent = element.parentElement;
  while (parent) {
    if (parent.isContentEditable) {
      return true;
    }
    parent = parent.parentElement;
  }
  
  return false;
}

export const keyboardShortcuts = {
  // Platform detection
  isMac: () => typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0,
  
  // Modifier keys
  getModifier: () => keyboardShortcuts.isMac() ? 'Meta' : 'Control',
  
  // Shortcuts
  shortcuts: {
    undo: { key: 'z', modifier: true, shift: false },
    redo: { key: 'z', modifier: true, shift: true },
    redoAlt: { key: 'y', modifier: true, shift: false }, // Windows alternative
    save: { key: 's', modifier: true, shift: false },
    fitToView: { key: '0', modifier: true, shift: false },
    zoomIn: { key: '=', modifier: true, shift: false },
    zoomOut: { key: '-', modifier: true, shift: false },
    selectTool: { key: 'v', modifier: false, shift: false },
    areaTool: { key: 'a', modifier: false, shift: false },
    compareCycle: { key: 'c', modifier: false, shift: false },
  },
  
  // Format for display
  formatShortcut(shortcut: typeof keyboardShortcuts.shortcuts.undo): string {
    const mod = keyboardShortcuts.isMac() ? '⌘' : 'Ctrl';
    const shift = shortcut.shift ? '⇧' : '';
    return `${mod}${shift}${shortcut.key.toUpperCase()}`;
  },
};

