/**
 * Quote Generator Component
 * Creates professional quotes from canvas measurements and materials
 */

import React, { useState } from 'react';
import { FileText, Calculator, DollarSign, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEditorStore } from '@/stores/editorSlice';
import { useToast } from '@/hooks/use-toast';

export function QuoteGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { 
    masks, 
    editorState, 
    jobId, 
    photoId, 
    computeMetrics, 
    maskMaterials,
    generateQuote 
  } = useEditorStore();
  
  const { toast } = useToast();
  
  const isCalibrated = editorState.calibration && editorState.calibration.pixelsPerMeter > 0;
  
  // Calculate total estimated cost
  const calculateTotalCost = () => {
    let total = 0;
    let hasItems = false;
    
    masks.forEach(mask => {
      const materialSettings = maskMaterials[mask.id];
      if (materialSettings?.materialId) {
        hasItems = true;
        const metrics = computeMetrics(mask.id);
        // TODO: Get actual material price and calculate cost
        // total += metrics.estimatedCost || 0;
      }
    });
    
    return { total, hasItems };
  };

  const { total, hasItems } = calculateTotalCost();
  
  const masksWithMaterials = masks.filter(mask => 
    maskMaterials[mask.id]?.materialId
  );

  const handleGenerateQuote = async () => {
    if (!jobId || !photoId) {
      toast({
        title: "Error",
        description: "Job ID or Photo ID missing",
        variant: "destructive",
      });
      return;
    }

    if (!isCalibrated) {
      toast({
        title: "Calibration Required",
        description: "Please set calibration before generating quotes",
        variant: "destructive",
      });
      return;
    }

    if (masksWithMaterials.length === 0) {
      toast({
        title: "No Materials Assigned",
        description: "Please assign materials to masks before generating quotes",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      await generateQuote(jobId, photoId);
      
      toast({
        title: "Quote Generated",
        description: "Draft quote has been created successfully",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Unable to generate quote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center">
          <FileText className="h-4 w-4 mr-2" />
          Quote Generation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Indicators */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span>Calibration:</span>
            <Badge variant={isCalibrated ? "default" : "destructive"}>
              {isCalibrated ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Ready
                </>
              ) : (
                "Required"
              )}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span>Masks with Materials:</span>
            <Badge variant={masksWithMaterials.length > 0 ? "default" : "secondary"}>
              {masksWithMaterials.length} / {masks.length}
            </Badge>
          </div>
        </div>

        {/* Summary */}
        {hasItems && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Estimated Total:</span>
              <div className="flex items-center">
                <DollarSign className="h-4 w-4 text-green-600 mr-1" />
                <span className="text-sm font-semibold text-green-600">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              * Includes material costs and standard wastage
            </div>
          </div>
        )}

        {/* Material List */}
        {masksWithMaterials.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-700">Materials Required:</div>
            {masksWithMaterials.map((mask, index) => {
              const metrics = computeMetrics(mask.id);
              const materialSettings = maskMaterials[mask.id];
              
              return (
                <div key={mask.id} className="bg-blue-50 rounded p-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs">
                      <Badge variant="outline" className="text-xs mb-1">
                        {mask.type}
                      </Badge>
                      <div className="font-medium">Mask {index + 1}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div>
                        {mask.type === 'area' && metrics.area_m2 && `${metrics.area_m2.toFixed(2)} m²`}
                        {mask.type === 'linear' && metrics.perimeter_m && `${metrics.perimeter_m.toFixed(2)} lm`}
                        {mask.type === 'waterline_band' && metrics.band_area_m2 && `${metrics.band_area_m2.toFixed(2)} m²`}
                      </div>
                      <div className="text-gray-500">
                        ID: {materialSettings?.materialId?.slice(0, 8)}...
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={handleGenerateQuote}
          disabled={!isCalibrated || masksWithMaterials.length === 0 || isGenerating}
          className="w-full"
          data-testid="generate-quote-button"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
              Generating Quote...
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4 mr-2" />
              Generate Quote Draft
            </>
          )}
        </Button>

        {/* Requirements */}
        {(!isCalibrated || masksWithMaterials.length === 0) && (
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            Requirements:
            <ul className="list-disc list-inside mt-1 space-y-1">
              {!isCalibrated && <li>Set calibration for accurate measurements</li>}
              {masksWithMaterials.length === 0 && <li>Assign materials to at least one mask</li>}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}