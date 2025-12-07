// Animal Timeline API Routes - Unified activity history
import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { z } from "zod";

const router = Router();

// Timeline event types
type TimelineEventType = 
  | 'created'
  | 'status_change'
  | 'treatment'
  | 'reproduction'
  | 'weight_record'
  | 'pasture_move'
  | 'group_add'
  | 'group_remove'
  | 'note'
  | 'vaccination'
  | 'health_check'
  | 'transaction';

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string;
  title: string;
  description: string;
  metadata?: Record<string, any>;
  icon?: string;
  color?: string;
}

// GET /api/animals/:animalId/timeline - Get unified timeline for an animal
router.get("/:animalId/timeline", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    const { limit = "50", startDate, endDate } = req.query;
    
    // Verify animal exists
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }
    
    const events: TimelineEvent[] = [];
    
    // 1. Animal creation event
    if (animal.createdAt) {
      events.push({
        id: `created-${animal.id}`,
        type: 'created',
        date: animal.createdAt.toISOString(),
        title: 'Animal Registered',
        description: `${animal.cowId || animal.naitTag || 'Animal'} was added to the system`,
        metadata: {
          breed: animal.breed,
          sex: animal.sex,
          dateOfBirth: animal.dateOfBirth,
        },
        icon: 'plus-circle',
        color: 'green',
      });
    }
    
    // 2. Treatments
    try {
      const treatments = await storage.getAnimalTreatmentsByAnimal(animalId);
      for (const treatment of treatments) {
        events.push({
          id: `treatment-${treatment.id}`,
          type: 'treatment',
          date: treatment.dateTime || treatment.createdAt.toISOString(),
          title: treatment.condition || treatment.treatmentType || 'Treatment',
          description: `${treatment.category || 'Treatment'} administered by ${treatment.staffMember || 'Staff'}`,
          metadata: {
            productId: treatment.productId,
            doseAmount: treatment.doseAmount,
            doseUnit: treatment.doseUnit,
            status: treatment.status,
            clinicalNotes: treatment.clinicalNotes,
          },
          icon: 'syringe',
          color: 'blue',
        });
      }
    } catch (e) {
      console.warn("Could not fetch treatments for timeline:", e);
    }
    
    // 3. Reproduction events
    try {
      const reproEvents = await storage.getReproductionEventsByAnimal(animalId);
      for (const event of reproEvents) {
        events.push({
          id: `reproduction-${event.id}`,
          type: 'reproduction',
          date: event.eventDate || event.createdAt.toISOString(),
          title: formatReproductionEventType(event.eventType),
          description: event.notes || `Reproduction event: ${event.eventType}`,
          metadata: {
            eventType: event.eventType,
            aiDetails: (event as any).aiDetails,
            pregnancyDetails: (event as any).pregnancyDetails,
            calvingDetails: (event as any).calvingDetails,
          },
          icon: 'heart',
          color: 'pink',
        });
      }
    } catch (e) {
      console.warn("Could not fetch reproduction events for timeline:", e);
    }
    
    // 4. Weight records
    try {
      const weightRecords = await storage.getWeightRecordsByAnimal(animalId);
      for (const record of weightRecords) {
        events.push({
          id: `weight-${record.id}`,
          type: 'weight_record',
          date: record.date,
          title: `Weight: ${record.weight} kg`,
          description: record.bodyConditionScore 
            ? `Body Condition Score: ${record.bodyConditionScore}/5`
            : 'Weight recorded',
          metadata: {
            weight: record.weight,
            bodyConditionScore: record.bodyConditionScore,
            notes: record.notes,
          },
          icon: 'scale',
          color: 'orange',
        });
      }
    } catch (e) {
      console.warn("Could not fetch weight records for timeline:", e);
    }
    
    // 5. Pasture movements
    try {
      const movements = await storage.getPastureMovementsByAnimal(animalId);
      const pastures = await storage.getPastures();
      const pastureMap = new Map(pastures.map(p => [p.id, p.name]));
      
      for (const movement of movements) {
        const fromName = movement.fromPastureId ? pastureMap.get(movement.fromPastureId) || 'Unknown' : 'N/A';
        const toName = pastureMap.get(movement.toPastureId) || 'Unknown';
        
        events.push({
          id: `movement-${movement.id}`,
          type: 'pasture_move',
          date: movement.movedAt.toISOString(),
          title: `Moved to ${toName}`,
          description: movement.fromPastureId 
            ? `Moved from ${fromName} to ${toName}`
            : `Initial placement in ${toName}`,
          metadata: {
            fromPastureId: movement.fromPastureId,
            toPastureId: movement.toPastureId,
            fromPastureName: fromName,
            toPastureName: toName,
            reason: movement.reason,
          },
          icon: 'map-pin',
          color: 'purple',
        });
      }
    } catch (e) {
      console.warn("Could not fetch pasture movements for timeline:", e);
    }
    
    // 6. Group membership changes
    try {
      const memberships = await storage.getAnimalGroupMembershipHistory(animalId);
      for (const membership of memberships) {
        events.push({
          id: `group-${membership.id}`,
          type: membership.removedAt ? 'group_remove' : 'group_add',
          date: membership.removedAt || membership.addedAt.toISOString(),
          title: membership.removedAt 
            ? `Removed from ${membership.groupName}`
            : `Added to ${membership.groupName}`,
          description: membership.notes || (membership.removedAt 
            ? `Removed from group: ${membership.groupName}`
            : `Added to group: ${membership.groupName}`),
          metadata: {
            groupId: membership.groupId,
            groupName: membership.groupName,
            notes: membership.notes,
          },
          icon: 'users',
          color: 'indigo',
        });
      }
    } catch (e) {
      console.warn("Could not fetch group memberships for timeline:", e);
    }
    
    // 7. Stock transactions involving this animal
    try {
      const transactions = await storage.getStockTransactionsByAnimal(animalId);
      for (const transaction of transactions) {
        events.push({
          id: `transaction-${transaction.id}`,
          type: 'transaction',
          date: transaction.date,
          title: formatTransactionType(transaction.type),
          description: transaction.description || `${transaction.type} transaction`,
          metadata: {
            type: transaction.type,
            reference: transaction.reference,
            pricePerHead: transaction.pricePerHead,
            buyer: transaction.buyer,
            seller: transaction.seller,
          },
          icon: 'receipt',
          color: transaction.type === 'sale' ? 'green' : 'gray',
        });
      }
    } catch (e) {
      console.warn("Could not fetch transactions for timeline:", e);
    }
    
    // Sort by date descending (newest first)
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Apply date filters if provided
    let filteredEvents = events;
    if (startDate) {
      filteredEvents = filteredEvents.filter(e => new Date(e.date) >= new Date(startDate as string));
    }
    if (endDate) {
      filteredEvents = filteredEvents.filter(e => new Date(e.date) <= new Date(endDate as string));
    }
    
    // Apply limit
    const limitNum = parseInt(limit as string);
    const limitedEvents = filteredEvents.slice(0, limitNum);
    
    res.json({
      animalId,
      animalName: animal.cowId || animal.naitTag || animal.id,
      totalEvents: filteredEvents.length,
      events: limitedEvents,
    });
  } catch (error) {
    console.error("Error fetching animal timeline:", error);
    res.status(500).json({ error: "Failed to fetch animal timeline" });
  }
});

