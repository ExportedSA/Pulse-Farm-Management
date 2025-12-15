import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import {
  createAnimal,
  listAnimals,
  getAnimal,
  updateAnimal,
  deleteAnimal,
  getAnimalByTag,
  searchAnimals,
} from "../domain/animals";
import { getOrCreateAnimalChannel } from "../domain/chat";
import logger from "../config/logger";

const router = Router();

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
    const data = updateAnimalSchema.parse(req.body);

    // Check if animal exists and belongs to the farm
    const existing = await getAnimal(id);
    if (!existing) {
      return res.status(404).json({ error: "Animal not found" });
    }
    if (existing.farmId !== farmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check for duplicate visual ID if being updated
    if (data.visualId && data.visualId !== existing.visualId) {
      const duplicate = await getAnimalByTag(data.visualId);
      if (duplicate && duplicate.farmId === farmId && duplicate.id !== id) {
        return res.status(400).json({ error: "An animal with this tag already exists" });
      }
    }

    const animal = await updateAnimal(id, data);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    res.json(animal);
  } catch (error) {
    logger.error({ error }, "Failed to update animal");
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid animal data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update animal" });
  }
});

// DELETE /api/animals/:id - Delete animal
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const farmId = (req.user as any).farmId;

    // Check if animal exists and belongs to the farm
    const existing = await getAnimal(id);
    if (!existing) {
      return res.status(404).json({ error: "Animal not found" });
    }
    if (existing.farmId !== farmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const success = await deleteAnimal(id);
    if (!success) {
      return res.status(404).json({ error: "Animal not found" });
    }

    res.status(204).send();
  } catch (error) {
    logger.error({ error }, "Failed to delete animal");
    res.status(500).json({ error: "Failed to delete animal" });
  }
});

export default router;
