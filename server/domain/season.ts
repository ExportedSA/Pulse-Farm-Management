import { db } from '../db';
import { farms, farmRecords, pastures, inputProducts, type FarmRecord } from '@shared/schema';
import { and, asc, eq, gte, inArray, isNull, lt, or } from 'drizzle-orm';

// Synthetic nitrogen cap for pastoral land (kg N/ha/year)
export const SYNTHETIC_N_CAP = 190;
// 1 mm of effluent over 1 ha is 10 m³, roughly 10,000 kg
const KG_PER_MM_HA = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * NZ dairy season label for a date, e.g. "2026/27" (seasons start 1 June)
 */
export function seasonOf(date: Date): string {
  const start = date.getMonth() >= 5 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}

export function seasonRange(season: string): { from: Date; to: Date } {
  const match = /^(\d{4})\/\d{2}$/.exec(season);
  if (!match) throw new Error('Season must look like 2026/27');
  const start = Number(match[1]);
  return { from: new Date(start, 5, 1), to: new Date(start + 1, 5, 1) };
}

const num = (v: unknown): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const toTonnes = (amount: number | undefined, unit: unknown): number | undefined => {
  if (amount === undefined) return undefined;
  if (unit === 't') return amount;
  if (unit === 'kg') return amount / 1000;
  return undefined; // bales and m³ have no fixed weight
};

/**
 * Hectares a record covers: its drawn area, else the sum of its paddocks
 */
function recordHectares(record: FarmRecord, paddockHa: Map<string, number>): number | undefined {
  if (record.areaHa != null) return Number(record.areaHa);
  const total = record.pastureIds.reduce((sum, id) => sum + (paddockHa.get(id) ?? 0), 0);
  return total > 0 ? total : undefined;
}

/**
 * Kilograms of product applied: an explicit amount, else rate × area
 */
function productKg(record: FarmRecord, hectares: number | undefined): number | undefined {
  const d = record.details ?? {};
  const amount = num(d.amountApplied);
  if (amount !== undefined) return d.amountUnit === 't' ? amount * 1000 : amount;
  if (record.type === 'effluent') {
    const depth = num(d.depthMm);
    return depth !== undefined && hectares !== undefined ? depth * KG_PER_MM_HA * hectares : undefined;
  }
  const rate = num(d.rate);
  return rate !== undefined && hectares !== undefined ? rate * hectares : undefined;
}

