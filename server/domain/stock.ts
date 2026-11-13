import { randomUUID } from 'crypto';
import { db } from '../db';
import {
  animalGroupMembers, animalGroups, animals, farms, pastures, stockCounts, stockSeasonClasses, stockSeasons,
  stockTransactions, type StockSeason,
} from '@shared/schema';
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte } from 'drizzle-orm';
import {
  ARRIVAL_TYPE, ARRIVALS, DEFAULT_BALANCE_DATE, STOCK_MOVEMENT_LABELS, UNCLASSIFIED, classFor, departureType,
  isStockIn, isValidBalanceDate, nextSeason, rollForward, seasonFor, seasonTotals, type Arrival, type ClassTotals,
  type StockMovementType,
} from '@shared/stock';
import { attachmentsFor, saveAttachments, toApiAttachment } from './attachments';
import { createRecord, deleteRecord } from './records';

// Stock reconciliation by season. A season runs to the farm's balance date and opens with a head
// count per class. Movements come from two places: those entered by hand (each backed by its ASD,
// kept as a Document record in Records), and those worked out from the animal register, one for
// each animal's arrival and one for its departure. Stocktakes, NAIT's count, mobs and the register
// are checks against the tally. Closing a season moves each class up a year to open the next one.

export class StockError extends Error {}

export interface MovementInput {
  type: StockMovementType;
  date: string; // yyyy-mm-dd
  asdNumber?: string | null;
  otherParty?: string | null;
  otherPartyNait?: string | null;
  notes?: string | null;
  lines: { stockClass: string; quantity: number }[];
}

export interface AsdInput { asdNumber?: string | null; otherParty?: string | null; otherPartyNait?: string | null }

// Today on the farm's clock
async function farmToday(farmId: string): Promise<string> {
  const [farm] = await db.select({ timezone: farms.timezone }).from(farms).where(eq(farms.id, farmId));
  return new Intl.DateTimeFormat('en-CA', { timeZone: farm?.timezone || 'Pacific/Auckland' }).format(new Date());
}

export async function balanceDateOf(farmId: string): Promise<string> {
  const [farm] = await db.select({ settings: farms.settings }).from(farms).where(eq(farms.id, farmId));
  const value = farm?.settings?.stockBalanceDate;
  return typeof value === 'string' && isValidBalanceDate(value) ? value : DEFAULT_BALANCE_DATE;
}

export async function setBalanceDate(farmId: string, balanceDate: string) {
  if (!isValidBalanceDate(balanceDate)) throw new StockError('Enter the balance date as month and day, e.g. 05-31');
  const [{ seasons }] = await db.select({ seasons: count() }).from(stockSeasons).where(eq(stockSeasons.farmId, farmId));
  if (seasons > 0) throw new StockError("The balance date can't change once a season has started");
  const [farm] = await db.select({ settings: farms.settings }).from(farms).where(eq(farms.id, farmId));
  await db.update(farms)
    .set({ settings: { ...(farm?.settings ?? {}), stockBalanceDate: balanceDate }, updatedAt: new Date() })
    .where(eq(farms.id, farmId));
}

// ----- Movements from the animal register -----

export interface StockIssue { animalId: string; animal: string; problem: string }

const animalLabel = (a: { visualId: string | null; name: string | null; lifetimeId: string | null; id: string }) =>
  a.visualId || a.name || a.lifetimeId || `animal ${a.id.slice(0, 8)}`;

/**
 * Brings the arrival and departure movements of every animal in the register up to date with the
 * animal's record, and lists records that can't be counted properly. Run before reading the tally,
 * so it's right however the animal was changed.
 */
