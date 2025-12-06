// Veterinary Integration API Routes
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { 
  insertVeterinarianSchema, insertVetVisitSchema, insertLabResultSchema,
  insertPrescriptionSchema, insertVetCostRecordSchema
} from "@shared/schema";
import { z } from "zod";

const router = Router();

// ===== VETERINARIANS =====

// GET /api/veterinary/vets - Get all veterinarians
router.get("/vets", async (req: Request, res: Response) => {
  try {
    const vets = await storage.getVeterinarians();
    res.json(vets);
  } catch (error) {
    console.error("Error fetching veterinarians:", error);
    res.status(500).json({ error: "Failed to fetch veterinarians" });
  }
});

// GET /api/veterinary/vets/:id - Get veterinarian by ID
router.get("/vets/:id", async (req: Request, res: Response) => {
  try {
    const vet = await storage.getVeterinarian(req.params.id);
    if (!vet) {
      return res.status(404).json({ error: "Veterinarian not found" });
    }
    res.json(vet);
  } catch (error) {
    console.error("Error fetching veterinarian:", error);
    res.status(500).json({ error: "Failed to fetch veterinarian" });
  }
});

// POST /api/veterinary/vets - Create veterinarian
router.post("/vets", async (req: Request, res: Response) => {
  try {
    const validatedData = insertVeterinarianSchema.parse(req.body);
    const vet = await storage.createVeterinarian(validatedData);
    res.status(201).json(vet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating veterinarian:", error);
    res.status(500).json({ error: "Failed to create veterinarian" });
  }
});

// PUT /api/veterinary/vets/:id - Update veterinarian
router.put("/vets/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getVeterinarian(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Veterinarian not found" });
    }
    const validatedData = insertVeterinarianSchema.partial().parse(req.body);
    const vet = await storage.updateVeterinarian(req.params.id, validatedData);
    res.json(vet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating veterinarian:", error);
    res.status(500).json({ error: "Failed to update veterinarian" });
  }
});

// DELETE /api/veterinary/vets/:id - Delete veterinarian
router.delete("/vets/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getVeterinarian(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Veterinarian not found" });
    }
    await storage.deleteVeterinarian(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting veterinarian:", error);
    res.status(500).json({ error: "Failed to delete veterinarian" });
  }
});

// ===== VET VISITS =====

// GET /api/veterinary/visits - Get all vet visits
router.get("/visits", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    if (status) {
      const visits = await storage.getVetVisitsByStatus(status);
      return res.json(visits);
    }
    const visits = await storage.getVetVisits();
    res.json(visits);
  } catch (error) {
    console.error("Error fetching vet visits:", error);
    res.status(500).json({ error: "Failed to fetch vet visits" });
  }
});

// GET /api/veterinary/visits/upcoming - Get upcoming visits
router.get("/visits/upcoming", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const visits = await storage.getUpcomingVetVisits(days);
    res.json(visits);
  } catch (error) {
    console.error("Error fetching upcoming visits:", error);
    res.status(500).json({ error: "Failed to fetch upcoming visits" });
  }
});

// GET /api/veterinary/visits/:id - Get visit by ID
router.get("/visits/:id", async (req: Request, res: Response) => {
  try {
    const visit = await storage.getVetVisit(req.params.id);
    if (!visit) {
      return res.status(404).json({ error: "Visit not found" });
    }
    res.json(visit);
  } catch (error) {
    console.error("Error fetching visit:", error);
    res.status(500).json({ error: "Failed to fetch visit" });
  }
});

// POST /api/veterinary/visits - Create visit
router.post("/visits", async (req: Request, res: Response) => {
  try {
    const validatedData = insertVetVisitSchema.parse(req.body);
    const visit = await storage.createVetVisit(validatedData);
    res.status(201).json(visit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating visit:", error);
    res.status(500).json({ error: "Failed to create visit" });
  }
});

// PUT /api/veterinary/visits/:id - Update visit
router.put("/visits/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getVetVisit(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Visit not found" });
    }
    const validatedData = insertVetVisitSchema.partial().parse(req.body);
    const visit = await storage.updateVetVisit(req.params.id, validatedData);
    res.json(visit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating visit:", error);
    res.status(500).json({ error: "Failed to update visit" });
  }
});

