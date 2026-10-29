/**
 * Jobs API (mounted at /api/jobs behind requireAuth), used by the Jobs, Kanban,
 * Calendar, Weather and Operations pages. Jobs belong to the signed-in user's farm and
 * can have several assignees (job_assignments).
 */
import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../db";
import { jobs, jobAssignments, users, pastures, type Job } from "@shared/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { uploadMultiplePhotos } from "../middleware/upload";
import { getFarmId, getUserId, requireFarm } from "../middleware/auth";
import { listFarmUserIds } from "../domain/farms";
import { notifyUsers } from "../domain/notifications";

const router = Router();
router.use(requireFarm);

// The pages use "pending" / "in-progress"; the database uses "open" / "in_progress"
const API_TO_DB_STATUS = {
  pending: "open",
  open: "open",
  "in-progress": "in_progress",
  in_progress: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
  blocked: "blocked",
} as const;
type DbStatus = (typeof API_TO_DB_STATUS)[keyof typeof API_TO_DB_STATUS];
const DB_TO_API_STATUS: Record<DbStatus, string> = {
  open: "pending",
  in_progress: "in-progress",
  completed: "completed",
  cancelled: "cancelled",
  blocked: "blocked",
};

const statusSchema = z.enum(Object.keys(API_TO_DB_STATUS) as [keyof typeof API_TO_DB_STATUS])
  .transform(s => API_TO_DB_STATUS[s]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Use YYYY-MM-DD");
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");
// Multipart forms send everything as strings; JSON sends numbers/arrays
const optionalNumber = z.union([z.number(), z.string()]).optional().nullable()
  .transform(v => (v === undefined || v === null || v === "" ? null : Number(v)));
const idList = z.union([z.array(z.string()), z.string()]).optional()
  .transform(v => {
    if (v === undefined) return undefined;
    if (Array.isArray(v)) return v;
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
    } catch {
      return v.split(",").map(s => s.trim()).filter(Boolean);
    }
  });
const checklistSchema = z.array(z.object({
  id: z.string(),
  text: z.string(),
  required: z.boolean().optional(),
  completed: z.boolean().optional(),
  completedAt: z.string().optional(),
  completedBy: z.string().optional(),
  completedByName: z.string().optional(),
  order: z.number().optional(),
}));
const jsonOrValue = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(v => {
    if (typeof v !== "string") return v;
    try { return JSON.parse(v); } catch { return v; }
  }, schema);

const jobFieldsSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  location: z.string().max(255).optional(),
  latitude: optionalNumber,
  longitude: optionalNumber,
  pastureId: z.preprocess(v => (v === "" || v === "null" ? null : v), z.string().uuid().nullable()).optional(),
  assignedTo: idList,
  status: statusSchema.optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional().nullable(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional().nullable(),
  category: z.string().max(100).optional(),
  notes: z.string().optional().nullable(),
  checklistItems: jsonOrValue(checklistSchema).optional(),
  estimatedDuration: optionalNumber,
  existingPhotos: jsonOrValue(z.array(z.string())).optional(),
});

async function savePhotos(req: Request): Promise<string[]> {
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) return [];
  const { saveFileBuffer } = await import("../services/fileStorage");
  return Promise.all(
    req.files.map(async (file: Express.Multer.File) =>
      (await saveFileBuffer(file.buffer, file.mimetype, file.originalname, "jobs")).publicUrl),
  );
}

/**
 * Keep only IDs of active members of the farm (pages may still send old demo IDs)
 */
async function validAssignees(farmId: string, ids: string[] | undefined): Promise<string[]> {
  if (!ids || ids.length === 0) return [];
  const members = new Set(await listFarmUserIds(farmId));
  return Array.from(new Set(ids.filter(id => members.has(id))));
}

/**
 * Only the farm's own paddocks can be linked
 */
async function validPasture(farmId: string, pastureId: string | null | undefined): Promise<string | null | undefined> {
  if (!pastureId) return pastureId;
  const [row] = await db.select({ id: pastures.id }).from(pastures).where(and(eq(pastures.id, pastureId), eq(pastures.farmId, farmId)));
  if (!row) throw new z.ZodError([{ code: "custom", path: ["pastureId"], message: "Paddock not found on this farm" }]);
  return row.id;
}

