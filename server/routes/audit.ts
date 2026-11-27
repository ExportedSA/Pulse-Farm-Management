// The farm's activity log (build guide F3): the owner sees who created, changed, deleted, exported or
// opened what, and when, filtered by person, date, action and kind of record.
import { Router, type Request, type Response } from 'express';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { auditEvents } from '@shared/platform-schema';
import { farms, farmMembers, users } from '@shared/schema';
import { getFarmId, getUserId } from '../middleware/auth';
import { getFarmRole } from '../domain/farms';
import logger from '../config/logger';

export const auditRouter = Router();

async function ownerOnly(req: Request, res: Response): Promise<boolean> {
  const farmId = getFarmId(req);
  const userId = getUserId(req);
  const role = farmId && userId ? await getFarmRole(userId, farmId) : undefined;
  if (role !== 'owner') {
    res.status(403).json({ error: "Only the farm's owner can see the activity log" });
    return false;
  }
  return true;
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const query = z.object({
  userId: z.string().uuid().optional(),
  from: day.optional(),
  to: day.optional(),
  action: z.enum(['create', 'update', 'delete', 'view', 'export']).optional(),
  type: z.string().max(60).optional(),
  before: z.string().datetime({ offset: true }).optional(), // paging: older than this
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

// GET /api/audit - the log, newest first
auditRouter.get('/', async (req, res) => {
  try {
    if (!(await ownerOnly(req, res))) return;
    const q = query.parse(req.query);
    const [farm] = await db.select({ timezone: farms.timezone }).from(farms).where(eq(farms.id, getFarmId(req)!)).limit(1);
    const tz = farm?.timezone || 'Pacific/Auckland';
    const where = [eq(auditEvents.farmId, getFarmId(req)!)];
    if (q.userId) where.push(eq(auditEvents.userId, q.userId));
    if (q.action) where.push(eq(auditEvents.action, q.action));
    if (q.type) where.push(sql`${auditEvents.recordType} LIKE ${q.type.replace(/[%_]/g, '') + '%'}`);
    // Whole days on the farm's clock
    if (q.from) where.push(sql`${auditEvents.createdAt} >= (${q.from}::date)::timestamp AT TIME ZONE ${tz}`);
    if (q.to) where.push(sql`${auditEvents.createdAt} < (${q.to}::date + 1)::timestamp AT TIME ZONE ${tz}`);
    if (q.before) where.push(lt(auditEvents.createdAt, new Date(q.before)));
    const rows = await db
      .select({
        id: auditEvents.id, at: auditEvents.createdAt, userId: auditEvents.userId, person: users.name,
        action: auditEvents.action, recordType: auditEvents.recordType, recordId: auditEvents.recordId,
        method: auditEvents.method, path: auditEvents.path, details: auditEvents.details,
      })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.userId))
      .where(and(...where))
      .orderBy(desc(auditEvents.createdAt))
      .limit(q.limit);
    res.json(rows);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0]?.message ?? 'Invalid filter' });
    logger.error({ err: e }, 'Could not read the audit log');
    res.status(500).json({ error: 'Could not read the activity log' });
  }
});

// GET /api/audit/people - everyone on the farm, past or present, for the person filter
auditRouter.get('/people', async (req, res) => {
  try {
    if (!(await ownerOnly(req, res))) return;
    const rows = await db.select({ id: users.id, name: users.name, role: farmMembers.role, active: farmMembers.isActive })
      .from(farmMembers).innerJoin(users, eq(users.id, farmMembers.userId))
      .where(eq(farmMembers.farmId, getFarmId(req)!))
      .orderBy(users.name);
    res.json(rows);
  } catch (e) {
    logger.error({ err: e }, 'Could not list the farm people');
    res.status(500).json({ error: 'Could not list the people on this farm' });
  }
});
