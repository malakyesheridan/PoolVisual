/**
 * Frontend Sentry Integration
 * Error tracking and monitoring for client-side
 */

let Sentry: any = null;
let isInitialized = false;

/**
 * Initialize Sentry for frontend
 */
export async function initSentry() {
  if (isInitialized) return;
  
  try {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) {
      console.log('[Sentry] DSN not configured, skipping initialization');
      return;
    }
    
    Sentry = await import('@sentry/react');
    
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE || 'development',
      release: import.meta.env.VITE_APP_VERSION || '1.0.0',
      tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
      sampleRate: 1.0,
      
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      beforeSend(event) {
        // Filter out development errors
        if (import.meta.env.MODE === 'development') {
          return null;
        }
        return event;
      },
    });
    
    isInitialized = true;
    console.log('[Sentry] Initialized successfully');
  } catch (error) {
    console.warn('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Capture error
 */
export function captureError(error: Error, context?: {
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  user?: { id?: string; email?: string; username?: string };
}) {
  if (!Sentry) return;
  
  try {
    Sentry.withScope((scope: any) => {
      if (context?.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }
      
      if (context?.extra) {
        Object.entries(context.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
      
      if (context?.user) {
        scope.setUser(context.user);
      }
      
      Sentry.captureException(error);
    });
  } catch (err) {
    console.error('[Sentry] Error capturing exception:', err);
  }
}

/**
 * Capture message
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (!Sentry) return;
  
  try {
    Sentry.captureMessage(message, level);
  } catch (err) {
    console.error('[Sentry] Error capturing message:', err);
  }
}

/**
 * Set user context
 */
export function setUser(user: { id?: string; email?: string; username?: string }) {
  if (!Sentry) return;
  
  try {
    Sentry.setUser(user);
  } catch (err) {
    console.error('[Sentry] Error setting user:', err);
  }
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  if (!Sentry) return;
  
  try {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info'
    });
  } catch (err) {
    console.error('[Sentry] Error adding breadcrumb:', err);
  }
}

