// Photo Attachments API Routes
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { insertPhotoAttachmentSchema } from "@shared/schema";
import { uploadSinglePhoto, uploadMultiplePhotos } from "../middleware/upload";
import { z } from "zod";

const router = Router();

// POST /api/photos/upload - Upload a single photo
router.post("/upload", uploadSinglePhoto, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Use the file storage service to save the file
    const { saveFileBuffer } = await import('../services/fileStorage');
    const { storageKey, publicUrl } = await saveFileBuffer(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      'photos' // Store in photos subfolder
    );
    
    res.json({
      url: publicUrl,
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

    // Use the file storage service to save the files
    const { saveFileBuffer } = await import('./services/fileStorage');
    
    const uploadPromises = req.files.map(async (file: Express.Multer.File) => {
      const { storageKey, publicUrl } = await saveFileBuffer(
        file.buffer,
        file.mimetype,
        file.originalname,
        'photos' // Store in photos subfolder
      );
      
      return {
        url: publicUrl,
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

    // Try to delete the file (don't fail if file doesn't exist)
    try {
      const filePath = path.join(process.cwd(), attachment.photoUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      console.warn("Could not delete photo file:", fileError);
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting photo attachment:", error);
    res.status(500).json({ error: "Failed to delete photo attachment" });
  }
});

export default router;
