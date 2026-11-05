import { sql } from 'drizzle-orm';
import { db } from '../db';
import { MapError, audit, checkShape, geomSql, isoUtc, rowsOf, uuidArray, type Geo } from './farm-map';
import { areaBreakdown } from './exclusions';
import { productSnapshot, touchProduct } from './catalogue';
import { createRecord, updateRecord, deleteRecord } from './records';
import { attachmentsFor, saveAttachments, toApiAttachment } from './attachments';
import { recalcRestrictions, restrictionSummary, saveMix, setMixUsed, sprayDetail, syncSprayRecords, type MixInput } from './sprays';
import { snapshotJob } from './versions';
import { gpsSummary } from './evidence';
import { EXCLUSION_ACTIVITY, activityDetail, checkDetails, isLiquid, runFootprint, syncActivityRecords, type RunInput } from './activities';

// Jobs (applications): one activity over one or more paddocks or parts of them. Each line keeps
// its treated shape, the exclusions taken off, the product as it was then and its rate.
// Planned, delivered (dockets) and applied quantities are kept apart and compared, never
// adjusted to agree. Completed fertiliser lines also appear in Records (for season totals).

export const STATUSES = ['draft', 'planned', 'in_progress', 'completed', 'cancelled'] as const;
export const ACTIVITIES = ['fertiliser', 'spray', 'effluent', 'slurry', 'baleage', 'silage', 'topping', 'mowing'] as const;
export const FERTILISER_UNITS: Record<string, { quantity: string; toKg: number | null }> = {
  'kg/ha': { quantity: 'kg', toKg: 1 },
  't/ha': { quantity: 't', toKg: 1000 },
  'L/ha': { quantity: 'L', toKg: null }, // litres can't become kg without the product's density
};
const NUTRIENTS = ['N', 'P', 'K', 'S', 'Mg', 'Ca'] as const;
const QUANTITY_UNITS: Record<string, number | null> = { kg: 1, t: 1000, L: null };

export interface LineInput {
  pastureId?: string | null;
  geometry?: Geo | null; // part of a paddock (or anywhere); otherwise the whole paddock
  name?: string | null;
  productId?: string | null; // fertiliser lines; spray lines take the job's tank mix
  rate?: number | null;
  rateUnit?: string;
  appliedQuantity?: number | null;
}

export interface ApplicationInput {
  activity?: string;
  status?: typeof STATUSES[number];
  title?: string | null;
  plannedOn?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  evidence?: 'planned' | 'manual' | 'gps';
  planId?: string | null;
  supplier?: string | null;
  contractor?: string | null;
  operator?: string | null;
  equipment?: string | null;
  weather?: string | null;
  notes?: string | null;
  cost?: number | null;
  clientId?: string | null;
  lines?: LineInput[];
  version?: number;
  // Spray jobs
  mix?: MixInput[];
  crop?: string | null;
  target?: string | null;
  waterRate?: number | null;
  tankVolume?: number | null;
  tankLoads?: number | null;
  windSpeed?: number | null;
  windDirection?: string | null;
  temperature?: number | null;
  operatorCert?: string | null;
  // Effluent, slurry, harvest, topping and mowing
  details?: Record<string, unknown>;
  run?: RunInput | null;
  linkedJobId?: string | null;
}

const dayOf = (app: any) =>
  String(app.completed_at ?? app.started_at ?? app.planned_on ?? new Date().toISOString()).slice(0, 10);

