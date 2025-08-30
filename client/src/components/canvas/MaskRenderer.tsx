/**
 * Mask Renderer Component
 * Renders different types of editor masks on the Konva canvas
 */

import React from 'react';
import { Group, Line, Circle, Rect, Text } from 'react-konva';
import { EditorMask, Vec2 } from '@shared/schema';

interface MaskRendererProps {
  mask: EditorMask;
  isSelected: boolean;
  onSelect: () => void;
  imageWidth: number;
  imageHeight: number;
}

export function MaskRenderer({ 
  mask, 
  isSelected, 
  onSelect, 
  imageWidth, 
  imageHeight 
}: MaskRendererProps) {
  const getStrokeColor = () => {
    if (isSelected) return '#3b82f6'; // blue-500
    
    switch (mask.type) {
      case 'area': return '#10b981'; // emerald-500
      case 'linear': return '#f59e0b'; // amber-500  
      case 'waterline_band': return '#8b5cf6'; // violet-500
      default: return '#6b7280'; // gray-500
    }
  };

  const getFillColor = () => {
    if (mask.type !== 'area') return 'transparent';
    
    // Don't show tint overlay when material is applied
    const hasMaterial = !!(mask as any).materialId || !!(mask as any).material_id;
    if (hasMaterial) return 'transparent';
    
    const baseColor = getStrokeColor();
    return baseColor + '33'; // Add transparency
  };

  const renderAreaMask = () => {
    if (mask.type !== 'area' || !mask.polygon?.points) return null;

    const points = mask.polygon.points.flatMap(p => [p.x, p.y]);
    
    return (
      <Group>
        <Line
          points={points}
          fill={getFillColor()}
          stroke={getStrokeColor()}
          strokeWidth={isSelected ? 3 : 2}
          closed={true}
          onClick={onSelect}
          onTap={onSelect}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
        
        {/* Render control points for selected mask */}
        {isSelected && mask.polygon.points.map((point, index) => (
          <Circle
            key={index}
            x={point.x}
            y={point.y}
            radius={4}
            fill="#3b82f6"
            stroke="#ffffff"
            strokeWidth={2}
            draggable={false}
          />
        ))}
      </Group>
    );
  };

  const renderLinearMask = () => {
    if (mask.type !== 'linear' || !mask.polyline?.points) return null;

    const points = mask.polyline.points.flatMap(p => [p.x, p.y]);
    
    return (
      <Group>
        <Line
          points={points}
          stroke={getStrokeColor()}
          strokeWidth={isSelected ? 4 : 3}
          lineCap="round"
          lineJoin="round"
          onClick={onSelect}
          onTap={onSelect}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
        
        {/* Render endpoints for selected mask */}
        {isSelected && mask.polyline.points.map((point, index) => (
          <Circle
            key={index}
            x={point.x}
            y={point.y}
            radius={4}
            fill="#f59e0b"
            stroke="#ffffff"
            strokeWidth={2}
            draggable={false}
          />
        ))}
      </Group>
    );
  };

  const renderWaterlineBandMask = () => {
    if (mask.type !== 'waterline_band' || !mask.polyline?.points) return null;

    const points = mask.polyline.points.flatMap(p => [p.x, p.y]);
    const bandHeight = mask.band_height_m || 0.3;
    
    // Calculate band area (simplified visualization)
    const bandPoints: Vec2[] = [];
    const linePoints = mask.polyline.points;
    
    // Create a band by offsetting the line
    for (let i = 0; i < linePoints.length; i++) {
      const point = linePoints[i];
      const nextPoint = linePoints[i + 1];
      
      if (point && nextPoint) {
        // Calculate perpendicular offset
        const dx = nextPoint.x - point.x;
        const dy = nextPoint.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
          const offsetX = (-dy / length) * bandHeight * 50; // Scale for visualization
          const offsetY = (dx / length) * bandHeight * 50;
          
          bandPoints.push({ x: point.x + offsetX, y: point.y + offsetY });
        } else {
          bandPoints.push(point);
        }
      } else if (point) {
        bandPoints.push(point);
      }
    }
    
    // Add the reverse path to close the band
    for (let i = linePoints.length - 1; i >= 0; i--) {
      const point = linePoints[i];
      const prevPoint = linePoints[i - 1];
      
      if (point && prevPoint) {
        const dx = point.x - prevPoint.x;
        const dy = point.y - prevPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
          const offsetX = (-dy / length) * bandHeight * 50;
          const offsetY = (dx / length) * bandHeight * 50;
          
          bandPoints.push({ x: point.x - offsetX, y: point.y - offsetY });
        } else {
          bandPoints.push(point);
        }
      } else if (point) {
        bandPoints.push(point);
      }
    }

    const bandFlatPoints = bandPoints.flatMap(p => [p.x, p.y]);

    return (
      <Group>
        {/* Band area */}
        <Line
          points={bandFlatPoints}
          fill={getFillColor()}
          stroke={getStrokeColor()}
          strokeWidth={isSelected ? 3 : 2}
          closed={true}
          onClick={onSelect}
          onTap={onSelect}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
        
        {/* Center line */}
        <Line
          points={points}
          stroke={getStrokeColor()}
          strokeWidth={2}
          lineCap="round"
          lineJoin="round"
          dash={[5, 5]}
          onClick={onSelect}
          onTap={onSelect}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
        
        {/* Control points for selected mask */}
        {isSelected && mask.polyline.points.map((point, index) => (
          <Circle
            key={index}
            x={point.x}
            y={point.y}
            radius={4}
            fill="#8b5cf6"
            stroke="#ffffff"
            strokeWidth={2}
            draggable={false}
          />
        ))}
      </Group>
    );
  };

  const renderMaskLabel = () => {
    if (!isSelected) return null;
    
    let centerPoint: Vec2 = { x: 0, y: 0 };
    let pointCount = 0;
    
    // Calculate center point based on mask type
    if (mask.type === 'area' && mask.polygon?.points) {
      mask.polygon.points.forEach(p => {
        centerPoint.x += p.x;
        centerPoint.y += p.y;
        pointCount++;
      });
    } else if ((mask.type === 'linear' || mask.type === 'waterline_band') && mask.polyline?.points) {
      mask.polyline.points.forEach(p => {
        centerPoint.x += p.x;
        centerPoint.y += p.y;
        pointCount++;
      });
    }
    
    if (pointCount > 0) {
      centerPoint.x /= pointCount;
      centerPoint.y /= pointCount;
    }

    return (
      <Group>
        <Rect
          x={centerPoint.x - 40}
          y={centerPoint.y - 12}
          width={80}
          height={24}
          fill="#ffffff"
          stroke={getStrokeColor()}
          strokeWidth={1}
          cornerRadius={4}
          shadowEnabled={false}
        />
        <Text
          x={centerPoint.x}
          y={centerPoint.y - 6}
          text={mask.type.toUpperCase()}
          fontSize={10}
          fontFamily="Arial"
          fill={getStrokeColor()}
          align="center"
          offsetX={40}
          perfectDrawEnabled={false}
          shadowEnabled={false}
        />
      </Group>
    );
  };

  return (
    <Group>
      {mask.type === 'area' && renderAreaMask()}
      {mask.type === 'linear' && renderLinearMask()}
      {mask.type === 'waterline_band' && renderWaterlineBandMask()}
      {renderMaskLabel()}
    </Group>
  );
}