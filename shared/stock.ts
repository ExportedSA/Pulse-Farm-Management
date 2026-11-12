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
export const STOCK_OUT_TYPES = ["sale", "transfer_out", "death", "rations"] as const;
export const STOCK_MOVEMENT_TYPES = [...STOCK_IN_TYPES, ...STOCK_OUT_TYPES, "adjustment"] as const;
export type StockMovementType = typeof STOCK_MOVEMENT_TYPES[number];

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  purchase: "Bought in",
  transfer_in: "Arrived (grazing / transfer)",
  birth: "Born",
  sale: "Sold",
  transfer_out: "Left (grazing / transfer)",
  death: "Died",
  rations: "Killed for rations",
  adjustment: "Adjustment",
};

// Movements between farms need an Animal Status Declaration
export const ASD_TYPES: StockMovementType[] = ["purchase", "transfer_in", "sale", "transfer_out"];

// The season report's columns, in order: what came in, then what went out
export const REPORT_COLUMNS: { type: StockMovementType; label: string }[] = [
  { type: "birth", label: "Natural increase" },
  { type: "purchase", label: "Purchases" },
  { type: "transfer_in", label: "Transfers in" },
  { type: "sale", label: "Sales" },
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
  Died: "death",
  "Killed for rations": "rations",
  "Transferred out": "transfer_out",
} as const satisfies Record<string, StockMovementType>;
export type Departure = keyof typeof DEPARTURES;
export const DEPARTURE_STATUS: Record<Departure, "sold" | "deceased"> = {
  Sold: "sold", Died: "deceased", "Killed for rations": "deceased", "Transferred out": "sold",
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

/**
 * An animal's class on a day: the class set by hand, or the one for its sex and age. Null when
 * that can't be worked out (no sex, no date of birth, or a day before it was born). A year of
 * birth alone isn't enough, because the year can fall in either of two seasons.
 */
export function classFor(
  animal: { sex?: string | null; dateOfBirth?: string | null; stockClass?: string | null },
  day: string,
  balanceDate = DEFAULT_BALANCE_DATE,
): string | null {
  if (animal.stockClass) return animal.stockClass;
  const dob = animal.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(animal.dateOfBirth) ? animal.dateOfBirth : null;
  if (!dob || day < dob) return null;
  const age = Number(seasonFor(day, balanceDate).endsOn.slice(0, 4)) - Number(seasonFor(dob, balanceDate).endsOn.slice(0, 4));
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
