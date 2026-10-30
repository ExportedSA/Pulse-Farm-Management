import { sql } from 'drizzle-orm';
import { db } from '../db';
import { MapError, audit, checkShape, geomSql, rowsOf, uuidArray, type Geo } from './farm-map';
import { activeExclusions } from './exclusions';

// Variable-rate plans: zones within paddocks, each with its own product and rate. Each zone's
// net area (after exclusions) times its rate gives the quantity to apply. Gaps and overlaps
// are found before a plan can be approved; an approved plan is frozen, including the
// exclusions and boundary versions it was worked out with.

export const PLAN_ACTIVITIES = ['fertiliser', 'effluent', 'slurry', 'spraying'] as const;
export const RATE_UNITS: Record<string, string> = {
  'kg/ha': 'kg', 't/ha': 't', 'g/ha': 'g', 'L/ha': 'L', 'mL/ha': 'mL', 'm3/ha': 'm3',
};

// Smaller than this is treated as drawing slack, not a real gap or overlap
const SLIVER_M2 = 1;
const GAP_HA = 0.01;

const planDate = (plan: any) => (plan.planned_on ? String(plan.planned_on).slice(0, 10) : new Date().toISOString().slice(0, 10));

async function farmPlan(tx: any, farmId: string, id: string) {
  const [plan] = rowsOf(await tx.execute(sql`SELECT *, planned_on::text AS planned_on FROM rate_plans WHERE id = ${id} AND farm_id = ${farmId}`));
  if (!plan) throw new MapError('Plan not found', 404);
  return plan;
}

function editable(plan: any) {
  if (plan.status !== 'draft') throw new MapError(`This plan is ${plan.status}. Copy it to a new draft to change it.`, 409);
}

async function checkPaddocks(tx: any, farmId: string, ids: string[]) {
  if (ids.length === 0) return;
  const rows = rowsOf(await tx.execute(sql`SELECT id FROM pastures WHERE farm_id = ${farmId} AND deleted_at IS NULL AND id = ANY(${uuidArray(ids)})`));
  if (rows.length !== new Set(ids).size) throw new MapError('One of those paddocks is not on this farm');
}

export async function createPlan(farmId: string, userId: string, input: { name: string; activity: string; plannedOn?: string | null; pastureIds: string[]; notes?: string | null }) {
  return db.transaction(async tx => {
    await checkPaddocks(tx, farmId, input.pastureIds);
    const [row] = rowsOf(await tx.execute(sql`
      INSERT INTO rate_plans (farm_id, name, activity, planned_on, pasture_ids, notes, created_by)
      VALUES (${farmId}, ${input.name}, ${input.activity}, ${input.plannedOn ?? null},
              ${input.pastureIds.length ? uuidArray(input.pastureIds) : sql`'{}'::uuid[]`}, ${input.notes ?? null}, ${userId})
      RETURNING id`));
    await audit(tx, farmId, userId, 'rate_plan', row.id, 'create', null, input);
    return { id: row.id as string };
  });
}

