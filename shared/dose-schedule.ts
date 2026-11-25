// Dose schedules for animal treatments: how many doses, how many hours apart, and when the next one
// is due. Used by the server (it keeps next_dose_due_at), the app and the tests.
import { parseFarmTime } from "./withholding";

const HOUR_MS = 60 * 60 * 1000;

export interface ScheduleInput {
  dosesGiven?: number | null;
  totalDoses?: number | null;
  doseIntervalHours?: number | null;
  lastDoseAt?: string | Date | null;
  // When the treatment was recorded: the first dose is due then
  dateTime?: string | null;
}

/**
 * When the next dose is due: the time recorded for the first dose, then the last dose plus the
 * interval. Null when every dose is given, or when a later dose has no interval or last dose time.
 */
export function nextDoseDueAt(t: ScheduleInput): Date | null {
  const given = t.dosesGiven ?? 0;
  const total = Math.max(1, t.totalDoses ?? 1);
  if (given >= total) return null;
  if (given === 0) return parseFarmTime(t.dateTime ?? null);
  const last = parseFarmTime(t.lastDoseAt ?? null);
  const interval = Number(t.doseIntervalHours ?? 0);
  if (!last || !(interval > 0)) return null;
  return new Date(last.getTime() + interval * HOUR_MS);
}

/**
 * The doses still to give, with when each is planned: the next as above, the rest one interval apart.
 * Empty when the schedule can't be worked out.
 */
export function plannedDoses(t: ScheduleInput): { dose: number; dueAt: Date }[] {
  const next = nextDoseDueAt(t);
  if (!next) return [];
  const given = t.dosesGiven ?? 0;
  const total = Math.max(1, t.totalDoses ?? 1);
  const interval = Number(t.doseIntervalHours ?? 0);
  const out = [{ dose: given + 1, dueAt: next }];
  if (interval > 0) {
    for (let n = given + 2; n <= total; n++) out.push({ dose: n, dueAt: new Date(next.getTime() + (n - given - 1) * interval * HOUR_MS) });
  }
  return out;
}

export type DoseDue = "due" | "overdue" | "later" | null;

/** Whether the next dose is due now (within `soonHours`), overdue (past `graceHours`), or later */
export function doseDueState(t: ScheduleInput & { nextDoseDueAt?: string | Date | null }, now: Date = new Date(), soonHours = 2, graceHours = 0.5): DoseDue {
  const due = t.nextDoseDueAt ? new Date(t.nextDoseDueAt) : nextDoseDueAt(t);
  if (!due || !Number.isFinite(due.getTime())) return null;
  const diff = (due.getTime() - now.getTime()) / HOUR_MS;
  if (diff < -graceHours) return "overdue";
  if (diff <= soonHours) return "due";
  return "later";
}

/**
 * The hours between doses, read from a treatment plan as written on labels, or null if it doesn't say:
 * "twice daily" 12, "once daily"/"every day" 24, "every 48 hours" 48, "repeat after 72 hours" 72,
 * "every 2 days" 48, "every 12 hours" 12, "at 24 hour intervals" 24.
 */
export function parseDoseInterval(plan: string | null | undefined): number | null {
  if (!plan) return null;
  const p = plan.toLowerCase();
  if (/twice\s+(?:a\s+)?daily|twice\s+a\s+day|two\s+times\s+(?:a\s+)?day/.test(p)) return 12;
  const hours = p.match(/(?:every|repeat(?:ed)?\s+(?:after|in)|at)\s+(\d{1,3})\s*-?\s*(?:hours?|hrs?|h)\b(?:\s+intervals?)?/);
  if (hours) return Number(hours[1]) > 0 ? Number(hours[1]) : null;
  const intervalHours = p.match(/(\d{1,3})\s*-?\s*(?:hours?|hrs?|h)\s+(?:apart|intervals?)/);
  if (intervalHours) return Number(intervalHours[1]) > 0 ? Number(intervalHours[1]) : null;
  const days = p.match(/(?:every|repeat(?:ed)?\s+(?:after|in))\s+(\d{1,2})\s+days?/);
  if (days) return Number(days[1]) > 0 ? Number(days[1]) * 24 : null;
  if (/once\s+(?:a\s+)?daily|once\s+a\s+day|every\s+day|daily\s+for/.test(p)) return 24;
  return null;
}
