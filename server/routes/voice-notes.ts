// Voice Notes API Routes
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { insertVoiceNoteSchema } from "@shared/schema";
import { z } from "zod";
import { uploadSingleAudio } from "../middleware/upload";

const router = Router();

// POST /api/voice-notes/upload - Upload audio file
router.post("/upload", uploadSingleAudio, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    // Use the file storage service to save the file
    const { saveFileBuffer } = await import('../services/fileStorage');
    const { storageKey, publicUrl } = await saveFileBuffer(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      'voice-notes' // Store in voice-notes subfolder
    );
    
    res.json({
      url: publicUrl,
      storageKey,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    console.error("Error uploading audio:", error);
    res.status(500).json({ error: "Failed to upload audio" });
  }
});

// GET /api/voice-notes - Get all voice notes
router.get("/", async (req: Request, res: Response) => {
  try {
    const notes = await storage.getVoiceNotes();
    res.json(notes);
  } catch (error) {
    console.error("Error fetching voice notes:", error);
    res.status(500).json({ error: "Failed to fetch voice notes" });
  }
});

// GET /api/voice-notes/animal/:animalId - Get voice notes for an animal
router.get("/animal/:animalId", async (req: Request, res: Response) => {
  try {
    const notes = await storage.getVoiceNotesByAnimal(req.params.animalId);
    res.json(notes);
  } catch (error) {
    console.error("Error fetching animal voice notes:", error);
    res.status(500).json({ error: "Failed to fetch animal voice notes" });
  }
});

// GET /api/voice-notes/treatment/:treatmentId - Get voice notes for a treatment
router.get("/treatment/:treatmentId", async (req: Request, res: Response) => {
  try {
    const notes = await storage.getVoiceNotesByTreatment(req.params.treatmentId);
    res.json(notes);
  } catch (error) {
    console.error("Error fetching treatment voice notes:", error);
    res.status(500).json({ error: "Failed to fetch treatment voice notes" });
  }
});

// GET /api/voice-notes/:id - Get voice note by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const note = await storage.getVoiceNote(req.params.id);
    if (!note) {
      return res.status(404).json({ error: "Voice note not found" });
    }
    res.json(note);
  } catch (error) {
    console.error("Error fetching voice note:", error);
    res.status(500).json({ error: "Failed to fetch voice note" });
  }
});

// POST /api/voice-notes - Create voice note record
router.post("/", async (req: Request, res: Response) => {
  try {
    const validatedData = insertVoiceNoteSchema.parse(req.body);
    const note = await storage.createVoiceNote(validatedData);
    res.status(201).json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating voice note:", error);
    res.status(500).json({ error: "Failed to create voice note" });
  }
});

// PUT /api/voice-notes/:id - Update voice note (e.g., add transcription)
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getVoiceNote(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Voice note not found" });
    }
    const validatedData = insertVoiceNoteSchema.partial().parse(req.body);
    const note = await storage.updateVoiceNote(req.params.id, validatedData);
    res.json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating voice note:", error);
    res.status(500).json({ error: "Failed to update voice note" });
  }
});

// DELETE /api/voice-notes/:id - Delete voice note
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getVoiceNote(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Voice note not found" });
    }

    // Delete from database
    await storage.deleteVoiceNote(req.params.id);

    // Try to delete the file
    try {
      const filePath = path.join(process.cwd(), existing.audioUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      console.warn("Could not delete audio file:", fileError);
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting voice note:", error);
    res.status(500).json({ error: "Failed to delete voice note" });
  }
});

export default router;