// PUT /api/veterinary/visits/:id/complete - Complete a visit
router.put("/visits/:id/complete", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getVetVisit(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Visit not found" });
    }
    
    const { clinicalNotes, diagnosis, recommendations, totalCost, ...costs } = req.body;
    
    const visit = await storage.updateVetVisit(req.params.id, {
      status: 'completed',
      actualEndTime: new Date(),
      clinicalNotes,
      diagnosis,
      recommendations,
      totalCost,
      ...costs,
    });
    res.json(visit);
  } catch (error) {
    console.error("Error completing visit:", error);
    res.status(500).json({ error: "Failed to complete visit" });
  }
});

// DELETE /api/veterinary/visits/:id - Delete visit
router.delete("/visits/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getVetVisit(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Visit not found" });
    }
    await storage.deleteVetVisit(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting visit:", error);
    res.status(500).json({ error: "Failed to delete visit" });
  }
});

// ===== LAB RESULTS =====

// GET /api/veterinary/lab-results - Get all lab results
router.get("/lab-results", async (req: Request, res: Response) => {
  try {
    const results = await storage.getLabResults();
    res.json(results);
  } catch (error) {
    console.error("Error fetching lab results:", error);
    res.status(500).json({ error: "Failed to fetch lab results" });
  }
});

// GET /api/veterinary/lab-results/pending - Get pending lab results
router.get("/lab-results/pending", async (req: Request, res: Response) => {
  try {
    const results = await storage.getPendingLabResults();
    res.json(results);
  } catch (error) {
    console.error("Error fetching pending lab results:", error);
    res.status(500).json({ error: "Failed to fetch pending lab results" });
  }
});

// GET /api/veterinary/lab-results/animal/:animalId - Get lab results by animal
router.get("/lab-results/animal/:animalId", async (req: Request, res: Response) => {
  try {
    const results = await storage.getLabResultsByAnimal(req.params.animalId);
    res.json(results);
  } catch (error) {
    console.error("Error fetching lab results:", error);
    res.status(500).json({ error: "Failed to fetch lab results" });
  }
});

// GET /api/veterinary/lab-results/visit/:visitId - Get lab results by visit
router.get("/lab-results/visit/:visitId", async (req: Request, res: Response) => {
  try {
    const results = await storage.getLabResultsByVisit(req.params.visitId);
    res.json(results);
  } catch (error) {
    console.error("Error fetching lab results:", error);
    res.status(500).json({ error: "Failed to fetch lab results" });
  }
});

// GET /api/veterinary/lab-results/:id - Get lab result by ID
router.get("/lab-results/:id", async (req: Request, res: Response) => {
  try {
    const result = await storage.getLabResult(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Lab result not found" });
    }
    res.json(result);
  } catch (error) {
    console.error("Error fetching lab result:", error);
    res.status(500).json({ error: "Failed to fetch lab result" });
  }
});

// POST /api/veterinary/lab-results - Create lab result
router.post("/lab-results", async (req: Request, res: Response) => {
  try {
    const validatedData = insertLabResultSchema.parse(req.body);
    const result = await storage.createLabResult(validatedData);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating lab result:", error);
    res.status(500).json({ error: "Failed to create lab result" });
  }
});

// PUT /api/veterinary/lab-results/:id - Update lab result
router.put("/lab-results/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getLabResult(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Lab result not found" });
    }
    const validatedData = insertLabResultSchema.partial().parse(req.body);
    const result = await storage.updateLabResult(req.params.id, validatedData);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating lab result:", error);
    res.status(500).json({ error: "Failed to update lab result" });
  }
});

// DELETE /api/veterinary/lab-results/:id - Delete lab result
router.delete("/lab-results/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getLabResult(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Lab result not found" });
    }
    await storage.deleteLabResult(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting lab result:", error);
    res.status(500).json({ error: "Failed to delete lab result" });
  }
});

// ===== PRESCRIPTIONS =====

