import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import {
  clockIn,
  clockOut,
  getActiveShift,
  logTimeEntry,
  listTimesheets,
  getTimesheet,
  updateTimesheet,
  approveTimesheet,
  rejectTimesheet,
  submitTimesheet,
  deleteTimesheet,
  getTimesheetSummary,
  getWeeklyTimesheets,
  canApproveTimesheets,
  canManageTimesheet,
  TimesheetNotFoundError,
  PermissionDeniedError,
  ValidationError,
  ActiveShiftError,
} from '../domain/timesheets';
import { chatWebSocket } from '../websocket';
import { db } from '../db';
import { staffProfiles, users, notificationLogs } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import logger from '../config/logger';

const router = Router();

// Roles that can manage timesheets (approve, view all, etc.)
const TIMESHEET_MANAGER_ROLES = ['owner', 'manager', 'admin'];

/**
 * Check if user has manager role for timesheet management
 */
function isTimesheetManager(userRole: string | undefined): boolean {
  if (!userRole) return false;
  return TIMESHEET_MANAGER_ROLES.includes(userRole.toLowerCase());
}

/**
 * Get staff profile ID for a user
 */
async function getStaffProfileId(userId: string): Promise<string | null> {
  const [profile] = await db
    .select({ id: staffProfiles.id })
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, userId))
    .limit(1);
  
  return profile?.id || null;
}

// ===== VALIDATION SCHEMAS =====

const logTimeEntrySchema = z.object({
  staffProfileId: z.string().uuid().optional(), // If not provided, use current user's profile
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM format'),
  breakMinutes: z.number().int().min(0).optional(),
  jobId: z.string().uuid().optional(),
  taskDescription: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const updateTimesheetSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  breakMinutes: z.number().int().min(0).optional(),
  jobId: z.string().uuid().nullable().optional(),
  taskDescription: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

// ===== CLOCK IN/OUT ENDPOINTS =====

/**
 * POST /api/timesheets/clock-in
 * Clock in to start a shift
 */
router.post('/clock-in', requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Determine target staff profile
    let targetStaffProfileId = req.body.staffProfileId;
    
    if (targetStaffProfileId) {
      // Manager clocking in someone else
      if (!isTimesheetManager(userRole)) {
        return res.status(403).json({ error: 'You do not have permission to clock in other staff' });
      }
    } else {
      // Self clock-in - get user's staff profile
      targetStaffProfileId = await getStaffProfileId(userId);
      if (!targetStaffProfileId) {
        return res.status(400).json({ error: 'No staff profile found for your account' });
      }
    }

    const entry = await clockIn({
      staffProfileId: targetStaffProfileId,
      farmId,
      location: req.body.location,
      jobId: req.body.jobId,
      taskDescription: req.body.taskDescription,
      notes: req.body.notes,
    });

    logger.info({ entryId: entry.id, staffProfileId: targetStaffProfileId, userId, farmId }, 'Clock in successful');

    // Emit WebSocket event to managers
    try {
      const staffName = (req.user as any).name || 'Unknown';
      const managers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.isActive, true),
          inArray(users.role, ['owner', 'manager', 'admin'])
        ));
      
      const managerIds = managers.map(m => m.id).filter(id => id !== userId);
      if (managerIds.length > 0) {
        chatWebSocket.broadcastUserClockedIn(managerIds, staffName, targetStaffProfileId);
      }
    } catch (wsError) {
      logger.error({ error: wsError }, 'Failed to broadcast clock in event');
    }

    res.status(201).json(entry);
  } catch (error) {
    logger.error({ error }, 'Failed to clock in');
    if (error instanceof ActiveShiftError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

/**
 * POST /api/timesheets/clock-out
 * Clock out to end current shift
 */
router.post('/clock-out', requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Determine target staff profile
    let targetStaffProfileId = req.body.staffProfileId;
    
    if (targetStaffProfileId) {
      // Manager clocking out someone else
      if (!isTimesheetManager(userRole)) {
        return res.status(403).json({ error: 'You do not have permission to clock out other staff' });
      }
    } else {
      // Self clock-out
      targetStaffProfileId = await getStaffProfileId(userId);
      if (!targetStaffProfileId) {
        return res.status(400).json({ error: 'No staff profile found for your account' });
      }
    }

    const breakMinutes = req.body.breakMinutes || 0;
    const entry = await clockOut(targetStaffProfileId, farmId, breakMinutes);

    logger.info({ entryId: entry.id, staffProfileId: targetStaffProfileId, userId, farmId }, 'Clock out successful');

    // Emit WebSocket event to managers
    try {
      const staffName = (req.user as any).name || 'Unknown';
      const managers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.isActive, true),
          inArray(users.role, ['owner', 'manager', 'admin'])
        ));
      
      const managerIds = managers.map(m => m.id).filter(id => id !== userId);
      if (managerIds.length > 0) {
        chatWebSocket.broadcastUserClockedOut(managerIds, staffName, targetStaffProfileId, entry.totalHours || '0');
      }
    } catch (wsError) {
      logger.error({ error: wsError }, 'Failed to broadcast clock out event');
    }

    res.json(entry);
  } catch (error) {
    logger.error({ error }, 'Failed to clock out');
    if (error instanceof ActiveShiftError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to clock out' });
  }
});

