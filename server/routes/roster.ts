/**
 * Roster API (mounted at /api/roster behind requireAuth) for the Roster page:
 * farm staff, weekly shifts (roster_entries via domain/roster) and leave requests.
 * Owners and managers schedule shifts and review leave; everyone can see the roster,
 * confirm their own shifts and request leave.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { addDays, format, parseISO, subWeeks } from 'date-fns';
import { db } from '../db';
import { rosterEntries, leaveRequests, staffProfiles, users, type RosterEntry } from '@shared/schema';
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { getFarmId, getUserId, requireFarm } from '../middleware/auth';
import { getFarmRole, listFarmUserIds } from '../domain/farms';
import { getOrCreateStaffProfileForUser } from '../domain/timesheets';
import {
  createRosterEntry,
  confirmRosterEntry,
  updateRosterStatus,
  deleteRosterEntry,
  getRosterEntry,
  copyWeekRoster,
  ValidationError,
  SchedulingConflictError,
  PermissionDeniedError,
  RosterEntryNotFoundError,
} from '../domain/roster';

const router = Router();
router.use(requireFarm);

// IDs are uuids; anything else can't exist (and would be a database error)
router.param('id', (_req, res, next, id) => {
  if (!z.string().uuid().safeParse(id).success) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');

async function canManage(req: Request): Promise<boolean> {
  const role = await getFarmRole(getUserId(req)!, getFarmId(req)!);
  return role === 'owner' || role === 'manager';
}

async function requireManager(req: Request, res: Response): Promise<boolean> {
  if (await canManage(req)) return true;
  res.status(403).json({ error: 'Only farm owners and managers can do this' });
  return false;
}

function handleError(res: Response, error: unknown, message: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: error.errors });
  }
  if (error instanceof ValidationError || error instanceof SchedulingConflictError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof PermissionDeniedError) {
    return res.status(403).json({ error: error.message });
  }
  if (error instanceof RosterEntryNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  console.error(`${message}:`, error);
  res.status(500).json({ error: message });
}

function shiftType(startTime: string): 'morning' | 'afternoon' | 'night' {
  const hour = Number(startTime.slice(0, 2));
  if (hour >= 4 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'night';
}

/**
 * Names of the people behind staff profile IDs
 */
async function staffNames(profileIds: string[]): Promise<Map<string, string>> {
  if (profileIds.length === 0) return new Map();
  const rows = await db
    .select({ id: staffProfiles.id, name: users.name })
    .from(staffProfiles)
    .innerJoin(users, eq(staffProfiles.userId, users.id))
    .where(inArray(staffProfiles.id, profileIds));
  return new Map(rows.map(r => [r.id, r.name]));
}

function toShift(entry: RosterEntry, names: Map<string, string>) {
  return {
    id: entry.id,
    staffId: entry.staffProfileId,
    staffName: names.get(entry.staffProfileId) ?? 'Unknown',
    date: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
    shiftType: shiftType(entry.startTime),
    location: entry.location ?? undefined,
    tasks: entry.role ? [entry.role] : [],
    notes: entry.notes ?? undefined,
    status: entry.status,
    breakMinutes: entry.breakMinutes ?? 0,
    createdBy: entry.createdById,
    confirmedAt: entry.confirmedAt?.toISOString(),
  };
}

// GET /api/roster/staff - Everyone on the farm, with a staff profile each
router.get('/staff', async (req, res) => {
  try {
    const memberIds = await listFarmUserIds(getFarmId(req)!);
    // Make sure every member can be rostered
    await Promise.all(memberIds.map(id => getOrCreateStaffProfileForUser(id)));
    const rows = memberIds.length === 0 ? [] : await db
      .select({ profile: staffProfiles, user: { id: users.id, name: users.name, email: users.email, role: users.role } })
      .from(staffProfiles)
      .innerJoin(users, eq(staffProfiles.userId, users.id))
      .where(inArray(staffProfiles.userId, memberIds))
      .orderBy(asc(users.name));

    res.json(rows.map(({ profile, user }) => ({
      id: profile.id,
      userId: user.id,
      employeeId: profile.employeeId ?? undefined,
      position: profile.position ?? undefined,
      department: profile.department ?? undefined,
      phone: profile.phone ?? undefined,
      employmentType: profile.employmentType ?? undefined,
      isActive: profile.isActive,
      user: { ...user, email: user.email ?? '' },
    })));
  } catch (error) {
    handleError(res, error, 'Failed to fetch staff');
  }
});

// GET /api/roster/shifts?weekStart=YYYY-MM-DD - One week (Mon-Sun) of shifts
router.get('/shifts', async (req, res) => {
  try {
    const weekStart = dateSchema.parse(req.query.weekStart ?? format(new Date(), 'yyyy-MM-dd'));
    const weekEnd = format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd');
    const entries = await db
      .select()
      .from(rosterEntries)
      .where(and(
        eq(rosterEntries.farmId, getFarmId(req)!),
        gte(rosterEntries.date, weekStart),
        lte(rosterEntries.date, weekEnd),
      ))
      .orderBy(asc(rosterEntries.date), asc(rosterEntries.startTime));
    const names = await staffNames(Array.from(new Set(entries.map(e => e.staffProfileId))));
    res.json(entries.map(e => toShift(e, names)));
  } catch (error) {
    handleError(res, error, 'Failed to fetch shifts');
  }
});

