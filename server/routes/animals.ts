import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import {
  createAnimal,
  listAnimals,
  getAnimal,
  updateAnimal,
  deleteAnimal,
  removeAnimal,
  getAnimalByTag,
  searchAnimals,
  // Health record functions
  listHealthRecords,
  createHealthRecord,
  updateHealthRecord,
  deleteHealthRecord,
  getPendingFollowUps,
  getAnimalForFarm,
  // Error classes
  AnimalNotFoundError,
  PermissionDeniedError,
} from "../domain/animals";
import { getOrCreateAnimalChannel } from "../domain/chat";
import { chatWebSocket } from "../websocket";
import { db } from "../db";
import { users, notificationLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import logger from "../config/logger";

const router = Router();

// Roles that can modify animal records (create, update, delete)
const ANIMAL_MODIFY_ROLES = ['owner', 'manager', 'admin', 'vet'];

/**
 * Check if the user has permission to modify animal records.
 * Returns true if user has an appropriate role.
 */
function canModifyAnimals(userRole: string | undefined): boolean {
  if (!userRole) return false;
  return ANIMAL_MODIFY_ROLES.includes(userRole.toLowerCase());
}

// Validation schemas
const createAnimalSchema = z.object({
  visualId: z.string().optional(),
  lifetimeId: z.string().optional(),
  naitTag: z.string().optional(),
  eid: z.string().optional(),
  name: z.string().optional(),
  breed: z.string().optional(),
  dateOfBirth: z.string().optional(),
  yearBorn: z.number().optional(),
  sex: z.enum(["female", "male"]).optional(),
  herd: z.string().optional(),
  status: z.enum(["active", "sold", "deceased"]).optional(),
  milkStatus: z.string().optional(),
  a2Status: z.string().optional(),
  notes: z.string().optional(),
});

const updateAnimalSchema = createAnimalSchema.partial();

// Health record validation schemas
const createHealthRecordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  type: z.enum(["illness", "treatment", "vaccination", "injury", "observation", "checkup", "other"]),
  description: z.string().min(1, "Description is required"),
  notes: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  treatmentId: z.string().uuid().optional(),
  vetVisitId: z.string().uuid().optional(),
  requiresFollowUp: z.boolean().optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const updateHealthRecordSchema = createHealthRecordSchema.partial().extend({
  followUpCompleted: z.boolean().optional(),
});

// GET /api/animals - List animals for the farm
router.get("/", requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const { status, herd, sex, limit, offset } = req.query;

    const animals = await listAnimals(farmId, {
      status: status as any,
      herd: herd as string,
      sex: sex as any,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(animals);
  } catch (error) {
    logger.error({ error }, "Failed to list animals");
    res.status(500).json({ error: "Failed to list animals" });
  }
});

// GET /api/animals/search - Search animals
router.get("/search", requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const { q, limit } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Search query is required" });
    }

    const animals = await searchAnimals(
      farmId,
      q,
      limit ? parseInt(limit) : 50
    );

    res.json(animals);
  } catch (error) {
    logger.error({ error }, "Failed to search animals");
    res.status(500).json({ error: "Failed to search animals" });
  }
});

// GET /api/animals/tag/:tag - Get animal by tag
router.get("/tag/:tag", requireAuth, async (req, res) => {
  try {
    const { tag } = req.params;
    const animal = await getAnimalByTag(tag);

    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    // Verify the animal belongs to the user's farm
    const farmId = (req.user as any).farmId;
    if (animal.farmId !== farmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(animal);
  } catch (error) {
    logger.error({ error }, "Failed to get animal by tag");
    res.status(500).json({ error: "Failed to get animal" });
  }
});

// GET /api/animals/:id - Get single animal
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const animal = await getAnimal(id);

    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    // Verify the animal belongs to the user's farm
    const farmId = (req.user as any).farmId;
    if (animal.farmId !== farmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(animal);
  } catch (error) {
    logger.error({ error }, "Failed to get animal");
    res.status(500).json({ error: "Failed to get animal" });
  }
});

