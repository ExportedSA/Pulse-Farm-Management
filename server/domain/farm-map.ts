import { sql } from 'drizzle-orm';
import { db } from '../db';

// Farm map: paddock boundaries (versioned), display layers, drawn features, saved views and
// an edit history. Shapes are stored as PostGIS geography, so areas and intersections are
// worked out on the Earth's surface (never from screen pixels).

export class MapError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type Geo = { type: string; coordinates: any };

// The default layers every farm starts with (activity layers show records of that kind)
export const DEFAULT_LAYERS: { key: string; name: string; color: string; fillOpacity: number; records?: string[] }[] = [
  { key: 'paddocks', name: 'Farm and paddocks', color: '#ffffff', fillOpacity: 0.08 },
  { key: 'exclusions', name: 'Exclusion zones', color: '#e03131', fillOpacity: 0.25 },
  { key: 'fertiliser', name: 'Fertiliser', color: '#5c940d', fillOpacity: 0.3, records: ['fertiliser'] },
  { key: 'variable_rate', name: 'Variable-rate zones', color: '#2f9e44', fillOpacity: 0.3 },
  { key: 'effluent', name: 'Effluent', color: '#5f3dc4', fillOpacity: 0.3, records: ['effluent'] },
  { key: 'slurry', name: 'Slurry', color: '#862e9c', fillOpacity: 0.3 },
  { key: 'spraying', name: 'Spraying', color: '#9c36b5', fillOpacity: 0.3, records: ['spray'] },
  { key: 'baleage', name: 'Baleage', color: '#a87d10', fillOpacity: 0.3, records: ['baleage'] },
  { key: 'silage', name: 'Silage', color: '#d9480f', fillOpacity: 0.3 },
  { key: 'topping', name: 'Topping', color: '#1971c2', fillOpacity: 0.3 },
  { key: 'mowing', name: 'Mowing', color: '#0c8599', fillOpacity: 0.3 },
  { key: 'features', name: 'Farm features', color: '#ffd43b', fillOpacity: 0.2 },
];

export const rowsOf = (r: any) => (r?.rows ?? r) as any[];

// A list of ids as a Postgres uuid[] parameter
export const uuidArray = (ids: string[]) => sql`ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::uuid[]`;

export async function audit(tx: any, farmId: string, userId: string | null, entityType: string, entityId: string, action: string, before: unknown, after: unknown) {
  await tx.execute(sql`
    INSERT INTO map_audit (farm_id, entity_type, entity_id, action, before, after, user_id)
    VALUES (${farmId}, ${entityType}, ${entityId}, ${action}, ${before == null ? null : JSON.stringify(before)}::jsonb,
            ${after == null ? null : JSON.stringify(after)}::jsonb, ${userId})`);
}

/**
 * GeoJSON in, a valid PostGIS geometry expression out. Rejects anything that isn't the
 * expected kind, has no area, or sits outside sensible coordinates.
 */
export function geomSql(geometry: Geo, want: 'area' | 'any') {
  if (!geometry || typeof geometry !== 'object' || !geometry.type || !Array.isArray(geometry.coordinates)) {
    throw new MapError('That shape is missing or not valid GeoJSON');
  }
  if (want === 'area' && !['Polygon', 'MultiPolygon'].includes(geometry.type)) {
    throw new MapError('A paddock needs a closed shape (polygon)');
  }
  const text = JSON.stringify(geometry);
  const g = sql`ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${text}), 4326))`;
  return want === 'area'
    ? sql`ST_Multi(ST_CollectionExtract(${g}, 3))`
    : g;
}

