import helmet from 'helmet';

// Simplified Helmet configuration for security headers
// Using defaults where possible to avoid duplicate option errors

const isDev = process.env.NODE_ENV !== 'production';

// Export the configured Helmet middleware
export default helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      // Vite's dev server injects an inline React refresh preamble
      scriptSrc: ["'self'", "'unsafe-eval'", "https://apis.google.com", ...(isDev ? ["'unsafe-inline'"] : [])],
      // Plain-http localhost would otherwise be told to upgrade every request to https
      upgradeInsecureRequests: isDev ? null : [],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:5000", "ws://localhost:5000"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      childSrc: ["'self'"],
      frameSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      manifestSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: process.env.NODE_ENV === 'production',
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

// Export a function to get current Helmet settings for debugging
export function getHelmetConfig() {
  return {
    environment: process.env.NODE_ENV || 'development',
    cspEnabled: true,
    hstsEnabled: true,
  };
}