export async function seasonSummary(farmId: string, season: string) {
  const { from, to } = seasonRange(season);

  const [farm] = await db.select({ settings: farms.settings }).from(farms).where(eq(farms.id, farmId));
  const paddocks = await db
    .select({ id: pastures.id, area: pastures.area })
    .from(pastures)
    .where(and(eq(pastures.farmId, farmId), isNull(pastures.deletedAt)));
  const paddockHa = new Map(paddocks.map(p => [p.id, Number(p.area ?? 0)]));
  const settingsArea = num(farm?.settings?.effectiveAreaHa);
  const paddockTotal = paddocks.reduce((s, p) => s + Number(p.area ?? 0), 0);
  const effectiveAreaHa = settingsArea ?? (paddockTotal > 0 ? paddockTotal : undefined);

  const records = await db
    .select()
    .from(farmRecords)
    .where(and(
      eq(farmRecords.farmId, farmId),
      isNull(farmRecords.deletedAt),
      gte(farmRecords.occurredAt, from),
      lt(farmRecords.occurredAt, to),
      inArray(farmRecords.type, ['fertiliser', 'effluent', 'feed_in', 'feed_out', 'baleage', 'spray', 'monthly_check']),
    ))
    .orderBy(asc(farmRecords.occurredAt));

  // Typical effluent analysis when the record doesn't carry one
  const [effluentDefault] = await db
    .select()
    .from(inputProducts)
    .where(and(isNull(inputProducts.farmId), eq(inputProducts.kind, 'effluent')))
    .limit(1);

  const nutrients = { syntheticN: 0, effluentN: 0, p: 0, k: 0, s: 0 };
  const incomplete: { id: string; title: string; reason: string }[] = [];
  const feedFed = { boughtT: 0, homeGrownT: 0 };
  let boughtInT = 0;
  const onHand = new Map<string, { product: string; unit: string; quantity: number }>();
  const addOnHand = (product: unknown, unit: unknown, qty: number | undefined) => {
    if (!product || !unit || qty === undefined) return;
    const key = `${String(product).trim().toLowerCase()}|${unit}`;
    const row = onHand.get(key) ?? { product: String(product).trim(), unit: String(unit), quantity: 0 };
    row.quantity += qty;
    onHand.set(key, row);
  };
  let sprays = 0;
  let activeWithholding = 0;
  let monthlyChecks = 0;
  const now = Date.now();

  for (const r of records) {
    const d = r.details ?? {};
    switch (r.type) {
      case 'fertiliser':
      case 'effluent': {
        const ha = recordHectares(r, paddockHa);
        const kg = productKg(r, ha);
        const pct = (key: string, fallback?: unknown) => num(d[key]) ?? num(fallback) ?? 0;
        const isEffluent = r.type === 'effluent';
        const nPct = isEffluent ? pct('nPercent', effluentDefault?.nPercent) : pct('nPercent');
        if (kg === undefined) {
          incomplete.push({ id: r.id, title: r.title, reason: 'needs a rate and paddocks/area, or the amount applied' });
          break;
        }
        const n = kg * nPct / 100;
        if (isEffluent) nutrients.effluentN += n; else nutrients.syntheticN += n;
        nutrients.p += kg * (isEffluent ? pct('pPercent', effluentDefault?.pPercent) : pct('pPercent')) / 100;
        nutrients.k += kg * (isEffluent ? pct('kPercent', effluentDefault?.kPercent) : pct('kPercent')) / 100;
        nutrients.s += kg * pct('sPercent') / 100;
        break;
      }
      case 'feed_in': {
        const t = toTonnes(num(d.quantity), d.unit);
        if (t !== undefined) boughtInT += t;
        addOnHand(d.product, d.unit, num(d.quantity));
        break;
      }
      case 'baleage':
        addOnHand(d.kind ?? 'Baleage', 'bales', num(d.bales));
        break;
      case 'feed_out': {
        const t = toTonnes(num(d.amount), d.unit);
        if (t !== undefined) {
          if (d.source === 'Bought in') feedFed.boughtT += t; else feedFed.homeGrownT += t;
        }
        const amount = num(d.amount);
        addOnHand(d.product, d.unit, amount !== undefined ? -amount : undefined);
        break;
      }
      case 'spray': {
        sprays++;
        const days = num(d.withholdingDays);
        if (days !== undefined && r.occurredAt.getTime() + days * DAY_MS > now) activeWithholding++;
        break;
      }
      case 'monthly_check':
        monthlyChecks++;
        break;
    }
  }

  const perHa = (kg: number) => (effectiveAreaHa ? Math.round((kg / effectiveAreaHa) * 10) / 10 : null);
  const fedTotal = feedFed.boughtT + feedFed.homeGrownT;
  const round = (v: number, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;

  return {
    season,
    from: from.toISOString(),
    to: to.toISOString(),
    effectiveAreaHa: effectiveAreaHa ?? null,
    effectiveAreaSource: settingsArea !== undefined ? 'farm settings' : paddockTotal > 0 ? 'sum of paddocks' : null,
    nitrogen: {
      capKgPerHa: SYNTHETIC_N_CAP,
      syntheticKg: round(nutrients.syntheticN),
      syntheticKgPerHa: perHa(nutrients.syntheticN),
      effluentKg: round(nutrients.effluentN),
      totalKgPerHa: perHa(nutrients.syntheticN + nutrients.effluentN),
    },
    phosphorusKgPerHa: perHa(nutrients.p),
    potassiumKgPerHa: perHa(nutrients.k),
    sulphurKgPerHa: perHa(nutrients.s),
    feed: {
      boughtInT: round(boughtInT),
      importedFedT: round(feedFed.boughtT),
      homeGrownFedT: round(feedFed.homeGrownT),
      homeGrownSupplementPct: fedTotal > 0 ? Math.round((feedFed.homeGrownT / fedTotal) * 100) : null,
    },
    feedOnHand: Array.from(onHand.values())
      .map(row => ({ ...row, quantity: round(row.quantity, 2) }))
      .filter(row => row.quantity !== 0)
      .sort((a, b) => a.product.localeCompare(b.product)),
    spray: { applications: sprays, activeWithholding },
    monthlyChecks,
    incomplete,
  };
}

/**
 * The shared product library plus the farm's own products
 */
export async function listProducts(farmId: string, kind?: string) {
  const conditions = [or(isNull(inputProducts.farmId), eq(inputProducts.farmId, farmId))];
  if (kind) conditions.push(eq(inputProducts.kind, kind));
  const rows = await db.select().from(inputProducts).where(and(...conditions)).orderBy(asc(inputProducts.name));
  const pct = (v: string | null) => (v == null ? null : Number(v));
  return rows.map(p => ({
    id: p.id,
    kind: p.kind,
    name: p.name,
    shared: p.farmId === null,
    nPercent: pct(p.nPercent), pPercent: pct(p.pPercent), kPercent: pct(p.kPercent),
    sPercent: pct(p.sPercent), mgPercent: pct(p.mgPercent), caPercent: pct(p.caPercent),
    activeIngredient: p.activeIngredient,
    defaultRate: pct(p.defaultRate),
    rateUnit: p.rateUnit,
    withholdingDays: p.withholdingDays,
    notes: p.notes,
  }));
}
