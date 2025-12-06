import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import { registerRoutes } from '../server/routes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

// Register all routes
registerRoutes(app);

// Vercel serverless handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Strip /api prefix since routes are registered without it
  if (req.url?.startsWith('/api')) {
    req.url = req.url.replace('/api', '') || '/';
  }
  
  return new Promise((resolve, reject) => {
    app(req as any, res as any, (err: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(undefined);
      }
    });
  });
}