export async function syncAnimalMovements(farmId: string): Promise<StockIssue[]> {
  const balanceDate = await balanceDateOf(farmId);
  const herd = await db.select({
    id: animals.id, visualId: animals.visualId, name: animals.name, lifetimeId: animals.lifetimeId,
    sex: animals.sex, dateOfBirth: animals.dateOfBirth, stockClass: animals.stockClass, arrival: animals.arrival,
    startDate: animals.startDate, status: animals.status, dateRemoved: animals.dateRemoved, removalFate: animals.removalFate,
  }).from(animals).where(and(eq(animals.farmId, farmId), isNull(animals.deletedAt)));

  const issues: StockIssue[] = [];
  const wanted = new Map<string, { animalId: string; source: string; type: StockMovementType; date: string; stockClass: string }>();
  const want = (a: typeof herd[number], source: 'arrival' | 'departure', type: StockMovementType, date: string | null, missing: string) => {
    if (!date) {
      issues.push({ animalId: a.id, animal: animalLabel(a), problem: missing });
      return;
    }
    const stockClass = classFor(a, date, balanceDate);
    if (!stockClass) {
      issues.push({ animalId: a.id, animal: animalLabel(a), problem: 'Its class can’t be worked out: add its sex and date of birth, or set its class' });
    }
    wanted.set(`${a.id}:${source}`, { animalId: a.id, source, type, date, stockClass: stockClass ?? UNCLASSIFIED });
  };
  for (const a of herd) {
    const arrival = a.arrival as Arrival | null;
    if (arrival && arrival in ARRIVALS) {
      want(a, 'arrival', ARRIVAL_TYPE[arrival], arrival === 'born' ? a.dateOfBirth : a.startDate,
        arrival === 'born' ? 'Born here, but has no date of birth' : 'Has no date it arrived');
    }
    if (a.status !== 'active') {
      want(a, 'departure', departureType(a.removalFate, a.status), a.dateRemoved, 'Has left, but has no date it left');
    }
  }

  const existing = await db.select({
    id: stockTransactions.id, animalId: stockTransactions.animalId, source: stockTransactions.source,
    type: stockTransactions.type, date: stockTransactions.date, stockClass: stockTransactions.stockClass,
  }).from(stockTransactions).where(and(
    eq(stockTransactions.farmId, farmId), isNotNull(stockTransactions.animalId), isNull(stockTransactions.deletedAt),
  ));

  const stale: string[] = [];
  for (const row of existing) {
    const key = `${row.animalId}:${row.source}`;
    const w = wanted.get(key);
    if (!w) { stale.push(row.id); continue; }
    wanted.delete(key);
    if (w.type !== row.type || w.date !== row.date || w.stockClass !== row.stockClass) {
      await db.update(stockTransactions)
        .set({ type: w.type, date: w.date, stockClass: w.stockClass, updatedAt: new Date() })
        .where(eq(stockTransactions.id, row.id));
    }
  }
  if (stale.length) {
    await db.update(stockTransactions).set({ deletedAt: new Date() }).where(inArray(stockTransactions.id, stale));
  }
  if (wanted.size) {
    await db.insert(stockTransactions).values(Array.from(wanted.values()).map(w => ({
      farmId, movementId: randomUUID(), animalId: w.animalId, source: w.source,
      type: w.type, date: w.date, quantity: 1, stockClass: w.stockClass,
    })));
  }
  return issues;
}

// ----- Movements entered by hand -----

export async function createMovement(farmId: string, userId: string, input: MovementInput, files: Express.Multer.File[]) {
  const movementId = randomUUID();
  const incoming = isStockIn(input.type);
  const party = input.otherParty || null;
  const recordId = files.length > 0 ? await saveAsdRecord(farmId, userId, movementId, input, files) : null;

  await db.insert(stockTransactions).values(input.lines.map(line => ({
    farmId,
    movementId,
    recordId,
    type: input.type,
    date: input.date,
    quantity: line.quantity,
    stockClass: line.stockClass,
    asdNumber: input.asdNumber || null,
    otherPartyNait: input.otherPartyNait || null,
    fromLocation: incoming ? party : null,
    toLocation: incoming ? null : party,
    seller: input.type === 'purchase' ? party : null,
    buyer: input.type === 'sale' ? party : null,
    description: input.notes || null,
    notes: input.notes || null,
    createdBy: userId,
  })));
  return movementId;
}

