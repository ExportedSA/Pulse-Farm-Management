import { sql } from 'drizzle-orm';
import { db } from '../db';
import { MapError, audit, isoUtc, rowsOf } from './farm-map';
import { productSnapshot, touchProduct } from './catalogue';
import { createRecord, updateRecord, deleteRecord } from './records';

// Spray jobs: a tank mix (each product at its own rate, in its own units) over the job's areas,
// and the grazing, harvest and re-entry restrictions that follow. A restriction's end is worked out
// only from a confirmed rule and the time the application finished; an unknown one stays
// unresolved (no end date), never zero days. Recording a mix says nothing about compatibility.

// Hectare rates give quantity = net ha x rate. Rates per 100 L of water need the water rate.
export const SPRAY_UNITS: Record<string, { per: 'ha' | '100L'; qty: string; base: 'L' | 'kg'; factor: number }> = {
  'L/ha': { per: 'ha', qty: 'L', base: 'L', factor: 1 },
  'mL/ha': { per: 'ha', qty: 'mL', base: 'L', factor: 0.001 },
  'kg/ha': { per: 'ha', qty: 'kg', base: 'kg', factor: 1 },
  'g/ha': { per: 'ha', qty: 'g', base: 'kg', factor: 0.001 },
  'L/100L': { per: '100L', qty: 'L', base: 'L', factor: 1 },
  'mL/100L': { per: '100L', qty: 'mL', base: 'L', factor: 0.001 },
  'kg/100L': { per: '100L', qty: 'kg', base: 'kg', factor: 1 },
  'g/100L': { per: '100L', qty: 'g', base: 'kg', factor: 0.001 },
};
export const QTY_UNITS = ['L', 'mL', 'kg', 'g'] as const;
export const RESTRICTION_KINDS = ['grazing', 'harvest', 'reentry', 'other'] as const;
export const RESTRICTION_STATUSES = ['unresolved', 'confirmed', 'not_applicable'] as const;
// Every product in a mix starts with these, unresolved, until the label is checked
const REQUIRED_KINDS = ['grazing', 'harvest'] as const;

export interface MixInput {
  productId: string;
  role?: 'product' | 'adjuvant';
  rate?: number | null;
  rateUnit: string;
  labelRef?: string | null;
  actualQuantity?: number | null;
  actualUnit?: string | null;
}

export interface RestrictionInput {
  kind?: typeof RESTRICTION_KINDS[number];
  mixId?: string | null;
  status: typeof RESTRICTION_STATUSES[number];
  periodValue?: number | null;
  periodUnit?: 'hours' | 'days' | null;
  appliesTo?: string | null;
  ruleSource?: string | null;
  notes?: string | null;
}

function checkMix(m: MixInput) {
  if (!SPRAY_UNITS[m.rateUnit]) throw new MapError('Choose the rate unit for each product');
  if (m.rate != null && !(m.rate >= 0)) throw new MapError('Rates must be 0 or more');
  if (m.actualQuantity != null && !(m.actualQuantity >= 0)) throw new MapError('Quantities used must be 0 or more');
  if (m.actualQuantity != null && !m.actualUnit) throw new MapError('Give the unit for the quantity used');
}

/**
 * Replace the job's tank mix. A product already in the mix keeps its id, so its restrictions
 * (and anything confirmed on them) carry over; a removed product takes its restrictions with it.
 */
