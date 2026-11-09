import { sql } from 'drizzle-orm';
import { db } from '../db';
import { HAZARD_CATEGORIES, HAZARD_STATUSES, SAFETY_DOCUMENT_TYPES } from '@shared/safety';
import { MapError, audit, checkShape, geomSql, isoUtc, rowsOf, type Geo } from './farm-map';
import { attachmentsFor, toApiAttachment } from './attachments';

// Health & safety: the hazard register (each hazard can be drawn on the farm map) and the
// farm's safety documents. Every change to a hazard goes in the map's edit history.

export const HAZARD_KEYS = HAZARD_CATEGORIES.map(c => c.key) as [string, ...string[]];
export const STATUS_KEYS = HAZARD_STATUSES.map(s => s.key) as [string, ...string[]];
export const DOCUMENT_KEYS = SAFETY_DOCUMENT_TYPES.map(t => t.key) as [string, ...string[]];

export interface HazardInput {
  title: string;
  type: string;
  description?: string | null;
  riskLevel: number;
  controls?: string | null;
  location?: string | null;
  status?: string;
  reviewDue?: string | null;
  assignedTo?: string | null;
  geometry?: Geo | null;
  radiusM?: number | null;
}

// Older hazards stored a severity word; it follows the 1-5 risk score
const severityOf = (risk: number) => (risk <= 2 ? 'low' : risk === 3 ? 'medium' : risk === 4 ? 'high' : 'critical');

const HAZARD_COLUMNS = sql`
  h.id, h.title, h.type, h.description, h.risk_level AS "riskLevel", h.severity, h.status, h.location,
  h.mitigation_description AS controls, h.next_inspection_date AS "reviewDue", h.assigned_to AS "assignedTo",
  h.reported_by AS "reportedBy", r.name AS "reportedByName", h.resolved_at AS "resolvedAt",
  h.created_at AS "createdAt", h.updated_at AS "updatedAt", h.radius_m::float AS "radiusM",
  ST_AsGeoJSON(h.geom, 7)::json AS geometry`;

function toHazard(row: any) {
  return {
    ...row,
    reviewDue: row.reviewDue ? String(row.reviewDue).slice(0, 10) : null,
    resolvedAt: isoUtc(row.resolvedAt),
    createdAt: isoUtc(row.createdAt),
    updatedAt: isoUtc(row.updatedAt),
  };
}

export async function listHazards(farmId: string, opts: { includeResolved?: boolean } = {}) {
  const rows = rowsOf(await db.execute(sql`
    SELECT ${HAZARD_COLUMNS}
    FROM farm_hazards h LEFT JOIN users r ON r.id = h.reported_by
    WHERE h.farm_id = ${farmId} ${opts.includeResolved ? sql`` : sql`AND h.status <> 'resolved'`}
    ORDER BY (h.status = 'resolved'), h.risk_level DESC NULLS LAST, h.created_at DESC`));
  const files = await attachmentsFor('hazard', rows.map(r => r.id));
  return rows.map(r => ({ ...toHazard(r), photos: (files.get(r.id) ?? []).map(toApiAttachment) }));
}

export async function getHazard(farmId: string, id: string) {
  const [row] = rowsOf(await db.execute(sql`
    SELECT ${HAZARD_COLUMNS} FROM farm_hazards h LEFT JOIN users r ON r.id = h.reported_by
    WHERE h.id = ${id} AND h.farm_id = ${farmId}`));
  return row ? toHazard(row) : undefined;
}

async function shapeOf(tx: any, geometry: Geo | null | undefined, radiusM: number | null | undefined) {
  if (!geometry) return { geom: sql`NULL`, radius: null };
  if (radiusM != null && geometry.type !== 'Point') throw new MapError('Only a point can have a radius');
  const g = geomSql(geometry, 'any');
  await checkShape(tx, g, 'any', geometry);
  return { geom: sql`(${g})::geography`, radius: radiusM ?? null };
}

export async function createHazard(farmId: string, userId: string, input: HazardInput) {
  return db.transaction(async tx => {
    const shape = await shapeOf(tx, input.geometry, input.radiusM);
    const [row] = rowsOf(await tx.execute(sql`
      INSERT INTO farm_hazards (farm_id, title, type, description, risk_level, severity, mitigation_description,
        mitigation_required, location, status, next_inspection_date, assigned_to, reported_by, geom, radius_m)
      VALUES (${farmId}, ${input.title}, ${input.type}, ${input.description ?? null}, ${input.riskLevel},
        ${severityOf(input.riskLevel)}, ${input.controls ?? null}, ${input.riskLevel > 2}, ${input.location ?? null},
        ${input.status ?? 'active'}, ${input.reviewDue ?? null}, ${input.assignedTo ?? null}, ${userId}, ${shape.geom}, ${shape.radius})
      RETURNING id`));
    await audit(tx, farmId, userId, 'hazard', row.id, 'create', null, { title: input.title, type: input.type, riskLevel: input.riskLevel, mapped: !!input.geometry });
    return { id: row.id as string };
  });
}

