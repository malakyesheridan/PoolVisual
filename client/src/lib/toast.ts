/**
 * Enhanced toast notifications with error handling integration
 */

import { toast as sonnerToast } from 'sonner';
import { AppError, isAppError, parseError } from './errors';
import { logger } from './logger';

// Toast configuration
const TOAST_CONFIG = {
  duration: 4000,
  position: 'top-right' as const,
  closeButton: true,
  richColors: true
};

/**
 * Enhanced toast with automatic error handling
 */
class ToastManager {
  private config = TOAST_CONFIG;

  /**
   * Success toast
   */
  success(message: string, options?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) {
    return sonnerToast.success(message, {
      ...this.config,
      ...options
    });
  }

  /**
   * Error toast with automatic AppError handling
   */
  error(error: string | Error | AppError, options?: { description?: string; duration?: number }) {
    let message: string;
    let description: string | undefined;
    let code: string | undefined;

    if (typeof error === 'string') {
      message = error;
      description = options?.description;
    } else {
      const appError = isAppError(error) ? error : parseError(error);
      message = appError.message;
      code = appError.code;
      
      // Generate helpful description based on error code
      if (!options?.description) {
        description = this.getErrorDescription(appError);
      } else {
        description = options.description;
      }

      // Log error for tracking
      logger.logError(appError, {
        msg: 'Error displayed in toast',
        meta: { toastError: true }
      });
    }

    return sonnerToast.error(message, {
      ...this.config,
      description: code ? `${description || ''} (${code})`.trim() : description,
      duration: options?.duration ?? 6000 // Longer duration for errors
    });
  }

  /**
   * Warning toast
   */
  warning(message: string, options?: { description?: string; duration?: number }) {
    return sonnerToast.warning(message, {
      ...this.config,
      ...options
    });
  }

  /**
   * Info toast
   */
  info(message: string, options?: { description?: string; duration?: number }) {
    return sonnerToast.info(message, {
      ...this.config,
      ...options
    });
  }

  /**
   * Loading toast (returns promise for easy chaining)
   */
  loading(message: string): string | number {
    return sonnerToast.loading(message, this.config);
  }

  /**
   * Promise toast with automatic error handling
   */
  async promise<T>(
    promise: Promise<T>,
    {
      loading,
      success,
      error: errorMessage
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error?: string | ((error: unknown) => string);
    }
  ): Promise<T> {
    return sonnerToast.promise(promise, {
      loading,
      success,
      error: (error: unknown) => {
        const appError = isAppError(error) ? error : parseError(error);
        
        // Log error
        logger.logError(appError, {
          msg: 'Promise error in toast',
          meta: { promiseToast: true }
        });

        if (typeof errorMessage === 'function') {
          return errorMessage(appError);
        }
        
        return errorMessage || appError.message;
      }
    });
  }

  /**
   * Dismiss toast
   */
  dismiss(toastId?: string | number): void {
    sonnerToast.dismiss(toastId);
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    sonnerToast.dismiss();
  }

  /**
   * Network error toast with retry option
   */
  networkError(onRetry?: () => void) {
    return this.error('Network connection failed', {
      description: onRetry ? 'Check your internet connection' : undefined,
      duration: 8000
    });
  }

  /**
   * Upload progress toast
   */
  uploadProgress(filename: string, progress: number): string | number {
    if (progress === 0) {
      return this.loading(`Uploading ${filename}...`);
    } else if (progress === 100) {
      this.dismissAll();
      return this.success(`${filename} uploaded successfully`);
    } else {
      return this.loading(`Uploading ${filename}... ${progress}%`);
    }
  }

  /**
   * Validation error toast with field details
   */
  validationError(message: string, fields?: string[]) {
    const description = fields && fields.length > 0 
      ? `Issues with: ${fields.join(', ')}`
      : undefined;
      
    return this.error(message, { description });
  }

  /**
   * Permission error toast
   */
  permissionError(action?: string) {
    const message = action 
      ? `You don't have permission to ${action}`
      : 'Access denied';
      
    return this.error(message, {
      description: 'Contact your administrator if you need access'
    });
  }

  /**
   * Session expired toast with redirect option
   */
  sessionExpired(onSignIn?: () => void) {
    return this.error('Your session has expired', {
      description: 'Please sign in again to continue',
      duration: 10000
    });
  }

  /**
   * Get helpful description for error codes
   */
  private getErrorDescription(error: AppError): string | undefined {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return 'Please check your internet connection';
      case 'TIMEOUT_ERROR':
        return 'The request took too long to complete';
      case 'UNAUTHORIZED':
        return 'Please sign in to continue';
      case 'FORBIDDEN':
        return 'Contact your administrator for access';
      case 'NOT_FOUND':
        return 'The requested resource was not found';
      case 'VALIDATION_ERROR':
        return 'Please check your input';
      case 'UPLOAD_ERROR':
        return 'Try uploading a smaller file or different format';
      case 'RATE_LIMITED':
        return 'Please wait a moment before trying again';
      default:
        return undefined;
    }
  }
}

// Export singleton instance
export const toast = new ToastManager();

// Export original sonner toast for advanced usage
export { sonnerToast };

// Export default for convenience
export default toast;