import { sql } from 'drizzle-orm';
import { db } from '../db';
import { MapError, audit, isoUtc, rowsOf, uuidArray } from './farm-map';
import { snapshotJob } from './versions';

// Imported GPS evidence and sharing jobs with contractors.
// A drawn area is "recorded by hand"; only an imported track or covered area from the machine is
// GPS evidence, and it's kept apart from the drawn lines (it never replaces the treated area).

async function jobRow(tx: any, farmId: string, id: string) {
  const [app] = rowsOf(await tx.execute(sql`SELECT id, status, evidence FROM applications WHERE id = ${id} AND farm_id = ${farmId} AND deleted_at IS NULL`));
  if (!app) throw new MapError('Job not found', 404);
  return app;
}

export async function setGps(farmId: string, userId: string, id: string, input: { geometries: any[]; source: string }) {
  if (!input.geometries.length) throw new MapError('The file has no tracks or areas in it');
  const usable = input.geometries.filter(g => ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'Point', 'MultiPoint'].includes(g?.type));
  if (!usable.length) throw new MapError('No tracks, points or areas found in the file');
  await db.transaction(async tx => {
    const app = await jobRow(tx, farmId, id);
    if (app.status !== 'completed') throw new MapError('Import GPS evidence once the job is recorded as done');
    await snapshotJob(tx, id, userId, 'gps');
    const collection = { type: 'GeometryCollection', geometries: usable };
    await tx.execute(sql`
      UPDATE applications SET gps_geom = ST_MakeValid(ST_GeomFromGeoJSON(${JSON.stringify(collection)}))::geography,
        gps_source = ${input.source}, gps_imported_at = now(), evidence = 'gps', version = version + 1, updated_at = now()
      WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'application', id, 'gps', { evidence: app.evidence }, { source: input.source, parts: usable.length });
  });
}

export async function clearGps(farmId: string, userId: string, id: string) {
  await db.transaction(async tx => {
    await jobRow(tx, farmId, id);
    await snapshotJob(tx, id, userId, 'gps removed');
    await tx.execute(sql`
      UPDATE applications SET gps_geom = NULL, gps_source = NULL, gps_imported_at = NULL,
        evidence = CASE WHEN status = 'completed' THEN 'manual' ELSE 'planned' END, version = version + 1, updated_at = now()
      WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'application', id, 'gps_remove', null, null);
  });
}

/**
 * How the GPS evidence compares with the recorded area: track length, covered area, and what lies
 * outside the recorded area
 */
export async function gpsSummary(id: string) {
  const [r] = rowsOf(await db.execute(sql`
    WITH a AS (SELECT gps_geom::geometry AS g, gps_source, gps_imported_at FROM applications WHERE id = ${id} AND gps_geom IS NOT NULL),
         area AS (SELECT ST_Union(geom::geometry) AS g FROM application_lines WHERE application_id = ${id}),
         parts AS (SELECT ST_CollectionExtract(a.g, 2) AS lines, ST_CollectionExtract(a.g, 3) AS polys, ST_CollectionExtract(a.g, 1) AS pts FROM a)
    SELECT a.gps_source AS source, a.gps_imported_at AT TIME ZONE 'UTC' AS imported, ST_AsGeoJSON(a.g, 7)::json AS geometry,
      COALESCE(ST_Length(parts.lines::geography), 0) AS track_m,
      COALESCE(ST_Length(ST_Difference(parts.lines, area.g)::geography), 0) AS track_outside_m,
      COALESCE(ST_Area(parts.polys::geography) / 10000, 0) AS covered_ha,
      COALESCE(ST_Area(ST_Intersection(parts.polys, area.g)::geography) / 10000, 0) AS covered_in_area_ha,
      COALESCE(ST_Area(area.g::geography) / 10000, 0) AS area_ha,
      COALESCE(ST_NumGeometries(parts.pts), 0) AS points
    FROM a, area, parts`));
  if (!r) return null;
  const round = (v: number, dp = 3) => Math.round(Number(v) * 10 ** dp) / 10 ** dp;
  const areaHa = Number(r.area_ha);
  return {
    source: r.source, importedAt: isoUtc(r.imported), geometry: r.geometry,
    trackM: Math.round(Number(r.track_m)), trackOutsideM: Math.round(Number(r.track_outside_m)), points: Number(r.points),
    coveredHa: round(r.covered_ha), coveredPct: Number(r.covered_ha) > 0 && areaHa > 0 ? Math.round(Number(r.covered_in_area_ha) / areaHa * 100) : null,
    coveredOutsideHa: round(Number(r.covered_ha) - Number(r.covered_in_area_ha)),
  };
}

/**
 * Which contractors (or other members) can see a job. Contractors see only these.
 */
export async function shareJob(farmId: string, userId: string, id: string, userIds: string[]) {
  await db.transaction(async tx => {
    await jobRow(tx, farmId, id);
    if (userIds.length) {
      const members = rowsOf(await tx.execute(sql`
        SELECT user_id FROM farm_members WHERE farm_id = ${farmId} AND user_id = ANY(${uuidArray(userIds)})`));
      if (members.length !== new Set(userIds).size) throw new MapError('Share only with people on this farm');
    }
    await snapshotJob(tx, id, userId, 'sharing');
    await tx.execute(sql`UPDATE applications SET shared_with = ${userIds.length ? uuidArray(userIds) : sql`'{}'::uuid[]`}, version = version + 1, updated_at = now() WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'application', id, 'share', null, { userIds });
  });
}

export async function contractors(farmId: string) {
  return rowsOf(await db.execute(sql`
    SELECT u.id, u.name, u.email FROM farm_members m JOIN users u ON u.id = m.user_id
    WHERE m.farm_id = ${farmId} AND m.role = 'contractor' ORDER BY u.name`));
}

export async function isSharedWith(id: string, userId: string) {
  const [r] = rowsOf(await db.execute(sql`SELECT 1 AS ok FROM applications WHERE id = ${id} AND ${userId}::uuid = ANY(shared_with)`));
  return !!r;
}
