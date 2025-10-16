// Pool Template Library Component
// Provides drag-drop pool template library

import React, { useState } from 'react';
import { Droplets, Package } from 'lucide-react';
import { PV_POOL_TEMPLATES } from '../featureFlags';
import { POOL_TEMPLATE_LIBRARY } from './library';
import { PoolTemplateLibraryItem } from './types';

interface PoolTemplateLibraryProps {
  onTemplateDragStart: (template: PoolTemplateLibraryItem) => void;
}

export function PoolTemplateLibrary({ onTemplateDragStart }: PoolTemplateLibraryProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent, template: PoolTemplateLibraryItem) => {
    setIsDragging(true);
    onTemplateDragStart(template);
    
    // Set drag data
    e.dataTransfer.setData('text/plain', template.id);
    e.dataTransfer.effectAllowed = 'copy';
    
    // Create drag image
    const dragImage = new Image();
    dragImage.src = template.thumbnail;
    dragImage.style.opacity = '0.5';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 100, 75);
    
    // Clean up drag image after a short delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 100);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  if (!PV_POOL_TEMPLATES) {
    return null;
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2 mb-3">
          <Droplets size={20} className="text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Pool Templates</h3>
        </div>
        
        <p className="text-sm text-gray-600">
          Drag templates onto the canvas to create pools with automatic geometry generation.
        </p>
      </div>
      
      {/* Template Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {POOL_TEMPLATE_LIBRARY.map(template => (
            <div
              key={template.id}
              draggable
              onDragStart={(e) => handleDragStart(e, template)}
              onDragEnd={handleDragEnd}
              className={`group cursor-grab active:cursor-grabbing p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all ${
                isDragging ? 'opacity-50' : ''
              }`}
            >
              <div className="flex space-x-3">
                {/* Thumbnail */}
                <div className="w-16 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={template.thumbnail}
                    alt={template.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to a placeholder if thumbnail fails to load
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjZjdmN2Y3Ii8+PHRleHQgeD0iMzIiIHk9IjI0IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Qb29sPC90ZXh0Pjwvc3ZnPg==';
                    }}
                  />
                </div>
                
                {/* Template Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {template.name}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {template.description}
                  </p>
                  <div className="flex items-center mt-2 space-x-2">
                    <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                      {template.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {template.defaultFrame.w} × {template.defaultFrame.h}px
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          Drag templates onto the canvas to create pools
        </p>
      </div>
    </div>
  );
}