async function buildLine(tx: any, farmId: string, app: any, line: LineInput, order: number) {
  let shape: any;
  let boundaryId: string | null = null;
  let partial = false;
  let paddockName: string | null = null;
  if (line.geometry) {
    shape = geomSql(line.geometry, 'area');
    await checkShape(tx, shape, 'area', line.geometry);
    partial = true;
  }
  if (line.pastureId) {
    const [b] = rowsOf(await tx.execute(sql`
      SELECT b.id, ST_AsGeoJSON(b.geom)::json AS g, p.name FROM pastures p
      LEFT JOIN paddock_boundaries b ON b.pasture_id = p.id AND b.valid_to IS NULL
      WHERE p.id = ${line.pastureId} AND p.farm_id = ${farmId} AND p.deleted_at IS NULL`));
    if (!b) throw new MapError('One of those paddocks is not on this farm');
    paddockName = b.name;
    boundaryId = b.id;
    if (!shape) {
      if (!b.g) throw new MapError(`${b.name} has no boundary drawn yet. Draw it on the farm map, or draw the treated area.`);
      shape = geomSql(b.g, 'area');
    }
  }
  if (!shape) throw new MapError('Choose a paddock or draw the area treated');
  if (app.activity !== 'fertiliser') {
    // Exclusions only for activities that apply something; harvest and field work keep the gross area
    const exAct = EXCLUSION_ACTIVITY[app.activity];
    const areas = exAct
      ? await areaBreakdown(tx, farmId, shape, exAct, dayOf(app))
      : { ...(await areaBreakdown(tx, farmId, shape, '__none__', dayOf(app))), excludedHa: 0, exclusions: [] as any[] };
    if (!exAct) areas.netHa = areas.grossHa;
    const [row] = rowsOf(await tx.execute(sql`
      INSERT INTO application_lines (application_id, pasture_id, boundary_id, name, geom, partial, gross_ha, excluded_ha, net_ha,
        exclusions, rate_unit, sort_order)
      VALUES (${app.id}, ${line.pastureId ?? null}, ${boundaryId}, ${line.name ?? (partial && paddockName ? `${paddockName} (part)` : paddockName)},
        (${shape})::geography, ${partial}, ${areas.grossHa}, ${areas.excludedHa}, ${areas.netHa},
        ${JSON.stringify(areas.exclusions)}::jsonb, '', ${order})
      RETURNING id`));
    return row.id as string;
  }
  if (!line.productId) throw new MapError('Choose the product for each paddock');
  const unit = line.rateUnit ?? 'kg/ha';
  if (!FERTILISER_UNITS[unit]) throw new MapError('Choose a rate unit');
  if (line.rate != null && !(line.rate >= 0)) throw new MapError('The rate must be 0 or more');
  const product = await productSnapshot(tx, farmId, line.productId);
  const areas = await areaBreakdown(tx, farmId, shape, app.activity, dayOf(app));
  const planned = line.rate != null ? areas.netHa * line.rate : null;
  const [row] = rowsOf(await tx.execute(sql`
    INSERT INTO application_lines (application_id, pasture_id, boundary_id, name, geom, partial, gross_ha, excluded_ha, net_ha,
      exclusions, product_id, product_version, product_snapshot, rate, rate_unit, planned_quantity, applied_quantity, quantity_unit, sort_order)
    VALUES (${app.id}, ${line.pastureId ?? null}, ${boundaryId}, ${line.name ?? (partial && paddockName ? `${paddockName} (part)` : paddockName)},
      (${shape})::geography, ${partial}, ${areas.grossHa}, ${areas.excludedHa}, ${areas.netHa},
      ${JSON.stringify(areas.exclusions)}::jsonb, ${product.id}, ${product.version}, ${JSON.stringify(product)}::jsonb,
      ${line.rate ?? null}, ${unit}, ${planned}, ${line.appliedQuantity ?? null}, ${FERTILISER_UNITS[unit].quantity}, ${order})
    RETURNING id`));
  await touchProduct(tx, farmId, product.id);
  return row.id as string;
}

async function farmApp(tx: any, farmId: string, id: string) {
  const [app] = rowsOf(await tx.execute(sql`SELECT * FROM applications WHERE id = ${id} AND farm_id = ${farmId} AND deleted_at IS NULL`));
  if (!app) throw new MapError('Job not found', 404);
  return app;
}

function checkSpray(input: ApplicationInput) {
  for (const [v, label] of [[input.waterRate, 'water rate'], [input.tankVolume, 'tank volume'], [input.tankLoads, 'tank loads']] as const) {
    if (v != null && !(v >= 0)) throw new MapError(`The ${label} must be 0 or more`);
  }
  if (input.windSpeed != null && !(input.windSpeed >= 0)) throw new MapError('Wind speed must be 0 or more');
}

function checkTimes(input: ApplicationInput) {
  if (input.status === 'completed' && !input.completedAt) throw new MapError('Enter when the job was done');
  if (input.completedAt && new Date(input.completedAt).getTime() > Date.now() + 10 * 60_000) throw new MapError("The finish time can't be in the future");
  if (input.startedAt && input.completedAt && input.completedAt < input.startedAt) throw new MapError('The finish is before the start');
}

async function withRun(tx: any, activity: string, input: ApplicationInput) {
  if (!input.run) return input;
  if (!isLiquid(activity)) throw new MapError('Only effluent and slurry jobs have an irrigator run');
  const footprint = await runFootprint(tx, input.run);
  const allowed = (input.lines ?? []).map(l => l.pastureId).filter(Boolean) as string[];
  return {
    ...input,
    details: { ...(input.details ?? {}), allowedPastureIds: allowed },
    lines: [{ pastureId: allowed.length === 1 ? allowed[0] : null, geometry: footprint, name: 'Irrigator run (wetted footprint)' }],
  };
}

