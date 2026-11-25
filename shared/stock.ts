// Stock classes, seasons and movement types used by stock reconciliation.
//
// Classes are IRD's livestock classes for dairy cattle (the National Average Market Values of
// Specified Livestock determination), so a season's numbers are in the form farm accounts use.
// "Rising one-year" means under a year old at the balance date that ends the season: a calf
// born during the season is a rising one-year animal in that season, and moves up a class at
// the start of each new season.

export const DAIRY_CLASSES = [
  "Rising one-year heifers",
  "Rising two-year heifers",
  "Mixed-age cows",
  "Rising one-year steers and bulls",
  "Rising two-year steers and bulls",
  "Rising three-year and older steers and bulls",
  "Breeding bulls",
] as const;

export const STOCK_CLASSES: string[] = [...DAIRY_CLASSES];

// The class each one becomes at the start of the next season. Classes not listed (a farm's own)
// stay as they are.
export const NEXT_CLASS: Record<string, string> = {
  "Rising one-year heifers": "Rising two-year heifers",
  "Rising two-year heifers": "Mixed-age cows",
  "Mixed-age cows": "Mixed-age cows",
  "Rising one-year steers and bulls": "Rising two-year steers and bulls",
  "Rising two-year steers and bulls": "Rising three-year and older steers and bulls",
  "Rising three-year and older steers and bulls": "Rising three-year and older steers and bulls",
  "Breeding bulls": "Breeding bulls",
};
export const nextClass = (stockClass: string) => NEXT_CLASS[stockClass] ?? stockClass;

// Classes worked out from age and sex, by seasons since birth (0 = born this season)
const FEMALE_BY_AGE = ["Rising one-year heifers", "Rising two-year heifers", "Mixed-age cows"];
const MALE_BY_AGE = ["Rising one-year steers and bulls", "Rising two-year steers and bulls", "Rising three-year and older steers and bulls"];

export const STOCK_IN_TYPES = ["purchase", "transfer_in", "birth"] as const;
export const STOCK_OUT_TYPES = ["sale", "killed", "transfer_out", "death", "rations"] as const;
export const STOCK_MOVEMENT_TYPES = [...STOCK_IN_TYPES, ...STOCK_OUT_TYPES, "adjustment"] as const;
export type StockMovementType = typeof STOCK_MOVEMENT_TYPES[number];

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  purchase: "Bought in",
  transfer_in: "Arrived (grazing / transfer)",
  birth: "Born",
  sale: "Sold",
  killed: "Sent to the works",
  transfer_out: "Left (grazing / transfer)",
  death: "Died",
  rations: "Killed for rations",
  adjustment: "Adjustment",
};

// Movements between farms need an Animal Status Declaration
export const ASD_TYPES: StockMovementType[] = ["purchase", "transfer_in", "sale", "transfer_out"];

// The season report's movement columns, in order: what came in, then what went out
export const REPORT_COLUMNS: { type: StockMovementType; label: string }[] = [
  { type: "birth", label: "Natural increase" },
  { type: "purchase", label: "Purchases" },
  { type: "transfer_in", label: "Transfers in" },
  { type: "sale", label: "Sales" },
  { type: "killed", label: "Killed (works)" },
  { type: "death", label: "Deaths" },
  { type: "rations", label: "Killed for rations" },
  { type: "transfer_out", label: "Transfers out" },
  { type: "adjustment", label: "Adjustments" },
];

export const isStockIn = (type: string) => (STOCK_IN_TYPES as readonly string[]).includes(type);
export const isStockOut = (type: string) => (STOCK_OUT_TYPES as readonly string[]).includes(type);
// Head added to the tally by a movement line: arrivals add, departures take off, adjustments carry their own sign
export const signedQuantity = (type: string, quantity: number) => (isStockOut(type) ? -quantity : quantity);

// How an animal came onto the farm (animals.arrival). Empty: it was here when records started.
export const ARRIVALS = {
  born: "Born here",
  purchased: "Bought",
  transferred_in: "Arrived from another property (grazing, runoff, transfer)",
} as const;
export type Arrival = keyof typeof ARRIVALS;
export const ARRIVAL_TYPE: Record<Arrival, StockMovementType> = { born: "birth", purchased: "purchase", transferred_in: "transfer_in" };