/**
 * GET /api/timesheets/active
 * Get active (open) shift for current user or specified staff
 */
router.get('/active', requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    let targetStaffProfileId = req.query.staffProfileId as string;
    
    if (targetStaffProfileId) {
      // Viewing someone else's active shift
      if (!isTimesheetManager(userRole)) {
        return res.status(403).json({ error: 'You do not have permission to view other staff timesheets' });
      }
    } else {
      targetStaffProfileId = await getStaffProfileId(userId) || '';
      if (!targetStaffProfileId) {
        return res.status(400).json({ error: 'No staff profile found for your account' });
      }
    }

    const activeShift = await getActiveShift(targetStaffProfileId, farmId);
    res.json(activeShift || null);
  } catch (error) {
    logger.error({ error }, 'Failed to get active shift');
    res.status(500).json({ error: 'Failed to get active shift' });
  }
});

// ===== TIMESHEET CRUD ENDPOINTS =====

/**
 * POST /api/timesheets
 * Create a manual time entry
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    const data = logTimeEntrySchema.parse(req.body);

    // Determine target staff profile
    let targetStaffProfileId = data.staffProfileId;
    
    if (targetStaffProfileId) {
      // Creating entry for someone else - must be manager
      if (!isTimesheetManager(userRole)) {
        return res.status(403).json({ error: 'You do not have permission to create timesheets for other staff' });
      }
    } else {
      // Self entry
      targetStaffProfileId = await getStaffProfileId(userId) || undefined;
      if (!targetStaffProfileId) {
        return res.status(400).json({ error: 'No staff profile found for your account' });
      }
    }

    const entry = await logTimeEntry({
      staffProfileId: targetStaffProfileId,
      farmId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      breakMinutes: data.breakMinutes,
      jobId: data.jobId,
      taskDescription: data.taskDescription,
      location: data.location,
      notes: data.notes,
      recordedById: userId,
    });

    logger.info({ entryId: entry.id, staffProfileId: targetStaffProfileId, userId, farmId }, 'Timesheet entry created');
    res.status(201).json(entry);
  } catch (error) {
    logger.error({ error }, 'Failed to create timesheet entry');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid timesheet data', details: error.errors });
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create timesheet entry' });
  }
});

/**
 * GET /api/timesheets
 * List timesheets for the farm
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    const { staffProfileId, status, startDate, endDate, limit, offset } = req.query;

    // Non-managers can only see their own timesheets
    let effectiveStaffProfileId = staffProfileId as string | undefined;
    
    if (!isTimesheetManager(userRole)) {
      // Override to only show their own timesheets
      effectiveStaffProfileId = await getStaffProfileId(userId) || undefined;
      if (!effectiveStaffProfileId) {
        return res.json([]); // No staff profile, no timesheets
      }
    }

    const entries = await listTimesheets(farmId, {
      staffProfileId: effectiveStaffProfileId,
      status: status as any,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(entries);
  } catch (error) {
    logger.error({ error }, 'Failed to list timesheets');
    res.status(500).json({ error: 'Failed to list timesheets' });
  }
});

/**
 * GET /api/timesheets/weekly
 * Get current week's timesheets for a staff member
 */
router.get('/weekly', requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    let targetStaffProfileId = req.query.staffProfileId as string;
    
    if (targetStaffProfileId) {
      if (!isTimesheetManager(userRole)) {
        return res.status(403).json({ error: 'You do not have permission to view other staff timesheets' });
      }
    } else {
      targetStaffProfileId = await getStaffProfileId(userId) || '';
      if (!targetStaffProfileId) {
        return res.json([]);
      }
    }

    const entries = await getWeeklyTimesheets(targetStaffProfileId, farmId);
    res.json(entries);
  } catch (error) {
    logger.error({ error }, 'Failed to get weekly timesheets');
    res.status(500).json({ error: 'Failed to get weekly timesheets' });
  }
});

/**
 * GET /api/timesheets/summary
 * Get timesheet summary for a staff member
 */
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    const { staffProfileId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    let targetStaffProfileId = staffProfileId as string;
    
    if (targetStaffProfileId) {
      if (!isTimesheetManager(userRole)) {
        return res.status(403).json({ error: 'You do not have permission to view other staff summaries' });
      }
    } else {
      targetStaffProfileId = await getStaffProfileId(userId) || '';
      if (!targetStaffProfileId) {
        return res.json({ totalHours: 0, approvedHours: 0, pendingHours: 0, entryCount: 0 });
      }
    }

    const summary = await getTimesheetSummary(
      targetStaffProfileId,
      farmId,
      startDate as string,
      endDate as string
    );

    res.json(summary);
  } catch (error) {
    logger.error({ error }, 'Failed to get timesheet summary');
    res.status(500).json({ error: 'Failed to get timesheet summary' });
  }
});

