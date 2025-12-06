// Phase 4: Animal Groups/Herds API Routes
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { insertAnimalGroupSchema, insertAnimalGroupMemberSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

// GET /api/groups/memberships - Bulk membership pairs for efficient client filtering
router.get("/memberships", async (_req: Request, res: Response) => {
  try {
    const memberships = await storage.getAllGroupMembershipPairs();
    res.json(memberships);
  } catch (error) {
    console.error("Error fetching group memberships:", error);
    res.status(500).json({ error: "Failed to fetch group memberships" });
  }
});

// GET /api/groups - List all groups
router.get("/", async (_req: Request, res: Response) => {
  try {
    const groups = await storage.getAnimalGroups();
    res.json(groups);
  } catch (error) {
    console.error("Error fetching animal groups:", error);
    res.status(500).json({ error: "Failed to fetch animal groups" });
  }
});

// GET /api/groups/:id - Get group details with members
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await storage.getAnimalGroupWithMembers(id);
    
    if (!result) {
      return res.status(404).json({ error: "Group not found" });
    }
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching animal group:", error);
    res.status(500).json({ error: "Failed to fetch animal group" });
  }
});

// POST /api/groups - Create new group
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = insertAnimalGroupSchema.parse(req.body);
    const group = await storage.createAnimalGroup(data);
    res.status(201).json(group);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error creating animal group:", error);
    res.status(500).json({ error: "Failed to create animal group" });
  }
});

// PUT /api/groups/:id - Update group
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = insertAnimalGroupSchema.partial().parse(req.body);
    const group = await storage.updateAnimalGroup(id, data);
    res.json(group);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error updating animal group:", error);
    res.status(500).json({ error: "Failed to update animal group" });
  }
});

// DELETE /api/groups/:id - Delete group (soft delete)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await storage.deleteAnimalGroup(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting animal group:", error);
    res.status(500).json({ error: "Failed to delete animal group" });
  }
});

// POST /api/groups/:id/members - Add animal to group
router.post("/:id/members", async (req: Request, res: Response) => {
  try {
    const { id: groupId } = req.params;
    const { animalId, notes } = insertAnimalGroupMemberSchema.parse({
      ...req.body,
      groupId,
    });
    
    const userId = (req.user as any)?.id || undefined;
    const member = await storage.addAnimalToGroup(groupId, animalId, userId, notes || undefined);
    res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    // Check for unique constraint violation (duplicate membership)
    if ((error as any).code === '23505' || (error as any).message?.includes('unique')) {
      return res.status(409).json({ error: "Animal is already a member of this group" });
    }
    console.error("Error adding animal to group:", error);
    res.status(500).json({ error: "Failed to add animal to group" });
  }
});

// DELETE /api/groups/:id/members/:animalId - Remove animal from group
router.delete("/:id/members/:animalId", async (req: Request, res: Response) => {
  try {
    const { id: groupId, animalId } = req.params;
    await storage.removeAnimalFromGroup(groupId, animalId);
    res.status(204).send();
  } catch (error) {
    console.error("Error removing animal from group:", error);
    res.status(500).json({ error: "Failed to remove animal from group" });
  }
});

// GET /api/groups/:id/members - Get all members of a group
router.get("/:id/members", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const members = await storage.getGroupMembers(id);
    res.json(members);
  } catch (error) {
    console.error("Error fetching group members:", error);
    res.status(500).json({ error: "Failed to fetch group members" });
  }
});

export default router;