// GET /api/animals/:animalId/timeline/summary - Get timeline summary stats
router.get("/:animalId/timeline/summary", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }
    
    // Gather counts
    const [treatments, reproEvents, weightRecords, movements] = await Promise.all([
      storage.getAnimalTreatmentsByAnimal(animalId).catch(() => []),
      storage.getReproductionEventsByAnimal(animalId).catch(() => []),
      storage.getWeightRecordsByAnimal(animalId).catch(() => []),
      storage.getPastureMovementsByAnimal(animalId).catch(() => []),
    ]);
    
    // Calculate age
    let ageMonths = null;
    if (animal.dateOfBirth) {
      const birthDate = new Date(animal.dateOfBirth);
      const now = new Date();
      ageMonths = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    }
    
    // Get latest weight
    const latestWeight = weightRecords.length > 0 
      ? weightRecords.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
      : null;
    
    // Get current pasture
    let currentPasture = null;
    if (animal.currentPastureId) {
      const pasture = await storage.getPasture(animal.currentPastureId);
      currentPasture = pasture?.name || null;
    }
    
    res.json({
      animalId,
      animalName: animal.cowId || animal.naitTag || animal.id,
      status: animal.status,
      breed: animal.breed,
      sex: animal.sex,
      ageMonths,
      currentPasture,
      latestWeight: latestWeight ? {
        weight: latestWeight.weight,
        date: latestWeight.date,
        bcs: latestWeight.bodyConditionScore,
      } : null,
      counts: {
        treatments: treatments.length,
        reproductionEvents: reproEvents.length,
        weightRecords: weightRecords.length,
        pastureMovements: movements.length,
      },
      registeredAt: animal.createdAt,
    });
  } catch (error) {
    console.error("Error fetching timeline summary:", error);
    res.status(500).json({ error: "Failed to fetch timeline summary" });
  }
});

// GET /api/animals/:animalId/movements - Get pasture movement history
router.get("/:animalId/movements", async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }
    
    const movements = await storage.getPastureMovementsByAnimal(animalId);
    const pastures = await storage.getPastures();
    const pastureMap = new Map(pastures.map(p => [p.id, p]));
    
    const enrichedMovements = movements.map((m: any) => ({
      ...m,
      fromPasture: m.fromPastureId ? pastureMap.get(m.fromPastureId) : null,
      toPasture: pastureMap.get(m.toPastureId) || null,
    }));
    
    res.json(enrichedMovements);
  } catch (error) {
    console.error("Error fetching movement history:", error);
    res.status(500).json({ error: "Failed to fetch movement history" });
  }
});

// Helper functions
function formatReproductionEventType(type: string): string {
  const typeMap: Record<string, string> = {
    'heat_detection': 'Heat Detected',
    'insemination': 'Insemination',
    'pregnancy_check': 'Pregnancy Check',
    'calving': 'Calving',
    'dry_off': 'Dried Off',
    'abortion': 'Abortion',
    'embryo_transfer': 'Embryo Transfer',
  };
  return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatTransactionType(type: string): string {
  const typeMap: Record<string, string> = {
    'purchase': 'Purchased',
    'sale': 'Sold',
    'death': 'Death Recorded',
    'birth': 'Birth Registered',
    'transfer_in': 'Transferred In',
    'transfer_out': 'Transferred Out',
  };
  return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default router;
