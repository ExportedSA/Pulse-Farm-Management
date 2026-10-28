/**
 * Time tracking API for the Timesheets page (mounted at /api/time-tracking behind requireAuth).
 * A thin adapter over the timesheets table and domain/timesheets: one row per shift,
 * with the shift's individual breaks and logged tasks kept on the row.
 */
import { Router } from 'express';
import { z } from 'zod';
import { addDays, differenceInMinutes, format, startOfWeek } from 'date-fns';
import { db } from '../db';
import { timesheets, staffProfiles, users, type Timesheet } from '@shared/schema';
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { getFarmId, getUserId, requireFarm } from '../middleware/auth';
import {
  clockIn,
  clockOut,
  getActiveShift,
  getOrCreateStaffProfileForUser,
  logTimeEntry,
  ActiveShiftError,
  ValidationError,
} from '../domain/timesheets';
import { listFarmUserIds } from '../domain/farms';

const router = Router();
router.use(requireFarm);

type Break = Timesheet['breaks'][number];
type TaskLog = Timesheet['taskLog'][number];

// Shift times are stored as local "HH:MM" next to the shift's date
const toDateTime = (date: string, time: string) => `${date}T${time}:00`;
const today = () => format(new Date(), 'yyyy-MM-dd');

function completedBreakMinutes(breaks: Break[]): number {
  return breaks.reduce((sum, b) => sum + (b.duration ?? 0), 0);
}

function closeOpenBreak(breaks: Break[], at: Date): Break[] {
  return breaks.map(b => b.end ? b : {
    ...b,
    end: at.toISOString(),
    duration: Math.max(0, differenceInMinutes(at, new Date(b.start))),
  });
}

function toStatus(row: Timesheet): 'active' | 'completed' | 'pending_approval' | 'approved' {
  if (!row.endTime) return 'active';
  if (row.status === 'pending') return 'pending_approval';
  if (row.status === 'approved') return 'approved';
  return 'completed';
}

/**
 * Shape a shift row the way the Timesheets page expects it
 */
function toEntry(row: Timesheet, userId: string, userName: string) {
  const breakHours = completedBreakMinutes(row.breaks) / 60;
  let netHours: number;
  if (row.endTime) {
    netHours = Number(row.totalHours ?? 0);
  } else {
    const worked = differenceInMinutes(new Date(), new Date(toDateTime(row.date, row.startTime)));
    netHours = Math.max(0, worked / 60 - breakHours);
  }
  return {
    id: row.id,
    date: row.date,
    userId,
    userName,
    clockIn: toDateTime(row.date, row.startTime),
    clockOut: row.endTime ? toDateTime(row.date, row.endTime) : undefined,
    breaks: row.breaks,
    tasks: row.taskLog.map((t, i) => ({ taskId: `${row.id}-${i}`, ...t })),
    totalHours: Math.round((netHours + breakHours) * 100) / 100,
    breakHours: Math.round(breakHours * 100) / 100,
    netHours: Math.round(netHours * 100) / 100,
    status: toStatus(row),
    approvedBy: row.approvedBy ?? undefined,
    approvedAt: row.approvedAt?.toISOString(),
  };
}

async function currentUser(req: Parameters<typeof getUserId>[0]) {
  const userId = getUserId(req)!;
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  return {
    userId,
    userName: user?.name ?? 'Unknown',
    farmId: getFarmId(req)!,
    staffProfileId: await getOrCreateStaffProfileForUser(userId),
  };
}

function handleError(res: any, error: unknown, message: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: error.errors });
  }
  if (error instanceof ActiveShiftError || error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  console.error(`${message}:`, error);
  res.status(500).json({ error: message });
}