export async function checkShape(tx: any, geom: any, want: 'area' | 'any', raw?: Geo) {
  if (raw) {
    const [valid] = rowsOf(await tx.execute(sql`
      SELECT ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(raw)}), 4326)) AS ok,
             ST_IsValidReason(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(raw)}), 4326)) AS reason`));
    if (!valid.ok) {
      throw new MapError(/self-intersection|ring self/i.test(valid.reason)
        ? "The outline crosses itself. Move the corners so the edges don't cross."
        : `That shape isn't valid (${valid.reason}).`);
    }
  }
  const [check] = rowsOf(await tx.execute(sql`
    SELECT ST_IsEmpty(${geom}) AS empty,
           ST_XMin(${geom}) AS minx, ST_XMax(${geom}) AS maxx, ST_YMin(${geom}) AS miny, ST_YMax(${geom}) AS maxy,
           ${want === 'area' ? sql`ST_Area(${geom}::geography) / 10000` : sql`0`} AS ha`));
  if (check.empty) throw new MapError('That shape has no area once tidied up. Check it doesn\'t cross itself.');
  if (check.minx < -180 || check.maxx > 180 || check.miny < -90 || check.maxy > 90) throw new MapError('Coordinates are out of range');
  if (want === 'area' && Number(check.ha) < 0.0001) throw new MapError('That shape is too small to be a paddock');
  return { ha: Number(check.ha), bounds: [Number(check.minx), Number(check.miny), Number(check.maxx), Number(check.maxy)] };
}

export async function ensureLayers(farmId: string) {
  for (let i = 0; i < DEFAULT_LAYERS.length; i++) {
    const l = DEFAULT_LAYERS[i];
    await db.execute(sql`
      INSERT INTO map_layers (farm_id, key, name, kind, sort_order, style)
      VALUES (${farmId}, ${l.key}, ${l.name}, 'system', ${i * 10},
              ${JSON.stringify({ color: l.color, fillColor: l.color, fillOpacity: l.fillOpacity, weight: 2, dashArray: null })}::jsonb)
      ON CONFLICT (farm_id, key) DO NOTHING`);
  }
}

async function layerOf(tx: any, farmId: string, layerId: string) {
  const [layer] = rowsOf(await tx.execute(sql`SELECT * FROM map_layers WHERE id = ${layerId} AND farm_id = ${farmId} AND archived_at IS NULL`));
  if (!layer) throw new MapError('Layer not found', 404);
  return layer;
}

async function paddocksLocked(tx: any, farmId: string) {
  const [layer] = rowsOf(await tx.execute(sql`SELECT locked FROM map_layers WHERE farm_id = ${farmId} AND key = 'paddocks'`));
  return !!layer?.locked;
}

/**
 * Everything the map page needs: layers, paddocks (current boundaries), features and views
 */
export async function mapState(farmId: string) {
  await ensureLayers(farmId);
  const layers = rowsOf(await db.execute(sql`
    SELECT id, key, name, kind, sort_order AS "sortOrder", visible, locked, style
    FROM map_layers WHERE farm_id = ${farmId} AND archived_at IS NULL ORDER BY sort_order, name`));
  const paddocks = rowsOf(await db.execute(sql`
    SELECT p.id, p.name, p.paddock_number AS "paddockNumber", p.area AS "recordedAreaHa", p.status,
           b.id AS "boundaryId", b.area_ha::float AS "areaHa", b.valid_from AS "boundaryFrom",
           ST_AsGeoJSON(b.geom, 7)::json AS geometry,
           (SELECT count(*)::int FROM paddock_boundaries h WHERE h.pasture_id = p.id) AS versions
    FROM pastures p
    LEFT JOIN paddock_boundaries b ON b.pasture_id = p.id AND b.valid_to IS NULL
    WHERE p.farm_id = ${farmId} AND p.deleted_at IS NULL
    ORDER BY p.paddock_number NULLS LAST, p.name`));
  const features = rowsOf(await db.execute(sql`
    SELECT f.id, f.layer_id AS "layerId", f.kind, f.name, f.notes, f.properties, f.radius_m::float AS "radiusM",
           f.version, f.updated_at AS "updatedAt", ST_AsGeoJSON(f.geom, 7)::json AS geometry,
           CASE WHEN f.kind = 'polygon' THEN ST_Area(f.geom) / 10000
                WHEN f.kind = 'circle' THEN pi() * f.radius_m * f.radius_m / 10000 END AS "areaHa",
           CASE WHEN f.kind = 'line' THEN ST_Length(f.geom) END AS "lengthM"
    FROM map_features f
    JOIN map_layers l ON l.id = f.layer_id AND l.archived_at IS NULL
    WHERE f.farm_id = ${farmId} AND f.deleted_at IS NULL
    ORDER BY f.created_at`));
  const views = rowsOf(await db.execute(sql`
    SELECT id, name, center_lat::float AS lat, center_lng::float AS lng, zoom::float, basemap, layers, created_at AS "createdAt"
    FROM map_views WHERE farm_id = ${farmId} ORDER BY name`));
  return { layers, paddocks, features, views };
}