export async function updatePlan(farmId: string, userId: string, id: string, input: { name?: string; activity?: string; plannedOn?: string | null; pastureIds?: string[]; notes?: string | null }) {
  return db.transaction(async tx => {
    const plan = await farmPlan(tx, farmId, id);
    editable(plan);
    if (input.pastureIds) await checkPaddocks(tx, farmId, input.pastureIds);
    await tx.execute(sql`
      UPDATE rate_plans SET name = ${input.name ?? plan.name}, activity = ${input.activity ?? plan.activity},
        planned_on = ${input.plannedOn !== undefined ? input.plannedOn : plan.planned_on},
        pasture_ids = ${input.pastureIds ? (input.pastureIds.length ? uuidArray(input.pastureIds) : sql`'{}'::uuid[]`) : sql`pasture_ids`},
        notes = ${input.notes !== undefined ? input.notes : plan.notes}, updated_at = now()
      WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'rate_plan', id, 'update', { name: plan.name, activity: plan.activity, plannedOn: plan.planned_on }, input);
  });
}

/**
 * Work out every zone's gross, excluded and net hectares and quantity (drafts only)
 */
async function recalc(tx: any, farmId: string, plan: any) {
  await tx.execute(sql`
    WITH z AS (
      SELECT rz.id, rz.geom::geometry AS g, rz.rate, rz.rate_unit,
        (SELECT ST_Union(e.geom::geometry) FROM exclusions e
         WHERE e.farm_id = ${farmId} AND ${activeExclusions(plan.activity, planDate(plan))} AND ST_Intersects(e.geom::geometry, rz.geom::geometry)) AS ex
      FROM rate_zones rz WHERE rz.plan_id = ${plan.id}
    ), a AS (
      SELECT id, rate, rate_unit, ST_Area(g::geography) / 10000 AS gross,
        COALESCE(ST_Area(ST_Intersection(g, ex)::geography) / 10000, 0) AS excluded
      FROM z
    )
    UPDATE rate_zones rz SET
      gross_ha = a.gross, excluded_ha = a.excluded, net_ha = GREATEST(a.gross - a.excluded, 0),
      quantity = CASE WHEN a.rate IS NULL THEN NULL ELSE GREATEST(a.gross - a.excluded, 0) * a.rate END,
      quantity_unit = ${sql.raw(`CASE a.rate_unit ${Object.entries(RATE_UNITS).map(([k, v]) => `WHEN '${k}' THEN '${v}'`).join(' ')} END`)}
    FROM a WHERE rz.id = a.id`);
}

/**
 * Gaps (planned paddocks, after exclusions, not covered by a zone), overlaps between zones,
 * and zone parts outside the planned paddocks
 */
async function check(tx: any, farmId: string, plan: any) {
  const overlaps = rowsOf(await tx.execute(sql`
    SELECT a.id AS a, b.id AS b, COALESCE(a.name, 'Zone') AS a_name, COALESCE(b.name, 'Zone') AS b_name,
      ST_Area(ST_Intersection(a.geom::geometry, b.geom::geometry)::geography) / 10000 AS ha,
      ST_AsGeoJSON(ST_CollectionExtract(ST_Intersection(a.geom::geometry, b.geom::geometry), 3), 7)::json AS geometry
    FROM rate_zones a JOIN rate_zones b ON a.plan_id = b.plan_id AND a.id < b.id
    WHERE a.plan_id = ${plan.id} AND ST_Intersects(a.geom::geometry, b.geom::geometry)
      AND ST_Area(ST_Intersection(a.geom::geometry, b.geom::geometry)::geography) > ${SLIVER_M2}`));
  let gap = { ha: 0, geometry: null as any };
  let outside = { ha: 0, geometry: null as any };
  if (plan.pasture_ids?.length) {
    const ids = typeof plan.pasture_ids === 'string' ? plan.pasture_ids.replace(/[{}]/g, '').split(',').filter(Boolean) : plan.pasture_ids;
    const [g] = rowsOf(await tx.execute(sql`
      WITH pad AS (SELECT ST_Union(geom::geometry) AS g FROM paddock_boundaries WHERE pasture_id = ANY(${uuidArray(ids)}) AND valid_to IS NULL),
           ex AS (SELECT ST_Union(geom::geometry) AS g FROM exclusions e WHERE e.farm_id = ${farmId} AND ${activeExclusions(plan.activity, planDate(plan))}),
           zs AS (SELECT ST_Union(geom::geometry) AS g FROM rate_zones WHERE plan_id = ${plan.id}),
           need AS (SELECT CASE WHEN ex.g IS NULL THEN pad.g ELSE ST_Difference(pad.g, ex.g) END AS g FROM pad, ex),
           gap AS (SELECT CASE WHEN zs.g IS NULL THEN need.g ELSE ST_Difference(need.g, zs.g) END AS g FROM need, zs),
           outside AS (SELECT CASE WHEN zs.g IS NULL OR pad.g IS NULL THEN NULL ELSE ST_Difference(zs.g, pad.g) END AS g FROM zs, pad)
      SELECT COALESCE(ST_Area(gap.g::geography) / 10000, 0) AS gap_ha, ST_AsGeoJSON(ST_CollectionExtract(gap.g, 3), 7)::json AS gap_geom,
             COALESCE(ST_Area(outside.g::geography) / 10000, 0) AS out_ha, ST_AsGeoJSON(ST_CollectionExtract(outside.g, 3), 7)::json AS out_geom
      FROM gap, outside`));
    if (g) {
      gap = { ha: Number(g.gap_ha), geometry: Number(g.gap_ha) > 0 ? g.gap_geom : null };
      outside = { ha: Number(g.out_ha), geometry: Number(g.out_ha) * 10000 > SLIVER_M2 ? g.out_geom : null };
    }
  }
  return {
    overlaps: overlaps.map(o => ({ zones: [o.a, o.b], names: `${o.a_name} and ${o.b_name}`, ha: Number(o.ha), geometry: o.geometry })),
    gapHa: gap.ha,
    gapGeometry: gap.ha >= GAP_HA ? gap.geometry : null,
    hasGaps: gap.ha >= GAP_HA,
    outsideHa: outside.ha,
    outsideGeometry: outside.geometry,
  };
}

export async function getPlan(farmId: string, id: string) {
  return db.transaction(async tx => {
    const plan = await farmPlan(tx, farmId, id);
    if (plan.status === 'draft') await recalc(tx, farmId, plan);
    const zones = rowsOf(await tx.execute(sql`
      SELECT id, pasture_id AS "pastureId", name, product_name AS "productName", product_id AS "productId",
        rate::float, rate_unit AS "rateUnit", gross_ha::float AS "grossHa", excluded_ha::float AS "excludedHa",
        net_ha::float AS "netHa", quantity::float, quantity_unit AS "quantityUnit", sort_order AS "sortOrder",
        ST_AsGeoJSON(geom, 7)::json AS geometry
      FROM rate_zones WHERE plan_id = ${id} ORDER BY sort_order, created_at`));
    // Totals per product and unit (kg of product, not of nutrient)
    const totals = new Map<string, { product: string; unit: string; quantity: number; netHa: number }>();
    for (const z of zones) {
      if (z.quantity == null) continue;
      const key = `${z.productName ?? 'No product'}|${z.quantityUnit}`;
      const t = totals.get(key) ?? { product: z.productName ?? 'No product', unit: z.quantityUnit, quantity: 0, netHa: 0 };
      t.quantity += Number(z.quantity);
      t.netHa += Number(z.netHa);
      totals.set(key, t);
    }
    return {
      id: plan.id, name: plan.name, activity: plan.activity, status: plan.status, plannedOn: plan.planned_on,
      pastureIds: plan.pasture_ids, notes: plan.notes, approvedAt: plan.approved_at, snapshot: plan.snapshot,
      zones, totals: Array.from(totals.values()),
      check: plan.status === 'draft' ? await check(tx, farmId, plan) : null,
    };
  });
}

export async function listPlans(farmId: string) {
  return rowsOf(await db.execute(sql`
    SELECT p.id, p.name, p.activity, p.status, p.planned_on::text AS "plannedOn", p.approved_at AS "approvedAt",
      (SELECT count(*)::int FROM rate_zones z WHERE z.plan_id = p.id) AS zones
    FROM rate_plans p WHERE p.farm_id = ${farmId} AND p.status <> 'cancelled'
    ORDER BY p.created_at DESC`));
}

export interface ZoneInput {
  geometry?: Geo | null;
  wholePaddockId?: string | null;
  name?: string | null;
  productName?: string | null;
  productId?: string | null;
  rate?: number | null;
  rateUnit?: string;
}

async function zoneShape(tx: any, farmId: string, input: ZoneInput) {
  if (input.wholePaddockId) {
    const [b] = rowsOf(await tx.execute(sql`
      SELECT ST_AsGeoJSON(b.geom)::json AS g, p.name FROM paddock_boundaries b JOIN pastures p ON p.id = b.pasture_id
      WHERE b.pasture_id = ${input.wholePaddockId} AND b.valid_to IS NULL AND p.farm_id = ${farmId}`));
    if (!b) throw new MapError('That paddock has no boundary yet');
    return { shape: geomSql(b.g, 'area'), pastureId: input.wholePaddockId, defaultName: b.name as string };
  }
  if (!input.geometry) throw new MapError('Draw the zone, or use a whole paddock');
  const shape = geomSql(input.geometry, 'area');
  await checkShape(tx, shape, 'area', input.geometry);
  // The paddock it's mostly in
  const [p] = rowsOf(await tx.execute(sql`
    SELECT b.pasture_id FROM paddock_boundaries b JOIN pastures p ON p.id = b.pasture_id
    WHERE p.farm_id = ${farmId} AND b.valid_to IS NULL AND ST_Intersects(b.geom::geometry, (${shape}))
    ORDER BY ST_Area(ST_Intersection(b.geom::geometry, (${shape}))::geography) DESC LIMIT 1`));
  return { shape, pastureId: (p?.pasture_id as string) ?? null, defaultName: null };
}

function checkRate(input: ZoneInput) {
  if (input.rate != null && (!(input.rate >= 0) || input.rate > 1e6)) throw new MapError('Enter a rate of 0 or more');
  if (input.rateUnit && !RATE_UNITS[input.rateUnit]) throw new MapError('Choose a rate unit');
}

export async function addZone(farmId: string, userId: string, planId: string, input: ZoneInput) {
  checkRate(input);
  return db.transaction(async tx => {
    const plan = await farmPlan(tx, farmId, planId);
    editable(plan);
    const { shape, pastureId, defaultName } = await zoneShape(tx, farmId, input);
    const [row] = rowsOf(await tx.execute(sql`
      INSERT INTO rate_zones (plan_id, pasture_id, name, geom, product_name, product_id, rate, rate_unit, sort_order)
      VALUES (${planId}, ${pastureId}, ${input.name ?? defaultName}, (${shape})::geography, ${input.productName ?? null},
              ${input.productId ?? null}, ${input.rate ?? null}, ${input.rateUnit ?? 'kg/ha'},
              (SELECT COALESCE(max(sort_order), 0) + 1 FROM rate_zones WHERE plan_id = ${planId}))
      RETURNING id`));
    if (pastureId && !(plan.pasture_ids ?? []).includes(pastureId)) {
      await tx.execute(sql`UPDATE rate_plans SET pasture_ids = array_append(pasture_ids, ${pastureId}::uuid) WHERE id = ${planId} AND NOT (${pastureId}::uuid = ANY(pasture_ids))`);
    }
    await tx.execute(sql`UPDATE rate_plans SET updated_at = now() WHERE id = ${planId}`);
    await audit(tx, farmId, userId, 'rate_zone', row.id, 'create', null, { planId, ...input, geometry: input.geometry ? 'drawn' : undefined });
    return { id: row.id as string };
  });
}

async function zonePlan(tx: any, farmId: string, zoneId: string) {
  const [z] = rowsOf(await tx.execute(sql`
    SELECT z.*, p.status, p.farm_id FROM rate_zones z JOIN rate_plans p ON p.id = z.plan_id
    WHERE z.id = ${zoneId} AND p.farm_id = ${farmId}`));
  if (!z) throw new MapError('Zone not found', 404);
  editable(z);
  return z;
}

export async function updateZone(farmId: string, userId: string, zoneId: string, input: ZoneInput) {
  checkRate(input);
  return db.transaction(async tx => {
    const z = await zonePlan(tx, farmId, zoneId);
    let geomSet = sql`geom`;
    if (input.geometry) {
      const shape = geomSql(input.geometry, 'area');
      await checkShape(tx, shape, 'area', input.geometry);
      geomSet = sql`(${shape})::geography`;
    }
    await tx.execute(sql`
      UPDATE rate_zones SET name = ${input.name !== undefined ? input.name : z.name},
        product_name = ${input.productName !== undefined ? input.productName : z.product_name},
        product_id = ${input.productId !== undefined ? input.productId : z.product_id},
        rate = ${input.rate !== undefined ? input.rate : z.rate}, rate_unit = ${input.rateUnit ?? z.rate_unit},
        geom = ${geomSet}, updated_at = now()
      WHERE id = ${zoneId}`);
    await audit(tx, farmId, userId, 'rate_zone', zoneId, 'update',
      { name: z.name, productName: z.product_name, rate: z.rate, rateUnit: z.rate_unit }, { ...input, geometry: input.geometry ? 'redrawn' : undefined });
  });
}

export async function deleteZone(farmId: string, userId: string, zoneId: string) {
  return db.transaction(async tx => {
    const z = await zonePlan(tx, farmId, zoneId);
    await tx.execute(sql`DELETE FROM rate_zones WHERE id = ${zoneId}`);
    await audit(tx, farmId, userId, 'rate_zone', zoneId, 'delete', { name: z.name, rate: z.rate }, null);
  });
}

/**
 * Approve a draft: no overlapping zones, every zone has a product and rate, and gaps are
 * either fixed or accepted. The exclusions and boundaries used are saved with it.
 */
export async function approvePlan(farmId: string, userId: string, id: string, acceptGaps: boolean) {
  return db.transaction(async tx => {
    const plan = await farmPlan(tx, farmId, id);
    editable(plan);
    await recalc(tx, farmId, plan);
    const zones = rowsOf(await tx.execute(sql`SELECT id, name, product_name, rate FROM rate_zones WHERE plan_id = ${id}`));
    if (zones.length === 0) throw new MapError('Add at least one zone first');
    const missing = zones.filter(z => !z.product_name || z.rate == null);
    if (missing.length) throw new MapError(`Give every zone a product and rate (${missing.map(z => z.name ?? 'zone').join(', ')})`);
    const result = await check(tx, farmId, plan);
    if (result.overlaps.length) throw new MapError(`Zones overlap: ${result.overlaps.map(o => `${o.names} (${o.ha.toFixed(3)} ha)`).join('; ')}. Fix them before approving.`, 409);
    if (result.hasGaps && !acceptGaps) throw new MapError(`${result.gapHa.toFixed(2)} ha of the planned paddocks has no zone. Add a zone, or approve with the gap.`, 409);
    const used = rowsOf(await tx.execute(sql`
      SELECT e.id, e.name, e.version, e.buffer_m::float AS "bufferM", e.activities, e.requirement_source AS source,
        ST_AsGeoJSON(e.geom, 7)::json AS geometry
      FROM exclusions e WHERE e.farm_id = ${farmId} AND ${activeExclusions(plan.activity, planDate(plan))}
        AND EXISTS (SELECT 1 FROM rate_zones z WHERE z.plan_id = ${id} AND ST_Intersects(z.geom::geometry, e.geom::geometry))`));
    const ids = typeof plan.pasture_ids === 'string' ? plan.pasture_ids.replace(/[{}]/g, '').split(',').filter(Boolean) : plan.pasture_ids ?? [];
    const boundaries = ids.length ? rowsOf(await tx.execute(sql`
      SELECT pasture_id AS "pastureId", id AS "boundaryId", area_ha::float AS "areaHa" FROM paddock_boundaries
      WHERE pasture_id = ANY(${uuidArray(ids)}) AND valid_to IS NULL`)) : [];
    const snapshot = { exclusions: used, boundaries, gapHa: result.gapHa, approvedWithGap: result.hasGaps, onDate: planDate(plan) };
    await tx.execute(sql`
      UPDATE rate_plans SET status = 'approved', approved_by = ${userId}, approved_at = now(),
        snapshot = ${JSON.stringify(snapshot)}::jsonb, updated_at = now() WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'rate_plan', id, 'approve', null, { exclusions: used.length, gapHa: result.gapHa });
  });
}

