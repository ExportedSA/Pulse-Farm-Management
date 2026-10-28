import { db } from '../db';
import { farmRecords, pastures, users, type FarmRecord, type FarmRecordType } from '@shared/schema';
import { and, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { setTags, tagsFor, entityIdsWithTags } from './tags';
import { attachmentsFor, toApiAttachment } from './attachments';
import { areaHectares, type AreaGeometry } from '@shared/geo';

export class RecordValidationError extends Error {}

export interface RecordInput {
  type: FarmRecordType;
  title: string;
  notes?: string | null;
  occurredAt: Date;
  pastureIds?: string[];
  latitude?: number | null;
  longitude?: number | null;
  area?: AreaGeometry | null;
  details?: Record<string, any>;
  tags?: string[];
}

/**
 * Only the farm's own paddocks can be referenced
 */
async function checkPastures(farmId: string, ids: string[]): Promise<string[]> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return [];
  const found = await db
    .select({ id: pastures.id })
    .from(pastures)
    .where(and(inArray(pastures.id, unique), eq(pastures.farmId, farmId)));
  if (found.length !== unique.length) {
    throw new RecordValidationError('One or more paddocks are not on this farm');
  }
  return unique;
}

/**
 * Save a record. A repeat with the same clientId (an offline retry) returns the
 * record saved the first time instead of creating a duplicate.
 */
export async function createRecord(
  farmId: string,
  userId: string,
  input: RecordInput,
  clientId?: string,
): Promise<{ record: FarmRecord; created: boolean }> {
  if (clientId) {
    const [existing] = await db
      .select()
      .from(farmRecords)
      .where(and(eq(farmRecords.farmId, farmId), eq(farmRecords.clientId, clientId)));
    if (existing) return { record: existing, created: false };
  }

  const pastureIds = await checkPastures(farmId, input.pastureIds ?? []);
  const [record] = await db
    .insert(farmRecords)
    .values({
      farmId,
      type: input.type,
      title: input.title,
      notes: input.notes ?? null,
      occurredAt: input.occurredAt,
      pastureIds,
      latitude: input.latitude?.toString() ?? null,
      longitude: input.longitude?.toString() ?? null,
      area: input.area ?? null,
      areaHa: input.area ? areaHectares(input.area).toFixed(2) : null,
      details: input.details ?? {},
      recordedBy: userId,
      clientId: clientId ?? null,
    })
    .onConflictDoNothing()
    .returning();

  if (!record) {
    // Lost a race with the same clientId arriving twice at once
    const [existing] = await db
      .select()
      .from(farmRecords)
      .where(and(eq(farmRecords.farmId, farmId), eq(farmRecords.clientId, clientId!)));
    return { record: existing, created: false };
  }

  await setTags(farmId, 'record', record.id, input.tags ?? []);
  return { record, created: true };
}

export async function getRecord(farmId: string, id: string): Promise<FarmRecord | undefined> {
  const [record] = await db
    .select()
    .from(farmRecords)
    .where(and(eq(farmRecords.id, id), eq(farmRecords.farmId, farmId), isNull(farmRecords.deletedAt)));
  return record;
}

export async function updateRecord(farmId: string, id: string, input: Partial<RecordInput>): Promise<FarmRecord | undefined> {
  const existing = await getRecord(farmId, id);
  if (!existing) return undefined;

  const { tags, pastureIds, latitude, longitude, area, ...rest } = input;
  const updates: Partial<typeof farmRecords.$inferInsert> = { ...rest, updatedAt: new Date() };
  if (area !== undefined) {
    updates.area = area;
    updates.areaHa = area ? areaHectares(area).toFixed(2) : null;
  }
  if (pastureIds !== undefined) updates.pastureIds = await checkPastures(farmId, pastureIds);
  if (latitude !== undefined) updates.latitude = latitude?.toString() ?? null;
  if (longitude !== undefined) updates.longitude = longitude?.toString() ?? null;

  const [record] = await db.update(farmRecords).set(updates).where(eq(farmRecords.id, id)).returning();
  if (tags !== undefined) await setTags(farmId, 'record', id, tags);
  return record;
}

/**
 * Records are kept for audit history; deleting hides them
 */
