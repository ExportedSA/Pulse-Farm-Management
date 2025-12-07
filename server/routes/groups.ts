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

// ===== DYNAMIC GROUPS =====

// Define criteria types for dynamic groups
interface DynamicGroupCriteria {
  rules: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'is_null' | 'is_not_null';
    value: any;
  }>;
  logic: 'and' | 'or';
}

// Helper function to evaluate criteria against an animal
function evaluateAnimalAgainstCriteria(animal: any, criteria: DynamicGroupCriteria): boolean {
  const { rules, logic } = criteria;
  
  const results = rules.map(rule => {
    let fieldValue = animal[rule.field];
    
    // Handle nested fields like age calculation
    if (rule.field === 'ageMonths' && animal.dateOfBirth) {
      const birthDate = new Date(animal.dateOfBirth);
      const now = new Date();
      fieldValue = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    } else if (rule.field === 'ageDays' && animal.dateOfBirth) {
      const birthDate = new Date(animal.dateOfBirth);
      const now = new Date();
      fieldValue = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    switch (rule.operator) {
      case 'equals':
        return fieldValue === rule.value;
      case 'not_equals':
        return fieldValue !== rule.value;
      case 'contains':
        return String(fieldValue || '').toLowerCase().includes(String(rule.value).toLowerCase());
      case 'greater_than':
        return Number(fieldValue) > Number(rule.value);
      case 'less_than':
        return Number(fieldValue) < Number(rule.value);
      case 'in':
        return Array.isArray(rule.value) && rule.value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(rule.value) && !rule.value.includes(fieldValue);
      case 'is_null':
        return fieldValue === null || fieldValue === undefined || fieldValue === '';
      case 'is_not_null':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
      default:
        return false;
    }
  });
  
  return logic === 'and' 
    ? results.every(r => r) 
    : results.some(r => r);
}

// GET /api/groups/:id/dynamic-members - Get computed members for a dynamic group
router.get("/:id/dynamic-members", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const group = await storage.getAnimalGroup(id);
    
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }
    
    if (group.groupType !== 'dynamic') {
      return res.status(400).json({ error: "Group is not a dynamic group" });
    }
    
    if (!group.criteria) {
      return res.json([]);
    }
    
    const animals = await storage.getAnimals();
    const activeAnimals = animals.filter(a => a.status === 'active');
    const criteria = group.criteria as DynamicGroupCriteria;
    
    const matchingAnimals = activeAnimals.filter(animal => 
      evaluateAnimalAgainstCriteria(animal, criteria)
    );
    
    res.json(matchingAnimals);
  } catch (error) {
    console.error("Error fetching dynamic group members:", error);
    res.status(500).json({ error: "Failed to fetch dynamic group members" });
  }
});

// POST /api/groups/:id/refresh - Refresh dynamic group membership
router.post("/:id/refresh", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const group = await storage.getAnimalGroup(id);
    
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }
    
    if (group.groupType !== 'dynamic') {
      return res.status(400).json({ error: "Only dynamic groups can be refreshed" });
    }
    
    if (!group.criteria) {
      return res.json({ added: 0, removed: 0, total: 0 });
    }
    
    const animals = await storage.getAnimals();
    const activeAnimals = animals.filter(a => a.status === 'active');
    const criteria = group.criteria as DynamicGroupCriteria;
    
    // Get current members
    const currentMembers = await storage.getGroupMembers(id);
    const currentMemberIds = new Set(currentMembers.map((m: any) => m.animalId));
    
    // Find matching animals
    const matchingAnimals = activeAnimals.filter(animal => 
      evaluateAnimalAgainstCriteria(animal, criteria)
    );
    const matchingIds = new Set(matchingAnimals.map(a => a.id));
    
    // Add new members
    let added = 0;
    for (const animal of matchingAnimals) {
      if (!currentMemberIds.has(animal.id)) {
        try {
          await storage.addAnimalToGroup(id, animal.id, undefined, 'Auto-added by dynamic group');
          added++;
        } catch (e) {
          // Ignore duplicate errors
        }
      }
    }
    
    // Remove animals that no longer match
    let removed = 0;
    for (const member of currentMembers) {
      if (!matchingIds.has(member.animalId)) {
        await storage.removeAnimalFromGroup(id, member.animalId);
        removed++;
      }
    }
    
    res.json({
      added,
      removed,
      total: matchingAnimals.length,
    });
  } catch (error) {
    console.error("Error refreshing dynamic group:", error);
    res.status(500).json({ error: "Failed to refresh dynamic group" });
  }
});

