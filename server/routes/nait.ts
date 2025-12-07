// NAIT Integration API Routes
// Handles NZ NAIT compliance for animal registration, movements, deaths, and transfers
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { format } from "date-fns";

const router = Router();

// ===== NAIT RECORDS =====

// GET /api/nait/records - Get all NAIT records
router.get("/records", async (req: Request, res: Response) => {
  try {
    const records = await storage.getNaitRecords();
    res.json(records);
  } catch (error) {
    console.error("Error fetching NAIT records:", error);
    res.status(500).json({ error: "Failed to fetch NAIT records" });
  }
});

// GET /api/nait/records/animal/:animalId - Get NAIT record for an animal
router.get("/records/animal/:animalId", async (req: Request, res: Response) => {
  try {
    const record = await storage.getNaitRecordByAnimal(req.params.animalId);
    res.json(record);
  } catch (error) {
    console.error("Error fetching animal NAIT record:", error);
    res.status(500).json({ error: "Failed to fetch animal NAIT record" });
  }
});

// GET /api/nait/records/pending - Get animals pending NAIT registration
router.get("/records/pending", async (req: Request, res: Response) => {
  try {
    const records = await storage.getPendingNaitRecords();
    res.json(records);
  } catch (error) {
    console.error("Error fetching pending NAIT records:", error);
    res.status(500).json({ error: "Failed to fetch pending NAIT records" });
  }
});

// POST /api/nait/records - Create NAIT record
router.post("/records", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animalId: z.string().uuid(),
      naitTag: z.string().min(1),
      registrationDate: z.string(),
      status: z.enum(["registered", "pending", "error"]).optional(),
    });
    const data = schema.parse(req.body);
    const record = await storage.createNaitRecord(data);
    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating NAIT record:", error);
    res.status(500).json({ error: "Failed to create NAIT record" });
  }
});

// PUT /api/nait/records/:id - Update NAIT record
router.put("/records/:id", async (req: Request, res: Response) => {
  try {
    const record = await storage.updateNaitRecord(req.params.id, req.body);
    res.json(record);
  } catch (error) {
    console.error("Error updating NAIT record:", error);
    res.status(500).json({ error: "Failed to update NAIT record" });
  }
});

// ===== NAIT QUEUE =====

// GET /api/nait/queue - Get all queue items
router.get("/queue", async (req: Request, res: Response) => {
  try {
    const items = await storage.getNaitQueue();
    res.json(items);
  } catch (error) {
    console.error("Error fetching NAIT queue:", error);
    res.status(500).json({ error: "Failed to fetch NAIT queue" });
  }
});

// GET /api/nait/queue/pending - Get pending queue items
router.get("/queue/pending", async (req: Request, res: Response) => {
  try {
    const items = await storage.getPendingNaitQueue();
    res.json(items);
  } catch (error) {
    console.error("Error fetching pending NAIT queue:", error);
    res.status(500).json({ error: "Failed to fetch pending NAIT queue" });
  }
});

// GET /api/nait/queue/failed - Get failed queue items
router.get("/queue/failed", async (req: Request, res: Response) => {
  try {
    const items = await storage.getFailedNaitQueue();
    res.json(items);
  } catch (error) {
    console.error("Error fetching failed NAIT queue:", error);
    res.status(500).json({ error: "Failed to fetch failed NAIT queue" });
  }
});

// POST /api/nait/queue - Add item to queue
router.post("/queue", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animalId: z.string().uuid().optional(),
      actionType: z.enum(["register", "movement", "death", "transfer_out", "transfer_in"]),
      payload: z.record(z.any()),
    });
    const data = schema.parse(req.body);
    const item = await storage.createNaitQueueItem(data);
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating NAIT queue item:", error);
    res.status(500).json({ error: "Failed to create NAIT queue item" });
  }
});

// POST /api/nait/queue/:id/retry - Retry a failed queue item
router.post("/queue/:id/retry", async (req: Request, res: Response) => {
  try {
    const item = await storage.retryNaitQueueItem(req.params.id);
    res.json(item);
  } catch (error) {
    console.error("Error retrying NAIT queue item:", error);
    res.status(500).json({ error: "Failed to retry NAIT queue item" });
  }
});

// DELETE /api/nait/queue/:id - Delete queue item
router.delete("/queue/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteNaitQueueItem(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting NAIT queue item:", error);
    res.status(500).json({ error: "Failed to delete NAIT queue item" });
  }
});

// ===== NAIT ACTIONS =====

