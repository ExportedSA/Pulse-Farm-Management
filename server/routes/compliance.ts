import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { farmHazards, safetyIncidents } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireFarm, getUserId, getFarmId } from "../middleware/auth";
import { getFarmRole } from "../domain/farms";
import { triggerComplianceChecks, getComplianceStatus } from "../scheduler";
import logger from "../config/logger";

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

// Get the farm's hazards
router.get("/hazards", async (req, res) => {
  try {
    const hazards = await db.select()
      .from(farmHazards)
      .where(eq(farmHazards.farmId, getFarmId(req)!))
      .orderBy(desc(farmHazards.createdAt));

    res.json(hazards);
  } catch (error) {
    console.error("Failed to fetch hazards:", error);
    res.status(500).json({ error: "Failed to fetch hazards" });
  }
});

// Create new hazard
router.post("/hazards", async (req, res) => {
  try {
    const data = z.object({
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      type: z.string().min(1).max(50),
      riskLevel: z.coerce.number().int().min(1).max(5).default(3),
      severity: z.enum(["low", "medium", "high", "critical"]).optional(),
      location: z.string().max(255).optional(),
      latitude: z.coerce.number().optional(),
      longitude: z.coerce.number().optional(),
    }).parse(req.body);

    const [hazard] = await db.insert(farmHazards).values({
      farmId: getFarmId(req)!,
      title: data.title,
      description: data.description,
      type: data.type,
      severity: data.severity ?? (data.riskLevel <= 2 ? 'low' : data.riskLevel <= 3 ? 'medium' : 'high'),
      riskLevel: data.riskLevel,
      location: data.location,
      latitude: data.latitude?.toString(),
      longitude: data.longitude?.toString(),
      status: 'active',
      mitigationRequired: data.riskLevel > 2,
      reportedBy: getUserId(req)!,
    }).returning();

    res.status(201).json(hazard);
  } catch (error) {
    if (validationError(res, error)) return;
    console.error("Failed to create hazard:", error);
    res.status(500).json({ error: "Failed to create hazard" });
  }
});

// Resolve hazard
router.post("/hazards/:id/resolve", async (req, res) => {
  try {
    const [resolvedHazard] = await db.update(farmHazards)
      .set({
        status: 'resolved',
        resolvedBy: getUserId(req)!,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(farmHazards.id, req.params.id), eq(farmHazards.farmId, getFarmId(req)!)))
      .returning();

    if (!resolvedHazard) {
      return res.status(404).json({ error: "Hazard not found" });
    }

    res.json(resolvedHazard);
  } catch (error) {
    console.error("Failed to resolve hazard:", error);
    res.status(500).json({ error: "Failed to resolve hazard" });
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
    }).parse(req.body);

    const [incident] = await db.insert(safetyIncidents).values({
      ...data,
      farmId: getFarmId(req)!,
      reportedBy: getUserId(req)!,
    }).returning();
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

export default router;