/**
 * Replace a job's assignees; returns the people newly added
 */
async function setAssignees(jobId: string, userIds: string[]): Promise<string[]> {
  const before = (await db.select({ userId: jobAssignments.userId }).from(jobAssignments).where(eq(jobAssignments.jobId, jobId)))
    .map(a => a.userId);
  await db.delete(jobAssignments).where(eq(jobAssignments.jobId, jobId));
  if (userIds.length > 0) {
    await db.insert(jobAssignments).values(userIds.map(userId => ({ jobId, userId })));
  }
  return userIds.filter(id => !before.includes(id));
}

/**
 * Tell people a job has been given to them (not the person who assigned it)
 */
async function notifyAssigned(job: Job, userIds: string[], assignedBy: string) {
  const recipients = userIds.filter(id => id !== assignedBy);
  if (recipients.length === 0) return;
  const when = job.startDate ? ` for ${job.startDate.toISOString().slice(0, 10)}` : "";
  await notifyUsers(recipients, {
    type: "job_assigned",
    title: "New job for you",
    message: `${job.title}${when}${job.location ? ` at ${job.location}` : ""}`,
    farmId: job.farmId,
    link: `/app/jobs?job=${job.id}`,
    priority: job.priority === "urgent" || job.priority === "high" ? "high" : "normal",
    metadata: { jobId: job.id },
  }).catch(error => console.error("Failed to notify job assignees:", error));
}

const toDateString = (d: Date | null) => (d ? d.toISOString().split("T")[0] : null);

/**
 * Shape jobs (with their assignees) the way the pages expect them
 */
async function toApiJobs(rows: Job[]) {
  const ids = rows.map(r => r.id);
  const pastureIds = Array.from(new Set(rows.map(r => r.pastureId).filter((id): id is string => !!id)));
  const paddockNames = new Map((pastureIds.length === 0 ? [] : await db
    .select({ id: pastures.id, name: pastures.name })
    .from(pastures)
    .where(inArray(pastures.id, pastureIds))).map(p => [p.id, p.name]));
  const assignments = ids.length === 0 ? [] : await db
    .select({ jobId: jobAssignments.jobId, userId: users.id, name: users.name })
    .from(jobAssignments)
    .innerJoin(users, eq(jobAssignments.userId, users.id))
    .where(inArray(jobAssignments.jobId, ids));

  return rows.map(job => {
    const people = assignments.filter(a => a.jobId === job.id);
    return {
      id: job.id,
      title: job.title,
      description: job.description ?? "",
      location: job.location ?? "",
      latitude: job.latitude != null ? Number(job.latitude) : null,
      longitude: job.longitude != null ? Number(job.longitude) : null,
      pastureId: job.pastureId,
      paddockName: job.pastureId ? paddockNames.get(job.pastureId) ?? null : null,
      photoUrls: job.photoUrls,
      assignedTo: people.map(p => p.userId),
      assignedToNames: people.map(p => p.name),
      status: DB_TO_API_STATUS[job.status as DbStatus] ?? job.status,
      priority: job.priority ?? "medium",
      startDate: toDateString(job.startDate),
      endDate: toDateString(job.endDate),
      dueDate: toDateString(job.dueDate),
      startTime: job.startTime,
      endTime: job.endTime,
      category: job.category ?? "general",
      notes: job.notes,
      checklistItems: job.checklistItems,
      estimatedDuration: job.estimatedDuration,
      createdBy: job.createdById,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  });
}

async function findFarmJob(farmId: string, id: string): Promise<Job | undefined> {
  if (!z.string().uuid().safeParse(id).success) return undefined;
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.farmId, farmId)));
  return job;
}

function handleError(res: any, error: unknown, message: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Validation failed", details: error.errors });
  }
  console.error(`${message}:`, error);
  res.status(500).json({ error: message });
}

// GET /api/jobs?limit=N - The farm's jobs, newest first
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 500, 500);
    const rows = await db
      .select()
      .from(jobs)
      .where(eq(jobs.farmId, getFarmId(req)!))
      .orderBy(desc(jobs.createdAt))
      .limit(limit);
    res.json(await toApiJobs(rows));
  } catch (error) {
    handleError(res, error, "Failed to fetch jobs");
  }
});