/**
 * Add a paddock with its boundary
 */
export async function createPaddock(farmId: string, userId: string, input: { name: string; paddockNumber?: number | null; geometry: Geo; note?: string | null }) {
  return db.transaction(async tx => {
    if (await paddocksLocked(tx, farmId)) throw new MapError('The paddocks layer is locked. Unlock it to change paddocks.', 409);
    const geom = geomSql(input.geometry, 'area');
    const { ha } = await checkShape(tx, geom, 'area', input.geometry);
    const [pasture] = rowsOf(await tx.execute(sql`
      INSERT INTO pastures (farm_id, name, paddock_number, area, status)
      VALUES (${farmId}, ${input.name}, ${input.paddockNumber ?? null}, ${Math.max(1, Math.round(ha))}, 'available')
      RETURNING id, name`));
    const boundary = await insertBoundary(tx, farmId, userId, pasture.id, geom, input.note ?? 'Drawn');
    await audit(tx, farmId, userId, 'paddock', pasture.id, 'create', null, { name: input.name, paddockNumber: input.paddockNumber, areaHa: boundary.areaHa });
    return { id: pasture.id, ...boundary };
  });
}

async function insertBoundary(tx: any, farmId: string, userId: string, pastureId: string, geom: any, note: string) {
  const [row] = rowsOf(await tx.execute(sql`
    INSERT INTO paddock_boundaries (farm_id, pasture_id, geom, area_ha, change_note, created_by)
    VALUES (${farmId}, ${pastureId}, (${geom})::geography, ST_Area((${geom})::geography) / 10000, ${note}, ${userId})
    RETURNING id, area_ha::float AS "areaHa", ST_AsGeoJSON(geom, 7)::json AS geometry,
              ST_Y(ST_Centroid(geom::geometry)) AS lat, ST_X(ST_Centroid(geom::geometry)) AS lng`));
  // Keep the paddock's outline and centre for the rest of Pulse (job pins, Records map)
  await tx.execute(sql`
    UPDATE pastures SET boundaries = ${JSON.stringify(row.geometry)}::jsonb,
      center_latitude = ${row.lat}, center_longitude = ${row.lng}, updated_at = now()
    WHERE id = ${pastureId}`);
  return { boundaryId: row.id as string, areaHa: Number(row.areaHa), geometry: row.geometry };
}

async function farmPaddock(tx: any, farmId: string, id: string) {
  const [p] = rowsOf(await tx.execute(sql`SELECT id, name, paddock_number FROM pastures WHERE id = ${id} AND farm_id = ${farmId} AND deleted_at IS NULL`));
  if (!p) throw new MapError('Paddock not found', 404);
  return p;
}

async function closeCurrent(tx: any, pastureId: string) {
  const [old] = rowsOf(await tx.execute(sql`
    UPDATE paddock_boundaries SET valid_to = now()
    WHERE pasture_id = ${pastureId} AND valid_to IS NULL
    RETURNING id, area_ha::float AS "areaHa"`));
  return old as { id: string; areaHa: number } | undefined;
}

/**
 * New boundary for a paddock. The old one is kept (closed), so past records still show
 * the shape and area that applied when they were made.
 */
