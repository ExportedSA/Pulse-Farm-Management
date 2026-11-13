import { Router } from 'express';
import { db } from '../db';
import { 
  recurringTaskTemplates, 
  recurringTaskInstances,
  users,
  farmMembers,
} from '../../shared/schema';
import { getFarmId, getUserId } from '../middleware/auth';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Task categories for farms
const TASK_CATEGORIES = [
  { value: 'feeding', label: 'Feeding', icon: '🥬' },
  { value: 'milking', label: 'Milking', icon: '🥛' },
  { value: 'health_check', label: 'Health Check', icon: '🩺' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { value: 'fencing', label: 'Fencing', icon: '🚧' },
  { value: 'water', label: 'Water Systems', icon: '💧' },
  { value: 'pasture', label: 'Pasture Management', icon: '🌾' },
  { value: 'equipment', label: 'Equipment', icon: '🚜' },
  { value: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { value: 'inspection', label: 'Inspection', icon: '🔍' },
  { value: 'general', label: 'General', icon: '📋' },
];

// ============================================
// TEMPLATE ENDPOINTS
// ============================================

// Get all recurring task templates
router.get('/templates', async (req, res) => {
  try {
    // Try database first
    const templates = await db.select().from(recurringTaskTemplates).orderBy(desc(recurringTaskTemplates.createdAt));
    return res.json(templates);
  } catch (error) {
    console.error('Error fetching recurring task templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get single template
router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [template] = await db.select().from(recurringTaskTemplates).where(eq(recurringTaskTemplates.id, id));
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    return res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create new recurring task template
router.post('/templates', async (req, res) => {
  try {
    const templateData = req.body;
    
    const [newTemplate] = await db.insert(recurringTaskTemplates).values({
      ...templateData,
      id: uuidv4(),
      createdBy: getUserId(req) ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    return res.status(201).json(newTemplate);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update recurring task template
router.patch('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const [updated] = await db.update(recurringTaskTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(recurringTaskTemplates.id, id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Template not found' });
    }
    return res.json(updated);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Toggle template active status
router.post('/templates/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [template] = await db.select().from(recurringTaskTemplates).where(eq(recurringTaskTemplates.id, id));
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const [updated] = await db.update(recurringTaskTemplates)
      .set({ isActive: !template.isActive, updatedAt: new Date() })
      .where(eq(recurringTaskTemplates.id, id))
      .returning();
    
    return res.json(updated);
  } catch (error) {
    console.error('Error toggling template:', error);
    res.status(500).json({ error: 'Failed to toggle template' });
  }
});

// Delete template
router.delete('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.delete(recurringTaskTemplates).where(eq(recurringTaskTemplates.id, id));
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// ============================================
// INSTANCE ENDPOINTS
// ============================================

// Get task instances (with filters)
router.get('/instances', async (req, res) => {
  try {
    const { date, startDate, endDate, status, templateId, assignedTo } = req.query;
    
    let query = db.select().from(recurringTaskInstances);
    
    // Add filters as needed
    if (date) {
      query = query.where(eq(recurringTaskInstances.scheduledDate, date as string)) as any;
    }
    
    const instances = await query.orderBy(asc(recurringTaskInstances.scheduledDate), asc(recurringTaskInstances.scheduledTime));
    return res.json(instances);
  } catch (error) {
    console.error('Error fetching instances:', error);
    res.status(500).json({ error: 'Failed to fetch instances' });
  }
});

// Get today's tasks
router.get('/instances/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const instances = await db.select()
      .from(recurringTaskInstances)
      .where(eq(recurringTaskInstances.scheduledDate, today))
      .orderBy(asc(recurringTaskInstances.scheduledTime));
    return res.json(instances);
  } catch (error) {
    console.error('Error fetching today\'s tasks:', error);
    res.status(500).json({ error: 'Failed to fetch today\'s tasks' });
  }
});

// Get upcoming tasks (next 7 days)
router.get('/instances/upcoming', async (req, res) => {
  try {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const todayStr = today.toISOString().split('T')[0];
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    
    const instances = await db.select()
      .from(recurringTaskInstances)
      .where(and(
        gte(recurringTaskInstances.scheduledDate, todayStr),
        lte(recurringTaskInstances.scheduledDate, nextWeekStr)
      ))
      .orderBy(asc(recurringTaskInstances.scheduledDate), asc(recurringTaskInstances.scheduledTime));
    return res.json(instances);
  } catch (error) {
    console.error('Error fetching upcoming tasks:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming tasks' });
  }
});

// Update instance status
router.patch('/instances/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const [updated] = await db.update(recurringTaskInstances)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(recurringTaskInstances.id, id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    return res.json(updated);
  } catch (error) {
    console.error('Error updating instance:', error);
    res.status(500).json({ error: 'Failed to update instance' });
  }
});

// Start a task
router.post('/instances/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    
    const updates = {
      status: 'in_progress',
      startedAt: new Date(),
      updatedAt: new Date(),
    };
    
    const [updated] = await db.update(recurringTaskInstances)
      .set(updates)
      .where(eq(recurringTaskInstances.id, id))
      .returning();
    
    return res.json(updated);
  } catch (error) {
    console.error('Error starting task:', error);
    res.status(500).json({ error: 'Failed to start task' });
  }
});

// Complete a task
router.post('/instances/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { completedBy, actualDuration, notes, checklistItems } = req.body;
    
    const updates = {
      status: 'completed',
      completedAt: new Date(),
      completedBy,
      actualDuration,
      notes,
      checklistItems,
      updatedAt: new Date(),
    };
    
    const [updated] = await db.update(recurringTaskInstances)
      .set(updates)
      .where(eq(recurringTaskInstances.id, id))
      .returning();
    
    return res.json(updated);
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Skip a task
router.post('/instances/:id/skip', async (req, res) => {
  try {
    const { id } = req.params;
    const { skipReason } = req.body;
    
    const updates = {
      status: 'skipped',
      skipReason,
      updatedAt: new Date(),
    };
    
    const [updated] = await db.update(recurringTaskInstances)
      .set(updates)
      .where(eq(recurringTaskInstances.id, id))
      .returning();
    
    return res.json(updated);
  } catch (error) {
    console.error('Error skipping task:', error);
    res.status(500).json({ error: 'Failed to skip task' });
  }
});

// Tick or untick one checklist item on a task
router.patch('/instances/:id/checklist/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { completed } = req.body;
    const [instance] = await db.select().from(recurringTaskInstances).where(eq(recurringTaskInstances.id, id));
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    const items = (instance.checklistItems ?? []) as any[];
    if (!items.some(item => item.id === itemId)) return res.status(404).json({ error: 'Checklist item not found' });
    const checklistItems = items.map(item => item.id === itemId
      ? { ...item, completed: !!completed, completedAt: completed ? new Date().toISOString() : null, completedBy: completed ? getUserId(req) ?? null : null }
      : item);
    const [updated] = await db.update(recurringTaskInstances)
      .set({ checklistItems, updatedAt: new Date() })
      .where(eq(recurringTaskInstances.id, id))
      .returning();
    res.json(updated);
  } catch (error) {
    console.error('Error updating checklist:', error);
    res.status(500).json({ error: 'Failed to update checklist' });
  }
});

