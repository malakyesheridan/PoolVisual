import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, XCircle, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ErrorVariant = 'inline' | 'banner' | 'toast';
export type ErrorSeverity = 'error' | 'warning' | 'info';

interface ErrorAlertProps {
  error: string | Error | null;
  variant?: ErrorVariant;
  severity?: ErrorSeverity;
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
  dismissible?: boolean;
  title?: string;
  actions?: React.ReactNode;
  className?: string;
}

const severityConfig: Record<ErrorSeverity, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  error: { icon: XCircle, color: 'text-red-600' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600' },
  info: { icon: AlertCircle, color: 'text-primary' },
};

export function ErrorAlert({
  error,
  variant = 'inline',
  severity = 'error',
  onRetry,
  onDismiss,
  dismissible = false,
  title,
  actions,
  className,
}: ErrorAlertProps) {
  if (!error) return null;

  const errorMessage = error instanceof Error ? error.message : error;
  const config = severityConfig[severity];
  const Icon = config.icon;

  const getErrorMessage = (): string => {
    if (error instanceof Error) {
      // Map common error types to user-friendly messages
      if (error.message.includes('network') || error.message.includes('fetch')) {
        return 'Network error. Please check your connection and try again.';
      }
      if (error.message.includes('timeout')) {
        return 'Request timed out. Please try again.';
      }
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        return 'You are not authorized to perform this action.';
      }
      if (error.message.includes('403') || error.message.includes('forbidden')) {
        return 'You do not have permission to perform this action.';
      }
      if (error.message.includes('404') || error.message.includes('not found')) {
        return 'The requested resource was not found.';
      }
      if (error.message.includes('500') || error.message.includes('server')) {
        return 'Server error. Please try again later.';
      }
      return error.message;
    }
    return errorMessage;
  };

  const displayMessage = getErrorMessage();

  if (variant === 'banner') {
    return (
      <Alert
        variant={severity === 'error' ? 'destructive' : 'default'}
        className={cn('mb-4', className)}
      >
        <Icon className={cn('h-4 w-4', config.color)} />
        <AlertDescription className="flex items-center justify-between">
          <div className="flex-1">
            {title && <div className="font-medium mb-1">{title}</div>}
            <div>{displayMessage}</div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="h-8"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Retry
              </Button>
            )}
            {dismissible && onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            {actions}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (variant === 'inline') {
    return (
      <Alert
        variant={severity === 'error' ? 'destructive' : 'default'}
        className={cn('mt-2', className)}
      >
        <Icon className={cn('h-4 w-4', config.color)} />
        <AlertDescription className="flex items-center justify-between">
          <div className="flex-1">
            {title && <div className="font-medium mb-1">{title}</div>}
            <div>{displayMessage}</div>
          </div>
          {onRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="ml-2 h-7"
            >
              Retry
            </Button>
          )}
          {actions}
        </AlertDescription>
      </Alert>
    );
  }

  // Toast variant (uses existing toast system, but provides component for consistency)
  return null; // Toast variant handled by toast system
}

