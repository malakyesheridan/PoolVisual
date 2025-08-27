/**
 * E. EVENT HUD - Development instrumentation to prove event routing
 */

import React from 'react';
import { useEditorStore } from '@/stores/editorSlice';
import { getCalibrationStatusText } from '@/utils/calibrationHelpers';

export function EventHud() {
  const s = useEditorStore();
  const data = {
    tool: s.editorState?.activeTool || 'none',
    calState: s.editorState?.calState || 'idle',
    ppm: s.editorState?.calibration?.ppm ?? null,
    consumed: s.__debug?.lastConsumer ?? 'none',
    down: s.__debug?.down ?? 0,
    move: s.__debug?.move ?? 0,
    up: s.__debug?.up ?? 0,
  };
  
  const statusText = getCalibrationStatusText(s.editorState?.calibration, data.calState as any);
  
  return (
    <div style={{
      position: 'absolute', 
      top: 12, 
      left: 12, 
      background: 'rgba(0,0,0,.65)',
      color: '#fff', 
      padding: '8px 10px', 
      borderRadius: 8, 
      fontSize: 12, 
      zIndex: 10, 
      pointerEvents: 'none',
      fontFamily: 'monospace'
    }}>
      <div>🔧 tool: <strong>{data.tool}</strong></div>
      <div>📐 {statusText}</div>
      <div>🎯 last: <strong>{data.consumed}</strong></div>
      <div>📊 events: {data.down}/{data.move}/{data.up}</div>
    </div>
  );
}