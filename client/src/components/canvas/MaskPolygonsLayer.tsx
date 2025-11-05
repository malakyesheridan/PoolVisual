import React from 'react';
import { Line, Shape, Group } from 'react-konva';
import { MaskControlButtons } from './MaskControlButtons';
import { useMaskStore, Mask, MaskPoint } from '../../maskcore/store';

interface Props {
  masks: Record<string, Mask>;
  selectedId: string | null;
  onSelect: (maskId: string) => void;
  imgFit?: { originX: number; originY: number; imgScale: number };
}

// Helper function to convert Bezier curves to a path string
function maskPointsToPath(points: MaskPoint[], maskType: 'area' | 'linear' = 'area'): string {
  if (points.length < 2) return '';
  
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    const current = points[i];
    const prev = points[i - 1];
    
    if (current.kind === 'smooth' && current.h1 && current.h2) {
      // Bezier curve with handles
      path += ` C ${prev.h2?.x || prev.x} ${prev.h2?.y || prev.y} ${current.h1.x} ${current.h1.y} ${current.x} ${current.y}`;
    } else {
      // Linear segment
      path += ` L ${current.x} ${current.y}`;
    }
  }
  
  // Only close the path for area masks, not for linear masks
  if (maskType === 'area' && points.length >= 3) {
    const first = points[0];
    const last = points[points.length - 1];
    
    if (last.kind === 'smooth' && last.h1 && last.h2) {
      path += ` C ${last.h2.x} ${last.h2.y} ${first.h1?.x || first.x} ${first.h1?.y || first.y} ${first.x} ${first.y}`;
    } else {
      path += ` L ${first.x} ${first.y}`;
    }
  }
  
  return path;
}

// Helper function to convert Bezier curves to flat points array for Line component
function maskPointsToFlatArray(points: MaskPoint[], maskType: 'area' | 'linear' = 'area'): number[] {
  if (points.length < 2) return [];
  
  const flatPoints: number[] = [];
  
  // Start with first point
  flatPoints.push(points[0].x, points[0].y);
  
  // Add intermediate points for Bezier curves
  for (let i = 1; i < points.length; i++) {
    const current = points[i];
    const prev = points[i - 1];
    
    if (current.kind === 'smooth' && current.h1 && current.h2) {
      // Add control points for Bezier curve (simplified - just add the handles)
      flatPoints.push(prev.h2?.x || prev.x, prev.h2?.y || prev.y);
      flatPoints.push(current.h1.x, current.h1.y);
    }
    
    flatPoints.push(current.x, current.y);
  }
  
  // Only close the path for area masks
  if (maskType === 'area' && points.length >= 3) {
    const first = points[0];
    const last = points[points.length - 1];
    
    if (last.kind === 'smooth' && last.h1 && last.h2) {
      flatPoints.push(last.h2.x, last.h2.y);
      flatPoints.push(first.h1?.x || first.x, first.h1?.y || first.y);
    }
    
    flatPoints.push(first.x, first.y);
  }
  
  return flatPoints;
}

