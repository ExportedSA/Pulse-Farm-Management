import { Router } from "express";
import { db } from "../db";
import { farmHazards, users } from "@shared/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { triggerComplianceChecks, getComplianceStatus } from "../scheduler";
import logger from "../config/logger";

const router = Router();

// Mock data for incidents and inductions (would be in database in production)
let incidents = [
  {
    id: '1',
    type: 'injury',
    description: 'Worker slipped in milking shed due to wet floor',
    severity: 'minor' as const,
    status: 'open' as const,
    occurredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    reportedBy: 'demo-user',
    location: 'Main Milking Shed',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    type: 'near miss',
    description: 'Forklift nearly collided with pedestrian in yard',
    severity: 'major' as const,
    status: 'investigating' as const,
    occurredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    reportedBy: 'demo-user',
    location: 'Main Yard',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
];

let inductionModules = [
  {
    id: '1',
    title: 'Farm Safety Induction',
    description: 'Basic safety procedures and emergency protocols',
    type: 'safety' as const,
    isMandatory: true,
    estimatedDuration: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Milking Equipment Operation',
    description: 'Safe operation of milking machinery and equipment',
    type: 'equipment' as const,
    isMandatory: true,
    estimatedDuration: 45,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    title: 'Biosecurity Protocols',
    description: 'Farm biosecurity measures and disease prevention',
    type: 'biosecurity' as const,
    isMandatory: false,
    estimatedDuration: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let inductionCompletions = [
  {
    id: '1',
    moduleId: '1',
    userId: 'demo-user',
    completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    score: 95
  }
];

// ============================================
// HAZARDS
// ============================================

// Get all hazards
router.get("/hazards", requireAuth, async (req, res) => {
  try {
    const hazards = await db.select()
      .from(farmHazards)
      .where(isNull(farmHazards.deletedAt))
      .orderBy(desc(farmHazards.createdAt));
    
    res.json(hazards);
  } catch (error) {
    console.error("Failed to fetch hazards:", error);
    res.status(500).json({ error: "Failed to fetch hazards" });
  }
});

// Create new hazard
router.post("/hazards", requireAuth, async (req, res) => {
  try {
    const userId = (req.user as any)?.id || "demo-user";
    const { title, description, type, riskLevel, location, severity } = req.body;
    
    const [hazard] = await db.insert(farmHazards).values({
      title,
      description,
      type,
      severity: severity || (riskLevel <= 2 ? 'low' : riskLevel <= 3 ? 'medium' : 'high'),
      riskLevel: riskLevel || 3,
      location,
      latitude: -37.7889, // Default coordinates (should be provided by frontend)
      longitude: 175.3098,
      status: 'active',
      mitigationRequired: riskLevel > 2,
      reportedBy: userId,
      createdAt: new Date(),
    }).returning();
    
    res.status(201).json(hazard);
  } catch (error) {
    console.error("Failed to create hazard:", error);
    res.status(500).json({ error: "Failed to create hazard" });
  }
});

// Resolve hazard
router.post("/hazards/:id/resolve", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?.id || "demo-user";
    
    const [resolvedHazard] = await db.update(farmHazards)
      .set({
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(farmHazards.id, id))
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

// Get all incidents
router.get("/incidents", requireAuth, async (req, res) => {
  try {
    // In production, this would query the database
    res.json(incidents);
  } catch (error) {
    console.error("Failed to fetch incidents:", error);
    res.status(500).json({ error: "Failed to fetch incidents" });
  }
});

// Create new incident
router.post("/incidents", requireAuth, async (req, res) => {
  try {
    const userId = (req.user as any)?.id || "demo-user";
    const { type, description, occurredAt, severity, location } = req.body;
    
    const newIncident = {
      id: String(incidents.length + 1),
      type,
      description,
      severity,
      status: 'open' as const,
      occurredAt: new Date(occurredAt).toISOString(),
      reportedBy: userId,
      location,
      createdAt: new Date().toISOString(),
    };
    
    incidents.unshift(newIncident);
    res.status(201).json(newIncident);
  } catch (error) {
    console.error("Failed to create incident:", error);
    res.status(500).json({ error: "Failed to create incident" });
  }
});

// Update incident status
router.patch("/incidents/:id/status", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const incident = incidents.find(i => i.id === id);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }
    
    incident.status = status;
    if (status === 'resolved' || status === 'closed') {
      incident.resolvedAt = new Date().toISOString();
    }
    
    res.json(incident);
  } catch (error) {
    console.error("Failed to update incident:", error);
    res.status(500).json({ error: "Failed to update incident" });
  }
});

// ============================================
// INDUCTIONS
// ============================================

// Get induction modules
router.get("/inductions", requireAuth, async (req, res) => {
  try {
    // In production, this would query the database
    res.json(inductionModules);
  } catch (error) {
    console.error("Failed to fetch inductions:", error);
    res.status(500).json({ error: "Failed to fetch inductions" });
  }
});

// Get induction completions for a user
router.get("/inductions/completions", requireAuth, async (req, res) => {
  try {
    const { userId } = req.query;
    const targetUserId = userId || (req.user as any)?.id || "demo-user";
    
    // In production, this would query the database
    const userCompletions = inductionCompletions.filter(c => c.userId === targetUserId);
    res.json(userCompletions);
  } catch (error) {
    console.error("Failed to fetch induction completions:", error);
    res.status(500).json({ error: "Failed to fetch induction completions" });
  }
});

// ============================================
// CHECK-IN
// ============================================

// Create check-in (stub endpoint)
router.post("/checkins", requireAuth, async (req, res) => {
  try {
    const userId = (req.user as any)?.id || "demo-user";
    const checkInData = {
      ...req.body,
      id: String(Date.now()),
      checkInTime: new Date().toISOString(),
      checkedInBy: userId,
    };
    
    // In production, this would save to database
    console.log("Check-in created:", checkInData);
    
    res.status(201).json({
      success: true,
      message: "Check-in successful",
      checkIn: checkInData
    });
  } catch (error) {
    console.error("Failed to create check-in:", error);
    res.status(500).json({ error: "Failed to create check-in" });
  }
});

// ===== AUTOMATED COMPLIANCE CHECKS =====

/**
 * GET /api/compliance/status
 * Get current compliance status summary
 */
router.get("/status", requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const status = await getComplianceStatus(farmId);
    res.json(status);
  } catch (error) {
    logger.error({ error }, "Failed to get compliance status");
    res.status(500).json({ error: "Failed to get compliance status" });
  }
});

/**
 * POST /api/compliance/run-checks
 * Manually trigger compliance checks (admin only)
 */
router.post("/run-checks", requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Only allow managers/admins to trigger checks
    const allowedRoles = ['owner', 'manager', 'admin'];
    if (!userRole || !allowedRoles.includes(userRole.toLowerCase())) {
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
    logger.error({ error }, "Failed to run compliance checks");
    res.status(500).json({ error: "Failed to run compliance checks" });
  }
});

export default router;