// POST /api/animals - Create new animal
router.post("/", requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Permission check: only managers, owners, admins, or vets can create animals
    if (!canModifyAnimals(userRole)) {
      logger.warn({ userId, userRole }, "Unauthorized attempt to create animal");
      return res.status(403).json({ error: "You do not have permission to create animals" });
    }

    const data = createAnimalSchema.parse(req.body);

    // Check for duplicate visual ID if provided
    if (data.visualId) {
      const existing = await getAnimalByTag(data.visualId);
      if (existing && existing.farmId === farmId) {
        return res.status(400).json({ error: "An animal with this tag already exists" });
      }
    }

    const animal = await createAnimal({
      ...data,
      farmId,
    });

    // Create a chat channel for this animal
    try {
      const channelName = data.name ? `Animal: ${data.name}` : `Animal: ${data.visualId || animal.id}`;
      await getOrCreateAnimalChannel(animal.id, channelName, farmId);
      logger.info({ animalId: animal.id, channelName }, "Created chat channel for animal");
    } catch (chatError) {
      logger.error({ error: chatError, animalId: animal.id }, "Failed to create chat channel for animal");
      // Don't fail the animal creation if chat channel creation fails
    }

    // Broadcast WebSocket event to all farm users
    try {
      const farmUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isActive, true));
      
      const userIds = farmUsers.map(u => u.id).filter(id => id !== userId);
      chatWebSocket.broadcastAnimalAdded(userIds, {
        ...animal,
        createdByName: (req.user as any).name || 'Unknown',
      });
    } catch (wsError) {
      logger.error({ error: wsError }, "Failed to broadcast animal added event");
    }

    logger.info({ animalId: animal.id, userId, farmId }, "Animal created successfully");
    res.status(201).json(animal);
  } catch (error) {
    logger.error({ error }, "Failed to create animal");
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid animal data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create animal" });
  }
});

// PATCH /api/animals/:id - Update animal
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Permission check: only managers, owners, admins, or vets can update animals
    if (!canModifyAnimals(userRole)) {
      logger.warn({ userId, userRole, animalId: id }, "Unauthorized attempt to update animal");
      return res.status(403).json({ error: "You do not have permission to update animals" });
    }

    const data = updateAnimalSchema.parse(req.body);

    // Check if animal exists and belongs to the farm
    const existing = await getAnimal(id, farmId);
    if (!existing) {
      return res.status(404).json({ error: "Animal not found" });
    }

    // Check for duplicate visual ID if being updated
    if (data.visualId && data.visualId !== existing.visualId) {
      const duplicate = await getAnimalByTag(data.visualId);
      if (duplicate && duplicate.farmId === farmId && duplicate.id !== id) {
        return res.status(400).json({ error: "An animal with this tag already exists" });
      }
    }

    const animal = await updateAnimal(id, data, farmId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    // Broadcast WebSocket event to all farm users
    try {
      const farmUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isActive, true));
      
      const userIds = farmUsers.map(u => u.id).filter(uid => uid !== userId);
      chatWebSocket.broadcastAnimalUpdated(userIds, {
        ...animal,
        updatedByName: (req.user as any).name || 'Unknown',
      });
    } catch (wsError) {
      logger.error({ error: wsError }, "Failed to broadcast animal updated event");
    }

    logger.info({ animalId: id, userId, farmId }, "Animal updated successfully");
    res.json(animal);
  } catch (error) {
    logger.error({ error }, "Failed to update animal");
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid animal data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update animal" });
  }
});

// DELETE /api/animals/:id - Remove animal (soft-delete by changing status)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Permission check: only managers, owners, admins can remove animals
    if (!canModifyAnimals(userRole)) {
      logger.warn({ userId, userRole, animalId: id }, "Unauthorized attempt to remove animal");
      return res.status(403).json({ error: "You do not have permission to remove animals" });
    }

    // Check if animal exists and belongs to the farm
    const existing = await getAnimal(id, farmId);
    if (!existing) {
      return res.status(404).json({ error: "Animal not found" });
    }

    // Get removal details from query params or body
    const removalStatus = (req.query.status as 'sold' | 'deceased') || 'deceased';
    const removalReason = req.body?.reason as string | undefined;

    // Soft-delete: change status to sold/deceased
    const animal = await removeAnimal(id, farmId, removalStatus, removalReason);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    // Broadcast WebSocket event to all farm users
    try {
      const farmUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isActive, true));
      
      const userIds = farmUsers.map(u => u.id).filter(uid => uid !== userId);
      chatWebSocket.broadcastAnimalRemoved(userIds, id, removalStatus);
    } catch (wsError) {
      logger.error({ error: wsError }, "Failed to broadcast animal removed event");
    }

    logger.info({ animalId: id, userId, farmId, status: removalStatus }, "Animal removed successfully");
    res.json({ message: "Animal removed successfully", animal });
  } catch (error) {
    logger.error({ error }, "Failed to remove animal");
    res.status(500).json({ error: "Failed to remove animal" });
  }
});

