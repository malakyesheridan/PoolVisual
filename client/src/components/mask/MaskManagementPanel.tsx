import React, { useState, useEffect } from 'react';
import { useMaskStore, Mask } from '../../maskcore/store';
import { MaskItem } from './MaskItem';
import { Plus, FolderPlus, ChevronDown, ChevronRight } from 'lucide-react';

interface MaskManagementPanelProps {
  className?: string;
}

export function MaskManagementPanel({ className = '' }: MaskManagementPanelProps) {
  const { masks, maskGroups, CREATE_GROUP, TOGGLE_GROUP_COLLAPSED, selectedId, DELETE } = useMaskStore();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Convert masks object to array and sort by order
  const maskArray = Object.values(masks)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Group masks by their groupId
  const groupedMasks = maskArray.reduce((acc, mask, index) => {
    const groupId = mask.groupId || 'ungrouped';
    if (!acc[groupId]) {
      acc[groupId] = [];
    }
    acc[groupId].push({ mask, index });
    return acc;
  }, {} as Record<string, Array<{ mask: Mask; index: number }>>);

  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      CREATE_GROUP(newGroupName.trim());
      setNewGroupName('');
      setShowCreateGroup(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateGroup();
    } else if (e.key === 'Escape') {
      setShowCreateGroup(false);
      setNewGroupName('');
    }
  };

  // Handle keyboard shortcuts for mask deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Delete key when a mask is selected and not in input field
      if (e.key === 'Delete' && selectedId && !(e.target instanceof HTMLInputElement)) {
        const selectedMask = masks[selectedId];
        if (selectedMask && !selectedMask.isLocked) {
          const maskName = selectedMask.name || `Mask ${maskArray.findIndex(m => m.id === selectedId) + 1}`;
          if (window.confirm(`Are you sure you want to delete "${maskName}"? This action cannot be undone.`)) {
            DELETE(selectedId);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, masks, maskArray, DELETE]);

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Masks</h3>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowCreateGroup(true)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title="Create group"
            >
              <FolderPlus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Create Group Input */}
      {showCreateGroup && (
        <div className="flex-shrink-0 p-4 border-b bg-gray-50">
          <input
            type="text"
            placeholder="Group name..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={handleKeyPress}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex justify-end space-x-2 mt-2">
            <button
              onClick={() => setShowCreateGroup(false)}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGroup}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Contextual Message */}
      <div className="flex-shrink-0 p-4 border-b bg-orange-50">
        <div className="text-sm text-orange-700">
          <strong>Manage masks</strong> - organize, rename, and delete
        </div>
      </div>

      {/* Mask List - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">

      {/* Groups and Masks */}
      <div className="space-y-3">
        {/* Ungrouped Masks */}
        {groupedMasks.ungrouped && groupedMasks.ungrouped.length > 0 && (
          <div>
            <div className="flex items-center mb-2">
              <span className="text-xs font-medium text-gray-600">Ungrouped</span>
              <span className="ml-2 text-xs text-gray-400">
                ({groupedMasks.ungrouped.length})
              </span>
            </div>
            <div className="space-y-1">
              {groupedMasks.ungrouped.map(({ mask, index }) => (
                <MaskItem key={mask.id} mask={mask} index={index} />
              ))}
            </div>
          </div>
        )}

        {/* Grouped Masks */}
        {Object.entries(maskGroups)
          .sort((a, b) => a[1].order - b[1].order)
          .map(([groupId, group]) => {
            const groupMasks = groupedMasks[groupId] || [];
            if (groupMasks.length === 0) return null;

            return (
              <div key={groupId}>
                <div className="flex items-center mb-2">
                  <button
                    onClick={() => TOGGLE_GROUP_COLLAPSED(groupId)}
                    className="flex items-center space-x-1 text-xs font-medium text-gray-600 hover:text-gray-800"
                  >
                    {group.isCollapsed ? (
                      <ChevronRight size={12} />
                    ) : (
                      <ChevronDown size={12} />
                    )}
                    <span>{group.name}</span>
                    <span className="text-gray-400">({groupMasks.length})</span>
                  </button>
                </div>
                
                {!group.isCollapsed && (
                  <div className="space-y-1">
                    {groupMasks.map(({ mask, index }) => (
                      <MaskItem key={mask.id} mask={mask} index={index} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* No Masks Message */}
      {maskArray.length === 0 && (
        <div className="text-center py-4">
          <div className="text-sm text-gray-500 mb-2">No masks created yet</div>
          <div className="text-xs text-gray-400">
            Draw masks to see them here
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