export async function setPaddockBoundary(farmId: string, userId: string, id: string, geometry: Geo, note?: string | null, opts: { updateRecordedArea?: boolean } = {}) {
  return db.transaction(async tx => {
    if (await paddocksLocked(tx, farmId)) throw new MapError('The paddocks layer is locked. Unlock it to change paddocks.', 409);
    await farmPaddock(tx, farmId, id);
    const geom = geomSql(geometry, 'area');
    await checkShape(tx, geom, 'area', geometry);
    const old = await closeCurrent(tx, id);
    const boundary = await insertBoundary(tx, farmId, userId, id, geom, note || 'Boundary edited');
    if (opts.updateRecordedArea) {
      await tx.execute(sql`UPDATE pastures SET area = ${Math.max(1, Math.round(boundary.areaHa))} WHERE id = ${id}`);
    }
    await audit(tx, farmId, userId, 'paddock', id, 'boundary', old ? { boundaryId: old.id, areaHa: old.areaHa } : null, { boundaryId: boundary.boundaryId, areaHa: boundary.areaHa, note });
    return boundary;
  });
}

/**
 * Remove a paddock's outline (the paddock itself stays; its history is kept)
 */
export async function clearPaddockBoundary(farmId: string, userId: string, id: string) {
  return db.transaction(async tx => {
    if (await paddocksLocked(tx, farmId)) throw new MapError('The paddocks layer is locked. Unlock it to change paddocks.', 409);
    await farmPaddock(tx, farmId, id);
    const old = await closeCurrent(tx, id);
    await tx.execute(sql`UPDATE pastures SET boundaries = NULL, center_latitude = NULL, center_longitude = NULL, updated_at = now() WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'paddock', id, 'boundary_cleared', old ?? null, null);
  });
}

export async function updatePaddockDetails(farmId: string, userId: string, id: string, input: { name?: string; paddockNumber?: number | null }) {
  return db.transaction(async tx => {
    const before = await farmPaddock(tx, farmId, id);
    await tx.execute(sql`
      UPDATE pastures SET
        name = COALESCE(${input.name ?? null}, name),
        paddock_number = ${input.paddockNumber === undefined ? sql`paddock_number` : input.paddockNumber},
        updated_at = now()
      WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'paddock', id, 'rename', { name: before.name, paddockNumber: before.paddock_number }, input);
  });
}

/**
 * Archive a paddock: it leaves the map, but records that used it keep their history
 */