export async function createApplication(farmId: string, userId: string, input: ApplicationInput) {
  checkTimes(input);
  checkSpray(input);
  if (!input.lines?.length) throw new MapError('Add at least one paddock or area');
  if (input.activity === 'spray' && !input.mix?.length) throw new MapError('Add at least one product to the mix');
  const result = await db.transaction(async tx => {
    if (input.clientId) {
      const [existing] = rowsOf(await tx.execute(sql`SELECT id FROM applications WHERE farm_id = ${farmId} AND client_id = ${input.clientId}`));
      if (existing) return { id: existing.id as string, created: false };
    }
    const activity = input.activity ?? 'fertiliser';
    await checkDetails(tx, farmId, activity, input.details, input.linkedJobId);
    input = await withRun(tx, activity, input);
    const [app] = rowsOf(await tx.execute(sql`
      INSERT INTO applications (farm_id, activity, status, title, planned_on, started_at, completed_at, evidence, plan_id,
        supplier, contractor, operator, equipment, weather, notes, cost, client_id, created_by,
        crop, target, water_rate, tank_volume, tank_loads, wind_speed, wind_direction, temperature, operator_cert,
        details, run_geom, wetted_width_m, drift_m, linked_job_id)
      VALUES (${farmId}, ${input.activity ?? 'fertiliser'}, ${input.status ?? 'draft'}, ${input.title ?? null}, ${input.plannedOn ?? null},
        ${input.startedAt ?? null}, ${input.completedAt ?? null}, ${input.evidence ?? (input.status === 'completed' ? 'manual' : 'planned')},
        ${input.planId ?? null}, ${input.supplier ?? null}, ${input.contractor ?? null}, ${input.operator ?? null}, ${input.equipment ?? null},
        ${input.weather ?? null}, ${input.notes ?? null}, ${input.cost ?? null}, ${input.clientId ?? null}, ${userId},
        ${input.crop ?? null}, ${input.target ?? null}, ${input.waterRate ?? null}, ${input.tankVolume ?? null}, ${input.tankLoads ?? null},
        ${input.windSpeed ?? null}, ${input.windDirection ?? null}, ${input.temperature ?? null}, ${input.operatorCert ?? null},
        ${JSON.stringify(input.details ?? {})}::jsonb, ${input.run ? sql`ST_GeomFromGeoJSON(${JSON.stringify(input.run.geometry)})::geography` : null},
        ${input.run?.wettedWidthM ?? null}, ${input.run ? input.run.driftM ?? 0 : null}, ${input.linkedJobId ?? null})
      RETURNING *`));
    let order = 0;
    for (const line of input.lines!) await buildLine(tx, farmId, app, line, order++);
    if (app.activity === 'spray') {
      await saveMix(tx, farmId, app.id, input.mix!);
      await recalcRestrictions(tx, app.id);
    }
    await audit(tx, farmId, userId, 'application', app.id, 'create', null, { ...input, lines: input.lines!.length });
    return { id: app.id as string, created: true };
  });
  await syncRecords(farmId, userId, result.id);
  return result;
}