export function MaskPolygonsLayer({ masks, selectedId, onSelect, imgFit }: Props) {
  const { pointEditingMode, editingMaskId } = useMaskStore();
  
  // Sort masks by zIndex for z-buffer rendering (shallow to deep)
  const sortedMasks = Object.entries(masks).sort(([, maskA], [, maskB]) => {
    const zIndexA = maskA.zIndex || 0;
    const zIndexB = maskB.zIndex || 0;
    return zIndexA - zIndexB; // Shallow first, deep last
  });
  
  // Calculate depth-based visual effects
  const getDepthEffects = (mask: any) => {
    const depthLevel = mask.depthLevel || 0;
    const isStepped = mask.isStepped || false;
    
    // Base opacity decreases with depth
    const baseOpacity = Math.max(0.3, 1.0 - (depthLevel * 0.2));
    
    // Stepped geometry gets additional darkening
    const steppedMultiplier = isStepped ? 0.8 : 1.0;
    
    // Calculate final opacity
    const finalOpacity = baseOpacity * steppedMultiplier;
    
    // Depth-based color tinting (subtle)
    const depthTint = depthLevel === 0 ? '#ffffff' : 
                     depthLevel === 1 ? '#f0f8ff' : 
                     '#e6f3ff'; // Deep gets slight blue tint
    
    return {
      opacity: finalOpacity,
      tint: depthTint,
      depthLevel,
      isStepped
    };
  };
  
  return (
    <>
      {sortedMasks.map(([maskId, mask]) => {
        if (!mask.pts || mask.pts.length < 3) return null;
        
        // Skip hidden masks
        if (mask.isVisible === false) return null;
        
        // Skip masks with materials - they are rendered by MaskTextureLayer instead
        // This prevents duplicate rendering that causes the green background issue
        if (mask.materialId) return null;

        // Check if this mask is in point editing mode
        const isInPointEditing = pointEditingMode && editingMaskId === maskId;
        
        let points;
        let hasBezierCurves = mask.pts.some(pt => pt.kind === 'smooth');
        
        // Helper function to get points for Line components (simplified for Bezier curves)
        const getLinePoints = () => {
          if (hasBezierCurves && !isInPointEditing) {
            // For Bezier curves, use a simplified approximation for Line components
            // This creates more points along the curves for smoother rendering
            const simplifiedPoints: number[] = [];
            
            for (let i = 0; i < mask.pts.length; i++) {
              const current = mask.pts[i];
              const next = mask.pts[(i + 1) % mask.pts.length];
              
              if (current.kind === 'smooth' && current.h1 && current.h2) {
                // Add multiple points along the Bezier curve
                for (let t = 0; t <= 1; t += 0.1) {
                  const x = Math.pow(1-t, 3) * current.x + 
                           3 * Math.pow(1-t, 2) * t * (current.h2.x) + 
                           3 * (1-t) * Math.pow(t, 2) * (next.h1?.x || next.x) + 
                           Math.pow(t, 3) * next.x;
                  const y = Math.pow(1-t, 3) * current.y + 
                           3 * Math.pow(1-t, 2) * t * (current.h2.y) + 
                           3 * (1-t) * Math.pow(t, 2) * (next.h1?.y || next.y) + 
                           Math.pow(t, 3) * next.y;
                  
                  if (imgFit) {
                    simplifiedPoints.push(x * imgFit.imgScale + imgFit.originX, y * imgFit.imgScale + imgFit.originY);
                  } else {
                    simplifiedPoints.push(x, y);
                  }
                }
              } else {
                // Linear segment
                if (imgFit) {
                  simplifiedPoints.push(current.x * imgFit.imgScale + imgFit.originX, current.y * imgFit.imgScale + imgFit.originY);
                } else {
                  simplifiedPoints.push(current.x, current.y);
                }
              }
            }
            
            return simplifiedPoints;
          } else {
            // Use regular points calculation
            if (isInPointEditing) {
              if (imgFit) {
                return mask.pts.flatMap(pt => [
                  pt.x * imgFit.imgScale + imgFit.originX,
                  pt.y * imgFit.imgScale + imgFit.originY
                ]);
              } else {
                return mask.pts.flatMap(pt => [pt.x, pt.y]);
              }
            } else {
              // Apply transformations for normal mode
              const positionOffset = mask.position || { x: 0, y: 0 };
              const rotation = mask.rotation || 0;
              
              if (rotation !== 0) {
                const maskCenter = {
                  x: mask.pts.reduce((sum, pt) => sum + pt.x, 0) / mask.pts.length,
                  y: mask.pts.reduce((sum, pt) => sum + pt.y, 0) / mask.pts.length
                };
                
                const cos = Math.cos(rotation * Math.PI / 180);
                const sin = Math.sin(rotation * Math.PI / 180);
                
                return mask.pts.flatMap(pt => {
                  const dx = pt.x - maskCenter.x;
                  const dy = pt.y - maskCenter.y;
                  
                  const rotatedPt = {
                    x: maskCenter.x + dx * cos - dy * sin,
                    y: maskCenter.y + dx * sin + dy * cos
                  };
                  
                  if (imgFit) {
                    return [
                      (rotatedPt.x + positionOffset.x) * imgFit.imgScale + imgFit.originX,
                      (rotatedPt.y + positionOffset.y) * imgFit.imgScale + imgFit.originY
                    ];
                  } else {
                    return [rotatedPt.x + positionOffset.x, rotatedPt.y + positionOffset.y];
                  }
                });
              } else {
                if (imgFit) {
                  return mask.pts.flatMap(pt => [
                    (pt.x + positionOffset.x) * imgFit.imgScale + imgFit.originX,
                    (pt.y + positionOffset.y) * imgFit.imgScale + imgFit.originY
                  ]);
                } else {
                  return mask.pts.flatMap(pt => [pt.x + positionOffset.x, pt.y + positionOffset.y]);
                }
              }
            }
          }
        };
        
        points = getLinePoints();
        
        const isSelected = selectedId === maskId;
        const depthEffects = getDepthEffects(mask);

        return (
          <Group
            key={maskId}
            name="mask-shape"
            listening={true}
            isMask={true} // custom attr
            maskId={maskId} // for centralized handler
            opacity={depthEffects.opacity}
          >
            {/* Invisible hit area covering entire mask */}
            <Shape
              name={`mask-${maskId}`}
              sceneFunc={(context, shape) => {
                context.beginPath();
                
                if (hasBezierCurves && !isInPointEditing) {
                  // Use Bezier curves for smooth rendering
                  const transformedPoints = mask.pts.map(pt => {
                    const positionOffset = mask.position || { x: 0, y: 0 };
                    const rotation = mask.rotation || 0;
                    
                    if (rotation !== 0) {
                      const maskCenter = {
                        x: mask.pts.reduce((sum, p) => sum + p.x, 0) / mask.pts.length,
                        y: mask.pts.reduce((sum, p) => sum + p.y, 0) / mask.pts.length
                      };
                      
                      const cos = Math.cos(rotation * Math.PI / 180);
                      const sin = Math.sin(rotation * Math.PI / 180);
                      const dx = pt.x - maskCenter.x;
                      const dy = pt.y - maskCenter.y;
                      
                      const rotatedPt = {
                        x: maskCenter.x + dx * cos - dy * sin,
                        y: maskCenter.y + dx * sin + dy * cos
                      };
                      
                      return {
                        ...pt,
                        x: rotatedPt.x + positionOffset.x,
                        y: rotatedPt.y + positionOffset.y,
                        h1: pt.h1 ? {
                          x: pt.h1.x + positionOffset.x,
                          y: pt.h1.y + positionOffset.y
                        } : undefined,
                        h2: pt.h2 ? {
                          x: pt.h2.x + positionOffset.x,
                          y: pt.h2.y + positionOffset.y
                        } : undefined
                      };
                    }
                    
                    return {
                      ...pt,
                      x: pt.x + positionOffset.x,
                      y: pt.y + positionOffset.y,
                      h1: pt.h1 ? {
                        x: pt.h1.x + positionOffset.x,
                        y: pt.h1.y + positionOffset.y
                      } : undefined,
                      h2: pt.h2 ? {
                        x: pt.h2.x + positionOffset.x,
                        y: pt.h2.y + positionOffset.y
                      } : undefined
                    };
                  });
                  
                  // Draw Bezier path
                  context.moveTo(transformedPoints[0].x, transformedPoints[0].y);
                  
                  for (let i = 1; i < transformedPoints.length; i++) {
                    const current = transformedPoints[i];
                    const prev = transformedPoints[i - 1];
                    
                    if (current.kind === 'smooth' && current.h1 && current.h2) {
                      context.bezierCurveTo(
                        prev.h2?.x || prev.x, prev.h2?.y || prev.y,
                        current.h1.x, current.h1.y,
                        current.x, current.y
                      );
                    } else {
                      context.lineTo(current.x, current.y);
                    }
                  }
                  
                  // Close the path only for area masks
                  const maskType = mask.type || 'area';
                  if (maskType === 'area') {
                    const first = transformedPoints[0];
                    const last = transformedPoints[transformedPoints.length - 1];
                    
                    if (last.kind === 'smooth' && last.h1 && last.h2) {
                      context.bezierCurveTo(
                        last.h2.x, last.h2.y,
                        first.h1?.x || first.x, first.h1?.y || first.y,
                        first.x, first.y
                      );
                    } else {
                      context.lineTo(first.x, first.y);
                    }
                  }
                } else {
                  // Use simple line segments
                  context.moveTo(points[0], points[1]);
                  for (let i = 2; i < points.length; i += 2) {
                    context.lineTo(points[i], points[i + 1]);
                  }
                  
                  // Only close the path for area masks
                  const maskType = mask.type || 'area';
                  if (maskType === 'area') {
                    context.closePath();
                  }
                }
                
                context.fillStrokeShape(shape);
              }}
              fill="rgba(0,0,0,0)" // completely transparent
              stroke="rgba(0,0,0,0)" // completely transparent
              listening={true}
              maskId={maskId} // for centralized handler
            />
            
            {/* Depth visualization overlay - subtle depth indicator */}
            {depthEffects.depthLevel > 0 && (
              <Line
                points={points}
                stroke={depthEffects.tint}
                strokeWidth={0.5}
                closed={mask.type !== 'linear'}
                fillEnabled={false}
                listening={false}
                lineCap="round"
                lineJoin="round"
                perfectDrawEnabled={false}
                opacity={0.3}
              />
            )}
            
            {/* Visible outline - only when selected */}
            <Line
              points={points}
              stroke={isSelected ? '#2563eb' : 'rgba(0,0,0,0)'}
              strokeWidth={isSelected ? 1.5 : 0}
              closed={mask.type !== 'linear'}
              fillEnabled={false}
              listening={false} // let the hit area handle clicks
              lineCap="round"
              lineJoin="round"
              perfectDrawEnabled={false}
            />
            
            {/* Stepped geometry indicator */}
            {depthEffects.isStepped && (
              <Line
                points={points}
                stroke="#ff6b35"
                strokeWidth={0.8}
                closed={mask.type !== 'linear'}
                fillEnabled={false}
                listening={false}
                lineCap="round"
                lineJoin="round"
                perfectDrawEnabled={false}
                opacity={0.6}
                dash={[4, 4]}
              />
            )}
            
            {/* Control buttons - only when selected */}
            {isSelected && (
              <MaskControlButtons
                mask={mask}
                imgFit={imgFit}
              />
            )}
          </Group>
        );
      })}
    </>
  );
}