// The ASD photo is kept as a Document record in Records, which the movement points at
async function saveAsdRecord(
  farmId: string, userId: string, movementId: string,
  m: { type: StockMovementType; date: string; asdNumber?: string | null; otherParty?: string | null; notes?: string | null; lines: { stockClass: string | null; quantity: number }[] },
  files: Express.Multer.File[],
) {
  const head = m.lines.map(l => `${l.quantity} ${l.stockClass ?? UNCLASSIFIED}`).join(', ');
  const { record } = await createRecord(farmId, userId, {
    type: 'document',
    title: [`ASD${m.asdNumber ? ` ${m.asdNumber}` : ''}`, `${STOCK_MOVEMENT_LABELS[m.type]} ${head}`].join(' – ').slice(0, 255),
    occurredAt: new Date(m.date),
    notes: m.notes || null,
    details: { documentType: 'ASD', reference: m.asdNumber || undefined, issuer: m.otherParty || undefined, movementId },
    tags: ['Compliance'],
  });
  await saveAttachments(farmId, 'record', record.id, files, userId, { takenAt: new Date(m.date) });
  return record.id;
}

const movementLines = (farmId: string, movementId: string) => db.select().from(stockTransactions).where(and(
  eq(stockTransactions.farmId, farmId), eq(stockTransactions.movementId, movementId), isNull(stockTransactions.deletedAt),
));

/** Adds or corrects a movement's ASD details and photo, including movements made from an animal's record */
export async function updateMovementAsd(farmId: string, userId: string, movementId: string, input: AsdInput, files: Express.Multer.File[]) {
  const lines = await movementLines(farmId, movementId);
  if (lines.length === 0) return false;
  const first = lines[0];
  const party = input.otherParty === undefined ? undefined : input.otherParty || null;
  const incoming = isStockIn(first.type);
  let recordId = first.recordId;
  if (files.length > 0) {
    if (recordId) {
      await saveAttachments(farmId, 'record', recordId, files, userId, { takenAt: new Date(first.date) });
    } else {
      recordId = await saveAsdRecord(farmId, userId, movementId, {
        type: first.type as StockMovementType, date: first.date, asdNumber: input.asdNumber ?? first.asdNumber,
        otherParty: party ?? null, notes: first.notes, lines,
      }, files);
    }
  }
  await db.update(stockTransactions).set({
    recordId,
    ...(input.asdNumber !== undefined && { asdNumber: input.asdNumber || null }),
    ...(input.otherPartyNait !== undefined && { otherPartyNait: input.otherPartyNait || null }),
    ...(party !== undefined && {
      fromLocation: incoming ? party : null, toLocation: incoming ? null : party,
      seller: first.type === 'purchase' ? party : null, buyer: first.type === 'sale' ? party : null,
    }),
    updatedAt: new Date(),
  }).where(inArray(stockTransactions.id, lines.map(l => l.id)));
  return true;
}

export async function deleteMovement(farmId: string, movementId: string): Promise<boolean> {
  const lines = await movementLines(farmId, movementId);
  if (lines.length === 0) return false;
  if (lines.some(l => l.animalId)) {
    throw new StockError('This movement comes from an animal’s record: change the animal instead');
  }
  await db.update(stockTransactions).set({ deletedAt: new Date() }).where(inArray(stockTransactions.id, lines.map(l => l.id)));
  // The ASD record goes too; both stay in the audit history
  const recordId = lines.find(l => l.recordId)?.recordId;
  if (recordId) await deleteRecord(farmId, recordId);
  return true;
}

// ----- Checks: stocktakes and NAIT -----

export const NAIT_CLASS = 'All cattle at the NAIT location';

export async function recordCount(
  farmId: string, userId: string,
  input: { kind: 'stocktake' | 'nait'; stockClass?: string | null; count: number; countedAt: string; notes?: string | null },
) {
  const stockClass = input.kind === 'nait' ? NAIT_CLASS : input.stockClass;
  if (!stockClass) throw new StockError('Choose the class that was counted');
  const [row] = await db.insert(stockCounts).values({
    farmId, createdBy: userId, kind: input.kind, stockClass, count: input.count, countedAt: input.countedAt, notes: input.notes || null,
  }).returning();
  return row;
}

