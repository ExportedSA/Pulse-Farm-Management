import { sql } from 'drizzle-orm';
import { db } from '../db';
import { MapError, audit, checkShape, geomSql, rowsOf, type Geo } from './farm-map';

// Exclusion zones: where some activities mustn't be applied. Each one says why, which
// activities it covers, its distance (set per exclusion: no setback is assumed), whether
// it's permanent or for some dates, and where the requirement came from.
// Calculations always use every active exclusion, whether or not its layer is shown.

export const EXCLUSION_ACTIVITIES = ['fertiliser', 'effluent', 'slurry', 'spraying', 'all'] as const;
export type ExclusionActivity = typeof EXCLUSION_ACTIVITIES[number];

export interface ExclusionInput {
  name: string;
  reason?: string | null;
  activities: string[];
  // area: a drawn area (optionally widened); around: a margin around a point, line, shape or map
  // feature (bore, stream, soak hole); edge: a strip along the inside of a paddock's edge
  sourceKind: 'area' | 'around' | 'edge';
  geometry?: Geo | null;
  featureId?: string | null;
  pastureId?: string | null;
  bufferM: number;
  permanent: boolean;
  startsOn?: string | null;
  endsOn?: string | null;
  requirementSource?: string | null;
  confirmedBy?: string | null;
  confirmedOn?: string | null;
}

/**
 * SQL for exclusions that apply to an activity on a date
 */
export function activeExclusions(activity: string, onDate: string) {
  return sql`archived_at IS NULL
    AND activities && ARRAY[${activity}, 'all']::text[]
    AND (permanent OR ((starts_on IS NULL OR starts_on <= ${onDate}::date) AND (ends_on IS NULL OR ends_on >= ${onDate}::date)))`;
}

/**
 * The source shape (as a geometry expression) and the excluded area it makes
 */
async function buildShape(tx: any, farmId: string, input: ExclusionInput) {
  const d = Number(input.bufferM) || 0;
  if (d < 0 || d > 5000) throw new MapError('The distance must be between 0 and 5000 m');
  let source: any;
  if (input.sourceKind === 'edge') {
    if (!input.pastureId) throw new MapError('Choose the paddock whose edge this runs along');
    if (d <= 0) throw new MapError('Give the width of the strip in metres');
    const [p] = rowsOf(await tx.execute(sql`
      SELECT ST_AsGeoJSON(b.geom)::json AS g FROM paddock_boundaries b JOIN pastures p ON p.id = b.pasture_id
      WHERE b.pasture_id = ${input.pastureId} AND b.valid_to IS NULL AND p.farm_id = ${farmId}`));
    if (!p) throw new MapError('That paddock has no boundary to run along');
    source = geomSql(p.g, 'area');
    const area = sql`ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Intersection(
      ST_Buffer(ST_Boundary(${source})::geography, ${d})::geometry, ${source})), 3))`;
    return { source, area };
  }
  if (input.featureId) {
    const [f] = rowsOf(await tx.execute(sql`
      SELECT ST_AsGeoJSON(geom)::json AS g, kind, radius_m FROM map_features
      WHERE id = ${input.featureId} AND farm_id = ${farmId} AND deleted_at IS NULL`));
    if (!f) throw new MapError('That map feature was not found');
    source = geomSql(f.g, 'any');
    // A circle feature already has a radius: the margin is added to it
    const total = d + (f.kind === 'circle' ? Number(f.radius_m) || 0 : 0);
    if (total <= 0) throw new MapError('Give a distance around the feature in metres');
    const area = sql`ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Buffer((${source})::geography, ${total})::geometry), 3))`;
    return { source, area };
  }
  if (!input.geometry) throw new MapError('Draw the area, or choose what it goes around');
  const isArea = input.geometry.type.includes('Polygon');
  if (input.sourceKind === 'area' && !isArea) throw new MapError('Draw a closed area, or choose "around" for a point or line');
  source = isArea ? geomSql(input.geometry, 'area') : geomSql(input.geometry, 'any');
  await checkShape(tx, source, isArea ? 'area' : 'any', input.geometry);
  if (!isArea && d <= 0) throw new MapError('Give a distance around the point or line in metres');
  const area = d > 0
    ? sql`ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Buffer((${source})::geography, ${d})::geometry), 3))`
    : source;
  return { source, area };
}

