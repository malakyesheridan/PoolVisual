import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from './store';
import { X, Bug } from 'lucide-react';
import { materialLibraryAdapter } from './materialLibraryAdapter';
import { PV_MATERIAL_LIBRARY_ENABLED } from './featureFlags';

interface OverlayPosition {
  x: number;
  y: number;
  collapsed: boolean;
}

const STORAGE_KEY = 'pv:newEditor:overlayPos';

export function DevOverlay() {
  const {
    photoSpace,
    containerSize,
    state,
    activeTool,
    masks,
    selectedMaskId,
    zoomLabel
  } = useEditorStore();

  // Only render in development
  if (!import.meta.env.DEV) {
    return null;
  }

  const [position, setPosition] = useState<OverlayPosition>(() => {
    // Load from localStorage or use default
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load overlay position:', e);
    }
    
    // Default position: top-left with 16px margin, collapsed
    return { x: 16, y: 16, collapsed: true };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);
  const [cacheStats, setCacheStats] = useState({ total: 0, ready: 0, pending: 0, error: 0 });

  // Save position to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    } catch (e) {
      console.warn('Failed to save overlay position:', e);
    }
  }, [position]);

  // Update cache stats periodically
  useEffect(() => {
    if (PV_MATERIAL_LIBRARY_ENABLED) {
      const updateStats = () => {
        setCacheStats(materialLibraryAdapter.getCacheStats());
      };
      
      updateStats();
      const interval = setInterval(updateStats, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  // Handle keyboard toggle (Backtick) and toolbar button
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`' && e.target === document.body) {
        e.preventDefault();
        setPosition(prev => ({ ...prev, collapsed: !prev.collapsed }));
      }
    };

    const handleToggleEvent = () => {
      setPosition(prev => ({ ...prev, collapsed: !prev.collapsed }));
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('toggleDevOverlay', handleToggleEvent);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('toggleDevOverlay', handleToggleEvent);
    };
  }, []);

  // Handle dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (position.collapsed) return;
    
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Clamp to viewport bounds
    const maxX = window.innerWidth - (overlayRef.current?.offsetWidth || 300);
    const maxY = window.innerHeight - (overlayRef.current?.offsetHeight || 200);
    
    setPosition(prev => ({
      ...prev,
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    }));
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Global mouse events for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const toggleCollapsed = () => {
    setPosition(prev => ({ ...prev, collapsed: !prev.collapsed }));
  };

  // Collapsed pill
  if (position.collapsed) {
    return (
      <div
        className="fixed bg-black/60 text-white rounded-full px-3 py-1.5 font-mono text-xs cursor-pointer hover:bg-black/80 transition-colors z-40"
        style={{
          left: position.x,
          top: position.y,
          width: '88px',
          height: '28px',
          pointerEvents: 'auto'
        }}
        onClick={toggleCollapsed}
        title="Click to expand dev overlay (or press `)"
      >
        <div className="flex items-center justify-center h-full">
          <Bug size={12} className="mr-1" />
          <span>DEV</span>
        </div>
      </div>
    );
  }

  // Expanded overlay
  return (
    <div
      ref={overlayRef}
      className="fixed bg-black/80 text-white p-3 rounded-lg font-mono text-xs z-40 max-w-sm select-none"
      style={{
        left: position.x,
        top: position.y,
        pointerEvents: 'none' // Container doesn't steal clicks
      }}
    >
      {/* Header with drag handle and close button */}
      <div
        className="flex items-center justify-between mb-2 cursor-move"
        onMouseDown={handleMouseDown}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="font-bold text-green-400 flex items-center">
          <Bug size={12} className="mr-1" />
          DEV OVERLAY
        </div>
        <button
          onClick={toggleCollapsed}
          className="text-gray-400 hover:text-white transition-colors p-1"
          title="Collapse overlay (or press `)"
          style={{ pointerEvents: 'auto' }}
        >
          <X size={12} />
        </button>
      </div>
      
      {/* Content */}
      <div className="space-y-1" style={{ pointerEvents: 'auto' }}>
        <div>
          <span className="text-gray-400">State:</span>
          <span className={`ml-2 ${
            state === 'ready' ? 'text-green-400' : 
            state === 'loading' ? 'text-yellow-400' : 
            state === 'error' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {state}
          </span>
        </div>
        
        <div>
          <span className="text-gray-400">Tool:</span>
          <span className="ml-2 text-blue-400">{activeTool}</span>
        </div>
        
        <div>
          <span className="text-gray-400">Zoom:</span>
          <span className="ml-2 text-yellow-400">{zoomLabel}</span>
        </div>
        
        <div>
          <span className="text-gray-400">Container:</span>
          <span className="ml-2">
            {containerSize.width}×{containerSize.height}
          </span>
        </div>
        
        <div>
          <span className="text-gray-400">Image:</span>
          <span className="ml-2">
            {photoSpace.imgW}×{photoSpace.imgH}
          </span>
        </div>
        
        <div>
          <span className="text-gray-400">PhotoSpace:</span>
        </div>
        <div className="ml-2 space-y-0.5">
          <div>scale: {photoSpace.scale.toFixed(3)}</div>
          <div>panX: {photoSpace.panX.toFixed(1)}</div>
          <div>panY: {photoSpace.panY.toFixed(1)}</div>
          <div>dpr: {photoSpace.dpr}</div>
        </div>
        
        <div>
          <span className="text-gray-400">Masks:</span>
          <span className="ml-2">{masks.length}</span>
        </div>
        
        {selectedMaskId && (
          <div>
            <span className="text-gray-400">Selected:</span>
            <span className="ml-2 text-green-400">{selectedMaskId.slice(0, 8)}...</span>
          </div>
        )}
        
        {/* Cache Stats (only when Material Library is enabled) */}
        {PV_MATERIAL_LIBRARY_ENABLED && (
          <div>
            <span className="text-gray-400">Cache:</span>
            <span className="ml-2 text-blue-400">
              {cacheStats.ready}/{cacheStats.pending}/{cacheStats.error}
            </span>
          </div>
        )}
        
        {/* Help text */}
        <div className="pt-2 border-t border-gray-600 text-gray-500">
          <div>Press ` to toggle</div>
          <div>Drag header to move</div>
          <div>Press J for click echo debug</div>
        </div>
      </div>
    </div>
  );
}