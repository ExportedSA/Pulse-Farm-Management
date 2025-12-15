import helmet from 'helmet';

// Helmet configuration for security headers
const helmetConfig = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Needed for inline styles in development
        "https://fonts.googleapis.com",
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-eval'", // Needed for Vite dev server
        "https://apis.google.com",
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:",
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        // Allow S3 bucket URLs if configured
        ...(process.env.S3_BUCKET_NAME ? [`https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`] : []),
      ],
      connectSrc: [
        "'self'",
        "ws:",
        "wss:",
        // Allow API endpoints
        ...(process.env.NODE_ENV === 'development' ? ['http://localhost:5000', 'ws://localhost:5000'] : []),
      ],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      childSrc: ["'self'"],
      frameSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
  
  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: { policy: "same-origin" },
  
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { policy: "cross-origin" },
  
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  
  // Frameguard
  frameguard: { action: 'deny' },
  
  // Hide Powered-By header
  hidePoweredBy: true,
  
  // HSTS (HTTP Strict Transport Security)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: process.env.NODE_ENV === 'production',
    preload: process.env.NODE_ENV === 'production',
  },
  
  // IE No Open
  ieNoOpen: true,
  
  // No Sniff
  noSniff: true,
  
  // Origin Agent Cluster
  originAgentCluster: true,
  
  // Permissions Policy
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"],
      magnetometer: ["'none'"],
      gyroscope: ["'none'"],
      accelerometer: ["'none'"],
    },
  },
  
  // Referrer Policy
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  
  // X-Content-Type-Options
  xContentTypeOptions: true,
  
  // X-DNS-Prefetch-Control
  xDnsPrefetchControl: { allow: false },
  
  // X-Download-Options
  xDownloadOptions: true,
  
  // X-Frame-Options
  xFrameOptions: { value: 'DENY' },
  
  // X-Permitted-Cross-Domain-Policies
  xPermittedCrossDomainPolicies: false,
  
  // X-XSS-Protection
  xXssProtection: true,
};

// Export the configured Helmet middleware
export default helmet(helmetConfig);

// Export a function to get current Helmet settings for debugging
export function getHelmetConfig() {
  return {
    environment: process.env.NODE_ENV || 'development',
    cspEnabled: !!helmetConfig.contentSecurityPolicy,
    hstsEnabled: !!helmetConfig.hsts,
    features: Object.keys(helmetConfig).filter(key => helmetConfig[key] !== undefined),
  };
}
