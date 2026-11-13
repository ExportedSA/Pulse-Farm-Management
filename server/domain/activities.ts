import { sql } from 'drizzle-orm';
import { db } from '../db';
import { MapError, isoUtc, rowsOf, uuidArray } from './farm-map';
import { activeExclusions } from './exclusions';
import { createRecord, updateRecord, deleteRecord } from './records';

// Effluent, slurry, baleage, silage, topping and mowing jobs. Their own fields are in
// applications.details. Rules from the brief:
// - A fast/slow machine setting is not a measured depth. Depth and rate come only from a volume
//   over the treated area, or from a documented calibration.
// - 1 mm over 1 ha = 10 m³.
// - Unknown nutrient concentrations stay unknown: no nitrogen without an entered analysis.
// - Fresh tonnes and dry-matter tonnes are kept apart; anything built on an estimate says so.
// - Mowing for feed is the cut of one baleage or silage job, never a second completed operation.

export const LIQUID = ['effluent', 'slurry'] as const;
export const HARVEST = ['baleage', 'silage'] as const;
export const FIELD_WORK = ['topping', 'mowing'] as const;
const M3_PER_MM_HA = 10;

export const isLiquid = (a: string) => (LIQUID as readonly string[]).includes(a);
export const isHarvest = (a: string) => (HARVEST as readonly string[]).includes(a);

// Exclusions that apply to the activity (none for harvest and field work: nothing is applied)
export const EXCLUSION_ACTIVITY: Record<string, string | null> = {
  fertiliser: 'fertiliser', spray: 'spraying', effluent: 'effluent', slurry: 'slurry',
  baleage: null, silage: null, topping: null, mowing: null,
};

export interface RunInput { geometry: { type: 'LineString'; coordinates: number[][] }; wettedWidthM: number; driftM?: number | null }

/**
 * A travelling irrigator's run becomes its wetted footprint (the run buffered by half the wetted
 * width). That's the treated area. The drift allowance is only used for the boundary check.
 */
export async function runFootprint(tx: any, run: RunInput) {
  if (run.geometry?.type !== 'LineString' || run.geometry.coordinates.length < 2) throw new MapError('Draw the run as a line with at least two points');
  if (!(run.wettedWidthM > 0)) throw new MapError('Enter the wetted width in metres');
  if (run.driftM != null && !(run.driftM >= 0)) throw new MapError('The drift allowance must be 0 or more');
  const [r] = rowsOf(await tx.execute(sql`
    SELECT ST_AsGeoJSON(ST_Multi(ST_Buffer(ST_GeomFromGeoJSON(${JSON.stringify(run.geometry)})::geography, ${run.wettedWidthM / 2})::geometry), 7)::json AS g`));
  return r.g;
}

/**
 * Check a job's details against its activity, and work out the mowing link
 */
