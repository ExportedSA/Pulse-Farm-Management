import { db } from '../db';
import { animals, animalHealthRecords, users, type Animal } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ===== CUSTOM ERROR CLASSES =====

/**
 * Error thrown when an animal is not found or doesn't belong to the specified farm.
 */
export class AnimalNotFoundError extends Error {
  constructor(animalId: string, farmId?: string) {
    super(farmId 
      ? `Animal ${animalId} not found or does not belong to farm ${farmId}`
      : `Animal ${animalId} not found`
    );
    this.name = 'AnimalNotFoundError';
  }
}

/**
 * Error thrown when a user doesn't have permission to perform an action.
 */
export class PermissionDeniedError extends Error {
  constructor(message: string = 'Permission denied') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

// ===== TYPES =====

export type HealthRecordType = 'illness' | 'treatment' | 'vaccination' | 'injury' | 'observation' | 'checkup' | 'other';
export type HealthRecordSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface CreateHealthRecordParams {
  farmId: string;
  animalId: string;
  recordedById: string;
  date: string;
  type: HealthRecordType;
  description: string;
  notes?: string;
  severity?: HealthRecordSeverity;
  treatmentId?: string;
  vetVisitId?: string;
  requiresFollowUp?: boolean;
  followUpDate?: string;
}

export interface HealthRecord {
  id: string;
  animalId: string;
  recordedById: string;
  date: string;
  type: HealthRecordType;
  description: string;
  notes: string | null;
  severity: HealthRecordSeverity | null;
  treatmentId: string | null;
  vetVisitId: string | null;
  requiresFollowUp: boolean | null;
  followUpDate: string | null;
  followUpCompleted: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

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

export async function getAnimal(id: string, farmId?: string): Promise<Animal | null> {
  const conditions = [eq(animals.id, id)];
  
  // If farmId is provided, enforce farm-level access control
  if (farmId) {
    conditions.push(eq(animals.farmId, farmId));
  }

  const [animal] = await db
    .select()
    .from(animals)
    .where(and(...conditions))
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
    breedType?: string;
    origin?: string;
    nationalId?: string;
    dateOfBirth?: string;
    yearBorn?: number;
    sex?: 'female' | 'male';
    herd?: string;
    status?: 'active' | 'sold' | 'deceased';
    milkStatus?: string;
    a2Status?: string;
    notes?: string;
    damId?: string;
    sireId?: string;
  }>,
  farmId?: string
): Promise<Animal | null> {
  const conditions = [eq(animals.id, id)];
  
  // If farmId is provided, enforce farm-level access control
  if (farmId) {
    conditions.push(eq(animals.farmId, farmId));
  }

  const [animal] = await db
    .update(animals)
    .set({
      ...params,
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning();

  return animal || null;
}

/**
 * Soft-delete an animal by changing its status to 'deceased' or 'sold'.
 * This preserves the animal record for historical/compliance purposes.
 * 
 * @param id - The animal ID
 * @param farmId - The farm ID for access control
 * @param removalStatus - The status to set ('sold' or 'deceased')
 * @param removalReason - Optional reason for removal
 * @returns The updated animal record or null if not found
 */
export async function removeAnimal(
  id: string,
  farmId: string,
  removalStatus: 'sold' | 'deceased' = 'deceased',
  removalReason?: string
): Promise<Animal | null> {
  const [animal] = await db
    .update(animals)
    .set({
      status: removalStatus,
      dateRemoved: new Date().toISOString().split('T')[0],
      removalFate: removalStatus === 'sold' ? 'Sold' : 'Died',
      removalReason: removalReason || undefined,
      updatedAt: new Date(),
    })
    .where(and(
      eq(animals.id, id),
      eq(animals.farmId, farmId)
    ))
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

// ===== ANIMAL HEALTH RECORDS =====

/**
 * Retrieves an animal by ID and verifies it belongs to the specified farm.
 * This is a secure helper function that enforces farm-level access control.
 * 
 * @param animalId - The unique identifier of the animal
 * @param farmId - The farm ID to verify ownership against
 * @returns The animal if found and belongs to the farm
 * @throws {AnimalNotFoundError} If animal doesn't exist or doesn't belong to the farm
 * 
 * @example
 * ```typescript
 * const animal = await getAnimalForFarm('animal-123', 'farm-456');
 * console.log(animal.name); // Safe to use - verified ownership
 * ```
 */
export async function getAnimalForFarm(animalId: string, farmId: string): Promise<Animal> {
  const [animal] = await db
    .select()
    .from(animals)
    .where(and(
      eq(animals.id, animalId),
      eq(animals.farmId, farmId)
    ))
    .limit(1);

  if (!animal) {
    throw new AnimalNotFoundError(animalId, farmId);
  }

  return animal;
}

/**
 * Lists all health records for a specific animal belonging to a farm.
 * Enforces farm-level access control by verifying the animal belongs to the farm.
 * 
 * @param farmId - The farm ID for access control verification
 * @param animalId - The animal ID to fetch health records for
 * @param options - Optional filtering and pagination options
 * @returns Array of health records sorted by date (newest first)
 * @throws {AnimalNotFoundError} If animal doesn't exist or doesn't belong to the farm
 * 
 * @example
 * ```typescript
 * const records = await listHealthRecords('farm-123', 'animal-456', {
 *   type: 'vaccination',
 *   limit: 10
 * });
 * ```
 */
export async function listHealthRecords(
  farmId: string,
  animalId: string,
  options?: {
    type?: HealthRecordType;
    severity?: HealthRecordSeverity;
    requiresFollowUp?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<HealthRecord[]> {
  // First verify the animal belongs to this farm
  await getAnimalForFarm(animalId, farmId);

  // Build query conditions
  const conditions = [eq(animalHealthRecords.animalId, animalId)];

  if (options?.type) {
    conditions.push(eq(animalHealthRecords.type, options.type));
  }

  if (options?.severity) {
    conditions.push(eq(animalHealthRecords.severity, options.severity));
  }

  if (options?.requiresFollowUp !== undefined) {
    conditions.push(eq(animalHealthRecords.requiresFollowUp, options.requiresFollowUp));
  }

  let query = db
    .select()
    .from(animalHealthRecords)
    .where(and(...conditions))
    .orderBy(desc(animalHealthRecords.date));

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.offset(options.offset);
  }

  const records = await query;
  return records as HealthRecord[];
}

/**
 * Creates a new health record for an animal.
 * Enforces farm-level access control and optionally validates user permissions.
 * 
 * @param params - The health record creation parameters
 * @param params.farmId - Farm ID for access control (animal must belong to this farm)
 * @param params.animalId - The animal to create the record for
 * @param params.recordedById - User/staff ID who is recording this event
 * @param params.date - Date of the health event (YYYY-MM-DD format)
 * @param params.type - Type of health record (illness, treatment, vaccination, etc.)
 * @param params.description - Detailed description of the health event
 * @param params.notes - Optional additional notes
 * @param params.severity - Optional severity level (low, medium, high, critical)
 * @param params.treatmentId - Optional link to a treatment record
 * @param params.vetVisitId - Optional link to a vet visit record
 * @param params.requiresFollowUp - Whether follow-up is needed
 * @param params.followUpDate - Optional follow-up date
 * @returns The created health record
 * @throws {AnimalNotFoundError} If animal doesn't exist or doesn't belong to the farm
 * @throws {PermissionDeniedError} If user doesn't have permission (future implementation)
 * 
 * @example
 * ```typescript
 * const record = await createHealthRecord({
 *   farmId: 'farm-123',
 *   animalId: 'animal-456',
 *   recordedById: 'user-789',
 *   date: '2024-01-15',
 *   type: 'vaccination',
 *   description: 'Annual BVD vaccination administered',
 *   notes: 'No adverse reactions observed',
 *   severity: 'low'
 * });
 * ```
 */
export async function createHealthRecord(params: CreateHealthRecordParams): Promise<HealthRecord> {
  const { farmId, animalId, recordedById, date, type, description, notes, severity, treatmentId, vetVisitId, requiresFollowUp, followUpDate } = params;

  // Verify the animal exists and belongs to this farm
  await getAnimalForFarm(animalId, farmId);

  // Optional: Verify user permissions (check if user has appropriate role)
  // This can be expanded based on your role system
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, recordedById))
    .limit(1);

  if (!user) {
    throw new PermissionDeniedError(`User ${recordedById} not found`);
  }

  // Future: Add role-based permission check
  // const allowedRoles = ['admin', 'manager', 'vet', 'worker'];
  // if (!allowedRoles.includes(user.role)) {
  //   throw new PermissionDeniedError(`User role '${user.role}' is not authorized to create health records`);
  // }

  // Create the health record
  const [record] = await db
    .insert(animalHealthRecords)
    .values({
      animalId,
      recordedById,
      date,
      type,
      description,
      notes: notes || null,
      severity: severity || 'low',
      treatmentId: treatmentId || null,
      vetVisitId: vetVisitId || null,
      requiresFollowUp: requiresFollowUp || false,
      followUpDate: followUpDate || null,
      followUpCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return record as HealthRecord;
}

/**
 * Updates an existing health record.
 * Enforces farm-level access control by verifying the animal belongs to the farm.
 * 
 * @param farmId - Farm ID for access control
 * @param recordId - The health record ID to update
 * @param params - Fields to update
 * @returns The updated health record
 * @throws {AnimalNotFoundError} If the record's animal doesn't belong to the farm
 * 
 * @example
 * ```typescript
 * const updated = await updateHealthRecord('farm-123', 'record-456', {
 *   followUpCompleted: true,
 *   notes: 'Follow-up completed, animal recovered'
 * });
 * ```
 */
export async function updateHealthRecord(
  farmId: string,
  recordId: string,
  params: Partial<{
    date: string;
    type: HealthRecordType;
    description: string;
    notes: string;
    severity: HealthRecordSeverity;
    requiresFollowUp: boolean;
    followUpDate: string;
    followUpCompleted: boolean;
  }>
): Promise<HealthRecord | null> {
  // First get the record to verify ownership
  const [existingRecord] = await db
    .select()
    .from(animalHealthRecords)
    .where(eq(animalHealthRecords.id, recordId))
    .limit(1);

  if (!existingRecord) {
    return null;
  }

  // Verify the animal belongs to this farm
  await getAnimalForFarm(existingRecord.animalId, farmId);

  // Update the record
  const [updated] = await db
    .update(animalHealthRecords)
    .set({
      ...params,
      updatedAt: new Date(),
    })
    .where(eq(animalHealthRecords.id, recordId))
    .returning();

  return updated as HealthRecord;
}

/**
 * Deletes a health record.
 * Enforces farm-level access control by verifying the animal belongs to the farm.
 * 
 * @param farmId - Farm ID for access control
 * @param recordId - The health record ID to delete
 * @returns True if deleted, false if not found
 * @throws {AnimalNotFoundError} If the record's animal doesn't belong to the farm
 * 
 * @example
 * ```typescript
 * const deleted = await deleteHealthRecord('farm-123', 'record-456');
 * if (deleted) {
 *   console.log('Record deleted successfully');
 * }
 * ```
 */
export async function deleteHealthRecord(farmId: string, recordId: string): Promise<boolean> {
  // First get the record to verify ownership
  const [existingRecord] = await db
    .select()
    .from(animalHealthRecords)
    .where(eq(animalHealthRecords.id, recordId))
    .limit(1);

  if (!existingRecord) {
    return false;
  }

  // Verify the animal belongs to this farm
  await getAnimalForFarm(existingRecord.animalId, farmId);

  // Delete the record
  const result = await db
    .delete(animalHealthRecords)
    .where(eq(animalHealthRecords.id, recordId));

  return (result.rowCount ?? 0) > 0;
}

/**
 * Gets health records requiring follow-up for a farm.
 * Useful for dashboard alerts and task management.
 * 
 * @param farmId - The farm ID to get pending follow-ups for
 * @param options - Optional filtering options
 * @returns Array of health records with pending follow-ups
 * 
 * @example
 * ```typescript
 * const pendingFollowUps = await getPendingFollowUps('farm-123', {
 *   overdueDaysThreshold: 7
 * });
 * ```
 */
export async function getPendingFollowUps(
  farmId: string,
  options?: {
    limit?: number;
  }
): Promise<(HealthRecord & { animal: Animal })[]> {
  // Get all animals for this farm first
  const farmAnimals = await db
    .select({ id: animals.id })
    .from(animals)
    .where(eq(animals.farmId, farmId));

  const animalIds = farmAnimals.map(a => a.id);

  if (animalIds.length === 0) {
    return [];
  }

  // Get health records with pending follow-ups for these animals
  let query = db
    .select({
      record: animalHealthRecords,
      animal: animals,
    })
    .from(animalHealthRecords)
    .innerJoin(animals, eq(animalHealthRecords.animalId, animals.id))
    .where(and(
      eq(animalHealthRecords.requiresFollowUp, true),
      eq(animalHealthRecords.followUpCompleted, false),
      eq(animals.farmId, farmId)
    ))
    .orderBy(animalHealthRecords.followUpDate);

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const results = await query;
  
  return results.map(r => ({
    ...r.record as HealthRecord,
    animal: r.animal,
  }));
}
