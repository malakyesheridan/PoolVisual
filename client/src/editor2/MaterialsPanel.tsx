import React from 'react';
import { useEditor } from './store';

// Materials are now loaded from the store

export function MaterialsPanel() {
  const { doc, dispatch } = useEditor();

  const handleMaterialSelect = (materialId: string) => {
    if (doc.selectedId) {
      dispatch({ type: 'material/apply', id: materialId });
    }
  };

  return (
    <div className="w-64 bg-gray-800 border-l border-gray-700 p-4">
      <h3 className="text-white font-medium mb-4">Materials</h3>
      
      {!doc.selectedId ? (
        <div className="text-gray-400 text-sm">
          Select a mask to apply materials
        </div>
      ) : (
        <div className="space-y-3">
          {Object.values(doc.materials).map(material => (
            <button
              key={material.id}
              onClick={() => handleMaterialSelect(material.id)}
              className="w-full p-3 bg-gray-700 hover:bg-gray-600 rounded border border-gray-600 text-left transition-colors"
            >
              <div className="w-full h-16 bg-gray-600 rounded mb-2 flex items-center justify-center">
                <span className="text-gray-400 text-xs">Texture Preview</span>
              </div>
              <div className="text-white text-sm font-medium">{material.name}</div>
              <div className="text-gray-400 text-xs">
                Scale: {material.scaleM}m per tile
              </div>
            </button>
          ))}
        </div>
      )}

      {doc.selectedId && doc.masks[doc.selectedId]?.materialId && (
        <div className="mt-4 p-3 bg-blue-900 border border-blue-700 rounded">
          <div className="text-blue-200 text-sm">
            Applied: {doc.materials[doc.masks[doc.selectedId]?.materialId!]?.name}
          </div>
        </div>
      )}
    </div>
  );
}
