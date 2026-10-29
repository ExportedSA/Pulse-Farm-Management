/**
 * Jobs API (mounted at /api/jobs behind requireAuth), used by the Jobs, Kanban,
 * Calendar, Weather and Operations pages. Jobs belong to the signed-in user's farm and
 * can have several assignees (job_assignments).
 */
import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../db";
import { jobs, jobAssignments, users, pastures, farms, type Job } from "@shared/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { uploadMultiplePhotos } from "../middleware/upload";
import { getFarmId, getUserId, requireFarm } from "../middleware/auth";
import { getFarmRole, listFarmUserIds, type FarmRole } from "../domain/farms";
import { createRecord } from "../domain/records";
import { saveAttachments } from "../domain/attachments";
import { farmClock } from "../domain/job-reminders";
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

async function farmToday(farmId: string): Promise<string> {
  const [farm] = await db.select({ timezone: farms.timezone }).from(farms).where(eq(farms.id, farmId));
  return farmClock(farm?.timezone ?? null).day;
}

/**
 * Middle of a paddock's drawn outline, for jobs placed by paddock without a pin
 */
async function paddockCenter(pastureId: string | null | undefined): Promise<{ latitude: string; longitude: string } | null> {
  if (!pastureId) return null;
  const [row] = await db
    .select({ lat: pastures.centerLatitude, lng: pastures.centerLongitude })
    .from(pastures)
    .where(eq(pastures.id, pastureId));
  return row?.lat != null && row?.lng != null ? { latitude: String(row.lat), longitude: String(row.lng) } : null;
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
  const completerIds = Array.from(new Set(rows.map(r => r.completedById).filter((id): id is string => !!id)));
  const completers = new Map((completerIds.length === 0 ? [] : await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, completerIds))).map(u => [u.id, u.name]));
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
      completedBy: job.completedById,
      completedByName: job.completedById ? completers.get(job.completedById) ?? null : null,
      completionNote: job.completionNote,
      completionLatitude: job.completionLatitude != null ? Number(job.completionLatitude) : null,
      completionLongitude: job.completionLongitude != null ? Number(job.completionLongitude) : null,
      completionRecordId: job.completionRecordId,
    };
  });
}

async function findFarmJob(farmId: string, id: string): Promise<Job | undefined> {
  if (!z.string().uuid().safeParse(id).success) return undefined;
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.farmId, farmId)));
  return job;
}

// Who may do what: owners and managers run the job board; workers report jobs for
// themselves and work their own; viewers only look
class Forbidden extends Error {}

const isManager = (role: FarmRole | undefined) => role === "owner" || role === "manager";

async function roleOf(req: Request): Promise<FarmRole | undefined> {
  return getFarmRole(getUserId(req)!, getFarmId(req)!);
}

async function isAssigned(jobId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: jobAssignments.id })
    .from(jobAssignments)
    .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.userId, userId)));
  return !!row;
}

