// Reproduction Management API Routes
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { 
  insertBullSchema, insertBreedingRecordSchema, insertCalvingRecordSchema,
  insertLactationRecordSchema, insertHeatRecordSchema 
} from "@shared/schema";
import { z } from "zod";

const router = Router();

// ===== BULLS =====

// GET /api/reproduction/bulls - Get all bulls
router.get("/bulls", async (req: Request, res: Response) => {
  try {
    const bulls = await storage.getBulls();
    res.json(bulls);
  } catch (error) {
    console.error("Error fetching bulls:", error);
    res.status(500).json({ error: "Failed to fetch bulls" });
  }
});

// GET /api/reproduction/bulls/:id - Get bull by ID
router.get("/bulls/:id", async (req: Request, res: Response) => {
  try {
    const bull = await storage.getBull(req.params.id);
    if (!bull) {
      return res.status(404).json({ error: "Bull not found" });
    }
    res.json(bull);
  } catch (error) {
    console.error("Error fetching bull:", error);
    res.status(500).json({ error: "Failed to fetch bull" });
  }
});

// POST /api/reproduction/bulls - Create bull
router.post("/bulls", async (req: Request, res: Response) => {
  try {
    const validatedData = insertBullSchema.parse(req.body);
    const bull = await storage.createBull(validatedData);
    res.status(201).json(bull);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating bull:", error);
    res.status(500).json({ error: "Failed to create bull" });
  }
});

// PUT /api/reproduction/bulls/:id - Update bull
router.put("/bulls/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getBull(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Bull not found" });
    }
    const validatedData = insertBullSchema.partial().parse(req.body);
    const bull = await storage.updateBull(req.params.id, validatedData);
    res.json(bull);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating bull:", error);
    res.status(500).json({ error: "Failed to update bull" });
  }
});

// DELETE /api/reproduction/bulls/:id - Delete bull
router.delete("/bulls/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getBull(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Bull not found" });
    }
    await storage.deleteBull(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting bull:", error);
    res.status(500).json({ error: "Failed to delete bull" });
  }
});

// GET /api/reproduction/bulls/:id/conception-rate - Get conception rate for bull
router.get("/bulls/:id/conception-rate", async (req: Request, res: Response) => {
  try {
    const bull = await storage.getBull(req.params.id);
    if (!bull) {
      return res.status(404).json({ error: "Bull not found" });
    }
    const stats = await storage.getConceptionRateByBull(req.params.id);
    res.json(stats);
  } catch (error) {
    console.error("Error fetching conception rate:", error);
    res.status(500).json({ error: "Failed to fetch conception rate" });
  }
});

// ===== BREEDING RECORDS =====

// GET /api/reproduction/breeding - Get all breeding records
router.get("/breeding", async (req: Request, res: Response) => {
  try {
    const records = await storage.getBreedingRecords();
    res.json(records);
  } catch (error) {
    console.error("Error fetching breeding records:", error);
    res.status(500).json({ error: "Failed to fetch breeding records" });
  }
});

// GET /api/reproduction/breeding/animal/:animalId - Get breeding records by animal
router.get("/breeding/animal/:animalId", async (req: Request, res: Response) => {
  try {
    const records = await storage.getBreedingRecordsByAnimal(req.params.animalId);
    res.json(records);
  } catch (error) {
    console.error("Error fetching breeding records:", error);
    res.status(500).json({ error: "Failed to fetch breeding records" });
  }
});

// GET /api/reproduction/breeding/bull/:bullId - Get breeding records by bull
router.get("/breeding/bull/:bullId", async (req: Request, res: Response) => {
  try {
    const records = await storage.getBreedingRecordsByBull(req.params.bullId);
    res.json(records);
  } catch (error) {
    console.error("Error fetching breeding records:", error);
    res.status(500).json({ error: "Failed to fetch breeding records" });
  }
});

// GET /api/reproduction/breeding/expected-calvings - Get expected calvings
router.get("/breeding/expected-calvings", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 60;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    const records = await storage.getExpectedCalvings(startDate, endDate);
    res.json(records);
  } catch (error) {
    console.error("Error fetching expected calvings:", error);
    res.status(500).json({ error: "Failed to fetch expected calvings" });
  }
});

