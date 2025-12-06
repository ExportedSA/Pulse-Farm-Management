// Health Monitoring API Routes
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { insertHealthScoreSchema, insertMortalityRecordSchema, insertHealthAlertSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

// ===== HEALTH SCORES =====

// GET /api/health/scores/:animalId - Get health scores for an animal
router.get("/scores/:animalId", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const scores = await storage.getHealthScoresByAnimal(animalId);
    res.json(scores);
  } catch (error) {
    console.error("Error fetching health scores:", error);
    res.status(500).json({ error: "Failed to fetch health scores" });
  }
});

// GET /api/health/scores/:animalId/latest - Get latest health score for an animal
router.get("/scores/:animalId/latest", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const score = await storage.getLatestHealthScore(animalId);
    res.json(score);
  } catch (error) {
    console.error("Error fetching latest health score:", error);
    res.status(500).json({ error: "Failed to fetch latest health score" });
  }
});

// POST /api/health/scores - Create health score
router.post("/scores", async (req: Request, res: Response) => {
  try {
    const validatedData = insertHealthScoreSchema.parse(req.body);
    
    // Validate animal exists
    const animal = await storage.getAnimal(validatedData.animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    // Validate lameness score range
    if (validatedData.lamenessScore && !['1', '2', '3', '4', '5'].includes(validatedData.lamenessScore)) {
      return res.status(400).json({ error: "Lameness score must be 1-5" });
    }

    // Validate body condition score range
    if (validatedData.bodyConditionScore && (validatedData.bodyConditionScore < 1 || validatedData.bodyConditionScore > 5)) {
      return res.status(400).json({ error: "Body condition score must be 1-5" });
    }

    const score = await storage.createHealthScore(validatedData);

    // Auto-generate health alerts based on thresholds
    await generateHealthAlerts(score);

    res.status(201).json(score);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating health score:", error);
    res.status(500).json({ error: "Failed to create health score" });
  }
});

// PUT /api/health/scores/:id - Update health score
router.put("/scores/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existingScore = await storage.getHealthScore(id);
    if (!existingScore) {
      return res.status(404).json({ error: "Health score not found" });
    }

    const validatedData = insertHealthScoreSchema.partial().parse(req.body);
    const updatedScore = await storage.updateHealthScore(id, validatedData);
    res.json(updatedScore);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating health score:", error);
    res.status(500).json({ error: "Failed to update health score" });
  }
});

// DELETE /api/health/scores/:id - Delete health score
router.delete("/scores/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existingScore = await storage.getHealthScore(id);
    if (!existingScore) {
      return res.status(404).json({ error: "Health score not found" });
    }

    await storage.deleteHealthScore(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting health score:", error);
    res.status(500).json({ error: "Failed to delete health score" });
  }
});

// GET /api/health/high-scc - Get animals with high SCC
router.get("/high-scc", async (req: Request, res: Response) => {
  try {
    const threshold = parseInt(req.query.threshold as string) || 200;
    const scores = await storage.getHealthScoresWithHighSCC(threshold);
    res.json(scores);
  } catch (error) {
    console.error("Error fetching high SCC scores:", error);
    res.status(500).json({ error: "Failed to fetch high SCC scores" });
  }
});

// GET /api/health/lameness - Get animals with lameness issues
router.get("/lameness", async (req: Request, res: Response) => {
  try {
    const minScore = (req.query.minScore as string) || '3';
    const scores = await storage.getHealthScoresWithLameness(minScore);
    res.json(scores);
  } catch (error) {
    console.error("Error fetching lameness scores:", error);
    res.status(500).json({ error: "Failed to fetch lameness scores" });
  }
});

// GET /api/health/fever - Get animals with fever
router.get("/fever", async (req: Request, res: Response) => {
  try {
    const threshold = parseFloat(req.query.threshold as string) || 39.5;
    const scores = await storage.getHealthScoresWithFever(threshold);
    res.json(scores);
  } catch (error) {
    console.error("Error fetching fever scores:", error);
    res.status(500).json({ error: "Failed to fetch fever scores" });
  }
});

// ===== MORTALITY RECORDS =====

// GET /api/health/mortality - Get all mortality records
router.get("/mortality", async (req: Request, res: Response) => {
  try {
    const records = await storage.getMortalityRecords();
    res.json(records);
  } catch (error) {
    console.error("Error fetching mortality records:", error);
    res.status(500).json({ error: "Failed to fetch mortality records" });
  }
});

// GET /api/health/mortality/:animalId - Get mortality records for an animal
router.get("/mortality/animal/:animalId", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const records = await storage.getMortalityRecordsByAnimal(animalId);
    res.json(records);
  } catch (error) {
    console.error("Error fetching mortality records for animal:", error);
    res.status(500).json({ error: "Failed to fetch mortality records for animal" });
  }
});

// POST /api/health/mortality - Create mortality record
router.post("/mortality", async (req: Request, res: Response) => {
  try {
    const validatedData = insertMortalityRecordSchema.parse(req.body);
    
    // Validate animal exists
    const animal = await storage.getAnimal(validatedData.animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const record = await storage.createMortalityRecord(validatedData);

    // Update animal status to deceased
    await storage.updateAnimal(validatedData.animalId, { status: 'deceased' });

    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating mortality record:", error);
    res.status(500).json({ error: "Failed to create mortality record" });
  }
});

// PUT /api/health/mortality/:id - Update mortality record
router.put("/mortality/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existingRecord = await storage.getMortalityRecord(id);
    if (!existingRecord) {
      return res.status(404).json({ error: "Mortality record not found" });
    }

    const validatedData = insertMortalityRecordSchema.partial().parse(req.body);
    const updatedRecord = await storage.updateMortalityRecord(id, validatedData);
    res.json(updatedRecord);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating mortality record:", error);
    res.status(500).json({ error: "Failed to update mortality record" });
  }
});