export async function checkDetails(tx: any, farmId: string, activity: string, details: any, linkedJobId: string | null | undefined, selfId?: string) {
  const d = details ?? {};
  const nonNeg = (v: unknown, label: string) => { if (v != null && !(Number(v) >= 0)) throw new MapError(`${label} must be 0 or more`); };
  if (isLiquid(activity)) {
    nonNeg(d.volumeM3, 'Volume'); nonNeg(d.loads, 'Loads'); nonNeg(d.loadSizeM3, 'Load size');
    if (d.calibration && (!(Number(d.calibration.depthMm) > 0) || !String(d.calibration.reference ?? '').trim())) {
      throw new MapError('A calibration needs its depth in mm and where it is documented');
    }
    if (d.analysis && !['kg/m3', 'mg/L'].includes(d.analysis.unit)) throw new MapError('Choose the analysis unit (kg/m³ or mg/L)');
    if (d.soilMoisture && d.soilMoisture.reading != null && !String(d.soilMoisture.unit ?? '').trim()) throw new MapError('Give the soil-moisture unit');
  }
  if (activity === 'baleage') {
    nonNeg(d.baleCount, 'Bale count'); nonNeg(d.baleWeightKg, 'Bale weight');
    if (d.baleWeightKg != null && !['measured', 'estimated'].includes(d.weightBasis)) throw new MapError('Say whether the bale weight was measured or estimated');
  }
  if (activity === 'silage') { nonNeg(d.loads, 'Loads'); nonNeg(d.loadTonnes, 'Tonnes per load'); nonNeg(d.weighbridgeTonnes, 'Weighbridge tonnes'); }
  if (isHarvest(activity) && d.dmPercent != null) {
    if (!(Number(d.dmPercent) > 0 && Number(d.dmPercent) <= 100)) throw new MapError('Dry matter must be between 0 and 100%');
    if (!['measured', 'estimated'].includes(d.dmBasis)) throw new MapError('Say whether the dry matter was measured or estimated');
  }
  if (activity === 'mowing') {
    if (!['quality', 'feed'].includes(d.purpose)) throw new MapError('Say whether this mowing is for pasture quality or for feed');
    if (d.purpose === 'feed') {
      if (!linkedJobId) throw new MapError('Mowing for feed belongs to a baleage or silage job. Choose the job, so the cut is counted once.');
      const [j] = rowsOf(await tx.execute(sql`SELECT id, activity FROM applications WHERE id = ${linkedJobId} AND farm_id = ${farmId} AND deleted_at IS NULL`));
      if (!j || !isHarvest(j.activity)) throw new MapError('Mowing for feed must be linked to a baleage or silage job');
      const [other] = rowsOf(await tx.execute(sql`
        SELECT id FROM applications WHERE linked_job_id = ${linkedJobId} AND deleted_at IS NULL AND status <> 'cancelled'
          AND (${selfId ?? null}::uuid IS NULL OR id <> ${selfId ?? null}::uuid)`));
      if (other) throw new MapError('That harvest already has its mowing recorded. Open that mowing job instead of adding another.');
    } else if (linkedJobId) {
      throw new MapError('Only mowing for feed is linked to a harvest');
    }
  } else if (linkedJobId) {
    throw new MapError('Only mowing jobs link to a harvest');
  }
}

const round = (v: number, dp = 3) => Math.round(v * 10 ** dp) / 10 ** dp;

/**
 * Volume, rate and depth: from a measured (or estimated) volume, tanker loads, or a documented
 * calibration. Never from the machine setting.
 */
export function liquidTotals(d: any, netHa: number) {
  let volume: number | null = null;
  let source: string | null = null;
  let estimate = false;
  let depthMm: number | null = null;
  const notes: string[] = [];
  if (d.volumeM3 != null) {
    volume = Number(d.volumeM3); source = d.volumeSource ?? 'entered'; estimate = d.volumeSource === 'estimate';
  } else if (d.loads != null && d.loadSizeM3 != null) {
    volume = Number(d.loads) * Number(d.loadSizeM3); source = `${d.loads} loads × ${d.loadSizeM3} m³`; estimate = !!d.loadSizeEstimated;
  } else if (d.calibration?.depthMm != null) {
    depthMm = Number(d.calibration.depthMm);
    volume = depthMm * M3_PER_MM_HA * netHa; source = `calibration: ${d.calibration.reference}`;
  }
  if (volume != null && depthMm == null && netHa > 0) depthMm = volume / netHa / M3_PER_MM_HA;
  if (volume == null) {
    notes.push(d.machineSetting
      ? `Machine setting "${d.machineSetting}" isn't a measured depth, so no depth or rate is worked out. Enter the volume, or a documented calibration.`
      : 'No volume entered, so rate and depth are unknown.');
  }
  if (netHa <= 0) notes.push('No treated area, so the rate is unknown.');
  // Nutrients only from an entered analysis
  const a = d.analysis;
  const toKgM3 = (v: unknown) => (v == null || v === '' ? null : Number(v) / (a?.unit === 'mg/L' ? 1000 : 1));
  const conc = a ? { N: toKgM3(a.n), P: toKgM3(a.p), K: toKgM3(a.k) } : null;
  const nutrients = conc && volume != null
    ? Object.fromEntries(Object.entries(conc).map(([k, v]) => [k, v == null ? null : round(v * volume!, 1)]))
    : null;
  if (!a) notes.push('No analysis entered, so its nutrients are unknown (not estimated).');
  else if (volume == null) notes.push('Analysis entered, but nutrients need the volume.');
  return {
    volumeM3: volume != null ? round(volume, 1) : null, volumeSource: source, estimate,
    rateM3Ha: volume != null && netHa > 0 ? round(volume / netHa, 1) : null,
    depthMm: depthMm != null && netHa > 0 ? round(depthMm, 2) : null,
    nutrientsKg: nutrients, analysis: a ? { ...a } : null, notes,
  };
}

