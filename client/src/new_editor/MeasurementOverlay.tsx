import React, { useState } from 'react';
import { useEditorStore } from './store';
import { useMaskStore } from '../maskcore/store';
import { calculateMaskCost, calculateProjectTotals } from './utils';
import { MaskCalibrationDialog } from './MaskCalibrationDialog';
import { getAll } from '../materials/registry';

interface MeasurementOverlayProps {
  className?: string;
}

export function MeasurementOverlay({ className = '' }: MeasurementOverlayProps) {
  const { calibration, measurements } = useEditorStore();
  const { masks } = useMaskStore(); // Use the actual mask store
  const [calibratingMaskId, setCalibratingMaskId] = useState<string | null>(null);
  
  // Get materials from registry
  const materials = Object.values(getAll()).map(material => ({
    id: material.id,
    name: material.name,
    costPerSquareMeter: material.price || material.cost || undefined
  }));
  
  // Don't render if measurements are disabled
  if (!measurements.showMeasurements && !measurements.showCosts) {
    return null;
  }
  
  // Don't render if not calibrated
  if (!calibration.isCalibrated) {
    return (
      <div className={`absolute top-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 shadow-lg ${className}`}>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
          <span className="text-sm font-medium text-yellow-800">
            Calibrate to see measurements
          </span>
        </div>
      </div>
    );
  }
  
  // Convert mask store format to the format expected by calculation functions
  const maskArray = Object.values(masks).map(mask => ({
    points: mask.pts,
    materialId: mask.materialId,
    customCalibration: undefined // TODO: Add custom calibration support
  }));
  
  // Calculate measurements for each mask
  const maskMeasurements = maskArray.map((mask, index) => {
    const maskData = Object.values(masks)[index];
    return {
      ...calculateMaskCost(mask, materials, calibration.pixelsPerMeter),
      maskId: maskData.id,
      maskName: maskData.name || `Mask ${index + 1}` // Use custom name or fallback to default
    };
  });
  
  // Calculate totals
  const totals = calculateProjectTotals(maskArray, materials, calibration.pixelsPerMeter);
  
  return (
    <>
      <div className={`absolute top-4 right-4 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-4 shadow-lg max-w-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Measurements</h3>
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
          <span className="text-xs text-gray-600">Calibrated</span>
        </div>
      </div>
      
      {/* Individual Mask Measurements */}
      {maskMeasurements.length > 0 && (
        <div className="space-y-3 mb-4">
          {maskMeasurements.map((measurement, index) => (
            <div key={measurement.maskId} className="border-b border-gray-100 pb-2 last:border-b-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">
                  {measurement.maskName}
                </span>
                <span className="text-xs text-gray-500">
                  {measurement.materialName}
                </span>
              </div>
              
              {measurements.showMeasurements && (
                <div className="text-xs text-gray-600">
                  Area: {measurement.areaSquareMeters.toFixed(2)} m²
                  <span className={`ml-2 px-1 py-0.5 rounded text-xs ${
                    measurement.calibrationMethod === 'mask-specific' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {measurement.calibrationMethod === 'mask-specific' ? 'Custom' : 'Global'}
                  </span>
                  <span className={`ml-1 px-1 py-0.5 rounded text-xs ${
                    measurement.confidence === 'high' 
                      ? 'bg-green-100 text-green-700'
                      : measurement.confidence === 'medium'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {measurement.confidence}
                  </span>
                </div>
              )}
              
              {measurements.showCosts && measurement.hasCostData && (
                <div className="text-xs text-green-600 font-medium">
                  Cost: {measurements.currency} {measurement.cost.toFixed(2)}
                </div>
              )}
              
              {measurements.showCosts && !measurement.hasCostData && (
                <div className="text-xs text-gray-400">
                  No cost data
                </div>
              )}
              
              <button
                onClick={() => setCalibratingMaskId(measurement.maskId)}
                className="mt-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                {measurement.calibrationMethod === 'mask-specific' ? 'Recalibrate' : 'Calibrate'}
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Totals */}
      {(measurements.showMeasurements || measurements.showCosts) && (
        <div className="border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Total</span>
            <div className="text-right">
              {measurements.showMeasurements && (
                <div className="text-sm font-medium text-gray-900">
                  {totals.totalArea.toFixed(2)} m²
                </div>
              )}
              {measurements.showCosts && (
                <div className="text-sm font-medium text-green-600">
                  {measurements.currency} {totals.totalCost.toFixed(2)}
                </div>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {totals.maskCount} masks, {totals.masksWithCosts} with cost data
          </div>
        </div>
      )}
      
      {/* No Masks Message */}
      {maskMeasurements.length === 0 && (
        <div className="text-center py-4">
          <div className="text-sm text-gray-500 mb-2">No masks to measure</div>
          <div className="text-xs text-gray-400">
            Draw masks to see measurements
          </div>
        </div>
      )}
      
      {/* Calibration Info */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          <div>Calibration: {calibration.pixelsPerMeter.toFixed(0)} px/m</div>
          <div>Method: {calibration.calibrationMethod}</div>
          <div>Date: {new Date(calibration.calibrationDate).toLocaleDateString()}</div>
        </div>
      </div>
    </div>
    
    {/* Mask Calibration Dialog */}
    {calibratingMaskId && (
      <MaskCalibrationDialog
        maskId={calibratingMaskId}
        onClose={() => setCalibratingMaskId(null)}
      />
    )}
    </>
  );
}
