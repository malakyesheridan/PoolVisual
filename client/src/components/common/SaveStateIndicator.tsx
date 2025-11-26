import React from 'react';
import { 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  XCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

interface SaveStateIndicatorProps {
  state: SaveState;
  lastSaved?: Date | null;
  onSaveClick?: () => void;
  errorMessage?: string;
  className?: string;
}

/**
 * Component to display save state with visual indicators
 * Shows saved/unsaved/saving/error states with appropriate icons and colors
 */
export function SaveStateIndicator({
  state,
  lastSaved,
  onSaveClick,
  errorMessage,
  className
}: SaveStateIndicatorProps) {
  const getStateConfig = () => {
    switch (state) {
      case 'saved':
        return {
          icon: CheckCircle2,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          label: lastSaved
            ? `Saved ${formatDistanceToNow(lastSaved, { addSuffix: true })}`
            : 'Saved',
        };
      case 'saving':
        return {
          icon: Loader2,
          color: 'text-primary',
          bgColor: 'bg-primary/5',
          borderColor: 'border-primary/20',
          label: 'Saving...',
          spinning: true,
        };
      case 'unsaved':
        return {
          icon: AlertCircle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          label: 'Unsaved changes',
        };
      case 'error':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          label: errorMessage || 'Save failed',
        };
    }
  };

  const config = getStateConfig();
  const Icon = config.icon;

  const tooltipContent = (() => {
    switch (state) {
      case 'unsaved':
        return 'You have unsaved changes. Click Save Changes to persist.';
      case 'saved':
        return lastSaved 
          ? `Last saved: ${format(lastSaved, 'PPpp')}`
          : 'All changes are saved';
      case 'saving':
        return 'Your changes are being saved...';
      case 'error':
        return errorMessage || 'An error occurred while saving. Please try again.';
      default:
        return '';
    }
  })();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border cursor-help transition-colors",
          config.bgColor,
          config.color,
          config.borderColor,
          className
        )}>
          <Icon 
            className={cn(
              "w-4 h-4 flex-shrink-0", 
              config.spinning && "animate-spin"
            )} 
          />
          <span className="whitespace-nowrap">{config.label}</span>
          {state === 'error' && onSaveClick && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onSaveClick();
              }}
              className="ml-2 h-auto py-0.5 px-2 text-xs"
            >
              Retry
            </Button>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs">{tooltipContent}</p>
      </TooltipContent>
    </Tooltip>
  );
}