export async function updateHazard(farmId: string, userId: string, id: string, input: Partial<HazardInput>) {
  return db.transaction(async tx => {
    const [before] = rowsOf(await tx.execute(sql`
      SELECT title, type, description, risk_level AS "riskLevel", mitigation_description AS controls, location, status,
             next_inspection_date AS "reviewDue", assigned_to AS "assignedTo", ST_AsGeoJSON(geom, 7)::json AS geometry, radius_m::float AS "radiusM"
      FROM farm_hazards WHERE id = ${id} AND farm_id = ${farmId} FOR UPDATE`));
    if (!before) throw new MapError('Hazard not found', 404);
    const sets = [sql`updated_at = now()`];
    if (input.title !== undefined) sets.push(sql`title = ${input.title}`);
    if (input.type !== undefined) sets.push(sql`type = ${input.type}`);
    if (input.description !== undefined) sets.push(sql`description = ${input.description}`);
    if (input.riskLevel !== undefined) sets.push(sql`risk_level = ${input.riskLevel}`, sql`severity = ${severityOf(input.riskLevel)}`, sql`mitigation_required = ${input.riskLevel > 2}`);
    if (input.controls !== undefined) sets.push(sql`mitigation_description = ${input.controls}`);
    if (input.location !== undefined) sets.push(sql`location = ${input.location}`);
    if (input.reviewDue !== undefined) sets.push(sql`next_inspection_date = ${input.reviewDue}`);
    if (input.assignedTo !== undefined) sets.push(sql`assigned_to = ${input.assignedTo}`);
    if (input.status !== undefined) {
      sets.push(sql`status = ${input.status}`);
      sets.push(input.status === 'resolved'
        ? sql`resolved_at = COALESCE(resolved_at, now()), resolved_by = COALESCE(resolved_by, ${userId}::uuid)`
        : sql`resolved_at = NULL, resolved_by = NULL`);
    }
    if (input.geometry !== undefined) {
      const shape = await shapeOf(tx, input.geometry, input.radiusM ?? null);
      sets.push(sql`geom = ${shape.geom}`, sql`radius_m = ${shape.radius}`);
    } else if (input.radiusM !== undefined) {
      sets.push(sql`radius_m = ${input.radiusM}`);
    }
    await tx.execute(sql`UPDATE farm_hazards SET ${sql.join(sets, sql`, `)} WHERE id = ${id} AND farm_id = ${farmId}`);
    const changed = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    const was = Object.fromEntries(Object.keys(changed).map(k => [k, (before as any)[k]]));
    await audit(tx, farmId, userId, 'hazard', id, input.status === 'resolved' && before.status !== 'resolved' ? 'resolve' : 'update', was, changed);
  });
}

// ===== Safety documents =====

export interface DocumentInput { title: string; docType: string; reviewDue?: string | null; notes?: string | null }

export async function listDocuments(farmId: string, opts: { includeArchived?: boolean } = {}) {
  const rows = rowsOf(await db.execute(sql`
    SELECT d.id, d.title, d.doc_type AS "docType", d.review_due AS "reviewDue", d.notes, d.created_at AS "createdAt",
           d.updated_at AS "updatedAt", d.archived_at AS "archivedAt", u.name AS "createdByName"
    FROM safety_documents d LEFT JOIN users u ON u.id = d.created_by
    WHERE d.farm_id = ${farmId} ${opts.includeArchived ? sql`` : sql`AND d.archived_at IS NULL`}
    ORDER BY d.archived_at NULLS FIRST, d.doc_type, d.title`));
  const files = await attachmentsFor('safety_document', rows.map(r => r.id));
  return rows.map(r => ({
    ...r,
    reviewDue: r.reviewDue ? String(r.reviewDue).slice(0, 10) : null,
    createdAt: isoUtc(r.createdAt),
    updatedAt: isoUtc(r.updatedAt),
    archivedAt: isoUtc(r.archivedAt),
    files: (files.get(r.id) ?? []).map(toApiAttachment),
  }));
}

export async function createDocument(farmId: string, userId: string, input: DocumentInput) {
  const [row] = rowsOf(await db.execute(sql`
    INSERT INTO safety_documents (farm_id, title, doc_type, review_due, notes, created_by)
    VALUES (${farmId}, ${input.title}, ${input.docType}, ${input.reviewDue ?? null}, ${input.notes ?? null}, ${userId})
    RETURNING id`));
  return { id: row.id as string };
}

export async function updateDocument(farmId: string, id: string, input: Partial<DocumentInput> & { archived?: boolean }) {
  const sets = [sql`updated_at = now()`];
  if (input.title !== undefined) sets.push(sql`title = ${input.title}`);
  if (input.docType !== undefined) sets.push(sql`doc_type = ${input.docType}`);
  if (input.reviewDue !== undefined) sets.push(sql`review_due = ${input.reviewDue}`);
  if (input.notes !== undefined) sets.push(sql`notes = ${input.notes}`);
  if (input.archived !== undefined) sets.push(input.archived ? sql`archived_at = COALESCE(archived_at, now())` : sql`archived_at = NULL`);
  const rows = rowsOf(await db.execute(sql`UPDATE safety_documents SET ${sql.join(sets, sql`, `)} WHERE id = ${id} AND farm_id = ${farmId} RETURNING id`));
  if (!rows.length) throw new MapError('Document not found', 404);
}

export async function documentExists(farmId: string, id: string) {
  return rowsOf(await db.execute(sql`SELECT 1 FROM safety_documents WHERE id = ${id} AND farm_id = ${farmId}`)).length > 0;
}