// How an animal left (animals.removal_fate), and the movement it makes
export const DEPARTURES = {
  Sold: "sale",
  "Sent to works": "killed",
  Died: "death",
  "Killed for rations": "rations",
  "Transferred out": "transfer_out",
} as const satisfies Record<string, StockMovementType>;
export type Departure = keyof typeof DEPARTURES;
export const DEPARTURE_STATUS: Record<Departure, "sold" | "deceased"> = {
  Sold: "sold", "Sent to works": "sold", Died: "deceased", "Killed for rations": "deceased", "Transferred out": "sold",
};
export function departureType(removalFate: string | null | undefined, status: string): StockMovementType {
  if (removalFate && removalFate in DEPARTURES) return DEPARTURES[removalFate as Departure];
  return status === "sold" ? "sale" : "death";
}

// ----- Seasons -----

// Balance date as MM-DD; the season ends on it. Most dairy farms balance on 31 May.
export const DEFAULT_BALANCE_DATE = "05-31";
export const BALANCE_DATE_PATTERN = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isValidBalanceDate(mmdd: string): boolean {
  if (!BALANCE_DATE_PATTERN.test(mmdd)) return false;
  const [m, d] = mmdd.split("-").map(Number);
  // 29 February doesn't exist every year, so it can't be a balance date
  return d <= [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

/** The season (first and last day, yyyy-mm-dd) that contains a day */
export function seasonFor(day: string, balanceDate = DEFAULT_BALANCE_DATE): { startsOn: string; endsOn: string } {
  const year = Number(day.slice(0, 4));
  const endsOn = day <= `${year}-${balanceDate}` ? `${year}-${balanceDate}` : `${year + 1}-${balanceDate}`;
  const startsOn = addDays(`${Number(endsOn.slice(0, 4)) - 1}-${balanceDate}`, 1);
  return { startsOn, endsOn };
}

/** The season after one ending on `endsOn` */
export function nextSeason(endsOn: string, balanceDate = DEFAULT_BALANCE_DATE) {
  return seasonFor(addDays(endsOn, 1), balanceDate);
}

// The year a day's season ends in
const seasonYear = (day: string, balanceDate: string) => Number(seasonFor(day, balanceDate).endsOn.slice(0, 4));
const AGE_LADDERS = [FEMALE_BY_AGE, MALE_BY_AGE];
/** Whether a class is one of the classes by age, which move up a year at each balance date */
export const isAgeClass = (stockClass: string) => AGE_LADDERS.some(l => l.includes(stockClass));

/**
 * An animal's class on a day: the class set by hand, or the one for its sex and age. Null when
 * that can't be worked out (no sex, no date of birth, or a day before it was born). A year of
 * birth alone isn't enough, because the year can fall in either of two seasons.
 *
 * A class by age set by hand (e.g. rising one-year heifers) is its class in the season of the day
 * it was set (stockClassAsAt), and it moves up a year at each balance date after that. Before that
 * day it was a year younger each season, except in a top class (mixed-age cows), whose age then
 * isn't known. Other classes set by hand (breeding bulls, a farm's own) stay as they are.
 */
export function classFor(
  animal: { sex?: string | null; dateOfBirth?: string | null; stockClass?: string | null; stockClassAsAt?: string | null },
  day: string,
  balanceDate = DEFAULT_BALANCE_DATE,
): string | null {
  if (animal.stockClass) {
    const ladder = AGE_LADDERS.find(l => l.includes(animal.stockClass!));
    const asAt = animal.stockClassAsAt && /^\d{4}-\d{2}-\d{2}/.test(animal.stockClassAsAt) ? animal.stockClassAsAt.slice(0, 10) : null;
    if (!ladder || !asAt) return animal.stockClass;
    const steps = seasonYear(day, balanceDate) - seasonYear(asAt, balanceDate);
    const i = ladder.indexOf(animal.stockClass);
    if (steps >= 0) return ladder[Math.min(i + steps, ladder.length - 1)];
    return i === ladder.length - 1 ? animal.stockClass : ladder[Math.max(i + steps, 0)];
  }
  const dob = animal.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(animal.dateOfBirth) ? animal.dateOfBirth : null;
  if (!dob || day < dob) return null;
  const age = seasonYear(day, balanceDate) - seasonYear(dob, balanceDate);
  const byAge = animal.sex === "female" ? FEMALE_BY_AGE : animal.sex === "male" ? MALE_BY_AGE : null;
  return byAge ? byAge[Math.min(age, byAge.length - 1)] : null;
}

export interface SeasonLine { stockClass: string | null; type: string; quantity: number; date: string }
export interface ClassTotals {
  stockClass: string;
  opening: number;
  // Head per movement type (adjustments keep their sign)
  byType: Partial<Record<StockMovementType, number>>;
  in: number;
  out: number;
  closing: number;
}

export const UNCLASSIFIED = "Unclassified";

/** Opening numbers plus the season's movements (up to and including `through`, if given), per class */
export function seasonTotals(opening: Record<string, number>, lines: SeasonLine[], through?: string): ClassTotals[] {
  const classes = new Map<string, ClassTotals>();
  const row = (stockClass: string) => {
    if (!classes.has(stockClass)) {
      const head = opening[stockClass] ?? 0;
      classes.set(stockClass, { stockClass, opening: head, byType: {}, in: 0, out: 0, closing: head });
    }
    return classes.get(stockClass)!;
  };
  Object.keys(opening).forEach(row);
  for (const line of lines) {
    if (through && line.date > through) continue;
    const r = row(line.stockClass ?? UNCLASSIFIED);
    const type = line.type as StockMovementType;
    r.byType[type] = (r.byType[type] ?? 0) + line.quantity;
    const change = signedQuantity(type, line.quantity);
    if (change >= 0) r.in += change; else r.out -= change;
    r.closing += change;
  }
  const order = (c: string) => (STOCK_CLASSES.includes(c) ? STOCK_CLASSES.indexOf(c) : c === UNCLASSIFIED ? 1e6 : 1e3);
  return Array.from(classes.values()).sort((a, b) => order(a.stockClass) - order(b.stockClass) || a.stockClass.localeCompare(b.stockClass));
}

/** A season's closing numbers moved up a class: the next season's opening numbers */
export function rollForward(closing: Record<string, number>): Record<string, number> {
  const opening: Record<string, number> = {};
  for (const [stockClass, head] of Object.entries(closing)) {
    if (head <= 0) continue;
    const next = nextClass(stockClass);
    opening[next] = (opening[next] ?? 0) + head;
  }
  return opening;
}

// ----- Moving up a class at the balance date -----

export interface RolloverPlan {
  // Head moving from one class to the next
  moves: { from: string; to: string; head: number }[];
  // Head staying in their class (mixed-age cows, breeding bulls, a farm's own classes)
  stay: { stockClass: string; head: number }[];
  // The next season's opening numbers
  opening: Record<string, number>;
}

/** What closing a season does to each class: shown to the farm before it's confirmed */
export function rolloverPlan(closing: Record<string, number>): RolloverPlan {
  const moves: RolloverPlan["moves"] = [];
  const stay: RolloverPlan["stay"] = [];
  for (const [stockClass, head] of Object.entries(closing)) {
    if (head <= 0) continue;
    const to = nextClass(stockClass);
    if (to === stockClass) stay.push({ stockClass, head });
    else moves.push({ from: stockClass, to, head });
  }
  return { moves, stay, opening: rollForward(closing) };
}

// ----- The season report -----

export interface ReportRow {
  stockClass: string;
  // Last season's closing number, and the head moved into (+) or out of (−) the class at the
  // balance date. Null in the farm's first season, whose opening numbers were counted.
  lastClosing: number | null;
  rollover: number | null;
  // The move-up split: head moved up into the class from the class below, and head moved up
  // out of it into the class above (rollover = rolledIn − rolledOut)
  rolledIn: number | null;
  rolledOut: number | null;
  opening: number;
  byType: Partial<Record<StockMovementType, number>>;
  closing: number;
  // lastClosing + rolledIn − rolledOut = opening, and opening + movements = closing
  balances: boolean;
}

const classOrder = (c: string) => (STOCK_CLASSES.includes(c) ? STOCK_CLASSES.indexOf(c) : c === UNCLASSIFIED ? 1e6 : 1e3);
const byClassOrder = (a: { stockClass: string }, b: { stockClass: string }) =>
  classOrder(a.stockClass) - classOrder(b.stockClass) || a.stockClass.localeCompare(b.stockClass);

/** A season's numbers per class for the accounts, from last season's closing to this one's */
export function reportRows(lastClosing: Record<string, number> | null, totals: ClassTotals[]): ReportRow[] {
  const rows = new Map<string, ReportRow>();
  const row = (stockClass: string) => {
    if (!rows.has(stockClass)) {
      rows.set(stockClass, {
        stockClass, lastClosing: null, rollover: null, rolledIn: null, rolledOut: null, opening: 0, byType: {}, closing: 0, balances: true,
      });
    }
    return rows.get(stockClass)!;
  };
  for (const t of totals) Object.assign(row(t.stockClass), { opening: t.opening, byType: { ...t.byType }, closing: t.closing });
  if (lastClosing) {
    // Where last season's closing head went at the balance date
    const moves = rolloverPlan(lastClosing).moves;
    for (const m of moves) { row(m.from); row(m.to); }
    Object.keys(lastClosing).forEach(row);
    for (const r of Array.from(rows.values())) {
      r.lastClosing = lastClosing[r.stockClass] ?? 0;
      r.rollover = r.opening - r.lastClosing;
      r.rolledIn = moves.filter(m => m.to === r.stockClass).reduce((s, m) => s + m.head, 0);
      r.rolledOut = moves.filter(m => m.from === r.stockClass).reduce((s, m) => s + m.head, 0);
    }
  }
  for (const r of Array.from(rows.values())) {
    const moved = Object.entries(r.byType).reduce((sum, [type, q]) => sum + signedQuantity(type, q ?? 0), 0);
    r.balances = r.opening + moved === r.closing
      && (r.lastClosing === null || r.lastClosing + (r.rolledIn ?? 0) - (r.rolledOut ?? 0) === r.opening);
  }
  return Array.from(rows.values())
    .filter(r => r.opening || r.closing || r.lastClosing || Object.values(r.byType).some(Boolean))
    .sort(byClassOrder);
}

// ----- Mobs against the tally -----

export interface MobForCheck { id: string; name: string; stockClass: string | null; headCount: number | null; tagged: number; head: number }

export interface MobCheck {
  // Per class: head in its mobs against the tally (difference = mobs − tally)
  classes: { stockClass: string; tally: number; mobs: number; difference: number }[];
  // Mobs with no class, so not counted against any class
  unclassed: MobForCheck[];
  // Mobs whose head count isn't the number of animals tagged into them
  countMismatch: (MobForCheck & { difference: number })[];
}

export function mobCheck(tally: { stockClass: string; closing: number }[], mobs: MobForCheck[]): MobCheck {
  const classes = new Map<string, { stockClass: string; tally: number; mobs: number; difference: number }>();
  const row = (stockClass: string) => {
    if (!classes.has(stockClass)) classes.set(stockClass, { stockClass, tally: 0, mobs: 0, difference: 0 });
    return classes.get(stockClass)!;
  };
  for (const t of tally) row(t.stockClass).tally += t.closing;
  for (const m of mobs) if (m.stockClass) row(m.stockClass).mobs += m.head;
  for (const c of Array.from(classes.values())) c.difference = c.mobs - c.tally;
  return {
    classes: Array.from(classes.values()).filter(c => c.tally !== 0 || c.mobs !== 0).sort(byClassOrder),
    unclassed: mobs.filter(m => !m.stockClass),
    countMismatch: mobs.filter(m => m.headCount != null && m.tagged > 0 && m.headCount !== m.tagged)
      .map(m => ({ ...m, difference: (m.headCount ?? 0) - m.tagged })),
  };
}

// ----- Killsheets -----

/**
 * Head on a killsheet not yet counted: those not matched to an animal in the register and not
 * counted by a movement made from the killsheet. Negative when more were counted than it lists.
 */
export function killsheetUncounted(k: { animalCount: number }, inRegister: number, counted: number) {
  return k.animalCount - inRegister - counted;
}

// ----- NAIT -----

export interface NaitAnimal { id: string; visualId?: string | null; birthDate?: string | null; sex?: string | null }

/** A tag or NAIT number as compared: letters and digits only, upper case */
export const normaliseTag = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  // Comma-separated, or tab or semicolon when the first line has more of those
  const first = src.split(/\r?\n/)[0];
  const many = (c: string) => first.split(c).length - 1;
  const sep = many("\t") > many(",") ? "\t" : many(";") > many(",") ? ";" : ",";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some(c => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(c => c !== "")) rows.push(row);
  return rows;
}

const toIsoDate = (s: string) => {
  const nz = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (nz) return `${nz[3]}-${nz[2].padStart(2, "0")}-${nz[1].padStart(2, "0")}`;
  const iso = s.match(/^\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : null;
};

/**
 * Reads NAIT's export of the animals at a location (CSV). The columns are found by their
 * headings: the animal's NAIT number (RFID / EID / lifetime ID), and if there, its visual tag,
 * birth date and sex.
 */
export function parseNaitCsv(text: string): { animals: NaitAnimal[]; columns: { id: string; visualId: string | null } } {
  const rows = csvRows(text);
  const idPatterns = [/rfid|\beid\b|electronic/i, /nait.*(no|num|id)|animal.*(no|num|id)|lifetime|\blid\b/i, /tag/i];
  for (let h = 0; h < Math.min(rows.length, 15); h++) {
    const head = rows[h];
    const visualAt = head.findIndex(c => /visual|\bvid\b|management|farm tag/i.test(c));
    let idAt = -1;
    for (const p of idPatterns) {
      idAt = head.findIndex((c, i) => i !== visualAt && p.test(c));
      if (idAt >= 0) break;
    }
    if (idAt < 0 && visualAt < 0) continue;
    // NAIT's export has "Date Of Birth" and "Registered Birth Date" (not "Birthplace"): the first one filled in
    const birthAt = head.map((c, i) => (/birth|\bdob\b/i.test(c) && !/place/i.test(c) ? i : -1)).filter(i => i >= 0);
    const sexAt = head.findIndex(c => /^\s*(sex|gender)/i.test(c));
    // Animals NAIT lists that have died, been slaughtered or exported, or gone missing (and not been found)
    // aren't at the location any more
    const goneAt = head.map((c, i) => (/date of death|slaughter|export date|missing date/i.test(c) ? i : -1)).filter(i => i >= 0);
    const foundAt = head.findIndex(c => /found date/i.test(c));
    const animals: NaitAnimal[] = [];
    for (const r of rows.slice(h + 1)) {
      const id = (idAt >= 0 ? r[idAt] : "") || (visualAt >= 0 ? r[visualAt] : "") || "";
      if (!normaliseTag(id)) continue;
      const gone = goneAt.filter(i => r[i]);
      if (gone.length && !(gone.every(i => /missing/i.test(head[i])) && foundAt >= 0 && r[foundAt])) continue;
      const birth = birthAt.map(i => r[i]).find(Boolean);
      animals.push({
        id,
        visualId: visualAt >= 0 ? r[visualAt] || null : null,
        birthDate: birth ? toIsoDate(birth) : null,
        sex: sexAt >= 0 ? r[sexAt] || null : null,
      });
    }
    return { animals, columns: { id: idAt >= 0 ? head[idAt] : head[visualAt], visualId: visualAt >= 0 ? head[visualAt] : null } };
  }
  throw new Error("Couldn't find the animals' NAIT numbers (RFID or tag) in this file. Upload NAIT's list of animals at your location as CSV.");
}

export interface PulseAnimalForNait { animalId: string; label: string; ids: (string | null | undefined)[]; visualId?: string | null }

/** NAIT's animals at the location against the animals on the farm in Pulse, matched by tag */
export function compareNait(nait: NaitAnimal[], pulse: PulseAnimalForNait[]) {
  const byId = new Map<string, PulseAnimalForNait>();
  const byVisual = new Map<string, PulseAnimalForNait>();
  for (const a of pulse) {
    for (const id of a.ids) {
      const k = normaliseTag(id);
      if (k) byId.set(k, a);
    }
    // Short herd numbers (e.g. 123) would match the wrong animal, so only longer visual tags count
    const v = normaliseTag(a.visualId);
    if (v.length >= 6) byVisual.set(v, a);
  }
  const lookup = (s: string | null | undefined) => {
    const k = normaliseTag(s);
    return k ? byId.get(k) ?? byVisual.get(k) : undefined;
  };
  const found = new Set<string>();
  const onlyInNait: NaitAnimal[] = [];
  for (const n of nait) {
    const match = lookup(n.id) ?? lookup(n.visualId);
    if (match && !found.has(match.animalId)) found.add(match.animalId);
    else onlyInNait.push(n);
  }
  return { matched: found.size, onlyInNait, onlyInPulse: pulse.filter(a => !found.has(a.animalId)) };
}
