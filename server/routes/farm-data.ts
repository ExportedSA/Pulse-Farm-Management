/**
 * Tags, attachments and farm-wide search (behind requireAuth):
 *   /api/tags         list, create, and set the tags on a record/job/task/animal
 *   /api/attachments  add, list and remove files on a record/job/task/animal
 *   /api/search       one search across records, jobs, tasks, animals, paddocks and chat
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { jobs, tasks, animals, pastures, chatMessages, chatChannels, chatChannelMembers, users } from '@shared/schema';
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { getFarmId, getUserId, requireFarm } from '../middleware/auth';
import { uploadAttachments } from '../middleware/upload';
import { listTags, createTag, setTags, tagsFor, entityIdsWithTags } from '../domain/tags';
import {
  ATTACHABLE_TYPES,
  entityBelongsToFarm,
  saveAttachments,
  attachmentsFor,
  deleteAttachment,
  toApiAttachment,
} from '../domain/attachments';
import { listRecords, toApiRecords } from '../domain/records';

export const tagsRouter = Router();
export const attachmentsRouter = Router();
export const searchRouter = Router();
for (const r of [tagsRouter, attachmentsRouter, searchRouter]) r.use(requireFarm);

const entitySchema = z.object({
  entityType: z.enum(ATTACHABLE_TYPES),
  entityId: z.string().uuid(),
});

/**
 * Validate :entityType/:entityId and that the thing is on the caller's farm
 */
async function loadEntity(req: Request, res: Response) {
  const parsed = entitySchema.safeParse(req.params);
  if (!parsed.success || !(await entityBelongsToFarm(parsed.data.entityType, parsed.data.entityId, getFarmId(req)!))) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  return parsed.data;
}

function handleError(res: Response, error: unknown, message: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: error.errors });
  }
  console.error(`${message}:`, error);
  res.status(500).json({ error: message });
}

const toApiTag = (t: { id: string; name: string; slug: string; color: string | null; isDefault?: boolean }) =>
  ({ id: t.id, name: t.name, slug: t.slug, color: t.color, isDefault: t.isDefault ?? false });

// ===== TAGS =====

// GET /api/tags - the farm's tags (defaults are created on first use)
tagsRouter.get('/', async (req, res) => {
  try {
    res.json((await listTags(getFarmId(req)!)).map(toApiTag));
  } catch (error) {
    handleError(res, error, 'Failed to fetch tags');
  }
});

// POST /api/tags - add a farm tag
tagsRouter.post('/', async (req, res) => {
  try {
    const { name, color } = z.object({
      name: z.string().trim().min(1).max(60),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    }).parse(req.body);
    res.status(201).json(toApiTag(await createTag(getFarmId(req)!, name, color)));
  } catch (error) {
    handleError(res, error, 'Failed to create tag');
  }
});

// GET /api/tags/:entityType/:entityId
tagsRouter.get('/:entityType/:entityId', async (req, res) => {
  try {
    const entity = await loadEntity(req, res);
    if (!entity) return;
    const map = await tagsFor(entity.entityType, [entity.entityId]);
    res.json((map.get(entity.entityId) ?? []).map(toApiTag));
  } catch (error) {
    handleError(res, error, 'Failed to fetch tags');
  }
});

// PUT /api/tags/:entityType/:entityId { tags: ["Fencing", "job done"] } - replaces the tags
tagsRouter.put('/:entityType/:entityId', async (req, res) => {
  try {
    const entity = await loadEntity(req, res);
    if (!entity) return;
    const { tags } = z.object({ tags: z.array(z.string().trim().min(1).max(60)).max(20) }).parse(req.body);
    const saved = await setTags(getFarmId(req)!, entity.entityType, entity.entityId, tags);
    res.json(saved.map(toApiTag));
  } catch (error) {
    handleError(res, error, 'Failed to save tags');
  }
});

// ===== ATTACHMENTS =====