function handleError(res: any, error: unknown, message: string) {
  if (error instanceof Forbidden) {
    return res.status(403).json({ error: error.message });
  }
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
    const role = await roleOf(req);
    if (!role || role === "viewer") throw new Forbidden("Viewers can't create jobs");

    let assignees = await validAssignees(farmId, data.assignedTo);
    if (assignees.length === 0) assignees = [userId];
    if (!isManager(role) && assignees.some(id => id !== userId)) {
      throw new Forbidden("Only owners and managers can give jobs to other people");
    }
    const photoUrls = await savePhotos(req);
    const pastureId = await validPasture(farmId, data.pastureId);
    // No pin but a mapped paddock: pin it in the middle of the paddock
    const pin = data.latitude != null && data.longitude != null
      ? { latitude: data.latitude.toString(), longitude: data.longitude.toString() }
      : await paddockCenter(pastureId);

    const [job] = await db.insert(jobs).values({
      farmId,
      createdById: userId,
      title: data.title,
      description: data.description,
      location: data.location,
      latitude: pin?.latitude,
      longitude: pin?.longitude,
      pastureId,
      status: data.status ?? "open",
      priority: data.priority ?? "medium",
      // No date given: today on the farm (stored, like picked dates, as that day at midnight UTC)
      startDate: new Date(data.startDate ?? await farmToday(farmId)),
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

// What someone assigned to a job (but not running the board) may change on it
const WORKER_FIELDS = new Set(["status", "checklistItems", "notes"]);

async function updateJob(req: Request, body: unknown): Promise<any> {
  const farmId = getFarmId(req)!;
  const userId = getUserId(req)!;
  const job = await findFarmJob(farmId, req.params.id);
  if (!job) return null;

  const data = jobFieldsSchema.partial().parse(body);
  const role = await roleOf(req);
  if (!isManager(role)) {
    if (role !== "worker" || !(await isAssigned(job.id, userId))) {
      throw new Forbidden("Only the people on this job, owners and managers can change it");
    }
    const other = Object.keys(data).filter(k => (data as any)[k] !== undefined && !WORKER_FIELDS.has(k));
    if (other.length > 0) throw new Forbidden("Only owners and managers can edit or reassign jobs");
  }
  // Completing always goes through the completion steps, so it leaves a Job done record
  if (data.status === "completed" && job.status !== "completed") {
    const { status: _status, ...others } = data;
    if (Object.keys(others).some(k => (others as any)[k] !== undefined)) {
      await updateJob(req, others);
    }
    return completeJob(req, (await findFarmJob(farmId, job.id))!, {});
  }
  const newPhotos = await savePhotos(req);
  const { assignedTo, existingPhotos, startDate, endDate, latitude, longitude, status, pastureId, ...rest } = data;

  const updates: Partial<typeof jobs.$inferInsert> = { ...rest, updatedAt: new Date() };
  if (startDate !== undefined) updates.startDate = new Date(startDate);
  if (endDate !== undefined) updates.endDate = endDate ? new Date(endDate) : null;
  if (latitude !== undefined) updates.latitude = latitude?.toString() ?? null;
  if (longitude !== undefined) updates.longitude = longitude?.toString() ?? null;
  if (pastureId !== undefined) {
    updates.pastureId = await validPasture(farmId, pastureId);
    // Moved to a mapped paddock and not pinned: pin it there
    const pinned = (latitude !== undefined ? latitude : job.latitude) != null;
    const center = !pinned ? await paddockCenter(updates.pastureId) : null;
    if (center) Object.assign(updates, center);
  }
  if (status !== undefined) {
    updates.status = status;
    if (status !== "completed") {
      // Reopened: it can be completed (and recorded) again
      Object.assign(updates, {
        completedAt: null, completedById: null, completionNote: null,
        completionLatitude: null, completionLongitude: null, completionRecordId: null, overdueNotifiedAt: null,
      });
    }
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

interface Completion { note?: string | null; latitude?: number | null; longitude?: number | null }

/**
 * Mark a job done with its proof (note, photos, where it was finished) and save it to
 * Records as a "Job done" record. Safe to repeat: a job already done is returned as it is.
 */
async function completeJob(req: Request, job: Job, proof: Completion) {
  const farmId = getFarmId(req)!;
  const userId = getUserId(req)!;
  if (job.status === "completed" && job.completionRecordId) {
    const [apiJob] = await toApiJobs([job]);
    return apiJob;
  }
  const missing = job.checklistItems.filter(i => i.required && !i.completed);
  if (missing.length > 0) {
    throw new z.ZodError([{ code: "custom", path: ["checklistItems"], message: `Tick off first: ${missing.map(i => i.text).join(", ")}` }]);
  }

  const [actor] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  const people = await db
    .select({ name: users.name })
    .from(jobAssignments)
    .innerJoin(users, eq(jobAssignments.userId, users.id))
    .where(eq(jobAssignments.jobId, job.id));
  const lat = proof.latitude ?? (job.latitude != null ? Number(job.latitude) : null);
  const lng = proof.longitude ?? (job.longitude != null ? Number(job.longitude) : null);
  const ticked = job.checklistItems.filter(i => i.completed).length;

  // One record per job, so a retried upload doesn't make a second one
  const { record } = await createRecord(farmId, userId, {
    type: "job_done",
    title: job.title.slice(0, 255),
    notes: proof.note || null,
    occurredAt: new Date(),
    pastureIds: job.pastureId ? [job.pastureId] : [],
    latitude: lat,
    longitude: lng,
    details: {
      jobId: job.id,
      category: job.category ?? undefined,
      assignedTo: people.map(p => p.name).join(", ") || undefined,
      completedBy: actor?.name,
      location: job.location || undefined,
      checklist: job.checklistItems.length > 0 ? `${ticked}/${job.checklistItems.length} ticked` : undefined,
    },
    tags: ["Job done"],
  }, `job-done-${job.id}`);

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const saved = files.length > 0
    ? await saveAttachments(farmId, "record", record.id, files, userId, {
      latitude: lat ?? undefined, longitude: lng ?? undefined, takenAt: new Date(),
    })
    : [];

  const [updated] = await db.update(jobs).set({
    status: "completed",
    completedAt: new Date(),
    completedById: userId,
    completionNote: proof.note || null,
    completionLatitude: proof.latitude != null ? String(proof.latitude) : null,
    completionLongitude: proof.longitude != null ? String(proof.longitude) : null,
    completionRecordId: record.id,
    photoUrls: [...job.photoUrls, ...saved.map(a => a.url)],
    updatedAt: new Date(),
  }).where(eq(jobs.id, job.id)).returning();

  // Let whoever set the job, and the people running the board, know it's done
  const managers = await listFarmUserIds(farmId, ["owner", "manager"]);
  const recipients = Array.from(new Set([job.createdById, ...managers])).filter(id => id !== userId);
  if (recipients.length > 0) {
    await notifyUsers(recipients, {
      type: "job_completed",
      title: "Job done",
      message: `${job.title}${actor?.name ? ` (${actor.name})` : ""}`,
      farmId,
      link: `/app/jobs?job=${job.id}`,
      metadata: { jobId: job.id, recordId: record.id },
    }).catch(error => console.error("Failed to notify job completion:", error));
  }

  const [apiJob] = await toApiJobs([updated]);
  return apiJob;
}

// POST /api/jobs/:id/complete - finish a job with a note, photos and where it was done
router.post("/:id/complete", uploadMultiplePhotos, async (req, res) => {
  try {
    const job = await findFarmJob(getFarmId(req)!, req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    const role = await roleOf(req);
    if (!isManager(role) && !(role === "worker" && await isAssigned(job.id, getUserId(req)!))) {
      throw new Forbidden("Only the people on this job, owners and managers can complete it");
    }
    const proof = z.object({
      note: z.string().max(2000).optional().nullable(),
      latitude: optionalNumber,
      longitude: optionalNumber,
    }).parse(req.body ?? {});
    res.json(await completeJob(req, job, proof));
  } catch (error) {
    handleError(res, error, "Failed to complete job");
  }
});

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
    if (!isManager(await roleOf(req))) throw new Forbidden("Only owners and managers can delete jobs");
    await db.delete(jobs).where(eq(jobs.id, job.id));
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, "Failed to delete job");
  }
});

export default router;
