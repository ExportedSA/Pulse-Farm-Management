import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  updateTaskStatus,
  assignTask,
  deleteTask,
  createJob,
  listJobs,
  getJob,
  updateJob,
  updateJobStatus,
  deleteJob,
  getJobTasks,
  TaskNotFoundError,
  JobNotFoundError,
  PermissionDeniedError,
  ValidationError,
} from '../domain/tasks';
import { chatWebSocket } from '../websocket';
import { db } from '../db';
import { users, notificationLogs } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import logger from '../config/logger';

const router = Router();

// Roles that can manage tasks (create, assign, delete)
const TASK_MANAGER_ROLES = ['owner', 'manager', 'admin'];

/**
 * Check if user has manager role for task management
 */
function canManageTasks(userRole: string | undefined): boolean {
  if (!userRole) return false;
  return TASK_MANAGER_ROLES.includes(userRole.toLowerCase());
}

// ===== VALIDATION SCHEMAS =====

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  jobId: z.string().uuid().optional(),
  location: z.string().optional(),
  pastureId: z.string().uuid().optional(),
  animalId: z.string().uuid().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  checklistItems: z.array(z.object({
    id: z.string(),
    text: z.string(),
    completed: z.boolean(),
  })).optional(),
  tags: z.array(z.string()).optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['pending', 'in_progress', 'done', 'cancelled']).optional(),
  location: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  actualMinutes: z.number().int().positive().optional(),
  checklistItems: z.array(z.object({
    id: z.string(),
    text: z.string(),
    completed: z.boolean(),
  })).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const createJobSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  pastureId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
});

