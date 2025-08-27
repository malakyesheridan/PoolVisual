/**
 * B. CALIBRATION STATE HELPERS
 * Fixes router selection logic for proper tool routing
 */

export type CalState = 'idle' | 'placingA' | 'placingB' | 'lengthEntry' | 'ready';

export const isCalibrationActive = (s: { calState: CalState }) =>
  s.calState === 'placingA' || s.calState === 'placingB' || s.calState === 'lengthEntry';

export const getCalibrationStatusText = (calibration: any, calState: CalState): string => {
  if (calState !== 'idle' && calState !== 'ready') {
    return `Calibrating... (${calState})`;
  }
  if (calibration?.ppm) {
    return `Calibrated • 1m = ${Math.round(calibration.ppm)}px`;
  }
  return 'Not calibrated';
};