export async function updateApplication(farmId: string, userId: string, id: string, input: ApplicationInput) {
  await db.transaction(async tx => {
    const app = await farmApp(tx, farmId, id);
    await snapshotJob(tx, id, userId, 'update');
    if (input.version != null && input.version !== app.version) throw new MapError('This job was changed by someone else since you opened it. Reload to see their change.', 409);
    const merged = {
      status: input.status ?? app.status,
      completedAt: input.completedAt !== undefined ? input.completedAt : app.completed_at?.toISOString?.() ?? app.completed_at,
      startedAt: input.startedAt !== undefined ? input.startedAt : app.started_at?.toISOString?.() ?? app.started_at,
    };
    checkTimes(merged as ApplicationInput);
    checkSpray(input);
    if (input.details !== undefined || input.linkedJobId !== undefined) {
      await checkDetails(tx, farmId, app.activity, input.details ?? app.details, input.linkedJobId !== undefined ? input.linkedJobId : app.linked_job_id, id);
    }
    if (input.run) input = await withRun(tx, app.activity, input);
    else if (input.lines && input.details === undefined && app.run_geom) {
      // New paddocks without a new run: the run is dropped, the paddocks are the treated area
      await tx.execute(sql`UPDATE applications SET run_geom = NULL, wetted_width_m = NULL, drift_m = NULL WHERE id = ${id}`);
    }
    const keep = <K extends keyof ApplicationInput>(k: K, col: string) => (input[k] !== undefined ? input[k] : app[col]);
    const [updated] = rowsOf(await tx.execute(sql`
      UPDATE applications SET
        status = ${merged.status}, title = ${input.title !== undefined ? input.title : app.title},
        planned_on = ${input.plannedOn !== undefined ? input.plannedOn : app.planned_on},
        started_at = ${merged.startedAt ?? null}, completed_at = ${merged.completedAt ?? null},
        evidence = ${input.evidence ?? (merged.status === 'completed' && app.evidence === 'planned' ? 'manual' : app.evidence)},
        supplier = ${input.supplier !== undefined ? input.supplier : app.supplier},
        contractor = ${input.contractor !== undefined ? input.contractor : app.contractor},
        operator = ${input.operator !== undefined ? input.operator : app.operator},
        equipment = ${input.equipment !== undefined ? input.equipment : app.equipment},
        weather = ${input.weather !== undefined ? input.weather : app.weather},
        notes = ${input.notes !== undefined ? input.notes : app.notes},
        cost = ${input.cost !== undefined ? input.cost : app.cost},
        crop = ${keep('crop', 'crop')}, target = ${keep('target', 'target')}, water_rate = ${keep('waterRate', 'water_rate')},
        tank_volume = ${keep('tankVolume', 'tank_volume')}, tank_loads = ${keep('tankLoads', 'tank_loads')},
        wind_speed = ${keep('windSpeed', 'wind_speed')}, wind_direction = ${keep('windDirection', 'wind_direction')},
        temperature = ${keep('temperature', 'temperature')}, operator_cert = ${keep('operatorCert', 'operator_cert')},
        details = ${input.details !== undefined ? sql`${JSON.stringify({ ...(app.details?.allowedPastureIds && !input.run ? { allowedPastureIds: app.details.allowedPastureIds } : {}), ...input.details })}::jsonb` : sql`details`},
        run_geom = ${input.run ? sql`ST_GeomFromGeoJSON(${JSON.stringify(input.run.geometry)})::geography` : sql`run_geom`},
        wetted_width_m = ${input.run ? input.run.wettedWidthM : sql`wetted_width_m`},
        drift_m = ${input.run ? input.run.driftM ?? 0 : sql`drift_m`},
        linked_job_id = ${input.linkedJobId !== undefined ? input.linkedJobId : app.linked_job_id},
        version = version + 1, updated_at = now()
      WHERE id = ${id} RETURNING *`));
    if (input.lines) {
      if (!input.lines.length) throw new MapError('A job needs at least one paddock or area');
      // Records made from the old lines go with them (kept in history, hidden)
      const old = rowsOf(await tx.execute(sql`SELECT record_id FROM application_lines WHERE application_id = ${id} AND record_id IS NOT NULL`));
      await tx.execute(sql`DELETE FROM application_lines WHERE application_id = ${id}`);
      for (const r of old) await tx.execute(sql`UPDATE farm_records SET deleted_at = now() WHERE id = ${r.record_id}`);
      let order = 0;
      for (const line of input.lines) await buildLine(tx, farmId, updated, line, order++);
    }
    if (app.activity === 'spray') {
      if (input.mix) await saveMix(tx, farmId, id, input.mix);
      await recalcRestrictions(tx, id);
    }
    await audit(tx, farmId, userId, 'application', id, 'update',
      { status: app.status, completedAt: app.completed_at }, { ...input, lines: input.lines ? input.lines.length : undefined });
  });
  await syncRecords(farmId, userId, id);
}

/**
 * Enter what was actually applied on each line (from the spreader or contractor), without redoing the lines
 */
export async function setApplied(farmId: string, userId: string, id: string, applied: { lineId: string; quantity: number | null }[]) {
  await db.transaction(async tx => {
    await farmApp(tx, farmId, id);
    await snapshotJob(tx, id, userId, 'applied');
    for (const a of applied) {
      if (a.quantity != null && !(a.quantity >= 0)) throw new MapError('Applied amounts must be 0 or more');
      await tx.execute(sql`UPDATE application_lines SET applied_quantity = ${a.quantity}, updated_at = now() WHERE id = ${a.lineId} AND application_id = ${id}`);
    }
    await tx.execute(sql`UPDATE applications SET version = version + 1, updated_at = now() WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'application', id, 'applied', null, applied);
  });
  await syncRecords(farmId, userId, id);
}

/**
 * What was actually used of each product in a spray mix, and the tank loads
 */
export async function setSprayUsed(farmId: string, userId: string, id: string, input: { tankLoads?: number | null; used: { mixId: string; quantity: number | null; unit: string | null }[] }) {
  await db.transaction(async tx => {
    const app = await farmApp(tx, farmId, id);
    await snapshotJob(tx, id, userId, 'used');
    if (app.activity !== 'spray') throw new MapError('That is not a spray job');
    if (input.tankLoads != null && !(input.tankLoads >= 0)) throw new MapError('Tank loads must be 0 or more');
    await setMixUsed(tx, id, input.used);
    await tx.execute(sql`UPDATE applications SET tank_loads = ${input.tankLoads !== undefined ? input.tankLoads : app.tank_loads},
      version = version + 1, updated_at = now() WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'application', id, 'used', null, input);
  });
  await syncRecords(farmId, userId, id);
}