/** Makes the tally agree with a stocktake: an adjustment on the day of the count */
export async function adjustToCount(farmId: string, userId: string, countId: string) {
  const [c] = await db.select().from(stockCounts).where(and(eq(stockCounts.farmId, farmId), eq(stockCounts.id, countId)));
  if (!c || c.kind !== 'stocktake') return null;
  const season = await seasonContaining(farmId, c.countedAt);
  if (!season) throw new StockError('This count is outside every season');
  if (season.closedAt) throw new StockError('That season is closed: reopen it first');
  const tally = (await totalsFor(farmId, season, c.countedAt)).find(t => t.stockClass === c.stockClass)?.closing ?? 0;
  const difference = c.count - tally;
  if (difference === 0) return { difference };
  await createMovement(farmId, userId, {
    type: 'adjustment', date: c.countedAt, notes: `To match the stocktake of ${c.count} on ${c.countedAt}`,
    lines: [{ stockClass: c.stockClass, quantity: difference }],
  }, []);
  return { difference };
}

// ----- Seasons -----

async function seasonContaining(farmId: string, day: string) {
  const [season] = await db.select().from(stockSeasons).where(and(
    eq(stockSeasons.farmId, farmId), lte(stockSeasons.startsOn, day), gte(stockSeasons.endsOn, day),
  ));
  return season ?? null;
}

async function openingOf(seasonId: string): Promise<Record<string, number>> {
  const rows = await db.select().from(stockSeasonClasses).where(eq(stockSeasonClasses.seasonId, seasonId));
  return Object.fromEntries(rows.map(r => [r.stockClass, r.opening]));
}

async function seasonLines(farmId: string, season: Pick<StockSeason, 'startsOn' | 'endsOn'>) {
  return db.select().from(stockTransactions).where(and(
    eq(stockTransactions.farmId, farmId), isNull(stockTransactions.deletedAt),
    gte(stockTransactions.date, season.startsOn), lte(stockTransactions.date, season.endsOn),
  )).orderBy(desc(stockTransactions.date), desc(stockTransactions.createdAt));
}

async function totalsFor(farmId: string, season: StockSeason, through?: string): Promise<ClassTotals[]> {
  const [opening, lines] = await Promise.all([openingOf(season.id), seasonLines(farmId, season)]);
  return seasonTotals(opening, lines, through);
}

function cleanOpening(opening: Record<string, number>) {
  const out: Record<string, number> = {};
  for (const [stockClass, head] of Object.entries(opening)) {
    const name = stockClass.trim();
    if (!name) continue;
    if (!Number.isInteger(head) || head < 0) throw new StockError(`Opening numbers must be whole numbers of head (${name})`);
    if (head > 0) out[name] = (out[name] ?? 0) + head;
  }
  return out;
}

async function saveOpening(farmId: string, seasonId: string, opening: Record<string, number>) {
  await db.delete(stockSeasonClasses).where(eq(stockSeasonClasses.seasonId, seasonId));
  const rows = Object.entries(opening).map(([stockClass, head]) => ({ farmId, seasonId, stockClass, opening: head }));
  if (rows.length) await db.insert(stockSeasonClasses).values(rows);
}

/** The farm's first season, with the head counted in each class on its first day */
export async function startSeason(farmId: string, userId: string, input: { startsOn: string; opening: Record<string, number> }) {
  const [{ seasons }] = await db.select({ seasons: count() }).from(stockSeasons).where(eq(stockSeasons.farmId, farmId));
  if (seasons > 0) throw new StockError('Seasons have already started: the next one opens when this one closes');
  const balanceDate = await balanceDateOf(farmId);
  const season = seasonFor(input.startsOn, balanceDate);
  if (season.startsOn !== input.startsOn) throw new StockError(`A season starts the day after the balance date (${season.startsOn})`);
  if (input.startsOn > await farmToday(farmId)) throw new StockError("The season can't start in the future");
  const [row] = await db.insert(stockSeasons).values({ farmId, ...season, createdBy: userId }).returning();
  await saveOpening(farmId, row.id, cleanOpening(input.opening));
  return row;
}

/** Corrects the opening numbers. Only the first season's: later ones come from the season before. */
export async function setOpening(farmId: string, seasonId: string, opening: Record<string, number>) {
  const season = await getSeason(farmId, seasonId);
  if (!season) return null;
  if (season.closedAt) throw new StockError('This season is closed: reopen it first');
  const [earlier] = await db.select({ id: stockSeasons.id }).from(stockSeasons)
    .where(and(eq(stockSeasons.farmId, farmId), lt(stockSeasons.startsOn, season.startsOn))).limit(1);
  if (earlier) throw new StockError('This season opens with last season’s closing numbers: reopen last season to change them');
  await saveOpening(farmId, season.id, cleanOpening(opening));
  return season;
}