export async function deleteRecord(farmId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(farmRecords)
    .set({ deletedAt: new Date() })
    .where(and(eq(farmRecords.id, id), eq(farmRecords.farmId, farmId), isNull(farmRecords.deletedAt)))
    .returning({ id: farmRecords.id });
  return rows.length > 0;
}

export interface RecordFilters {
  types?: string[];
  tags?: string[];
  pastureId?: string;
  recordedBy?: string;
  from?: Date;
  to?: Date;
  q?: string;
  limit?: number;
  offset?: number;
}

export async function listRecords(farmId: string, filters: RecordFilters = {}): Promise<FarmRecord[]> {
  const conditions = [eq(farmRecords.farmId, farmId), isNull(farmRecords.deletedAt)];
  if (filters.types?.length) conditions.push(inArray(farmRecords.type, filters.types));
  if (filters.recordedBy) conditions.push(eq(farmRecords.recordedBy, filters.recordedBy));
  if (filters.from) conditions.push(gte(farmRecords.occurredAt, filters.from));
  if (filters.to) conditions.push(lte(farmRecords.occurredAt, filters.to));
  if (filters.pastureId) {
    conditions.push(sql`${farmRecords.pastureIds} @> ${JSON.stringify([filters.pastureId])}::jsonb`);
  }
  if (filters.tags?.length) {
    conditions.push(inArray(farmRecords.id, await entityIdsWithTags(farmId, 'record', filters.tags)));
  }
  const q = filters.q?.trim();
  if (q) {
    // `search` is a generated tsvector column (see migration 0008)
    conditions.push(sql`farm_records.search @@ websearch_to_tsquery('english', ${q})`);
  }

  return db
    .select()
    .from(farmRecords)
    .where(and(...conditions))
    .orderBy(
      q ? sql`ts_rank(farm_records.search, websearch_to_tsquery('english', ${q})) DESC` : desc(farmRecords.occurredAt),
      desc(farmRecords.occurredAt),
    )
    .limit(Math.min(filters.limit ?? 50, 200))
    .offset(filters.offset ?? 0);
}

/**
 * Shape records for the app: with tags, attachments, paddock names and who recorded them
 */
export async function toApiRecords(records: FarmRecord[]) {
  const ids = records.map(r => r.id);
  const pastureIds = Array.from(new Set(records.flatMap(r => r.pastureIds)));
  const userIds = Array.from(new Set(records.map(r => r.recordedBy)));
  const [tagMap, attachmentMap, paddocks, people] = await Promise.all([
    tagsFor('record', ids),
    attachmentsFor('record', ids),
    pastureIds.length ? db.select({ id: pastures.id, name: pastures.name }).from(pastures).where(inArray(pastures.id, pastureIds)) : [],
    userIds.length ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)) : [],
  ]);
  const paddockName = new Map(paddocks.map(p => [p.id, p.name]));
  const personName = new Map(people.map(p => [p.id, p.name]));

  return records.map(r => ({
    id: r.id,
    type: r.type,
    title: r.title,
    notes: r.notes,
    occurredAt: r.occurredAt.toISOString(),
    paddocks: r.pastureIds.map(id => ({ id, name: paddockName.get(id) ?? 'Unknown paddock' })),
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    area: r.area ?? null,
    areaHa: r.areaHa != null ? Number(r.areaHa) : null,
    details: r.details,
    tags: (tagMap.get(r.id) ?? []).map(t => ({ id: t.id, name: t.name, slug: t.slug, color: t.color })),
    attachments: (attachmentMap.get(r.id) ?? []).map(toApiAttachment),
    recordedBy: { id: r.recordedBy, name: personName.get(r.recordedBy) ?? 'Unknown' },
    clientId: r.clientId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/**
 * Records with a drawn area, for map layers (newest first)
 */
export async function listMappedRecords(farmId: string, filters: { types?: string[]; from?: Date; to?: Date }) {
  const conditions = [eq(farmRecords.farmId, farmId), isNull(farmRecords.deletedAt), sql`${farmRecords.area} IS NOT NULL`];
  if (filters.types?.length) conditions.push(inArray(farmRecords.type, filters.types));
  if (filters.from) conditions.push(gte(farmRecords.occurredAt, filters.from));
  if (filters.to) conditions.push(lte(farmRecords.occurredAt, filters.to));
  return db.select().from(farmRecords).where(and(...conditions)).orderBy(desc(farmRecords.occurredAt)).limit(500);
}
