import { db } from '../db';
import { 
  timesheets, 
  staffProfiles,
  users,
  type Timesheet,
  type InsertTimesheet 
} from '@shared/schema';
import { eq, and, desc, isNull, gte, lte } from 'drizzle-orm';

// ===== CUSTOM ERROR CLASSES =====

export class TimesheetNotFoundError extends Error {
  constructor(entryId: string, farmId?: string) {
    super(farmId 
      ? `Timesheet entry ${entryId} not found or does not belong to farm ${farmId}`
      : `Timesheet entry ${entryId} not found`
    );
    this.name = 'TimesheetNotFoundError';
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

export class ActiveShiftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActiveShiftError';
  }
}

// ===== TYPES =====

export type TimesheetStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface ClockInParams {
  staffProfileId: string;
  farmId: string;
  location?: string;
  jobId?: string;
  taskDescription?: string;
  notes?: string;
}

export interface LogTimeEntryParams {
  staffProfileId: string;
  farmId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  breakMinutes?: number;
  jobId?: string;
  taskDescription?: string;
  location?: string;
  notes?: string;
  recordedById?: string;
}

// ===== HELPER FUNCTIONS =====

/**
 * Get staff profile ID for a user
 */
async function getStaffProfileForUser(userId: string): Promise<string | null> {
  const [profile] = await db
    .select({ id: staffProfiles.id })
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, userId))
    .limit(1);
  
  return profile?.id || null;
}

/**
 * Check if user has manager/admin role (can approve timesheets)
 */
export async function canApproveTimesheets(userId: string): Promise<boolean> {
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
 * Check if user can manage another user's timesheet
 */
export async function canManageTimesheet(
  managerId: string,
  staffProfileId: string
): Promise<boolean> {
  // Managers can manage anyone's timesheet
  if (await canApproveTimesheets(managerId)) {
    return true;
  }
  
  // Users can manage their own timesheet
  const managerStaffId = await getStaffProfileForUser(managerId);
  return managerStaffId === staffProfileId;
}

/**
 * Calculate hours between two times
 */
function calculateHours(startTime: string, endTime: string, breakMinutes: number = 0): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  const totalMinutes = endMinutes - startMinutes - breakMinutes;
  return Math.max(0, totalMinutes / 60);
}

/**
 * Get current time in HH:MM format
 */
function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * Get current date in YYYY-MM-DD format
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

// ===== TIMESHEET FUNCTIONS =====

/**
 * Clock in - start a new shift
 */
