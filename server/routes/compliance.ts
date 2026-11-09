import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { safetyIncidents } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireFarm, getUserId, getFarmId } from "../middleware/auth";
import { getFarmRole } from "../domain/farms";
import { triggerComplianceChecks, getComplianceStatus } from "../scheduler";
import { seasonOf } from "../domain/season";
import { complianceReadiness, auditPack, toCsv, PACK_SECTIONS } from "../domain/compliance-pack";
import logger from "../config/logger";
import { uploadAttachments } from "../middleware/upload";
import { saveAttachments, toApiAttachment } from "../domain/attachments";
import { MapError } from "../domain/farm-map";
import {
  DOCUMENT_KEYS, HAZARD_KEYS, STATUS_KEYS, createDocument, createHazard, documentExists, getHazard, listDocuments, listHazards,
  updateDocument, updateHazard, type HazardInput,
} from "../domain/safety";

const router = Router();
router.use(requireAuth, requireFarm);

// IDs are uuids; anything else can't exist (and would be a database error)
router.param("id", (_req, res, next, id) => {
  if (!z.string().uuid().safeParse(id).success) {
    return res.status(404).json({ error: "Not found" });
  }
  next();
});

function validationError(res: any, error: unknown) {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.errors });
    return true;
  }
  return false;
}

// ============================================
// HAZARDS
// ============================================

const hazardInput = z.object({
  title: z.string().trim().min(1).max(255),
  type: z.enum(HAZARD_KEYS),
  description: z.string().max(4000).nullish(),
  riskLevel: z.coerce.number().int().min(1).max(5),
  controls: z.string().max(4000).nullish(),
  location: z.string().max(255).nullish(),
  status: z.enum(STATUS_KEYS).optional(),
  reviewDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  assignedTo: z.string().uuid().nullish(),
  geometry: z.object({ type: z.string(), coordinates: z.any() }).nullish(),
  radiusM: z.coerce.number().positive().max(100000).nullish(),
});

const roleOf = (req: any) => getFarmRole(getUserId(req)!, getFarmId(req)!);
// Anyone working on the farm can report a hazard; owners and managers keep the register
const canReport = (role?: string) => role === 'owner' || role === 'manager' || role === 'worker';
const canManage = (role?: string) => role === 'owner' || role === 'manager';

function safetyError(res: any, error: unknown, message: string) {
  if (validationError(res, error)) return;
  if (error instanceof MapError) return res.status(error.status).json({ error: error.message });
  console.error(message, error);
  res.status(500).json({ error: message });
}

function withUploads(req: any, res: any, next: any) {
  uploadAttachments(req, res, (err: any) => (err ? res.status(400).json({ error: err.message }) : next()));
}

// The hazard register: active and monitored hazards, or ?all=1 for resolved ones too
router.get("/hazards", async (req, res) => {
  try {
    res.json(await listHazards(getFarmId(req)!, { includeResolved: req.query.all === '1' }));
  } catch (error) {
    safetyError(res, error, "Failed to fetch hazards");
  }
});

router.get("/hazards/:id", async (req, res) => {
  try {
    const hazard = await getHazard(getFarmId(req)!, req.params.id);
    if (!hazard) return res.status(404).json({ error: "Hazard not found" });
    res.json(hazard);
  } catch (error) {
    safetyError(res, error, "Failed to fetch hazard");
  }
});

// Report a hazard, optionally drawn on the farm map
router.post("/hazards", async (req, res) => {
  try {
    if (!canReport(await roleOf(req))) return res.status(403).json({ error: "Viewers and contractors can't add hazards. Tell the farm about it." });
    const data = hazardInput.parse(req.body);
    res.status(201).json(await createHazard(getFarmId(req)!, getUserId(req)!, data as HazardInput));
  } catch (error) {
    safetyError(res, error, "Failed to create hazard");
  }
});

// Change a hazard: its details, controls, status, review date or where it is on the map
router.patch("/hazards/:id", async (req, res) => {
  try {
    if (!canManage(await roleOf(req))) return res.status(403).json({ error: "Only owners and managers can change the hazard register" });
    await updateHazard(getFarmId(req)!, getUserId(req)!, req.params.id, hazardInput.partial().parse(req.body) as Partial<HazardInput>);
    res.json(await getHazard(getFarmId(req)!, req.params.id));
  } catch (error) {
    safetyError(res, error, "Failed to update hazard");
  }
});

