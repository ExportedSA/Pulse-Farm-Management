import type { Request, Response, NextFunction } from 'express';
import { getFarmId } from './auth';
import { billingEnabled, cachedBillingState } from '../domain/billing';

// Still allowed on a read-only farm: signing in and out, billing (to subscribe again), switching to
// or adding another farm, and visitors signing in and out at the farm gate (a safety record)
const ALLOWED = [
  /^\/auth\//,
  /^\/billing(\/|$)/,
  /^\/farms\/?$/,
  /^\/farms\/[^/]+\/switch$/,
  /^\/visitor\/(signin|signout)\//,
];

/**
 * A farm whose free trial has ended without a paid-up subscription is read-only: everything can
 * still be seen and downloaded, but changes are refused until the owner subscribes. Mounted on
 * /api after the farm is known. Does nothing while billing isn't set up (no Stripe key).
 */
export async function readOnlyWhenLapsed(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' || !billingEnabled()) return next();
  const farmId = getFarmId(req);
  if (!farmId || ALLOWED.some(p => p.test(req.path))) return next();
  try {
    if ((await cachedBillingState(farmId)) !== 'read_only') return next();
  } catch (err) {
    // Billing can't be checked: let the change through rather than stop the farm working
    console.error('[billing] Read-only check failed:', err);
    return next();
  }
  res.status(402).json({
    error: "This farm's free trial or subscription has ended, so it's read-only. Nothing has been deleted. The owner can subscribe under Setup › Billing to keep recording.",
    code: 'farm_read_only',
  });
}