// POST /api/reproduction/breeding - Create breeding record
router.post("/breeding", async (req: Request, res: Response) => {
  try {
    const validatedData = insertBreedingRecordSchema.parse(req.body);
    
    // Validate animal exists
    const animal = await storage.getAnimal(validatedData.animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const record = await storage.createBreedingRecord(validatedData);
    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating breeding record:", error);
    res.status(500).json({ error: "Failed to create breeding record" });
  }
});

// PUT /api/reproduction/breeding/:id - Update breeding record
router.put("/breeding/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getBreedingRecord(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Breeding record not found" });
    }
    const validatedData = insertBreedingRecordSchema.partial().parse(req.body);
    const record = await storage.updateBreedingRecord(req.params.id, validatedData);
    res.json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating breeding record:", error);
    res.status(500).json({ error: "Failed to update breeding record" });
  }
});

// DELETE /api/reproduction/breeding/:id - Delete breeding record
router.delete("/breeding/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getBreedingRecord(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Breeding record not found" });
    }
    await storage.deleteBreedingRecord(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting breeding record:", error);
    res.status(500).json({ error: "Failed to delete breeding record" });
  }
});

// ===== CALVING RECORDS =====

// GET /api/reproduction/calving - Get all calving records
router.get("/calving", async (req: Request, res: Response) => {
  try {
    const records = await storage.getCalvingRecords();
    res.json(records);
  } catch (error) {
    console.error("Error fetching calving records:", error);
    res.status(500).json({ error: "Failed to fetch calving records" });
  }
});

// GET /api/reproduction/calving/dam/:damId - Get calving records by dam
router.get("/calving/dam/:damId", async (req: Request, res: Response) => {
  try {
    const records = await storage.getCalvingRecordsByDam(req.params.damId);
    res.json(records);
  } catch (error) {
    console.error("Error fetching calving records:", error);
    res.status(500).json({ error: "Failed to fetch calving records" });
  }
});

// GET /api/reproduction/calving/difficulty-stats - Get calving difficulty statistics
router.get("/calving/difficulty-stats", async (req: Request, res: Response) => {
  try {
    const stats = await storage.getCalvingDifficultyStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching calving difficulty stats:", error);
    res.status(500).json({ error: "Failed to fetch calving difficulty stats" });
  }
});

// POST /api/reproduction/calving - Create calving record
router.post("/calving", async (req: Request, res: Response) => {
  try {
    const validatedData = insertCalvingRecordSchema.parse(req.body);
    
    // Validate dam exists
    const dam = await storage.getAnimal(validatedData.damId);
    if (!dam) {
      return res.status(404).json({ error: "Dam not found" });
    }

    const record = await storage.createCalvingRecord(validatedData);
    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating calving record:", error);
    res.status(500).json({ error: "Failed to create calving record" });
  }
});

// PUT /api/reproduction/calving/:id - Update calving record
router.put("/calving/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getCalvingRecord(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Calving record not found" });
    }
    const validatedData = insertCalvingRecordSchema.partial().parse(req.body);
    const record = await storage.updateCalvingRecord(req.params.id, validatedData);
    res.json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating calving record:", error);
    res.status(500).json({ error: "Failed to update calving record" });
  }
});

// ===== LACTATION RECORDS =====

// GET /api/reproduction/lactation - Get all lactation records
router.get("/lactation", async (req: Request, res: Response) => {
  try {
    const records = await storage.getLactationRecords();
    res.json(records);
  } catch (error) {
    console.error("Error fetching lactation records:", error);
    res.status(500).json({ error: "Failed to fetch lactation records" });
  }
});

// GET /api/reproduction/lactation/animal/:animalId - Get lactation records by animal
router.get("/lactation/animal/:animalId", async (req: Request, res: Response) => {
  try {
    const records = await storage.getLactationRecordsByAnimal(req.params.animalId);
    res.json(records);
  } catch (error) {
    console.error("Error fetching lactation records:", error);
    res.status(500).json({ error: "Failed to fetch lactation records" });
  }
});

// GET /api/reproduction/lactation/animal/:animalId/current - Get current lactation
router.get("/lactation/animal/:animalId/current", async (req: Request, res: Response) => {
  try {
    const record = await storage.getCurrentLactation(req.params.animalId);
    res.json(record);
  } catch (error) {
    console.error("Error fetching current lactation:", error);
    res.status(500).json({ error: "Failed to fetch current lactation" });
  }
});

// GET /api/reproduction/lactation/dry-cows - Get dry cows
router.get("/lactation/dry-cows", async (req: Request, res: Response) => {
  try {
    const records = await storage.getDryCows();
    res.json(records);
  } catch (error) {
    console.error("Error fetching dry cows:", error);
    res.status(500).json({ error: "Failed to fetch dry cows" });
  }
});