function checkDates(input: Pick<ExclusionInput, 'permanent' | 'startsOn' | 'endsOn'>) {
  if (!input.permanent && !input.startsOn) throw new MapError('A temporary exclusion needs a start date');
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) throw new MapError('The end date is before the start date');
}

export async function createExclusion(farmId: string, userId: string, input: ExclusionInput) {
  checkDates(input);
  return db.transaction(async tx => {
    const { source, area } = await buildShape(tx, farmId, input);
    const [row] = rowsOf(await tx.execute(sql`
      INSERT INTO exclusions (farm_id, name, reason, activities, source_kind, source_feature_id, source_pasture_id,
        source_geom, buffer_m, geom, permanent, starts_on, ends_on, requirement_source, confirmed_by, confirmed_on, created_by)
      VALUES (${farmId}, ${input.name}, ${input.reason ?? null}, ${sql`ARRAY[${sql.join(input.activities.map(a => sql`${a}`), sql`, `)}]::text[]`},
        ${input.sourceKind}, ${input.featureId ?? null}, ${input.pastureId ?? null},
        (${source})::geography, ${Number(input.bufferM) || 0}, (${area})::geography,
        ${input.permanent}, ${input.permanent ? null : input.startsOn ?? null}, ${input.permanent ? null : input.endsOn ?? null},
        ${input.requirementSource ?? null}, ${input.confirmedBy ?? null}, ${input.confirmedOn ?? null}, ${userId})
      RETURNING id, ST_Area(geom) / 10000 AS area_ha`));
    if (Number(row.area_ha) <= 0) throw new MapError('That exclusion has no area');
    await audit(tx, farmId, userId, 'exclusion', row.id, 'create', null, { ...input, geometry: undefined });
    return { id: row.id as string, areaHa: Number(row.area_ha) };
  });
}

