import * as Sentry from '@sentry/node';
import { Integrations } from '@sentry/tracing';
import logger from './logger';

// Initialize Sentry if DSN is provided
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.warn('SENTRY_DSN not found in environment variables. Sentry error tracking disabled.');
    return;
  }
  
  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Enable sampling for errors
      sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Configure integrations
      integrations: [
        // Enable HTTP calls tracing
        new Integrations.Http({ tracing: true }),
        // Enable Express.js middleware to automatically capture requests
        new Integrations.Express({ app: null }),
        // Enable database query tracing
        new Integrations.Postgres({ tracing: true }),
      ],
      
      // Configure beforeSend to filter out certain errors
      beforeSend(event, hint) {
        // Filter out expected errors in development
        if (process.env.NODE_ENV !== 'production') {
          const error = hint.originalException as Error;
          
          // Don't send validation errors to Sentry in development
          if (error.name === 'ValidationError' || error.name === 'ZodError') {
            return null;
          }
          
          // Don't send authentication errors in development
          if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
            return null;
          }
        }
        
        // Add custom context
        event.tags = {
          ...event.tags,
          service: 'pulse-backend',
        };
        
        return event;
      },
      
      // Configure beforeBreadcrumb to filter sensitive data
      beforeBreadcrumb(breadcrumb) {
        // Filter out sensitive query parameters
        if (breadcrumb.data?.query) {
          const { password, token, secret, ...safeQuery } = breadcrumb.data.query;
          breadcrumb.data.query = safeQuery;
        }
        
        // Filter out sensitive headers
        if (breadcrumb.data?.headers) {
          const { authorization, cookie, ...safeHeaders } = breadcrumb.data.headers;
          breadcrumb.data.headers = safeHeaders;
        }
        
        return breadcrumb;
      },
    });
    
    logger.info('Sentry initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Sentry');
  }
}

// Helper to capture exceptions with additional context
export function captureException(error: Error, context?: Record<string, any>) {
  try {
    // Use newer Sentry API - getClient is on the Sentry object directly
    if (Sentry.getClient && Sentry.getClient()) {
      Sentry.withScope((scope) => {
        if (context) {
          scope.setContext('custom', context);
        }
        scope.setTag('service', 'pulse-backend');
        Sentry.captureException(error);
      });
    }
  } catch (e) {
    // Sentry not initialized, just log
  }
  
  // Always log to our logger as well
  logger.error({ error, context }, 'Exception captured');
}

// Helper to capture messages
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  try {
    if (Sentry.getClient && Sentry.getClient()) {
      Sentry.captureMessage(message, level);
    }
  } catch (e) {
    // Sentry not initialized
  }
  
  // Always log to our logger as well
  logger.info(message);
}

// Export Sentry for advanced usage
export { Sentry };