export async function saveMix(tx: any, farmId: string, appId: string, mix: MixInput[]) {
  if (!mix.length) throw new MapError('Add at least one product to the mix');
  const ids = mix.map(m => m.productId);
  if (new Set(ids).size !== ids.length) throw new MapError('A product is in the mix twice. Combine them into one line.');
  const existing = rowsOf(await tx.execute(sql`SELECT id, product_id FROM application_mix WHERE application_id = ${appId}`));
  const keep = new Set<string>();
  for (let i = 0; i < mix.length; i++) {
    const m = mix[i];
    checkMix(m);
    const product = await productSnapshot(tx, farmId, m.productId);
    const role = m.role ?? (product.category === 'adjuvant' ? 'adjuvant' : 'product');
    const old = existing.find((e: any) => e.product_id === m.productId);
    if (old) {
      keep.add(old.id);
      await tx.execute(sql`
        UPDATE application_mix SET role = ${role}, rate = ${m.rate ?? null}, rate_unit = ${m.rateUnit}, label_ref = ${m.labelRef ?? null},
          actual_quantity = ${m.actualQuantity ?? null}, actual_unit = ${m.actualUnit ?? null}, sort_order = ${i}, updated_at = now()
        WHERE id = ${old.id}`);
    } else {
      const [row] = rowsOf(await tx.execute(sql`
        INSERT INTO application_mix (application_id, product_id, product_version, product_snapshot, role, rate, rate_unit, label_ref,
          actual_quantity, actual_unit, sort_order)
        VALUES (${appId}, ${product.id}, ${product.version}, ${JSON.stringify(product)}::jsonb, ${role}, ${m.rate ?? null}, ${m.rateUnit},
          ${m.labelRef ?? null}, ${m.actualQuantity ?? null}, ${m.actualUnit ?? null}, ${i})
        RETURNING id`));
      keep.add(row.id);
      for (const kind of REQUIRED_KINDS) {
        await tx.execute(sql`INSERT INTO restrictions (farm_id, application_id, mix_id, kind) VALUES (${farmId}, ${appId}, ${row.id}, ${kind})`);
      }
    }
    await touchProduct(tx, farmId, product.id);
  }
  for (const e of existing) if (!keep.has(e.id)) await tx.execute(sql`DELETE FROM application_mix WHERE id = ${e.id}`);
}

export async function setMixUsed(tx: any, appId: string, used: { mixId: string; quantity: number | null; unit: string | null }[]) {
  for (const u of used) {
    if (u.quantity != null && !(u.quantity >= 0)) throw new MapError('Quantities used must be 0 or more');
    if (u.quantity != null && !QTY_UNITS.includes(u.unit as any)) throw new MapError('Give the unit for the quantity used');
    await tx.execute(sql`UPDATE application_mix SET actual_quantity = ${u.quantity}, actual_unit = ${u.quantity == null ? null : u.unit}, updated_at = now()
      WHERE id = ${u.mixId} AND application_id = ${appId}`);
  }
}

/**
 * Restriction end = when the application finished + the confirmed period. Nothing else.
 */
export async function recalcRestrictions(tx: any, appId: string) {
  await tx.execute(sql`
    UPDATE restrictions r SET
      applies_from = CASE WHEN a.status = 'completed' THEN a.completed_at END,
      ends_at = CASE WHEN a.status = 'completed' AND r.status = 'confirmed' AND r.period_value IS NOT NULL
        THEN a.completed_at + (r.period_value || ' ' || r.period_unit)::interval END,
      updated_at = now()
    FROM applications a WHERE a.id = r.application_id AND r.application_id = ${appId}`);
}

function checkRestriction(r: RestrictionInput) {
  if (r.status === 'confirmed') {
    if (r.periodValue == null || !(r.periodValue >= 0)) throw new MapError('Enter the period from the label (0 or more)');
    if (r.periodUnit !== 'hours' && r.periodUnit !== 'days') throw new MapError('Choose hours or days');
    if (!r.ruleSource?.trim()) throw new MapError('Say where the rule comes from (the label section, or the document)');
  }
  if (r.status === 'not_applicable' && !r.ruleSource?.trim()) throw new MapError('Say where the label shows this restriction does not apply');
}

async function restrictionApp(tx: any, farmId: string, appId: string) {
  const [app] = rowsOf(await tx.execute(sql`SELECT id, activity FROM applications WHERE id = ${appId} AND farm_id = ${farmId} AND deleted_at IS NULL`));
  if (!app) throw new MapError('Job not found', 404);
  if (app.activity !== 'spray') throw new MapError('Restrictions belong to spray jobs');
  return app;
}