/**
 * GET /api/timesheets/:id
 * Get a single timesheet entry
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    const entry = await getTimesheet(id, farmId);
    if (!entry) {
      return res.status(404).json({ error: 'Timesheet entry not found' });
    }

    // Check permission - managers can view all, others only their own
    if (!isTimesheetManager(userRole)) {
      const userStaffProfileId = await getStaffProfileId(userId);
      if (entry.staffProfileId !== userStaffProfileId) {
        return res.status(403).json({ error: 'You do not have permission to view this timesheet' });
      }
    }

    res.json(entry);
  } catch (error) {
    logger.error({ error }, 'Failed to get timesheet entry');
    res.status(500).json({ error: 'Failed to get timesheet entry' });
  }
});

/**
 * PATCH /api/timesheets/:id
 * Update a timesheet entry
 */
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    const data = updateTimesheetSchema.parse(req.body);

    // Get existing entry to check permissions
    const existing = await getTimesheet(id, farmId);
    if (!existing) {
      return res.status(404).json({ error: 'Timesheet entry not found' });
    }

    // Check permission
    const isManager = isTimesheetManager(userRole);
    const userStaffProfileId = await getStaffProfileId(userId);
    const isOwner = existing.staffProfileId === userStaffProfileId;

    if (!isManager && !isOwner) {
      return res.status(403).json({ error: 'You do not have permission to update this timesheet' });
    }

    // Cannot update approved timesheets unless manager
    if (existing.status === 'approved' && !isManager) {
      return res.status(403).json({ error: 'Cannot update approved timesheets' });
    }

    const entry = await updateTimesheet(id, farmId, data);

    logger.info({ entryId: id, userId, farmId }, 'Timesheet entry updated');
    res.json(entry);
  } catch (error) {
    logger.error({ error }, 'Failed to update timesheet entry');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid timesheet data', details: error.errors });
    }
    if (error instanceof TimesheetNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update timesheet entry' });
  }
});

/**
 * POST /api/timesheets/:id/submit
 * Submit a draft timesheet for approval
 */
router.post('/:id/submit', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;

    // Get existing entry to check ownership
    const existing = await getTimesheet(id, farmId);
    if (!existing) {
      return res.status(404).json({ error: 'Timesheet entry not found' });
    }

    const userStaffProfileId = await getStaffProfileId(userId);
    if (existing.staffProfileId !== userStaffProfileId) {
      return res.status(403).json({ error: 'You can only submit your own timesheets' });
    }

    const entry = await submitTimesheet(id, farmId);

    logger.info({ entryId: id, userId, farmId }, 'Timesheet submitted for approval');
    res.json(entry);
  } catch (error) {
    logger.error({ error }, 'Failed to submit timesheet');
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof TimesheetNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to submit timesheet' });
  }
});

/**
 * POST /api/timesheets/:id/approve
 * Approve a timesheet entry (manager only)
 */
router.post('/:id/approve', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Only managers can approve
    if (!isTimesheetManager(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to approve timesheets' });
    }

    const entry = await approveTimesheet(id, farmId, userId);

    logger.info({ entryId: id, approverId: userId, farmId }, 'Timesheet approved');
    res.json(entry);
  } catch (error) {
    logger.error({ error }, 'Failed to approve timesheet');
    if (error instanceof PermissionDeniedError) {
      return res.status(403).json({ error: error.message });
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof TimesheetNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to approve timesheet' });
  }
});

/**
 * POST /api/timesheets/:id/reject
 * Reject a timesheet entry (manager only)
 */
router.post('/:id/reject', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Only managers can reject
    if (!isTimesheetManager(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to reject timesheets' });
    }

    const { reason } = req.body;
    const entry = await rejectTimesheet(id, farmId, userId, reason);

    logger.info({ entryId: id, rejecterId: userId, farmId, reason }, 'Timesheet rejected');
    res.json(entry);
  } catch (error) {
    logger.error({ error }, 'Failed to reject timesheet');
    if (error instanceof PermissionDeniedError) {
      return res.status(403).json({ error: error.message });
    }
    if (error instanceof TimesheetNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to reject timesheet' });
  }
});

/**
 * DELETE /api/timesheets/:id
 * Delete a timesheet entry
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Get existing entry to check permissions
    const existing = await getTimesheet(id, farmId);
    if (!existing) {
      return res.status(404).json({ error: 'Timesheet entry not found' });
    }

    // Check permission
    const isManager = isTimesheetManager(userRole);
    const userStaffProfileId = await getStaffProfileId(userId);
    const isOwner = existing.staffProfileId === userStaffProfileId;

    if (!isManager && !isOwner) {
      return res.status(403).json({ error: 'You do not have permission to delete this timesheet' });
    }

    const success = await deleteTimesheet(id, farmId);
    if (!success) {
      return res.status(404).json({ error: 'Timesheet entry not found' });
    }

    logger.info({ entryId: id, userId, farmId }, 'Timesheet entry deleted');
    res.status(204).send();
  } catch (error) {
    logger.error({ error }, 'Failed to delete timesheet entry');
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof TimesheetNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete timesheet entry' });
  }
});

export default router;
