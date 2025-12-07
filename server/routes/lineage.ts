// Lineage/Offspring Tracking API Routes
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { z } from "zod";

const router = Router();

interface AnimalSummary {
  id: string;
  cowId: string | null;
  naitTag: string | null;
  breed: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  status: string;
}

interface LineageNode {
  animal: AnimalSummary;
  dam?: LineageNode;
  sire?: LineageNode | { external: true; info: any };
}

interface OffspringInfo {
  id: string;
  cowId: string | null;
  naitTag: string | null;
  breed: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  status: string;
  damId: string | null;
  sireId: string | null;
}

// GET /api/lineage/:animalId - Get lineage/pedigree for an animal
router.get("/:animalId", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    const { depth = "3" } = req.query;
    const maxDepth = Math.min(parseInt(depth as string), 5); // Limit depth to 5 generations
    
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }
    
    // Build lineage tree recursively
    const buildLineage = async (id: string, currentDepth: number): Promise<LineageNode | null> => {
      if (currentDepth > maxDepth) return null;
      
      const a = await storage.getAnimal(id);
      if (!a) return null;
      
      const node: LineageNode = {
        animal: {
          id: a.id,
          cowId: a.cowId,
          naitTag: a.naitTag,
          breed: a.breed,
          sex: a.sex,
          dateOfBirth: a.dateOfBirth,
          status: a.status,
        },
      };
      
      // Get dam (mother)
      if ((a as any).damId) {
        const damNode = await buildLineage((a as any).damId, currentDepth + 1);
        if (damNode) node.dam = damNode;
      }
      
      // Get sire (father)
      if ((a as any).sireId) {
        const sireNode = await buildLineage((a as any).sireId, currentDepth + 1);
        if (sireNode) node.sire = sireNode;
      } else if ((a as any).sireInfo) {
        // External sire (AI, etc.)
        node.sire = { external: true, info: (a as any).sireInfo };
      }
      
      return node;
    };
    
    const lineage = await buildLineage(animalId, 0);
    
    res.json({
      animalId,
      lineage,
      depth: maxDepth,
    });
  } catch (error) {
    console.error("Error fetching lineage:", error);
    res.status(500).json({ error: "Failed to fetch lineage" });
  }
});

// GET /api/lineage/:animalId/offspring - Get all offspring for an animal
router.get("/:animalId/offspring", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }
    
    // Get all animals and filter for offspring
    const allAnimals = await storage.getAnimals();
    
    const offspring = allAnimals.filter(a => {
      const damId = (a as any).damId;
      const sireId = (a as any).sireId;
      return damId === animalId || sireId === animalId;
    }).map(a => ({
      id: a.id,
      cowId: a.cowId,
      naitTag: a.naitTag,
      breed: a.breed,
      sex: a.sex,
      dateOfBirth: a.dateOfBirth,
      status: a.status,
      relationship: (a as any).damId === animalId ? 'dam' : 'sire',
    }));
    
    // Sort by date of birth (newest first)
    offspring.sort((a, b) => {
      if (!a.dateOfBirth) return 1;
      if (!b.dateOfBirth) return -1;
      return new Date(b.dateOfBirth).getTime() - new Date(a.dateOfBirth).getTime();
    });
    
    res.json({
      animalId,
      animalName: animal.cowId || animal.naitTag || animal.id,
      parentType: animal.sex === 'female' ? 'dam' : 'sire',
      offspringCount: offspring.length,
      offspring,
    });
  } catch (error) {
    console.error("Error fetching offspring:", error);
    res.status(500).json({ error: "Failed to fetch offspring" });
  }
});

// GET /api/lineage/:animalId/parents - Get parents for an animal
router.get("/:animalId/parents", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }
    
    let dam = null;
    let sire = null;
    
    const damId = (animal as any).damId;
    const sireId = (animal as any).sireId;
    const sireInfo = (animal as any).sireInfo;
    
    if (damId) {
      const damAnimal = await storage.getAnimal(damId);
      if (damAnimal) {
        dam = {
          id: damAnimal.id,
          cowId: damAnimal.cowId,
          naitTag: damAnimal.naitTag,
          breed: damAnimal.breed,
          sex: damAnimal.sex,
          dateOfBirth: damAnimal.dateOfBirth,
          status: damAnimal.status,
          inSystem: true,
        };
      }
    }
    
    if (sireId) {
      const sireAnimal = await storage.getAnimal(sireId);
      if (sireAnimal) {
        sire = {
          id: sireAnimal.id,
          cowId: sireAnimal.cowId,
          naitTag: sireAnimal.naitTag,
          breed: sireAnimal.breed,
          sex: sireAnimal.sex,
          dateOfBirth: sireAnimal.dateOfBirth,
          status: sireAnimal.status,
          inSystem: true,
        };
      }
    } else if (sireInfo) {
      sire = {
        ...sireInfo,
        inSystem: false,
        external: true,
      };
    }
    
    res.json({
      animalId,
      animalName: animal.cowId || animal.naitTag || animal.id,
      dam,
      sire,
    });
  } catch (error) {
    console.error("Error fetching parents:", error);
    res.status(500).json({ error: "Failed to fetch parents" });
  }
});

