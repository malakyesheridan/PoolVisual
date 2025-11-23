/**
 * React Error Boundary with comprehensive error handling and user-friendly UI
 */

import React, { Component, ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { toast } from 'sonner';
import { AlertTriangle, RefreshCw, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AppError, isAppError, parseError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { captureError } from '@/lib/sentry';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
  requestId?: string;
}

/**
 * Error fallback component with user-friendly interface
 */
function ErrorFallback({ error, resetErrorBoundary, requestId }: ErrorFallbackProps) {
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const appError = isAppError(error) ? error : parseError(error);
  const errorId = requestId || appError.requestId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const errorDetails = {
    id: errorId,
    code: appError.code,
    message: appError.message,
    timestamp: appError.timestamp || new Date().toISOString(),
    stack: error.stack,
    meta: appError.meta,
    userAgent: navigator.userAgent,
    url: window.location.href
  };

  const copyErrorDetails = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Error details copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy error details');
    }
  };

  const reloadPage = () => {
    window.location.reload();
  };

  // Get user-friendly error message
  const getUserFriendlyMessage = () => {
    switch (appError.code) {
      case 'NETWORK_ERROR':
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      case 'TIMEOUT_ERROR':
        return 'The request is taking longer than expected. Please try again.';
      case 'UNAUTHORIZED':
        return 'Your session has expired. Please sign in again.';
      case 'FORBIDDEN':
        return 'You don\'t have permission to access this resource.';
      case 'NOT_FOUND':
        return 'The requested resource could not be found.';
      case 'VALIDATION_ERROR':
        return 'Please check your input and try again.';
      default:
        return 'Something went wrong. Our team has been notified and is working on a fix.';
    }
  };

  // Get recovery suggestions
  const getRecoverySuggestions = () => {
    const suggestions = [];
    
    switch (appError.code) {
      case 'NETWORK_ERROR':
        suggestions.push('Check your internet connection');
        suggestions.push('Try refreshing the page');
        break;
      case 'UNAUTHORIZED':
        suggestions.push('Sign in again');
        suggestions.push('Clear your browser cache');
        break;
      case 'NOT_FOUND':
        suggestions.push('Go back to the previous page');
        suggestions.push('Check the URL for typos');
        break;
      default:
        suggestions.push('Try refreshing the page');
        suggestions.push('Wait a few minutes and try again');
        break;
    }
    
    return suggestions;
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Oops! Something went wrong
          </h2>
          <p className="text-muted-foreground">
            {getUserFriendlyMessage()}
          </p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-3">
              <p className="font-medium">What you can try:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {getRecoverySuggestions().map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-3">
          <Button onClick={resetErrorBoundary} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          
          <Button variant="outline" onClick={reloadPage} className="w-full">
            Reload Page
          </Button>
        </div>

        <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span className="text-sm">Error Details</span>
              {isDetailsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-3">
            <div className="text-xs text-muted-foreground space-y-2">
              <div>
                <strong>Error ID:</strong> {errorId}
              </div>
              <div>
                <strong>Code:</strong> {appError.code}
              </div>
              <div>
                <strong>Time:</strong> {new Date(errorDetails.timestamp).toLocaleString()}
              </div>
              {appError.meta && Object.keys(appError.meta).length > 0 && (
                <div>
                  <strong>Details:</strong>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                    {JSON.stringify(appError.meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={copyErrorDetails}
              className="w-full"
              disabled={copied}
            >
              <Copy className="mr-2 h-3 w-3" />
              {copied ? 'Copied!' : 'Copy Error Details'}
            </Button>
          </CollapsibleContent>
        </Collapsible>

        <p className="text-xs text-muted-foreground text-center">
          If the problem persists, please contact support with the error ID: {errorId}
        </p>
      </div>
    </div>
  );
}

/**
 * Error boundary component with logging
 */
interface AppErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export function AppErrorBoundary({ 
  children, 
  fallback: FallbackComponent = ErrorFallback,
  onError 
}: AppErrorBoundaryProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log error
    logger.logError(error, {
      msg: 'React Error Boundary caught error',
      meta: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      }
    });

    // Send to Sentry
    captureError(error, {
      tags: {
        errorBoundary: 'true',
        component: errorInfo.componentStack?.split('\n')[1]?.trim() || 'unknown'
      },
      extra: {
        componentStack: errorInfo.componentStack
      }
    });

    // Call custom error handler if provided
    onError?.(error, errorInfo);

    // Show toast notification
    const appError = isAppError(error) ? error : parseError(error);
    toast.error(appError.message, {
      description: `Error code: ${appError.code}`,
      duration: 5000
    });
  };

  return (
    <ReactErrorBoundary
      FallbackComponent={FallbackComponent}
      onError={handleError}
    >
      {children}
    </ReactErrorBoundary>
  );
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<AppErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <AppErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </AppErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Hook for throwing errors that will be caught by error boundary
 */
export function useErrorHandler() {
  return React.useCallback((error: unknown) => {
    const appError = isAppError(error) ? error : parseError(error);
    
    // Log error
    logger.logError(appError, {
      msg: 'Error thrown via useErrorHandler'
    });

    // Throw error to be caught by error boundary
    throw appError;
  }, []);
}

export default AppErrorBoundary;