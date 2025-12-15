import express from 'express';
import path from 'path';

// Create static middleware for serving uploads
const serveUploads = express.static(path.join(process.cwd(), 'uploads'), {
  // Set cache headers for better performance
  maxAge: '1d',
  etag: true,
});

// Middleware to check if we should serve local files
export function uploadsMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Check if S3 is configured
  if (process.env.S3_BUCKET_NAME) {
    // S3 is configured, don't serve local files
    return res.status(404).json({ 
      error: 'Local file serving disabled when using S3',
      message: 'Files are served from S3 when configured'
    });
  }
  
  // S3 not configured, serve from local filesystem
  serveUploads(req, res, next);
}

export default uploadsMiddleware;