export async function updateExclusion(farmId: string, userId: string, id: string, input: Partial<ExclusionInput> & { version?: number }) {
  return db.transaction(async tx => {
    const [cur] = rowsOf(await tx.execute(sql`
      SELECT *, ST_AsGeoJSON(source_geom)::json AS source_json FROM exclusions
      WHERE id = ${id} AND farm_id = ${farmId} AND archived_at IS NULL`));
    if (!cur) throw new MapError('Exclusion not found', 404);
    if (input.version != null && input.version !== cur.version) throw new MapError('This was changed by someone else since you opened it. Reload to see their change.', 409);
    const merged: ExclusionInput = {
      name: input.name ?? cur.name,
      reason: input.reason !== undefined ? input.reason : cur.reason,
      activities: input.activities ?? cur.activities,
      sourceKind: cur.source_kind,
      // The shape is rebuilt from what it was made from (the source keeps its saved copy)
      geometry: input.geometry ?? (cur.source_feature_id || cur.source_pasture_id ? null : cur.source_json),
      featureId: input.geometry ? null : cur.source_feature_id,
      pastureId: cur.source_pasture_id,
      bufferM: input.bufferM ?? Number(cur.buffer_m),
      permanent: input.permanent ?? cur.permanent,
      startsOn: input.startsOn !== undefined ? input.startsOn : cur.starts_on,
      endsOn: input.endsOn !== undefined ? input.endsOn : cur.ends_on,
      requirementSource: input.requirementSource !== undefined ? input.requirementSource : cur.requirement_source,
      confirmedBy: input.confirmedBy !== undefined ? input.confirmedBy : cur.confirmed_by,
      confirmedOn: input.confirmedOn !== undefined ? input.confirmedOn : cur.confirmed_on,
    };
    checkDates(merged);
    const { source, area } = await buildShape(tx, farmId, merged);
    await tx.execute(sql`
      UPDATE exclusions SET name = ${merged.name}, reason = ${merged.reason ?? null},
        activities = ${sql`ARRAY[${sql.join(merged.activities.map(a => sql`${a}`), sql`, `)}]::text[]`},
        source_feature_id = ${merged.featureId ?? null}, source_geom = (${source})::geography,
        buffer_m = ${merged.bufferM}, geom = (${area})::geography, permanent = ${merged.permanent},
        starts_on = ${merged.permanent ? null : merged.startsOn ?? null}, ends_on = ${merged.permanent ? null : merged.endsOn ?? null},
        requirement_source = ${merged.requirementSource ?? null}, confirmed_by = ${merged.confirmedBy ?? null},
        confirmed_on = ${merged.confirmedOn ?? null}, version = version + 1, updated_at = now()
      WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'exclusion', id, 'update',
      { name: cur.name, bufferM: Number(cur.buffer_m), activities: cur.activities, permanent: cur.permanent, startsOn: cur.starts_on, endsOn: cur.ends_on },
      { ...input, geometry: input.geometry ? 'redrawn' : undefined });
  });
}

export async function archiveExclusion(farmId: string, userId: string, id: string) {
  const rows = rowsOf(await db.execute(sql`
    UPDATE exclusions SET archived_at = now() WHERE id = ${id} AND farm_id = ${farmId} AND archived_at IS NULL RETURNING name`));
  if (rows.length === 0) throw new MapError('Exclusion not found', 404);
  await audit(db, farmId, userId, 'exclusion', id, 'archive', { name: rows[0].name }, null);
}

export async function listExclusions(farmId: string, today: string) {
  return rowsOf(await db.execute(sql`
    SELECT id, name, reason, activities, source_kind AS "sourceKind", source_feature_id AS "featureId", source_pasture_id AS "pastureId",
      buffer_m::float AS "bufferM", permanent, starts_on::text AS "startsOn", ends_on::text AS "endsOn",
      requirement_source AS "requirementSource", confirmed_by AS "confirmedBy", confirmed_on::text AS "confirmedOn",
      version, ST_AsGeoJSON(geom, 7)::json AS geometry, ST_Area(geom) / 10000 AS "areaHa",
      CASE WHEN permanent THEN 'active'
           WHEN starts_on > ${today}::date THEN 'upcoming'
           WHEN ends_on IS NOT NULL AND ends_on < ${today}::date THEN 'ended'
           ELSE 'active' END AS status
    FROM exclusions WHERE farm_id = ${farmId} AND archived_at IS NULL ORDER BY name`));
}

/**
 * Gross, excluded and net hectares of a shape for an activity on a date. Overlapping
 * exclusions are merged first, so no ground is taken off twice.
 */
export async function areaBreakdown(exec: any, farmId: string, shape: any, activity: string, onDate: string) {
  const [row] = rowsOf(await exec.execute(sql`
    WITH t AS (SELECT (${shape})::geometry AS g),
         ex AS (SELECT ST_Union(e.geom::geometry) AS g FROM exclusions e, t
                WHERE e.farm_id = ${farmId} AND ${activeExclusions(activity, onDate)} AND ST_Intersects(e.geom::geometry, t.g))
    SELECT ST_Area(t.g::geography) / 10000 AS gross,
           COALESCE(ST_Area(ST_Intersection(t.g, ex.g)::geography) / 10000, 0) AS excluded
    FROM t, ex`));
  const parts = rowsOf(await exec.execute(sql`
    WITH t AS (SELECT (${shape})::geometry AS g)
    SELECT e.id, e.name, e.buffer_m::float AS "bufferM", ST_Area(ST_Intersection(t.g, e.geom::geometry)::geography) / 10000 AS ha
    FROM exclusions e, t
    WHERE e.farm_id = ${farmId} AND ${activeExclusions(activity, onDate)} AND ST_Intersects(e.geom::geometry, t.g)
    ORDER BY ha DESC`));
  const gross = Number(row.gross);
  const excluded = Number(row.excluded);
  return {
    grossHa: gross,
    excludedHa: excluded,
    netHa: Math.max(0, gross - excluded),
    exclusions: parts.map(p => ({ id: p.id, name: p.name, bufferM: p.bufferM, ha: Number(p.ha) })),
  };
}

export async function paddockAreas(farmId: string, pastureId: string, activity: string, onDate: string) {
  const [b] = rowsOf(await db.execute(sql`
    SELECT ST_AsGeoJSON(b.geom)::json AS g FROM paddock_boundaries b JOIN pastures p ON p.id = b.pasture_id
    WHERE b.pasture_id = ${pastureId} AND b.valid_to IS NULL AND p.farm_id = ${farmId}`));
  if (!b) throw new MapError('That paddock has no boundary yet', 404);
  return areaBreakdown(db, farmId, geomSql(b.g, 'area'), activity, onDate);
}
