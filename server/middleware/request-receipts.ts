// One offline queue for every form (build guide F4; migration 0041).
//
// A save sent with an Idempotency-Key header is done once per farm. The first request with a key
// claims it; when that request has worked, its answer is kept. The same key again, from the same
// person for the same address, gets the kept answer back (with Idempotent-Replayed: true) and saves
// nothing. A save that fails gives the key up, so the phone can try again. While the first is still
// being saved, a repeat is told so (409, code request_in_progress) and tries again later.
import type { Request, Response, NextFunction } from 'express';
import { sql } from 'drizzle-orm';
import { systemDb } from '../db';
import { getUserId } from './auth';
import logger from '../config/logger';

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const KEY = /^[A-Za-z0-9_-]{8,100}$/;
// A claim older than this whose request never finished (the server stopped mid-way) is taken over
const ABANDONED_MS = 2 * 60_000;
// Answers bigger than this aren't kept; a repeat is told it was saved, without the answer
const MAX_BODY = 256 * 1024;

type Receipt = { user_id: string | null; method: string; path: string; state: string; status: number | null; body: any; created_at: string };

const rows = (r: any) => (r?.rows ?? r) as any[];

async function claim(farmId: string, key: string, userId: string | null, method: string, path: string) {
  const r = await systemDb.execute(sql`
    INSERT INTO request_receipts (farm_id, request_key, user_id, method, path)
    VALUES (${farmId}, ${key}, ${userId}, ${method}, ${path})
    ON CONFLICT (farm_id, request_key) DO NOTHING
    RETURNING request_key`);
  return rows(r).length > 0;
}

async function existing(farmId: string, key: string): Promise<Receipt | undefined> {
  const r = await systemDb.execute(sql`
    SELECT user_id, method, path, state, status, body, created_at FROM request_receipts
    WHERE farm_id = ${farmId} AND request_key = ${key}`);
  return rows(r)[0];
}

async function takeOver(farmId: string, key: string, createdAt: string) {
  const r = await systemDb.execute(sql`
    UPDATE request_receipts SET created_at = now()
    WHERE farm_id = ${farmId} AND request_key = ${key} AND state = 'pending' AND created_at = ${createdAt}
    RETURNING request_key`);
  return rows(r).length > 0;
}

/**
 * Makes every POST, PUT, PATCH and DELETE under /api that carries an Idempotency-Key happen once per
 * farm. `farmOf` gives the farm the request runs in (the same check the farm's connection uses).
 */
export function requestReceipts(farmOf: (req: Request) => Promise<string | null>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.get('Idempotency-Key');
    if (!key || !WRITE.has(req.method)) return next();
    if (!KEY.test(key)) return res.status(400).json({ error: 'A request id is 8 to 100 letters, digits, - or _', code: 'bad_request_id' });
    let farmId: string | null;
    try {
      farmId = await farmOf(req);
    } catch (err) {
      return next(err);
    }
    // Not signed in to a farm: the route itself says so
    if (!farmId) return next();
    const userId = getUserId(req) ?? null;
    const path = (req.baseUrl + req.path).slice(0, 300);

    try {
      let mine = await claim(farmId, key, userId, req.method, path);
      if (!mine) {
        const seen = await existing(farmId, key);
        if (!seen) {
          mine = await claim(farmId, key, userId, req.method, path);
        } else if (seen.user_id !== userId || seen.method !== req.method || seen.path !== path) {
          return res.status(422).json({ error: 'That request id was already used for something else', code: 'request_id_reused' });
        } else if (seen.state === 'done') {
          res.locals.idempotentReplay = true;
          res.set('Idempotent-Replayed', 'true');
          return res.status(seen.status ?? 200).json(seen.body ?? { saved: true });
        } else if (Date.now() - new Date(seen.created_at).getTime() > ABANDONED_MS) {
          mine = await takeOver(farmId, key, seen.created_at);
        }
        if (!mine) {
          res.set('Retry-After', '5');
          return res.status(409).json({ error: 'This is still being saved', code: 'request_in_progress' });
        }
      }
    } catch (err) {
      return next(err);
    }

    // Settled once: when the route answers, even if the phone has gone by then (the save happened),
    // or when an answer without a body has gone. A request that never answers keeps its claim until
    // it counts as abandoned.
    let settled = false;
    const settle = (answer: unknown) => {
      if (settled) return;
      settled = true;
      const ok = res.statusCode < 400;
      void (async () => {
        if (ok) {
          let body: unknown = answer ?? null;
          if (body !== null && JSON.stringify(body).length > MAX_BODY) body = null;
          await systemDb.execute(sql`
            UPDATE request_receipts SET state = 'done', status = ${res.statusCode},
              body = ${body === null ? null : JSON.stringify(body)}::jsonb, completed_at = now()
            WHERE farm_id = ${farmId} AND request_key = ${key}`);
          // Now and then, clear out old receipts
          if (Math.random() < 0.01) {
            await systemDb.execute(sql`DELETE FROM request_receipts WHERE created_at < now() - interval '30 days'`);
          }
        } else {
          await systemDb.execute(sql`
            DELETE FROM request_receipts WHERE farm_id = ${farmId} AND request_key = ${key} AND state = 'pending'`);
        }
      })().catch(err => logger.error({ err, path }, 'Could not settle a request receipt'));
    };
    const json = res.json.bind(res);
    res.json = ((body: unknown) => {
      settle(body);
      return json(body);
    }) as Response['json'];
    res.on('finish', () => settle(null));
    next();
  };
}