// POST /api/nait/register - Register animal with NAIT
router.post("/register", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animalId: z.string().uuid(),
      naitTag: z.string().min(1),
      birthDate: z.string().optional(),
      sex: z.string().optional(),
      breed: z.string().optional(),
      locationNaitNumber: z.string().optional(),
    });
    const data = schema.parse(req.body);

    // Create queue item for NAIT registration
    const queueItem = await storage.createNaitQueueItem({
      animalId: data.animalId,
      actionType: "register",
      payload: {
        naitTag: data.naitTag,
        birthDate: data.birthDate,
        sex: data.sex,
        breed: data.breed,
        locationNaitNumber: data.locationNaitNumber,
        submittedAt: new Date().toISOString(),
      },
    });

    // Create or update NAIT record
    const existingRecord = await storage.getNaitRecordByAnimal(data.animalId);
    if (existingRecord) {
      await storage.updateNaitRecord(existingRecord.id, {
        naitTag: data.naitTag,
        status: "pending",
      });
    } else {
      await storage.createNaitRecord({
        animalId: data.animalId,
        naitTag: data.naitTag,
        registrationDate: format(new Date(), "yyyy-MM-dd"),
        status: "pending",
      });
    }

    // Simulate NAIT API call (in production, this would call the real NAIT API)
    // For demo, we'll mark it as registered after a short delay
    setTimeout(async () => {
      try {
        await storage.updateNaitQueueItem(queueItem.id, {
          status: "completed",
        });
        const record = await storage.getNaitRecordByAnimal(data.animalId);
        if (record) {
          await storage.updateNaitRecord(record.id, {
            status: "registered",
            lastSyncDate: format(new Date(), "yyyy-MM-dd"),
          });
        }
      } catch (e) {
        console.error("Error completing NAIT registration:", e);
      }
    }, 2000);

    res.status(202).json({ 
      message: "Registration queued",
      queueId: queueItem.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error registering with NAIT:", error);
    res.status(500).json({ error: "Failed to register with NAIT" });
  }
});

// POST /api/nait/movement - Record movement to NAIT
router.post("/movement", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animalIds: z.array(z.string().uuid()),
      movementDate: z.string(),
      fromLocation: z.string(),
      toLocation: z.string(),
      reason: z.string().optional(),
    });
    const data = schema.parse(req.body);

    // Create queue items for each animal
    const queueItems = [];
    for (const animalId of data.animalIds) {
      const item = await storage.createNaitQueueItem({
        animalId,
        actionType: "movement",
        payload: {
          movementDate: data.movementDate,
          fromLocation: data.fromLocation,
          toLocation: data.toLocation,
          reason: data.reason,
          submittedAt: new Date().toISOString(),
        },
      });
      queueItems.push(item);
    }

    // Simulate processing
    setTimeout(async () => {
      for (const item of queueItems) {
        try {
          await storage.updateNaitQueueItem(item.id, { status: "completed" });
        } catch (e) {
          console.error("Error completing movement:", e);
        }
      }
    }, 2000);

    res.status(202).json({
      message: `Movement recorded for ${data.animalIds.length} animals`,
      queueIds: queueItems.map(i => i.id),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error recording movement:", error);
    res.status(500).json({ error: "Failed to record movement" });
  }
});

// POST /api/nait/death - Record death to NAIT
router.post("/death", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animalId: z.string().uuid(),
      deathDate: z.string(),
      cause: z.string().optional(),
      disposalMethod: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const queueItem = await storage.createNaitQueueItem({
      animalId: data.animalId,
      actionType: "death",
      payload: {
        deathDate: data.deathDate,
        cause: data.cause,
        disposalMethod: data.disposalMethod,
        submittedAt: new Date().toISOString(),
      },
    });

    // Simulate processing
    setTimeout(async () => {
      try {
        await storage.updateNaitQueueItem(queueItem.id, { status: "completed" });
      } catch (e) {
        console.error("Error completing death notification:", e);
      }
    }, 2000);

    res.status(202).json({
      message: "Death notification queued",
      queueId: queueItem.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error recording death:", error);
    res.status(500).json({ error: "Failed to record death" });
  }
});

// POST /api/nait/transfer - Record transfer (sale/purchase) to NAIT
router.post("/transfer", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animalIds: z.array(z.string().uuid()),
      transferDate: z.string(),
      transferType: z.enum(["sale", "purchase"]),
      otherPartyNait: z.string(),
      otherPartyName: z.string().optional(),
      price: z.number().optional(),
    });
    const data = schema.parse(req.body);

    const actionType = data.transferType === "sale" ? "transfer_out" : "transfer_in";
    const queueItems = [];

    for (const animalId of data.animalIds) {
      const item = await storage.createNaitQueueItem({
        animalId,
        actionType,
        payload: {
          transferDate: data.transferDate,
          transferType: data.transferType,
          otherPartyNait: data.otherPartyNait,
          otherPartyName: data.otherPartyName,
          price: data.price,
          submittedAt: new Date().toISOString(),
        },
      });
      queueItems.push(item);
    }

    // Simulate processing
    setTimeout(async () => {
      for (const item of queueItems) {
        try {
          await storage.updateNaitQueueItem(item.id, { status: "completed" });
        } catch (e) {
          console.error("Error completing transfer:", e);
        }
      }
    }, 2000);

    res.status(202).json({
      message: `Transfer recorded for ${data.animalIds.length} animals`,
      queueIds: queueItems.map(i => i.id),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error recording transfer:", error);
    res.status(500).json({ error: "Failed to record transfer" });
  }
});

