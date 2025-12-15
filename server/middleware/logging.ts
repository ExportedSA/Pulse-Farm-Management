import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import pinoHttp from 'pino-http';

// Standard HTTP request logger using pino-http
export const httpLogger = pinoHttp({
  logger,
  // Use a custom serializer for requests
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
    }),
    // Only include error details in response serialization
    res: (res) => ({
      statusCode: res.statusCode,
      // Don't log response body for security/performance
    }),
  },
  // Custom success message
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} completed with ${res.statusCode}`;
  },
  // Custom error message
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} failed with ${res.statusCode} - ${err.message}`;
  },
  // Don't log successful requests in production (optional)
  // customLogLevel: (req, res, err) => {
  //   if (err || res.statusCode >= 500) return 'error';
  //   if (res.statusCode >= 400) return 'warn';
  //   return 'info';
  // },
});

// Middleware to add request context to logs
export function addRequestContext(req: Request, res: Response, next: NextFunction) {
  // Generate a unique request ID
  const requestId = req.headers['x-request-id'] as string || 
                    `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to request object for use in other middleware/routes
  req.requestId = requestId;
  
  // Add request ID to response headers for client-side tracking
  res.setHeader('X-Request-ID', requestId);
  
  // Create a child logger with request context
  req.log = logger.child({
    reqId: requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
  });
  
  // Log the start of the request
  req.log.info('Request started');
  
  // Override res.end to log response completion
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    // Log the completion of the request
    req.log.info({
      statusCode: res.statusCode,
      responseTime: Date.now() - req.startTime,
    }, 'Request completed');
    
    // Call original end
    originalEnd.call(this, chunk, encoding);
  };
  
  // Add start time to request for response time calculation
  req.startTime = Date.now();
  
  next();
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      log?: any;
      startTime?: number;
    }
  }
}

// Error logging middleware
export function logError(err: Error, req: Request, res: Response, next: NextFunction) {
  if (req.log) {
    req.log.error({
      err: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
    }, 'Request error occurred');
  } else {
    logger.error({
      err: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      url: req.url,
      method: req.method,
    }, 'Request error occurred (no request logger)');
  }
  
  next(err);
}
