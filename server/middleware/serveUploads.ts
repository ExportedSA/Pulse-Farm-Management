import type { NextFunction, Request, Response } from 'express';
import { normaliseKey, sendStoredFile } from '../services/fileStorage';

/**
 * Hands over an uploaded file: from local disk in development, or by redirecting to a short-lived signed
 * link to the private bucket when S3 storage is set up. Mount after `uploadsGuard`, which checks the farm.
 */
export async function uploadsMiddleware(req: Request, res: Response, next: NextFunction) {
  const key: string | null = res.locals.uploadKey ?? normaliseKey(req.path);
  if (!key || (req.method !== 'GET' && req.method !== 'HEAD')) return res.status(404).end();
  try {
    await sendStoredFile(key, res, () => res.status(404).end());
  } catch (err) {
    next(err);
  }
}

export default uploadsMiddleware;
