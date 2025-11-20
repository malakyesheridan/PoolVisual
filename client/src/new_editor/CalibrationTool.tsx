import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from './store';
import { Point } from './types';

interface CalibrationToolProps {
  onClose: () => void;
}

type CalibrationMode = 'none' | 'measuring' | 'confirming';

export function CalibrationTool({ onClose }: CalibrationToolProps) {
  const { dispatch, calibration, photoSpace } = useEditorStore();
  const [mode, setMode] = useState<CalibrationMode>('none');
  const [measurementPoints, setMeasurementPoints] = useState<Point[]>([]);
  const [knownLength, setKnownLength] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  // Use ref to store current mode to avoid recreating event listener
  const modeRef = useRef<CalibrationMode>(mode);
  modeRef.current = mode;

  // Reset state when component mounts
  useEffect(() => {
    console.log('[CalibrationTool] Component mounted, setting up calibration mode');
    setMode('none');
    setMeasurementPoints([]);
    setKnownLength('');
    setError('');
    
    // Enable calibration mode with retry logic
    const enableCalibrationMode = () => {
      dispatch({ type: 'SET_CALIBRATION_MODE', payload: true });
      console.log('[CalibrationTool] Calibration mode set to true on mount');
      
      // Verify the state was set with retry
      const verifyMode = () => {
        const { calibrationMode } = useEditorStore.getState();
        console.log('[CalibrationTool] Verified calibration mode after mount:', calibrationMode);
        
        if (!calibrationMode) {
          console.log('[CalibrationTool] Calibration mode not set on mount, retrying...');
          dispatch({ type: 'SET_CALIBRATION_MODE', payload: true });
          setTimeout(verifyMode, 50);
        } else {
          console.log('[CalibrationTool] Calibration mode confirmed active on mount');
        }
      };
      
      setTimeout(verifyMode, 10);
    };
    
    enableCalibrationMode();
    
    return () => {
      // Disable calibration mode when component unmounts
      console.log('[CalibrationTool] Component unmounting, disabling calibration mode');
      dispatch({ type: 'SET_CALIBRATION_MODE', payload: false });
    };
  }, [dispatch]);

  const handleStartCalibration = useCallback(() => {
    // Check if zoom is at 100% (scale = 1.0)
    const currentScale = photoSpace?.scale || 1;
    const isAt100Percent = Math.abs(currentScale - 1.0) < 0.01; // Allow small floating point tolerance
    
    console.log('[CalibrationTool] Starting calibration check:', {
      currentScale,
      isAt100Percent,
      photoSpace: photoSpace,
      tolerance: 0.01,
      difference: Math.abs(currentScale - 1.0)
    });
    
    if (!isAt100Percent) {
      const errorMsg = `Calibration requires zoom to be at 100%. Current zoom: ${Math.round(currentScale * 100)}%. Please zoom to 100% first.`;
      console.log('[CalibrationTool] Calibration blocked:', errorMsg);
      setError(errorMsg);
      return;
    }

    console.log('[CalibrationTool] Starting calibration - setting mode to measuring');
    setMode('measuring');
    setMeasurementPoints([]);
    setError('');
    
    // Ensure calibration mode is set in the store with proper timing
    dispatch({ type: 'SET_CALIBRATION_MODE', payload: true });
    console.log('[CalibrationTool] Calibration mode set to true in store, mode set to measuring');
    
    // Force a re-render and state verification with multiple checks
    const verifyCalibrationMode = () => {
      const { calibrationMode } = useEditorStore.getState();
      console.log('[CalibrationTool] Store calibrationMode verification:', calibrationMode);
      
      if (!calibrationMode) {
        console.log('[CalibrationTool] Calibration mode not set, retrying...');
        dispatch({ type: 'SET_CALIBRATION_MODE', payload: true });
        setTimeout(verifyCalibrationMode, 50);
      } else {
        console.log('[CalibrationTool] Calibration mode confirmed active');
        
        // Also check if MaskCanvasKonva received the update
        const konvaElement = document.querySelector('[data-canvas="konva"]');
        if (konvaElement) {
          console.log('[CalibrationTool] Konva canvas found, should be receiving events');
        } else {
          console.log('[CalibrationTool] WARNING: Konva canvas not found!');
        }
      }
    };
    
    // Start verification after a short delay
    setTimeout(verifyCalibrationMode, 10);
  }, [dispatch, photoSpace]);

  const handleCancelCalibration = useCallback(() => {
    setMode('none');
    setMeasurementPoints([]);
    setKnownLength('');
    setError('');
    // Disable calibration mode when cancelling
    dispatch({ type: 'SET_CALIBRATION_MODE', payload: false });
    console.log('[CalibrationTool] Cancelled calibration');
    onClose(); // Close the modal
  }, [dispatch, onClose]);

  const handleConfirmCalibration = useCallback(() => {
    const length = parseFloat(knownLength);
    
    if (isNaN(length) || length <= 0) {
      setError('Please enter a valid length greater than 0');
      return;
    }

    if (measurementPoints.length !== 2) {
      setError('Please measure exactly 2 points');
      return;
    }

    // Calculate distance between points
    const [p1, p2] = measurementPoints;
    const pixelDistance = Math.sqrt(
      Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
    );

    if (pixelDistance <= 0) {
      setError('Points are too close together');
      return;
    }

    // Calculate pixels per meter
    const pixelsPerMeter = pixelDistance / length;

    // Update calibration state
    dispatch({
      type: 'SET_CALIBRATION',
      payload: {
        isCalibrated: true,
        referenceLength: length,
        referencePixels: pixelDistance,
        pixelsPerMeter,
        calibrationDate: Date.now(),
        calibrationMethod: 'manual'
      }
    });

    console.log('[CalibrationTool] Calibration completed:', {
      referenceLength: length,
      referencePixels: pixelDistance,
      pixelsPerMeter
    });

    // Disable calibration mode and close the tool
    dispatch({ type: 'SET_CALIBRATION_MODE', payload: false });
    onClose();
  }, [knownLength, measurementPoints, dispatch, onClose]);

  const handleLengthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setKnownLength(e.target.value);
    setError('');
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && mode === 'confirming') {
      handleConfirmCalibration();
    } else if (e.key === 'Escape') {
      handleCancelCalibration();
    }
  }, [mode, handleConfirmCalibration, handleCancelCalibration]);

  // Listen for measurement points from the canvas
  useEffect(() => {
    console.log('[CalibrationTool] Setting up measurement point listener');

    const handleMeasurementPoint = (event: CustomEvent<Point>) => {
      const { calibration, calibrationMode } = useEditorStore.getState();
      console.log('[CalibrationTool] Received measurement point event:', event.detail);
      console.log('[CalibrationTool] Event type:', event.type);
      console.log('[CalibrationTool] Current calibration mode from store:', calibrationMode);
      console.log('[CalibrationTool] Current component mode:', modeRef.current);
      console.log('[CalibrationTool] Calibration state:', calibration);

      if (modeRef.current === 'measuring') {
        const point = event.detail;
        setMeasurementPoints(prev => {
          const newPoints = [...prev, point];
          console.log('[CalibrationTool] Points updated:', newPoints.length, '/2');
          if (newPoints.length === 2) {
            console.log('[CalibrationTool] Both points captured, switching to confirming mode');
            setMode('confirming');
          }
          return newPoints;
        });
      } else {
        console.log('[CalibrationTool] Ignoring point - component not in measuring mode, current mode:', modeRef.current);
      }
    };

    window.addEventListener('calibration-measurement-point', handleMeasurementPoint as EventListener);

    return () => {
      console.log('[CalibrationTool] Removing measurement point listener');
      window.removeEventListener('calibration-measurement-point', handleMeasurementPoint as EventListener);
    };
  }, []); // Empty dependency array - use ref to access current mode

  // Don't render modal when in measuring mode - let user interact with canvas
  if (mode === 'measuring') {
    return (
      <div className="fixed top-4 left-4 bg-blue-100 border border-blue-300 rounded-lg p-3 shadow-lg z-50">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
          <div>
            <div className="text-sm font-medium text-blue-900">📏 Measuring Mode Active</div>
            <div className="text-xs text-blue-700">Click two points on the canvas</div>
            <div className="text-xs text-blue-600">Points: {measurementPoints.length}/2</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Calibrate Measurements
          </h2>
          <button
            onClick={() => {
              // Cancel calibration and close modal
              dispatch({ type: 'SET_CALIBRATION_MODE', payload: false });
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Calibration Status */}
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${
                calibration.isCalibrated ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              <span className="text-sm font-medium text-gray-700">
                {calibration.isCalibrated 
                  ? `Calibrated (${calibration.pixelsPerMeter.toFixed(0)} px/m)`
                  : 'Not Calibrated'
                }
              </span>
            </div>
          </div>

          {/* Zoom Level Indicator */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Current Zoom:</span>
              <span className={`text-sm font-bold ${
                (() => {
                  const fitScale = photoSpace?.fitScale || 1;
                  const currentScale = photoSpace?.scale || 1;
                  return Math.abs(currentScale - fitScale) < 0.01 ? 'text-green-600' : 'text-red-600';
                })()
              }`}>
                {(() => {
                  const fitScale = photoSpace?.fitScale || 1;
                  const currentScale = photoSpace?.scale || 1;
                  return Math.round((currentScale / fitScale) * 100);
                })()}%
              </span>
            </div>
            {(() => {
              const fitScale = photoSpace?.fitScale || 1;
              const currentScale = photoSpace?.scale || 1;
              return Math.abs(currentScale - fitScale) >= 0.01;
            })() && (
              <p className="text-xs text-red-600 mt-1">
                ⚠️ Calibration requires 100% zoom
              </p>
            )}
            <div className="mt-2 text-xs text-gray-600">
              <p>Calibration Mode: {useEditorStore.getState().calibrationMode ? 'ON' : 'OFF'}</p>
              <p>Component Mode: {mode}</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-sm text-gray-600">
            {mode === 'none' && (
              <div>
                <p>Click "Start Calibration" to measure a known distance on your image.</p>
                <p className="text-xs text-gray-500 mt-1">
                  💡 Make sure zoom is at 100% for accurate calibration
                </p>
              </div>
            )}
            {mode === 'measuring' && (
              <div>
                <p className="font-medium text-blue-600 mb-2">📏 Measuring Mode Active</p>
                <p className="mb-2">Click on two points on the canvas that represent a known distance.</p>
                <p className="text-xs text-gray-500">
                  Points measured: {measurementPoints.length}/2
                </p>
                <p className="text-xs text-amber-600 mt-2 font-medium">
                  💡 Click anywhere on the image to set measurement points
                </p>
              </div>
            )}
            {mode === 'confirming' && (
              <div>
                <p className="font-medium text-green-600 mb-2">✅ Enter Known Distance</p>
                <p>Enter the real-world distance between the two points you measured.</p>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Measurement Points Display */}
          {measurementPoints.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Measurement Points:</p>
              {measurementPoints.map((point, index) => (
                <p key={index} className="text-xs text-gray-600">
                  Point {index + 1}: ({point.x.toFixed(1)}, {point.y.toFixed(1)})
                </p>
              ))}
              {measurementPoints.length === 2 && (
                <p className="text-xs text-gray-600 mt-1">
                  Distance: {Math.sqrt(
                    Math.pow(measurementPoints[1].x - measurementPoints[0].x, 2) +
                    Math.pow(measurementPoints[1].y - measurementPoints[0].y, 2)
                  ).toFixed(1)} pixels
                </p>
              )}
            </div>
          )}

          {/* Distance Input */}
          {mode === 'confirming' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Known Distance (meters)
              </label>
              <input
                type="number"
                value={knownLength}
                onChange={handleLengthChange}
                onKeyPress={handleKeyPress}
                placeholder="e.g., 5.0"
                step="0.1"
                min="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            {mode === 'none' && (
              <>
                <button
                  onClick={handleCancelCalibration}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartCalibration}
                  disabled={Math.abs((photoSpace?.scale || 1) - 1.0) >= 0.01}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    Math.abs((photoSpace?.scale || 1) - 1.0) >= 0.01
                      ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                      : 'text-white bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Start Calibration
                </button>
              </>
            )}
            
            {mode === 'measuring' && (
              <button
                onClick={handleCancelCalibration}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
            )}
            
            {mode === 'confirming' && (
              <>
                <button
                  onClick={handleCancelCalibration}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCalibration}
                  disabled={!knownLength || parseFloat(knownLength) <= 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  Confirm Calibration
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