export async function cancelApplication(farmId: string, userId: string, id: string) {
  await db.transaction(async tx => {
    const app = await farmApp(tx, farmId, id);
    await snapshotJob(tx, id, userId, 'cancel');
    await tx.execute(sql`UPDATE applications SET status = 'cancelled', version = version + 1, updated_at = now() WHERE id = ${id}`);
    await recalcRestrictions(tx, id);
    await audit(tx, farmId, userId, 'application', id, 'cancel', { status: app.status }, null);
  });
  await syncRecords(farmId, userId, id);
}

const toKg = (qty: number | null, unit: string | null) => (qty == null || unit == null || QUANTITY_UNITS[unit] == null ? null : qty * QUANTITY_UNITS[unit]!);

/**
 * Completed fertiliser lines appear in Records (season nitrogen, compliance pack). They follow
 * the job: changed with it, hidden if the job is reopened or cancelled.
 */
async function syncRecords(farmId: string, userId: string, id: string) {
  const [app] = rowsOf(await db.execute(sql`SELECT * FROM applications WHERE id = ${id}`));
  if (app?.activity === 'spray') return syncSprayRecords(farmId, userId, id);
  if (app && app.activity !== 'fertiliser') return syncActivityRecords(farmId, userId, id);
  if (!app || app.activity !== 'fertiliser') return;
  const lines = rowsOf(await db.execute(sql`
    SELECT l.*, ST_AsGeoJSON(l.geom, 7)::json AS geometry FROM application_lines l WHERE l.application_id = ${id} ORDER BY sort_order`));
  const dockets = rowsOf(await db.execute(sql`
    SELECT d.number FROM application_dockets ad JOIN dockets d ON d.id = ad.docket_id WHERE ad.application_id = ${id}`));
  for (const line of lines) {
    if (app.status !== 'completed') {
      if (line.record_id) {
        await deleteRecord(farmId, line.record_id);
        await db.execute(sql`UPDATE application_lines SET record_id = NULL WHERE id = ${line.id}`);
      }
      continue;
    }
    const p = line.product_snapshot;
    const verified = p.verification === 'verified';
    const rateKg = line.rate != null && FERTILISER_UNITS[line.rate_unit]?.toKg != null ? Number(line.rate) * FERTILISER_UNITS[line.rate_unit].toKg! : undefined;
    const appliedKg = toKg(line.applied_quantity != null ? Number(line.applied_quantity) : null, line.quantity_unit);
    const details: Record<string, unknown> = {
      product: p.name,
      rate: rateKg,
      amountApplied: appliedKg ?? undefined,
      amountUnit: appliedKg != null ? 'kg' : undefined,
      // Nutrient % only from a verified analysis; otherwise the season totals leave it out
      ...(verified ? { nPercent: p.analysis.N, pPercent: p.analysis.P, kPercent: p.analysis.K, sPercent: p.analysis.S } : { analysisUnverified: true }),
      applicationMethod: app.equipment ?? undefined,
      applicator: app.contractor ?? app.operator ?? undefined,
      docketNumber: dockets.map(d => d.number).join(', ') || undefined,
      applicationId: id,
      lineId: line.id,
    };
    const input = {
      type: 'fertiliser' as const,
      title: `${p.name}${line.name ? ` – ${line.name}` : ''}`.slice(0, 255),
      notes: app.notes ?? null,
      occurredAt: new Date(isoUtc(app.completed_at)!),
      pastureIds: line.pasture_id ? [line.pasture_id] : [],
      area: line.partial || !line.pasture_id ? line.geometry : null,
      details,
      tags: ['Fertiliser'],
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

/**
 * Planned vs delivered vs applied, per product. Differences are shown, never smoothed over.
 */
function reconcile(lines: any[], dockets: any[]) {
  const byProduct = new Map<string, any>();
  const key = (id: string | null, name: string) => id ?? `name:${name.toLowerCase()}`;
  for (const l of lines) {
    const p = l.productSnapshot;
    const k = key(p.id, p.name);
    const row = byProduct.get(k) ?? { product: p.name, productId: p.id, plannedKg: 0, appliedKg: null as number | null, deliveredKg: null as number | null, unknownUnits: false };
    const planned = toKg(l.plannedQuantity, l.quantityUnit);
    if (planned == null && l.plannedQuantity != null) row.unknownUnits = true;
    row.plannedKg += planned ?? 0;
    const applied = toKg(l.appliedQuantity, l.quantityUnit);
    if (applied != null) row.appliedKg = (row.appliedKg ?? 0) + applied;
    byProduct.set(k, row);
  }
  for (const d of dockets) {
    const k = d.productId ? d.productId : d.productName ? `name:${d.productName.toLowerCase()}` : null;
    const row = k ? byProduct.get(k) : null;
    const kg = toKg(d.allocated ?? d.quantity, d.unit);
    if (row && kg != null) row.deliveredKg = (row.deliveredKg ?? 0) + kg;
  }
  return Array.from(byProduct.values()).map(r => {
    const issues: string[] = [];
    const pct = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 100) : Math.abs(a - b) / b * 100);
    if (r.appliedKg != null && r.plannedKg > 0 && pct(r.appliedKg, r.plannedKg) > 5) issues.push(`Applied is ${pct(r.appliedKg, r.plannedKg).toFixed(0)}% ${r.appliedKg > r.plannedKg ? 'more' : 'less'} than planned`);
    if (r.deliveredKg != null && r.appliedKg != null && pct(r.appliedKg, r.deliveredKg) > 2) issues.push(`Applied and delivered differ by ${Math.abs(r.appliedKg - r.deliveredKg).toFixed(0)} kg`);
    if (r.deliveredKg != null && r.appliedKg == null && r.plannedKg > 0 && pct(r.deliveredKg, r.plannedKg) > 5) issues.push(`Delivered differs from planned by ${Math.abs(r.deliveredKg - r.plannedKg).toFixed(0)} kg`);
    if (r.deliveredKg == null) issues.push('No docket quantity for this product yet');
    return { ...r, issues };
  });
}

/**
 * Nutrient loading from verified analyses only (kg of nutrient, not kg of product)
 */
function nutrients(lines: any[]) {
  const totals: Record<string, number> = Object.fromEntries(NUTRIENTS.map(n => [n, 0]));
  let netHa = 0;
  const notCounted: string[] = [];
  let basis: 'applied' | 'planned' | 'mixed' | null = null;
  for (const l of lines) {
    const p = l.productSnapshot;
    const useApplied = l.appliedQuantity != null;
    const kg = toKg(useApplied ? l.appliedQuantity : l.plannedQuantity, l.quantityUnit);
    const thisBasis = useApplied ? 'applied' : 'planned';
    if (kg == null) { notCounted.push(`${p.name}${l.name ? ` (${l.name})` : ''}: amount not known in kg`); continue; }
    if (p.verification !== 'verified' || NUTRIENTS.some(n => p.analysis?.[n] == null)) { notCounted.push(`${p.name}: analysis not verified`); continue; }
    basis = basis == null ? thisBasis : basis === thisBasis ? basis : 'mixed';
    for (const n of NUTRIENTS) totals[n] += kg * Number(p.analysis[n]) / 100;
    netHa += Number(l.netHa ?? 0);
  }
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    basis,
    kg: Object.fromEntries(NUTRIENTS.map(n => [n, round(totals[n])])),
    perHa: netHa > 0 ? Object.fromEntries(NUTRIENTS.map(n => [n, round(totals[n] / netHa)])) : null,
    netHa: Math.round(netHa * 1000) / 1000,
    notCounted,
  };
}

