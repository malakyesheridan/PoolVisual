// Selected Asset Panel for Right Sidebar
// Shows controls for the currently selected asset

import React from 'react';
import { Asset, Blend } from './types';
import { useAssetStore } from './assetStore';

interface SelectedAssetPanelProps {
  asset: Asset;
}

export function SelectedAssetPanel({ asset }: SelectedAssetPanelProps) {
  const store = useAssetStore();

  const handleOpacityChange = (opacity: number) => {
    store.transformAsset(asset.id, { opacity });
  };

  const handleBlendChange = (blend: Blend) => {
    store.transformAsset(asset.id, { blend });
  };

  const handleScaleChange = (scale: number) => {
    store.transformAsset(asset.id, { scale });
  };

  const handleRotationChange = (rotation: number) => {
    store.transformAsset(asset.id, { rotation });
  };

  const handleSkewChange = (skewX: number) => {
    store.transformAsset(asset.id, { skewX });
  };

  const handleLockToggle = () => {
    store.lockAsset(asset.id, !asset.locked);
  };

  const handleHideToggle = () => {
    store.hideAsset(asset.id, !asset.hidden);
  };

  const handleReset = () => {
    store.transformAsset(asset.id, {
      scale: 1.0,
      rotation: 0,
      skewX: 0,
      opacity: 1.0,
      blend: 'normal'
    });
  };

  const handleDelete = () => {
    store.deleteAsset(asset.id);
  };

  const handleDuplicate = () => {
    store.duplicateAsset(asset.id);
  };

  const blendModes: Blend[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'];

  return (
    <div className="p-4 border-b border-gray-200" data-testid="selected-asset-panel">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900">Selected Asset</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDuplicate}
            className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-blue-200"
            title="Duplicate (Ctrl+D)"
          >
            Copy
          </button>
          <button
            onClick={handleDelete}
            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
            title="Delete (Del)"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Asset info */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-sm font-medium text-gray-900">{asset.name}</div>
        <div className="text-xs text-gray-500 capitalize">{asset.category}</div>
        <div className="text-xs text-gray-500">
          {asset.natW}×{asset.natH}px • Scale: {(asset.scale * 100).toFixed(0)}%
        </div>
      </div>

      {/* Opacity */}
      <div className="mb-4">
        <label className="text-sm text-gray-700 block mb-2">
          Opacity: {(asset.opacity * 100).toFixed(0)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={asset.opacity}
          onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Blend Mode */}
      <div className="mb-4">
        <label className="text-sm text-gray-700 block mb-2">Blend Mode</label>
        <select
          value={asset.blend}
          onChange={(e) => handleBlendChange(e.target.value as Blend)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {blendModes.map(mode => (
            <option key={mode} value={mode}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Scale */}
      <div className="mb-4">
        <label className="text-sm text-gray-700 block mb-2">
          Scale: {(asset.scale * 100).toFixed(0)}%
        </label>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.05"
          value={asset.scale}
          onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>10%</span>
          <span>500%</span>
        </div>
      </div>

      {/* Rotation */}
      <div className="mb-4">
        <label className="text-sm text-gray-700 block mb-2">
          Rotation: {asset.rotation.toFixed(0)}°
        </label>
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={asset.rotation}
          onChange={(e) => handleRotationChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>-180°</span>
          <span>180°</span>
        </div>
      </div>

      {/* Skew */}
      <div className="mb-4">
        <label className="text-sm text-gray-700 block mb-2">
          Skew: {asset.skewX?.toFixed(1) || '0.0'}°
        </label>
        <input
          type="range"
          min="-45"
          max="45"
          step="0.5"
          value={asset.skewX || 0}
          onChange={(e) => handleSkewChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>-45°</span>
          <span>45°</span>
        </div>
      </div>

      {/* Z-Order */}
      <div className="mb-4">
        <label className="text-sm text-gray-700 block mb-2">Layer Order</label>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const assets = store.getAssetsInOrder();
              const currentIndex = assets.findIndex(a => a.id === asset.id);
              if (currentIndex > 0) {
                const newZ = assets[currentIndex - 1].z - 1;
                store.setAssetZ(asset.id, newZ);
              }
            }}
            className="flex-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            title="Send Backward ([)"
          >
            Backward
          </button>
          <button
            onClick={() => {
              const assets = store.getAssetsInOrder();
              const currentIndex = assets.findIndex(a => a.id === asset.id);
              if (currentIndex < assets.length - 1) {
                const newZ = assets[currentIndex + 1].z + 1;
                store.setAssetZ(asset.id, newZ);
              }
            }}
            className="flex-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            title="Bring Forward (])"
          >
            Forward
          </button>
        </div>
      </div>

      {/* Lock/Hide */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-700">Locked</label>
          <button
            onClick={handleLockToggle}
            className={`w-8 h-4 rounded-full transition-colors ${
              asset.locked ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${
              asset.locked ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <label className="text-sm text-gray-700">Hidden</label>
          <button
            onClick={handleHideToggle}
            className={`w-8 h-4 rounded-full transition-colors ${
              asset.hidden ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${
              asset.hidden ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={handleReset}
        className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
      >
        Reset Transform
      </button>

      {/* Keyboard shortcuts */}
      <div className="mt-4 p-2 bg-gray-50 rounded text-xs text-gray-600">
        <div className="font-medium mb-1">Keyboard Shortcuts:</div>
        <div>Del/Backspace - Delete</div>
        <div>Ctrl+D - Duplicate</div>
        <div>L - Lock/Unlock</div>
        <div>H - Hide/Show</div>
        <div>Arrow keys - Nudge</div>
        <div>[ ] - Layer order</div>
      </div>
    </div>
  );
}