async function getSeason(farmId: string, seasonId: string) {
  const [season] = await db.select().from(stockSeasons).where(and(eq(stockSeasons.farmId, farmId), eq(stockSeasons.id, seasonId)));
  return season ?? null;
}

/** Closes a season on its closing numbers, and opens the next one with each class moved up */
export async function closeSeason(farmId: string, userId: string, seasonId: string) {
  await syncAnimalMovements(farmId);
  const season = await getSeason(farmId, seasonId);
  if (!season) return null;
  if (season.closedAt) throw new StockError('This season is already closed');
  if (season.endsOn >= await farmToday(farmId)) throw new StockError(`This season runs until ${season.endsOn}: close it after that`);
  const [earlierOpen] = await db.select({ id: stockSeasons.id }).from(stockSeasons).where(and(
    eq(stockSeasons.farmId, farmId), lt(stockSeasons.startsOn, season.startsOn), isNull(stockSeasons.closedAt),
  )).limit(1);
  if (earlierOpen) throw new StockError('Close the earlier season first');

  const totals = await totalsFor(farmId, season);
  const negative = totals.filter(t => t.closing < 0);
  if (negative.length) {
    throw new StockError(`More stock left than was on hand: ${negative.map(t => `${t.stockClass} (${t.closing})`).join(', ')}. Check the opening numbers and movements.`);
  }
  for (const t of totals) {
    const updated = await db.update(stockSeasonClasses).set({ closing: t.closing })
      .where(and(eq(stockSeasonClasses.seasonId, season.id), eq(stockSeasonClasses.stockClass, t.stockClass))).returning();
    if (updated.length === 0) {
      await db.insert(stockSeasonClasses).values({ farmId, seasonId: season.id, stockClass: t.stockClass, opening: 0, closing: t.closing });
    }
  }
  await db.update(stockSeasons).set({ closedAt: new Date(), closedBy: userId, updatedAt: new Date() }).where(eq(stockSeasons.id, season.id));

  const next = nextSeason(season.endsOn, await balanceDateOf(farmId));
  const [existingNext] = await db.select().from(stockSeasons).where(and(eq(stockSeasons.farmId, farmId), eq(stockSeasons.startsOn, next.startsOn)));
  const nextRow = existingNext ?? (await db.insert(stockSeasons).values({ farmId, ...next, createdBy: userId }).returning())[0];
  await saveOpening(farmId, nextRow.id, rollForward(Object.fromEntries(totals.map(t => [t.stockClass, t.closing]))));
  return { closed: season.id, next: nextRow.id };
}

/** Reopens the most recently closed season, so it can be corrected; the season after it is removed */
export async function reopenSeason(farmId: string, seasonId: string) {
  const season = await getSeason(farmId, seasonId);
  if (!season) return null;
  if (!season.closedAt) throw new StockError('This season isn’t closed');
  const [laterClosed] = await db.select({ id: stockSeasons.id }).from(stockSeasons).where(and(
    eq(stockSeasons.farmId, farmId), gt(stockSeasons.startsOn, season.startsOn), isNotNull(stockSeasons.closedAt),
  )).limit(1);
  if (laterClosed) throw new StockError('A later season is closed: reopen that one first');
  await db.delete(stockSeasons).where(and(eq(stockSeasons.farmId, farmId), gt(stockSeasons.startsOn, season.startsOn)));
  await db.update(stockSeasonClasses).set({ closing: null }).where(eq(stockSeasonClasses.seasonId, season.id));
  // Classes that only existed to hold a closing number
  await db.delete(stockSeasonClasses).where(and(eq(stockSeasonClasses.seasonId, season.id), eq(stockSeasonClasses.opening, 0)));
  await db.update(stockSeasons).set({ closedAt: null, closedBy: null, updatedAt: new Date() }).where(eq(stockSeasons.id, season.id));
  return season;
}

// ----- What the page shows -----