export async function getApplication(farmId: string, id: string) {
  const [app] = rowsOf(await db.execute(sql`
    SELECT a.*, a.started_at AT TIME ZONE 'UTC' AS started_utc, a.completed_at AT TIME ZONE 'UTC' AS completed_utc,
      u.name AS created_by_name FROM applications a LEFT JOIN users u ON u.id = a.created_by
    WHERE a.id = ${id} AND a.farm_id = ${farmId} AND a.deleted_at IS NULL`));
  if (!app) throw new MapError('Job not found', 404);
  const lines = rowsOf(await db.execute(sql`
    SELECT id, pasture_id AS "pastureId", boundary_id AS "boundaryId", name, partial, gross_ha::float AS "grossHa",
      excluded_ha::float AS "excludedHa", net_ha::float AS "netHa", exclusions, product_id AS "productId",
      product_version AS "productVersion", product_snapshot AS "productSnapshot", rate::float, rate_unit AS "rateUnit",
      planned_quantity::float AS "plannedQuantity", applied_quantity::float AS "appliedQuantity", quantity_unit AS "quantityUnit",
      record_id AS "recordId", ST_AsGeoJSON(geom, 7)::json AS geometry
    FROM application_lines WHERE application_id = ${id} ORDER BY sort_order`));
  const dockets = await docketsFor(farmId, [id]);
  const ds = dockets.get(id) ?? [];
  return {
    id: app.id, activity: app.activity, status: app.status, title: app.title, plannedOn: app.planned_on ? String(app.planned_on).slice(0, 10) : null,
    startedAt: isoUtc(app.started_utc), completedAt: isoUtc(app.completed_utc), evidence: app.evidence, planId: app.plan_id,
    supplier: app.supplier, contractor: app.contractor, operator: app.operator, equipment: app.equipment,
    weather: app.weather, notes: app.notes, cost: app.cost != null ? Number(app.cost) : null, version: app.version,
    createdBy: app.created_by_name, createdAt: app.created_at, updatedAt: app.updated_at,
    linkedJobId: app.linked_job_id, sharedWith: app.shared_with ?? [],
    gps: app.gps_geom ? await gpsSummary(id) : null,
    ...(app.activity === 'spray'
      ? { lines, dockets: ds, spray: await sprayDetail(farmId, app, lines), reconciliation: [], nutrients: null, work: null }
      : app.activity === 'fertiliser'
        ? { lines, dockets: ds, reconciliation: reconcile(lines, ds), nutrients: nutrients(lines), spray: null, work: null }
        : { lines, dockets: ds, reconciliation: [], nutrients: null, spray: null, work: await activityDetail(farmId, app, lines) }),
  };
}