// GET /api/time-tracking/status - The signed-in user's clock state today
router.get('/status', async (req, res) => {
  try {
    const me = await currentUser(req);
    const shift = await getActiveShift(me.staffProfileId, me.farmId);
    const [todayRows, entry] = await Promise.all([
      db.select().from(timesheets).where(and(
        eq(timesheets.staffProfileId, me.staffProfileId),
        eq(timesheets.farmId, me.farmId),
        eq(timesheets.date, today()),
      )),
      Promise.resolve(shift ? toEntry(shift, me.userId, me.userName) : undefined),
    ]);
    const todayEntries = todayRows.map(r => toEntry(r, me.userId, me.userName));

    res.json({
      clockedIn: !!shift,
      onBreak: !!shift?.breaks.some(b => !b.end),
      activeTask: null,
      todayHours: Math.round(todayEntries.reduce((s, e) => s + e.netHours, 0) * 100) / 100,
      clockInTime: entry?.clockIn,
      breakHours: entry?.breakHours ?? 0,
      timesheet: entry,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch clock status');
  }
});

// POST /api/time-tracking/clock-in
router.post('/clock-in', async (req, res) => {
  try {
    const me = await currentUser(req);
    const body = z.object({ location: z.string().optional(), notes: z.string().optional() }).parse(req.body ?? {});
    const shift = await clockIn({ staffProfileId: me.staffProfileId, farmId: me.farmId, ...body });
    res.status(201).json(toEntry(shift, me.userId, me.userName));
  } catch (error) {
    handleError(res, error, 'Failed to clock in');
  }
});

// POST /api/time-tracking/clock-out - Ends any open break, then the shift
router.post('/clock-out', async (req, res) => {
  try {
    const me = await currentUser(req);
    const shift = await getActiveShift(me.staffProfileId, me.farmId);
    if (!shift) {
      return res.status(400).json({ error: 'No active shift found. Please clock in first.' });
    }
    const breaks = closeOpenBreak(shift.breaks, new Date());
    await db.update(timesheets).set({ breaks }).where(eq(timesheets.id, shift.id));
    const ended = await clockOut(me.staffProfileId, me.farmId, completedBreakMinutes(breaks));
    res.json(toEntry(ended, me.userId, me.userName));
  } catch (error) {
    handleError(res, error, 'Failed to clock out');
  }
});

// POST /api/time-tracking/break/start
router.post('/break/start', async (req, res) => {
  try {
    const me = await currentUser(req);
    const shift = await getActiveShift(me.staffProfileId, me.farmId);
    if (!shift) {
      return res.status(400).json({ error: 'Clock in before starting a break' });
    }
    if (shift.breaks.some(b => !b.end)) {
      return res.status(400).json({ error: 'Already on a break' });
    }
    const [updated] = await db
      .update(timesheets)
      .set({ breaks: [...shift.breaks, { start: new Date().toISOString() }], updatedAt: new Date() })
      .where(eq(timesheets.id, shift.id))
      .returning();
    res.json(toEntry(updated, me.userId, me.userName));
  } catch (error) {
    handleError(res, error, 'Failed to start break');
  }
});

// POST /api/time-tracking/break/end
router.post('/break/end', async (req, res) => {
  try {
    const me = await currentUser(req);
    const shift = await getActiveShift(me.staffProfileId, me.farmId);
    if (!shift?.breaks.some(b => !b.end)) {
      return res.status(400).json({ error: 'Not on a break' });
    }
    const breaks = closeOpenBreak(shift.breaks, new Date());
    const [updated] = await db
      .update(timesheets)
      .set({ breaks, breakMinutes: completedBreakMinutes(breaks), updatedAt: new Date() })
      .where(eq(timesheets.id, shift.id))
      .returning();
    res.json(toEntry(updated, me.userId, me.userName));
  } catch (error) {
    handleError(res, error, 'Failed to end break');
  }
});

// POST /api/time-tracking/task/log - Manual entry: adds to that day's shift, or records
// the time as its own entry when there is no shift that day
router.post('/task/log', async (req, res) => {
  try {
    const me = await currentUser(req);
    const time = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');
    const body = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
      taskTitle: z.string().min(1).max(200),
      startTime: time,
      endTime: time,
      category: z.string().max(50).default('general'),
    }).parse(req.body);
    if (body.endTime <= body.startTime) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    const task: TaskLog = {
      taskTitle: body.taskTitle,
      startTime: toDateTime(body.date, body.startTime),
      endTime: toDateTime(body.date, body.endTime),
      duration: differenceInMinutes(new Date(toDateTime(body.date, body.endTime)), new Date(toDateTime(body.date, body.startTime))),
      category: body.category,
    };

    const [shift] = await db
      .select()
      .from(timesheets)
      .where(and(
        eq(timesheets.staffProfileId, me.staffProfileId),
        eq(timesheets.farmId, me.farmId),
        eq(timesheets.date, body.date),
      ))
      .orderBy(desc(timesheets.createdAt))
      .limit(1);

    let row: Timesheet;
    if (shift) {
      [row] = await db
        .update(timesheets)
        .set({ taskLog: [...shift.taskLog, task], updatedAt: new Date() })
        .where(eq(timesheets.id, shift.id))
        .returning();
    } else {
      const entry = await logTimeEntry({
        staffProfileId: me.staffProfileId,
        farmId: me.farmId,
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        taskDescription: body.taskTitle,
        recordedById: me.userId,
      });
      [row] = await db.update(timesheets).set({ taskLog: [task] }).where(eq(timesheets.id, entry.id)).returning();
    }
    res.status(201).json(toEntry(row, me.userId, me.userName));
  } catch (error) {
    handleError(res, error, 'Failed to log time');
  }
});

