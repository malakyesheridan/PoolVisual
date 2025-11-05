import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }> | LucideIcon;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ className?: string }> | LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'link' | 'button';
  };
  illustration?: string; // Optional illustration image URL
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  illustration,
  className
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-12 text-center",
      className
    )}>
      {/* Icon or Illustration */}
      {illustration ? (
        <img 
          src={illustration} 
          alt={title}
          className="w-32 h-32 mb-6 opacity-60"
        />
      ) : (
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-slate-400" />
        </div>
      )}

      {/* Title */}
      <h3 className="text-xl font-semibold text-slate-900 mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-slate-600 mb-6 max-w-md">
        {description}
      </p>

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {primaryAction && (
            <Button
              onClick={primaryAction.onClick}
              className="bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              {primaryAction.icon && (
                <primaryAction.icon className="w-5 h-5 mr-2" />
              )}
              {primaryAction.label}
            </Button>
          )}

          {secondaryAction && (
            secondaryAction.variant === 'link' ? (
              <button
                onClick={secondaryAction.onClick}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium underline-offset-4 hover:underline"
              >
                {secondaryAction.label}
              </button>
            ) : (
              <Button
                onClick={secondaryAction.onClick}
                variant="outline"
                size="lg"
              >
                {secondaryAction.label}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}

