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

export default router;