// GET /api/jobs/users - People on the farm who can be assigned jobs
router.get("/users", async (req, res) => {
  try {
    const ids = await listFarmUserIds(getFarmId(req)!);
    const people = ids.length === 0 ? [] : await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(inArray(users.id, ids));
    res.json(people);
  } catch (error) {
    handleError(res, error, "Failed to fetch users");
  }
});

// POST /api/jobs - Create a job (multipart with photos, or JSON)
router.post("/", uploadMultiplePhotos, async (req, res) => {
  try {
    const farmId = getFarmId(req)!;
    const userId = getUserId(req)!;
    const data = jobFieldsSchema.parse(req.body);
    const photoUrls = await savePhotos(req);

    let assignees = await validAssignees(farmId, data.assignedTo);
    if (assignees.length === 0) assignees = [userId];

    const [job] = await db.insert(jobs).values({
      farmId,
      createdById: userId,
      title: data.title,
      description: data.description,
      location: data.location,
      latitude: data.latitude?.toString(),
      longitude: data.longitude?.toString(),
      pastureId: await validPasture(farmId, data.pastureId),
      status: data.status ?? "open",
      priority: data.priority ?? "medium",
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate ? new Date(data.endDate) : null,
      startTime: data.startTime,
      endTime: data.endTime,
      category: data.category ?? "general",
      notes: data.notes,
      checklistItems: data.checklistItems ?? [],
      estimatedDuration: data.estimatedDuration,
      photoUrls,
    }).returning();
    await setAssignees(job.id, assignees);
    await notifyAssigned(job, assignees, userId);

    const [apiJob] = await toApiJobs([job]);
    res.status(201).json(apiJob);
  } catch (error) {
    handleError(res, error, "Failed to create job");
  }
});

async function updateJob(req: Request, body: unknown) {
  const farmId = getFarmId(req)!;
  const job = await findFarmJob(farmId, req.params.id);
  if (!job) return null;

  const data = jobFieldsSchema.partial().parse(body);
  const newPhotos = await savePhotos(req);
  const { assignedTo, existingPhotos, startDate, endDate, latitude, longitude, status, pastureId, ...rest } = data;

  const updates: Partial<typeof jobs.$inferInsert> = { ...rest, updatedAt: new Date() };
  if (startDate !== undefined) updates.startDate = new Date(startDate);
  if (endDate !== undefined) updates.endDate = endDate ? new Date(endDate) : null;
  if (latitude !== undefined) updates.latitude = latitude?.toString() ?? null;
  if (longitude !== undefined) updates.longitude = longitude?.toString() ?? null;
  if (pastureId !== undefined) updates.pastureId = await validPasture(farmId, pastureId);
  if (status !== undefined) {
    updates.status = status;
    updates.completedAt = status === "completed" ? (job.completedAt ?? new Date()) : null;
  }
  if (newPhotos.length > 0 || existingPhotos !== undefined) {
    updates.photoUrls = [...(existingPhotos ?? job.photoUrls), ...newPhotos];
  }

  const [updated] = await db.update(jobs).set(updates).where(eq(jobs.id, job.id)).returning();
  if (assignedTo !== undefined) {
    const added = await setAssignees(job.id, await validAssignees(farmId, assignedTo));
    await notifyAssigned(updated, added, getUserId(req)!);
  }
  const [apiJob] = await toApiJobs([updated]);
  return apiJob;
}

// PATCH /api/jobs/:id/status - Kanban drag between columns
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = z.object({ status: z.string() }).parse(req.body);
    const job = await updateJob(req, { status });
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (error) {
    handleError(res, error, "Failed to update job status");
  }
});

// PATCH /api/jobs/:id - Update any job fields (multipart with photos, or JSON)
router.patch("/:id", uploadMultiplePhotos, async (req, res) => {
  try {
    const job = await updateJob(req, req.body);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (error) {
    handleError(res, error, "Failed to update job");
  }
});

// DELETE /api/jobs/:id
router.delete("/:id", async (req, res) => {
  try {
    const job = await findFarmJob(getFarmId(req)!, req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    await db.delete(jobs).where(eq(jobs.id, job.id));
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, "Failed to delete job");
  }
});

export default router;