export async function archivePaddock(farmId: string, userId: string, id: string) {
  return db.transaction(async tx => {
    if (await paddocksLocked(tx, farmId)) throw new MapError('The paddocks layer is locked. Unlock it to change paddocks.', 409);
    const p = await farmPaddock(tx, farmId, id);
    await closeCurrent(tx, id);
    await tx.execute(sql`UPDATE pastures SET deleted_at = now() WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'paddock', id, 'archive', { name: p.name }, null);
  });
}

/**
 * Split a paddock with a line drawn across it. The bigger piece keeps the paddock;
 * the other becomes a new paddock.
 */
export async function splitPaddock(farmId: string, userId: string, id: string, line: Geo, newName: string) {
  return db.transaction(async tx => {
    if (await paddocksLocked(tx, farmId)) throw new MapError('The paddocks layer is locked. Unlock it to change paddocks.', 409);
    const p = await farmPaddock(tx, farmId, id);
    if (line?.type !== 'LineString') throw new MapError('Draw a line across the paddock to split it');
    const pieces = rowsOf(await tx.execute(sql`
      WITH cur AS (SELECT geom::geometry AS g FROM paddock_boundaries WHERE pasture_id = ${id} AND valid_to IS NULL),
           parts AS (SELECT (ST_Dump(ST_Split(cur.g, ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(line)}), 4326)))).geom AS g FROM cur)
      SELECT ST_AsGeoJSON(g, 7)::json AS geometry, ST_Area(g::geography) / 10000 AS ha FROM parts
      WHERE ST_Area(g::geography) > 1 ORDER BY ST_Area(g::geography) DESC`));
    if (pieces.length === 0) throw new MapError('This paddock has no boundary to split');
    if (pieces.length !== 2) {
      throw new MapError(pieces.length < 2
        ? 'The line has to cross the paddock from one edge to the other'
        : `That line cuts the paddock into ${pieces.length} pieces. Draw one line that splits it in two.`);
    }
    await closeCurrent(tx, id);
    const kept = await insertBoundary(tx, farmId, userId, id, geomSql(pieces[0].geometry, 'area'), `Split: part kept (new paddock "${newName}")`);
    const [created] = rowsOf(await tx.execute(sql`
      INSERT INTO pastures (farm_id, name, area, status) VALUES (${farmId}, ${newName}, ${Math.max(1, Math.round(Number(pieces[1].ha)))}, 'available')
      RETURNING id`));
    const added = await insertBoundary(tx, farmId, userId, created.id, geomSql(pieces[1].geometry, 'area'), `Split from "${p.name}"`);
    await audit(tx, farmId, userId, 'paddock', id, 'split', null, { kept: kept.areaHa, newPaddock: created.id, newAreaHa: added.areaHa });
    return { kept: { id, areaHa: kept.areaHa }, created: { id: created.id as string, name: newName, areaHa: added.areaHa } };
  });
}

/**
 * Merge paddocks into one. The first keeps its name; the others are archived.
 */
export async function mergePaddocks(farmId: string, userId: string, keepId: string, otherIds: string[]) {
  return db.transaction(async tx => {
    if (await paddocksLocked(tx, farmId)) throw new MapError('The paddocks layer is locked. Unlock it to change paddocks.', 409);
    const ids = [keepId, ...otherIds.filter(i => i !== keepId)];
    if (ids.length < 2) throw new MapError('Choose at least two paddocks to merge');
    for (const id of ids) await farmPaddock(tx, farmId, id);
    const [merged] = rowsOf(await tx.execute(sql`
      SELECT ST_AsGeoJSON(ST_Multi(ST_Union(geom::geometry)), 7)::json AS geometry, count(*)::int AS n
      FROM paddock_boundaries WHERE pasture_id = ANY(${uuidArray(ids)}) AND valid_to IS NULL`));
    if (!merged || merged.n !== ids.length) throw new MapError('Every paddock being merged needs a boundary');
    await closeCurrent(tx, keepId);
    const result = await insertBoundary(tx, farmId, userId, keepId, geomSql(merged.geometry, 'area'), `Merged with ${otherIds.length} other paddock(s)`);
    for (const id of otherIds) {
      await closeCurrent(tx, id);
      await tx.execute(sql`UPDATE pastures SET deleted_at = now() WHERE id = ${id}`);
    }
    await audit(tx, farmId, userId, 'paddock', keepId, 'merge', { merged: otherIds }, { areaHa: result.areaHa });
    return { id: keepId, areaHa: result.areaHa };
  });
}

export async function paddockHistory(farmId: string, id: string) {
  return rowsOf(await db.execute(sql`
    SELECT b.id, b.area_ha::float AS "areaHa", b.valid_from AS "validFrom", b.valid_to AS "validTo", b.change_note AS note,
           u.name AS "by", ST_AsGeoJSON(b.geom, 7)::json AS geometry
    FROM paddock_boundaries b LEFT JOIN users u ON u.id = b.created_by
    WHERE b.pasture_id = ${id} AND b.farm_id = ${farmId}
    ORDER BY b.valid_from DESC`));
}

// ===== Features =====

const KINDS = ['point', 'line', 'polygon', 'circle'] as const;
export type FeatureKind = typeof KINDS[number];

function kindMatches(kind: FeatureKind, geometry: Geo) {
  const ok = { point: ['Point'], line: ['LineString', 'MultiLineString'], polygon: ['Polygon', 'MultiPolygon'], circle: ['Point'] }[kind];
  if (!ok.includes(geometry?.type)) throw new MapError(`A ${kind} can't be a ${geometry?.type ?? 'missing shape'}`);
}

