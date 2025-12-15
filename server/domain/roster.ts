import { db } from '../db';
import { 
  rosterEntries, 
  staffProfiles,
  users,
  jobs,
  type RosterEntry,
  type InsertRosterEntry 
} from '@shared/schema';
import { eq, and, desc, gte, lte, between } from 'drizzle-orm';

// ===== CUSTOM ERROR CLASSES =====

export class RosterEntryNotFoundError extends Error {
  constructor(entryId: string, farmId?: string) {
    super(farmId 
      ? `Roster entry ${entryId} not found or does not belong to farm ${farmId}`
      : `Roster entry ${entryId} not found`
    );
    this.name = 'RosterEntryNotFoundError';
  }
}

export class PermissionDeniedError extends Error {
  constructor(message: string = 'Permission denied') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class SchedulingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchedulingConflictError';
  }
}

// ===== TYPES =====

export type RosterStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface CreateRosterEntryParams {
  farmId: string;
  staffProfileId: string;
  date: string; // YYYY-MM-DD format
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  breakMinutes?: number;
  role?: string;
  position?: string;
  jobId?: string;
  location?: string;
  pastureId?: string;
  notes?: string;
  color?: string;
  createdById: string;
}

export interface UpdateRosterEntryParams {
  date?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  role?: string;
  position?: string;
  jobId?: string | null;
  status?: RosterStatus;
  location?: string;
  pastureId?: string | null;
  notes?: string;
  color?: string;
}

// ===== HELPER FUNCTIONS =====

/**
 * Verify that a staff profile belongs to the farm
 */
async function verifyStaffInFarm(staffProfileId: string, farmId: string): Promise<boolean> {
  // Check if staff profile exists and is active
  const [staff] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.id, staffProfileId))
    .limit(1);
  
  if (!staff) return false;
  
  // Check if the associated user is active
  if (staff.userId) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, staff.userId), eq(users.isActive, true)))
      .limit(1);
    
    return !!user;
  }
  
  return true;
}

/**
 * Check if user has manager/admin role (can manage roster)
 */
export async function canManageRoster(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!user) return false;
  const role = user.role?.toLowerCase();
  return role === 'manager' || role === 'admin' || role === 'owner';
}

/**
 * Check for scheduling conflicts (overlapping shifts for same staff)
 */
async function checkSchedulingConflict(
  staffProfileId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeEntryId?: string
): Promise<RosterEntry | null> {
  // Get all entries for this staff on this date
  const entries = await db
    .select()
    .from(rosterEntries)
    .where(and(
      eq(rosterEntries.staffProfileId, staffProfileId),
      eq(rosterEntries.date, date)
    ));

  // Check for time overlap
  for (const entry of entries) {
    // Skip the entry being updated
    if (excludeEntryId && entry.id === excludeEntryId) continue;
    
    // Skip cancelled entries
    if (entry.status === 'cancelled') continue;

    // Check for overlap: new shift starts before existing ends AND new shift ends after existing starts
    const existingStart = entry.startTime;
    const existingEnd = entry.endTime;
    
    if (startTime < existingEnd && endTime > existingStart) {
      return entry;
    }
  }

  return null;
}

// ===== ROSTER FUNCTIONS =====

/**
 * Create a new roster entry (shift)
 * @param params - Roster entry parameters
 * @param checkConflicts - Whether to check for scheduling conflicts (default: true)
 */
