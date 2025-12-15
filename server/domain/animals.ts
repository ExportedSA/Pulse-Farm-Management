import { db } from '../db';
import { animals, type Animal, type InsertAnimal } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function createAnimal(params: {
  farmId: string;
  visualId?: string;
  lifetimeId?: string;
  naitTag?: string;
  eid?: string;
  name?: string;
  breed?: string;
  dateOfBirth?: string;
  yearBorn?: number;
  sex?: 'female' | 'male';
  herd?: string;
  status?: 'active' | 'sold' | 'deceased';
  milkStatus?: string;
  a2Status?: string;
  notes?: string;
}): Promise<Animal> {
  const [animal] = await db.insert(animals).values({
    id: nanoid(),
    ...params,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return animal;
}

export async function listAnimals(
  farmId: string,
  options?: {
    status?: 'active' | 'sold' | 'deceased';
    herd?: string;
    sex?: 'female' | 'male';
    limit?: number;
    offset?: number;
  }
): Promise<Animal[]> {
  const conditions = [eq(animals.farmId, farmId)];
  
  if (options?.status) {
    conditions.push(eq(animals.status, options.status));
  }
  
  if (options?.herd) {
    conditions.push(eq(animals.herd, options.herd));
  }
  
  if (options?.sex) {
    conditions.push(eq(animals.sex, options.sex));
  }

  let query = db
    .select()
    .from(animals)
    .where(and(...conditions))
    .orderBy(desc(animals.createdAt));

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.offset(options.offset);
  }

  return await query;
}

export async function getAnimal(id: string): Promise<Animal | null> {
  const [animal] = await db
    .select()
    .from(animals)
    .where(eq(animals.id, id))
    .limit(1);

  return animal || null;
}

export async function updateAnimal(
  id: string,
  params: Partial<{
    visualId?: string;
    lifetimeId?: string;
    naitTag?: string;
    eid?: string;
    name?: string;
    breed?: string;
    dateOfBirth?: string;
    yearBorn?: number;
    sex?: 'female' | 'male';
    herd?: string;
    status?: 'active' | 'sold' | 'deceased';
    milkStatus?: string;
    a2Status?: string;
    notes?: string;
  }>
): Promise<Animal | null> {
  const [animal] = await db
    .update(animals)
    .set({
      ...params,
      updatedAt: new Date(),
    })
    .where(eq(animals.id, id))
    .returning();

  return animal || null;
}

export async function deleteAnimal(id: string): Promise<boolean> {
  const result = await db
    .delete(animals)
    .where(eq(animals.id, id));

  return result.rowCount > 0;
}

export async function getAnimalByTag(tag: string): Promise<Animal | null> {
  const [animal] = await db
    .select()
    .from(animals)
    .where(eq(animals.visualId, tag))
    .limit(1);

  return animal || null;
}

export async function searchAnimals(
  farmId: string,
  searchTerm: string,
  limit: number = 50
): Promise<Animal[]> {
  return await db
    .select()
    .from(animals)
    .where(
      and(
        eq(animals.farmId, farmId),
        // Search in multiple fields
        // Note: This is a simple search. For production, consider using pg_trgm for better text search
        `(
          ${animals.visualId} ILIKE ${'%' + searchTerm + '%'} OR
          ${animals.name} ILIKE ${'%' + searchTerm + '%'} OR
          ${animals.lifetimeId} ILIKE ${'%' + searchTerm + '%'} OR
          ${animals.eid} ILIKE ${'%' + searchTerm + '%'}
        )`
      )
    )
    .limit(limit);
}
