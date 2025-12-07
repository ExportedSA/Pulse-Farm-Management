// Bulk Operations API Routes
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { insertAnimalSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

// POST /api/bulk/animals/status - Bulk update animal status
router.post("/animals/status", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animalIds: z.array(z.string().uuid()),
      status: z.enum(["active", "sold", "deceased"]),
      reason: z.string().optional(),
    });
    
    const { animalIds, status, reason } = schema.parse(req.body);
    
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };
    
    for (const animalId of animalIds) {
      try {
        await storage.updateAnimal(animalId, { status });
        results.success.push(animalId);
      } catch (e) {
        results.failed.push(animalId);
      }
    }
    
    res.json({
      message: `Updated ${results.success.length} animals to status: ${status}`,
      ...results,
      total: animalIds.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error bulk updating status:", error);
    res.status(500).json({ error: "Failed to bulk update status" });
  }
});

// POST /api/bulk/animals/group - Bulk assign animals to group
router.post("/animals/group", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animalIds: z.array(z.string().uuid()),
      groupId: z.string().uuid(),
      action: z.enum(["add", "remove"]).default("add"),
    });
    
    const { animalIds, groupId, action } = schema.parse(req.body);
    
    // Verify group exists
    const group = await storage.getAnimalGroup(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }
    
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };
    
    for (const animalId of animalIds) {
      try {
        if (action === "add") {
          await storage.addAnimalToGroup(groupId, animalId, undefined, "Bulk assignment");
        } else {
          await storage.removeAnimalFromGroup(groupId, animalId);
        }
        results.success.push(animalId);
      } catch (e) {
        // Might fail if already in group or not in group
        results.failed.push(animalId);
      }
    }
    
    res.json({
      message: `${action === "add" ? "Added" : "Removed"} ${results.success.length} animals ${action === "add" ? "to" : "from"} group: ${group.name}`,
      ...results,
      total: animalIds.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error bulk group assignment:", error);
    res.status(500).json({ error: "Failed to bulk assign group" });
  }
});

// POST /api/bulk/animals/pasture - Bulk move animals to pasture
router.post("/animals/pasture", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animalIds: z.array(z.string().uuid()),
      pastureId: z.string().uuid(),
      reason: z.string().optional(),
      movedBy: z.string().uuid().optional(),
    });
    
    const { animalIds, pastureId, reason, movedBy } = schema.parse(req.body);
    
    // Verify pasture exists
    const pasture = await storage.getPasture(pastureId);
    if (!pasture) {
      return res.status(404).json({ error: "Pasture not found" });
    }
    
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };
    
    for (const animalId of animalIds) {
      try {
        // Get current animal to record movement
        const animal = await storage.getAnimal(animalId);
        if (!animal) {
          results.failed.push(animalId);
          continue;
        }
        
        // Record pasture movement if there's a change
        if (animal.currentPastureId !== pastureId && movedBy) {
          await storage.createPastureMovement({
            animalId,
            fromPastureId: animal.currentPastureId || undefined,
            toPastureId: pastureId,
            movedBy: movedBy,
            reason: reason || "Bulk pasture move",
          });
        }
        
        // Update animal's current pasture
        await storage.updateAnimal(animalId, { currentPastureId: pastureId });
        results.success.push(animalId);
      } catch (e) {
        results.failed.push(animalId);
      }
    }
    
    res.json({
      message: `Moved ${results.success.length} animals to pasture: ${pasture.name}`,
      ...results,
      total: animalIds.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error bulk pasture move:", error);
    res.status(500).json({ error: "Failed to bulk move to pasture" });
  }
});

// POST /api/bulk/animals/delete - Bulk delete/archive animals
router.post("/animals/delete", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animalIds: z.array(z.string().uuid()),
      hardDelete: z.boolean().default(false), // If false, just set status to 'deceased'
    });
    
    const { animalIds, hardDelete } = schema.parse(req.body);
    
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };
    
    for (const animalId of animalIds) {
      try {
        if (hardDelete) {
          await storage.deleteAnimal(animalId);
        } else {
          // Soft delete - mark as deceased
          await storage.updateAnimal(animalId, { status: "deceased" });
        }
        results.success.push(animalId);
      } catch (e) {
        results.failed.push(animalId);
      }
    }
    
    res.json({
      message: `${hardDelete ? "Deleted" : "Archived"} ${results.success.length} animals`,
      ...results,
      total: animalIds.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error bulk delete:", error);
    res.status(500).json({ error: "Failed to bulk delete" });
  }
});

// POST /api/bulk/animals/update - Bulk update multiple fields
router.post("/animals/update", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animalIds: z.array(z.string().uuid()),
      updates: z.object({
        breed: z.string().optional(),
        sex: z.enum(["male", "female"]).optional(),
        status: z.enum(["active", "sold", "deceased"]).optional(),
        currentPastureId: z.string().uuid().nullable().optional(),
        reproductionStatus: z.string().optional(),
        lactationStatus: z.string().optional(),
      }),
    });
    
    const { animalIds, updates } = schema.parse(req.body);
    
    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    
    if (Object.keys(cleanUpdates).length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }
    
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };
    
    for (const animalId of animalIds) {
      try {
        await storage.updateAnimal(animalId, cleanUpdates);
        results.success.push(animalId);
      } catch (e) {
        results.failed.push(animalId);
      }
    }
    
    res.json({
      message: `Updated ${results.success.length} animals`,
      updatedFields: Object.keys(cleanUpdates),
      ...results,
      total: animalIds.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error bulk update:", error);
    res.status(500).json({ error: "Failed to bulk update" });
  }
});