// PUT /api/lineage/:animalId/parents - Update parent relationships
router.put("/:animalId/parents", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    const schema = z.object({
      damId: z.string().uuid().nullable().optional(),
      sireId: z.string().uuid().nullable().optional(),
      sireInfo: z.object({
        name: z.string().optional(),
        breed: z.string().optional(),
        registrationNumber: z.string().optional(),
        externalId: z.string().optional(),
      }).nullable().optional(),
    });
    
    const data = schema.parse(req.body);
    
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }
    
    // Validate dam exists and is female
    if (data.damId) {
      const dam = await storage.getAnimal(data.damId);
      if (!dam) {
        return res.status(400).json({ error: "Dam not found" });
      }
      if (dam.sex !== 'female') {
        return res.status(400).json({ error: "Dam must be female" });
      }
      if (dam.id === animalId) {
        return res.status(400).json({ error: "Animal cannot be its own parent" });
      }
    }
    
    // Validate sire exists and is male (if internal)
    if (data.sireId) {
      const sire = await storage.getAnimal(data.sireId);
      if (!sire) {
        return res.status(400).json({ error: "Sire not found" });
      }
      if (sire.sex !== 'male') {
        return res.status(400).json({ error: "Sire must be male" });
      }
      if (sire.id === animalId) {
        return res.status(400).json({ error: "Animal cannot be its own parent" });
      }
    }
    
    const updated = await storage.updateAnimal(animalId, data as any);
    
    res.json({
      message: "Parents updated successfully",
      animal: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error updating parents:", error);
    res.status(500).json({ error: "Failed to update parents" });
  }
});

// GET /api/lineage/:animalId/siblings - Get siblings for an animal
router.get("/:animalId/siblings", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }
    
    const damId = (animal as any).damId;
    const sireId = (animal as any).sireId;
    
    if (!damId && !sireId) {
      return res.json({
        animalId,
        fullSiblings: [],
        maternalHalfSiblings: [],
        paternalHalfSiblings: [],
      });
    }
    
    const allAnimals = await storage.getAnimals();
    
    const fullSiblings: AnimalSummary[] = [];
    const maternalHalfSiblings: AnimalSummary[] = [];
    const paternalHalfSiblings: AnimalSummary[] = [];
    
    for (const a of allAnimals) {
      if (a.id === animalId) continue;
      
      const aDamId = (a as any).damId;
      const aSireId = (a as any).sireId;
      
      const sameDam = damId && aDamId === damId;
      const sameSire = sireId && aSireId === sireId;
      
      const summary: AnimalSummary = {
        id: a.id,
        cowId: a.cowId,
        naitTag: a.naitTag,
        breed: a.breed,
        sex: a.sex,
        dateOfBirth: a.dateOfBirth,
        status: a.status,
      };
      
      if (sameDam && sameSire) {
        fullSiblings.push(summary);
      } else if (sameDam) {
        maternalHalfSiblings.push(summary);
      } else if (sameSire) {
        paternalHalfSiblings.push(summary);
      }
    }
    
    res.json({
      animalId,
      fullSiblings,
      maternalHalfSiblings,
      paternalHalfSiblings,
    });
  } catch (error) {
    console.error("Error fetching siblings:", error);
    res.status(500).json({ error: "Failed to fetch siblings" });
  }
});

// GET /api/lineage/:animalId/breeding-stats - Get breeding statistics
router.get("/:animalId/breeding-stats", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }
    
    const allAnimals = await storage.getAnimals();
    
    // Count offspring
    const offspring = allAnimals.filter(a => {
      const damId = (a as any).damId;
      const sireId = (a as any).sireId;
      return damId === animalId || sireId === animalId;
    });
    
    const maleOffspring = offspring.filter(a => a.sex === 'male').length;
    const femaleOffspring = offspring.filter(a => a.sex === 'female').length;
    const activeOffspring = offspring.filter(a => a.status === 'active').length;
    
    // Get reproduction events
    const reproEvents = await storage.getReproductionEvents(animalId);
    
    // Calculate stats
    const calvings = reproEvents.filter(e => e.eventType === 'calving').length;
    const pregnancyChecks = reproEvents.filter(e => e.eventType === 'pregnancy_check').length;
    const aiEvents = reproEvents.filter(e => e.eventType === 'ai').length;
    
    res.json({
      animalId,
      animalName: animal.cowId || animal.naitTag || animal.id,
      sex: animal.sex,
      breeding: {
        totalOffspring: offspring.length,
        maleOffspring,
        femaleOffspring,
        activeOffspring,
        calvings,
        pregnancyChecks,
        aiEvents,
      },
      geneticInfo: (animal as any).geneticInfo || null,
    });
  } catch (error) {
    console.error("Error fetching breeding stats:", error);
    res.status(500).json({ error: "Failed to fetch breeding stats" });
  }
});

// POST /api/lineage/link-calving - Link a calf to its dam from a calving event
router.post("/link-calving", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      calfId: z.string().uuid(),
      damId: z.string().uuid(),
      sireId: z.string().uuid().optional(),
      sireInfo: z.object({
        name: z.string().optional(),
        breed: z.string().optional(),
        registrationNumber: z.string().optional(),
        externalId: z.string().optional(),
      }).optional(),
    });
    
    const data = schema.parse(req.body);
    
    // Verify calf exists
    const calf = await storage.getAnimal(data.calfId);
    if (!calf) {
      return res.status(404).json({ error: "Calf not found" });
    }
    
    // Verify dam exists and is female
    const dam = await storage.getAnimal(data.damId);
    if (!dam) {
      return res.status(404).json({ error: "Dam not found" });
    }
    if (dam.sex !== 'female') {
      return res.status(400).json({ error: "Dam must be female" });
    }
    
    // Update calf with lineage info
    const updateData: any = { damId: data.damId };
    if (data.sireId) {
      updateData.sireId = data.sireId;
    }
    if (data.sireInfo) {
      updateData.sireInfo = data.sireInfo;
    }
    
    const updated = await storage.updateAnimal(data.calfId, updateData);
    
    res.json({
      message: "Calf linked to dam successfully",
      calf: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error linking calving:", error);
    res.status(500).json({ error: "Failed to link calving" });
  }
});

export default router;
