// Milk withholding for animal treatments, used by the server, the app and the tests.
//
// The rule, as MINDA and Fonterra apply it: milk from a treated cow can go back in the vat only once
// the withholding period has passed after the LAST dose. While doses are still to be given, the
// clear time isn't known yet. Times are kept to the minute: "120 hours after the last dose" is not
// the same as "5 days after the day of the first dose".

export const FARM_TIME_ZONE = "Pacific/Auckland";
const HOUR_MS = 60 * 60 * 1000;

export interface WithholdingInput {
  dosesGiven?: number | null;
  totalDoses?: number | null;
  // When the last dose was given (ISO with a zone, or a Date)
  lastDoseAt?: string | Date | null;
  // When the treatment was recorded; for a single dose given then, it is the last dose
  dateTime?: string | null;
  milkWithholdingHours?: number | null;
}

/**
 * The offset of the farm's time zone from UTC at a moment, in minutes (NZST +720, NZDT +780)
 */
function zoneOffsetMinutes(at: Date, timeZone = FARM_TIME_ZONE): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at).map(p => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/**
 * A time as the app sends it. "2026-11-15T06:56" (no zone, from a date-and-time box) is farm time;
 * anything with a zone or Z is taken as given. Null if it can't be read.
 */
export function parseFarmTime(value: string | Date | null | undefined, timeZone = FARM_TIME_ZONE): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const s = String(value).trim();
  if (/[zZ]$|[+-]\d\d:?\d\d$/.test(s)) {
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  // The wall-clock time in the farm's zone: shift by the zone's offset (checked twice across a DST change)
  let guess = wall - zoneOffsetMinutes(new Date(wall), timeZone) * 60000;
  guess = wall - zoneOffsetMinutes(new Date(guess), timeZone) * 60000;
  return new Date(guess);
}

/** The farm-time calendar date of a moment, as YYYY-MM-DD */
export function farmDate(at: Date, timeZone = FARM_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Days to hours, for products whose withholding is given in days */
export const daysToHours = (days: number | null | undefined) => (days == null || !Number.isFinite(Number(days)) ? null : Math.round(Number(days) * 24));

/**
 * When the last dose was given, or null if that isn't known yet
 */
export function lastDoseTime(t: WithholdingInput): Date | null {
  const given = t.dosesGiven ?? 0;
  const total = Math.max(1, t.totalDoses ?? 1);
  if (given < total) return null;
  const recorded = parseFarmTime(t.lastDoseAt ?? null);
  if (recorded) return recorded;
  // A single dose given when the treatment was recorded
  if (total === 1 && given >= 1) return parseFarmTime(t.dateTime ?? null);
  return null;
}

/**
 * When the cow's milk can go back in the vat: the last dose plus the withholding period.
 * Null while doses are still to be given, or if the last dose time isn't known.
 */
export function milkClearAt(t: WithholdingInput): Date | null {
  const last = lastDoseTime(t);
  if (!last) return null;
  const hours = Math.max(0, Number(t.milkWithholdingHours ?? 0) || 0);
  return new Date(last.getTime() + hours * HOUR_MS);
}

/**
 * The end of the milk withholding counted from the last dose given so far, for a course stopped early
 * (a cow moved to monitoring). Null if no dose was given, or its time isn't known.
 */
export function clearAfterDosesGiven(t: WithholdingInput): Date | null {
  if ((t.dosesGiven ?? 0) < 1) return null;
  const last = parseFarmTime(t.lastDoseAt ?? null) ?? (Math.max(1, t.totalDoses ?? 1) === 1 ? parseFarmTime(t.dateTime ?? null) : null);
  if (!last) return null;
  const hours = Math.max(0, Number(t.milkWithholdingHours ?? 0) || 0);
  return new Date(last.getTime() + hours * HOUR_MS);
}

/**
 * Why the cow can't go back in the vat at `now`, or null if she can
 */
export function returnToVatProblem(t: WithholdingInput, now: Date = new Date()): string | null {
  const given = t.dosesGiven ?? 0;
  const total = Math.max(1, t.totalDoses ?? 1);
  if (given < total) return `${total - given} of ${total} doses still to give`;
  const clear = milkClearAt(t);
  if (!clear) return "The time of the last dose isn't recorded, so the end of the milk withholding isn't known";
  if (now.getTime() < clear.getTime()) return `Milk withholding ends ${formatFarmTime(clear)}`;
  return null;
}

/** e.g. "Thu 19 Nov, 6:56 am", in farm time */
export function formatFarmTime(at: Date, timeZone = FARM_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-NZ", { timeZone, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(at);
}
