/**
 * Animal Tag Management Routes
 * Handles VID, LID, NAIT/EID tag assignment and change tracking
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { animals, animalTagHistory, naitQueue } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// Get tag history for an animal
router.get('/api/animals/:animalId/tag-history', async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    const history = await db
      .select()
      .from(animalTagHistory)
      .where(eq(animalTagHistory.animalId, animalId))
      .orderBy(desc(animalTagHistory.changeDate));
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching tag history:', error);
    res.status(500).json({ error: 'Failed to fetch tag history' });
  }
});

// Update/change a tag
router.post('/api/animals/:animalId/tags', async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    const { tagType, newValue, changeReason, notes, changeDate } = req.body;
    
    // Get current animal to find old tag value
    const [animal] = await db.select().from(animals).where(eq(animals.id, animalId));
    
    if (!animal) {
      return res.status(404).json({ error: 'Animal not found' });
    }
    
    // Get old value based on tag type
    let oldValue: string | null = null;
    switch (tagType) {
      case 'visual_id':
        oldValue = animal.visualId || animal.cowId || null;
        break;
      case 'lifetime_id':
        oldValue = animal.lifetimeId || null;
        break;
      case 'nait_tag':
        oldValue = animal.naitTag || null;
        break;
      case 'eid':
        oldValue = animal.eid || null;
        break;
    }
    
    // Create history record
    const [historyRecord] = await db.insert(animalTagHistory).values({
      animalId,
      tagType,
      oldValue,
      newValue,
      changeReason,
      changeDate: changeDate || new Date().toISOString().split('T')[0],
      notes,
      naitReported: false,
    }).returning();
    
    // Update animal with new tag value
    const updateData: Record<string, string> = {};
    switch (tagType) {
      case 'visual_id':
        updateData.visualId = newValue;
        // Also update cowId for backwards compatibility
        updateData.cowId = newValue;
        break;
      case 'lifetime_id':
        updateData.lifetimeId = newValue;
        break;
      case 'nait_tag':
        updateData.naitTag = newValue;
        break;
      case 'eid':
        updateData.eid = newValue;
        break;
    }
    
    const [updatedAnimal] = await db
      .update(animals)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(animals.id, animalId))
      .returning();
    
    // If NAIT tag or LID changed, queue for NAIT reporting
    if (tagType === 'nait_tag' || tagType === 'lifetime_id') {
      try {
        await db.insert(naitQueue).values({
          animalId,
          actionType: 'tag_change',
          payload: {
            tagType,
            oldValue,
            newValue,
            changedBy: req.body.changedBy || 'system',
            changedAt: new Date().toISOString(),
          },
          status: 'pending',
          attempts: 0,
        });
      } catch (queueError) {
        console.error('Failed to queue NAIT tag change:', queueError);
        // Continue - queue failure shouldn't block tag update
      }
    }
    
    res.json({
      success: true,
      animal: updatedAnimal,
      historyRecord,
    });
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// Get all tags for an animal (summary)
router.get('/api/animals/:animalId/tags', async (req: Request, res: Response) => {
  try {
    const { animalId } = req.params;
    
    const [animal] = await db.select().from(animals).where(eq(animals.id, animalId));
    
    if (!animal) {
      return res.status(404).json({ error: 'Animal not found' });
    }
    
    res.json({
      visual_id: animal.visualId || animal.cowId || null,
      lifetime_id: animal.lifetimeId || null,
      nait_tag: animal.naitTag || null,
      eid: animal.eid || null,
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Bulk tag assignment (for multiple animals)
router.post('/api/animals/tags/bulk', async (req: Request, res: Response) => {
  try {
    const { animalIds, tagType, tagPrefix, startNumber, changeReason, notes } = req.body;
    
    const results = [];
    let currentNumber = parseInt(startNumber, 10);
    
    for (const animalId of animalIds) {
      const newValue = `${tagPrefix}${String(currentNumber).padStart(4, '0')}`;
      
      // Get current animal
      const [animal] = await db.select().from(animals).where(eq(animals.id, animalId));
      if (!animal) continue;
      
      // Get old value
      let oldValue: string | null = null;
      switch (tagType) {
        case 'visual_id':
          oldValue = animal.visualId || animal.cowId || null;
          break;
        case 'lifetime_id':
          oldValue = animal.lifetimeId || null;
          break;
        case 'nait_tag':
          oldValue = animal.naitTag || null;
          break;
        case 'eid':
          oldValue = animal.eid || null;
          break;
      }
      
      // Create history record
      await db.insert(animalTagHistory).values({
        animalId,
        tagType,
        oldValue,
        newValue,
        changeReason: changeReason || 'initial',
        changeDate: new Date().toISOString().split('T')[0],
        notes,
        naitReported: false,
      });
      
      // Update animal
      const updateData: Record<string, string> = {};
      switch (tagType) {
        case 'visual_id':
          updateData.visualId = newValue;
          updateData.cowId = newValue;
          break;
        case 'lifetime_id':
          updateData.lifetimeId = newValue;
          break;
        case 'nait_tag':
          updateData.naitTag = newValue;
          break;
        case 'eid':
          updateData.eid = newValue;
          break;
      }
      
      await db
        .update(animals)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(animals.id, animalId));
      
      results.push({ animalId, newValue });
      currentNumber++;
    }
    
    res.json({
      success: true,
      updated: results.length,
      results,
    });
  } catch (error) {
    console.error('Error bulk updating tags:', error);
    res.status(500).json({ error: 'Failed to bulk update tags' });
  }
});

export default router;