// POST /api/groups/preview-criteria - Preview which animals match criteria
router.post("/preview-criteria", async (req: Request, res: Response) => {
  try {
    const criteriaSchema = z.object({
      rules: z.array(z.object({
        field: z.string(),
        operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in', 'not_in', 'is_null', 'is_not_null']),
        value: z.any(),
      })),
      logic: z.enum(['and', 'or']),
    });
    
    const criteria = criteriaSchema.parse(req.body) as DynamicGroupCriteria;
    const animals = await storage.getAnimals();
    const activeAnimals = animals.filter(a => a.status === 'active');
    
    const matchingAnimals = activeAnimals.filter(animal => 
      evaluateAnimalAgainstCriteria(animal, criteria)
    );
    
    res.json({
      count: matchingAnimals.length,
      animals: matchingAnimals.slice(0, 50), // Limit preview to 50
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid criteria", details: error.errors });
    }
    console.error("Error previewing criteria:", error);
    res.status(500).json({ error: "Failed to preview criteria" });
  }
});

// GET /api/groups/dynamic - Get all dynamic groups with member counts
router.get("/type/dynamic", async (_req: Request, res: Response) => {
  try {
    const groups = await storage.getAnimalGroups();
    const dynamicGroups = groups.filter((g: any) => g.groupType === 'dynamic');
    
    // Get member counts for each
    const groupsWithCounts = await Promise.all(
      dynamicGroups.map(async (group: any) => {
        const members = await storage.getGroupMembers(group.id);
        return {
          ...group,
          memberCount: members.length,
        };
      })
    );
    
    res.json(groupsWithCounts);
  } catch (error) {
    console.error("Error fetching dynamic groups:", error);
    res.status(500).json({ error: "Failed to fetch dynamic groups" });
  }
});

// POST /api/groups/refresh-all-dynamic - Refresh all dynamic groups
router.post("/refresh-all-dynamic", async (_req: Request, res: Response) => {
  try {
    const groups = await storage.getAnimalGroups();
    const dynamicGroups = groups.filter((g: any) => g.groupType === 'dynamic');
    const animals = await storage.getAnimals();
    const activeAnimals = animals.filter(a => a.status === 'active');
    
    const results = [];
    
    for (const group of dynamicGroups) {
      if (!group.criteria) continue;
      
      const criteria = group.criteria as DynamicGroupCriteria;
      const currentMembers = await storage.getGroupMembers(group.id);
      const currentMemberIds = new Set(currentMembers.map((m: any) => m.animalId));
      
      const matchingAnimals = activeAnimals.filter(animal => 
        evaluateAnimalAgainstCriteria(animal, criteria)
      );
      const matchingIds = new Set(matchingAnimals.map(a => a.id));
      
      let added = 0;
      let removed = 0;
      
      for (const animal of matchingAnimals) {
        if (!currentMemberIds.has(animal.id)) {
          try {
            await storage.addAnimalToGroup(group.id, animal.id, undefined, 'Auto-added by dynamic group');
            added++;
          } catch (e) {}
        }
      }
      
      for (const member of currentMembers) {
        if (!matchingIds.has(member.animalId)) {
          await storage.removeAnimalFromGroup(group.id, member.animalId);
          removed++;
        }
      }
      
      results.push({
        groupId: group.id,
        groupName: group.name,
        added,
        removed,
        total: matchingAnimals.length,
      });
    }
    
    res.json({
      groupsProcessed: results.length,
      results,
    });
  } catch (error) {
    console.error("Error refreshing all dynamic groups:", error);
    res.status(500).json({ error: "Failed to refresh dynamic groups" });
  }
});

export default router;
