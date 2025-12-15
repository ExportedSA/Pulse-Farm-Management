import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// General API rate limiter - 100 requests per 15 minutes per IP
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests (optional)
  skipSuccessfulRequests: false,
  // Skip failed requests
  skipFailedRequests: false,
  // Custom key generator to handle forwarded IPs
  keyGenerator: (req: Request) => {
    // Use X-Forwarded-For header if available (for reverse proxies)
    return req.headers['x-forwarded-for'] as string || 
           req.headers['x-real-ip'] as string || 
           req.connection.remoteAddress || 
           req.ip;
  },
});

// Strict rate limiter for sensitive routes like auth - 5 requests per minute
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 auth requests per minute
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use X-Forwarded-For header if available
    return req.headers['x-forwarded-for'] as string || 
           req.headers['x-real-ip'] as string || 
           req.connection.remoteAddress || 
           req.ip;
  },
});

// File upload rate limiter - 10 uploads per minute
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 uploads per minute
  message: {
    error: 'Too many file uploads, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.headers['x-forwarded-for'] as string || 
           req.headers['x-real-ip'] as string || 
           req.connection.remoteAddress || 
           req.ip;
  },
});

// Create a rate limiter for WebSocket connections
export const wsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 WebSocket connections per minute
  message: 'Too many WebSocket connections',
  keyGenerator: (req: Request) => {
    return req.headers['x-forwarded-for'] as string || 
           req.headers['x-real-ip'] as string || 
           req.connection.remoteAddress || 
           req.ip;
  },
  // Skip if not a WebSocket upgrade request
  skip: (req: Request) => {
    return !req.headers.upgrade || req.headers.upgrade !== 'websocket';
  },
});

// Development-only rate limiter (very permissive)
export const devLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Very high limit for development
  message: {
    error: 'Development rate limit exceeded',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
