import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import {
  createEquipment,
  listEquipment,
  getEquipment,
  updateEquipment,
  deleteEquipment,
  getEquipmentDueForService,
  getEquipmentOverdueForService,
  searchEquipment,
  logServiceHistory,
  getEquipmentServiceHistory,
} from "../domain/equipment";
import { getOrCreateEquipmentChannel } from "../domain/chat";
import logger from "../config/logger";

const router = Router();

// Validation schemas
const createEquipmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  yearManufactured: z.number().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(["operational", "maintenance_due", "in_maintenance", "out_of_service"]).optional(),
  lastServiceDate: z.string().optional(),
  nextServiceDue: z.string().optional(),
  serviceIntervalDays: z.number().optional(),
  warrantyExpiry: z.string().optional(),
  notes: z.string().optional(),
});

const updateEquipmentSchema = createEquipmentSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const logServiceSchema = z.object({
  serviceDate: z.string().min(1, "Service date is required"),
  serviceType: z.string().min(1, "Service type is required"),
  description: z.string().optional(),
  cost: z.string().optional(),
  performedBy: z.string().optional(),
  nextServiceDue: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/farm-equipment - List equipment for the farm
router.get("/", requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const { status, type, includeInactive, limit, offset } = req.query;

    const equipmentList = await listEquipment(farmId, {
      status: status as any,
      type: type as string,
      includeInactive: includeInactive === 'true',
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(equipmentList);
  } catch (error) {
    logger.error({ error }, "Failed to list equipment");
    res.status(500).json({ error: "Failed to list equipment" });
  }
});

// GET /api/farm-equipment/search - Search equipment
router.get("/search", requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const { q, limit } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Search query is required" });
    }

    const equipmentList = await searchEquipment(
      farmId,
      q,
      limit ? parseInt(limit) : 50
    );

    res.json(equipmentList);
  } catch (error) {
    logger.error({ error }, "Failed to search equipment");
    res.status(500).json({ error: "Failed to search equipment" });
  }
});

// GET /api/farm-equipment/due-service - Get equipment due for service
router.get("/due-service", requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const { days } = req.query;

    const equipmentList = await getEquipmentDueForService(
      farmId,
      days ? parseInt(days as string) : 30
    );

    res.json(equipmentList);
  } catch (error) {
    logger.error({ error }, "Failed to get equipment due for service");
    res.status(500).json({ error: "Failed to get equipment due for service" });
  }
});

// GET /api/farm-equipment/overdue - Get equipment overdue for service
router.get("/overdue", requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;

    const equipmentList = await getEquipmentOverdueForService(farmId);
    res.json(equipmentList);
  } catch (error) {
    logger.error({ error }, "Failed to get overdue equipment");
    res.status(500).json({ error: "Failed to get overdue equipment" });
  }
});

// GET /api/farm-equipment/:id - Get single equipment
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const equipmentRecord = await getEquipment(id);

    if (!equipmentRecord) {
      return res.status(404).json({ error: "Equipment not found" });
    }

    // Verify the equipment belongs to the user's farm
    const farmId = (req.user as any).farmId;
    if (equipmentRecord.farmId !== farmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(equipmentRecord);
  } catch (error) {
    logger.error({ error }, "Failed to get equipment");
    res.status(500).json({ error: "Failed to get equipment" });
  }
});

// GET /api/farm-equipment/:id/service-history - Get equipment service history
router.get("/:id/service-history", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify equipment exists and belongs to farm
    const equipmentRecord = await getEquipment(id);
    if (!equipmentRecord) {
      return res.status(404).json({ error: "Equipment not found" });
    }
    
    const farmId = (req.user as any).farmId;
    if (equipmentRecord.farmId !== farmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const serviceHistory = await getEquipmentServiceHistory(id);
    res.json(serviceHistory);
  } catch (error) {
    logger.error({ error }, "Failed to get equipment service history");
    res.status(500).json({ error: "Failed to get service history" });
  }
});

// POST /api/farm-equipment - Create new equipment
router.post("/", requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const data = createEquipmentSchema.parse(req.body);

    const equipmentRecord = await createEquipment({
      ...data,
      farmId,
    });

    // Create a chat channel for this equipment
    try {
      const channelName = `Equipment: ${data.name}`;
      await getOrCreateEquipmentChannel(equipmentRecord.id, channelName, farmId);
      logger.info({ equipmentId: equipmentRecord.id, channelName }, "Created chat channel for equipment");
    } catch (chatError) {
      logger.error({ error: chatError, equipmentId: equipmentRecord.id }, "Failed to create chat channel for equipment");
      // Don't fail the equipment creation if chat channel creation fails
    }

    res.status(201).json(equipmentRecord);
  } catch (error) {
    logger.error({ error }, "Failed to create equipment");
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid equipment data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create equipment" });
  }
});

// POST /api/farm-equipment/:id/log-service - Log service history
router.post("/:id/log-service", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const data = logServiceSchema.parse(req.body);

    // Verify equipment exists and belongs to farm
    const equipmentRecord = await getEquipment(id);
    if (!equipmentRecord) {
      return res.status(404).json({ error: "Equipment not found" });
    }
    if (equipmentRecord.farmId !== farmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const serviceRecord = await logServiceHistory({
      ...data,
      equipmentId: id,
    });

    res.status(201).json(serviceRecord);
  } catch (error) {
    logger.error({ error }, "Failed to log service");
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid service data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to log service" });
  }
});

// PATCH /api/farm-equipment/:id - Update equipment
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const data = updateEquipmentSchema.parse(req.body);

    // Check if equipment exists and belongs to the farm
    const existing = await getEquipment(id);
    if (!existing) {
      return res.status(404).json({ error: "Equipment not found" });
    }
    if (existing.farmId !== farmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const equipmentRecord = await updateEquipment(id, data);
    if (!equipmentRecord) {
      return res.status(404).json({ error: "Equipment not found" });
    }

    res.json(equipmentRecord);
  } catch (error) {
    logger.error({ error }, "Failed to update equipment");
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid equipment data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update equipment" });
  }
});

// DELETE /api/farm-equipment/:id - Delete equipment (soft delete)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;

    // Check if equipment exists and belongs to the farm
    const existing = await getEquipment(id);
    if (!existing) {
      return res.status(404).json({ error: "Equipment not found" });
    }
    if (existing.farmId !== farmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const success = await deleteEquipment(id);
    if (!success) {
      return res.status(404).json({ error: "Equipment not found" });
    }

    res.status(204).send();
  } catch (error) {
    logger.error({ error }, "Failed to delete equipment");
    res.status(500).json({ error: "Failed to delete equipment" });
  }
});

export default router;
