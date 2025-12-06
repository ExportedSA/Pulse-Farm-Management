// Mobile & Field Features API Routes
import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { 
  treatmentTemplates, voiceNotes, photoAttachments, batchTreatments, 
  eidScanSessions, animals, animalTreatments, products
} from "@shared/schema";
import { 
  insertTreatmentTemplateSchema, insertVoiceNoteSchema, insertPhotoAttachmentSchema,
  insertBatchTreatmentSchema, insertEidScanSessionSchema
} from "@shared/schema";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ===== TREATMENT TEMPLATES =====

// GET /api/mobile/templates - Get all treatment templates
router.get("/templates", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    
    // Get global templates and user's own templates
    const templates = await db
      .select()
      .from(treatmentTemplates)
      .where(and(
        eq(treatmentTemplates.isActive, true),
        or(
          eq(treatmentTemplates.isGlobal, true),
          userId ? eq(treatmentTemplates.createdBy, userId) : sql`false`
        )
      ))
      .orderBy(desc(treatmentTemplates.usageCount));
    
    res.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// GET /api/mobile/templates/:id - Get template by ID
router.get("/templates/:id", async (req: Request, res: Response) => {
  try {
    const [template] = await db
      .select()
      .from(treatmentTemplates)
      .where(eq(treatmentTemplates.id, req.params.id));
    
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json(template);
  } catch (error) {
    console.error("Error fetching template:", error);
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

// POST /api/mobile/templates - Create template
router.post("/templates", async (req: Request, res: Response) => {
  try {
    const validatedData = insertTreatmentTemplateSchema.parse(req.body);
    const [template] = await db.insert(treatmentTemplates).values(validatedData).returning();
    res.status(201).json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating template:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

// PUT /api/mobile/templates/:id - Update template
router.put("/templates/:id", async (req: Request, res: Response) => {
  try {
    const validatedData = insertTreatmentTemplateSchema.partial().parse(req.body);
    const [template] = await db
      .update(treatmentTemplates)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(eq(treatmentTemplates.id, req.params.id))
      .returning();
    
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating template:", error);
    res.status(500).json({ error: "Failed to update template" });
  }
});

// POST /api/mobile/templates/:id/use - Increment usage count
router.post("/templates/:id/use", async (req: Request, res: Response) => {
  try {
    const [template] = await db
      .update(treatmentTemplates)
      .set({ 
        usageCount: sql`${treatmentTemplates.usageCount} + 1`,
        lastUsedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(treatmentTemplates.id, req.params.id))
      .returning();
    
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json(template);
  } catch (error) {
    console.error("Error updating template usage:", error);
    res.status(500).json({ error: "Failed to update template usage" });
  }
});

// DELETE /api/mobile/templates/:id - Soft delete template
router.delete("/templates/:id", async (req: Request, res: Response) => {
  try {
    await db
      .update(treatmentTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(treatmentTemplates.id, req.params.id));
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// ===== BATCH TREATMENTS =====

// GET /api/mobile/batch-treatments - Get batch treatments
router.get("/batch-treatments", async (req: Request, res: Response) => {
  try {
    const batches = await db
      .select()
      .from(batchTreatments)
      .orderBy(desc(batchTreatments.createdAt))
      .limit(50);
    res.json(batches);
  } catch (error) {
    console.error("Error fetching batch treatments:", error);
    res.status(500).json({ error: "Failed to fetch batch treatments" });
  }
});

// POST /api/mobile/batch-treatments - Create batch treatment
router.post("/batch-treatments", async (req: Request, res: Response) => {
  try {
    const validatedData = insertBatchTreatmentSchema.parse(req.body);
    
    // Create the batch treatment record
    const [batch] = await db.insert(batchTreatments).values({
      ...validatedData,
      animalCount: validatedData.animalIds?.length || 0,
    }).returning();

    // Create individual treatment records for each animal
    const animalIds = validatedData.animalIds || [];
    const treatmentRecords = animalIds.map(animalId => ({
      animalId,
      treatmentDate: validatedData.treatmentDate,
      treatmentType: validatedData.treatmentType,
      category: validatedData.category,
      productId: validatedData.productId,
      dosage: validatedData.dosage,
      route: validatedData.route,
      meatWithholdingDays: validatedData.meatWithholdingDays,
      milkWithholdingDays: validatedData.milkWithholdingDays,
      notes: `Batch treatment: ${batch.batchName || batch.id}`,
      administeredBy: validatedData.createdBy,
      status: 'completed' as const,
    }));

    if (treatmentRecords.length > 0) {
      await db.insert(animalTreatments).values(treatmentRecords);
    }

    // Update template usage if used
    if (validatedData.templateId) {
      await db
        .update(treatmentTemplates)
        .set({ 
          usageCount: sql`${treatmentTemplates.usageCount} + 1`,
          lastUsedAt: new Date()
        })
        .where(eq(treatmentTemplates.id, validatedData.templateId));
    }

    res.status(201).json({
      batch,
      treatmentsCreated: treatmentRecords.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating batch treatment:", error);
    res.status(500).json({ error: "Failed to create batch treatment" });
  }
});

// ===== EID SCANNER =====

// GET /api/mobile/eid/lookup/:eid - Look up animal by EID
router.get("/eid/lookup/:eid", async (req: Request, res: Response) => {
  try {
    const eid = req.params.eid;
    
    const [animal] = await db
      .select()
      .from(animals)
      .where(eq(animals.eid, eid));
    
    if (!animal) {
      return res.json({ matched: false, eid });
    }
    
    res.json({ matched: true, eid, animal });
  } catch (error) {
    console.error("Error looking up EID:", error);
    res.status(500).json({ error: "Failed to look up EID" });
  }
});

// POST /api/mobile/eid/bulk-lookup - Look up multiple EIDs
router.post("/eid/bulk-lookup", async (req: Request, res: Response) => {
  try {
    const { eids } = req.body as { eids: string[] };
    
    if (!eids || !Array.isArray(eids)) {
      return res.status(400).json({ error: "EIDs array required" });
    }

    const matchedAnimals = await db
      .select()
      .from(animals)
      .where(sql`${animals.eid} IN (${sql.join(eids.map(e => sql`${e}`), sql`, `)})`);
    
    const animalMap = new Map(matchedAnimals.map(a => [a.eid, a]));
    
    const results = eids.map(eid => ({
      eid,
      matched: animalMap.has(eid),
      animal: animalMap.get(eid) || null,
    }));

    res.json({
      total: eids.length,
      matched: matchedAnimals.length,
      unmatched: eids.length - matchedAnimals.length,
      results,
    });
  } catch (error) {
    console.error("Error bulk looking up EIDs:", error);
    res.status(500).json({ error: "Failed to bulk look up EIDs" });
  }
});

// POST /api/mobile/eid/sessions - Create scan session
router.post("/eid/sessions", async (req: Request, res: Response) => {
  try {
    const validatedData = insertEidScanSessionSchema.parse(req.body);
    const [session] = await db.insert(eidScanSessions).values(validatedData).returning();
    res.status(201).json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating scan session:", error);
    res.status(500).json({ error: "Failed to create scan session" });
  }
});

// PUT /api/mobile/eid/sessions/:id - Update scan session
router.put("/eid/sessions/:id", async (req: Request, res: Response) => {
  try {
    const [session] = await db
      .update(eidScanSessions)
      .set(req.body)
      .where(eq(eidScanSessions.id, req.params.id))
      .returning();
    
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (error) {
    console.error("Error updating scan session:", error);
    res.status(500).json({ error: "Failed to update scan session" });
  }
});

// ===== VOICE NOTES =====

// GET /api/mobile/voice-notes/animal/:animalId - Get voice notes for animal
router.get("/voice-notes/animal/:animalId", async (req: Request, res: Response) => {
  try {
    const notes = await db
      .select()
      .from(voiceNotes)
      .where(eq(voiceNotes.animalId, req.params.animalId))
      .orderBy(desc(voiceNotes.recordedAt));
    res.json(notes);
  } catch (error) {
    console.error("Error fetching voice notes:", error);
    res.status(500).json({ error: "Failed to fetch voice notes" });
  }
});

// POST /api/mobile/voice-notes - Create voice note
router.post("/voice-notes", async (req: Request, res: Response) => {
  try {
    const validatedData = insertVoiceNoteSchema.parse(req.body);
    const [note] = await db.insert(voiceNotes).values(validatedData).returning();
    res.status(201).json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating voice note:", error);
    res.status(500).json({ error: "Failed to create voice note" });
  }
});

// DELETE /api/mobile/voice-notes/:id - Delete voice note
router.delete("/voice-notes/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(voiceNotes).where(eq(voiceNotes.id, req.params.id));
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting voice note:", error);
    res.status(500).json({ error: "Failed to delete voice note" });
  }
});

// ===== PHOTO ATTACHMENTS =====

// GET /api/mobile/photos/animal/:animalId - Get photos for animal
router.get("/photos/animal/:animalId", async (req: Request, res: Response) => {
  try {
    const photos = await db
      .select()
      .from(photoAttachments)
      .where(eq(photoAttachments.animalId, req.params.animalId))
      .orderBy(desc(photoAttachments.createdAt));
    res.json(photos);
  } catch (error) {
    console.error("Error fetching photos:", error);
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});

// GET /api/mobile/photos/treatment/:treatmentId - Get photos for treatment
router.get("/photos/treatment/:treatmentId", async (req: Request, res: Response) => {
  try {
    const photos = await db
      .select()
      .from(photoAttachments)
      .where(eq(photoAttachments.treatmentId, req.params.treatmentId))
      .orderBy(desc(photoAttachments.createdAt));
    res.json(photos);
  } catch (error) {
    console.error("Error fetching photos:", error);
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});

// POST /api/mobile/photos - Create photo attachment
router.post("/photos", async (req: Request, res: Response) => {
  try {
    const validatedData = insertPhotoAttachmentSchema.parse(req.body);
    const [photo] = await db.insert(photoAttachments).values(validatedData).returning();
    res.status(201).json(photo);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating photo:", error);
    res.status(500).json({ error: "Failed to create photo" });
  }
});

// DELETE /api/mobile/photos/:id - Delete photo
router.delete("/photos/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(photoAttachments).where(eq(photoAttachments.id, req.params.id));
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting photo:", error);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

// ===== OFFLINE SYNC =====

// POST /api/mobile/sync - Sync offline data
router.post("/sync", async (req: Request, res: Response) => {
  try {
    const { actions } = req.body as { actions: any[] };
    
    if (!actions || !Array.isArray(actions)) {
      return res.status(400).json({ error: "Actions array required" });
    }

    const results = [];
    
    for (const action of actions) {
      try {
        // Process each offline action
        const response = await fetch(`${req.protocol}://${req.get('host')}${action.url}`, {
          method: action.method,
          headers: action.headers,
          body: action.body,
        });
        
        results.push({
          id: action.id,
          success: response.ok,
          status: response.status,
        });
      } catch (err) {
        results.push({
          id: action.id,
          success: false,
          error: (err as Error).message,
        });
      }
    }

    res.json({
      processed: actions.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (error) {
    console.error("Error syncing offline data:", error);
    res.status(500).json({ error: "Failed to sync offline data" });
  }
});

export default router;
