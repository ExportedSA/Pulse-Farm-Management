import type { NextFunction, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { getFarmId, getUserId } from './auth';
import { getFarmRole } from '../domain/farms';

// Farm-level access beyond "signed in":
// - Contractors reach only the shared jobs and what they need to do them (the map, the product
//   list, their dockets). Everything else on the farm answers 403.
// - Uploaded files need a signed-in member of the farm they belong to.

const CONTRACTOR_READ = [/^\/farm-map\/?$/, /^\/farm-map\/paddocks\/[^/]+\/areas$/, /^\/applications(\/|$)/, /^\/dockets(\/|$)/,
  /^\/catalogue(\/|$)/, /^\/restrictions(\/|$)/, /^\/farms(\/|$)/, /^\/notifications(\/|$)/, /^\/auth(\/|$)/, /^\/user(s)?\/me$/];
const CONTRACTOR_WRITE = [/^\/applications\/[^/]+(\/|$)/, /^\/auth(\/|$)/, /^\/notifications(\/|$)/, /^\/farms\/[^/]+\/switch$/];

export async function contractorGuard(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  const farmId = getFarmId(req);
  if (!userId || !farmId) return next();
  try {
    if ((await getFarmRole(userId, farmId)) !== 'contractor') return next();
  } catch {
    return next();
  }
  const allowed = (req.method === 'GET' ? CONTRACTOR_READ : CONTRACTOR_WRITE).some(r => r.test(req.path));
  if (allowed) return next();
  return res.status(403).json({ error: 'Contractors see only the jobs shared with them' });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Before serving /uploads/...: signed in, and for a farm's attachments, a member of that farm.
 * A contractor gets only files on dockets of jobs shared with them.
 */
export async function uploadsGuard(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Sign in to see this file' });
  const parts = req.path.split('/').filter(Boolean);
  if (parts[0] !== 'attachments' || !UUID.test(parts[1] ?? '')) return next();
  const farmId = parts[1];
  const role = await getFarmRole(userId, farmId).catch(() => undefined);
  if (!role) return res.status(404).end();
  if (role === 'contractor') {
    const key = decodeURIComponent(parts.join('/'));
    const rows = await db.execute(sql`
      SELECT 1 FROM attachments a
      JOIN application_dockets ad ON a.entity_type = 'docket' AND ad.docket_id = a.entity_id
      JOIN applications ap ON ap.id = ad.application_id
      WHERE a.storage_key = ${key} AND ${userId}::uuid = ANY(ap.shared_with) LIMIT 1`);
    if (!((rows as any).rows ?? rows).length) return res.status(404).end();
  }
  next();
}
