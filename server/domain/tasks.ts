import { db } from '../db';
import { 
  tasks, 
  jobs, 
  users, 
  staffProfiles,
  type Task, 
  type Job,
  type InsertTask,
  type InsertJob 
} from '@shared/schema';
import { eq, and, desc, ne, gte, lte, isNull, or } from 'drizzle-orm';

// ===== CUSTOM ERROR CLASSES =====

export class TaskNotFoundError extends Error {
  constructor(taskId: string, farmId?: string) {
    super(farmId 
      ? `Task ${taskId} not found or does not belong to farm ${farmId}`
      : `Task ${taskId} not found`
    );
    this.name = 'TaskNotFoundError';
  }
}

export class JobNotFoundError extends Error {
  constructor(jobId: string, farmId?: string) {
    super(farmId 
      ? `Job ${jobId} not found or does not belong to farm ${farmId}`
      : `Job ${jobId} not found`
    );
    this.name = 'JobNotFoundError';
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

// ===== TYPES =====

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type JobStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export interface CreateTaskParams {
  farmId: string;
  title: string;
  description?: string;
  assignedToId?: string;
  dueDate?: Date;
  startDate?: Date;
  priority?: TaskPriority;
  createdById: string;
  jobId?: string;
  location?: string;
  pastureId?: string;
  animalId?: string;
  estimatedMinutes?: number;
  checklistItems?: { id: string; text: string; completed: boolean }[];
  tags?: string[];
}

export interface CreateJobParams {
  farmId: string;
  title: string;
  description?: string;
  assignedToId?: string;
  dueDate?: Date;
  startDate?: Date;
  priority?: TaskPriority;
  createdById: string;
  category?: string;
  location?: string;
  pastureId?: string;
  tags?: string[];
}

// ===== HELPER FUNCTIONS =====

/**
 * Verify that a user belongs to the farm (via staff profile or user record)
 */
async function verifyUserInFarm(userId: string, farmId: string): Promise<boolean> {
  // For now, we assume all active users can be assigned tasks
  // In a more complex system, check staff_profiles or farm membership
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, true)))
    .limit(1);
  
  return !!user;
}

/**
 * Check if user has manager/admin role
 */
async function isManagerOrAdmin(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!user) return false;
  const role = user.role?.toLowerCase();
  return role === 'manager' || role === 'admin' || role === 'owner';
}

// ===== TASK FUNCTIONS =====

/**
 * Create a new task
 */
export async function createTask(params: CreateTaskParams): Promise<Task> {
  const {
    farmId,
    title,
    description,
    assignedToId,
    dueDate,
    startDate,
    priority = 'medium',
    createdById,
    jobId,
    location,
    pastureId,
    animalId,
    estimatedMinutes,
    checklistItems,
    tags,
  } = params;

  // Validate assignee belongs to farm if provided
  if (assignedToId) {
    const isValid = await verifyUserInFarm(assignedToId, farmId);
    if (!isValid) {
      throw new ValidationError('Assigned user does not belong to this farm or is inactive');
    }
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

  const [task] = await db.insert(tasks).values({
    farmId,
    title,
    description,
    assignedToId,
    dueDate,
    startDate,
    priority,
    status: 'pending',
    createdById,
    jobId,
    location,
    pastureId,
    animalId,
    estimatedMinutes,
    checklistItems,
    tags: tags || [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return task;
}

/**
 * List tasks for a farm with optional filters
 */
export async function listTasks(
  farmId: string,
  options?: {
    showCompleted?: boolean;
    assignedToId?: string;
    jobId?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueBefore?: Date;
    dueAfter?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<Task[]> {
  const conditions = [eq(tasks.farmId, farmId)];

  if (!options?.showCompleted) {
    conditions.push(ne(tasks.status, 'done'));
    conditions.push(ne(tasks.status, 'cancelled'));
  }

  if (options?.assignedToId) {
    conditions.push(eq(tasks.assignedToId, options.assignedToId));
  }

  if (options?.jobId) {
    conditions.push(eq(tasks.jobId, options.jobId));
  }

  if (options?.status) {
    conditions.push(eq(tasks.status, options.status));
  }

  if (options?.priority) {
    conditions.push(eq(tasks.priority, options.priority));
  }

  if (options?.dueBefore) {
    conditions.push(lte(tasks.dueDate, options.dueBefore));
  }

  if (options?.dueAfter) {
    conditions.push(gte(tasks.dueDate, options.dueAfter));
  }

  let query = db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.dueDate), desc(tasks.createdAt));

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.offset(options.offset);
  }

  return await query;
}

/**
 * Get a single task by ID
 */
export async function getTask(taskId: string, farmId?: string): Promise<Task | null> {
  const conditions = [eq(tasks.id, taskId)];
  
  if (farmId) {
    conditions.push(eq(tasks.farmId, farmId));
  }

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .limit(1);

  return task || null;
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  taskId: string,
  farmId: string,
  newStatus: TaskStatus,
  completedById?: string
): Promise<Task> {
  const existing = await getTask(taskId, farmId);
  if (!existing) {
    throw new TaskNotFoundError(taskId, farmId);
  }

  const updateData: Partial<Task> = {
    status: newStatus,
    updatedAt: new Date(),
  };

  // Set completion info if marking as done
  if (newStatus === 'done') {
    updateData.completedAt = new Date();
    if (completedById) {
      updateData.completedById = completedById;
    }
  }

  const [task] = await db
    .update(tasks)
    .set(updateData)
    .where(and(eq(tasks.id, taskId), eq(tasks.farmId, farmId)))
    .returning();

  return task;
}

/**
 * Assign a task to a user
 */
export async function assignTask(
  taskId: string,
  farmId: string,
  assignedToId: string | null
): Promise<Task> {
  const existing = await getTask(taskId, farmId);
  if (!existing) {
    throw new TaskNotFoundError(taskId, farmId);
  }

  // Validate assignee if provided
  if (assignedToId) {
    const isValid = await verifyUserInFarm(assignedToId, farmId);
    if (!isValid) {
      throw new ValidationError('Assigned user does not belong to this farm or is inactive');
    }
  }

  const [task] = await db
    .update(tasks)
    .set({
      assignedToId,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.farmId, farmId)))
    .returning();

  return task;
}

/**
 * Update a task
 */
export async function updateTask(
  taskId: string,
  farmId: string,
  updates: Partial<{
    title: string;
    description: string;
    assignedToId: string | null;
    dueDate: Date | null;
    startDate: Date | null;
    priority: TaskPriority;
    status: TaskStatus;
    location: string;
    estimatedMinutes: number;
    actualMinutes: number;
    checklistItems: { id: string; text: string; completed: boolean }[];
    tags: string[];
    notes: string;
  }>
): Promise<Task> {
  const existing = await getTask(taskId, farmId);
  if (!existing) {
    throw new TaskNotFoundError(taskId, farmId);
  }

  // Validate assignee if being updated
  if (updates.assignedToId) {
    const isValid = await verifyUserInFarm(updates.assignedToId, farmId);
    if (!isValid) {
      throw new ValidationError('Assigned user does not belong to this farm or is inactive');
    }
  }

  const [task] = await db
    .update(tasks)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), eq(tasks.farmId, farmId)))
    .returning();

  return task;
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string, farmId: string): Promise<boolean> {
  const result = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.farmId, farmId)));

  return (result.rowCount ?? 0) > 0;
}

