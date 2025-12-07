// Health Tracking API Routes - Weight Management
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { insertWeightRecordSchema, insertWeightTargetSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

// GET /api/weight/records/:animalId - Get weight history for an animal with ADG calculations
router.get("/records/:animalId", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    // Validate animal exists
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const weightRecords = await storage.getWeightRecordsByAnimal(animalId);
    
    // Reverse to oldest-first for ADG calculation, then reverse back for display
    const oldestFirst = [...weightRecords].reverse();
    
    // Calculate ADG (Average Daily Gain) for each record after the first one
    const recordsWithADG = oldestFirst.map((record, index) => {
      if (index === 0) {
        return { ...record, adg: null };
      }
      
      const previousRecord = oldestFirst[index - 1];
      const daysDiff = Math.ceil(
        (new Date(record.date).getTime() - new Date(previousRecord.date).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      
      if (daysDiff <= 0) {
        return { ...record, adg: null };
      }
      
      const weightDiff = Number(record.weight) - Number(previousRecord.weight);
      const adg = daysDiff > 0 ? weightDiff / daysDiff : null;
      
      return { ...record, adg: Number(adg?.toFixed(3)) || null };
    }).reverse(); // Reverse back to newest-first for display

    res.json(recordsWithADG);
  } catch (error) {
    console.error("Error fetching weight records:", error);
    res.status(500).json({ error: "Failed to fetch weight records" });
  }
});

// GET /api/weight/records/:animalId/latest - Get most recent weight record for an animal
router.get("/records/:animalId/latest", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    // Validate animal exists
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const latestRecord = await storage.getLatestWeightRecord(animalId);
    
    if (!latestRecord) {
      return res.json(null);
    }

    res.json(latestRecord);
  } catch (error) {
    console.error("Error fetching latest weight record:", error);
    res.status(500).json({ error: "Failed to fetch latest weight record" });
  }
});

// POST /api/weight/records - Add new weight record
router.post("/records", async (req: Request, res: Response) => {
  try {
    const validatedData = insertWeightRecordSchema.parse(req.body);
    
    // Additional validation
    if (Number(validatedData.weight) <= 0) {
      return res.status(400).json({ error: "Weight must be greater than 0" });
    }
    
    const recordDate = new Date(validatedData.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    if (recordDate > today) {
      return res.status(400).json({ error: "Date cannot be in the future" });
    }

    // Validate animal exists
    const animal = await storage.getAnimal(validatedData.animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const weightRecord = await storage.createWeightRecord(validatedData);
    res.status(201).json(weightRecord);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating weight record:", error);
    res.status(500).json({ error: "Failed to create weight record" });
  }
});

// PUT /api/weight/records/:id - Update weight record
router.put("/records/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existingRecord = await storage.getWeightRecord(id);
    if (!existingRecord) {
      return res.status(404).json({ error: "Weight record not found" });
    }

    const validatedData = insertWeightRecordSchema.partial().parse(req.body);
    
    // Additional validation for weight if provided
    if (validatedData.weight !== undefined && Number(validatedData.weight) <= 0) {
      return res.status(400).json({ error: "Weight must be greater than 0" });
    }
    
    // Additional validation for date if provided
    if (validatedData.date) {
      const recordDate = new Date(validatedData.date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      if (recordDate > today) {
        return res.status(400).json({ error: "Date cannot be in the future" });
      }
    }

    const updatedRecord = await storage.updateWeightRecord(id, validatedData);
    res.json(updatedRecord);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating weight record:", error);
    res.status(500).json({ error: "Failed to update weight record" });
  }
});

// DELETE /api/weight/records/:id - Delete weight record
router.delete("/records/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existingRecord = await storage.getWeightRecord(id);
    if (!existingRecord) {
      return res.status(404).json({ error: "Weight record not found" });
    }

    await storage.deleteWeightRecord(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting weight record:", error);
    res.status(500).json({ error: "Failed to delete weight record" });
  }
});

// GET /api/weight/targets - Get all weight targets
router.get("/targets", async (_req: Request, res: Response) => {
  try {
    const targets = await storage.getWeightTargets();
    res.json(targets);
  } catch (error) {
    console.error("Error fetching weight targets:", error);
    res.status(500).json({ error: "Failed to fetch weight targets" });
  }
});

