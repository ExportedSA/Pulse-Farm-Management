import { db } from '../db';
import { farms, jobs, jobAssignments, jobDigests } from '@shared/schema';
import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm';
import { listFarmUserIds } from './farms';
import { notifyUsers } from './notifications';
import logger from '../config/logger';

// Job reminders: each morning, "your jobs today" to everyone with work on; and once a job
// goes past its finish date, an overdue alert to the people on it and those running the board.

// Morning message goes out from this local hour
const DIGEST_HOUR = 6;
const OPEN = ['open', 'in_progress', 'blocked'] as const;

/**
 * Today's date and hour on the farm, e.g. { day: "2026-10-30", hour: 6 }
 */
export function farmClock(timezone: string | null, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

// Job dates are stored as midnight UTC of the chosen day
const dayOf = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function runJobReminders(now = new Date()) {
  const result = { digests: 0, overdue: 0 };
  const farmRows = await db.select({ id: farms.id, timezone: farms.timezone }).from(farms).where(eq(farms.isActive, true));

  for (const farm of farmRows) {
    const { day, hour } = farmClock(farm.timezone, now);
    const open = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.farmId, farm.id), notInArray(jobs.status, ['completed', 'cancelled'])));
    if (open.length === 0) continue;
    const assignments = await db
      .select({ jobId: jobAssignments.jobId, userId: jobAssignments.userId })
      .from(jobAssignments)
      .where(inArray(jobAssignments.jobId, open.map(j => j.id)));
    const peopleOn = (jobId: string) => assignments.filter(a => a.jobId === jobId).map(a => a.userId);
    const finish = (j: typeof open[number]) => dayOf(j.endDate) ?? dayOf(j.startDate) ?? day;
    const isOverdue = (j: typeof open[number]) => finish(j) < day;

    // Overdue: once per job
    const newlyOverdue = open.filter(j => isOverdue(j) && !j.overdueNotifiedAt && OPEN.includes(j.status as any));
    if (newlyOverdue.length > 0) {
      const managers = await listFarmUserIds(farm.id, ['owner', 'manager']);
      for (const job of newlyOverdue) {
        await notifyUsers(Array.from(new Set([...peopleOn(job.id), ...managers])), {
          type: 'job_overdue',
          title: 'Job overdue',
          message: `${job.title} was due ${finish(job)}`,
          farmId: farm.id,
          link: `/app/jobs?job=${job.id}`,
          priority: 'high',
          metadata: { jobId: job.id },
        });
        await db.update(jobs).set({ overdueNotifiedAt: now }).where(and(eq(jobs.id, job.id), isNull(jobs.overdueNotifiedAt)));
        result.overdue++;
      }
    }

    // Morning digest: once per person per day, from 6am farm time
    if (hour < DIGEST_HOUR) continue;
    const perPerson = new Map<string, { today: string[]; overdue: number }>();
    for (const job of open) {
      const starts = dayOf(job.startDate) ?? day;
      const onToday = starts <= day && finish(job) >= day;
      if (!onToday && !isOverdue(job)) continue;
      for (const userId of peopleOn(job.id)) {
        const entry = perPerson.get(userId) ?? { today: [], overdue: 0 };
        if (onToday) entry.today.push(job.title);
        else entry.overdue++;
        perPerson.set(userId, entry);
      }
    }
    for (const [userId, work] of Array.from(perPerson)) {
      // Claim today's digest first, so two servers (or a restart) never send it twice
      const claimed = await db
        .insert(jobDigests)
        .values({ userId, farmId: farm.id, day })
        .onConflictDoNothing()
        .returning({ userId: jobDigests.userId });
      if (claimed.length === 0) continue;
      const parts = [
        work.today.length > 0 ? `${work.today.length} today: ${work.today.slice(0, 3).join(', ')}${work.today.length > 3 ? '…' : ''}` : null,
        work.overdue > 0 ? `${work.overdue} overdue` : null,
      ].filter(Boolean);
      await notifyUsers([userId], {
        type: 'job_digest',
        title: 'Your jobs today',
        message: parts.join(' · '),
        farmId: farm.id,
        link: '/app/jobs',
        metadata: { day },
      });
      result.digests++;
    }
  }
  if (result.digests || result.overdue) logger.info(result, 'Job reminders sent');
  return result;
}
