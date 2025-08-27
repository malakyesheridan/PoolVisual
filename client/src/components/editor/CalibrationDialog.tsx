/**
 * Calibration Length Input Dialog
 * Shows when user needs to enter distance in meters
 */

import { useState, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorSlice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CalibrationDialog() {
  const { calState, commitCalSample, cancelCalibration, setCalMeters } = useEditorStore();
  const [meters, setMeters] = useState<string>('');

  const isOpen = calState === 'lengthEntry';

  useEffect(() => {
    if (isOpen) {
      setMeters('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(meters);
    if (value > 0) {
      setCalMeters(value);
      commitCalSample();
    }
  };

  const handleCancel = () => {
    cancelCalibration();
    setMeters('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Set Reference Distance</h3>
        <p className="text-sm text-gray-600 mb-4">
          Enter the real-world distance between the two points you placed (in meters).
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="distance">Distance (meters)</Label>
            <Input
              id="distance"
              type="number"
              step="0.01"
              min="0.01"
              value={meters}
              onChange={(e) => setMeters(e.target.value)}
              placeholder="e.g. 2.5"
              autoFocus
              data-testid="input-calibration-meters"
            />
          </div>
          
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              data-testid="button-calibration-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!meters || parseFloat(meters) <= 0}
              data-testid="button-calibration-commit"
            >
              Set Calibration
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}