router.post("/hazards/:id/resolve", async (req, res) => {
  try {
    if (!canManage(await roleOf(req))) return res.status(403).json({ error: "Only owners and managers can resolve hazards" });
    await updateHazard(getFarmId(req)!, getUserId(req)!, req.params.id, { status: 'resolved' });
    res.json(await getHazard(getFarmId(req)!, req.params.id));
  } catch (error) {
    safetyError(res, error, "Failed to resolve hazard");
  }
});

// Photos of a hazard
router.post("/hazards/:id/photos", withUploads, async (req, res) => {
  try {
    if (!canReport(await roleOf(req))) return res.status(403).json({ error: "Viewers and contractors can't add photos here" });
    const hazard = await getHazard(getFarmId(req)!, req.params.id);
    if (!hazard) return res.status(404).json({ error: "Hazard not found" });
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) return res.status(400).json({ error: "Attach at least one photo" });
    const saved = await saveAttachments(getFarmId(req)!, 'hazard', hazard.id, files, getUserId(req)!);
    res.status(201).json(saved.map(toApiAttachment));
  } catch (error) {
    safetyError(res, error, "Failed to add photos");
  }
});

// ============================================
// SAFETY DOCUMENTS
// ============================================

const documentInput = z.object({
  title: z.string().trim().min(1).max(200),
  docType: z.enum(DOCUMENT_KEYS),
  reviewDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  notes: z.string().max(4000).nullish(),
});

// The fields come as JSON in "data" when files are sent with them
const bodyOf = (req: any) => (typeof req.body?.data === 'string' ? JSON.parse(req.body.data) : req.body);

router.get("/documents", async (req, res) => {
  try {
    res.json(await listDocuments(getFarmId(req)!, { includeArchived: req.query.all === '1' }));
  } catch (error) {
    safetyError(res, error, "Failed to fetch documents");
  }
});

router.post("/documents", withUploads, async (req, res) => {
  try {
    if (!canManage(await roleOf(req))) return res.status(403).json({ error: "Only owners and managers can add safety documents" });
    const farmId = getFarmId(req)!;
    const created = await createDocument(farmId, getUserId(req)!, documentInput.parse(bodyOf(req)));
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length) await saveAttachments(farmId, 'safety_document', created.id, files, getUserId(req)!);
    res.status(201).json(created);
  } catch (error) {
    safetyError(res, error, "Failed to add document");
  }
});

router.patch("/documents/:id", async (req, res) => {
  try {
    if (!canManage(await roleOf(req))) return res.status(403).json({ error: "Only owners and managers can change safety documents" });
    await updateDocument(getFarmId(req)!, req.params.id, documentInput.partial().extend({ archived: z.boolean().optional() }).parse(req.body));
    res.json({ ok: true });
  } catch (error) {
    safetyError(res, error, "Failed to update document");
  }
});

router.post("/documents/:id/files", withUploads, async (req, res) => {
  try {
    if (!canManage(await roleOf(req))) return res.status(403).json({ error: "Only owners and managers can add files" });
    const farmId = getFarmId(req)!;
    if (!(await documentExists(farmId, req.params.id))) return res.status(404).json({ error: "Document not found" });
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) return res.status(400).json({ error: "Attach at least one file" });
    const saved = await saveAttachments(farmId, 'safety_document', req.params.id, files, getUserId(req)!);
    res.status(201).json(saved.map(toApiAttachment));
  } catch (error) {
    safetyError(res, error, "Failed to add files");
  }
});

// ============================================
// INCIDENTS
// ============================================

const INCIDENT_STATUSES = ["open", "investigating", "resolved", "closed"] as const;

// Get the farm's incidents, newest first
router.get("/incidents", async (req, res) => {
  try {
    const incidents = await db.select()
      .from(safetyIncidents)
      .where(eq(safetyIncidents.farmId, getFarmId(req)!))
      .orderBy(desc(safetyIncidents.occurredAt));
    res.json(incidents);
  } catch (error) {
    console.error("Failed to fetch incidents:", error);
    res.status(500).json({ error: "Failed to fetch incidents" });
  }
});