export async function updateRestriction(farmId: string, userId: string, appId: string, id: string, input: RestrictionInput) {
  checkRestriction(input);
  await db.transaction(async tx => {
    await restrictionApp(tx, farmId, appId);
    const [old] = rowsOf(await tx.execute(sql`SELECT * FROM restrictions WHERE id = ${id} AND application_id = ${appId}`));
    if (!old) throw new MapError('Restriction not found', 404);
    const resolved = input.status !== 'unresolved';
    await tx.execute(sql`
      UPDATE restrictions SET status = ${input.status},
        period_value = ${input.status === 'confirmed' ? input.periodValue! : null},
        period_unit = ${input.status === 'confirmed' ? input.periodUnit! : null},
        applies_to = ${input.appliesTo ?? null}, rule_source = ${input.ruleSource?.trim() || null}, notes = ${input.notes ?? null},
        confirmed_by = ${resolved ? userId : null}, confirmed_at = ${resolved ? sql`now()` : null}, updated_at = now()
      WHERE id = ${id}`);
    await recalcRestrictions(tx, appId);
    await tx.execute(sql`UPDATE applications SET version = version + 1, updated_at = now() WHERE id = ${appId}`);
    await audit(tx, farmId, userId, 'restriction', id, 'update',
      { status: old.status, periodValue: old.period_value, periodUnit: old.period_unit, ruleSource: old.rule_source }, input);
  });
  await syncSprayRecords(farmId, userId, appId);
}

export async function addRestriction(farmId: string, userId: string, appId: string, input: RestrictionInput) {
  if (!input.kind) throw new MapError('Choose the kind of restriction');
  checkRestriction(input);
  const id = await db.transaction(async tx => {
    await restrictionApp(tx, farmId, appId);
    if (input.mixId) {
      const [m] = rowsOf(await tx.execute(sql`SELECT id FROM application_mix WHERE id = ${input.mixId} AND application_id = ${appId}`));
      if (!m) throw new MapError('That product is not in this mix');
    }
    const resolved = input.status !== 'unresolved';
    const [row] = rowsOf(await tx.execute(sql`
      INSERT INTO restrictions (farm_id, application_id, mix_id, kind, status, period_value, period_unit, applies_to, rule_source, notes, confirmed_by, confirmed_at)
      VALUES (${farmId}, ${appId}, ${input.mixId ?? null}, ${input.kind}, ${input.status},
        ${input.status === 'confirmed' ? input.periodValue! : null}, ${input.status === 'confirmed' ? input.periodUnit! : null},
        ${input.appliesTo ?? null}, ${input.ruleSource?.trim() || null}, ${input.notes ?? null},
        ${resolved ? userId : null}, ${resolved ? sql`now()` : null})
      RETURNING id`));
    await recalcRestrictions(tx, appId);
    await tx.execute(sql`UPDATE applications SET version = version + 1, updated_at = now() WHERE id = ${appId}`);
    await audit(tx, farmId, userId, 'restriction', row.id, 'create', null, input);
    return row.id as string;
  });
  await syncSprayRecords(farmId, userId, appId);
  return id;
}

/**
 * Only extra restrictions can be removed. Grazing and harvest for each product stay, so one can't
 * disappear by being deleted: mark it as not applying, with the label reference.
 */
