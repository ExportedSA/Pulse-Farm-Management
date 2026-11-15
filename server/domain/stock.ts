import { randomUUID } from 'crypto';
import { db } from '../db';
import {
  animalGroupMembers, animalGroups, animals, calvingRecords, farms, killsheetItems, killsheets, naitLocationSnapshots,
  naitQueue, naitRecords, pastures, stockCounts, stockSeasonClasses, stockSeasons, stockTransactions, type StockSeason,
} from '@shared/schema';
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, sql } from 'drizzle-orm';
import {
  ARRIVAL_TYPE, ARRIVALS, DEFAULT_BALANCE_DATE, STOCK_MOVEMENT_LABELS, UNCLASSIFIED, classFor, compareNait, departureType,
  isStockIn, isValidBalanceDate, killsheetUncounted, mobCheck, nextClass, nextSeason, normaliseTag, parseNaitCsv,
  reportRows, rollForward, rolloverPlan, seasonFor, seasonTotals, type Arrival, type ClassTotals, type StockMovementType,
} from '@shared/stock';
import { attachmentsFor, saveAttachments, toApiAttachment } from './attachments';
import { removeAnimal } from './animals';
import { createRecord, deleteRecord } from './records';

// Stock reconciliation by season. A season runs to the farm's balance date and opens with a head
// count per class. Movements come from four places: those entered by hand (each backed by its ASD,
// kept as a Document record in Records); those worked out from the animal register, one for each
// animal's arrival and one for its departure (a calf on a calving record is born on the calving
// date, and an animal on a killsheet was sent to the works); head on a killsheet that aren't in the
// register; and calves born that aren't in the register (bobbies). Stocktakes, NAIT, mobs and the
// register are checks against the tally. Closing a season moves each class up a year to open the
// next one, once the farm has checked what moves where.

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
 * The animal register, with calves from calving records counted as born here on the calving date
 * (when how they came onto the farm wasn't recorded).
 */
async function loadHerd(farmId: string) {
  const [herd, calvings] = await Promise.all([
    db.select({
      id: animals.id, visualId: animals.visualId, name: animals.name, lifetimeId: animals.lifetimeId, eid: animals.eid,
      nationalId: animals.nationalId, sex: animals.sex, dateOfBirth: animals.dateOfBirth, stockClass: animals.stockClass,
      stockClassAsAt: animals.stockClassAsAt, arrival: animals.arrival, startDate: animals.startDate, status: animals.status,
      dateRemoved: animals.dateRemoved, removalFate: animals.removalFate,
    }).from(animals).where(and(eq(animals.farmId, farmId), isNull(animals.deletedAt))),
    db.select({ calfId: calvingRecords.calfId, calvingDate: calvingRecords.calvingDate, calfSex: calvingRecords.calfSex })
      .from(calvingRecords).where(and(eq(calvingRecords.farmId, farmId), isNotNull(calvingRecords.calfId))),
  ]);
  const calved = new Map(calvings.map(c => [c.calfId!, c]));
  return herd.map(a => {
    const c = calved.get(a.id);
    if (!c || a.arrival) return a;
    return {
      ...a,
      arrival: 'born',
      dateOfBirth: a.dateOfBirth || c.calvingDate,
      sex: a.sex ?? (c.calfSex === 'heifer' ? 'female' as const : c.calfSex === 'bull' ? 'male' as const : null),
    };
  });
}
type HerdAnimal = Awaited<ReturnType<typeof loadHerd>>[number];

/** Whether an animal was on the farm on a day: arrived by then (or always here) and not yet left */
function onFarmOn(a: HerdAnimal, day: string) {
  const arrived = a.arrival === 'born' ? a.dateOfBirth : a.arrival ? a.startDate : null;
  if (a.arrival && (!arrived || arrived > day)) return false;
  if (a.dateOfBirth && a.dateOfBirth > day) return false;
  if (a.status !== 'active' && (!a.dateRemoved || a.dateRemoved <= day)) return false;
  return true;
}

/**
 * Animals in the register on the farm's killsheets: listed on a killsheet line by the animal, or
 * by a tag that matches one of its tags. Each animal counts on one killsheet only.
 */
async function killsheetAnimals(farmId: string, herd: HerdAnimal[]) {
  const items = await db.select({
    killsheetId: killsheetItems.killsheetId, animalId: killsheetItems.animalId, tagNumber: killsheetItems.tagNumber,
    date: killsheets.date, processor: killsheets.processorName,
  }).from(killsheetItems).innerJoin(killsheets, eq(killsheets.id, killsheetItems.killsheetId))
    .where(eq(killsheets.farmId, farmId));
  const known = new Set(herd.map(a => a.id));
  const byTag = new Map<string, string>();
  for (const a of herd) for (const tag of [a.visualId, a.lifetimeId, a.eid]) {
    const k = normaliseTag(tag);
    if (k) byTag.set(k, a.id);
  }
  const onKillsheet = new Map<string, { killsheetId: string; date: string; processor: string }>();
  const inRegister = new Map<string, number>();
  for (const i of items) {
    const id = i.animalId && known.has(i.animalId) ? i.animalId : byTag.get(normaliseTag(i.tagNumber));
    if (!id || onKillsheet.has(id)) continue;
    onKillsheet.set(id, { killsheetId: i.killsheetId, date: i.date, processor: i.processor });
    inRegister.set(i.killsheetId, (inRegister.get(i.killsheetId) ?? 0) + 1);
  }
  return { onKillsheet, inRegister };
}

/**
 * Brings the arrival and departure movements of every animal in the register up to date with the
 * animal's record, and lists records that can't be counted properly. Run before reading the tally,
 * so it's right however the animal was changed.
 */
export async function syncAnimalMovements(farmId: string): Promise<StockIssue[]> {
  const balanceDate = await balanceDateOf(farmId);
  const herd = await loadHerd(farmId);
  const { onKillsheet } = await killsheetAnimals(farmId, herd);

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
    const killed = onKillsheet.get(a.id);
    if (a.status !== 'active') {
      // Sold, and on a killsheet: it went to the works
      const type = departureType(a.removalFate, a.status);
      want(a, 'departure', killed && type === 'sale' ? 'killed' : type, a.dateRemoved || killed?.date || null, 'Has left, but has no date it left');
    } else if (killed) {
      issues.push({ animalId: a.id, animal: animalLabel(a), problem: `On the killsheet from ${killed.processor} (${killed.date}), but still on the farm in the register` });
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
    // Two reads at once (the page and its NAIT check) can both add the same movement: one is kept
    await db.insert(stockTransactions).values(Array.from(wanted.values()).map(w => ({
      farmId, movementId: randomUUID(), animalId: w.animalId, source: w.source,
      type: w.type, date: w.date, quantity: 1, stockClass: w.stockClass,
    }))).onConflictDoNothing();
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

/**
 * What closing a season will do, for the farm to check before confirming: each class's head
 * moving up, the animals in the register moving up, and the mobs whose class moves up.
 */
export async function rolloverPreview(farmId: string, seasonId: string) {
  const issues = await syncAnimalMovements(farmId);
  const season = await getSeason(farmId, seasonId);
  if (!season) return null;
  const balanceDate = await balanceDateOf(farmId);
  const totals = await totalsFor(farmId, season);
  const plan = rolloverPlan(Object.fromEntries(totals.map(t => [t.stockClass, t.closing])));
  const next = nextSeason(season.endsOn, balanceDate);

  // The register: each animal on the farm at the balance date, its class then and the day after
  const herd = (await loadHerd(farmId)).filter(a => onFarmOn(a, season.endsOn));
  const moves = new Map<string, { from: string; to: string; head: number }>();
  const registerNext: Record<string, number> = {};
  for (const a of herd) {
    const from = classFor(a, season.endsOn, balanceDate) ?? UNCLASSIFIED;
    const to = classFor(a, next.startsOn, balanceDate) ?? UNCLASSIFIED;
    registerNext[to] = (registerNext[to] ?? 0) + 1;
    if (from === to) continue;
    const key = `${from}>${to}`;
    if (!moves.has(key)) moves.set(key, { from, to, head: 0 });
    moves.get(key)!.head += 1;
  }
  const mobs = (await mobsByClass(farmId))
    .filter(m => m.stockClass && nextClass(m.stockClass) !== m.stockClass)
    .map(m => ({ id: m.id, name: m.name, from: m.stockClass!, to: nextClass(m.stockClass!), head: m.head }));

  return {
    season: { id: season.id, startsOn: season.startsOn, endsOn: season.endsOn, closed: !!season.closedAt },
    next,
    plan,
    register: { moves: Array.from(moves.values()), opening: registerNext },
    mobs,
    negative: totals.filter(t => t.closing < 0).map(t => ({ stockClass: t.stockClass, closing: t.closing })),
    issues: issues.length,
  };
}

/**
 * Closes a season on its closing numbers, and opens the next one with each class moved up. Mobs
 * whose class is by age move up too, unless the farm says not to.
 */
export async function closeSeason(farmId: string, userId: string, seasonId: string, options: { moveMobs?: boolean } = {}) {
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
  let mobsMoved = 0;
  if (options.moveMobs !== false) {
    const mobs = await db.select({ id: animalGroups.id, stockClass: animalGroups.stockClass }).from(animalGroups)
      .where(and(eq(animalGroups.farmId, farmId), eq(animalGroups.isMob, true), isNull(animalGroups.deletedAt), isNotNull(animalGroups.stockClass)));
    for (const m of mobs) {
      const to = nextClass(m.stockClass!);
      if (to === m.stockClass) continue;
      await db.update(animalGroups).set({ stockClass: to, updatedAt: new Date() }).where(eq(animalGroups.id, m.id));
      mobsMoved++;
    }
  }
  return { closed: season.id, next: nextRow.id, mobsMoved };
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
async function registerOn(farmId: string, day: string, balanceDate: string, herd?: HerdAnimal[]) {
  const byClass: Record<string, number> = {};
  for (const a of herd ?? await loadHerd(farmId)) {
    if (!onFarmOn(a, day)) continue;
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
  const herd = await loadHerd(farmId);
  const register = await registerOn(farmId, asAt, balanceDate, herd);
  const registerAtOpening = await registerOn(farmId, season.startsOn, balanceDate, herd);
  const mobs = await mobsByClass(farmId);
  const toCount = await recordsToCount(farmId, season, herd);
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
    checks: { register, registerAtOpening, mobs, mobCheck: mobCheck(totals, mobs), stocktakes, nait: nait ?? null },
    toCount,
    movements,
  };
}

/** Last season's closing numbers per class, or null in the farm's first season */
async function lastClosingBefore(farmId: string, season: StockSeason) {
  const [previous] = await db.select().from(stockSeasons)
    .where(and(eq(stockSeasons.farmId, farmId), lt(stockSeasons.startsOn, season.startsOn)))
    .orderBy(desc(stockSeasons.startsOn)).limit(1);
  if (!previous?.closedAt) return null;
  const rows = await db.select().from(stockSeasonClasses).where(eq(stockSeasonClasses.seasonId, previous.id));
  return Object.fromEntries(rows.filter(r => r.closing != null).map(r => [r.stockClass, r.closing!]));
}

/**
 * The season's numbers per class for the farm's accounts: last season's closing, the move-up at
 * the balance date, opening, each kind of movement, and closing, with anything not yet counted
 */
export async function seasonReport(farmId: string, seasonId: string) {
  const issues = await syncAnimalMovements(farmId);
  const season = await getSeason(farmId, seasonId);
  if (!season) return null;
  const [farm] = await db.select({ name: farms.name, naitNumber: farms.naitNumber }).from(farms).where(eq(farms.id, farmId));
  const [totals, lastClosing, toCount, balanceDate] = await Promise.all([
    totalsFor(farmId, season), lastClosingBefore(farmId, season), recordsToCount(farmId, season), balanceDateOf(farmId),
  ]);
  const rows = reportRows(lastClosing, totals);
  return {
    farm, balanceDate,
    season: { startsOn: season.startsOn, endsOn: season.endsOn, closedAt: season.closedAt },
    rows,
    balances: rows.every(r => r.balances),
    notCounted: {
      issues: issues.length,
      killsheetHead: toCount.killsheets.reduce((s, k) => s + Math.max(k.uncounted, 0), 0),
      calves: toCount.calvings.length,
    },
  };
}

// ----- Records that make movements: killsheets and calvings -----

const calfClass = (sex: string | null) =>
  sex === 'heifer' ? 'Rising one-year heifers' : sex === 'bull' ? 'Rising one-year steers and bulls' : null;

/**
 * What the farm's records show that the tally doesn't count yet: head on the season's killsheets
 * not in the register and not counted, animals on a killsheet still on the farm, and calves
 * born in the season (not stillborn) with no calf in the register (bobbies)
 */
export async function recordsToCount(farmId: string, season: Pick<StockSeason, 'startsOn' | 'endsOn'>, herd?: HerdAnimal[]) {
  const animalsNow = herd ?? await loadHerd(farmId);
  const [sheets, { onKillsheet, inRegister }] = await Promise.all([
    db.select().from(killsheets).where(and(
      eq(killsheets.farmId, farmId), gte(killsheets.date, season.startsOn), lte(killsheets.date, season.endsOn),
    )).orderBy(desc(killsheets.date)),
    killsheetAnimals(farmId, animalsNow),
  ]);
  const counted = sheets.length ? await db.select({
    killsheetId: stockTransactions.killsheetId, head: sql<number>`coalesce(sum(${stockTransactions.quantity}), 0)::int`,
  }).from(stockTransactions).where(and(
    eq(stockTransactions.farmId, farmId), inArray(stockTransactions.killsheetId, sheets.map(k => k.id)), isNull(stockTransactions.deletedAt),
  )).groupBy(stockTransactions.killsheetId) : [];
  const countedBy = new Map(counted.map(c => [c.killsheetId, Number(c.head)]));
  const stillOnFarm = animalsNow.filter(a => a.status === 'active' && onKillsheet.has(a.id));

  const killsheetRows = sheets.map(k => {
    const matched = inRegister.get(k.id) ?? 0;
    const done = countedBy.get(k.id) ?? 0;
    return {
      id: k.id, date: k.date, processorName: k.processorName, lotNumber: k.lotNumber, animalCount: k.animalCount,
      inRegister: matched, counted: done, uncounted: killsheetUncounted(k, matched, done),
      stillOnFarm: stillOnFarm.filter(a => onKillsheet.get(a.id)!.killsheetId === k.id).map(a => ({ id: a.id, animal: animalLabel(a) })),
    };
  }).filter(k => k.uncounted !== 0 || k.stillOnFarm.length > 0);

  const dam = sql<string>`coalesce(${animals.visualId}, ${animals.name}, ${animals.lifetimeId})`;
  const calvings = await db.select({
    id: calvingRecords.id, date: calvingRecords.calvingDate, calfSex: calvingRecords.calfSex, dam,
  }).from(calvingRecords)
    .leftJoin(animals, eq(animals.id, calvingRecords.damId))
    .where(and(
      eq(calvingRecords.farmId, farmId), isNull(calvingRecords.calfId),
      sql`coalesce(${calvingRecords.stillborn}, false) = false`,
      gte(calvingRecords.calvingDate, season.startsOn), lte(calvingRecords.calvingDate, season.endsOn),
      sql`NOT EXISTS (SELECT 1 FROM stock_transactions t WHERE t.calving_id = ${calvingRecords.id} AND t.deleted_at IS NULL)`,
    ))
    .orderBy(asc(calvingRecords.calvingDate));

  return { killsheets: killsheetRows, calvings: calvings.map(c => ({ ...c, stockClass: calfClass(c.calfSex) })) };
}

async function killsheetOf(farmId: string, killsheetId: string) {
  const [k] = await db.select().from(killsheets).where(and(eq(killsheets.farmId, farmId), eq(killsheets.id, killsheetId)));
  return k ?? null;
}

/** Counts head on a killsheet that aren't in the register: sent to the works, by class */
export async function countKillsheet(farmId: string, userId: string, killsheetId: string, lines: { stockClass: string; quantity: number }[]) {
  const k = await killsheetOf(farmId, killsheetId);
  if (!k) return null;
  const season = await seasonContaining(farmId, k.date);
  if (season?.closedAt) throw new StockError('That season is closed: reopen it first');
  const row = (await recordsToCount(farmId, { startsOn: k.date, endsOn: k.date })).killsheets.find(r => r.id === k.id);
  const uncounted = row?.uncounted ?? 0;
  const head = lines.reduce((s, l) => s + l.quantity, 0);
  if (head > uncounted) throw new StockError(`This killsheet has ${Math.max(uncounted, 0)} head not yet counted`);
  const movementId = randomUUID();
  await db.insert(stockTransactions).values(lines.map(l => ({
    farmId, movementId, killsheetId: k.id, source: 'killsheet', type: 'killed' as const, date: k.date,
    quantity: l.quantity, stockClass: l.stockClass, buyer: k.processorName, toLocation: k.processorName,
    reference: k.lotNumber, notes: `Killsheet from ${k.processorName}${k.lotNumber ? `, lot ${k.lotNumber}` : ''}`, createdBy: userId,
  })));
  return { movementId };
}

/** Records the animals on a killsheet that are still on the farm in the register as sent to the works */
export async function markKillsheetAnimalsLeft(farmId: string, killsheetId: string) {
  const k = await killsheetOf(farmId, killsheetId);
  if (!k) return null;
  const herd = await loadHerd(farmId);
  const { onKillsheet } = await killsheetAnimals(farmId, herd);
  const ids = herd.filter(a => a.status === 'active' && onKillsheet.get(a.id)?.killsheetId === k.id).map(a => a.id);
  for (const id of ids) await removeAnimal(id, farmId, 'Sent to works', k.date, `Killsheet from ${k.processorName}`);
  return { marked: ids.length };
}

/**
 * Counts calves born that aren't in the register (bobby calves): born on the calving date, and
 * sold or died on the day given (the calving date if not given)
 */
export async function countCalvings(
  farmId: string, userId: string,
  input: { calvingIds: string[]; outcome: 'sale' | 'death'; leftOn?: string | null },
) {
  const rows = await db.select().from(calvingRecords).where(and(
    eq(calvingRecords.farmId, farmId), inArray(calvingRecords.id, input.calvingIds), isNull(calvingRecords.calfId),
  ));
  let counted = 0;
  const skipped: string[] = [];
  for (const c of rows) {
    const stockClass = calfClass(c.calfSex);
    if (!stockClass) { skipped.push(`${c.calvingDate}: the calf's sex isn't on the calving record`); continue; }
    const season = await seasonContaining(farmId, c.calvingDate);
    if (season?.closedAt) { skipped.push(`${c.calvingDate}: that season is closed`); continue; }
    const left = input.leftOn && input.leftOn > c.calvingDate ? input.leftOn : c.calvingDate;
    const base = { farmId, calvingId: c.id, source: 'calving', quantity: 1, stockClass, createdBy: userId };
    const inserted = await db.insert(stockTransactions).values([
      { ...base, movementId: randomUUID(), type: 'birth' as const, date: c.calvingDate, notes: 'Calf not in the register' },
      { ...base, movementId: randomUUID(), type: input.outcome, date: left, notes: input.outcome === 'sale' ? 'Bobby calf' : 'Calf died' },
    ]).onConflictDoNothing().returning({ id: stockTransactions.id });
    if (inserted.length) counted++;
  }
  return { counted, skipped };
}

// ----- NAIT -----

/** Saves NAIT's list of the animals at the farm's location, uploaded as CSV */
export async function saveNaitSnapshot(farmId: string, userId: string, input: { asAt: string; fileName?: string | null; text: string }) {
  let parsed;
  try {
    parsed = parseNaitCsv(input.text);
  } catch (e) {
    throw new StockError((e as Error).message);
  }
  if (parsed.animals.length === 0) throw new StockError('No animals found in this file');
  const [row] = await db.insert(naitLocationSnapshots).values({
    farmId, createdBy: userId, asAt: input.asAt, fileName: input.fileName?.slice(0, 255) || null,
    head: parsed.animals.length, animals: parsed.animals,
  }).returning({ id: naitLocationSnapshots.id, head: naitLocationSnapshots.head });
  return { ...row, columns: parsed.columns };
}

export async function deleteNaitSnapshot(farmId: string, id: string) {
  const rows = await db.delete(naitLocationSnapshots)
    .where(and(eq(naitLocationSnapshots.farmId, farmId), eq(naitLocationSnapshots.id, id))).returning({ id: naitLocationSnapshots.id });
  return rows.length > 0;
}

const NAIT_LIST_LIMIT = 300;

/**
 * Pulse's numbers against NAIT, from what Pulse has: NAIT's list of animals at the location
 * (uploaded), which animals Pulse has recorded as registered with NAIT, and whether arrivals and
 * deaths in the season have a NAIT movement recorded in Pulse. Pulse has no live link to NAIT.
 */
export async function naitCheck(farmId: string, seasonId?: string) {
  await syncAnimalMovements(farmId);
  const [balanceDate, today] = await Promise.all([balanceDateOf(farmId), farmToday(farmId)]);
  const herd = await loadHerd(farmId);
  const range = (seasonId && await getSeason(farmId, seasonId)) || seasonFor(today, balanceDate);

  // NAIT's list of animals at the location, against the animals on the farm that day
  const [snap] = await db.select().from(naitLocationSnapshots).where(eq(naitLocationSnapshots.farmId, farmId))
    .orderBy(desc(naitLocationSnapshots.asAt), desc(naitLocationSnapshots.createdAt)).limit(1);
  let snapshot = null;
  if (snap) {
    const onFarm = herd.filter(a => onFarmOn(a, snap.asAt));
    const result = compareNait(snap.animals, onFarm.map(a => ({
      animalId: a.id, label: animalLabel(a), ids: [a.eid, a.lifetimeId, a.nationalId], visualId: a.visualId,
    })));
    const season = await seasonContaining(farmId, snap.asAt);
    const tally = season ? (await totalsFor(farmId, season, snap.asAt)).reduce((s, t) => s + t.closing, 0) : null;
    snapshot = {
      id: snap.id, asAt: snap.asAt, fileName: snap.fileName, head: snap.head,
      registerThatDay: onFarm.length, tallyThatDay: tally, matched: result.matched,
      onlyInNait: result.onlyInNait.slice(0, NAIT_LIST_LIMIT), onlyInNaitCount: result.onlyInNait.length,
      onlyInPulse: result.onlyInPulse.slice(0, NAIT_LIST_LIMIT).map(a => ({ id: a.animalId, animal: a.label })),
      onlyInPulseCount: result.onlyInPulse.length,
    };
  }

  // Animals on the farm today that Pulse hasn't recorded as registered with NAIT
  const records = await db.select({ animalId: naitRecords.animalId, status: naitRecords.status })
    .from(naitRecords).where(eq(naitRecords.farmId, farmId));
  const registered = new Set(records.filter(r => r.status === 'registered').map(r => r.animalId));
  const onFarmToday = herd.filter(a => onFarmOn(a, today));
  const unregistered = records.length ? onFarmToday.filter(a => !registered.has(a.id)) : [];

  // Arrivals and deaths in the season with no NAIT movement recorded in Pulse
  const lines = await db.select({
    animalId: stockTransactions.animalId, type: stockTransactions.type, date: stockTransactions.date,
  }).from(stockTransactions).where(and(
    eq(stockTransactions.farmId, farmId), isNotNull(stockTransactions.animalId), isNull(stockTransactions.deletedAt),
    inArray(stockTransactions.type, ['purchase', 'transfer_in', 'death', 'rations']),
    gte(stockTransactions.date, range.startsOn), lte(stockTransactions.date, range.endsOn),
  )).orderBy(asc(stockTransactions.date));
  const queue = lines.length ? await db.select({ animalId: naitQueue.animalId, actionType: naitQueue.actionType, status: naitQueue.status })
    .from(naitQueue).where(and(eq(naitQueue.farmId, farmId), inArray(naitQueue.animalId, lines.map(l => l.animalId!)))) : [];
  const names = new Map(herd.map(a => [a.id, animalLabel(a)]));
  const missing = [];
  for (const l of lines) {
    const arrival = l.type === 'purchase' || l.type === 'transfer_in';
    const sent = queue.filter(q => q.animalId === l.animalId && (arrival ? ['movement', 'transfer_in'] : ['death']).includes(q.actionType));
    if (sent.some(q => q.status === 'completed')) continue;
    missing.push({
      animalId: l.animalId!, animal: names.get(l.animalId!) ?? 'animal', type: l.type, date: l.date,
      naitStatus: sent.some(q => q.status === 'pending') ? 'waiting to send' : sent.some(q => q.status === 'failed') ? 'failed to send' : 'not recorded',
    });
  }

  return {
    season: { startsOn: range.startsOn, endsOn: range.endsOn },
    snapshot,
    registration: {
      hasRecords: records.length > 0, onFarm: onFarmToday.length,
      unregistered: unregistered.slice(0, NAIT_LIST_LIMIT).map(a => ({ id: a.id, animal: animalLabel(a) })),
      unregisteredCount: unregistered.length,
    },
    movements: { missing: missing.slice(0, NAIT_LIST_LIMIT), missingCount: missing.length },
  };
}
