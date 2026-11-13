import { db } from '../db';
import { tags, taggings, type Tag, type TaggableType } from '@shared/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';

// Every farm starts with these; farms can add their own
export const DEFAULT_TAGS: { name: string; color: string }[] = [
  { name: 'Job done', color: '#2c6a3f' },
  { name: 'Fencing', color: '#7a5c2e' },
  { name: 'Medical', color: '#b03a48' },
  { name: 'Health & safety', color: '#d9480f' },
  { name: 'Fertiliser', color: '#5c940d' },
  { name: 'Spray', color: '#9c36b5' },
  { name: 'Feed', color: '#a87d10' },
  { name: 'Effluent', color: '#5f3dc4' },
  { name: 'Maintenance', color: '#1971c2' },
  { name: 'Water', color: '#0c8599' },
  { name: 'Compliance', color: '#495057' },
];

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * The farm's tags, creating the default set the first time
 */
export async function listTags(farmId: string): Promise<Tag[]> {
  let rows = await db.select().from(tags).where(eq(tags.farmId, farmId)).orderBy(asc(tags.name));
  if (rows.length === 0) {
    await db
      .insert(tags)
      .values(DEFAULT_TAGS.map(t => ({ farmId, name: t.name, slug: slugify(t.name), color: t.color, isDefault: true })))
      .onConflictDoNothing();
    rows = await db.select().from(tags).where(eq(tags.farmId, farmId)).orderBy(asc(tags.name));
  }
  return rows;
}

export async function createTag(farmId: string, name: string, color?: string): Promise<Tag> {
  const slug = slugify(name);
  if (!slug) throw new Error('Tag name needs letters or numbers');
  await db.insert(tags).values({ farmId, name: name.trim(), slug, color }).onConflictDoNothing();
  const [tag] = await db.select().from(tags).where(and(eq(tags.farmId, farmId), eq(tags.slug, slug)));
  return tag;
}

/**
 * Resolve tag names or slugs to the farm's tags, creating any that don't exist yet
 */
export async function resolveTags(farmId: string, names: string[]): Promise<Tag[]> {
  const wanted = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)));
  if (wanted.length === 0) return [];
  const existing = await listTags(farmId);
  const bySlug = new Map(existing.map(t => [t.slug, t]));
  const result: Tag[] = [];
  for (const name of wanted) {
    const slug = slugify(name);
    if (!slug) continue;
    result.push(bySlug.get(slug) ?? await createTag(farmId, name));
  }
  return result;
}

/**
 * Replace the tags on one thing
 */
export async function setTags(farmId: string, entityType: TaggableType, entityId: string, names: string[]): Promise<Tag[]> {
  const resolved = await resolveTags(farmId, names);
  const farmTagIds = (await listTags(farmId)).map(t => t.id);
  if (farmTagIds.length > 0) {
    await db.delete(taggings).where(and(
      eq(taggings.entityType, entityType),
      eq(taggings.entityId, entityId),
      inArray(taggings.tagId, farmTagIds),
    ));
  }
  if (resolved.length > 0) {
    await db
      .insert(taggings)
      .values(resolved.map(t => ({ tagId: t.id, entityType, entityId })))
      .onConflictDoNothing();
  }
  return resolved;
}

/**
 * Tags for many things at once, keyed by entity id
 */
export async function tagsFor(entityType: TaggableType, entityIds: string[]): Promise<Map<string, Tag[]>> {
  const map = new Map<string, Tag[]>();
  if (entityIds.length === 0) return map;
  const rows = await db
    .select({ entityId: taggings.entityId, tag: tags })
    .from(taggings)
    .innerJoin(tags, eq(taggings.tagId, tags.id))
    .where(and(eq(taggings.entityType, entityType), inArray(taggings.entityId, entityIds)));
  for (const { entityId, tag } of rows) {
    map.set(entityId, [...(map.get(entityId) ?? []), tag]);
  }
  return map;
}

/**
 * IDs of things of one type carrying all of the given tag slugs
 */
export async function entityIdsWithTags(farmId: string, entityType: TaggableType, slugs: string[]): Promise<string[]> {
  const wanted = Array.from(new Set(slugs.map(slugify).filter(Boolean)));
  if (wanted.length === 0) return [];
  const rows = await db
    .select({ entityId: taggings.entityId, slug: tags.slug })
    .from(taggings)
    .innerJoin(tags, eq(taggings.tagId, tags.id))
    .where(and(eq(tags.farmId, farmId), eq(taggings.entityType, entityType), inArray(tags.slug, wanted)));
  const counts = new Map<string, Set<string>>();
  for (const r of rows) counts.set(r.entityId, (counts.get(r.entityId) ?? new Set()).add(r.slug));
  return Array.from(counts.entries()).filter(([, s]) => s.size === wanted.length).map(([id]) => id);
}