// Move a task to another day (e.g. for the weather)
router.post('/instances/:id/reschedule', async (req, res) => {
  try {
    const { newDate } = req.body;
    if (typeof newDate !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(newDate)) return res.status(400).json({ error: 'newDate must be a date' });
    const [updated] = await db.update(recurringTaskInstances)
      .set({ scheduledDate: newDate.slice(0, 10), updatedAt: new Date() })
      .where(eq(recurringTaskInstances.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Instance not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error rescheduling task:', error);
    res.status(500).json({ error: 'Failed to reschedule task' });
  }
});

// ============================================
// STATISTICS ENDPOINTS
// ============================================

// Get recurring task statistics
router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const [templates] = await db.select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) FILTER (WHERE ${recurringTaskTemplates.isActive})::int`,
    }).from(recurringTaskTemplates);
    const [tasks] = await db.select({
      today: sql<number>`count(*) FILTER (WHERE ${recurringTaskInstances.scheduledDate} = ${today})::int`,
      todayCompleted: sql<number>`count(*) FILTER (WHERE ${recurringTaskInstances.scheduledDate} = ${today} AND ${recurringTaskInstances.status} = 'completed')::int`,
      todayPending: sql<number>`count(*) FILTER (WHERE ${recurringTaskInstances.scheduledDate} = ${today} AND ${recurringTaskInstances.status} = 'pending')::int`,
      todayInProgress: sql<number>`count(*) FILTER (WHERE ${recurringTaskInstances.scheduledDate} = ${today} AND ${recurringTaskInstances.status} = 'in_progress')::int`,
      weekly: sql<number>`count(*) FILTER (WHERE ${recurringTaskInstances.scheduledDate} >= ${weekAgo})::int`,
      past: sql<number>`count(*) FILTER (WHERE ${recurringTaskInstances.scheduledDate} < ${today})::int`,
      pastCompleted: sql<number>`count(*) FILTER (WHERE ${recurringTaskInstances.scheduledDate} < ${today} AND ${recurringTaskInstances.status} = 'completed')::int`,
    }).from(recurringTaskInstances);
    res.json({
      totalTemplates: templates.total,
      activeTemplates: templates.active,
      todayTasks: tasks.today,
      todayCompleted: tasks.todayCompleted,
      todayPending: tasks.todayPending,
      todayInProgress: tasks.todayInProgress,
      weeklyTasks: tasks.weekly,
      // Of the tasks already due, how many were done (none due yet: no rate)
      completionRate: tasks.past ? Math.round((tasks.pastCompleted / tasks.past) * 100) : null,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get categories
router.get('/categories', (req, res) => {
  res.json(TASK_CATEGORIES);
});

// The farm's people, to assign tasks to
router.get('/users', async (req, res) => {
  try {
    const people = await db.select({ id: users.id, name: users.name, email: users.email, role: farmMembers.role })
      .from(farmMembers)
      .innerJoin(users, eq(users.id, farmMembers.userId))
      .where(and(eq(farmMembers.farmId, getFarmId(req)!), eq(farmMembers.isActive, true)));
    res.json(people);
  } catch (error) {
    console.error('Error fetching people:', error);
    res.status(500).json({ error: 'Failed to fetch people' });
  }
});

// ============================================
// TASK GENERATION (would run on schedule)
// ============================================

// Make a task from a template, for today or a given date
router.post('/templates/:id/generate', async (req, res) => {
  try {
    const { date } = req.body;
    const [template] = await db.select().from(recurringTaskTemplates).where(eq(recurringTaskTemplates.id, req.params.id));
    if (!template) return res.status(404).json({ error: 'Template not found' });
    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : new Date().toISOString().split('T')[0];
    const [instance] = await db.insert(recurringTaskInstances).values({
      templateId: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      priority: template.priority,
      location: template.location,
      latitude: template.latitude,
      longitude: template.longitude,
      pastureId: template.pastureId,
      assignedTo: template.assignedTo,
      scheduledDate: targetDate,
      scheduledTime: template.recurrenceTime,
      scheduledEndTime: template.recurrenceEndTime,
      status: 'pending',
      checklistItems: template.checklistItems?.map(item => ({ ...item, completed: false })),
      estimatedDuration: template.estimatedDuration,
      occurrenceNumber: (template.totalGenerated ?? 0) + 1,
    } as any).returning();
    await db.update(recurringTaskTemplates)
      .set({ totalGenerated: sql`COALESCE(${recurringTaskTemplates.totalGenerated}, 0) + 1`, lastGeneratedDate: targetDate, updatedAt: new Date() })
      .where(eq(recurringTaskTemplates.id, template.id));
    res.status(201).json(instance);
  } catch (error) {
    console.error('Error generating task:', error);
    res.status(500).json({ error: 'Failed to generate task' });
  }
});

export default router;