// DELETE /api/animals/:id/permanent - Permanently delete animal (hard delete)
router.delete("/:id/permanent", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;

    // Permission check: only owners and admins can permanently delete
    if (!userRole || !['owner', 'admin'].includes(userRole.toLowerCase())) {
      logger.warn({ userId, userRole, animalId: id }, "Unauthorized attempt to permanently delete animal");
      return res.status(403).json({ error: "Only owners and admins can permanently delete animals" });
    }

    // Check if animal exists and belongs to the farm
    const existing = await getAnimal(id, farmId);
    if (!existing) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const success = await deleteAnimal(id);
    if (!success) {
      return res.status(404).json({ error: "Animal not found" });
    }

    // Broadcast WebSocket event to all farm users
    try {
      const farmUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isActive, true));
      
      const userIds = farmUsers.map(u => u.id).filter(uid => uid !== userId);
      chatWebSocket.broadcastAnimalRemoved(userIds, id, 'deleted');
    } catch (wsError) {
      logger.error({ error: wsError }, "Failed to broadcast animal deleted event");
    }

    logger.info({ animalId: id, userId, farmId }, "Animal permanently deleted");
    res.status(204).send();
  } catch (error) {
    logger.error({ error }, "Failed to permanently delete animal");
    res.status(500).json({ error: "Failed to delete animal" });
  }
});

// ============================================
// ANIMAL HEALTH RECORDS
// ============================================

/**
 * GET /api/animals/:animalId/health
 * List all health records for a specific animal
 * Query params: type, severity, requiresFollowUp, limit, offset
 */
router.get("/:animalId/health", requireAuth, async (req, res) => {
  try {
    const { animalId } = req.params;
    const farmId = (req.user as any).farmId;
    const { type, severity, requiresFollowUp, limit, offset } = req.query;

    const records = await listHealthRecords(farmId, animalId, {
      type: type as any,
      severity: severity as any,
      requiresFollowUp: requiresFollowUp === "true" ? true : requiresFollowUp === "false" ? false : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(records);
  } catch (error) {
    if (error instanceof AnimalNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof PermissionDeniedError) {
      return res.status(403).json({ error: error.message });
    }
    logger.error({ error }, "Failed to list health records");
    res.status(500).json({ error: "Failed to list health records" });
  }
});

/**
 * POST /api/animals/:animalId/health
 * Create a new health record for an animal
 */
router.post("/:animalId/health", requireAuth, async (req, res) => {
  try {
    const { animalId } = req.params;
    const farmId = (req.user as any).farmId;
    const userId = (req.user as any).id;

    // Validate request body
    const data = createHealthRecordSchema.parse(req.body);

    // Get the animal info for notifications
    const animal = await getAnimalForFarm(animalId, farmId);

    const record = await createHealthRecord({
      farmId,
      animalId,
      recordedById: userId,
      date: data.date,
      type: data.type,
      description: data.description,
      notes: data.notes,
      severity: data.severity,
      treatmentId: data.treatmentId,
      vetVisitId: data.vetVisitId,
      requiresFollowUp: data.requiresFollowUp,
      followUpDate: data.followUpDate,
    });

    logger.info({ animalId, recordId: record.id, type: data.type }, "Created health record");

    // === REAL-TIME UPDATES ===
    
    // 1. Broadcast WebSocket event to users subscribed to this animal's channel
    try {
      const animalChannelId = `animal-${animalId}`;
      chatWebSocket.broadcastNewHealthRecord(animalChannelId, animalId, {
        ...record,
        animalName: animal.name || animal.visualId || animalId,
      });
    } catch (wsError) {
      logger.error({ error: wsError }, "Failed to broadcast health record via WebSocket");
    }

    // 2. Create in-app notifications for farm staff
    try {
      const animalName = animal.name || animal.visualId || 'Unknown Animal';
      const notificationMessage = `New ${data.type} record for ${animalName}: ${data.description.substring(0, 100)}${data.description.length > 100 ? '...' : ''}`;
      
      // Get all active users (in production, filter by farm and role)
      const farmUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isActive, true));

      // Create notification for each user (except the one who created the record)
      const notificationPromises = farmUsers
        .filter(u => u.id !== userId)
        .map(async (user) => {
          try {
            await db.insert(notificationLogs).values({
              userId: user.id,
              type: 'animal_health',
              title: `Animal Health: ${animalName}`,
              message: notificationMessage,
              metadata: {
                animalId,
                recordId: record.id,
                recordType: data.type,
                severity: data.severity,
              },
              read: false,
              createdAt: new Date(),
            });

            // Also send real-time notification via WebSocket
            chatWebSocket.broadcastNotification(user.id, {
              type: 'animal_health',
              title: `Animal Health: ${animalName}`,
              message: notificationMessage,
              animalId,
              recordId: record.id,
            });
          } catch (notifError) {
            logger.error({ error: notifError, userId: user.id }, "Failed to create notification");
          }
        });

      await Promise.allSettled(notificationPromises);
      logger.info({ animalId, notifiedUsers: farmUsers.length - 1 }, "Created health record notifications");
    } catch (notifError) {
      logger.error({ error: notifError }, "Failed to create notifications for health record");
    }

    res.status(201).json(record);
  } catch (error) {
    if (error instanceof AnimalNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof PermissionDeniedError) {
      return res.status(403).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid health record data", details: error.errors });
    }
    logger.error({ error }, "Failed to create health record");
    res.status(500).json({ error: "Failed to create health record" });
  }
});

