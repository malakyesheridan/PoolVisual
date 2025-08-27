/**
 * Robust Calibration Controls V2
 * Complete state machine implementation with visual feedback
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Ruler, Check, X, Info, Trash2, Target, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEditorStore } from '@/stores/editorSlice';
import { 
  formatPixelsPerMeter, 
  getConfidenceLevel, 
  getConfidenceDescription,
  getPixelDistance
} from '@/lib/calibration-v2';
import type { CalSample } from '@shared/schema';

export function CalibrationControlsV2() {
  const [inputMeters, setInputMeters] = useState<string>('1.0');
  
  const store = useEditorStore();
  const { editorState, startCalibration, placeCalPoint, setCalMeters, commitCalSample, 
          deleteCalSample, cancelCalibration, persistCalibration, photoId } = store;
  
  const { calibrationV2, calState, calTemp } = editorState;
  
  const isCalibrated = calibrationV2 && calibrationV2.samples.length > 0;
  const confidence = calibrationV2 ? getConfidenceLevel(calibrationV2.stdevPct) : 'low';
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        if (calState === 'idle') {
          handleStartCalibration();
        }
      } else if (e.key === 'Enter') {
        if (calState === 'lengthEntry' && parseFloat(inputMeters) > 0) {
          handleCommitSample();
        }
      } else if (e.key === 'Escape') {
        if (calState !== 'idle') {
          handleCancel();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [calState, inputMeters]);
  
  const handleStartCalibration = useCallback(() => {
    startCalibration();
    setInputMeters('1.0');
  }, [startCalibration]);
  
  const handleCancel = useCallback(() => {
    cancelCalibration();
    setInputMeters('1.0');
  }, [cancelCalibration]);
  
  const handleMetersChange = useCallback((value: string) => {
    setInputMeters(value);
    const meters = parseFloat(value);
    if (meters >= 0.01) {
      setCalMeters(meters);
    }
  }, [setCalMeters]);
  
  const handleCommitSample = useCallback(async () => {
    const meters = parseFloat(inputMeters);
    if (meters >= 0.01) {
      setCalMeters(meters);
      await commitCalSample();
      setInputMeters('1.0');
    }
  }, [inputMeters, setCalMeters, commitCalSample]);
  
  const handleDeleteSample = useCallback((sampleId: string) => {
    deleteCalSample(sampleId);
  }, [deleteCalSample]);
  
  const renderSampleChips = () => {
    if (!calibrationV2?.samples.length) return null;
    
    return (
      <div className="space-y-2">
        <Label className="text-xs">Reference Samples</Label>
        <div className="flex flex-wrap gap-1">
          {calibrationV2.samples.map((sample, index) => {
            const distance = getPixelDistance(sample.a, sample.b);
            return (
              <div 
                key={sample.id} 
                className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded px-2 py-1"
              >
                <span className="text-xs text-blue-700">
                  #{index + 1}: {sample.meters}m ({distance.toFixed(0)}px)
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteSample(sample.id)}
                  className="h-4 w-4 p-0 text-blue-600 hover:text-red-600"
                  data-testid={`delete-sample-${index}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  const renderConfidenceBadge = () => {
    if (!calibrationV2) return null;
    
    const confidenceColors = {
      high: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
      low: 'bg-red-100 text-red-800 border-red-200'
    };
    
    return (
      <div className="flex items-center gap-2">
        <Badge className={`text-xs ${confidenceColors[confidence]}`}>
          {confidence === 'high' && <CheckCircle className="h-3 w-3 mr-1" />}
          {confidence === 'medium' && <AlertTriangle className="h-3 w-3 mr-1" />}
          {confidence === 'low' && <AlertTriangle className="h-3 w-3 mr-1" />}
          {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence
        </Badge>
        <span className="text-xs text-gray-600">
          {formatPixelsPerMeter(calibrationV2.ppm)}
        </span>
      </div>
    );
  };
  
  // Live preview during placement
  const renderLivePreview = () => {
    if (calState !== 'placingB' && calState !== 'lengthEntry') return null;
    
    const { a, b } = calTemp;
    if (!a || !b) return null;
    
    const distance = getPixelDistance(a, b);
    const meters = parseFloat(inputMeters) || 1.0;
    const previewPpm = distance / meters;
    
    return (
      <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
        <div>Live preview: {distance.toFixed(0)}px = {meters}m</div>
        <div>Scale: {formatPixelsPerMeter(previewPpm)}</div>
      </div>
    );
  };
  
  // Calibrated state - show status and option to add more samples
  if (isCalibrated && calState === 'ready') {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            Calibration Active
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {renderConfidenceBadge()}
          
          <div className="text-xs text-gray-600">
            Global scale: 1m = {calibrationV2!.ppm.toFixed(1)}px
            {calibrationV2!.stdevPct !== undefined && (
              <div>Variation: {calibrationV2!.stdevPct.toFixed(1)}%</div>
            )}
          </div>
          
          {renderSampleChips()}
          
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleStartCalibration}
              className="flex-1 text-xs"
              data-testid="add-sample-button"
            >
              <Target className="h-3 w-3 mr-1" />
              Add Sample
            </Button>
            {calibrationV2!.samples.length >= 2 && confidence === 'low' && (
              <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded flex-1">
                Consider adding more samples for better accuracy
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Setting calibration state machine
  if (calState !== 'idle') {
    const isPlacingPoints = calState === 'placingA' || calState === 'placingB';
    const isEnteringLength = calState === 'lengthEntry';
    
    return (
      <Card className="mb-4 border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center">
            <Ruler className="h-4 w-4 mr-2 text-blue-600" />
            Setting Reference Scale
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isPlacingPoints && (
            <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded">
              <Info className="h-3 w-3 inline mr-1" />
              {calState === 'placingA' ? 
                'Click to place first point of reference line' :
                'Click to place second point of reference line'
              }
            </div>
          )}
          
          {isEnteringLength && (
            <div className="space-y-2">
              <Label htmlFor="reference-length" className="text-xs">
                Reference Length (meters)
              </Label>
              <Input
                id="reference-length"
                type="number"
                min="0.25"
                step="0.01"
                value={inputMeters}
                onChange={(e) => handleMetersChange(e.target.value)}
                placeholder="e.g., 1.0"
                className="text-xs"
                data-testid="reference-length-input"
                autoFocus
              />
              {parseFloat(inputMeters) < 0.25 && (
                <div className="text-xs text-red-600">
                  Minimum reference length is 0.25m for accuracy
                </div>
              )}
            </div>
          )}
          
          {renderLivePreview()}
          
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              className="flex-1 text-xs"
              data-testid="cancel-calibration-button"
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            {isEnteringLength && (
              <Button
                size="sm"
                className="flex-1 text-xs"
                disabled={parseFloat(inputMeters) < 0.25}
                onClick={handleCommitSample}
                data-testid="confirm-calibration-button"
              >
                <Check className="h-3 w-3 mr-1" />
                Add Sample
              </Button>
            )}
          </div>
          
          <div className="text-xs text-gray-500">
            Keyboard: C to start, Enter to confirm, Esc to cancel
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Initial state - no calibration
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
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          Set scale reference to enable accurate measurements
        </div>
        <Button
          size="sm"
          onClick={handleStartCalibration}
          className="w-full text-xs"
          data-testid="start-calibration-button"
        >
          <Ruler className="h-3 w-3 mr-1" />
          Draw Reference Line
        </Button>
        <div className="text-xs text-gray-500">
          Tip: Add 2-3 samples on the same plane for higher accuracy
        </div>
      </CardContent>
    </Card>
  );
}