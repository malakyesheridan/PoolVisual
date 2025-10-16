/**
 * Quote Generator Component
 * Creates professional quotes from canvas measurements and materials
 */

import React, { useState } from 'react';
import { FileText, Calculator, DollarSign, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEditorStore } from '@/stores/editorStore';
import { useProjectStore } from '@/stores/projectStore';
import { useMaskStore } from '@/maskcore/store';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';

export function QuoteGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { masks, photo } = useEditorStore();
  const { project, currentPhoto } = useProjectStore();
  const { masks: maskStoreMasks, CREATE_QUOTE, ADD_QUOTE_ITEM, SET_ACTIVE_QUOTE } = useMaskStore();
  const { toast } = useToast();
  
  const isCalibrated = photo?.space?.calibration && photo.space.calibration.pixelsPerMeter > 0;
  
  // Calculate total estimated cost using mask store data
  const calculateTotalCost = () => {
    let total = 0;
    let hasItems = false;
    
    if (maskStoreMasks && Object.keys(maskStoreMasks).length > 0) {
      Object.values(maskStoreMasks).forEach(mask => {
        if (mask.materialId && mask.isVisible !== false) {
          hasItems = true;
          // Calculate area and cost
          const areaPixels = calculatePolygonArea(mask.pts);
          const pixelsPerMeter = photo?.space?.calibration?.pixelsPerMeter || 100;
          const area = areaPixels / (pixelsPerMeter * pixelsPerMeter);
          
          // TODO: Get actual material price from API
          const materialCost = 50; // Placeholder
          const laborCost = 25; // Placeholder
          const markup = 1.3; // 30% markup
          
          total += (materialCost + laborCost) * area * markup;
        }
      });
    }
    
    return { total, hasItems };
  };

  // Helper function to calculate polygon area
  const calculatePolygonArea = (points: any[]): number => {
    if (points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  };

  const { total, hasItems } = calculateTotalCost();
  
  const masksWithMaterials = Object.values(maskStoreMasks || {}).filter(mask => 
    mask.materialId && mask.isVisible !== false
  );

  const handleGenerateQuote = async () => {
    if (!project) {
      toast({
        title: "No Project",
        description: "Please select a project to generate quotes for",
        variant: "destructive",
      });
      return;
    }

    if (!masksWithMaterials.length) {
      toast({
        title: "No Materials Assigned",
        description: "Please assign materials to masks before generating quotes",
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

    setIsGenerating(true);
    
    try {
      // Create quote via API
      const quoteData = {
        jobId: project.jobId,
        status: 'draft',
        subtotal: total,
        gst: total * 0.1, // 10% GST
        total: total * 1.1,
        depositPct: 0.3, // 30% deposit
        validityDays: 30
      };

      const quote = await apiClient.createQuote(quoteData);
      
      // Create quote items for each mask
      for (const mask of masksWithMaterials) {
        const areaPixels = calculatePolygonArea(mask.pts);
        const pixelsPerMeter = photo?.space?.calibration?.pixelsPerMeter || 100;
        const area = areaPixels / (pixelsPerMeter * pixelsPerMeter);
        
        const itemData = {
          quoteId: quote.id,
          kind: 'material',
          materialId: mask.materialId,
          description: `Material for ${mask.name || 'mask'}`,
          unit: 'm2',
          qty: area,
          unitPrice: 50, // TODO: Get from material API
          lineTotal: area * 50
        };

        await apiClient.addQuoteItem(quote.id, itemData);
      }
      
      toast({
        title: "Quote Generated",
        description: `Quote created successfully for ${project.name}`,
        variant: "default",
      });
    } catch (error) {
      console.error('Quote generation failed:', error);
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
              const metrics = computeMetrics?.(mask.id) || {};
              const materialSettings = maskMaterials?.[mask.id];
              
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