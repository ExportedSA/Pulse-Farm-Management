import cors from 'cors';
import { CorsOptions } from 'cors';

// Get allowed origins from environment
const getAllowedOrigins = (): string[] => {
  const origins = process.env.CORS_ORIGINS?.split(',') || [];
  
  // Always include development origin if not in production
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:5173'); // Vite default
    origins.push('http://localhost:3000'); // Alternative dev port
    origins.push('http://127.0.0.1:5173');
    origins.push('http://127.0.0.1:3000');
  }
  
  // Add production origin if specified
  if (process.env.PRODUCTION_ORIGIN) {
    origins.push(process.env.PRODUCTION_ORIGIN);
  }
  
  // Remove duplicates and filter out empty strings
  return [...new Set(origins.filter(Boolean))];
};

// CORS configuration options
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = getAllowedOrigins();
    
    if (process.env.NODE_ENV === 'development') {
      // In development, allow all origins
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      // Origin is allowed
      callback(null, true);
    } else {
      // Origin not allowed
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  
  // Allow credentials (cookies, authorization headers, etc.)
  credentials: true,
  
  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  
  // Allowed headers
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-File-Type',
    'X-Request-ID',
  ],
  
  // Expose these headers to the client
  exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
  
  // How long the results of a preflight request can be cached
  maxAge: 86400, // 24 hours
  
  // Pass the CORS preflight to the next handler
  preflightContinue: false,
  
  // Set to true to pass the CORS preflight response to the next handler
  optionsSuccessStatus: 204,
};

// Export the configured CORS middleware
export default cors(corsOptions);

// Export a function to get current CORS settings for debugging
export function getCorsConfig() {
  return {
    allowedOrigins: getAllowedOrigins(),
    credentials: corsOptions.credentials,
    methods: corsOptions.methods,
    environment: process.env.NODE_ENV || 'development',
  };
}
