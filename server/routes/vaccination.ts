// Vaccination & Preventive Health API Routes
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { insertVaccinationScheduleSchema, insertAnimalTreatmentSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

// GET /api/vaccination/schedules - Get all vaccination schedules
router.get("/schedules", async (_req: Request, res: Response) => {
  try {
    const schedules = await storage.getVaccinationSchedules();
    res.json(schedules);
  } catch (error) {
    console.error("Error fetching vaccination schedules:", error);
    res.status(500).json({ error: "Failed to fetch vaccination schedules" });
  }
});

// GET /api/vaccination/schedules/:groupId - Get vaccination schedules for a specific group
router.get("/schedules/group/:groupId", async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    
    // Validate group exists
    const group = await storage.getAnimalGroup(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const schedules = await storage.getVaccinationSchedulesByGroup(groupId);
    res.json(schedules);
  } catch (error) {
    console.error("Error fetching vaccination schedules for group:", error);
    res.status(500).json({ error: "Failed to fetch vaccination schedules for group" });
  }
});

// GET /api/vaccination/schedules/:id - Get specific vaccination schedule
router.get("/schedules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const schedule = await storage.getVaccinationSchedule(id);
    if (!schedule) {
      return res.status(404).json({ error: "Vaccination schedule not found" });
    }

    res.json(schedule);
  } catch (error) {
    console.error("Error fetching vaccination schedule:", error);
    res.status(500).json({ error: "Failed to fetch vaccination schedule" });
  }
});

// POST /api/vaccination/schedules - Create new vaccination schedule
router.post("/schedules", async (req: Request, res: Response) => {
  try {
    const validatedData = insertVaccinationScheduleSchema.parse(req.body);
    
    // Additional validation
    if (validatedData.frequencyMonths !== null && validatedData.frequencyMonths !== undefined && validatedData.frequencyMonths <= 0) {
      return res.status(400).json({ error: "Frequency must be greater than 0" });
    }
    
    if (validatedData.targetAgeMonths !== null && validatedData.targetAgeMonths !== undefined && validatedData.targetAgeMonths <= 0) {
      return res.status(400).json({ error: "Target age must be greater than 0" });
    }

    // Validate group exists
    const group = await storage.getAnimalGroup(validatedData.groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Validate vaccine product exists
    const product = await storage.getProduct(validatedData.vaccineProductId);
    if (!product) {
      return res.status(404).json({ error: "Vaccine product not found" });
    }

    // Set nextDueDate if not provided
    if (!validatedData.nextDueDate) {
      validatedData.nextDueDate = validatedData.scheduledDate;
    }

    const schedule = await storage.createVaccinationSchedule(validatedData);
    
    // Create alert for upcoming vaccination
    try {
      await storage.createAlert({
        type: 'vaccination_due',
        title: `Vaccination Due: ${schedule.programName}`,
        message: `${schedule.programName} scheduled for ${schedule.nextDueDate}`,
        severity: 'medium',
        metadata: { groupId: validatedData.groupId, scheduleId: schedule.id },
      });
    } catch (alertError) {
      console.error("Failed to create vaccination alert:", alertError);
      // Continue - alert creation failure shouldn't block schedule creation
    }
    
    res.status(201).json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating vaccination schedule:", error);
    res.status(500).json({ error: "Failed to create vaccination schedule" });
  }
});

// PUT /api/vaccination/schedules/:id - Update vaccination schedule
router.put("/schedules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existingSchedule = await storage.getVaccinationSchedule(id);
    if (!existingSchedule) {
      return res.status(404).json({ error: "Vaccination schedule not found" });
    }

    const validatedData = insertVaccinationScheduleSchema.partial().parse(req.body);
    
    // Additional validation for frequency if provided
    if (validatedData.frequencyMonths !== undefined && validatedData.frequencyMonths !== null && validatedData.frequencyMonths <= 0) {
      return res.status(400).json({ error: "Frequency must be greater than 0" });
    }
    
    // Additional validation for target age if provided
    if (validatedData.targetAgeMonths !== undefined && validatedData.targetAgeMonths !== null && validatedData.targetAgeMonths <= 0) {
      return res.status(400).json({ error: "Target age must be greater than 0" });
    }

    const updatedSchedule = await storage.updateVaccinationSchedule(id, validatedData);
    res.json(updatedSchedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating vaccination schedule:", error);
    res.status(500).json({ error: "Failed to update vaccination schedule" });
  }
});

// DELETE /api/vaccination/schedules/:id - Delete vaccination schedule
router.delete("/schedules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existingSchedule = await storage.getVaccinationSchedule(id);
    if (!existingSchedule) {
      return res.status(404).json({ error: "Vaccination schedule not found" });
    }

    await storage.deleteVaccinationSchedule(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting vaccination schedule:", error);
    res.status(500).json({ error: "Failed to delete vaccination schedule" });
  }
});

// GET /api/vaccination/records/animal/:animalId - Get vaccination records for an animal
router.get("/records/animal/:animalId", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    // Validate animal exists
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const records = await storage.getVaccinationRecordsByAnimal(animalId);
    res.json(records);
  } catch (error) {
    console.error("Error fetching vaccination records for animal:", error);
    res.status(500).json({ error: "Failed to fetch vaccination records for animal" });
  }
});

// GET /api/vaccination/records/group/:groupId - Get vaccination records for a group
router.get("/records/group/:groupId", async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    
    // Validate group exists
    const group = await storage.getAnimalGroup(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const records = await storage.getVaccinationRecordsByGroup(groupId);
    res.json(records);
  } catch (error) {
    console.error("Error fetching vaccination records for group:", error);
    res.status(500).json({ error: "Failed to fetch vaccination records for group" });
  }
});

// GET /api/vaccination/upcoming - Get upcoming vaccinations (default: next 30 days)
router.get("/upcoming", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    
    if (days <= 0 || days > 365) {
      return res.status(400).json({ error: "Days must be between 1 and 365" });
    }

    const schedules = await storage.getUpcomingVaccinations(days);
    res.json(schedules);
  } catch (error) {
    console.error("Error fetching upcoming vaccinations:", error);
    res.status(500).json({ error: "Failed to fetch upcoming vaccinations" });
  }
});

// POST /api/vaccination/record - Create vaccination record (extends AnimalTreatment)
router.post("/record", async (req: Request, res: Response) => {
  try {
    const treatmentData = insertAnimalTreatmentSchema.parse(req.body);
    
    // Ensure it's a vaccination or drench
    if (!['vaccination', 'drench'].includes(treatmentData.category as string)) {
      return res.status(400).json({ error: "Category must be 'vaccination' or 'drench'" });
    }

    // Validate animal exists
    if (!treatmentData.animalId) {
      return res.status(400).json({ error: "Animal ID is required" });
    }
    const animal = await storage.getAnimal(treatmentData.animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    // Validate product exists if provided
    if (treatmentData.productId) {
      const product = await storage.getProduct(treatmentData.productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
    }

    const record = await storage.createAnimalTreatment(treatmentData);
    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating vaccination record:", error);
    res.status(500).json({ error: "Failed to create vaccination record" });
  }
});

export default router;
