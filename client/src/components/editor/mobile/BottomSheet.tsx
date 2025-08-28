import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Grip, Settings, Package } from 'lucide-react';

interface BottomSheetProps {
  children: React.ReactNode;
  className?: string;
}

type SheetState = 'collapsed' | 'half' | 'full';

const SHEET_HEIGHTS = {
  collapsed: 72,
  half: 0.6, // 60% of viewport
  full: 0.95  // 95% of viewport
};

export function BottomSheet({ children, className }: BottomSheetProps) {
  const [sheetState, setSheetState] = useState<SheetState>('collapsed');
  const constraintsRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const containerHeight = useTransform(y, [0, -300, -600], [SHEET_HEIGHTS.collapsed, window.innerHeight * SHEET_HEIGHTS.half, window.innerHeight * SHEET_HEIGHTS.full]);

  const getHeightForState = (state: SheetState): number => {
    switch (state) {
      case 'collapsed':
        return SHEET_HEIGHTS.collapsed;
      case 'half':
        return window.innerHeight * SHEET_HEIGHTS.half;
      case 'full':
        return window.innerHeight * SHEET_HEIGHTS.full;
      default:
        return SHEET_HEIGHTS.collapsed;
    }
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const velocity = info.velocity.y;
    const currentY = y.get();
    
    // Determine target state based on drag distance and velocity
    if (velocity > 500) {
      // Fast downward swipe - collapse
      setSheetState('collapsed');
    } else if (velocity < -500) {
      // Fast upward swipe - expand to full
      setSheetState('full');
    } else if (currentY > -150) {
      setSheetState('collapsed');
    } else if (currentY > -400) {
      setSheetState('half');
    } else {
      setSheetState('full');
    }
  };

  const animateToState = (state: SheetState) => {
    const targetHeight = getHeightForState(state);
    const targetY = state === 'collapsed' ? 0 : 
                   state === 'half' ? -(window.innerHeight * SHEET_HEIGHTS.half - SHEET_HEIGHTS.collapsed) :
                   -(window.innerHeight * SHEET_HEIGHTS.full - SHEET_HEIGHTS.collapsed);
    
    y.set(targetY);
  };

  useEffect(() => {
    animateToState(sheetState);
  }, [sheetState]);

  const handleGripClick = () => {
    const nextState = sheetState === 'collapsed' ? 'half' : 
                     sheetState === 'half' ? 'full' : 'collapsed';
    setSheetState(nextState);
  };

  return (
    <div className="md:hidden">
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none" />
      
      <motion.div
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-xl border-t border-gray-200 pointer-events-auto safe-bottom z-30",
          className
        )}
        style={{ 
          height: containerHeight,
          y: y
        }}
        drag="y"
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        initial={{ height: SHEET_HEIGHTS.collapsed }}
        data-testid="bottom-sheet"
      >
        {/* Drag handle */}
        <div 
          className="flex items-center justify-center py-3 cursor-grab active:cursor-grabbing"
          onClick={handleGripClick}
          data-testid="bottom-sheet-grip"
        >
          <div className="w-8 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </motion.div>
    </div>
  );
}