export async function createFeature(farmId: string, userId: string, input: { layerId: string; kind: FeatureKind; name?: string | null; notes?: string | null; geometry: Geo; radiusM?: number | null; properties?: Record<string, unknown> }) {
  return db.transaction(async tx => {
    const layer = await layerOf(tx, farmId, input.layerId);
    if (layer.locked) throw new MapError(`"${layer.name}" is locked. Unlock it to add to it.`, 409);
    kindMatches(input.kind, input.geometry);
    if (input.kind === 'circle' && !(Number(input.radiusM) > 0)) throw new MapError('A circle needs a radius');
    const geom = input.kind === 'polygon' ? geomSql(input.geometry, 'area') : geomSql(input.geometry, 'any');
    await checkShape(tx, geom, input.kind === 'polygon' ? 'area' : 'any', input.geometry);
    const [row] = rowsOf(await tx.execute(sql`
      INSERT INTO map_features (farm_id, layer_id, kind, name, notes, properties, geom, radius_m, created_by)
      VALUES (${farmId}, ${input.layerId}, ${input.kind}, ${input.name ?? null}, ${input.notes ?? null},
              ${JSON.stringify(input.properties ?? {})}::jsonb, (${geom})::geography, ${input.radiusM ?? null}, ${userId})
      RETURNING id`));
    await audit(tx, farmId, userId, 'feature', row.id, 'create', null, { layer: layer.key, kind: input.kind, name: input.name });
    return { id: row.id as string };
  });
}