// GET /api/time-tracking/timesheets - The signed-in user's recent shifts
router.get('/timesheets', async (req, res) => {
  try {
    const me = await currentUser(req);
    const rows = await db
      .select()
      .from(timesheets)
      .where(and(eq(timesheets.staffProfileId, me.staffProfileId), eq(timesheets.farmId, me.farmId)))
      .orderBy(desc(timesheets.date), desc(timesheets.createdAt))
      .limit(60);
    res.json({ timesheets: rows.map(r => toEntry(r, me.userId, me.userName)) });
  } catch (error) {
    handleError(res, error, 'Failed to fetch timesheets');
  }
});

// GET /api/time-tracking/reports/weekly - This week (Mon-Sun) for the signed-in user
router.get('/reports/weekly', async (req, res) => {
  try {
    const me = await currentUser(req);
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    const rows = await db
      .select()
      .from(timesheets)
      .where(and(
        eq(timesheets.staffProfileId, me.staffProfileId),
        eq(timesheets.farmId, me.farmId),
        gte(timesheets.date, format(weekStart, 'yyyy-MM-dd')),
        lte(timesheets.date, format(weekEnd, 'yyyy-MM-dd')),
      ));
    const entries = rows.map(r => toEntry(r, me.userId, me.userName));

    const dailyBreakdown = Array.from({ length: 7 }, (_, i) => {
      const date = format(addDays(weekStart, i), 'yyyy-MM-dd');
      const day = entries.filter(e => e.date === date);
      return {
        date,
        dayName: addDays(weekStart, i).toLocaleDateString('en-NZ', { weekday: 'short' }),
        hours: Math.round(day.reduce((s, e) => s + e.netHours, 0) * 100) / 100,
        status: day[0]?.status ?? 'none',
      };
    });

    const categoryHours: Record<string, number> = {};
    for (const task of entries.flatMap(e => e.tasks)) {
      const cat = task.category || 'general';
      categoryHours[cat] = (categoryHours[cat] || 0) + (task.duration || 0) / 60;
    }

    res.json({
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(weekEnd, 'yyyy-MM-dd'),
      totalHours: Math.round(dailyBreakdown.reduce((s, d) => s + d.hours, 0) * 100) / 100,
      dailyBreakdown,
      categoryBreakdown: Object.entries(categoryHours).map(([category, hours]) => ({
        category,
        hours: Math.round(hours * 100) / 100,
      })),
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch weekly report');
  }
});

// GET /api/time-tracking/reports/staff-overview - Who is working on the farm today
router.get('/reports/staff-overview', async (req, res) => {
  try {
    const farmId = getFarmId(req)!;
    const memberIds = await listFarmUserIds(farmId);
    const members = memberIds.length === 0 ? [] : await db
      .select({ userId: users.id, userName: users.name, staffProfileId: staffProfiles.id })
      .from(users)
      .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
      .where(inArray(users.id, memberIds));

    const profileIds = members.flatMap(m => (m.staffProfileId ? [m.staffProfileId] : []));
    const todayRows = profileIds.length === 0 ? [] : await db
      .select()
      .from(timesheets)
      .where(and(
        eq(timesheets.farmId, farmId),
        inArray(timesheets.staffProfileId, profileIds),
        eq(timesheets.date, today()),
      ));

    const staff = members.map(m => {
      const rows = todayRows.filter(r => r.staffProfileId === m.staffProfileId);
      const entries = rows.map(r => toEntry(r, m.userId, m.userName));
      const open = rows.find(r => !r.endTime);
      return {
        userId: m.userId,
        userName: m.userName,
        clockedIn: !!open,
        clockInTime: open ? toDateTime(open.date, open.startTime) : undefined,
        hoursToday: Math.round(entries.reduce((s, e) => s + e.netHours, 0) * 100) / 100,
        activeTask: undefined,
        onBreak: !!open?.breaks.some(b => !b.end),
      };
    });

    res.json({
      date: today(),
      totalStaff: staff.length,
      totalClockedIn: staff.filter(s => s.clockedIn).length,
      staff,
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch staff overview');
  }
});

export default router;