export async function copyPlan(farmId: string, userId: string, id: string) {
  return db.transaction(async tx => {
    const plan = await farmPlan(tx, farmId, id);
    const [row] = rowsOf(await tx.execute(sql`
      INSERT INTO rate_plans (farm_id, name, activity, planned_on, pasture_ids, notes, created_by)
      SELECT farm_id, left(name || ' (copy)', 120), activity, planned_on, pasture_ids, notes, ${userId}
      FROM rate_plans WHERE id = ${plan.id}
      RETURNING id`));
    await tx.execute(sql`
      INSERT INTO rate_zones (plan_id, pasture_id, name, geom, product_name, product_id, rate, rate_unit, sort_order)
      SELECT ${row.id}, pasture_id, name, geom, product_name, product_id, rate, rate_unit, sort_order FROM rate_zones WHERE plan_id = ${id}`);
    await audit(tx, farmId, userId, 'rate_plan', row.id, 'copy', { from: id }, null);
    return { id: row.id as string };
  });
}

export async function cancelPlan(farmId: string, userId: string, id: string) {
  return db.transaction(async tx => {
    const plan = await farmPlan(tx, farmId, id);
    if (plan.status === 'cancelled') return;
    await tx.execute(sql`UPDATE rate_plans SET status = 'cancelled', updated_at = now() WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'rate_plan', id, 'cancel', { status: plan.status }, null);
  });
}