export async function updateFeature(farmId: string, userId: string, id: string, input: { layerId?: string; name?: string | null; notes?: string | null; geometry?: Geo; radiusM?: number | null; properties?: Record<string, unknown>; version?: number }) {
  return db.transaction(async tx => {
    const [f] = rowsOf(await tx.execute(sql`
      SELECT f.*, ST_AsGeoJSON(f.geom, 7)::json AS geometry, l.locked, l.name AS layer_name
      FROM map_features f JOIN map_layers l ON l.id = f.layer_id
      WHERE f.id = ${id} AND f.farm_id = ${farmId} AND f.deleted_at IS NULL`));
    if (!f) throw new MapError('Feature not found', 404);
    if (f.locked) throw new MapError(`"${f.layer_name}" is locked. Unlock it to change it.`, 409);
    // Someone else saved a change since this was loaded: don't overwrite it silently
    if (input.version != null && input.version !== f.version) throw new MapError('This was changed by someone else since you opened it. Reload to see their change.', 409);
    if (input.layerId && input.layerId !== f.layer_id) {
      const target = await layerOf(tx, farmId, input.layerId);
      if (target.locked) throw new MapError(`"${target.name}" is locked`, 409);
    }
    let geomUpdate = sql`geom`;
    if (input.geometry) {
      kindMatches(f.kind, input.geometry);
      const geom = f.kind === 'polygon' ? geomSql(input.geometry, 'area') : geomSql(input.geometry, 'any');
      await checkShape(tx, geom, f.kind === 'polygon' ? 'area' : 'any', input.geometry);
      geomUpdate = sql`(${geom})::geography`;
    }
    await tx.execute(sql`
      UPDATE map_features SET
        layer_id = ${input.layerId ?? f.layer_id},
        name = ${input.name === undefined ? f.name : input.name},
        notes = ${input.notes === undefined ? f.notes : input.notes},
        properties = ${JSON.stringify(input.properties ?? f.properties)}::jsonb,
        radius_m = ${input.radiusM === undefined ? f.radius_m : input.radiusM},
        geom = ${geomUpdate},
        version = version + 1,
        updated_at = now()
      WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'feature', id, 'update',
      { name: f.name, layerId: f.layer_id, geometry: input.geometry ? f.geometry : undefined, radiusM: f.radius_m },
      { name: input.name, layerId: input.layerId, geometry: input.geometry, radiusM: input.radiusM });
  });
}

export async function deleteFeature(farmId: string, userId: string, id: string) {
  return db.transaction(async tx => {
    const [f] = rowsOf(await tx.execute(sql`
      SELECT f.id, f.name, l.locked, l.name AS layer_name FROM map_features f JOIN map_layers l ON l.id = f.layer_id
      WHERE f.id = ${id} AND f.farm_id = ${farmId} AND f.deleted_at IS NULL`));
    if (!f) throw new MapError('Feature not found', 404);
    if (f.locked) throw new MapError(`"${f.layer_name}" is locked. Unlock it to delete from it.`, 409);
    await tx.execute(sql`UPDATE map_features SET deleted_at = now() WHERE id = ${id}`);
    await audit(tx, farmId, userId, 'feature', id, 'delete', { name: f.name }, null);
  });
}

// ===== Layers =====

export async function createLayer(farmId: string, userId: string, input: { name: string; color?: string }) {
  const key = `custom_${Date.now().toString(36)}`;
  const color = input.color ?? '#f783ac';
  const [row] = rowsOf(await db.execute(sql`
    INSERT INTO map_layers (farm_id, key, name, kind, sort_order, style)
    VALUES (${farmId}, ${key}, ${input.name}, 'custom',
            (SELECT COALESCE(max(sort_order), 0) + 10 FROM map_layers WHERE farm_id = ${farmId}),
            ${JSON.stringify({ color, fillColor: color, fillOpacity: 0.3, weight: 2, dashArray: null })}::jsonb)
    RETURNING id`));
  await audit(db, farmId, userId, 'layer', row.id, 'create', null, input);
  return { id: row.id as string };
}

export async function updateLayer(farmId: string, userId: string, id: string, input: { name?: string; visible?: boolean; locked?: boolean; sortOrder?: number; style?: Record<string, unknown> }) {
  const before = await layerOf(db, farmId, id);
  await db.execute(sql`
    UPDATE map_layers SET
      name = ${input.name ?? before.name},
      visible = ${input.visible ?? before.visible},
      locked = ${input.locked ?? before.locked},
      sort_order = ${input.sortOrder ?? before.sort_order},
      style = ${JSON.stringify({ ...before.style, ...(input.style ?? {}) })}::jsonb
    WHERE id = ${id}`);
  await audit(db, farmId, userId, 'layer', id, 'update', { name: before.name, visible: before.visible, locked: before.locked, style: before.style }, input);
}

export async function archiveLayer(farmId: string, userId: string, id: string) {
  const layer = await layerOf(db, farmId, id);
  if (layer.kind === 'system') throw new MapError('Built-in layers can be hidden but not removed');
  const [{ n }] = rowsOf(await db.execute(sql`SELECT count(*)::int AS n FROM map_features WHERE layer_id = ${id} AND deleted_at IS NULL`));
  if (n > 0) throw new MapError(`Move or delete the ${n} shape${n === 1 ? '' : 's'} on "${layer.name}" first`, 409);
  await db.execute(sql`UPDATE map_layers SET archived_at = now() WHERE id = ${id}`);
  await audit(db, farmId, userId, 'layer', id, 'archive', { name: layer.name }, null);
}

// ===== Saved views =====

export async function saveView(farmId: string, userId: string, input: { name: string; lat: number; lng: number; zoom: number; basemap: string; layers: Record<string, boolean> }) {
  const [row] = rowsOf(await db.execute(sql`
    INSERT INTO map_views (farm_id, name, center_lat, center_lng, zoom, basemap, layers, created_by)
    VALUES (${farmId}, ${input.name}, ${input.lat}, ${input.lng}, ${input.zoom}, ${input.basemap}, ${JSON.stringify(input.layers)}::jsonb, ${userId})
    RETURNING id`));
  return { id: row.id as string };
}

export async function deleteView(farmId: string, id: string) {
  const rows = rowsOf(await db.execute(sql`DELETE FROM map_views WHERE id = ${id} AND farm_id = ${farmId} RETURNING id`));
  if (rows.length === 0) throw new MapError('View not found', 404);
}

// ===== Import / export =====

/**
 * The farm's own map as GeoJSON: paddocks (current boundaries) and every feature
 */
export async function exportMap(farmId: string, opts: { layerIds?: string[]; paddocks?: boolean; exclusions?: boolean } = {}) {
  const state = await mapState(farmId);
  const layerName = new Map(state.layers.map((l: any) => [l.id, l.name]));
  const exclusions = opts.exclusions === false ? [] : rowsOf(await db.execute(sql`
    SELECT id, name, reason, activities, buffer_m::float AS "bufferM", permanent, starts_on::text AS "startsOn", ends_on::text AS "endsOn",
      requirement_source AS "requirementSource", confirmed_by AS "confirmedBy", ST_AsGeoJSON(geom, 7)::json AS geometry, ST_Area(geom) / 10000 AS ha
    FROM exclusions WHERE farm_id = ${farmId} AND archived_at IS NULL`));
  const wanted = (layerId: string) => !opts.layerIds || opts.layerIds.includes(layerId);
  return {
    type: 'FeatureCollection',
    features: [
      ...(opts.paddocks === false ? [] : state.paddocks).filter((p: any) => p.geometry).map((p: any) => ({
        type: 'Feature',
        geometry: p.geometry,
        properties: { pulseType: 'paddock', id: p.id, name: p.name, paddockNumber: p.paddockNumber, areaHa: Number(Number(p.areaHa).toFixed(4)), layer: 'Farm and paddocks' },
      })),
      ...exclusions.map((e: any) => ({
        type: 'Feature',
        geometry: e.geometry,
        properties: {
          pulseType: 'exclusion', id: e.id, name: e.name, reason: e.reason, activities: e.activities.join(', '), bufferM: e.bufferM,
          permanent: e.permanent, startsOn: e.startsOn, endsOn: e.endsOn, requirementSource: e.requirementSource,
          confirmedBy: e.confirmedBy, areaHa: Number(Number(e.ha).toFixed(4)), layer: 'Exclusion zones',
        },
      })),
      ...state.features.filter((f: any) => wanted(f.layerId)).map((f: any) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          pulseType: 'feature', id: f.id, kind: f.kind, name: f.name, notes: f.notes, layer: layerName.get(f.layerId),
          ...(f.radiusM ? { radiusM: f.radiusM } : {}), ...(f.areaHa != null ? { areaHa: Number(Number(f.areaHa).toFixed(4)) } : {}),
          ...(f.lengthM != null ? { lengthM: Math.round(Number(f.lengthM)) } : {}), ...f.properties,
        },
      })),
    ],
  };
}

export interface ImportItem { geometry: Geo; name?: string | null; paddockNumber?: number | null }

/**
 * Bring shapes in from a KML/KMZ/GeoJSON file (read in the browser): as paddocks, or onto a layer
 */
export async function importShapes(farmId: string, userId: string, input: { as: 'paddocks' | 'layer'; layerId?: string; items: ImportItem[] }) {
  const created: string[] = [];
  const skipped: { name: string | null; reason: string }[] = [];
  for (const item of input.items) {
    try {
      if (input.as === 'paddocks') {
        const r = await createPaddock(farmId, userId, { name: (item.name || `Imported ${created.length + 1}`).slice(0, 100), paddockNumber: item.paddockNumber ?? null, geometry: item.geometry, note: 'Imported from file' });
        created.push(r.id);
      } else {
        const kind: FeatureKind = item.geometry?.type?.includes('Polygon') ? 'polygon' : item.geometry?.type?.includes('LineString') ? 'line' : 'point';
        const r = await createFeature(farmId, userId, { layerId: input.layerId!, kind, name: item.name ?? null, geometry: item.geometry });
        created.push(r.id);
      }
    } catch (error: any) {
      if (!(error instanceof MapError)) throw error;
      skipped.push({ name: item.name ?? null, reason: error.message });
    }
  }
  return { created: created.length, skipped };
}

// ===== Records keep the paddock areas that applied when they were made =====

export async function paddockSnapshot(farmId: string, pastureIds: string[]) {
  if (pastureIds.length === 0) return null;
  const rows = rowsOf(await db.execute(sql`
    SELECT p.id, p.name, p.area AS recorded, b.id AS boundary_id, b.area_ha::float AS area_ha
    FROM pastures p LEFT JOIN paddock_boundaries b ON b.pasture_id = p.id AND b.valid_to IS NULL
    WHERE p.farm_id = ${farmId} AND p.id = ANY(${uuidArray(pastureIds)})`));
  return Object.fromEntries(rows.map(r => [r.id, {
    name: r.name,
    areaHa: r.area_ha != null ? Math.round(Number(r.area_ha) * 10000) / 10000 : r.recorded != null ? Number(r.recorded) : null,
    source: r.area_ha != null ? 'mapped boundary' : r.recorded != null ? 'recorded area' : 'unknown',
    boundaryId: r.boundary_id ?? null,
  }]));
}