// ===== JOB FUNCTIONS =====

/**
 * Create a new job
 */
export async function createJob(params: CreateJobParams): Promise<Job> {
  const {
    farmId,
    title,
    description,
    assignedToId,
    dueDate,
    startDate,
    priority = 'medium',
    createdById,
    category,
    location,
    pastureId,
    tags,
  } = params;

  // Validate assignee belongs to farm if provided
  if (assignedToId) {
    const isValid = await verifyUserInFarm(assignedToId, farmId);
    if (!isValid) {
      throw new ValidationError('Assigned user does not belong to this farm or is inactive');
    }
  }

  const [job] = await db.insert(jobs).values({
    farmId,
    title,
    description,
    assignedToId,
    dueDate,
    startDate,
    priority,
    status: 'open',
    createdById,
    category,
    location,
    pastureId,
    tags: tags || [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return job;
}

/**
 * List jobs for a farm
 */
export async function listJobs(
  farmId: string,
  options?: {
    showCompleted?: boolean;
    assignedToId?: string;
    status?: JobStatus;
    category?: string;
    limit?: number;
    offset?: number;
  }
): Promise<Job[]> {
  const conditions = [eq(jobs.farmId, farmId)];

  if (!options?.showCompleted) {
    conditions.push(ne(jobs.status, 'completed'));
    conditions.push(ne(jobs.status, 'cancelled'));
  }

  if (options?.assignedToId) {
    conditions.push(eq(jobs.assignedToId, options.assignedToId));
  }

  if (options?.status) {
    conditions.push(eq(jobs.status, options.status));
  }

  if (options?.category) {
    conditions.push(eq(jobs.category, options.category));
  }

  let query = db
    .select()
    .from(jobs)
    .where(and(...conditions))
    .orderBy(desc(jobs.dueDate), desc(jobs.createdAt));

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.offset(options.offset);
  }

  return await query;
}

/**
 * Get a single job by ID
 */
export async function getJob(jobId: string, farmId?: string): Promise<Job | null> {
  const conditions = [eq(jobs.id, jobId)];
  
  if (farmId) {
    conditions.push(eq(jobs.farmId, farmId));
  }

  const [job] = await db
    .select()
    .from(jobs)
    .where(and(...conditions))
    .limit(1);

  return job || null;
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  farmId: string,
  newStatus: JobStatus
): Promise<Job> {
  const existing = await getJob(jobId, farmId);
  if (!existing) {
    throw new JobNotFoundError(jobId, farmId);
  }

  const updateData: Partial<Job> = {
    status: newStatus,
    updatedAt: new Date(),
  };

  if (newStatus === 'completed') {
    updateData.completedAt = new Date();
  }

  const [job] = await db
    .update(jobs)
    .set(updateData)
    .where(and(eq(jobs.id, jobId), eq(jobs.farmId, farmId)))
    .returning();

  return job;
}

/**
 * Update a job
 */
export async function updateJob(
  jobId: string,
  farmId: string,
  updates: Partial<{
    title: string;
    description: string;
    assignedToId: string | null;
    dueDate: Date | null;
    startDate: Date | null;
    priority: TaskPriority;
    status: JobStatus;
    category: string;
    location: string;
    tags: string[];
    notes: string;
  }>
): Promise<Job> {
  const existing = await getJob(jobId, farmId);
  if (!existing) {
    throw new JobNotFoundError(jobId, farmId);
  }

  const [job] = await db
    .update(jobs)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.farmId, farmId)))
    .returning();

  return job;
}

/**
 * Delete a job (and optionally its tasks)
 */
export async function deleteJob(jobId: string, farmId: string): Promise<boolean> {
  const result = await db
    .delete(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.farmId, farmId)));

  return (result.rowCount ?? 0) > 0;
}

/**
 * Get tasks for a specific job
 */
export async function getJobTasks(jobId: string, farmId: string): Promise<Task[]> {
  return await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.jobId, jobId), eq(tasks.farmId, farmId)))
    .orderBy(desc(tasks.createdAt));
}
