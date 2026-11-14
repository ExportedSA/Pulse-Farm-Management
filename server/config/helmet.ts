import helmet from 'helmet';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { storageOrigins } from '../services/fileStorage';

// Simplified Helmet configuration for security headers
// Using defaults where possible to avoid duplicate option errors

/** What pages may load, and from where */
export function cspDirectives() {
  const isDev = process.env.NODE_ENV !== 'production';
  // With a storage bucket, /uploads/<file> redirects to a signed link on the bucket's own address.
  // Pictures are already allowed from any https address; audio and scripted downloads need it named.
  const storage = storageOrigins();
  return {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    // Vite's dev server injects an inline React refresh preamble
    scriptSrc: ["'self'", "'unsafe-eval'", "https://apis.google.com", ...(isDev ? ["'unsafe-inline'"] : [])],
    // Plain-http localhost would otherwise be told to upgrade every request to https
    upgradeInsecureRequests: isDev ? null : [],
    fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "ws:", "wss:", "http://localhost:5000", "ws://localhost:5000", ...storage],
    mediaSrc: ["'self'", ...storage],
    objectSrc: ["'none'"],
    childSrc: ["'self'"],
    frameSrc: ["'self'"],
    workerSrc: ["'self'", "blob:"],
    manifestSrc: ["'self'"],
  };
}

const build = (): RequestHandler => helmet({
  contentSecurityPolicy: { directives: cspDirectives() },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: process.env.NODE_ENV === 'production',
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

// Export the configured Helmet middleware. Built on the first request, not when this file loads,
// so it sees the storage settings whatever order the server's files load in.
let middleware: RequestHandler | null = null;
export default function helmetConfig(req: Request, res: Response, next: NextFunction) {
  (middleware ??= build())(req, res, next);
}

// Export a function to get current Helmet settings for debugging
export function getHelmetConfig() {
  return {
    environment: process.env.NODE_ENV || 'development',
    cspEnabled: true,
    hstsEnabled: true,
  };
}