/** Animals in the register on a day, by class: arrived by then (or always here) and not yet left */
async function registerOn(farmId: string, day: string, balanceDate: string) {
  const herd = await db.select({
    sex: animals.sex, dateOfBirth: animals.dateOfBirth, stockClass: animals.stockClass, arrival: animals.arrival,
    startDate: animals.startDate, status: animals.status, dateRemoved: animals.dateRemoved,
  }).from(animals).where(and(eq(animals.farmId, farmId), isNull(animals.deletedAt)));
  const byClass: Record<string, number> = {};
  for (const a of herd) {
    const arrived = a.arrival === 'born' ? a.dateOfBirth : a.arrival ? a.startDate : null;
    if (a.arrival && (!arrived || arrived > day)) continue;
    if (a.dateOfBirth && a.dateOfBirth > day) continue;
    if (a.status !== 'active' && (!a.dateRemoved || a.dateRemoved <= day)) continue;
    const c = classFor(a, day, balanceDate) ?? UNCLASSIFIED;
    byClass[c] = (byClass[c] ?? 0) + 1;
  }
  return byClass;
}

async function mobsByClass(farmId: string) {
  const mobs = await db.select({
    id: animalGroups.id, name: animalGroups.name, stockClass: animalGroups.stockClass, headCount: animalGroups.headCount,
    pasture: pastures.name, currentPastureId: animalGroups.currentPastureId,
  }).from(animalGroups)
    .leftJoin(pastures, eq(pastures.id, animalGroups.currentPastureId))
    .where(and(eq(animalGroups.farmId, farmId), eq(animalGroups.isMob, true), isNull(animalGroups.deletedAt)))
    .orderBy(asc(animalGroups.name));
  const ids = mobs.map(m => m.id);
  const members = ids.length ? await db.select({ groupId: animalGroupMembers.groupId, head: count() })
    .from(animalGroupMembers)
    .innerJoin(animals, eq(animals.id, animalGroupMembers.animalId))
    .where(and(inArray(animalGroupMembers.groupId, ids), eq(animals.status, 'active'), isNull(animals.deletedAt)))
    .groupBy(animalGroupMembers.groupId) : [];
  const tagged = new Map(members.map(m => [m.groupId, m.head]));
  return mobs.map(m => ({ ...m, tagged: tagged.get(m.id) ?? 0, head: m.headCount ?? tagged.get(m.id) ?? 0 }));
}

function groupMovements(lines: Awaited<ReturnType<typeof seasonLines>>) {
  const movements = new Map<string, any>();
  for (const line of lines) {
    const key = line.movementId ?? line.id;
    if (!movements.has(key)) {
      movements.set(key, {
        id: key,
        recordId: line.recordId,
        animalId: line.animalId,
        type: line.type,
        date: line.date,
        asdNumber: line.asdNumber,
        otherParty: line.fromLocation ?? line.toLocation ?? line.seller ?? line.buyer ?? null,
        otherPartyNait: line.otherPartyNait,
        notes: line.notes,
        lines: [] as { stockClass: string | null; quantity: number }[],
        attachments: [] as ReturnType<typeof toApiAttachment>[],
      });
    }
    movements.get(key).lines.push({ stockClass: line.stockClass, quantity: line.quantity });
  }
  return Array.from(movements.values());
}

