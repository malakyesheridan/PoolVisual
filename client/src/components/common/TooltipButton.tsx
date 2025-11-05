import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TooltipButtonProps extends ButtonProps {
  tooltip: string;
  tooltipShortcut?: string; // e.g., "Ctrl+Z"
  delayDuration?: number;
}

/**
 * Button component with built-in tooltip support
 * Wraps the Button component with Tooltip for consistent tooltip UX
 */
export function TooltipButton({
  tooltip,
  tooltipShortcut,
  delayDuration = 300,
  children,
  ...buttonProps
}: TooltipButtonProps) {
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>
        <Button {...buttonProps}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex items-center gap-2">
          <span>{tooltip}</span>
          {tooltipShortcut && (
            <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-slate-300 font-mono">
              {tooltipShortcut}
            </kbd>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