export async function createRosterEntry(
  params: CreateRosterEntryParams,
  checkConflicts: boolean = true
): Promise<RosterEntry> {
  const {
    farmId,
    staffProfileId,
    date,
    startTime,
    endTime,
    breakMinutes = 0,
    role,
    position,
    jobId,
    location,
    pastureId,
    notes,
    color,
    createdById,
  } = params;

  // Validate staff belongs to farm
  const isValidStaff = await verifyStaffInFarm(staffProfileId, farmId);
  if (!isValidStaff) {
    throw new ValidationError('Staff member does not exist or is inactive');
  }

  // Validate job belongs to farm if provided
  if (jobId) {
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.farmId, farmId)))
      .limit(1);
    
    if (!job) {
      throw new ValidationError('Job does not exist or does not belong to this farm');
    }
  }

  // Check for scheduling conflicts
  if (checkConflicts) {
    const conflict = await checkSchedulingConflict(staffProfileId, date, startTime, endTime);
    if (conflict) {
      throw new SchedulingConflictError(
        `Staff member already has a shift scheduled from ${conflict.startTime} to ${conflict.endTime} on ${date}`
      );
    }
  }

  // Validate time format and logic
  if (startTime >= endTime) {
    throw new ValidationError('End time must be after start time');
  }

  const [entry] = await db.insert(rosterEntries).values({
    farmId,
    staffProfileId,
    date,
    startTime,
    endTime,
    breakMinutes,
    role,
    position,
    jobId,
    status: 'scheduled',
    location,
    pastureId,
    notes,
    color,
    createdById,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return entry;
}

/**
 * List roster entries for a farm
 */
export async function listRoster(
  farmId: string,
  options?: {
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
    staffProfileId?: string;
    status?: RosterStatus;
    role?: string;
    limit?: number;
    offset?: number;
  }
): Promise<RosterEntry[]> {
  const conditions = [eq(rosterEntries.farmId, farmId)];

  if (options?.startDate) {
    conditions.push(gte(rosterEntries.date, options.startDate));
  } else {
    // Default: show from today onwards
    const today = new Date().toISOString().split('T')[0];
    conditions.push(gte(rosterEntries.date, today));
  }

  if (options?.endDate) {
    conditions.push(lte(rosterEntries.date, options.endDate));
  }

  if (options?.staffProfileId) {
    conditions.push(eq(rosterEntries.staffProfileId, options.staffProfileId));
  }

  if (options?.status) {
    conditions.push(eq(rosterEntries.status, options.status));
  }

  if (options?.role) {
    conditions.push(eq(rosterEntries.role, options.role));
  }

  let query = db
    .select()
    .from(rosterEntries)
    .where(and(...conditions))
    .orderBy(rosterEntries.date, rosterEntries.startTime);

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.offset(options.offset);
  }

  return await query;
}

/**
 * Get a single roster entry by ID
 */
export async function getRosterEntry(entryId: string, farmId?: string): Promise<RosterEntry | null> {
  const conditions = [eq(rosterEntries.id, entryId)];
  
  if (farmId) {
    conditions.push(eq(rosterEntries.farmId, farmId));
  }

  const [entry] = await db
    .select()
    .from(rosterEntries)
    .where(and(...conditions))
    .limit(1);

  return entry || null;
}

/**
 * Update a roster entry
 */
export async function updateRosterEntry(
  entryId: string,
  farmId: string,
  updates: UpdateRosterEntryParams,
  checkConflicts: boolean = true
): Promise<RosterEntry> {
  const existing = await getRosterEntry(entryId, farmId);
  if (!existing) {
    throw new RosterEntryNotFoundError(entryId, farmId);
  }

  // If updating time, check for conflicts
  if (checkConflicts && (updates.date || updates.startTime || updates.endTime)) {
    const date = updates.date || existing.date;
    const startTime = updates.startTime || existing.startTime;
    const endTime = updates.endTime || existing.endTime;

    const conflict = await checkSchedulingConflict(
      existing.staffProfileId,
      date,
      startTime,
      endTime,
      entryId
    );
    
    if (conflict) {
      throw new SchedulingConflictError(
        `Staff member already has a shift scheduled from ${conflict.startTime} to ${conflict.endTime} on ${date}`
      );
    }
  }

  // Validate time logic if both provided
  if (updates.startTime && updates.endTime && updates.startTime >= updates.endTime) {
    throw new ValidationError('End time must be after start time');
  }

  const [entry] = await db
    .update(rosterEntries)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(rosterEntries.id, entryId), eq(rosterEntries.farmId, farmId)))
    .returning();

  return entry;
}

/**
 * Update roster entry status
 */
export async function updateRosterStatus(
  entryId: string,
  farmId: string,
  newStatus: RosterStatus
): Promise<RosterEntry> {
  const existing = await getRosterEntry(entryId, farmId);
  if (!existing) {
    throw new RosterEntryNotFoundError(entryId, farmId);
  }

  const updateData: Partial<RosterEntry> = {
    status: newStatus,
    updatedAt: new Date(),
  };

  if (newStatus === 'confirmed') {
    updateData.confirmedAt = new Date();
  }

  const [entry] = await db
    .update(rosterEntries)
    .set(updateData)
    .where(and(eq(rosterEntries.id, entryId), eq(rosterEntries.farmId, farmId)))
    .returning();

  return entry;
}