// ===== NAIT SYNC & STATUS =====

// GET /api/nait/status - Get overall NAIT sync status
router.get("/status", async (req: Request, res: Response) => {
  try {
    const records = await storage.getNaitRecords();
    const queue = await storage.getNaitQueue();
    
    const registered = records.filter(r => r.status === "registered").length;
    const pending = records.filter(r => r.status === "pending").length;
    const errors = records.filter(r => r.status === "error").length;
    
    const queuePending = queue.filter(q => q.status === "pending").length;
    const queueFailed = queue.filter(q => q.status === "failed").length;
    const queueCompleted = queue.filter(q => q.status === "completed").length;

    res.json({
      records: {
        total: records.length,
        registered,
        pending,
        errors,
      },
      queue: {
        total: queue.length,
        pending: queuePending,
        failed: queueFailed,
        completed: queueCompleted,
      },
      lastSync: records.length > 0 
        ? records.reduce((latest, r) => 
            r.lastSyncDate && r.lastSyncDate > (latest || "") ? r.lastSyncDate : latest, 
            null as string | null
          )
        : null,
    });
  } catch (error) {
    console.error("Error fetching NAIT status:", error);
    res.status(500).json({ error: "Failed to fetch NAIT status" });
  }
});

// POST /api/nait/sync - Trigger sync with NAIT
router.post("/sync", async (req: Request, res: Response) => {
  try {
    // Process pending queue items
    const pendingItems = await storage.getPendingNaitQueue();
    
    for (const item of pendingItems) {
      // Simulate API call
      await storage.updateNaitQueueItem(item.id, {
        status: "completed",
        lastAttempt: new Date(),
      });
      
      // Update NAIT record if registration
      if (item.actionType === "register" && item.animalId) {
        const record = await storage.getNaitRecordByAnimal(item.animalId);
        if (record) {
          await storage.updateNaitRecord(record.id, {
            status: "registered",
            lastSyncDate: format(new Date(), "yyyy-MM-dd"),
          });
        }
      }
    }

    res.json({
      message: `Processed ${pendingItems.length} pending items`,
      processed: pendingItems.length,
    });
  } catch (error) {
    console.error("Error syncing with NAIT:", error);
    res.status(500).json({ error: "Failed to sync with NAIT" });
  }
});

// GET /api/nait/unregistered - Get animals not registered with NAIT
router.get("/unregistered", async (req: Request, res: Response) => {
  try {
    const animals = await storage.getAnimals();
    const records = await storage.getNaitRecords();
    const registeredIds = new Set(records.map(r => r.animalId));
    
    const unregistered = animals.filter(a => 
      a.status === "active" && !registeredIds.has(a.id)
    );

    res.json(unregistered);
  } catch (error) {
    console.error("Error fetching unregistered animals:", error);
    res.status(500).json({ error: "Failed to fetch unregistered animals" });
  }
});

// POST /api/nait/bulk-register - Bulk register animals
router.post("/bulk-register", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      animalIds: z.array(z.string().uuid()),
      locationNaitNumber: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const animals = await storage.getAnimals();
    const results = [];

    for (const animalId of data.animalIds) {
      const animal = animals.find(a => a.id === animalId);
      if (!animal || !animal.naitTag) continue;

      const queueItem = await storage.createNaitQueueItem({
        animalId,
        actionType: "register",
        payload: {
          naitTag: animal.naitTag,
          birthDate: animal.dateOfBirth,
          sex: animal.sex,
          breed: animal.breed,
          locationNaitNumber: data.locationNaitNumber,
          submittedAt: new Date().toISOString(),
        },
      });

      // Create NAIT record
      const existingRecord = await storage.getNaitRecordByAnimal(animalId);
      if (!existingRecord) {
        await storage.createNaitRecord({
          animalId,
          naitTag: animal.naitTag,
          registrationDate: format(new Date(), "yyyy-MM-dd"),
          status: "pending",
        });
      }

      results.push({ animalId, queueId: queueItem.id });
    }

    // Simulate bulk processing
    setTimeout(async () => {
      for (const result of results) {
        try {
          const record = await storage.getNaitRecordByAnimal(result.animalId);
          if (record) {
            await storage.updateNaitRecord(record.id, {
              status: "registered",
              lastSyncDate: format(new Date(), "yyyy-MM-dd"),
            });
          }
        } catch (e) {
          console.error("Error completing bulk registration:", e);
        }
      }
    }, 3000);

    res.status(202).json({
      message: `Bulk registration queued for ${results.length} animals`,
      results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error bulk registering:", error);
    res.status(500).json({ error: "Failed to bulk register" });
  }
});

export default router;
