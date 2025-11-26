import React, { useState } from 'react';
import { QuoteItem as QuoteItemType } from '../../maskcore/store';
import { useMaskStore } from '../../maskcore/store';
import { getAll } from '../../materials/registry';
import { Edit2, Trash2, DollarSign } from 'lucide-react';

interface QuoteItemProps {
  item: QuoteItemType;
  quoteId: string;
  maskName: string;
}

export function QuoteItem({ item, quoteId, maskName }: QuoteItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    materialCost: item.materialCost,
    laborCost: item.laborCost,
    markup: item.markup,
    notes: item.notes || ''
  });
  
  const { UPDATE_QUOTE_ITEM, REMOVE_QUOTE_ITEM } = useMaskStore();
  
  // Get material name
  const materials = getAll();
  const material = materials[item.materialId];
  const materialName = material?.name || 'Unknown Material';

  const handleSave = () => {
    UPDATE_QUOTE_ITEM(quoteId, item.id, editValues);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValues({
      materialCost: item.materialCost,
      laborCost: item.laborCost,
      markup: item.markup,
      notes: item.notes || ''
    });
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 mb-3 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900">{maskName}</h4>
          <p className="text-xs text-gray-600">{materialName}</p>
          <p className="text-xs text-gray-500">Area: {item.area.toFixed(2)} m²</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            title="Edit item"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => REMOVE_QUOTE_ITEM(quoteId, item.id)}
            className="p-1 text-red-400 hover:text-red-600 rounded transition-colors"
            title="Remove item"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-600">Material Cost ($/m²)</label>
              <input
                type="number"
                value={editValues.materialCost}
                onChange={(e) => setEditValues(prev => ({ ...prev, materialCost: parseFloat(e.target.value) || 0 }))}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                step="0.01"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Labor Cost ($/m²)</label>
              <input
                type="number"
                value={editValues.laborCost}
                onChange={(e) => setEditValues(prev => ({ ...prev, laborCost: parseFloat(e.target.value) || 0 }))}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                step="0.01"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600">Markup (%)</label>
            <input
              type="number"
              value={editValues.markup}
              onChange={(e) => setEditValues(prev => ({ ...prev, markup: parseFloat(e.target.value) || 0 }))}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
              step="0.1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Notes</label>
            <textarea
              value={editValues.notes}
              onChange={(e) => setEditValues(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
              rows={2}
              placeholder="Additional notes..."
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={handleCancel}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              onKeyDown={handleKeyPress}
              className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Material:</span>
            <span className="font-medium">${item.materialCost.toFixed(2)}/m²</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Labor:</span>
            <span className="font-medium">${item.laborCost.toFixed(2)}/m²</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Markup:</span>
            <span className="font-medium">{item.markup.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between text-xs font-medium border-t border-gray-200 pt-1">
            <span>Subtotal:</span>
            <span className="text-green-600">${item.subtotal.toFixed(2)}</span>
          </div>
          {item.notes && (
            <div className="text-xs text-gray-500 italic mt-1">
              "{item.notes}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