// DELETE /api/health/mortality/:id - Delete mortality record
router.delete("/mortality/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existingRecord = await storage.getMortalityRecord(id);
    if (!existingRecord) {
      return res.status(404).json({ error: "Mortality record not found" });
    }

    await storage.deleteMortalityRecord(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting mortality record:", error);
    res.status(500).json({ error: "Failed to delete mortality record" });
  }
});

// ===== HEALTH ALERTS =====

// GET /api/health/alerts - Get all health alerts
router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.active === 'true';
    const alerts = activeOnly 
      ? await storage.getActiveHealthAlerts()
      : await storage.getHealthAlerts();
    res.json(alerts);
  } catch (error) {
    console.error("Error fetching health alerts:", error);
    res.status(500).json({ error: "Failed to fetch health alerts" });
  }
});

// GET /api/health/alerts/animal/:animalId - Get health alerts for an animal
router.get("/alerts/animal/:animalId", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const alerts = await storage.getHealthAlertsByAnimal(animalId);
    res.json(alerts);
  } catch (error) {
    console.error("Error fetching health alerts for animal:", error);
    res.status(500).json({ error: "Failed to fetch health alerts for animal" });
  }
});

// POST /api/health/alerts/:id/acknowledge - Acknowledge health alert
router.post("/alerts/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    const existingAlert = await storage.getHealthAlert(id);
    if (!existingAlert) {
      return res.status(404).json({ error: "Health alert not found" });
    }

    const updatedAlert = await storage.acknowledgeHealthAlert(id, userId);
    res.json(updatedAlert);
  } catch (error) {
    console.error("Error acknowledging health alert:", error);
    res.status(500).json({ error: "Failed to acknowledge health alert" });
  }
});

// POST /api/health/alerts/:id/resolve - Resolve health alert
router.post("/alerts/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, notes } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    const existingAlert = await storage.getHealthAlert(id);
    if (!existingAlert) {
      return res.status(404).json({ error: "Health alert not found" });
    }

    const updatedAlert = await storage.resolveHealthAlert(id, userId, notes);
    res.json(updatedAlert);
  } catch (error) {
    console.error("Error resolving health alert:", error);
    res.status(500).json({ error: "Failed to resolve health alert" });
  }
});

// Helper function to auto-generate health alerts based on thresholds
async function generateHealthAlerts(score: any) {
  const alerts: any[] = [];

  // High SCC alert (mastitis indicator)
  if (score.somaticCellCount && score.somaticCellCount >= 200) {
    alerts.push({
      animalId: score.animalId,
      alertType: 'high_scc',
      severity: score.somaticCellCount >= 400 ? 'high' : 'medium',
      title: 'High Somatic Cell Count',
      description: `SCC of ${score.somaticCellCount}k cells/ml detected. Possible mastitis.`,
      triggerValue: score.somaticCellCount.toString(),
      thresholdValue: '200',
      relatedHealthScoreId: score.id,
      isActive: true,
    });
  }

  // Fever alert
  if (score.temperature && parseFloat(score.temperature) >= 39.5) {
    alerts.push({
      animalId: score.animalId,
      alertType: 'fever',
      severity: parseFloat(score.temperature) >= 40.5 ? 'critical' : 'high',
      title: 'Elevated Temperature',
      description: `Temperature of ${score.temperature}°${score.temperatureUnit || 'C'} detected. Possible illness.`,
      triggerValue: score.temperature.toString(),
      thresholdValue: '39.5',
      relatedHealthScoreId: score.id,
      isActive: true,
    });
  }

  // Lameness alert
  if (score.lamenessScore && parseInt(score.lamenessScore) >= 3) {
    alerts.push({
      animalId: score.animalId,
      alertType: 'lameness',
      severity: parseInt(score.lamenessScore) >= 4 ? 'high' : 'medium',
      title: 'Lameness Detected',
      description: `Lameness score of ${score.lamenessScore}/5 recorded${score.affectedLimb ? ` (${score.affectedLimb})` : ''}.`,
      triggerValue: score.lamenessScore,
      thresholdValue: '3',
      relatedHealthScoreId: score.id,
      isActive: true,
    });
  }

  // Low rumination alert
  if (score.ruminationMinutes && score.ruminationMinutes < 400) {
    alerts.push({
      animalId: score.animalId,
      alertType: 'low_rumination',
      severity: score.ruminationMinutes < 300 ? 'high' : 'medium',
      title: 'Low Rumination Activity',
      description: `Rumination of ${score.ruminationMinutes} minutes/day detected. Normal is 400-500 min/day.`,
      triggerValue: score.ruminationMinutes.toString(),
      thresholdValue: '400',
      relatedHealthScoreId: score.id,
      isActive: true,
    });
  }

  // Create all alerts
  for (const alert of alerts) {
    try {
      await storage.createHealthAlert(alert);
    } catch (error) {
      console.error("Error creating health alert:", error);
    }
  }
}

export default router;
