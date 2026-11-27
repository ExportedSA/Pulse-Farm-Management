// The audit log (build guide F3; migration 0040): every successful change to a farm's data through the
// API is recorded with who made it, what kind of record, which one, and when. Reads worth keeping (a
// farm's full export; shared links once they exist) are recorded with recordAudit().
//
// Only the names of the fields a request sent are kept, never their values, and never names that
// look like secrets, so the log holds no passwords, tokens or personal details.
import type { Request, Response, NextFunction } from 'express';
import { systemDb } from '../db';
import { auditEvents } from '@shared/platform-schema';
import { getFarmId, getUserId } from './auth';
import logger from '../config/logger';

export type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'export';

const ACTION: Record<string, AuditAction> = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

// Not changes to a farm's data: signing in, payment webhooks, sign-in at the gate, switching farm,
// the log itself, and the server-wide demo switch
const SKIP = [
  /^\/auth(\/|$)/, /^\/billing\/webhook$/, /^\/visitor\/(qr|signin|signout)\//, /^\/health/,
  /^\/farms\/[^/]+\/switch$/, /^\/audit(\/|$)/, /^\/hardware\/demo-mode$/,
];

const ID = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;
const SECRET = /pass|token|secret|card|cvc|cvv|iban|bank|account_?number|pin$/i;

/** "/animals/<id>/treatments" -> type "animals/treatments", id: the last id in the path */
export function recordOf(path: string): { type: string; id: string | null } {
  const parts = path.split('/').filter(Boolean);
  const ids = parts.filter(p => ID.test(p));
  const type = parts.filter(p => !ID.test(p)).slice(0, 4).join('/').slice(0, 60) || 'api';
  return { type, id: ids.length ? ids[ids.length - 1].slice(0, 64) : null };
}

function fieldNames(body: unknown): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  return Object.keys(body).filter(k => !SECRET.test(k)).slice(0, 60);
}

async function insert(row: typeof auditEvents.$inferInsert) {
  // As the database owner, with the farm stated: the request's own connection may already be
  // released by the time its response has finished
  await systemDb.insert(auditEvents).values(row);
}

/**
 * Records every successful POST, PUT, PATCH and DELETE under /api for the request's farm.
 * `farmOf` gives the farm the request ran in (the same check the farm's database connection uses).
 */
export function auditTrail(farmOf: (req: Request) => Promise<string | null>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const action = ACTION[req.method];
    if (!action || SKIP.some(p => p.test(req.path))) return next();
    // Noted now: routers change req.path and req.baseUrl as the request passes through them
    const path = (req.baseUrl + req.path).slice(0, 300);
    const { type, id } = recordOf(req.path);

    // A create's new id comes back in the response
    let returnedId: string | null = null;
    const json = res.json.bind(res);
    res.json = ((body: any) => {
      const id = body && typeof body === 'object' && !Array.isArray(body) ? body.id : undefined;
      if (typeof id === 'string' || typeof id === 'number') returnedId = String(id).slice(0, 64);
      return json(body);
    }) as Response['json'];

    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      void (async () => {
        const farmId = await farmOf(req);
        if (!farmId) return;
        // Read at the end: a file upload's fields are only parsed by the route
        const fields = fieldNames(req.body);
        await insert({
          farmId,
          userId: getUserId(req) ?? null,
          action,
          recordType: type,
          recordId: id ?? returnedId,
          method: req.method,
          path,
          status: res.statusCode,
          details: fields.length ? { fields } : {},
        });
      })().catch(err => logger.error({ err, path: req.path }, 'Could not write the audit log'));
    });
    next();
  };
}

/** Records a read worth keeping, such as a full export or a shared link being opened */
export async function recordAudit(req: Request, action: AuditAction, recordType: string, recordId?: string | null,
  details: Record<string, unknown> = {}) {
  const farmId = getFarmId(req);
  if (!farmId) return;
  try {
    await insert({
      farmId,
      userId: getUserId(req) ?? null,
      action,
      recordType: recordType.slice(0, 60),
      recordId: recordId?.slice(0, 64) ?? null,
      method: req.method,
      path: (req.baseUrl + req.path).slice(0, 300),
      status: 200,
      details,
    });
  } catch (err) {
    logger.error({ err, recordType }, 'Could not write the audit log');
  }
}
