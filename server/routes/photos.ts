// Photo Attachments API Routes
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { insertPhotoAttachmentSchema } from "@shared/schema";
import { uploadSinglePhoto, uploadMultiplePhotos } from "../middleware/upload";
import { z } from "zod";
import { getFarmId, getUserId, requireFarm } from "../middleware/auth";
import { saveUpload, deleteFileByUrl } from "../services/fileStorage";

const router = Router();
router.use(requireFarm);

// POST /api/photos/upload - Upload a single photo
router.post("/upload", uploadSinglePhoto, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { storageKey, url } = await saveUpload(getFarmId(req)!, 'photos', req.file);

    res.json({
      url,
      storageKey,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    console.error("Error uploading photo:", error);
    res.status(500).json({ error: "Failed to upload photo" });
  }
});

// POST /api/photos/upload-multiple - Upload multiple photos
router.post("/upload-multiple", uploadMultiplePhotos, async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const farmId = getFarmId(req)!;
    const uploadPromises = req.files.map(async (file: Express.Multer.File) => {
      const { storageKey, url } = await saveUpload(farmId, 'photos', file);

      return {
        url,
        storageKey,
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      };
    });
    
    const photos = await Promise.all(uploadPromises);
    
    res.json({ photos });
  } catch (error) {
    console.error("Error uploading photos:", error);
    res.status(500).json({ error: "Failed to upload photos" });
  }
});

// POST /api/photos/attachments - Create photo attachment record
router.post("/attachments", async (req: Request, res: Response) => {
  try {
    const validatedData = insertPhotoAttachmentSchema.parse(req.body);
    const attachment = await storage.createPhotoAttachment(validatedData);
    res.status(201).json(attachment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating photo attachment:", error);
    res.status(500).json({ error: "Failed to create photo attachment" });
  }
});

// POST /api/photos/attachments/with-photo - a photo and its record in one save (multipart: photo,
// animalId, treatmentId, vetVisitId, caption), so a photo taken without signal can wait in the
// offline queue as one save (client/src/lib/outbox.ts) and be done once. Uploaded by the person
// signed in (the app's old two-step upload never sent who, so it was always refused).
router.post("/attachments/with-photo", uploadSinglePhoto, async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No photo uploaded" });
    const b = req.body ?? {};
    const record = {
      animalId: b.animalId || null,
      treatmentId: b.treatmentId || null,
      vetVisitId: b.vetVisitId || null,
      caption: b.caption || null,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: getUserId(req),
    };
    // Checked before the photo is kept, so a refused save leaves no file behind
    insertPhotoAttachmentSchema.parse({ ...record, photoUrl: "pending" });
    const { url } = await saveUpload(getFarmId(req)!, 'photos', req.file);
    try {
      res.status(201).json(await storage.createPhotoAttachment(insertPhotoAttachmentSchema.parse({ ...record, photoUrl: url })));
    } catch (error) {
      await deleteFileByUrl(url).catch(() => {});
      throw error;
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    // An animal, treatment or vet visit of another farm (the farm guard)
    if (['P0403', '42501', '23503'].includes(error.code ?? error.cause?.code)) return res.status(403).json({ error: "That belongs to another farm" });
    console.error("Error saving photo:", error);
    res.status(500).json({ error: "Failed to save the photo" });
  }
});

// GET /api/photos/attachments/animal/:animalId - Get photos for an animal
router.get("/attachments/animal/:animalId", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    const attachments = await storage.getPhotoAttachmentsByAnimal(animalId);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching animal photos:", error);
    res.status(500).json({ error: "Failed to fetch animal photos" });
  }
});

// GET /api/photos/attachments/treatment/:treatmentId - Get photos for a treatment
router.get("/attachments/treatment/:treatmentId", async (req: Request, res: Response) => {
  try {
    const { treatmentId } = req.params;
    const attachments = await storage.getPhotoAttachmentsByTreatment(treatmentId);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching treatment photos:", error);
    res.status(500).json({ error: "Failed to fetch treatment photos" });
  }
});

// DELETE /api/photos/attachments/:id - Delete a photo attachment
router.delete("/attachments/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get the attachment first to get the file path
    const attachment = await storage.getPhotoAttachment(id);
    if (!attachment) {
      return res.status(404).json({ error: "Photo attachment not found" });
    }

    // Delete from database
    await storage.deletePhotoAttachment(id);

    // Remove the stored files (a missing file is not an error)
    await deleteFileByUrl(attachment.photoUrl);
    await deleteFileByUrl(attachment.thumbnailUrl);

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting photo attachment:", error);
    res.status(500).json({ error: "Failed to delete photo attachment" });
  }
});

export default router;