export async function deleteRestriction(farmId: string, userId: string, appId: string, id: string) {
  await db.transaction(async tx => {
    await restrictionApp(tx, farmId, appId);
    const [r] = rowsOf(await tx.execute(sql`SELECT * FROM restrictions WHERE id = ${id} AND application_id = ${appId}`));
    if (!r) throw new MapError('Restriction not found', 404);
    if (r.mix_id && (REQUIRED_KINDS as readonly string[]).includes(r.kind)) {
      throw new MapError("Grazing and harvest restrictions can't be removed. If the label says none applies, mark it as not applying and give the label reference.");
    }
    await tx.execute(sql`DELETE FROM restrictions WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'restriction', id, 'delete', r, null);
  });
  await syncSprayRecords(farmId, userId, appId);
}

const round = (v: number, dp = 3) => Math.round(v * 10 ** dp) / 10 ** dp;

/**
 * Water, tank loads and how much of each product the areas need. Unknown inputs give unknown
 * answers with the reason, not zero.
 */
export function sprayTotals(app: any, lines: any[], mix: any[]) {
  const netHa = lines.reduce((s, l) => s + Number(l.netHa ?? 0), 0);
  const waterRate = app.water_rate != null ? Number(app.water_rate) : null;
  const tank = app.tank_volume != null ? Number(app.tank_volume) : null;
  const waterL = waterRate != null ? netHa * waterRate : null;
  const products = mix.map(m => {
    const u = SPRAY_UNITS[m.rateUnit];
    let planned: number | null = null;
    let reason: string | null = null;
    if (m.rate == null) reason = 'no rate entered';
    else if (u.per === 'ha') planned = netHa * m.rate;
    else if (waterL == null) reason = 'needs the water rate (this rate is per 100 L of water)';
    else planned = (waterL / 100) * m.rate;
    const actualBase = m.actualQuantity != null && m.actualUnit ? m.actualQuantity * (m.actualUnit === 'mL' || m.actualUnit === 'g' ? 0.001 : 1) : null;
    const actualBaseUnit = m.actualUnit === 'mL' || m.actualUnit === 'L' ? 'L' : m.actualUnit === 'g' || m.actualUnit === 'kg' ? 'kg' : null;
    const plannedBase = planned != null ? planned * u.factor : null;
    const issues: string[] = [];
    if (plannedBase != null && actualBase != null && actualBaseUnit === u.base && plannedBase > 0) {
      const diff = (actualBase - plannedBase) / plannedBase;
      if (Math.abs(diff) > 0.05) issues.push(`Used is ${Math.round(Math.abs(diff) * 100)}% ${diff > 0 ? 'more' : 'less'} than planned`);
    }
    if (actualBase != null && actualBaseUnit !== u.base) issues.push(`Used is in ${m.actualUnit} but the rate is in ${u.base === 'L' ? 'litres' : 'kilograms'}, so they can't be compared`);
    return {
      mixId: m.id, product: m.productSnapshot.name,
      planned: planned != null ? round(planned) : null, plannedUnit: u.qty, reason,
      plannedBase: plannedBase != null ? round(plannedBase) : null, baseUnit: u.base,
      used: m.actualQuantity, usedUnit: m.actualUnit, issues,
    };
  });
  return {
    netHa: round(netHa), waterRate, waterL: waterL != null ? round(waterL, 1) : null, tankVolume: tank,
    tankLoadsPlanned: waterL != null && tank ? round(waterL / tank, 2) : null,
    tankLoadsUsed: app.tank_loads != null ? Number(app.tank_loads) : null,
    products,
  };
}

export async function sprayDetail(farmId: string, app: any, lines: any[]) {
  const mix = rowsOf(await db.execute(sql`
    SELECT id, product_id AS "productId", product_version AS "productVersion", product_snapshot AS "productSnapshot", role,
      rate::float, rate_unit AS "rateUnit", label_ref AS "labelRef", actual_quantity::float AS "actualQuantity", actual_unit AS "actualUnit"
    FROM application_mix WHERE application_id = ${app.id} ORDER BY sort_order`));
  const restrictions = rowsOf(await db.execute(sql`
    SELECT r.id, r.mix_id AS "mixId", r.kind, r.status, r.period_value::float AS "periodValue", r.period_unit AS "periodUnit",
      r.applies_to AS "appliesTo", r.rule_source AS "ruleSource", r.applies_from AT TIME ZONE 'UTC' AS "appliesFrom", r.ends_at AT TIME ZONE 'UTC' AS "endsAt", r.notes,
      u.name AS "confirmedBy", r.confirmed_at AS "confirmedAt", m.product_snapshot->>'name' AS product
    FROM restrictions r LEFT JOIN application_mix m ON m.id = r.mix_id LEFT JOIN users u ON u.id = r.confirmed_by
    WHERE r.application_id = ${app.id} ORDER BY m.sort_order NULLS LAST, r.kind, r.created_at`));
  const now = Date.now();
  const withState = restrictions.map((r: any) => ({
    ...r, appliesFrom: isoUtc(r.appliesFrom), endsAt: isoUtc(r.endsAt), confirmedAt: isoUtc(r.confirmedAt),
    state: app.status !== 'completed' ? 'not_started'
      : r.status === 'unresolved' ? 'unresolved'
      : r.status === 'not_applicable' ? 'not_applicable'
      : new Date(r.endsAt).getTime() > now ? 'active' : 'ended',
  }));
  void farmId;
  return {
    crop: app.crop, target: app.target, waterRate: app.water_rate != null ? Number(app.water_rate) : null,
    tankVolume: app.tank_volume != null ? Number(app.tank_volume) : null, tankLoads: app.tank_loads != null ? Number(app.tank_loads) : null,
    windSpeed: app.wind_speed != null ? Number(app.wind_speed) : null, windDirection: app.wind_direction,
    temperature: app.temperature != null ? Number(app.temperature) : null, operatorCert: app.operator_cert,
    mix, restrictions: withState, totals: sprayTotals(app, lines, mix),
    summary: restrictionSummary(withState),
  };
}

/**
 * The job's grazing position: unresolved beats everything; otherwise the latest confirmed end
 */
export function restrictionSummary(rs: { kind: string; state: string; endsAt: string | null }[]) {
  const by = (kind: string) => {
    const of = rs.filter(r => r.kind === kind);
    if (!of.length) return null;
    if (of.some(r => r.state === 'not_started')) return { state: 'not_started' as const, until: null };
    if (of.some(r => r.state === 'unresolved')) return { state: 'unresolved' as const, until: null };
    const ends = of.filter(r => r.endsAt).map(r => new Date(r.endsAt!).getTime());
    const until = ends.length ? new Date(Math.max(...ends)).toISOString() : null;
    return { state: until && new Date(until).getTime() > Date.now() ? 'active' as const : 'clear' as const, until };
  };
  return { grazing: by('grazing'), harvest: by('harvest'), reentry: by('reentry') };
}

/**
 * Restrictions in force now (or at a given time) over a paddock. Unresolved ones count as in force.
 */
export async function activeRestrictions(farmId: string, opts: { pastureId?: string; at?: string; kinds?: string[] }) {
  const at = opts.at ?? new Date().toISOString();
  const kinds = opts.kinds?.length ? opts.kinds : ['grazing', 'harvest', 'reentry', 'other'];
  const rows = rowsOf(await db.execute(sql`
    SELECT r.id, r.application_id AS "applicationId", r.kind, r.status, r.ends_at AT TIME ZONE 'UTC' AS "endsAt", r.period_value::float AS "periodValue",
      r.period_unit AS "periodUnit", r.rule_source AS "ruleSource", m.product_snapshot->>'name' AS product, a.completed_at AT TIME ZONE 'UTC' AS "appliedAt",
      a.title, a.target,
      (SELECT string_agg(DISTINCT l.name, ', ') FROM application_lines l WHERE l.application_id = a.id) AS areas,
      (SELECT ST_AsGeoJSON(ST_Union(l.geom::geometry), 7)::json FROM application_lines l WHERE l.application_id = a.id) AS geometry
    FROM restrictions r
    JOIN applications a ON a.id = r.application_id
    LEFT JOIN application_mix m ON m.id = r.mix_id
    WHERE r.farm_id = ${farmId} AND a.deleted_at IS NULL AND a.status = 'completed' AND a.completed_at <= ${at}::timestamp
      AND r.kind IN (${sql.join(kinds.map(k => sql`${k}`), sql`, `)})
      AND (r.status = 'unresolved' OR (r.status = 'confirmed' AND r.ends_at > ${at}::timestamp))
      AND (${opts.pastureId ?? null}::uuid IS NULL OR EXISTS (
        SELECT 1 FROM application_lines l
        LEFT JOIN paddock_boundaries b ON b.pasture_id = ${opts.pastureId ?? null}::uuid AND b.valid_to IS NULL
        WHERE l.application_id = a.id AND (l.pasture_id = ${opts.pastureId ?? null}::uuid OR (b.geom IS NOT NULL AND ST_Intersects(l.geom, b.geom)))))
    ORDER BY a.completed_at DESC`));
  return rows.map((r: any) => ({ ...r, endsAt: isoUtc(r.endsAt), appliedAt: isoUtc(r.appliedAt) }));
}

/**
 * Completed spray lines appear in Records (compliance pack, season counts). The non-grazing period
 * is filled in only once every grazing restriction in the mix is resolved; until then the record
 * says it's unresolved.
 */
export async function syncSprayRecords(farmId: string, userId: string, id: string) {
  const [app] = rowsOf(await db.execute(sql`SELECT *, completed_at AT TIME ZONE 'UTC' AS completed_utc FROM applications WHERE id = ${id}`));
  if (!app || app.activity !== 'spray') return;
  const lines = rowsOf(await db.execute(sql`
    SELECT l.*, ST_AsGeoJSON(l.geom, 7)::json AS geometry FROM application_lines l WHERE l.application_id = ${id} ORDER BY sort_order`));
  const mix = rowsOf(await db.execute(sql`SELECT * FROM application_mix WHERE application_id = ${id} ORDER BY sort_order`));
  const grazing = rowsOf(await db.execute(sql`SELECT *, ends_at AT TIME ZONE 'UTC' AS ends_utc FROM restrictions WHERE application_id = ${id} AND kind = 'grazing'`));
  const unresolved = grazing.length === 0 || grazing.some((r: any) => r.status === 'unresolved');
  const ends = grazing.filter((r: any) => r.ends_utc).map((r: any) => new Date(isoUtc(r.ends_utc)!).getTime());
  const until = !unresolved && ends.length ? new Date(Math.max(...ends)) : null;
  const done = app.status === 'completed' && !app.deleted_at;
  for (const line of lines) {
    if (!done) {
      if (line.record_id) {
        await deleteRecord(farmId, line.record_id);
        await db.execute(sql`UPDATE application_lines SET record_id = NULL WHERE id = ${line.id}`);
      }
      continue;
    }
    const finished = new Date(isoUtc(app.completed_utc)!);
    const details: Record<string, unknown> = {
      products: mix.map((m: any) => ({
        product: m.product_snapshot.name, rate: m.rate != null ? Number(m.rate) : undefined, rateUnit: m.rate_unit,
        activeIngredient: (m.product_snapshot.activeIngredients ?? []).map((a: any) => `${a.concentration ?? ''} ${a.unit ?? ''} ${a.name}`.trim()).join(', ') || undefined,
      })),
      reasonForUse: app.target ?? undefined,
      crop: app.crop ?? undefined,
      applicationMethod: app.equipment ?? undefined,
      waterRate: app.water_rate != null ? Number(app.water_rate) : undefined,
      windDirection: app.wind_direction ?? undefined,
      windSpeed: app.wind_speed != null ? Number(app.wind_speed) : undefined,
      temperature: app.temperature != null ? Number(app.temperature) : undefined,
      operator: app.operator ?? app.contractor ?? undefined,
      operatorCert: app.operator_cert ?? undefined,
      // Days from the finish time; fractional when the label gives hours
      withholdingDays: unresolved ? undefined : until ? round((until.getTime() - finished.getTime()) / 86_400_000, 2) : 0,
      withholdingUntil: until?.toISOString(),
      restrictionUnresolved: unresolved || undefined,
      applicationId: id,
      lineId: line.id,
    };
    const input = {
      type: 'spray' as const,
      title: `${mix.map((m: any) => m.product_snapshot.name).join(' + ')}${line.name ? ` – ${line.name}` : ''}`.slice(0, 255),
      notes: app.notes ?? null,
      occurredAt: finished,
      pastureIds: line.pasture_id ? [line.pasture_id] : [],
      area: line.partial || !line.pasture_id ? line.geometry : null,
      details,
      tags: ['Spray'],
    };
    if (line.record_id) {
      await db.execute(sql`UPDATE farm_records SET deleted_at = NULL WHERE id = ${line.record_id}`);
      await updateRecord(farmId, line.record_id, input);
    } else {
      const { record } = await createRecord(farmId, userId, input, `app-line-${line.id}`);
      await db.execute(sql`UPDATE application_lines SET record_id = ${record.id} WHERE id = ${line.id}`);
    }
  }
}