/**
 * Fresh tonnes and dry-matter tonnes, each marked as measured or estimated
 */
export function harvestTotals(activity: string, d: any) {
  let freshT: number | null = null;
  let freshBasis: 'measured' | 'estimated' | null = null;
  const notes: string[] = [];
  if (activity === 'baleage') {
    if (d.baleCount != null && d.baleWeightKg != null) { freshT = Number(d.baleCount) * Number(d.baleWeightKg) / 1000; freshBasis = d.weightBasis; }
    else notes.push('Needs the bale count and bale weight for tonnes.');
  } else {
    if (d.weighbridgeTonnes != null) { freshT = Number(d.weighbridgeTonnes); freshBasis = 'measured'; }
    else if (d.loads != null && d.loadTonnes != null) { freshT = Number(d.loads) * Number(d.loadTonnes); freshBasis = 'estimated'; }
    else notes.push('Needs weighbridge tonnes, or loads and tonnes per load.');
  }
  let dmT: number | null = null;
  let dmBasis: 'measured' | 'estimated' | null = null;
  if (freshT != null && d.dmPercent != null) {
    dmT = freshT * Number(d.dmPercent) / 100;
    dmBasis = freshBasis === 'measured' && d.dmBasis === 'measured' ? 'measured' : 'estimated';
  } else if (freshT != null) notes.push('Dry matter % not known, so DM tonnes are unknown.');
  return {
    freshT: freshT != null ? round(freshT, 2) : null, freshBasis,
    dmT: dmT != null ? round(dmT, 2) : null, dmBasis,
    kgDmPerBale: activity === 'baleage' && d.baleWeightKg != null && d.dmPercent != null ? round(Number(d.baleWeightKg) * Number(d.dmPercent) / 100, 0) : null,
    notes,
  };
}

/**
 * Where the run's footprint (with the drift allowance) goes outside the allowed paddocks, or into
 * an exclusion. The drift allowance is an allowance, not a prediction.
 */
export async function footprintCheck(farmId: string, app: any) {
  if (!app.run_geom) return null;
  const d = app.details ?? {};
  const allowed: string[] = d.allowedPastureIds ?? [];
  const reach = Number(app.wetted_width_m ?? 0) / 2 + Number(app.drift_m ?? 0);
  const day = String(isoUtc(app.completed_at) ?? isoUtc(app.started_at) ?? app.planned_on ?? new Date().toISOString()).slice(0, 10);
  const exAct = EXCLUSION_ACTIVITY[app.activity] ?? 'effluent';
  const [r] = rowsOf(await db.execute(sql`
    WITH f AS (SELECT ST_Buffer(run_geom, ${reach})::geometry AS g FROM applications WHERE id = ${app.id}),
         pad AS (SELECT ST_Union(b.geom::geometry) AS g FROM paddock_boundaries b JOIN pastures p ON p.id = b.pasture_id
                 WHERE p.farm_id = ${farmId} AND p.deleted_at IS NULL AND b.valid_to IS NULL
                   AND (${allowed.length === 0} OR b.pasture_id = ANY(${allowed.length ? uuidArray(allowed) : sql`ARRAY[]::uuid[]`}))),
         ex AS (SELECT ST_Union(e.geom::geometry) AS g FROM exclusions e, f WHERE e.farm_id = ${farmId} AND ${activeExclusions(exAct, day)} AND ST_Intersects(e.geom::geometry, f.g))
    SELECT ST_Area(f.g::geography) / 10000 AS reach_ha,
      CASE WHEN pad.g IS NULL THEN ST_Area(f.g::geography) / 10000 ELSE ST_Area(ST_Difference(f.g, pad.g)::geography) / 10000 END AS outside_ha,
      CASE WHEN pad.g IS NULL THEN ST_AsGeoJSON(f.g, 7)::json ELSE ST_AsGeoJSON(ST_Difference(f.g, pad.g), 7)::json END AS outside,
      CASE WHEN ex.g IS NULL THEN 0 ELSE ST_Area(ST_Intersection(f.g, ex.g)::geography) / 10000 END AS excl_ha,
      CASE WHEN ex.g IS NULL THEN NULL ELSE ST_AsGeoJSON(ST_Intersection(f.g, ex.g), 7)::json END AS excl,
      ST_AsGeoJSON(f.g, 7)::json AS reach, ST_AsGeoJSON(run_geom, 7)::json AS run
    FROM f, pad, ex, applications a WHERE a.id = ${app.id}`));
  const tiny = (ha: number) => ha * 10000 < 1; // under 1 m²: rounding along shared edges
  const outsideHa = Number(r.outside_ha), exclHa = Number(r.excl_ha);
  return {
    run: r.run, wettedWidthM: Number(app.wetted_width_m), driftM: Number(app.drift_m ?? 0), reach: r.reach,
    outsideHa: tiny(outsideHa) ? 0 : round(outsideHa, 4), outside: tiny(outsideHa) ? null : r.outside,
    exclusionHa: tiny(exclHa) ? 0 : round(exclHa, 4), exclusion: tiny(exclHa) ? null : r.excl,
    allowed: allowed.length ? 'the chosen paddocks' : 'the farm’s paddocks',
  };
}