// Report an incident
router.post("/incidents", async (req, res) => {
  try {
    const data = z.object({
      type: z.string().min(1).max(50),
      description: z.string().min(1),
      severity: z.enum(["minor", "moderate", "major", "critical"]),
      occurredAt: z.coerce.date().refine(d => d <= new Date(), "Can't be in the future"),
      location: z.string().max(255).optional(),
      latitude: z.coerce.number().min(-90).max(90).optional(),
      longitude: z.coerce.number().min(-180).max(180).optional(),
    }).parse(req.body);
    const { latitude, longitude, ...fields } = data;

    const [incident] = await db.insert(safetyIncidents).values({
      ...fields,
      farmId: getFarmId(req)!,
      reportedBy: getUserId(req)!,
    }).returning();
    // Where it happened, when it was marked on the map
    if (latitude != null && longitude != null) {
      await db.execute(sql`UPDATE safety_incidents SET geom = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography WHERE id = ${incident.id}`);
    }
    res.status(201).json(incident);
  } catch (error) {
    if (validationError(res, error)) return;
    console.error("Failed to create incident:", error);
    res.status(500).json({ error: "Failed to create incident" });
  }
});

// Update incident status
router.patch("/incidents/:id/status", async (req, res) => {
  try {
    const { status } = z.object({ status: z.enum(INCIDENT_STATUSES) }).parse(req.body);
    const resolved = status === 'resolved' || status === 'closed';
    const [incident] = await db.update(safetyIncidents)
      .set({ status, resolvedAt: resolved ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(safetyIncidents.id, req.params.id), eq(safetyIncidents.farmId, getFarmId(req)!)))
      .returning();

    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }
    res.json(incident);
  } catch (error) {
    if (validationError(res, error)) return;
    console.error("Failed to update incident:", error);
    res.status(500).json({ error: "Failed to update incident" });
  }
});

// ===== AUTOMATED COMPLIANCE CHECKS =====

/**
 * GET /api/compliance/status
 * Get current compliance status summary
 */
router.get("/status", async (req, res) => {
  try {
    const status = await getComplianceStatus(getFarmId(req)!);
    res.json(status);
  } catch (error) {
    logger.error({ err: error }, "Failed to get compliance status");
    res.status(500).json({ error: "Failed to get compliance status" });
  }
});

/**
 * POST /api/compliance/run-checks
 * Manually trigger compliance checks (farm owners and managers)
 */
router.post("/run-checks", async (req, res) => {
  try {
    const farmId = getFarmId(req)!;
    const userId = getUserId(req)!;
    const role = await getFarmRole(userId, farmId);
    if (role !== 'owner' && role !== 'manager') {
      return res.status(403).json({ error: "You do not have permission to run compliance checks" });
    }

    logger.info({ userId, farmId }, "Manual compliance check triggered via API");

    const result = await triggerComplianceChecks(farmId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to run compliance checks");
    res.status(500).json({ error: "Failed to run compliance checks" });
  }
});

// ===== AUDIT READINESS AND PACK =====

const seasonParam = (value: unknown) =>
  z.string().regex(/^\d{4}\/\d{2}$/, "Season must look like 2026/27").default(seasonOf(new Date())).parse(value);

/**
 * GET /api/compliance/readiness?season=2026/27
 * Each Dairy Diary / Farm Dairy Records requirement checked against the farm's records
 */
router.get("/readiness", async (req, res) => {
  try {
    res.json(await complianceReadiness(getFarmId(req)!, seasonParam(req.query.season)));
  } catch (error) {
    if (error instanceof z.ZodError) return validationError(res, error);
    logger.error({ err: error }, "Failed to check compliance readiness");
    res.status(500).json({ error: "Failed to check compliance readiness" });
  }
});

/**
 * GET /api/compliance/pack?season=2026/27 - every audit pack section as rows
 * GET /api/compliance/pack/:section.csv?season=2026/27 - one section as a spreadsheet
 */
router.get("/pack", async (req, res) => {
  try {
    res.json(await auditPack(getFarmId(req)!, seasonParam(req.query.season)));
  } catch (error) {
    if (error instanceof z.ZodError) return validationError(res, error);
    logger.error({ err: error }, "Failed to build audit pack");
    res.status(500).json({ error: "Failed to build audit pack" });
  }
});

router.get("/pack/:section.csv", async (req, res) => {
  try {
    const key = req.params.section;
    if (!(PACK_SECTIONS as readonly string[]).includes(key)) return res.status(404).json({ error: "No such section" });
    const season = seasonParam(req.query.season);
    const pack = await auditPack(getFarmId(req)!, season);
    const section = pack.sections.find(s => s.key === key)!;
    const name = `${(pack.farmName ?? "farm").replace(/[^A-Za-z0-9]+/g, "-")}-${key.replace(/_/g, "-")}-${season.replace("/", "-")}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.send(toCsv(section));
  } catch (error) {
    if (error instanceof z.ZodError) return validationError(res, error);
    logger.error({ err: error }, "Failed to export audit pack");
    res.status(500).json({ error: "Failed to export audit pack" });
  }
});

export default router;