/**
 * PATCH /api/animals/:animalId/health/:recordId
 * Update an existing health record
 */
router.patch("/:animalId/health/:recordId", requireAuth, async (req, res) => {
  try {
    const { animalId, recordId } = req.params;
    const farmId = (req.user as any).farmId;

    // Validate request body
    const data = updateHealthRecordSchema.parse(req.body);

    // First verify the animal belongs to this farm
    await getAnimalForFarm(animalId, farmId);

    const record = await updateHealthRecord(farmId, recordId, data);

    if (!record) {
      return res.status(404).json({ error: "Health record not found" });
    }

    logger.info({ animalId, recordId }, "Updated health record");
    res.json(record);
  } catch (error) {
    if (error instanceof AnimalNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof PermissionDeniedError) {
      return res.status(403).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid health record data", details: error.errors });
    }
    logger.error({ error }, "Failed to update health record");
    res.status(500).json({ error: "Failed to update health record" });
  }
});

/**
 * DELETE /api/animals/:animalId/health/:recordId
 * Delete a health record
 */
router.delete("/:animalId/health/:recordId", requireAuth, async (req, res) => {
  try {
    const { animalId, recordId } = req.params;
    const farmId = (req.user as any).farmId;

    // First verify the animal belongs to this farm
    await getAnimalForFarm(animalId, farmId);

    const success = await deleteHealthRecord(farmId, recordId);

    if (!success) {
      return res.status(404).json({ error: "Health record not found" });
    }

    logger.info({ animalId, recordId }, "Deleted health record");
    res.status(204).send();
  } catch (error) {
    if (error instanceof AnimalNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof PermissionDeniedError) {
      return res.status(403).json({ error: error.message });
    }
    logger.error({ error }, "Failed to delete health record");
    res.status(500).json({ error: "Failed to delete health record" });
  }
});

/**
 * GET /api/animals/health/follow-ups
 * Get all health records requiring follow-up across all animals for the farm
 * Useful for dashboard alerts
 */
router.get("/health/follow-ups", requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const { limit } = req.query;

    const records = await getPendingFollowUps(farmId, {
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json(records);
  } catch (error) {
    logger.error({ error }, "Failed to get pending follow-ups");
    res.status(500).json({ error: "Failed to get pending follow-ups" });
  }
});

export default router;