export async function clockIn(params: ClockInParams): Promise<Timesheet> {
  const {
    staffProfileId,
    farmId,
    location,
    jobId,
    taskDescription,
    notes,
  } = params;

  // Check if there's already an active shift (no clock out)
  const activeShift = await getActiveShift(staffProfileId, farmId);
  if (activeShift) {
    throw new ActiveShiftError(
      `Already clocked in since ${activeShift.startTime} on ${activeShift.date}. Please clock out first.`
    );
  }

  const currentDate = getCurrentDate();
  const currentTime = getCurrentTime();

  const [entry] = await db.insert(timesheets).values({
    staffProfileId,
    farmId,
    date: currentDate,
    startTime: currentTime,
    endTime: null,
    breakMinutes: 0,
    totalHours: null,
    jobId,
    taskDescription,
    location,
    status: 'draft',
    notes,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return entry;
}

/**
 * Clock out - end the current shift
 */
export async function clockOut(
  staffProfileId: string,
  farmId: string,
  breakMinutes: number = 0
): Promise<Timesheet> {
  // Find the active shift
  const activeShift = await getActiveShift(staffProfileId, farmId);
  if (!activeShift) {
    throw new ActiveShiftError('No active shift found. Please clock in first.');
  }

  const currentTime = getCurrentTime();
  const totalHours = calculateHours(activeShift.startTime, currentTime, breakMinutes);

  const [entry] = await db
    .update(timesheets)
    .set({
      endTime: currentTime,
      breakMinutes,
      totalHours: totalHours.toFixed(2),
      status: 'pending', // Ready for approval
      updatedAt: new Date(),
    })
    .where(eq(timesheets.id, activeShift.id))
    .returning();

  return entry;
}

/**
 * Get active (open) shift for a staff member
 */
export async function getActiveShift(
  staffProfileId: string,
  farmId: string
): Promise<Timesheet | null> {
  const [entry] = await db
    .select()
    .from(timesheets)
    .where(and(
      eq(timesheets.staffProfileId, staffProfileId),
      eq(timesheets.farmId, farmId),
      isNull(timesheets.endTime)
    ))
    .orderBy(desc(timesheets.createdAt))
    .limit(1);

  return entry || null;
}

/**
 * Log a manual time entry
 */
export async function logTimeEntry(params: LogTimeEntryParams): Promise<Timesheet> {
  const {
    staffProfileId,
    farmId,
    date,
    startTime,
    endTime,
    breakMinutes = 0,
    jobId,
    taskDescription,
    location,
    notes,
    recordedById,
  } = params;

  // Validate time logic
  if (startTime >= endTime) {
    throw new ValidationError('End time must be after start time');
  }

  const totalHours = calculateHours(startTime, endTime, breakMinutes);

  const [entry] = await db.insert(timesheets).values({
    staffProfileId,
    farmId,
    date,
    startTime,
    endTime,
    breakMinutes,
    totalHours: totalHours.toFixed(2),
    jobId,
    taskDescription,
    location,
    status: 'pending',
    notes,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return entry;
}

/**
 * List timesheets for a farm
 */
export async function listTimesheets(
  farmId: string,
  options?: {
    staffProfileId?: string;
    status?: TimesheetStatus;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
): Promise<Timesheet[]> {
  const conditions = [eq(timesheets.farmId, farmId)];

  if (options?.staffProfileId) {
    conditions.push(eq(timesheets.staffProfileId, options.staffProfileId));
  }

  if (options?.status) {
    conditions.push(eq(timesheets.status, options.status));
  }

  if (options?.startDate) {
    conditions.push(gte(timesheets.date, options.startDate));
  }

  if (options?.endDate) {
    conditions.push(lte(timesheets.date, options.endDate));
  }

  let query = db
    .select()
    .from(timesheets)
    .where(and(...conditions))
    .orderBy(desc(timesheets.date), desc(timesheets.startTime));

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.offset(options.offset);
  }

  return await query;
}

/**
 * Get a single timesheet entry by ID
 */
export async function getTimesheet(entryId: string, farmId?: string): Promise<Timesheet | null> {
  const conditions = [eq(timesheets.id, entryId)];
  
  if (farmId) {
    conditions.push(eq(timesheets.farmId, farmId));
  }

  const [entry] = await db
    .select()
    .from(timesheets)
    .where(and(...conditions))
    .limit(1);

  return entry || null;
}

/**
 * Update a timesheet entry
 */
export async function updateTimesheet(
  entryId: string,
  farmId: string,
  updates: Partial<{
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    jobId: string | null;
    taskDescription: string;
    location: string;
    notes: string;
  }>
): Promise<Timesheet> {
  const existing = await getTimesheet(entryId, farmId);
  if (!existing) {
    throw new TimesheetNotFoundError(entryId, farmId);
  }

  // Recalculate hours if times changed
  let totalHours = existing.totalHours;
  if (updates.startTime || updates.endTime || updates.breakMinutes !== undefined) {
    const startTime = updates.startTime || existing.startTime;
    const endTime = updates.endTime || existing.endTime;
    const breakMinutes = updates.breakMinutes ?? existing.breakMinutes ?? 0;
    
    if (startTime && endTime) {
      totalHours = calculateHours(startTime, endTime, breakMinutes).toFixed(2);
    }
  }

  const [entry] = await db
    .update(timesheets)
    .set({
      ...updates,
      totalHours,
      updatedAt: new Date(),
    })
    .where(and(eq(timesheets.id, entryId), eq(timesheets.farmId, farmId)))
    .returning();

  return entry;
}

/**
 * Approve a timesheet entry
 */
export async function approveTimesheet(
  entryId: string,
  farmId: string,
  approverId: string
): Promise<Timesheet> {
  const existing = await getTimesheet(entryId, farmId);
  if (!existing) {
    throw new TimesheetNotFoundError(entryId, farmId);
  }

  // Verify approver has permission
  const canApprove = await canApproveTimesheets(approverId);
  if (!canApprove) {
    throw new PermissionDeniedError('You do not have permission to approve timesheets');
  }

  // Cannot approve draft entries (must be pending)
  if (existing.status === 'draft') {
    throw new ValidationError('Cannot approve a draft timesheet. Entry must be submitted first.');
  }

  const [entry] = await db
    .update(timesheets)
    .set({
      status: 'approved',
      approvedBy: approverId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(timesheets.id, entryId), eq(timesheets.farmId, farmId)))
    .returning();

  return entry;
}

/**
 * Reject a timesheet entry
 */
export async function rejectTimesheet(
  entryId: string,
  farmId: string,
  rejecterId: string,
  reason?: string
): Promise<Timesheet> {
  const existing = await getTimesheet(entryId, farmId);
  if (!existing) {
    throw new TimesheetNotFoundError(entryId, farmId);
  }

  // Verify rejecter has permission
  const canApprove = await canApproveTimesheets(rejecterId);
  if (!canApprove) {
    throw new PermissionDeniedError('You do not have permission to reject timesheets');
  }

  const [entry] = await db
    .update(timesheets)
    .set({
      status: 'rejected',
      notes: reason ? `Rejected: ${reason}` : existing.notes,
      updatedAt: new Date(),
    })
    .where(and(eq(timesheets.id, entryId), eq(timesheets.farmId, farmId)))
    .returning();

  return entry;
}

/**
 * Submit a draft timesheet for approval
 */
export async function submitTimesheet(
  entryId: string,
  farmId: string
): Promise<Timesheet> {
  const existing = await getTimesheet(entryId, farmId);
  if (!existing) {
    throw new TimesheetNotFoundError(entryId, farmId);
  }

  if (existing.status !== 'draft') {
    throw new ValidationError('Only draft timesheets can be submitted');
  }

  // Ensure the entry is complete
  if (!existing.endTime) {
    throw new ValidationError('Cannot submit timesheet without clock out time');
  }

  const [entry] = await db
    .update(timesheets)
    .set({
      status: 'pending',
      updatedAt: new Date(),
    })
    .where(and(eq(timesheets.id, entryId), eq(timesheets.farmId, farmId)))
    .returning();

  return entry;
}

/**
 * Delete a timesheet entry
 */
export async function deleteTimesheet(entryId: string, farmId: string): Promise<boolean> {
  const existing = await getTimesheet(entryId, farmId);
  if (!existing) {
    throw new TimesheetNotFoundError(entryId, farmId);
  }

  // Cannot delete approved timesheets
  if (existing.status === 'approved') {
    throw new ValidationError('Cannot delete approved timesheets');
  }

  const result = await db
    .delete(timesheets)
    .where(and(eq(timesheets.id, entryId), eq(timesheets.farmId, farmId)));

  return (result.rowCount ?? 0) > 0;
}

/**
 * Get timesheet summary for a staff member
 */
export async function getTimesheetSummary(
  staffProfileId: string,
  farmId: string,
  startDate: string,
  endDate: string
): Promise<{
  totalHours: number;
  approvedHours: number;
  pendingHours: number;
  entryCount: number;
}> {
  const entries = await listTimesheets(farmId, {
    staffProfileId,
    startDate,
    endDate,
  });

  let totalHours = 0;
  let approvedHours = 0;
  let pendingHours = 0;

  for (const entry of entries) {
    const hours = parseFloat(entry.totalHours || '0');
    totalHours += hours;
    
    if (entry.status === 'approved') {
      approvedHours += hours;
    } else if (entry.status === 'pending') {
      pendingHours += hours;
    }
  }

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    approvedHours: Math.round(approvedHours * 100) / 100,
    pendingHours: Math.round(pendingHours * 100) / 100,
    entryCount: entries.length,
  };
}

/**
 * Get staff timesheets for the current week
 */
export async function getWeeklyTimesheets(
  staffProfileId: string,
  farmId: string
): Promise<Timesheet[]> {
  // Get Monday of current week
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  
  // Get Sunday of current week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return await listTimesheets(farmId, {
    staffProfileId,
    startDate: monday.toISOString().split('T')[0],
    endDate: sunday.toISOString().split('T')[0],
  });
}