// POST /api/bulk/animals/import - CSV import for animals
router.post("/animals/import", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animals: z.array(z.object({
        cowId: z.string().optional(),
        naitTag: z.string().optional(),
        eid: z.string().optional(),
        breed: z.string().optional(),
        sex: z.enum(["male", "female"]).optional(),
        dateOfBirth: z.string().optional(),
        status: z.enum(["active", "sold", "deceased"]).default("active"),
        sireId: z.string().uuid().optional(),
        damId: z.string().uuid().optional(),
        currentPastureId: z.string().uuid().optional(),
      })),
      updateExisting: z.boolean().default(false), // If true, update animals with matching IDs
    });
    
    const { animals, updateExisting } = schema.parse(req.body);
    
    const results: { 
      created: string[]; 
      updated: string[]; 
      failed: Array<{ index: number; error: string }>;
    } = { created: [], updated: [], failed: [] };
    
    for (let i = 0; i < animals.length; i++) {
      const animalData = animals[i];
      
      try {
        // Check if animal exists by cowId, naitTag, or eid
        let existingAnimal = null;
        if (animalData.cowId) {
          const searchResults = await storage.searchAnimals(animalData.cowId);
          existingAnimal = searchResults.find(a => a.cowId === animalData.cowId);
        }
        if (!existingAnimal && animalData.naitTag) {
          const searchResults = await storage.searchAnimals(animalData.naitTag);
          existingAnimal = searchResults.find(a => a.naitTag === animalData.naitTag);
        }
        if (!existingAnimal && animalData.eid) {
          const searchResults = await storage.searchAnimals(animalData.eid);
          existingAnimal = searchResults.find(a => a.eid === animalData.eid);
        }
        
        if (existingAnimal && updateExisting) {
          // Update existing animal
          await storage.updateAnimal(existingAnimal.id, animalData);
          results.updated.push(existingAnimal.id);
        } else if (!existingAnimal) {
          // Create new animal
          const newAnimal = await storage.createAnimal(animalData as any);
          results.created.push(newAnimal.id);
        } else {
          // Exists but updateExisting is false
          results.failed.push({ index: i, error: "Animal already exists" });
        }
      } catch (e) {
        results.failed.push({ index: i, error: (e as Error).message });
      }
    }
    
    res.status(201).json({
      message: `Import complete: ${results.created.length} created, ${results.updated.length} updated, ${results.failed.length} failed`,
      ...results,
      total: animals.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error importing animals:", error);
    res.status(500).json({ error: "Failed to import animals" });
  }
});

// POST /api/bulk/animals/export - Export animals to CSV format
router.post("/animals/export", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animalIds: z.array(z.string().uuid()).optional(), // If not provided, export all
      fields: z.array(z.string()).optional(), // Specific fields to export
      format: z.enum(["json", "csv"]).default("json"),
    });
    
    const { animalIds, fields, format } = schema.parse(req.body);
    
    let animals;
    if (animalIds && animalIds.length > 0) {
      // Get specific animals
      animals = await Promise.all(
        animalIds.map(id => storage.getAnimal(id))
      );
      animals = animals.filter(a => a !== null);
    } else {
      // Get all animals
      animals = await storage.getAnimals();
    }
    
    // Filter fields if specified
    const defaultFields = ["id", "cowId", "naitTag", "eid", "breed", "sex", "dateOfBirth", "status", "currentPastureId"];
    const exportFields = fields || defaultFields;
    
    const exportData = animals.map(animal => {
      const filtered: Record<string, any> = {};
      for (const field of exportFields) {
        filtered[field] = (animal as any)[field];
      }
      return filtered;
    });
    
    if (format === "csv") {
      // Generate CSV
      const headers = exportFields.join(",");
      const rows = exportData.map(row => 
        exportFields.map(field => {
          const value = row[field];
          if (value === null || value === undefined) return "";
          if (typeof value === "string" && value.includes(",")) return `"${value}"`;
          return String(value);
        }).join(",")
      );
      const csv = [headers, ...rows].join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=animals-export.csv");
      res.send(csv);
    } else {
      res.json({
        count: exportData.length,
        fields: exportFields,
        data: exportData,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error exporting animals:", error);
    res.status(500).json({ error: "Failed to export animals" });
  }
});

// POST /api/bulk/treatments - Bulk create treatments (already exists in batch-treatment)
// This is a simpler version for quick bulk operations
router.post("/treatments", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animalIds: z.array(z.string().uuid()),
      productId: z.string().uuid(),
      doseAmount: z.number().optional(),
      doseUnit: z.string().optional(),
      condition: z.string().optional(),
      dateTime: z.string(),
      staffMemberId: z.string().uuid(),
      staffMember: z.string(),
      clinicalNotes: z.string().optional(),
    });
    
    const data = schema.parse(req.body);
    
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };
    
    for (const animalId of data.animalIds) {
      try {
        await storage.createAnimalTreatment({
          animalId,
          productId: data.productId,
          doseAmount: data.doseAmount?.toString() || null,
          doseUnit: data.doseUnit || null,
          condition: data.condition || "Bulk treatment",
          dateTime: data.dateTime,
          staffMemberId: data.staffMemberId,
          staffMember: data.staffMember,
          clinicalNotes: data.clinicalNotes || null,
          status: "completed",
        });
        results.success.push(animalId);
      } catch (e) {
        results.failed.push(animalId);
      }
    }
    
    res.status(201).json({
      message: `Created treatments for ${results.success.length} animals`,
      ...results,
      total: data.animalIds.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error bulk creating treatments:", error);
    res.status(500).json({ error: "Failed to bulk create treatments" });
  }
});

export default router;