// POST /api/roster/shifts - Schedule a shift (owners/managers)
router.post('/shifts', async (req, res) => {
  try {
    if (!(await requireManager(req, res))) return;
    const data = z.object({
      staffId: z.string().uuid('Choose a staff member'),
      date: dateSchema,
      startTime: timeSchema,
      endTime: timeSchema,
      breakMinutes: z.number().int().min(0).optional(),
      location: z.string().max(255).optional(),
      tasks: z.string().max(100).optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const entry = await createRosterEntry({
      farmId: getFarmId(req)!,
      staffProfileId: data.staffId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      breakMinutes: data.breakMinutes,
      location: data.location || undefined,
      role: data.tasks || undefined,
      notes: data.notes || undefined,
      createdById: getUserId(req)!,
    });
    res.status(201).json(toShift(entry, await staffNames([entry.staffProfileId])));
  } catch (error) {
    handleError(res, error, 'Failed to create shift');
  }
});

// POST /api/roster/shifts/copy-week - Copy the previous week's shifts into weekStart
router.post('/shifts/copy-week', async (req, res) => {
  try {
    if (!(await requireManager(req, res))) return;
    const { weekStart } = z.object({ weekStart: dateSchema }).parse(req.body);
    const previous = format(subWeeks(parseISO(weekStart), 1), 'yyyy-MM-dd');
    const copied = await copyWeekRoster(getFarmId(req)!, previous, weekStart, getUserId(req)!);
    res.json({ copied: copied.length });
  } catch (error) {
    handleError(res, error, 'Failed to copy roster');
  }
});

// PUT /api/roster/shifts/:id/confirm - The rostered person confirms their shift
router.put('/shifts/:id/confirm', async (req, res) => {
  try {
    const staffProfileId = await getOrCreateStaffProfileForUser(getUserId(req)!);
    const entry = await confirmRosterEntry(req.params.id, getFarmId(req)!, staffProfileId);
    res.json(toShift(entry, await staffNames([entry.staffProfileId])));
  } catch (error) {
    handleError(res, error, 'Failed to confirm shift');
  }
});

// PUT /api/roster/shifts/:id/cancel (owners/managers)
router.put('/shifts/:id/cancel', async (req, res) => {
  try {
    if (!(await requireManager(req, res))) return;
    const entry = await updateRosterStatus(req.params.id, getFarmId(req)!, 'cancelled');
    res.json(toShift(entry, await staffNames([entry.staffProfileId])));
  } catch (error) {
    handleError(res, error, 'Failed to cancel shift');
  }
});

// DELETE /api/roster/shifts/:id (owners/managers)
router.delete('/shifts/:id', async (req, res) => {
  try {
    if (!(await requireManager(req, res))) return;
    if (!(await getRosterEntry(req.params.id, getFarmId(req)!))) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    await deleteRosterEntry(req.params.id, getFarmId(req)!);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Failed to delete shift');
  }
});

async function toLeaveRequests(rows: (typeof leaveRequests.$inferSelect)[]) {
  const names = await staffNames(Array.from(new Set(rows.map(r => r.staffProfileId))));
  return rows.map(r => ({
    id: r.id,
    staffId: r.staffProfileId,
    staffName: names.get(r.staffProfileId) ?? 'Unknown',
    startDate: r.startDate,
    endDate: r.endDate,
    type: r.type,
    status: r.status,
    reason: r.reason ?? undefined,
    approvedBy: r.reviewedById ?? undefined,
  }));
}

// GET /api/roster/leave - Leave requests (managers see the farm; staff see their own)
router.get('/leave', async (req, res) => {
  try {
    const conditions = [eq(leaveRequests.farmId, getFarmId(req)!)];
    if (!(await canManage(req))) {
      conditions.push(eq(leaveRequests.staffProfileId, await getOrCreateStaffProfileForUser(getUserId(req)!)));
    }
    const rows = await db
      .select()
      .from(leaveRequests)
      .where(and(...conditions))
      .orderBy(desc(leaveRequests.startDate));
    res.json(await toLeaveRequests(rows));
  } catch (error) {
    handleError(res, error, 'Failed to fetch leave requests');
  }
});

// POST /api/roster/leave - Request leave for yourself
router.post('/leave', async (req, res) => {
  try {
    const data = z.object({
      startDate: dateSchema,
      endDate: dateSchema,
      type: z.enum(['annual', 'sick', 'personal', 'unpaid', 'other']),
      reason: z.string().max(500).optional(),
    }).refine(d => d.endDate >= d.startDate, { message: 'End date must be on or after the start date', path: ['endDate'] })
      .parse(req.body);

    const [row] = await db.insert(leaveRequests).values({
      farmId: getFarmId(req)!,
      staffProfileId: await getOrCreateStaffProfileForUser(getUserId(req)!),
      ...data,
      reason: data.reason || null,
    }).returning();
    const [leave] = await toLeaveRequests([row]);
    res.status(201).json(leave);
  } catch (error) {
    handleError(res, error, 'Failed to request leave');
  }
});

async function reviewLeave(req: Request, res: Response, status: 'approved' | 'rejected') {
  try {
    if (!(await requireManager(req, res))) return;
    const [row] = await db
      .update(leaveRequests)
      .set({ status, reviewedById: getUserId(req)!, reviewedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(leaveRequests.id, req.params.id),
        eq(leaveRequests.farmId, getFarmId(req)!),
        eq(leaveRequests.status, 'pending'),
      ))
      .returning();
    if (!row) {
      return res.status(404).json({ error: 'No pending leave request with that ID' });
    }
    const [leave] = await toLeaveRequests([row]);
    res.json(leave);
  } catch (error) {
    handleError(res, error, `Failed to ${status === 'approved' ? 'approve' : 'reject'} leave`);
  }
}

router.put('/leave/:id/approve', (req, res) => reviewLeave(req, res, 'approved'));
router.put('/leave/:id/reject', (req, res) => reviewLeave(req, res, 'rejected'));

export default router;