// GET /api/weight/targets/:groupId - Get weight targets for a specific group
router.get("/targets/:groupId", async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    
    // Validate group exists
    const group = await storage.getAnimalGroup(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const targets = await storage.getWeightTargetsByGroup(groupId);
    res.json(targets);
  } catch (error) {
    console.error("Error fetching weight targets for group:", error);
    res.status(500).json({ error: "Failed to fetch weight targets for group" });
  }
});

// POST /api/weight/targets - Create new weight target
router.post("/targets", async (req: Request, res: Response) => {
  try {
    const validatedData = insertWeightTargetSchema.parse(req.body);
    
    // Additional validation
    if (Number(validatedData.targetWeight) <= 0) {
      return res.status(400).json({ error: "Target weight must be greater than 0" });
    }
    
    if (validatedData.targetAgeMonths <= 0) {
      return res.status(400).json({ error: "Target age must be greater than 0" });
    }

    // Validate group exists
    const group = await storage.getAnimalGroup(validatedData.groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const weightTarget = await storage.createWeightTarget(validatedData);
    res.status(201).json(weightTarget);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating weight target:", error);
    res.status(500).json({ error: "Failed to create weight target" });
  }
});

// PUT /api/weight/targets/:id - Update weight target
router.put("/targets/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existingTarget = await storage.getWeightTarget(id);
    if (!existingTarget) {
      return res.status(404).json({ error: "Weight target not found" });
    }

    const validatedData = insertWeightTargetSchema.partial().parse(req.body);
    
    // Additional validation for target weight if provided
    if (validatedData.targetWeight !== undefined && Number(validatedData.targetWeight) <= 0) {
      return res.status(400).json({ error: "Target weight must be greater than 0" });
    }
    
    // Additional validation for target age if provided
    if (validatedData.targetAgeMonths !== undefined && validatedData.targetAgeMonths <= 0) {
      return res.status(400).json({ error: "Target age must be greater than 0" });
    }

    const updatedTarget = await storage.updateWeightTarget(id, validatedData);
    res.json(updatedTarget);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating weight target:", error);
    res.status(500).json({ error: "Failed to update weight target" });
  }
});

// DELETE /api/weight/targets/:id - Delete weight target
router.delete("/targets/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existingTarget = await storage.getWeightTarget(id);
    if (!existingTarget) {
      return res.status(404).json({ error: "Weight target not found" });
    }

    await storage.deleteWeightTarget(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting weight target:", error);
    res.status(500).json({ error: "Failed to delete weight target" });
  }
});

// GET /api/weight/records - Get all weight records with optional date filter
router.get("/records", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const records = await storage.getAllWeightRecords(
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json(records);
  } catch (error) {
    console.error("Error fetching all weight records:", error);
    res.status(500).json({ error: "Failed to fetch weight records" });
  }
});

// GET /api/weight/stats - Get weight statistics
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const records = await storage.getAllWeightRecords(
      startDate as string | undefined,
      endDate as string | undefined
    );
    const animals = await storage.getAnimals();
    const activeAnimals = animals.filter(a => a.status === "active");

    // Calculate statistics
    const totalRecords = records.length;
    const uniqueAnimals = new Set(records.map(r => r.animalId)).size;
    const averageWeight = records.length > 0
      ? records.reduce((sum, r) => sum + parseFloat(r.weight), 0) / records.length
      : 0;

    // Calculate ADG for animals with multiple records
    const recordsByAnimal: Record<string, any[]> = {};
    records.forEach(r => {
      if (!recordsByAnimal[r.animalId]) recordsByAnimal[r.animalId] = [];
      recordsByAnimal[r.animalId].push(r);
    });

    let totalADG = 0;
    let adgCount = 0;
    Object.values(recordsByAnimal).forEach(animalRecords => {
      if (animalRecords.length >= 2) {
        const sorted = animalRecords.sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const days = Math.ceil(
          (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (days > 0) {
          const adg = (parseFloat(last.weight) - parseFloat(first.weight)) / days;
          totalADG += adg;
          adgCount++;
        }
      }
    });

    const averageADG = adgCount > 0 ? totalADG / adgCount : 0;

    // Weight distribution
    const weightRanges = {
      under200: records.filter(r => parseFloat(r.weight) < 200).length,
      range200to400: records.filter(r => parseFloat(r.weight) >= 200 && parseFloat(r.weight) < 400).length,
      range400to600: records.filter(r => parseFloat(r.weight) >= 400 && parseFloat(r.weight) < 600).length,
      over600: records.filter(r => parseFloat(r.weight) >= 600).length,
    };

    res.json({
      totalRecords,
      uniqueAnimals,
      totalAnimals: activeAnimals.length,
      averageWeight: Math.round(averageWeight * 10) / 10,
      averageADG: Math.round(averageADG * 1000) / 1000,
      weightRanges,
      coveragePercent: activeAnimals.length > 0 
        ? Math.round((uniqueAnimals / activeAnimals.length) * 100) 
        : 0,
    });
  } catch (error) {
    console.error("Error fetching weight stats:", error);
    res.status(500).json({ error: "Failed to fetch weight statistics" });
  }
});