// GET /api/veterinary/prescriptions - Get all prescriptions
router.get("/prescriptions", async (req: Request, res: Response) => {
  try {
    const prescriptions = await storage.getPrescriptions();
    res.json(prescriptions);
  } catch (error) {
    console.error("Error fetching prescriptions:", error);
    res.status(500).json({ error: "Failed to fetch prescriptions" });
  }
});

// GET /api/veterinary/prescriptions/active - Get active prescriptions
router.get("/prescriptions/active", async (req: Request, res: Response) => {
  try {
    const prescriptions = await storage.getActivePrescriptions();
    res.json(prescriptions);
  } catch (error) {
    console.error("Error fetching active prescriptions:", error);
    res.status(500).json({ error: "Failed to fetch active prescriptions" });
  }
});

// GET /api/veterinary/prescriptions/animal/:animalId - Get prescriptions by animal
router.get("/prescriptions/animal/:animalId", async (req: Request, res: Response) => {
  try {
    const prescriptions = await storage.getPrescriptionsByAnimal(req.params.animalId);
    res.json(prescriptions);
  } catch (error) {
    console.error("Error fetching prescriptions:", error);
    res.status(500).json({ error: "Failed to fetch prescriptions" });
  }
});

// GET /api/veterinary/prescriptions/visit/:visitId - Get prescriptions by visit
router.get("/prescriptions/visit/:visitId", async (req: Request, res: Response) => {
  try {
    const prescriptions = await storage.getPrescriptionsByVisit(req.params.visitId);
    res.json(prescriptions);
  } catch (error) {
    console.error("Error fetching prescriptions:", error);
    res.status(500).json({ error: "Failed to fetch prescriptions" });
  }
});

// GET /api/veterinary/prescriptions/:id - Get prescription by ID
router.get("/prescriptions/:id", async (req: Request, res: Response) => {
  try {
    const prescription = await storage.getPrescription(req.params.id);
    if (!prescription) {
      return res.status(404).json({ error: "Prescription not found" });
    }
    res.json(prescription);
  } catch (error) {
    console.error("Error fetching prescription:", error);
    res.status(500).json({ error: "Failed to fetch prescription" });
  }
});

// POST /api/veterinary/prescriptions - Create prescription
router.post("/prescriptions", async (req: Request, res: Response) => {
  try {
    const validatedData = insertPrescriptionSchema.parse(req.body);
    const prescription = await storage.createPrescription(validatedData);
    res.status(201).json(prescription);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating prescription:", error);
    res.status(500).json({ error: "Failed to create prescription" });
  }
});

// PUT /api/veterinary/prescriptions/:id - Update prescription
router.put("/prescriptions/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getPrescription(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Prescription not found" });
    }
    const validatedData = insertPrescriptionSchema.partial().parse(req.body);
    const prescription = await storage.updatePrescription(req.params.id, validatedData);
    res.json(prescription);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating prescription:", error);
    res.status(500).json({ error: "Failed to update prescription" });
  }
});

// DELETE /api/veterinary/prescriptions/:id - Delete prescription
router.delete("/prescriptions/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getPrescription(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Prescription not found" });
    }
    await storage.deletePrescription(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting prescription:", error);
    res.status(500).json({ error: "Failed to delete prescription" });
  }
});

// ===== VET COSTS =====

// GET /api/veterinary/costs - Get cost records
router.get("/costs", async (req: Request, res: Response) => {
  try {
    const records = await storage.getVetCostRecords();
    res.json(records);
  } catch (error) {
    console.error("Error fetching cost records:", error);
    res.status(500).json({ error: "Failed to fetch cost records" });
  }
});

// GET /api/veterinary/costs/summary - Get cost summary
router.get("/costs/summary", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const summary = await storage.getVetCostSummary(startDate, endDate);
    res.json(summary);
  } catch (error) {
    console.error("Error fetching cost summary:", error);
    res.status(500).json({ error: "Failed to fetch cost summary" });
  }
});

// POST /api/veterinary/costs - Create cost record
router.post("/costs", async (req: Request, res: Response) => {
  try {
    const validatedData = insertVetCostRecordSchema.parse(req.body);
    const record = await storage.createVetCostRecord(validatedData);
    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating cost record:", error);
    res.status(500).json({ error: "Failed to create cost record" });
  }
});

export default router;
