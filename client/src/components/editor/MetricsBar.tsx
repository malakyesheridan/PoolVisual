/**
 * Metrics Bar - Live calculations and project summary
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Calculator,
  FileText,
  DollarSign,
  Square,
  Zap,
  Waves
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorSlice';
import { Material } from '@shared/schema';
import { cn } from '@/lib/utils';
import { useIsRealEstate } from '@/hooks/useIsRealEstate';

interface MetricsBarProps {
  materials: Material[];
  onGenerateQuote?: () => void;
  className?: string;
}

export function MetricsBar({ materials, onGenerateQuote, className }: MetricsBarProps) {
  const isRealEstate = useIsRealEstate();
  const {
    masks,
    editorState,
    computeMetrics,
    generateQuote,
    isLoading
  } = useEditorStore();

  // Calculate summary metrics
  const summary = React.useMemo(() => {
    let totalArea = 0;
    let totalLength = 0;
    let totalCost = 0;
    let masksByType = { area: 0, linear: 0, waterline_band: 0 };
    let masksWithMaterials = 0;

    masks.forEach(mask => {
      masksByType[mask.type]++;
      
      const metrics = computeMetrics(mask.id);
      
      if (mask.type === 'area' && metrics.area_m2) {
        totalArea += metrics.area_m2;
      }
      
      if ((mask.type === 'linear' || mask.type === 'waterline_band') && metrics.perimeter_m) {
        totalLength += metrics.perimeter_m;
      }

      // Calculate cost if material is assigned
      if (mask.materialId) {
        masksWithMaterials++;
        const material = materials.find(m => m.id === mask.materialId);
        if (material) {
          let quantity = 0;
          
          if (material.unit === 'm2' && metrics.area_m2) {
            quantity = metrics.area_m2;
          } else if (material.unit === 'lm' && metrics.perimeter_m) {
            quantity = metrics.perimeter_m;
          } else if (material.unit === 'each') {
            quantity = 1;
          }
          
          const wastage = 1 + (parseFloat(material.defaultWastagePct?.toString() || '0') || 0) / 100;
          const adjustedQuantity = quantity * wastage;
          totalCost += adjustedQuantity * parseFloat(material.price?.toString() || '0');
        }
      }
    });

    return {
      totalMasks: masks.length,
      masksByType,
      masksWithMaterials,
      totalArea,
      totalLength,
      totalCost,
      isCalibrated: !!editorState.calibration,
      completionPercentage: masks.length > 0 ? Math.round((masksWithMaterials / masks.length) * 100) : 0
    };
  }, [masks, materials, computeMetrics, editorState.calibration]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatMetric = (value: number, unit: string, decimals = 2) => {
    return `${value.toFixed(decimals)} ${unit}`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'area': return Square;
      case 'linear': return Zap;
      case 'waterline_band': return Waves;
      default: return Calculator;
    }
  };

  return (
    <div className={cn("bg-white border-t border-slate-200 p-4", className)}>
      <div className="flex items-center justify-between">
        {/* Left section - Project metrics */}
        <div className="flex items-center space-x-6">
          {/* Calibration status */}
          <div className="flex items-center space-x-2">
            <Badge 
              variant={summary.isCalibrated ? "default" : "destructive"}
              className="text-xs"
            >
              {summary.isCalibrated ? 'Calibrated' : 'Not Calibrated'}
            </Badge>
            {summary.isCalibrated && editorState.calibration && (
              <span className="text-xs text-slate-600">
                1m = {editorState.calibration.pixelsPerMeter.toFixed(1)}px
              </span>
            )}
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Mask counts */}
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <span className="font-medium">{summary.totalMasks}</span>
              <span className="text-slate-600 ml-1">
                mask{summary.totalMasks !== 1 ? 's' : ''}
              </span>
            </div>
            
            {Object.entries(summary.masksByType).map(([type, count]) => {
              if (count === 0) return null;
              const Icon = getIcon(type);
              return (
                <div key={type} className="flex items-center space-x-1">
                  <Icon className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600">{count}</span>
                </div>
              );
            })}
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Measurements */}
          <div className="flex items-center space-x-4">
            {summary.totalArea > 0 && (
              <div className="text-sm">
                <span className="text-slate-600">Area:</span>
                <span className="font-medium ml-1">
                  {formatMetric(summary.totalArea, 'm²')}
                </span>
              </div>
            )}
            
            {summary.totalLength > 0 && (
              <div className="text-sm">
                <span className="text-slate-600">Length:</span>
                <span className="font-medium ml-1">
                  {formatMetric(summary.totalLength, 'm')}
                </span>
              </div>
            )}
          </div>

          {summary.totalCost > 0 && (
            <>
              <Separator orientation="vertical" className="h-6" />
              
              {/* Cost estimate */}
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <div className="text-sm">
                  <span className="text-slate-600">Est. Cost:</span>
                  <span className="font-medium ml-1 text-green-600">
                    {formatCurrency(summary.totalCost)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right section - Actions and progress */}
        <div className="flex items-center space-x-4">
          {/* Progress indicator */}
          <div className="flex items-center space-x-2">
            <div className="text-sm text-slate-600">
              Materials:
            </div>
            <Badge 
              variant={summary.completionPercentage === 100 ? "default" : "secondary"}
              className="text-xs"
            >
              {summary.masksWithMaterials}/{summary.totalMasks} ({summary.completionPercentage}%)
            </Badge>
            
            {summary.completionPercentage < 100 && summary.totalMasks > 0 && (
              <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${summary.completionPercentage}%` }}
                />
              </div>
            )}
          </div>

          {/* Quote generation - Hidden for real estate */}
          {!isRealEstate && (
            <>
              <Separator orientation="vertical" className="h-6" />
              <Button
                onClick={onGenerateQuote || generateQuote}
                disabled={
                  isLoading || 
                  !summary.isCalibrated || 
                  summary.totalMasks === 0 || 
                  summary.masksWithMaterials === 0
                }
                size="sm"
                className="h-8"
                data-testid="button-generate-quote"
              >
                <FileText className="w-4 h-4 mr-2" />
                Generate Quote
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Warning messages */}
      {!summary.isCalibrated && summary.totalMasks > 0 && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-xs text-yellow-800">
            <strong>Calibration required:</strong> Set a reference measurement to calculate accurate areas and lengths.
          </p>
        </div>
      )}

      {summary.isCalibrated && summary.masksWithMaterials < summary.totalMasks && summary.totalMasks > 0 && (
        <div className="mt-3 p-2 bg-primary/5 border border-primary/20 rounded-md">
          <p className="text-xs text-primary">
            <strong>Materials needed:</strong> Assign materials to all masks to generate an accurate quote.
          </p>
        </div>
      )}

      {summary.totalMasks === 0 && (
        <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-md">
          <p className="text-xs text-slate-600">
            Start drawing area masks, linear measurements, or waterline bands to begin creating your quote.
          </p>
        </div>
      )}
    </div>
  );
}