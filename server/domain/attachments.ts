import { db } from '../db';
import { attachments, farmRecords, jobs, tasks, animals, type Attachment, type TaggableType } from '@shared/schema';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { saveFileBuffer, deleteFile } from '../services/fileStorage';
import { ATTACHMENT_TYPES } from '../middleware/upload';

// Things files can be attached to through the generic attachments API
export const ATTACHABLE_TYPES = ['record', 'job', 'task', 'animal'] as const;
export type AttachableType = typeof ATTACHABLE_TYPES[number];

/**
 * Whether a record, job, task or animal exists on this farm
 */
export async function entityBelongsToFarm(entityType: AttachableType, entityId: string, farmId: string): Promise<boolean> {
  const table = { record: farmRecords, job: jobs, task: tasks, animal: animals }[entityType];
  const conditions = [eq(table.id, entityId), eq(table.farmId, farmId)];
  if (entityType === 'record') conditions.push(isNull(farmRecords.deletedAt));
  const [row] = await db.select({ id: table.id }).from(table).where(and(...conditions)).limit(1);
  return !!row;
}

export interface AttachmentMeta {
  caption?: string;
  latitude?: number;
  longitude?: number;
  takenAt?: Date;
}

/**
 * Store uploaded files and link them to one thing on the farm
 */
export async function saveAttachments(
  farmId: string,
  entityType: TaggableType,
  entityId: string,
  files: Express.Multer.File[],
  uploadedBy: string,
  meta: AttachmentMeta = {},
): Promise<Attachment[]> {
  if (files.length === 0) return [];
  const values = await Promise.all(files.map(async file => {
    const mimeType = file.mimetype.split(';')[0].trim().toLowerCase();
    const kind = ATTACHMENT_TYPES[mimeType] ?? 'document';
    const { storageKey, publicUrl } = await saveFileBuffer(file.buffer, mimeType, file.originalname, `attachments/${farmId}`);
    return {
      farmId,
      entityType,
      entityId,
      kind,
      url: publicUrl,
      storageKey,
      fileName: file.originalname,
      mimeType,
      fileSize: file.size,
      caption: meta.caption,
      latitude: meta.latitude?.toString(),
      longitude: meta.longitude?.toString(),
      takenAt: meta.takenAt,
      uploadedBy,
    };
  }));
  return db.insert(attachments).values(values).returning();
}

/**
 * Attachments for many things at once, keyed by entity id
 */
export async function attachmentsFor(entityType: TaggableType, entityIds: string[]): Promise<Map<string, Attachment[]>> {
  const map = new Map<string, Attachment[]>();
  if (entityIds.length === 0) return map;
  const rows = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.entityType, entityType), inArray(attachments.entityId, entityIds)))
    .orderBy(asc(attachments.createdAt));
  for (const row of rows) map.set(row.entityId, [...(map.get(row.entityId) ?? []), row]);
  return map;
}

export async function deleteAttachment(farmId: string, id: string): Promise<boolean> {
  const [row] = await db
    .delete(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.farmId, farmId)))
    .returning();
  if (!row) return false;
  try {
    await deleteFile(row.storageKey);
  } catch {
    // The database row is gone; a leftover file is harmless
  }
  return true;
}

export function toApiAttachment(a: Attachment) {
  return {
    id: a.id,
    kind: a.kind,
    url: a.url,
    fileName: a.fileName,
    mimeType: a.mimeType,
    fileSize: a.fileSize,
    caption: a.caption,
    latitude: a.latitude != null ? Number(a.latitude) : null,
    longitude: a.longitude != null ? Number(a.longitude) : null,
    takenAt: a.takenAt?.toISOString() ?? null,
    uploadedBy: a.uploadedBy,
    createdAt: a.createdAt.toISOString(),
  };
}
