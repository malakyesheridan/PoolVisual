import React, { useCallback, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import { useMaskStore } from '../../maskcore/store';
import { Pt } from '../../maskcore/store';

interface Props {
  mask: {
    id: string;
    pts: Pt[];
    position?: Pt;
    rotation?: number;
    isLocked?: boolean;
  };
  imgFit?: { originX: number; originY: number; imgScale: number };
}

export function MaskControlButtons({ mask, imgFit }: Props) {
  const { 
    moveState, 
    rotateState,
    ENTER_MOVE_MODE, 
    EXIT_MOVE_MODE,
    START_MOVE_DRAG,
    ENTER_ROTATE_MODE,
    EXIT_ROTATE_MODE,
    START_ROTATE_DRAG
  } = useMaskStore();

  // Local state for button interactions
  const [isMoveButtonPressed, setIsMoveButtonPressed] = useState(false);
  const [isRotateButtonPressed, setIsRotateButtonPressed] = useState(false);

  // Calculate mask center and bounds
  const getMaskCenterAndBounds = useCallback(() => {
    if (!mask.pts || mask.pts.length === 0) return { center: { x: 0, y: 0 }, bounds: { width: 0, height: 0 } };
    
    // Calculate center of mask points
    const centerX = mask.pts.reduce((sum, pt) => sum + pt.x, 0) / mask.pts.length;
    const centerY = mask.pts.reduce((sum, pt) => sum + pt.y, 0) / mask.pts.length;
    
    // Calculate bounds
    const minX = Math.min(...mask.pts.map(pt => pt.x));
    const maxX = Math.max(...mask.pts.map(pt => pt.x));
    const minY = Math.min(...mask.pts.map(pt => pt.y));
    const maxY = Math.max(...mask.pts.map(pt => pt.y));
    
    const bounds = {
      width: maxX - minX,
      height: maxY - minY
    };
    
    // Apply position offset
    const positionOffset = mask.position || { x: 0, y: 0 };
    const offsetCenterX = centerX + positionOffset.x;
    const offsetCenterY = centerY + positionOffset.y;
    
    // Convert to screen coordinates
    if (imgFit) {
      return {
        center: {
          x: offsetCenterX * imgFit.imgScale + imgFit.originX,
          y: offsetCenterY * imgFit.imgScale + imgFit.originY
        },
        bounds: {
          width: bounds.width * imgFit.imgScale,
          height: bounds.height * imgFit.imgScale
        }
      };
    }
    
    return { 
      center: { x: offsetCenterX, y: offsetCenterY },
      bounds: bounds
    };
  }, [mask.pts, mask.position, imgFit]);

  const { center, bounds } = getMaskCenterAndBounds();
  
  // Button dimensions and positioning
  const buttonSize = 28;
  const buttonSpacing = 12;
  const buttonPadding = Math.max(20, bounds.height * 0.3); // Dynamic padding based on mask size
  const buttonY = center.y + bounds.height / 2 + buttonPadding; // Position below mask bounds
  
  // Move button position
  const moveButtonX = center.x - buttonSize - buttonSpacing / 2;
  
  // Rotate button position  
  const rotateButtonX = center.x + buttonSpacing / 2;

  // Handle move button press
  const handleMoveButtonPress = useCallback((e: any) => {
    e.evt.stopPropagation();
    e.evt.preventDefault();
    
    if (mask.isLocked) return;
    
    console.log('[MoveButton] Pressed');
    setIsMoveButtonPressed(true);
    
    // Enter move mode
    ENTER_MOVE_MODE(mask.id);
    
    // Start move drag immediately
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition || !imgFit) return;
    
    // Use pointer position as drag start to prevent joltiness
    const pointerImagePos = {
      x: (pointerPosition.x - imgFit.originX) / imgFit.imgScale,
      y: (pointerPosition.y - imgFit.originY) / imgFit.imgScale
    };
    
    console.log('[MoveButton] Starting drag from pointer position', {
      pointerPos: pointerPosition,
      pointerImagePos,
      screenCenter: center
    });
    
    START_MOVE_DRAG(mask.id, pointerImagePos);
  }, [mask.id, mask.isLocked, ENTER_MOVE_MODE, START_MOVE_DRAG, imgFit]);

  // Handle move button release
  const handleMoveButtonRelease = useCallback((e: any) => {
    e.evt.stopPropagation();
    e.evt.preventDefault();
    
    console.log('[MoveButton] Released');
    setIsMoveButtonPressed(false);
  }, []);

  // Handle rotate button press
  const handleRotateButtonPress = useCallback((e: any) => {
    e.evt.stopPropagation();
    e.evt.preventDefault();
    
    if (mask.isLocked) return;
    
    console.log('[RotateButton] Pressed');
    setIsRotateButtonPressed(true);
    
    // Enter rotate mode
    ENTER_ROTATE_MODE(mask.id);
    
    // Start rotate drag immediately
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;
    
    // Calculate angle from mask center to pointer for smooth rotation start
    const dx = pointerPosition.x - center.x;
    const dy = pointerPosition.y - center.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    console.log('[RotateButton] Starting rotation', {
      pointerPos: pointerPosition,
      center: center,
      angle: angle
    });
    
    START_ROTATE_DRAG(mask.id, angle);
  }, [mask.id, mask.isLocked, ENTER_ROTATE_MODE, START_ROTATE_DRAG, center]);

  // Handle rotate button release
  const handleRotateButtonRelease = useCallback((e: any) => {
    e.evt.stopPropagation();
    e.evt.preventDefault();
    
    console.log('[RotateButton] Released');
    setIsRotateButtonPressed(false);
  }, []);

  // Check if buttons should be visible and active
  const isMoveMode = moveState.isMoveMode && moveState.moveModeMaskId === mask.id;
  const isRotateMode = rotateState.isRotateMode && rotateState.rotateModeMaskId === mask.id;

  return (
    <Group>
      {/* Move Button */}
      <Group
        x={moveButtonX}
        y={buttonY}
        onMouseDown={handleMoveButtonPress}
        onMouseUp={handleMoveButtonRelease}
        onMouseLeave={handleMoveButtonRelease}
        isControlButton={true}
        buttonType="move"
      >
        {/* Button background */}
        <Rect
          width={buttonSize}
          height={buttonSize}
          fill={
            isMoveButtonPressed ? '#1d4ed8' : 
            isMoveMode ? '#2563eb' : '#ffffff'
          }
          stroke={
            isMoveButtonPressed ? '#1e40af' : 
            isMoveMode ? '#1d4ed8' : '#d1d5db'
          }
          strokeWidth={isMoveButtonPressed ? 2 : 1}
          cornerRadius={6}
          shadowColor="rgba(0,0,0,0.1)"
          shadowBlur={isMoveButtonPressed ? 8 : 4}
          shadowOffset={{ x: 0, y: isMoveButtonPressed ? 2 : 1 }}
        />
        {/* Move icon (↔) */}
        <Text
          text="↔"
          x={buttonSize / 2}
          y={buttonSize / 2}
          offsetX={7}
          offsetY={7}
          fontSize={14}
          fill={
            isMoveButtonPressed ? '#ffffff' : 
            isMoveMode ? '#ffffff' : '#374151'
          }
          align="center"
          verticalAlign="middle"
          fontStyle="bold"
        />
      </Group>

      {/* Rotate Button */}
      <Group
        x={rotateButtonX}
        y={buttonY}
        onMouseDown={handleRotateButtonPress}
        onMouseUp={handleRotateButtonRelease}
        onMouseLeave={handleRotateButtonRelease}
        isControlButton={true}
        buttonType="rotate"
      >
        {/* Button background */}
        <Rect
          width={buttonSize}
          height={buttonSize}
          fill={
            isRotateButtonPressed ? '#1d4ed8' : 
            isRotateMode ? '#2563eb' : '#ffffff'
          }
          stroke={
            isRotateButtonPressed ? '#1e40af' : 
            isRotateMode ? '#1d4ed8' : '#d1d5db'
          }
          strokeWidth={isRotateButtonPressed ? 2 : 1}
          cornerRadius={6}
          shadowColor="rgba(0,0,0,0.1)"
          shadowBlur={isRotateButtonPressed ? 8 : 4}
          shadowOffset={{ x: 0, y: isRotateButtonPressed ? 2 : 1 }}
        />
        {/* Rotate icon (↻) */}
        <Text
          text="↻"
          x={buttonSize / 2}
          y={buttonSize / 2}
          offsetX={7}
          offsetY={7}
          fontSize={14}
          fill={
            isRotateButtonPressed ? '#ffffff' : 
            isRotateMode ? '#ffffff' : '#374151'
          }
          align="center"
          verticalAlign="middle"
          fontStyle="bold"
        />
      </Group>
    </Group>
  );
}
