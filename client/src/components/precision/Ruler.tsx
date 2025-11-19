// client/src/components/precision/Ruler.tsx
import React from 'react';

interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  viewport: { x: number; y: number; width: number; height: number };
  pixelsPerUnit: number;
  unit: 'metric' | 'imperial';
  calibration?: { pixelsPerMeter: number };
}

interface Tick {
  value: number;
  position: number;
  major: boolean;
}

function generateTicks(
  viewport: { x: number; y: number; width: number; height: number },
  interval: number,
  pixelsPerUnit: number,
  unit: 'metric' | 'imperial',
  orientation: 'horizontal' | 'vertical'
): Tick[] {
  const ticks: Tick[] = [];
  
  if (orientation === 'horizontal') {
    const startValue = (viewport.x / pixelsPerUnit);
    const endValue = ((viewport.x + viewport.width) / pixelsPerUnit);
    let currentValue = Math.floor(startValue / interval) * interval;
    
    while (currentValue <= endValue) {
      const position = (currentValue * pixelsPerUnit) - viewport.x;
      const major = currentValue % (interval * 10) === 0;
      
      ticks.push({
        value: currentValue,
        position,
        major,
      });
      
      currentValue += interval;
    }
  } else {
    // Vertical ruler - fixed math
    const startValue = (viewport.y / pixelsPerUnit);
    const endValue = ((viewport.y + viewport.height) / pixelsPerUnit);
    let currentValue = Math.floor(startValue / interval) * interval;
    
    while (currentValue <= endValue) {
      const position = (currentValue * pixelsPerUnit) - viewport.y;
      const major = currentValue % (interval * 10) === 0;
      
      ticks.push({
        value: currentValue,
        position,
        major,
      });
      
      currentValue += interval;
    }
  }
  
  return ticks;
}

export function Ruler({ orientation, viewport, pixelsPerUnit, unit, calibration }: RulerProps) {
  // Determine interval based on pixelsPerUnit
  const interval = pixelsPerUnit > 100 ? 1 : pixelsPerUnit > 50 ? 0.5 : 0.1;
  const ticks = generateTicks(viewport, interval, pixelsPerUnit, unit, orientation);
  
  const rulerWidth = orientation === 'horizontal' ? viewport.width : 20;
  const rulerHeight = orientation === 'horizontal' ? 20 : viewport.height;
  
  return (
    <div
      className="ruler"
      style={{
        position: 'absolute',
        [orientation === 'horizontal' ? 'top' : 'left']: 0,
        [orientation === 'horizontal' ? 'left' : 'top']: 0,
        width: rulerWidth,
        height: rulerHeight,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        border: '1px solid var(--border-default)',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      <svg
        width={rulerWidth}
        height={rulerHeight}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {ticks.map((tick, i) => (
          <g key={i}>
            {orientation === 'horizontal' ? (
              <>
                <line
                  x1={tick.position}
                  y1={tick.major ? 0 : rulerHeight * 0.5}
                  x2={tick.position}
                  y2={rulerHeight}
                  stroke="var(--border-default)"
                  strokeWidth={tick.major ? 2 : 1}
                  shapeRendering="crispEdges"
                />
                {tick.major && (
                  <text
                    x={tick.position + 2}
                    y={rulerHeight - 4}
                    fontSize="10"
                    fill="var(--foreground)"
                  >
                    {tick.value.toFixed(unit === 'metric' ? 1 : 2)}
                  </text>
                )}
              </>
            ) : (
              <>
                <line
                  x1={tick.major ? 0 : rulerWidth * 0.5}
                  y1={tick.position}
                  x2={rulerWidth}
                  y2={tick.position}
                  stroke="var(--border-default)"
                  strokeWidth={tick.major ? 2 : 1}
                  shapeRendering="crispEdges"
                />
                {tick.major && (
                  <text
                    x={2}
                    y={tick.position + 10}
                    fontSize="10"
                    fill="var(--foreground)"
                    transform={`rotate(-90 ${2} ${tick.position + 10})`}
                  >
                    {tick.value.toFixed(unit === 'metric' ? 1 : 2)}
                  </text>
                )}
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

