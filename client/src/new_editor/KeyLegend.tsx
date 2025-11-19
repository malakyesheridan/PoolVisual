import React, { useEffect } from 'react';
import { X, MousePointer, Square, RotateCcw, Eye, Keyboard, ZoomIn, ZoomOut, Save, Undo2, Redo2, Move, Trash2 } from 'lucide-react';

interface KeyLegendProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyLegend({ isOpen, onClose }: KeyLegendProps) {
  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const mouseInteractions = [
    {
      icon: <MousePointer className="w-4 h-4" />,
      action: "Single click mask",
      result: "Select mask"
    },
    {
      icon: <Square className="w-4 h-4" />,
      action: "Double click mask",
      result: "Edit mask points"
    },
    {
      icon: <MousePointer className="w-4 h-4" />,
      action: "Drag mask",
      result: "Move mask"
    },
    {
      icon: <RotateCcw className="w-4 h-4" />,
      action: "Drag rotate handle",
      result: "Rotate mask"
    },
    {
      icon: <Eye className="w-4 h-4" />,
      action: "Click outside mask",
      result: "Deselect mask"
    },
    {
      icon: <ZoomIn className="w-4 h-4" />,
      action: "Scroll wheel",
      result: "Zoom in/out"
    },
    {
      icon: <Move className="w-4 h-4" />,
      action: "Space + drag",
      result: "Pan canvas"
    }
  ];

  const keyboardShortcuts = [
    {
      keys: ["V"],
      action: "Select tool"
    },
    {
      keys: ["A"],
      action: "Area tool"
    },
    {
      keys: ["Ctrl", "Z"],
      action: "Undo"
    },
    {
      keys: ["Ctrl", "Shift", "Z"],
      action: "Redo"
    },
    {
      keys: ["Ctrl", "S"],
      action: "Save changes"
    },
    {
      keys: ["Ctrl", "+"],
      action: "Zoom in"
    },
    {
      keys: ["Ctrl", "-"],
      action: "Zoom out"
    },
    {
      keys: ["C"],
      action: "Calibrate measurements"
    },
    {
      keys: ["Delete", "/", "Backspace"],
      action: "Delete selected mask/vertex"
    },
    {
      keys: ["Enter"],
      action: "Commit drawing"
    },
    {
      keys: ["ESC"],
      action: "Exit current mode"
    }
  ];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Canvas Controls</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Mouse Interactions */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <MousePointer className="w-4 h-4" />
            Mouse & Gestures
          </h3>
          <div className="space-y-2">
            {mouseInteractions.map((interaction, index) => (
              <div key={index} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50">
                <div className="text-gray-600">
                  {interaction.icon}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {interaction.action}
                  </div>
                  <div className="text-sm text-gray-600">
                    {interaction.result}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Keyboard className="w-4 h-4" />
            Keyboard Shortcuts
          </h3>
          <div className="space-y-2">
            {keyboardShortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50">
                <div className="text-sm font-medium text-gray-900">
                  {shortcut.action}
                </div>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, keyIndex) => (
                    <React.Fragment key={keyIndex}>
                      {keyIndex > 0 && <span className="text-gray-400 text-xs">+</span>}
                      <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 text-gray-700 rounded border border-gray-300">
                        {key}
                      </kbd>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            Click outside this window or press ESC to close
          </p>
        </div>
      </div>
    </div>
  );
}