// ===== TASK ENDPOINTS =====

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Permission check: managers can create tasks for anyone, others can only create for themselves
    const data = createTaskSchema.parse(req.body);
    
    // If assigning to someone else, must be manager
    if (data.assignedToId && data.assignedToId !== userId && !canManageTasks(userRole)) {
      logger.warn({ userId, userRole }, 'Unauthorized attempt to assign task to another user');
      return res.status(403).json({ error: 'You do not have permission to assign tasks to others' });
    }

    const task = await createTask({
      farmId,
      title: data.title,
      description: data.description,
      assignedToId: data.assignedToId,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      priority: data.priority,
      createdById: userId,
      jobId: data.jobId,
      location: data.location,
      pastureId: data.pastureId,
      animalId: data.animalId,
      estimatedMinutes: data.estimatedMinutes,
      checklistItems: data.checklistItems,
      tags: data.tags,
    });

    logger.info({ taskId: task.id, userId, farmId }, 'Task created successfully');

    // Emit WebSocket events and create notifications
    try {
      // If task is assigned, notify the assignee
      if (data.assignedToId && data.assignedToId !== userId) {
        // Send WebSocket event to assignee
        chatWebSocket.broadcastTaskAssigned(data.assignedToId, {
          ...task,
          createdByName: (req.user as any).name || 'Unknown',
        });

        // Create notification for assignee
        await db.insert(notificationLogs).values({
          userId: data.assignedToId,
          type: 'task',
          title: 'New Task Assigned',
          message: `You have been assigned a new task: ${task.title}`,
          data: { taskId: task.id, taskTitle: task.title },
          isRead: false,
          createdAt: new Date(),
        });
      }

      // Broadcast to managers that a new task was created
      const managers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.isActive, true),
          inArray(users.role, ['owner', 'manager', 'admin'])
        ));
      
      const managerIds = managers.map(m => m.id).filter(id => id !== userId);
      if (managerIds.length > 0) {
        chatWebSocket.broadcastTaskCreated(managerIds, {
          ...task,
          createdByName: (req.user as any).name || 'Unknown',
        });
      }
    } catch (wsError) {
      logger.error({ error: wsError }, 'Failed to send task notifications');
    }

    res.status(201).json(task);
  } catch (error) {
    logger.error({ error }, 'Failed to create task');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid task data', details: error.errors });
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * GET /api/tasks
 * List tasks for the farm
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    const {
      showCompleted,
      assignedToId,
      jobId,
      status,
      priority,
      limit,
      offset,
    } = req.query;

    // Non-managers can only see their own tasks or unassigned tasks
    let effectiveAssignedToId = assignedToId as string | undefined;
    if (!canManageTasks(userRole) && assignedToId && assignedToId !== userId) {
      // Override to only show their own tasks
      effectiveAssignedToId = userId;
    }

    const tasks = await listTasks(farmId, {
      showCompleted: showCompleted === 'true',
      assignedToId: effectiveAssignedToId,
      jobId: jobId as string,
      status: status as any,
      priority: priority as any,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(tasks);
  } catch (error) {
    logger.error({ error }, 'Failed to list tasks');
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

/**
 * GET /api/tasks/:id
 * Get a single task
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;

    const task = await getTask(id, farmId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    logger.error({ error }, 'Failed to get task');
    res.status(500).json({ error: 'Failed to get task' });
  }
});

/**
 * PATCH /api/tasks/:id
 * Update a task
 */
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    const data = updateTaskSchema.parse(req.body);

    // Get existing task to check permissions
    const existing = await getTask(id, farmId);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Permission checks
    const isManager = canManageTasks(userRole);
    const isAssignee = existing.assignedToId === userId;
    const isCreator = existing.createdById === userId;

    // Non-managers can only update status of their assigned tasks
    if (!isManager && !isAssignee && !isCreator) {
      return res.status(403).json({ error: 'You do not have permission to update this task' });
    }

    // Non-managers can only change status (mark complete)
    if (!isManager && (data.assignedToId !== undefined || data.title || data.description)) {
      return res.status(403).json({ error: 'You can only update the status of your tasks' });
    }

    // Handle status update separately if completing
    let task;
    if (data.status === 'done') {
      task = await updateTaskStatus(id, farmId, 'done', userId);
    } else if (data.status) {
      task = await updateTaskStatus(id, farmId, data.status);
    } else {
      task = await updateTask(id, farmId, {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate === null ? null : undefined,
        startDate: data.startDate ? new Date(data.startDate) : data.startDate === null ? null : undefined,
      });
    }

    logger.info({ taskId: id, userId, farmId }, 'Task updated successfully');
    res.json(task);
  } catch (error) {
    logger.error({ error }, 'Failed to update task');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid task data', details: error.errors });
    }
    if (error instanceof TaskNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * PATCH /api/tasks/:id/assign
 * Assign a task to a user
 */
router.patch('/:id/assign', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Only managers can reassign tasks
    if (!canManageTasks(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to assign tasks' });
    }

    const { assignedToId } = req.body;
    const task = await assignTask(id, farmId, assignedToId || null);

    logger.info({ taskId: id, assignedToId, userId, farmId }, 'Task assigned successfully');
    res.json(task);
  } catch (error) {
    logger.error({ error }, 'Failed to assign task');
    if (error instanceof TaskNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to assign task' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Only managers can delete tasks
    if (!canManageTasks(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to delete tasks' });
    }

    const success = await deleteTask(id, farmId);
    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }

    logger.info({ taskId: id, userId, farmId }, 'Task deleted successfully');
    res.status(204).send();
  } catch (error) {
    logger.error({ error }, 'Failed to delete task');
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ===== JOB ENDPOINTS =====

/**
 * POST /api/tasks/jobs
 * Create a new job
 */
router.post('/jobs', requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Only managers can create jobs
    if (!canManageTasks(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to create jobs' });
    }

    const data = createJobSchema.parse(req.body);

    const job = await createJob({
      farmId,
      title: data.title,
      description: data.description,
      assignedToId: data.assignedToId,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      priority: data.priority,
      createdById: userId,
      category: data.category,
      location: data.location,
      pastureId: data.pastureId,
      tags: data.tags,
    });

    logger.info({ jobId: job.id, userId, farmId }, 'Job created successfully');
    res.status(201).json(job);
  } catch (error) {
    logger.error({ error }, 'Failed to create job');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid job data', details: error.errors });
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create job' });
  }
});

/**
 * GET /api/tasks/jobs
 * List jobs for the farm
 */
router.get('/jobs', requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const { showCompleted, assignedToId, status, category, limit, offset } = req.query;

    const jobs = await listJobs(farmId, {
      showCompleted: showCompleted === 'true',
      assignedToId: assignedToId as string,
      status: status as any,
      category: category as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(jobs);
  } catch (error) {
    logger.error({ error }, 'Failed to list jobs');
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

/**
 * GET /api/tasks/jobs/:id
 * Get a single job with its tasks
 */
router.get('/jobs/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;

    const job = await getJob(id, farmId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const tasks = await getJobTasks(id, farmId);

    res.json({ ...job, tasks });
  } catch (error) {
    logger.error({ error }, 'Failed to get job');
    res.status(500).json({ error: 'Failed to get job' });
  }
});

/**
 * PATCH /api/tasks/jobs/:id
 * Update a job
 */
router.patch('/jobs/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Only managers can update jobs
    if (!canManageTasks(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to update jobs' });
    }

    const data = req.body;
    
    // Handle status update
    if (data.status) {
      const job = await updateJobStatus(id, farmId, data.status);
      return res.json(job);
    }

    const job = await updateJob(id, farmId, data);
    logger.info({ jobId: id, userId, farmId }, 'Job updated successfully');
    res.json(job);
  } catch (error) {
    logger.error({ error }, 'Failed to update job');
    if (error instanceof JobNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update job' });
  }
});

/**
 * DELETE /api/tasks/jobs/:id
 * Delete a job
 */
router.delete('/jobs/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Only managers can delete jobs
    if (!canManageTasks(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to delete jobs' });
    }

    const success = await deleteJob(id, farmId);
    if (!success) {
      return res.status(404).json({ error: 'Job not found' });
    }

    logger.info({ jobId: id, userId, farmId }, 'Job deleted successfully');
    res.status(204).send();
  } catch (error) {
    logger.error({ error }, 'Failed to delete job');
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

export default router;