export async function listApplications(farmId: string, opts: { activity?: string; status?: string; from?: string; to?: string; pastureId?: string; sharedWith?: string }) {
  return rowsOf(await db.execute(sql`
    SELECT a.id, a.activity, a.status, a.title, a.planned_on::text AS "plannedOn", a.completed_at AT TIME ZONE 'UTC' AS "completedAt", a.evidence,
      a.contractor, a.supplier, a.target, a.details, a.linked_job_id AS "linkedJobId", a.shared_with AS "sharedWith", (a.gps_geom IS NOT NULL) AS "hasGps",
      COALESCE((SELECT string_agg(DISTINCT l.product_snapshot->>'name', ', ') FROM application_lines l WHERE l.application_id = a.id),
        (SELECT string_agg(m.product_snapshot->>'name', ' + ' ORDER BY m.sort_order) FROM application_mix m WHERE m.application_id = a.id)) AS products,
      (SELECT json_agg(json_build_object('kind', r.kind, 'status', r.status, 'endsAt', r.ends_at AT TIME ZONE 'UTC'))
       FROM restrictions r WHERE r.application_id = a.id) AS restrictions,
      (SELECT sum(l.net_ha)::float FROM application_lines l WHERE l.application_id = a.id) AS "netHa",
      (SELECT count(*)::int FROM application_dockets d WHERE d.application_id = a.id) AS dockets,
      (SELECT json_agg(json_build_object('id', l.id, 'name', l.name, 'pastureId', l.pasture_id, 'status', a.status,
          'product', l.product_snapshot->>'name', 'rate', l.rate, 'rateUnit', l.rate_unit, 'geometry', ST_AsGeoJSON(l.geom, 7)::json))
       FROM application_lines l WHERE l.application_id = a.id) AS lines
    FROM applications a
    WHERE a.farm_id = ${farmId} AND a.deleted_at IS NULL
      AND (${opts.activity ?? null}::text IS NULL OR a.activity = ${opts.activity ?? null})
      AND (${opts.status ?? null}::text IS NULL OR a.status = ${opts.status ?? null})
      AND (${opts.from ?? null}::date IS NULL OR COALESCE(a.completed_at::date, a.planned_on, a.created_at::date) >= ${opts.from ?? null}::date)
      AND (${opts.to ?? null}::date IS NULL OR COALESCE(a.completed_at::date, a.planned_on, a.created_at::date) <= ${opts.to ?? null}::date)
      AND (${opts.sharedWith ?? null}::uuid IS NULL OR ${opts.sharedWith ?? null}::uuid = ANY(a.shared_with))
      AND (${opts.pastureId ?? null}::uuid IS NULL OR EXISTS (SELECT 1 FROM application_lines l WHERE l.application_id = a.id AND l.pasture_id = ${opts.pastureId ?? null}::uuid))
    ORDER BY COALESCE(a.completed_at, a.planned_on::timestamp, a.created_at) DESC
    LIMIT 300`)).map((j: any) => {
    const rs = (j.restrictions ?? []).map((r: any) => ({
      kind: r.kind, endsAt: isoUtc(r.endsAt),
      state: j.status !== 'completed' ? 'not_started' : r.status === 'unresolved' ? 'unresolved' : r.status === 'not_applicable' ? 'not_applicable'
        : new Date(r.endsAt).getTime() > Date.now() ? 'active' : 'ended',
    }));
    const { restrictions: _r, ...rest } = j;
    return { ...rest, completedAt: isoUtc(j.completedAt), restriction: j.activity === 'spray' ? restrictionSummary(rs) : null };
  });
}

// ===== Dockets =====

