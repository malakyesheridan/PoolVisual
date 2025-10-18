import React, { useEffect } from 'react';
import { X, MousePointer, Square, RotateCcw, Eye } from 'lucide-react';

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

  const interactions = [
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
      icon: <X className="w-4 h-4" />,
      action: "Press ESC key",
      result: "Exit current mode"
    }
  ];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
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
        
        <div className="space-y-3">
          {interactions.map((interaction, index) => (
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
        
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            Click outside this window or press ESC to close
          </p>
        </div>
      </div>
    </div>
  );
}
