/**
 * Calibration Controls Component
 * Handles setting up pixel-to-meter calibration for accurate measurements
 */

import React, { useState } from 'react';
import { Ruler, Check, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEditorStore } from '@/stores/editorSlice';
import { getCalibrationInfo } from '@/lib/calibration';

export function CalibrationControls() {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [referenceLength, setReferenceLength] = useState<string>('1.0');
  
  const { editorState, setCalibrationMode } = useEditorStore();
  const calibration = editorState.calibration;
  const isCalibrated = calibration && calibration.pixelsPerMeter > 0;

  const handleStartCalibration = () => {
    setIsCalibrating(true);
    setCalibrationMode(true);
  };

  const handleCancelCalibration = () => {
    setIsCalibrating(false);
    setCalibrationMode(false);
  };

  const getScaleDescription = (ppm: number): string => {
    const metersPerPixel = 1 / ppm;
    
    if (metersPerPixel >= 1) {
      return `1px = ${metersPerPixel.toFixed(2)}m`;
    } else if (metersPerPixel >= 0.01) {
      return `1px = ${(metersPerPixel * 100).toFixed(1)}cm`;
    } else {
      return `1px = ${(metersPerPixel * 1000).toFixed(1)}mm`;
    }
  };

  if (isCalibrated) {
    const info = getCalibrationInfo(calibration);
    
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center">
            <Ruler className="h-4 w-4 mr-2 text-green-600" />
            Calibration Active
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-xs text-gray-600">
            Reference: {info.lengthPixels}px = {info.lengthMeters}m
          </div>
          <Badge variant="secondary" className="text-xs">
            {getScaleDescription(info.pixelsPerMeter)}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={handleStartCalibration}
            className="w-full text-xs"
            data-testid="recalibrate-button"
          >
            Recalibrate
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isCalibrating) {
    return (
      <Card className="mb-4 border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center">
            <Ruler className="h-4 w-4 mr-2 text-blue-600" />
            Setting Calibration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded">
            <Info className="h-3 w-3 inline mr-1" />
            Draw a line on a known distance in the image
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="reference-length" className="text-xs">
              Reference Length (meters)
            </Label>
            <Input
              id="reference-length"
              type="number"
              min="0.1"
              step="0.1"
              value={referenceLength}
              onChange={(e) => setReferenceLength(e.target.value)}
              placeholder="e.g., 1.0"
              className="text-xs"
              data-testid="reference-length-input"
            />
          </div>
          
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelCalibration}
              className="flex-1 text-xs"
              data-testid="cancel-calibration-button"
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs"
              disabled={!referenceLength || parseFloat(referenceLength) <= 0}
              data-testid="confirm-calibration-button"
            >
              <Check className="h-3 w-3 mr-1" />
              Set
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4 border-amber-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center">
          <Ruler className="h-4 w-4 mr-2 text-amber-600" />
          Calibration Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
          Set calibration to enable accurate measurements
        </div>
        <Button
          size="sm"
          onClick={handleStartCalibration}
          className="w-full text-xs"
          data-testid="start-calibration-button"
        >
          <Ruler className="h-3 w-3 mr-1" />
          Set Calibration
        </Button>
      </CardContent>
    </Card>
  );
}