/**
 * Confirm a roster entry (staff confirms their shift)
 */
export async function confirmRosterEntry(
  entryId: string,
  farmId: string,
  staffProfileId: string
): Promise<RosterEntry> {
  const existing = await getRosterEntry(entryId, farmId);
  if (!existing) {
    throw new RosterEntryNotFoundError(entryId, farmId);
  }

  // Verify the staff member is the one assigned to this shift
  if (existing.staffProfileId !== staffProfileId) {
    throw new PermissionDeniedError('You can only confirm your own shifts');
  }

  return await updateRosterStatus(entryId, farmId, 'confirmed');
}

/**
 * Delete a roster entry
 */
export async function deleteRosterEntry(entryId: string, farmId: string): Promise<boolean> {
  const result = await db
    .delete(rosterEntries)
    .where(and(eq(rosterEntries.id, entryId), eq(rosterEntries.farmId, farmId)));

  return (result.rowCount ?? 0) > 0;
}

/**
 * Get roster entries for a specific staff member
 */
export async function getStaffRoster(
  staffProfileId: string,
  farmId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    includeCompleted?: boolean;
  }
): Promise<RosterEntry[]> {
  const conditions = [
    eq(rosterEntries.staffProfileId, staffProfileId),
    eq(rosterEntries.farmId, farmId),
  ];

  if (options?.startDate) {
    conditions.push(gte(rosterEntries.date, options.startDate));
  }

  if (options?.endDate) {
    conditions.push(lte(rosterEntries.date, options.endDate));
  }

  if (!options?.includeCompleted) {
    // Exclude completed and cancelled
    conditions.push(eq(rosterEntries.status, 'scheduled'));
  }

  return await db
    .select()
    .from(rosterEntries)
    .where(and(...conditions))
    .orderBy(rosterEntries.date, rosterEntries.startTime);
}

/**
 * Copy roster entries from one week to another
 */
export async function copyWeekRoster(
  farmId: string,
  sourceStartDate: string, // Monday of source week
  targetStartDate: string, // Monday of target week
  createdById: string
): Promise<RosterEntry[]> {
  // Calculate source week end (Sunday)
  const sourceStart = new Date(sourceStartDate);
  const sourceEnd = new Date(sourceStart);
  sourceEnd.setDate(sourceEnd.getDate() + 6);
  const sourceEndDate = sourceEnd.toISOString().split('T')[0];

  // Get all entries from source week
  const sourceEntries = await listRoster(farmId, {
    startDate: sourceStartDate,
    endDate: sourceEndDate,
  });

  // Calculate day offset
  const targetStart = new Date(targetStartDate);
  const dayOffset = Math.floor((targetStart.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24));

  // Create new entries for target week
  const newEntries: RosterEntry[] = [];
  
  for (const entry of sourceEntries) {
    // Skip cancelled entries
    if (entry.status === 'cancelled') continue;

    // Calculate new date
    const entryDate = new Date(entry.date);
    entryDate.setDate(entryDate.getDate() + dayOffset);
    const newDate = entryDate.toISOString().split('T')[0];

    try {
      const newEntry = await createRosterEntry({
        farmId,
        staffProfileId: entry.staffProfileId,
        date: newDate,
        startTime: entry.startTime,
        endTime: entry.endTime,
        breakMinutes: entry.breakMinutes || 0,
        role: entry.role || undefined,
        position: entry.position || undefined,
        jobId: entry.jobId || undefined,
        location: entry.location || undefined,
        pastureId: entry.pastureId || undefined,
        notes: entry.notes || undefined,
        color: entry.color || undefined,
        createdById,
      }, false); // Don't check conflicts for bulk copy

      newEntries.push(newEntry);
    } catch (error) {
      // Log but continue with other entries
      console.error(`Failed to copy roster entry: ${error}`);
    }
  }

  return newEntries;
}
