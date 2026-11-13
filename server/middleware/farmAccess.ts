import type { NextFunction, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { getFarmId, getUserId } from './auth';
import { getFarmRole } from '../domain/farms';
import { farmOfKey, normaliseKey, uploadUrl } from '../services/fileStorage';

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

/**
 * Before serving /uploads/...: a signed-in member of the farm that owns the file, else 404.
 * - New files carry their farm in the key (`<area>/<farmId>/...`, see services/fileStorage.ts).
 * - Older files without one are served only when a row of the person's current farm links to them.
 * - A contractor gets only files on dockets of jobs shared with them.
 * Leaves the checked key in `res.locals.uploadKey` for the server of the file.
 */
export async function uploadsGuard(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Sign in to see this file' });
  const key = normaliseKey(req.path);
  if (!key) return res.status(404).end();
  try {
    const farmId = farmOfKey(key);
    if (farmId) {
      const role = await getFarmRole(userId, farmId).catch(() => undefined);
      if (!role) return res.status(404).end();
      if (role === 'contractor' && !(key.startsWith('attachments/') && await contractorMaySee(userId, key))) {
        return res.status(404).end();
      }
    } else {
      const current = getFarmId(req);
      if (!current || !(await currentFarmLinksTo(current, key))) return res.status(404).end();
      const role = await getFarmRole(userId, current).catch(() => undefined);
      if (!role || role === 'contractor') return res.status(404).end();
    }
  } catch (err) {
    return next(err);
  }
  res.locals.uploadKey = key;
  next();
}

async function contractorMaySee(userId: string, key: string): Promise<boolean> {
  const rows = await db.execute(sql`
    SELECT 1 FROM attachments a
    JOIN application_dockets ad ON a.entity_type = 'docket' AND ad.docket_id = a.entity_id
    JOIN applications ap ON ap.id = ad.application_id
    WHERE a.storage_key = ${key} AND ${userId}::uuid = ANY(ap.shared_with) LIMIT 1`);
  return ((rows as any).rows ?? rows).length > 0;
}

// Older files (saved before keys carried the farm) and the rows that link to them
async function currentFarmLinksTo(farmId: string, key: string): Promise<boolean> {
  const urls = [`/uploads/${key}`, uploadUrl(key)];
  const checks = [
    sql`SELECT 1 FROM attachments WHERE farm_id = ${farmId} AND (storage_key = ${key} OR url IN (${urls[0]}, ${urls[1]})) LIMIT 1`,
    sql`SELECT 1 FROM jobs WHERE farm_id = ${farmId} AND (photo_urls ? ${urls[0]} OR photo_urls ? ${urls[1]}) LIMIT 1`,
    sql`SELECT 1 FROM photo_attachments WHERE farm_id = ${farmId} AND (photo_url IN (${urls[0]}, ${urls[1]}) OR thumbnail_url IN (${urls[0]}, ${urls[1]})) LIMIT 1`,
    sql`SELECT 1 FROM voice_notes WHERE farm_id = ${farmId} AND audio_url IN (${urls[0]}, ${urls[1]}) LIMIT 1`,
    sql`SELECT 1 FROM chat_messages WHERE farm_id = ${farmId} AND (strpos(attachments::text, ${urls[0]}) > 0 OR strpos(attachments::text, ${urls[1]}) > 0) LIMIT 1`,
  ];
  for (const check of checks) {
    try {
      const rows = await db.execute(check);
      if (((rows as any).rows ?? rows).length) return true;
    } catch {
      // A table this database doesn't have yet links to nothing
    }
  }
  return false;
}