function withUploads(req: Request, res: Response, next: NextFunction) {
  uploadAttachments(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

// GET /api/attachments/:entityType/:entityId
attachmentsRouter.get('/:entityType/:entityId', async (req, res) => {
  try {
    const entity = await loadEntity(req, res);
    if (!entity) return;
    const map = await attachmentsFor(entity.entityType, [entity.entityId]);
    res.json((map.get(entity.entityId) ?? []).map(toApiAttachment));
  } catch (error) {
    handleError(res, error, 'Failed to fetch attachments');
  }
});

// POST /api/attachments/:entityType/:entityId (multipart `files`, optional caption/latitude/longitude)
attachmentsRouter.post('/:entityType/:entityId', withUploads, async (req, res) => {
  try {
    const entity = await loadEntity(req, res);
    if (!entity) return;
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) return res.status(400).json({ error: 'Attach at least one file' });
    const meta = z.object({
      caption: z.string().max(500).optional(),
      latitude: z.coerce.number().optional(),
      longitude: z.coerce.number().optional(),
    }).parse(req.body);
    const saved = await saveAttachments(getFarmId(req)!, entity.entityType, entity.entityId, files, getUserId(req)!, meta);
    res.status(201).json(saved.map(toApiAttachment));
  } catch (error) {
    handleError(res, error, 'Failed to attach files');
  }
});

// DELETE /api/attachments/:id
attachmentsRouter.delete('/:id', async (req, res) => {
  try {
    if (!z.string().uuid().safeParse(req.params.id).success) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    const deleted = await deleteAttachment(getFarmId(req)!, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Attachment not found' });
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Failed to delete attachment');
  }
});

// ===== SEARCH =====

const PER_KIND = 8;

// GET /api/search?q=spray north&tags=fencing,medical
searchRouter.get('/', async (req, res) => {
  try {
    const { q, tags } = z.object({
      q: z.string().trim().max(200).default(''),
      tags: z.string().max(500).optional(),
    }).parse(req.query);
    const tagSlugs = tags ? tags.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (q.length < 2 && tagSlugs.length === 0) {
      return res.json({ query: q, tags: tagSlugs, total: 0, results: { records: [], jobs: [], tasks: [], animals: [], paddocks: [], messages: [] } });
    }

    const farmId = getFarmId(req)!;
    const userId = getUserId(req)!;
    const like = `%${q.replace(/[%_\\]/g, m => `\\${m}`)}%`;
    const hasText = q.length >= 2;

    // Tag filters narrow each kind to the things carrying every tag
    const tagged = async (type: 'job' | 'task' | 'animal') =>
      tagSlugs.length ? entityIdsWithTags(farmId, type, tagSlugs) : null;
    const [jobIds, taskIds, animalIds] = await Promise.all([tagged('job'), tagged('task'), tagged('animal')]);
    const restrict = (column: any, ids: string[] | null) => (ids ? inArray(column, ids) : undefined);

    const [records, jobRows, taskRows, animalRows, paddockRows, messageRows] = await Promise.all([
      listRecords(farmId, { q: hasText ? q : undefined, tags: tagSlugs, limit: PER_KIND }),
      db.select({ id: jobs.id, title: jobs.title, status: jobs.status, location: jobs.location, updatedAt: jobs.updatedAt })
        .from(jobs)
        .where(and(
          eq(jobs.farmId, farmId),
          restrict(jobs.id, jobIds),
          hasText ? or(ilike(jobs.title, like), ilike(jobs.description, like), ilike(jobs.location, like), ilike(jobs.notes, like)) : undefined,
        ))
        .orderBy(desc(jobs.updatedAt)).limit(PER_KIND),
      db.select({ id: tasks.id, title: tasks.title, status: tasks.status, dueDate: tasks.dueDate })
        .from(tasks)
        .where(and(
          eq(tasks.farmId, farmId),
          restrict(tasks.id, taskIds),
          hasText ? or(ilike(tasks.title, like), ilike(tasks.description, like), ilike(tasks.location, like)) : undefined,
        ))
        .orderBy(desc(tasks.updatedAt)).limit(PER_KIND),
      db.select({ id: animals.id, name: animals.name, visualId: animals.visualId, eid: animals.eid, status: animals.status })
        .from(animals)
        .where(and(
          eq(animals.farmId, farmId),
          restrict(animals.id, animalIds),
          hasText ? or(ilike(animals.name, like), ilike(animals.visualId, like), ilike(animals.eid, like), ilike(animals.cowId, like)) : undefined,
        ))
        .limit(PER_KIND),
      // Paddocks and chat have no tags yet
      hasText && tagSlugs.length === 0
        ? db.select({ id: pastures.id, name: pastures.name, paddockNumber: pastures.paddockNumber })
            .from(pastures)
            .where(and(eq(pastures.farmId, farmId), isNull(pastures.deletedAt), or(ilike(pastures.name, like), sql`${pastures.paddockNumber}::text ILIKE ${like}`)))
            .limit(PER_KIND)
        : [],
      hasText && tagSlugs.length === 0
        ? db.select({
              id: chatMessages.id,
              body: chatMessages.body,
              channelId: chatMessages.channelId,
              channelName: chatChannels.name,
              author: users.name,
              createdAt: chatMessages.createdAt,
            })
            .from(chatMessages)
            .innerJoin(chatChannelMembers, and(eq(chatChannelMembers.channelId, chatMessages.channelId), eq(chatChannelMembers.userId, userId)))
            .innerJoin(chatChannels, eq(chatChannels.id, chatMessages.channelId))
            .leftJoin(users, eq(users.id, chatMessages.userId))
            .where(ilike(chatMessages.body, like))
            .orderBy(desc(chatMessages.createdAt))
            .limit(PER_KIND)
        : [],
    ]);

    const [apiRecords, jobTags, taskTags, animalTags] = await Promise.all([
      toApiRecords(records),
      tagsFor('job', jobRows.map(j => j.id)),
      tagsFor('task', taskRows.map(t => t.id)),
      tagsFor('animal', animalRows.map(a => a.id)),
    ]);
    const names = (m: Map<string, { name: string }[]>, id: string) => (m.get(id) ?? []).map(t => t.name);

    const results = {
      records: apiRecords,
      jobs: jobRows.map(j => ({ ...j, tags: names(jobTags, j.id) })),
      tasks: taskRows.map(t => ({ ...t, tags: names(taskTags, t.id) })),
      animals: animalRows.map(a => ({ ...a, tags: names(animalTags, a.id) })),
      paddocks: paddockRows,
      messages: messageRows,
    };
    const total = Object.values(results).reduce((n, list) => n + list.length, 0);
    res.json({ query: q, tags: tagSlugs, total, results });
  } catch (error) {
    handleError(res, error, 'Search failed');
  }
});