// POST /api/weight/batch - Batch record weights (weigh session)
router.post("/batch", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      sessionName: z.string().optional(),
      sessionDate: z.string(),
      records: z.array(z.object({
        animalId: z.string().uuid(),
        weight: z.number().positive(),
        bodyConditionScore: z.number().min(1).max(5).optional(),
        notes: z.string().optional(),
      })),
      recordedBy: z.string().uuid(),
    });

    const data = schema.parse(req.body);
    const results = [];
    const errors = [];

    for (const record of data.records) {
      try {
        const weightRecord = await storage.createWeightRecord({
          animalId: record.animalId,
          weight: record.weight.toString(),
          date: data.sessionDate,
          bodyConditionScore: record.bodyConditionScore || null,
          notes: record.notes || `Batch weigh session${data.sessionName ? `: ${data.sessionName}` : ''}`,
          recordedBy: data.recordedBy,
        });
        results.push(weightRecord);
      } catch (e) {
        errors.push({ animalId: record.animalId, error: (e as Error).message });
      }
    }

    res.status(201).json({
      success: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error batch recording weights:", error);
    res.status(500).json({ error: "Failed to batch record weights" });
  }
});

// GET /api/weight/growth/:animalId - Get growth data for an animal
router.get("/growth/:animalId", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const records = await storage.getWeightRecordsByAnimal(animalId);
    if (records.length === 0) {
      return res.json({
        animal,
        records: [],
        growth: null,
      });
    }

    // Sort by date
    const sorted = [...records].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate growth metrics
    const firstRecord = sorted[0];
    const lastRecord = sorted[sorted.length - 1];
    const totalDays = Math.ceil(
      (new Date(lastRecord.date).getTime() - new Date(firstRecord.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalGain = parseFloat(lastRecord.weight) - parseFloat(firstRecord.weight);
    const overallADG = totalDays > 0 ? totalGain / totalDays : 0;

    // Calculate ADG for each period
    const recordsWithADG = sorted.map((record, index) => {
      if (index === 0) return { ...record, adg: null, periodDays: null };
      
      const prev = sorted[index - 1];
      const days = Math.ceil(
        (new Date(record.date).getTime() - new Date(prev.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      const gain = parseFloat(record.weight) - parseFloat(prev.weight);
      const adg = days > 0 ? gain / days : null;

      return {
        ...record,
        adg: adg !== null ? Math.round(adg * 1000) / 1000 : null,
        periodDays: days,
      };
    });

    // Calculate age-based metrics if birth date available
    let birthWeight = null;
    let currentAge = null;
    if (animal.dateOfBirth) {
      currentAge = Math.ceil(
        (new Date().getTime() - new Date(animal.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    res.json({
      animal,
      records: recordsWithADG,
      growth: {
        firstWeight: parseFloat(firstRecord.weight),
        lastWeight: parseFloat(lastRecord.weight),
        totalGain: Math.round(totalGain * 10) / 10,
        totalDays,
        overallADG: Math.round(overallADG * 1000) / 1000,
        recordCount: records.length,
        currentAge,
        birthWeight,
      },
    });
  } catch (error) {
    console.error("Error fetching growth data:", error);
    res.status(500).json({ error: "Failed to fetch growth data" });
  }
});

export default router;