// POST /api/reproduction/lactation - Create lactation record
router.post("/lactation", async (req: Request, res: Response) => {
  try {
    const validatedData = insertLactationRecordSchema.parse(req.body);
    
    // Validate animal exists
    const animal = await storage.getAnimal(validatedData.animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const record = await storage.createLactationRecord(validatedData);
    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating lactation record:", error);
    res.status(500).json({ error: "Failed to create lactation record" });
  }
});

// PUT /api/reproduction/lactation/:id - Update lactation record
router.put("/lactation/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getLactationRecord(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Lactation record not found" });
    }
    const validatedData = insertLactationRecordSchema.partial().parse(req.body);
    const record = await storage.updateLactationRecord(req.params.id, validatedData);
    res.json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating lactation record:", error);
    res.status(500).json({ error: "Failed to update lactation record" });
  }
});

// POST /api/reproduction/lactation/:id/dry-off - Dry off a cow
router.post("/lactation/:id/dry-off", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getLactationRecord(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Lactation record not found" });
    }
    
    const { dryOffDate, dryOffReason, dryOffProtocol } = req.body;
    
    const record = await storage.updateLactationRecord(req.params.id, {
      status: 'dry',
      dryOffDate,
      dryOffReason,
      dryOffProtocol,
    });
    res.json(record);
  } catch (error) {
    console.error("Error drying off cow:", error);
    res.status(500).json({ error: "Failed to dry off cow" });
  }
});

// ===== HEAT RECORDS =====

// GET /api/reproduction/heat - Get all heat records
router.get("/heat", async (req: Request, res: Response) => {
  try {
    const records = await storage.getHeatRecords();
    res.json(records);
  } catch (error) {
    console.error("Error fetching heat records:", error);
    res.status(500).json({ error: "Failed to fetch heat records" });
  }
});

// GET /api/reproduction/heat/animal/:animalId - Get heat records by animal
router.get("/heat/animal/:animalId", async (req: Request, res: Response) => {
  try {
    const records = await storage.getHeatRecordsByAnimal(req.params.animalId);
    res.json(records);
  } catch (error) {
    console.error("Error fetching heat records:", error);
    res.status(500).json({ error: "Failed to fetch heat records" });
  }
});

// GET /api/reproduction/heat/predicted - Get predicted heats
router.get("/heat/predicted", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    const records = await storage.getPredictedHeats(startDate, endDate);
    res.json(records);
  } catch (error) {
    console.error("Error fetching predicted heats:", error);
    res.status(500).json({ error: "Failed to fetch predicted heats" });
  }
});

// POST /api/reproduction/heat - Create heat record
router.post("/heat", async (req: Request, res: Response) => {
  try {
    const validatedData = insertHeatRecordSchema.parse(req.body);
    
    // Validate animal exists
    const animal = await storage.getAnimal(validatedData.animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const record = await storage.createHeatRecord(validatedData);
    
    // Generate predicted next heat (21 day cycle)
    const nextHeatDate = new Date(validatedData.detectionDate);
    nextHeatDate.setDate(nextHeatDate.getDate() + 21);
    const nextHeatDateStr = nextHeatDate.toISOString().split('T')[0];
    
    await storage.createHeatRecord({
      animalId: validatedData.animalId,
      detectionDate: nextHeatDateStr,
      isPredicted: true,
      predictedFromDate: validatedData.detectionDate,
      cycleLength: 21,
      detectedBy: validatedData.detectedBy,
    });

    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating heat record:", error);
    res.status(500).json({ error: "Failed to create heat record" });
  }
});

// PUT /api/reproduction/heat/:id - Update heat record
router.put("/heat/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getHeatRecord(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Heat record not found" });
    }
    const validatedData = insertHeatRecordSchema.partial().parse(req.body);
    const record = await storage.updateHeatRecord(req.params.id, validatedData);
    res.json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating heat record:", error);
    res.status(500).json({ error: "Failed to update heat record" });
  }
});

// ===== CONCEPTION RATES =====

// GET /api/reproduction/conception-rate/technician/:technicianId
router.get("/conception-rate/technician/:technicianId", async (req: Request, res: Response) => {
  try {
    const stats = await storage.getConceptionRateByTechnician(req.params.technicianId);
    res.json(stats);
  } catch (error) {
    console.error("Error fetching conception rate:", error);
    res.status(500).json({ error: "Failed to fetch conception rate" });
  }
});

export default router;
