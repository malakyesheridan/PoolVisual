import React, { useState, useRef, useEffect } from 'react';
import { useMaskStore, Mask } from '../../maskcore/store';
import { Edit2, Eye, EyeOff, Lock, Unlock, MoreVertical, Trash2 } from 'lucide-react';

interface MaskItemProps {
  mask: Mask;
  index: number;
}

export function MaskItem({ mask, index }: MaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(mask.name || `Mask ${index + 1}`);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { RENAME_MASK, TOGGLE_MASK_VISIBILITY, TOGGLE_MASK_LOCK, SELECT, selectedId, DELETE } = useMaskStore();

  // Update editName when mask name changes externally
  React.useEffect(() => {
    if (!isEditing) {
      setEditName(mask.name || `Mask ${index + 1}`);
    }
  }, [mask.name, index, isEditing]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleRename = () => {
    if (editName.trim() && editName !== mask.name) {
      RENAME_MASK(mask.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditName(mask.name || `Mask ${index + 1}`);
      setIsEditing(false);
    }
  };

  const handleMaskClick = () => {
    if (!isEditing) {
      SELECT(mask.id);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${displayName}"? This action cannot be undone.`)) {
      DELETE(mask.id).catch(error => {
        console.error('Failed to delete mask:', error);
        // Could show toast notification here
      });
    }
    setShowDropdown(false);
  };

  const displayName = mask.name || `Mask ${index + 1}`;
  const isVisible = mask.isVisible ?? true;
  const isLocked = mask.isLocked ?? false;
  const isSelected = selectedId === mask.id;

  return (
    <div 
      className={`flex items-center justify-between p-2 rounded-lg mb-2 cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-primary/10 border border-blue-300' 
          : 'bg-gray-50 hover:bg-gray-100'
      }`}
      onClick={handleMaskClick}
    >
      <div className="flex items-center space-x-2 flex-1">
        {/* Visibility Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            TOGGLE_MASK_VISIBILITY(mask.id);
          }}
          className={`p-1 rounded transition-colors ${
            isVisible 
              ? 'text-gray-600 hover:text-gray-800' 
              : 'text-gray-400 hover:text-gray-600'
          }`}
          title={isVisible ? 'Hide mask' : 'Show mask'}
        >
          {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>

        {/* Lock Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            TOGGLE_MASK_LOCK(mask.id);
          }}
          className={`p-1 rounded transition-colors ${
            isLocked 
              ? 'text-red-600 hover:text-red-800' 
              : 'text-gray-400 hover:text-gray-600'
          }`}
          title={isLocked ? 'Unlock mask' : 'Lock mask'}
        >
          {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>

        {/* Mask Name */}
        <div className="flex-1" onClick={(e) => e.stopPropagation()}>
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyPress}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          ) : (
            <span 
              className={`text-xs font-medium cursor-pointer hover:text-primary ${
                !isVisible ? 'text-gray-400 line-through' : 'text-gray-700'
              }`}
              onClick={() => setIsEditing(true)}
              title="Click to rename"
            >
              {displayName}
            </span>
          )}
        </div>
      </div>

      {/* More Options Button with Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
          title="More options"
        >
          <MoreVertical size={14} />
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[120px]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              disabled={isLocked}
              className={`w-full px-3 py-2 text-left text-xs flex items-center space-x-2 transition-colors ${
                isLocked 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-red-600 hover:bg-red-50'
              }`}
              title={isLocked ? 'Cannot delete locked mask' : 'Delete mask'}
            >
              <Trash2 size={12} />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