export async function activityDetail(farmId: string, app: any, lines: any[]) {
  const d = app.details ?? {};
  const netHa = lines.reduce((s, l) => s + Number(l.netHa ?? 0), 0);
  if (isLiquid(app.activity)) {
    return { kind: 'liquid' as const, details: d, totals: liquidTotals(d, netHa), footprint: await footprintCheck(farmId, app), netHa: round(netHa) };
  }
  if (isHarvest(app.activity)) {
    const [mow] = rowsOf(await db.execute(sql`
      SELECT id, status, completed_at AT TIME ZONE 'UTC' AS done FROM applications
      WHERE linked_job_id = ${app.id} AND deleted_at IS NULL AND status <> 'cancelled' LIMIT 1`));
    return { kind: 'harvest' as const, details: d, totals: harvestTotals(app.activity, d), netHa: round(netHa),
      mowing: mow ? { id: mow.id, status: mow.status, completedAt: isoUtc(mow.done) } : null };
  }
  let linked = null;
  if (app.linked_job_id) {
    const [j] = rowsOf(await db.execute(sql`SELECT id, activity, title, status FROM applications WHERE id = ${app.linked_job_id}`));
    linked = j ?? null;
  }
  return { kind: 'field' as const, details: d, netHa: round(netHa), linkedJob: linked };
}

/**
 * Completed effluent/slurry and baleage/silage jobs appear in Records (season totals, compliance
 * pack) as one record per job. Topping and mowing stay as jobs only.
 */