export interface DocketInput {
  number: string;
  supplier?: string | null;
  docketDate?: string | null;
  productId?: string | null;
  productName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  cost?: number | null;
  notes?: string | null;
}

async function docketsFor(farmId: string, appIds: string[]) {
  const map = new Map<string, any[]>();
  if (appIds.length === 0) return map;
  const rows = rowsOf(await db.execute(sql`
    SELECT ad.application_id, ad.quantity::float AS allocated, d.id, d.number, d.supplier, d.docket_date::text AS "docketDate",
      d.product_id AS "productId", d.product_name AS "productName", d.quantity::float AS quantity, d.unit, d.cost::float AS cost, d.notes
    FROM application_dockets ad JOIN dockets d ON d.id = ad.docket_id
    WHERE ad.application_id = ANY(${uuidArray(appIds)}) AND d.farm_id = ${farmId}`));
  const files = await attachmentsFor('docket', rows.map(r => r.id));
  for (const r of rows) {
    const list = map.get(r.application_id) ?? [];
    list.push({ ...r, application_id: undefined, attachments: (files.get(r.id) ?? []).map(toApiAttachment) });
    map.set(r.application_id, list);
  }
  return map;
}

export async function createDocket(farmId: string, userId: string, input: DocketInput, files: Express.Multer.File[]) {
  if (input.quantity != null && !(input.quantity >= 0)) throw new MapError('The docket quantity must be 0 or more');
  const [row] = rowsOf(await db.execute(sql`
    INSERT INTO dockets (farm_id, number, supplier, docket_date, product_id, product_name, quantity, unit, cost, notes, created_by)
    VALUES (${farmId}, ${input.number}, ${input.supplier ?? null}, ${input.docketDate ?? null}, ${input.productId ?? null},
      ${input.productName ?? null}, ${input.quantity ?? null}, ${input.unit ?? null}, ${input.cost ?? null}, ${input.notes ?? null}, ${userId})
    RETURNING id`));
  if (files.length) await saveAttachments(farmId, 'docket', row.id, files, userId, { takenAt: input.docketDate ? new Date(input.docketDate) : new Date() });
  await audit(db, farmId, userId, 'docket', row.id, 'create', null, input);
  return { id: row.id as string };
}

export async function linkDocket(farmId: string, userId: string, appId: string, docketId: string, quantity: number | null) {
  await db.transaction(async tx => {
    await farmApp(tx, farmId, appId);
    await snapshotJob(tx, appId, userId, 'docket attached');
    const [d] = rowsOf(await tx.execute(sql`SELECT id FROM dockets WHERE id = ${docketId} AND farm_id = ${farmId} AND archived_at IS NULL`));
    if (!d) throw new MapError('Docket not found', 404);
    await tx.execute(sql`
      INSERT INTO application_dockets (application_id, docket_id, quantity) VALUES (${appId}, ${docketId}, ${quantity})
      ON CONFLICT (application_id, docket_id) DO UPDATE SET quantity = EXCLUDED.quantity`);
    await audit(tx, farmId, userId, 'application', appId, 'docket_link', null, { docketId, quantity });
    await tx.execute(sql`UPDATE applications SET version = version + 1, updated_at = now() WHERE id = ${appId}`);
  });
  await syncRecords(farmId, userId, appId);
}

export async function unlinkDocket(farmId: string, userId: string, appId: string, docketId: string) {
  await db.transaction(async tx => {
    await farmApp(tx, farmId, appId);
    await snapshotJob(tx, appId, userId, 'docket removed');
    await tx.execute(sql`DELETE FROM application_dockets WHERE application_id = ${appId} AND docket_id = ${docketId}`);
    await audit(tx, farmId, userId, 'application', appId, 'docket_unlink', { docketId }, null);
    await tx.execute(sql`UPDATE applications SET version = version + 1, updated_at = now() WHERE id = ${appId}`);
  });
  await syncRecords(farmId, userId, appId);
}

export async function searchDockets(farmId: string, q: string) {
  const like = `%${q.trim().toLowerCase()}%`;
  const rows = rowsOf(await db.execute(sql`
    SELECT d.id, d.number, d.supplier, d.docket_date::text AS "docketDate", d.product_name AS "productName", d.quantity::float, d.unit,
      (SELECT count(*)::int FROM application_dockets ad WHERE ad.docket_id = d.id) AS jobs
    FROM dockets d WHERE d.farm_id = ${farmId} AND d.archived_at IS NULL
      AND (lower(d.number) LIKE ${like} OR lower(COALESCE(d.supplier, '')) LIKE ${like} OR lower(COALESCE(d.product_name, '')) LIKE ${like})
    ORDER BY d.created_at DESC LIMIT 30`));
  return rows;
}