export async function stockView(farmId: string, seasonId?: string) {
  const issues = await syncAnimalMovements(farmId);
  const [balanceDate, today] = await Promise.all([balanceDateOf(farmId), farmToday(farmId)]);
  const seasons = await db.select().from(stockSeasons).where(eq(stockSeasons.farmId, farmId)).orderBy(desc(stockSeasons.startsOn));

  if (seasons.length === 0) {
    // Before the first season: suggest this season, opening with what the register shows on its first day
    const suggested = seasonFor(today, balanceDate);
    const previous = seasonFor(`${Number(suggested.startsOn.slice(0, 4)) - 1}${suggested.startsOn.slice(4)}`, balanceDate);
    return {
      balanceDate, today, seasons: [], season: null, issues,
      start: {
        choices: [suggested, previous],
        registerOpening: {
          [suggested.startsOn]: await registerOn(farmId, suggested.startsOn, balanceDate),
          [previous.startsOn]: await registerOn(farmId, previous.startsOn, balanceDate),
        },
      },
    };
  }

  const season = (seasonId && seasons.find(s => s.id === seasonId))
    || seasons.find(s => s.startsOn <= today && today <= s.endsOn)
    || seasons[0];
  const [opening, lines, saved] = await Promise.all([
    openingOf(season.id), seasonLines(farmId, season),
    db.select().from(stockSeasonClasses).where(eq(stockSeasonClasses.seasonId, season.id)),
  ]);
  const asAt = season.endsOn < today ? season.endsOn : today;
  const totals = seasonTotals(opening, lines);

  // A closed season whose movements have changed since
  const changedSinceClose = season.closedAt
    ? totals.filter(t => (saved.find(s => s.stockClass === t.stockClass)?.closing ?? 0) !== t.closing).map(t => t.stockClass)
    : [];

  // Checks against the tally
  const register = await registerOn(farmId, asAt, balanceDate);
  const mobs = await mobsByClass(farmId);
  const counts = await db.select().from(stockCounts).where(and(
    eq(stockCounts.farmId, farmId), gte(stockCounts.countedAt, season.startsOn), lte(stockCounts.countedAt, season.endsOn),
  )).orderBy(desc(stockCounts.countedAt), desc(stockCounts.createdAt));
  const stocktakes = [];
  const seen = new Set<string>();
  for (const c of counts.filter(c => c.kind === 'stocktake')) {
    if (seen.has(c.stockClass)) continue;
    seen.add(c.stockClass);
    const tally = seasonTotals(opening, lines, c.countedAt).find(t => t.stockClass === c.stockClass)?.closing ?? 0;
    stocktakes.push({ id: c.id, stockClass: c.stockClass, count: c.count, countedAt: c.countedAt, tally, difference: c.count - tally });
  }
  const naitCount = counts.find(c => c.kind === 'nait');
  const nait = naitCount && {
    id: naitCount.id, count: naitCount.count, countedAt: naitCount.countedAt,
    tally: seasonTotals(opening, lines, naitCount.countedAt).reduce((sum, t) => sum + t.closing, 0),
  };

  const movements = groupMovements(lines).slice(0, 200);
  const files = await attachmentsFor('record', movements.map(m => m.recordId).filter(Boolean));
  const animalIds = movements.map(m => m.animalId).filter(Boolean);
  const named = animalIds.length
    ? new Map((await db.select({ id: animals.id, visualId: animals.visualId, name: animals.name, lifetimeId: animals.lifetimeId })
      .from(animals).where(inArray(animals.id, animalIds))).map(a => [a.id, animalLabel(a)]))
    : new Map<string, string>();
  for (const m of movements) {
    m.attachments = (m.recordId ? files.get(m.recordId) ?? [] : []).map(toApiAttachment);
    m.animal = m.animalId ? named.get(m.animalId) ?? null : null;
  }

  const [earlier] = seasons.filter(s => s.startsOn < season.startsOn);
  return {
    balanceDate, today, issues,
    seasons: seasons.map(s => ({ id: s.id, startsOn: s.startsOn, endsOn: s.endsOn, closed: !!s.closedAt })),
    season: {
      id: season.id, startsOn: season.startsOn, endsOn: season.endsOn, closedAt: season.closedAt, asAt,
      canClose: !season.closedAt && season.endsOn < today && !seasons.some(s => s.startsOn < season.startsOn && !s.closedAt),
      canReopen: !!season.closedAt && !seasons.some(s => s.startsOn > season.startsOn && s.closedAt),
      openingEditable: !season.closedAt && !earlier,
      changedSinceClose,
    },
    classes: totals,
    totals: {
      opening: totals.reduce((s, t) => s + t.opening, 0),
      closing: totals.reduce((s, t) => s + t.closing, 0),
    },
    checks: { register, mobs, stocktakes, nait: nait ?? null },
    movements,
  };
}

/** The season's numbers per class for the farm's accounts */
export async function seasonReport(farmId: string, seasonId: string) {
  await syncAnimalMovements(farmId);
  const season = await getSeason(farmId, seasonId);
  if (!season) return null;
  const [farm] = await db.select({ name: farms.name, naitNumber: farms.naitNumber }).from(farms).where(eq(farms.id, farmId));
  const totals = await totalsFor(farmId, season);
  return { farm, season: { startsOn: season.startsOn, endsOn: season.endsOn, closedAt: season.closedAt }, classes: totals };
}