export async function syncActivityRecords(farmId: string, userId: string, id: string) {
  const [app] = rowsOf(await db.execute(sql`SELECT *, completed_at AT TIME ZONE 'UTC' AS completed_utc FROM applications WHERE id = ${id}`));
  if (!app || !(isLiquid(app.activity) || isHarvest(app.activity))) return;
  const lines = rowsOf(await db.execute(sql`
    SELECT l.*, l.net_ha::float AS net, ST_AsGeoJSON(l.geom, 7)::json AS geometry FROM application_lines l WHERE l.application_id = ${id} ORDER BY sort_order`));
  if (!lines.length) return;
  const first = lines[0];
  // Records from earlier versions of the job (one per line before) go with it
  const others = lines.slice(1).filter((l: any) => l.record_id);
  for (const l of others) {
    await deleteRecord(farmId, l.record_id);
    await db.execute(sql`UPDATE application_lines SET record_id = NULL WHERE id = ${l.id}`);
  }
  if (app.status !== 'completed' || app.deleted_at) {
    if (first.record_id) {
      await deleteRecord(farmId, first.record_id);
      await db.execute(sql`UPDATE application_lines SET record_id = NULL WHERE id = ${first.id}`);
    }
    return;
  }
  const d = app.details ?? {};
  const netHa = lines.reduce((s: number, l: any) => s + Number(l.net ?? 0), 0);
  const pastureIds = Array.from(new Set(lines.map((l: any) => l.pasture_id).filter(Boolean))) as string[];
  const drawn = lines.filter((l: any) => l.partial || !l.pasture_id);
  // One shape for the record: the drawn areas (or footprint) if any, else the paddocks
  const [u] = drawn.length ? rowsOf(await db.execute(sql`
    SELECT ST_AsGeoJSON(ST_Union(geom::geometry), 7)::json AS g FROM application_lines WHERE application_id = ${id} AND (partial OR pasture_id IS NULL)`)) : [null];
  let details: Record<string, unknown>;
  let title: string;
  let type: 'effluent' | 'baleage';
  if (isLiquid(app.activity)) {
    const t = liquidTotals(d, netHa);
    type = 'effluent';
    title = `${app.activity === 'slurry' ? 'Slurry' : 'Effluent'}${t.volumeM3 != null ? ` ${t.volumeM3} m³` : ''}`;
    details = {
      kind: app.activity === 'slurry' ? 'Slurry' : 'Effluent', method: d.method ?? undefined, machineSetting: d.machineSetting ?? undefined,
      volumeM3: t.volumeM3 ?? undefined, volumeSource: t.volumeSource ?? undefined, volumeEstimated: t.estimate || undefined,
      depthMm: t.depthMm ?? undefined, rateM3Ha: t.rateM3Ha ?? undefined,
      soilCondition: d.soilCondition ?? undefined, pondLevel: d.pondLevel ?? undefined,
      soilMoisture: d.soilMoisture ?? undefined,
      // Only an entered analysis gives nutrients
      nKgPerM3: t.analysis && t.analysis.n != null ? Number(t.analysis.n) / (t.analysis.unit === 'mg/L' ? 1000 : 1) : undefined,
      pKgPerM3: t.analysis && t.analysis.p != null ? Number(t.analysis.p) / (t.analysis.unit === 'mg/L' ? 1000 : 1) : undefined,
      kKgPerM3: t.analysis && t.analysis.k != null ? Number(t.analysis.k) / (t.analysis.unit === 'mg/L' ? 1000 : 1) : undefined,
      analysisSampledOn: t.analysis?.sampledOn ?? undefined,
      applicationId: id, lineId: first.id,
    };
  } else {
    const t = harvestTotals(app.activity, d);
    type = 'baleage';
    title = app.activity === 'silage' ? `Silage${t.freshT != null ? ` ${t.freshT} t` : ''}` : `Baleage${d.baleCount != null ? ` ${d.baleCount} bales` : ''}`;
    details = {
      kind: app.activity === 'silage' ? 'Silage pit' : 'Baleage',
      bales: app.activity === 'baleage' ? d.baleCount ?? undefined : undefined,
      kgDmPerBale: t.kgDmPerBale ?? undefined,
      freshTonnes: t.freshT ?? undefined, freshBasis: t.freshBasis ?? undefined,
      dmTonnes: t.dmT ?? undefined, dmBasis: t.dmBasis ?? undefined,
      contractor: app.contractor ?? undefined, stackLocation: d.destination ?? undefined, additive: d.additive ?? undefined,
      applicationId: id, lineId: first.id,
    };
  }
  const input = {
    type, title: title.slice(0, 255), notes: app.notes ?? null, occurredAt: new Date(isoUtc(app.completed_utc)!),
    pastureIds, area: u?.g ?? null, details, tags: [type === 'effluent' ? 'Effluent' : 'Feed'],
  };
  if (first.record_id) {
    await db.execute(sql`UPDATE farm_records SET deleted_at = NULL WHERE id = ${first.record_id}`);
    await updateRecord(farmId, first.record_id, input);
  } else {
    const { record } = await createRecord(farmId, userId, input, `app-${id}`);
    await db.execute(sql`UPDATE application_lines SET record_id = ${record.id} WHERE id = ${first.id}`);
  }
}
