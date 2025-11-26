import React, { useState } from 'react';
import { useEditorStore } from './store';
import { useMaskStore } from '../maskcore/store';
import { calculateMaskCost, calculateProjectTotals } from './utils';
import { MaskCalibrationDialog } from './MaskCalibrationDialog';
import { QuoteSelectionModal } from '../components/quotes/QuoteSelectionModal';
import { getAll } from '../materials/registry';
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, X, ChevronDown, ChevronUp, Calculator } from "lucide-react";

interface MeasurementOverlayProps {
  className?: string;
  jobId?: string | undefined;
}

export function MeasurementOverlay({ className = '', jobId }: MeasurementOverlayProps) {
  const { calibration, measurements } = useEditorStore();
  const { masks } = useMaskStore(); // Use the actual mask store
  const [calibratingMaskId, setCalibratingMaskId] = useState<string | null>(null);
  const [isAddingToQuote, setIsAddingToQuote] = useState(false);
  const [showQuoteSelectionModal, setShowQuoteSelectionModal] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isMinimized, setIsMinimized] = useState(() => {
    // Check localStorage for minimized state
    if (typeof window !== 'undefined') {
      return localStorage.getItem('measurements-minimized') === 'true';
    }
    return false;
  });
  const [calibrationTooltipDismissed, setCalibrationTooltipDismissed] = useState(() => {
    // Check localStorage for dismissal state
    if (typeof window !== 'undefined') {
      return localStorage.getItem('calibration-tooltip-dismissed') === 'true';
    }
    return false;
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch job to get orgId
  const { data: job } = useQuery({
    queryKey: ['/api/jobs', jobId],
    queryFn: () => jobId ? apiClient.getJob(jobId) : Promise.resolve(null),
    enabled: !!jobId,
  });
  
  const handleToggleMinimize = () => {
    const newMinimized = !isMinimized;
    setIsMinimized(newMinimized);
    if (typeof window !== 'undefined') {
      localStorage.setItem('measurements-minimized', newMinimized.toString());
    }
  };
  
  
  // Get materials from registry
  const materials = Object.values(getAll()).map(material => ({
    id: material.id,
    name: material.name,
    costPerSquareMeter: typeof (material.price || material.cost) === 'string' 
      ? parseFloat(material.price || material.cost || '0') 
      : (material.price || material.cost || undefined)
  }));
  
  // Add mutation for adding measurements to quote
  const addToQuoteMutation = useMutation({
    mutationFn: async (data: { jobId: string; measurements: any[]; quoteId?: string }) => {
      return apiClient.addMeasurementsToQuote(data.jobId, data.measurements, data.quoteId);
    },
    onSuccess: () => {
      toast({
        title: "Added to Quote",
        description: "Measurements have been added to the quote.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      setLastSyncTime(new Date());
      setShowQuoteSelectionModal(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add measurements to quote",
        variant: "destructive",
      });
    },
  });
  
  // Add function to handle opening quote selection modal
  const handleAddToQuoteClick = () => {
    if (!jobId) {
      toast({
        title: "No Job Selected",
        description: "Please select a job to add measurements to quote.",
        variant: "destructive",
      });
      return;
    }
    setShowQuoteSelectionModal(true);
  };
  
  // Add function to handle adding measurements to selected quote
  const handleAddToQuote = async (quoteId?: string) => {
    if (!jobId) {
      toast({
        title: "No Job Selected",
        description: "Please select a job to add measurements to quote.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingToQuote(true);
    try {
      const measurementsData = maskMeasurements.map(m => ({
        maskId: m.maskId,
        maskName: m.maskName,
        areaSquareMeters: m.areaSquareMeters,
        materialId: m.materialId,
        materialName: m.materialName,
        cost: m.cost,
        hasCostData: m.hasCostData,
        calibrationMethod: m.calibrationMethod,
        confidence: m.confidence,
        calibrationData: {
          pixelsPerMeter: calibration.pixelsPerMeter,
          calibrationMethod: calibration.calibrationMethod,
          calibrationDate: calibration.calibrationDate
        }
      }));
      
      console.log('[MeasurementOverlay] Sending measurements data:', JSON.stringify(measurementsData, null, 2));
      
      await addToQuoteMutation.mutateAsync({
        jobId,
        measurements: measurementsData,
        quoteId
      });
    } finally {
      setIsAddingToQuote(false);
    }
  };
  
  // Don't render if measurements are disabled
  if (!measurements.showMeasurements && !measurements.showCosts) {
    return null;
  }
  
  // Handle tooltip dismissal
  const handleDismissTooltip = () => {
    setCalibrationTooltipDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('calibration-tooltip-dismissed', 'true');
    }
  };

  // Don't render if not calibrated
  if (!calibration.isCalibrated && !calibrationTooltipDismissed) {
    return (
      <div className={`absolute top-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 shadow-lg ${className}`} style={{ zIndex: 20 }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
            <span className="text-sm font-medium text-yellow-800">
              Calibrate to see measurements
            </span>
          </div>
          <button
            onClick={handleDismissTooltip}
            className="text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 rounded p-1 transition-colors"
            title="Dismiss"
            aria-label="Dismiss calibration tooltip"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Don't render if tooltip was dismissed and not calibrated
  if (!calibration.isCalibrated && calibrationTooltipDismissed) {
    return null;
  }
  
  // Note: isMinimized check happens after calibration checks, so minimized state only applies when calibrated
  
  // Convert mask store format to the format expected by calculation functions
  const maskArray = Object.values(masks).map(mask => ({
    points: mask.pts.map(pt => ({ x: pt.x, y: pt.y })), // Convert MaskPoint[] to Point[]
    materialId: mask.materialId,
    customCalibration: mask.customCalibration // Pass through custom calibration if available
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
  
  // If minimized, show just an icon button
  if (isMinimized) {
    return (
      <>
        <button
          onClick={handleToggleMinimize}
          className={`absolute top-4 right-4 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-2.5 shadow-lg hover:shadow-xl transition-all hover:bg-white ${className}`}
          style={{ zIndex: 20 }}
          title="Show Measurements"
          aria-label="Show Measurements"
        >
          <div className="relative">
            <Calculator className="w-5 h-5 text-gray-700" />
            {totals.totalArea > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center">
                {totals.maskCount}
              </span>
            )}
          </div>
        </button>
        {calibratingMaskId && (
          <MaskCalibrationDialog
            maskId={calibratingMaskId}
            onClose={() => setCalibratingMaskId(null)}
          />
        )}
      </>
    );
  }
  
  return (
    <>
      <div className={`absolute top-4 right-4 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-4 shadow-lg max-w-sm ${className}`} style={{ zIndex: 20 }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Measurements</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
            <span className="text-xs text-gray-600">Calibrated</span>
          </div>
          <button
            onClick={handleToggleMinimize}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded p-1 transition-colors"
            title="Minimize to icon"
            aria-label="Minimize Measurements"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
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
                    measurement.calibrationMethod === 'edge-based'
                      ? 'bg-purple-100 text-purple-700'
                      : measurement.calibrationMethod === 'mask-specific' 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {measurement.calibrationMethod === 'edge-based' 
                      ? 'Edge-Based' 
                      : measurement.calibrationMethod === 'mask-specific' 
                      ? 'Custom' 
                      : 'Global'}
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
                className="mt-1 px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary transition-colors"
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
      
            {/* Add to Quote Button */}
            {!!(maskMeasurements.length > 0 && jobId) && (
              <div className="mt-4 pt-3 border-t border-gray-200">
                <button
                  onClick={handleAddToQuoteClick}
                  disabled={isAddingToQuote}
                  className="w-full bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
            {isAddingToQuote ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                Add Changes to Quote
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Sync Status Indicator */}
      {lastSyncTime && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            Last synced: {lastSyncTime.toLocaleTimeString()}
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
    
    {/* Quote Selection Modal */}
    {jobId && job && (
      <QuoteSelectionModal
        open={showQuoteSelectionModal}
        onOpenChange={setShowQuoteSelectionModal}
        onSelectQuote={handleAddToQuote}
        jobId={jobId}
        jobOrgId={job.orgId}
        allowCreateNew={true}
      />
    )}
    </>
  );
}
