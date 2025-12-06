import { Router } from 'express';
import { db } from '../db';
import { 
  recurringTaskTemplates, 
  recurringTaskInstances,
  users 
} from '../../shared/schema';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Mock users for demo
const mockUsers: Record<string, { id: string; name: string; email: string; role: string }> = {
  'user-1': { id: 'user-1', name: 'John Smith', email: 'john@pulse.farm', role: 'Farm Manager' },
  'user-2': { id: 'user-2', name: 'Sarah Johnson', email: 'sarah@pulse.farm', role: 'Stock Handler' },
  'user-3': { id: 'user-3', name: 'Mike Wilson', email: 'mike@pulse.farm', role: 'Seasonal Worker' },
  'user-4': { id: 'user-4', name: 'Emily Brown', email: 'emily@pulse.farm', role: 'Veterinarian' },
};

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

// Mock recurring task templates
const mockTemplates = [
  {
    id: 'template-1',
    farmId: null,
    title: 'Morning Feed - All Paddocks',
    description: 'Distribute hay and supplements to all cattle paddocks',
    category: 'feeding',
    priority: 'high',
    estimatedDuration: 90,
    location: 'All Paddocks',
    latitude: null,
    longitude: null,
    pastureId: null,
    assignedTo: ['user-2', 'user-3'],
    recurrenceType: 'daily',
    recurrenceInterval: 1,
    recurrenceDays: null,
    recurrenceTime: '06:00',
    recurrenceEndTime: '08:00',
    startDate: '2024-01-01',
    endDate: null,
    maxOccurrences: null,
    checklistItems: [
      { id: 'c1', text: 'Check hay stock levels', required: true },
      { id: 'c2', text: 'Fill water troughs', required: true },
      { id: 'c3', text: 'Distribute supplements', required: false },
      { id: 'c4', text: 'Check for sick animals', required: true },
    ],
    weatherSensitive: false,
    skipIfRaining: false,
    minTemperature: null,
    maxTemperature: null,
    isActive: true,
    lastGeneratedDate: new Date().toISOString().split('T')[0],
    totalGenerated: 45,
    createdBy: 'user-1',
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'template-2',
    farmId: null,
    title: 'Afternoon Milking',
    description: 'Afternoon milking session for dairy herd',
    category: 'milking',
    priority: 'urgent',
    estimatedDuration: 120,
    location: 'Dairy Shed',
    latitude: '-40.9010',
    longitude: '175.6470',
    pastureId: null,
    assignedTo: ['user-2'],
    recurrenceType: 'daily',
    recurrenceInterval: 1,
    recurrenceDays: null,
    recurrenceTime: '15:00',
    recurrenceEndTime: '17:00',
    startDate: '2024-01-01',
    endDate: null,
    maxOccurrences: null,
    checklistItems: [
      { id: 'c1', text: 'Sanitize milking equipment', required: true },
      { id: 'c2', text: 'Bring cows to shed', required: true },
      { id: 'c3', text: 'Complete milking', required: true },
      { id: 'c4', text: 'Record milk volume', required: true },
      { id: 'c5', text: 'Clean and store equipment', required: true },
    ],
    weatherSensitive: false,
    skipIfRaining: false,
    minTemperature: null,
    maxTemperature: null,
    isActive: true,
    lastGeneratedDate: new Date().toISOString().split('T')[0],
    totalGenerated: 45,
    createdBy: 'user-1',
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'template-3',
    farmId: null,
    title: 'Weekly Fence Inspection',
    description: 'Inspect all boundary and internal fences for damage',
    category: 'fencing',
    priority: 'medium',
    estimatedDuration: 180,
    location: 'Farm Perimeter',
    latitude: null,
    longitude: null,
    pastureId: null,
    assignedTo: ['user-3'],
    recurrenceType: 'weekly',
    recurrenceInterval: 1,
    recurrenceDays: [1], // Monday
    recurrenceTime: '09:00',
    recurrenceEndTime: '12:00',
    startDate: '2024-01-01',
    endDate: null,
    maxOccurrences: null,
    checklistItems: [
      { id: 'c1', text: 'Check North boundary', required: true },
      { id: 'c2', text: 'Check South boundary', required: true },
      { id: 'c3', text: 'Check East boundary', required: true },
      { id: 'c4', text: 'Check West boundary', required: true },
      { id: 'c5', text: 'Inspect internal paddock fences', required: true },
      { id: 'c6', text: 'Report any damage found', required: false },
    ],
    weatherSensitive: true,
    skipIfRaining: true,
    minTemperature: null,
    maxTemperature: null,
    isActive: true,
    lastGeneratedDate: new Date().toISOString().split('T')[0],
    totalGenerated: 7,
    createdBy: 'user-1',
    createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'template-4',
    farmId: null,
    title: 'Monthly Equipment Service',
    description: 'Routine maintenance check on all farm equipment',
    category: 'equipment',
    priority: 'medium',
    estimatedDuration: 240,
    location: 'Equipment Shed',
    latitude: null,
    longitude: null,
    pastureId: null,
    assignedTo: ['user-3', 'user-1'],
    recurrenceType: 'monthly',
    recurrenceInterval: 1,
    recurrenceDays: [1], // 1st of month
    recurrenceTime: '08:00',
    recurrenceEndTime: '12:00',
    startDate: '2024-01-01',
    endDate: null,
    maxOccurrences: null,
    checklistItems: [
      { id: 'c1', text: 'Check tractor oil levels', required: true },
      { id: 'c2', text: 'Inspect ATV condition', required: true },
      { id: 'c3', text: 'Test all power tools', required: true },
      { id: 'c4', text: 'Check fuel supplies', required: true },
      { id: 'c5', text: 'Update maintenance log', required: true },
    ],
    weatherSensitive: false,
    skipIfRaining: false,
    minTemperature: null,
    maxTemperature: null,
    isActive: true,
    lastGeneratedDate: new Date().toISOString().split('T')[0],
    totalGenerated: 2,
    createdBy: 'user-1',
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'template-5',
    farmId: null,
    title: 'Water Trough Check',
    description: 'Check and clean all water troughs across paddocks',
    category: 'water',
    priority: 'high',
    estimatedDuration: 60,
    location: 'All Paddocks',
    latitude: null,
    longitude: null,
    pastureId: null,
    assignedTo: ['user-2'],
    recurrenceType: 'weekly',
    recurrenceInterval: 1,
    recurrenceDays: [1, 4], // Monday and Thursday
    recurrenceTime: '14:00',
    recurrenceEndTime: '15:00',
    startDate: '2024-01-01',
    endDate: null,
    maxOccurrences: null,
    checklistItems: [
      { id: 'c1', text: 'Check water levels', required: true },
      { id: 'c2', text: 'Clean debris from troughs', required: true },
      { id: 'c3', text: 'Check float valves', required: true },
      { id: 'c4', text: 'Report any leaks', required: false },
    ],
    weatherSensitive: false,
    skipIfRaining: false,
    minTemperature: null,
    maxTemperature: null,
    isActive: true,
    lastGeneratedDate: new Date().toISOString().split('T')[0],
    totalGenerated: 14,
    createdBy: 'user-1',
    createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Generate mock instances for today and upcoming days
function generateMockInstances() {
  const instances: any[] = [];
  const today = new Date();
  
  mockTemplates.forEach((template, templateIndex) => {
    // Generate instances for the past 3 days and next 7 days
    for (let dayOffset = -3; dayOffset <= 7; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      const dayOfMonth = date.getDate();
      
      let shouldGenerate = false;
      
      if (template.recurrenceType === 'daily') {
        shouldGenerate = true;
      } else if (template.recurrenceType === 'weekly' && template.recurrenceDays) {
        shouldGenerate = template.recurrenceDays.includes(dayOfWeek);
      } else if (template.recurrenceType === 'monthly' && template.recurrenceDays) {
        shouldGenerate = template.recurrenceDays.includes(dayOfMonth);
      }
      
      if (shouldGenerate) {
        const isPast = dayOffset < 0;
        const isToday = dayOffset === 0;
        
        let status = 'pending';
        let completedAt = null;
        let startedAt = null;
        
        if (isPast) {
          // Past tasks are mostly completed
          status = Math.random() > 0.1 ? 'completed' : 'skipped';
          if (status === 'completed') {
            completedAt = new Date(date.setHours(parseInt(template.recurrenceEndTime?.split(':')[0] || '17'))).toISOString();
            startedAt = new Date(date.setHours(parseInt(template.recurrenceTime.split(':')[0]))).toISOString();
          }
        } else if (isToday) {
          // Today's tasks might be in progress or pending
          const currentHour = new Date().getHours();
          const taskHour = parseInt(template.recurrenceTime.split(':')[0]);
          if (currentHour >= taskHour + 2) {
            status = Math.random() > 0.3 ? 'completed' : 'in_progress';
            if (status === 'completed') {
              completedAt = new Date().toISOString();
            }
            startedAt = new Date(today.setHours(taskHour)).toISOString();
          } else if (currentHour >= taskHour) {
            status = 'in_progress';
            startedAt = new Date(today.setHours(taskHour)).toISOString();
          }
        }
        
        instances.push({
          id: `instance-${template.id}-${dateStr}`,
          templateId: template.id,
          farmId: null,
          title: template.title,
          description: template.description,
          category: template.category,
          priority: template.priority,
          location: template.location,
          latitude: template.latitude,
          longitude: template.longitude,
          pastureId: null,
          assignedTo: template.assignedTo,
          scheduledDate: dateStr,
          scheduledTime: template.recurrenceTime,
          scheduledEndTime: template.recurrenceEndTime,
          dueDate: new Date(date.setHours(parseInt(template.recurrenceEndTime?.split(':')[0] || '17'))).toISOString(),
          status,
          checklistItems: template.checklistItems?.map(item => ({
            ...item,
            completed: status === 'completed',
            completedAt: status === 'completed' ? completedAt : undefined,
          })),
          startedAt,
          completedAt,
          completedBy: status === 'completed' ? template.assignedTo[0] : null,
          skipReason: status === 'skipped' ? 'Weather conditions' : null,
          estimatedDuration: template.estimatedDuration,
          actualDuration: status === 'completed' ? template.estimatedDuration + Math.floor(Math.random() * 30) - 15 : null,
          notes: null,
          photoUrls: [],
          weatherCondition: null,
          temperature: null,
          occurrenceNumber: Math.abs(dayOffset) + 1,
          createdAt: new Date(date.setDate(date.getDate() - 1)).toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  });
  
  return instances;
}

// Helper to get user names for assigned users
function getAssignedNames(assignedTo: string[]): string[] {
  return assignedTo.map(id => mockUsers[id]?.name || id);
}

// ============================================
// TEMPLATE ENDPOINTS
// ============================================

// Get all recurring task templates
router.get('/templates', async (req, res) => {
  try {
    // Try database first
    try {
      const templates = await db.select().from(recurringTaskTemplates).orderBy(desc(recurringTaskTemplates.createdAt));
      return res.json(templates);
    } catch (dbError) {
      // Return mock data
      const templatesWithNames = mockTemplates.map(t => ({
        ...t,
        assignedToNames: getAssignedNames(t.assignedTo),
      }));
      return res.json(templatesWithNames);
    }
  } catch (error) {
    console.error('Error fetching recurring task templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get single template
router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    try {
      const [template] = await db.select().from(recurringTaskTemplates).where(eq(recurringTaskTemplates.id, id));
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      return res.json(template);
    } catch (dbError) {
      const template = mockTemplates.find(t => t.id === id);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      return res.json({
        ...template,
        assignedToNames: getAssignedNames(template.assignedTo),
      });
    }
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create new recurring task template
router.post('/templates', async (req, res) => {
  try {
    const templateData = req.body;
    
    try {
      const [newTemplate] = await db.insert(recurringTaskTemplates).values({
        ...templateData,
        id: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      
      return res.status(201).json(newTemplate);
    } catch (dbError) {
      // Mock creation
      const newTemplate = {
        id: `template-${Date.now()}`,
        ...templateData,
        isActive: true,
        lastGeneratedDate: null,
        totalGenerated: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignedToNames: getAssignedNames(templateData.assignedTo || []),
      };
      mockTemplates.push(newTemplate);
      return res.status(201).json(newTemplate);
    }
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
    
    try {
      const [updated] = await db.update(recurringTaskTemplates)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(recurringTaskTemplates.id, id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: 'Template not found' });
      }
      return res.json(updated);
    } catch (dbError) {
      const index = mockTemplates.findIndex(t => t.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Template not found' });
      }
      mockTemplates[index] = {
        ...mockTemplates[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      return res.json({
        ...mockTemplates[index],
        assignedToNames: getAssignedNames(mockTemplates[index].assignedTo),
      });
    }
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Toggle template active status
router.post('/templates/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    
    try {
      const [template] = await db.select().from(recurringTaskTemplates).where(eq(recurringTaskTemplates.id, id));
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      const [updated] = await db.update(recurringTaskTemplates)
        .set({ isActive: !template.isActive, updatedAt: new Date() })
        .where(eq(recurringTaskTemplates.id, id))
        .returning();
      
      return res.json(updated);
    } catch (dbError) {
      const index = mockTemplates.findIndex(t => t.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Template not found' });
      }
      mockTemplates[index].isActive = !mockTemplates[index].isActive;
      mockTemplates[index].updatedAt = new Date().toISOString();
      return res.json({
        ...mockTemplates[index],
        assignedToNames: getAssignedNames(mockTemplates[index].assignedTo),
      });
    }
  } catch (error) {
    console.error('Error toggling template:', error);
    res.status(500).json({ error: 'Failed to toggle template' });
  }
});

// Delete template
router.delete('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    try {
      await db.delete(recurringTaskTemplates).where(eq(recurringTaskTemplates.id, id));
      return res.json({ success: true });
    } catch (dbError) {
      const index = mockTemplates.findIndex(t => t.id === id);
      if (index !== -1) {
        mockTemplates.splice(index, 1);
      }
      return res.json({ success: true });
    }
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
    
    try {
      let query = db.select().from(recurringTaskInstances);
      
      // Add filters as needed
      if (date) {
        query = query.where(eq(recurringTaskInstances.scheduledDate, date as string)) as any;
      }
      
      const instances = await query.orderBy(asc(recurringTaskInstances.scheduledDate), asc(recurringTaskInstances.scheduledTime));
      return res.json(instances);
    } catch (dbError) {
      // Return mock instances with filters
      let instances = generateMockInstances();
      
      if (date) {
        instances = instances.filter(i => i.scheduledDate === date);
      }
      if (startDate && endDate) {
        instances = instances.filter(i => i.scheduledDate >= startDate && i.scheduledDate <= endDate);
      }
      if (status && status !== 'all') {
        instances = instances.filter(i => i.status === status);
      }
      if (templateId) {
        instances = instances.filter(i => i.templateId === templateId);
      }
      if (assignedTo) {
        instances = instances.filter(i => i.assignedTo.includes(assignedTo as string));
      }
      
      // Add assigned names
      const instancesWithNames = instances.map(i => ({
        ...i,
        assignedToNames: getAssignedNames(i.assignedTo),
      }));
      
      return res.json(instancesWithNames);
    }
  } catch (error) {
    console.error('Error fetching instances:', error);
    res.status(500).json({ error: 'Failed to fetch instances' });
  }
});

// Get today's tasks
router.get('/instances/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const instances = await db.select()
        .from(recurringTaskInstances)
        .where(eq(recurringTaskInstances.scheduledDate, today))
        .orderBy(asc(recurringTaskInstances.scheduledTime));
      return res.json(instances);
    } catch (dbError) {
      const instances = generateMockInstances()
        .filter(i => i.scheduledDate === today)
        .map(i => ({
          ...i,
          assignedToNames: getAssignedNames(i.assignedTo),
        }));
      return res.json(instances);
    }
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
    
    try {
      const instances = await db.select()
        .from(recurringTaskInstances)
        .where(and(
          gte(recurringTaskInstances.scheduledDate, todayStr),
          lte(recurringTaskInstances.scheduledDate, nextWeekStr)
        ))
        .orderBy(asc(recurringTaskInstances.scheduledDate), asc(recurringTaskInstances.scheduledTime));
      return res.json(instances);
    } catch (dbError) {
      const instances = generateMockInstances()
        .filter(i => i.scheduledDate >= todayStr && i.scheduledDate <= nextWeekStr)
        .map(i => ({
          ...i,
          assignedToNames: getAssignedNames(i.assignedTo),
        }));
      return res.json(instances);
    }
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
    
    try {
      const [updated] = await db.update(recurringTaskInstances)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(recurringTaskInstances.id, id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      return res.json(updated);
    } catch (dbError) {
      // Mock update - in real app this would update the instance
      return res.json({ id, ...updates, updatedAt: new Date().toISOString() });
    }
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
    
    try {
      const [updated] = await db.update(recurringTaskInstances)
        .set(updates)
        .where(eq(recurringTaskInstances.id, id))
        .returning();
      
      return res.json(updated);
    } catch (dbError) {
      return res.json({ id, ...updates });
    }
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
    
    try {
      const [updated] = await db.update(recurringTaskInstances)
        .set(updates)
        .where(eq(recurringTaskInstances.id, id))
        .returning();
      
      return res.json(updated);
    } catch (dbError) {
      return res.json({ id, ...updates });
    }
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
    
    try {
      const [updated] = await db.update(recurringTaskInstances)
        .set(updates)
        .where(eq(recurringTaskInstances.id, id))
        .returning();
      
      return res.json(updated);
    } catch (dbError) {
      return res.json({ id, ...updates });
    }
  } catch (error) {
    console.error('Error skipping task:', error);
    res.status(500).json({ error: 'Failed to skip task' });
  }
});

// Update checklist item
router.patch('/instances/:id/checklist/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { completed, completedBy } = req.body;
    
    // In a real implementation, this would update the specific checklist item
    return res.json({ 
      success: true, 
      itemId, 
      completed, 
      completedAt: completed ? new Date().toISOString() : null,
      completedBy 
    });
  } catch (error) {
    console.error('Error updating checklist:', error);
    res.status(500).json({ error: 'Failed to update checklist' });
  }
});

// ============================================
// STATISTICS ENDPOINTS
// ============================================

// Get recurring task statistics
router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const instances = generateMockInstances();
    const todayInstances = instances.filter(i => i.scheduledDate === today);
    
    const stats = {
      totalTemplates: mockTemplates.length,
      activeTemplates: mockTemplates.filter(t => t.isActive).length,
      todayTasks: todayInstances.length,
      todayCompleted: todayInstances.filter(i => i.status === 'completed').length,
      todayPending: todayInstances.filter(i => i.status === 'pending').length,
      todayInProgress: todayInstances.filter(i => i.status === 'in_progress').length,
      weeklyTasks: instances.filter(i => {
        const d = new Date(i.scheduledDate);
        const now = new Date();
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        return d >= weekAgo;
      }).length,
      completionRate: Math.round(
        (instances.filter(i => i.status === 'completed').length / 
        instances.filter(i => i.scheduledDate < today).length) * 100
      ) || 0,
    };
    
    return res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get categories
router.get('/categories', (req, res) => {
  res.json(TASK_CATEGORIES);
});

// Get available users for assignment
router.get('/users', (req, res) => {
  res.json(Object.values(mockUsers));
});

// ============================================
// TASK GENERATION (would run on schedule)
// ============================================

// Manually trigger task generation for a template
router.post('/templates/:id/generate', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.body; // Optional specific date
    
    const template = mockTemplates.find(t => t.id === id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Generate instance
    const instance = {
      id: `instance-${id}-${targetDate}-${Date.now()}`,
      templateId: id,
      farmId: template.farmId,
      title: template.title,
      description: template.description,
      category: template.category,
      priority: template.priority,
      location: template.location,
      latitude: template.latitude,
      longitude: template.longitude,
      pastureId: template.pastureId,
      assignedTo: template.assignedTo,
      assignedToNames: getAssignedNames(template.assignedTo),
      scheduledDate: targetDate,
      scheduledTime: template.recurrenceTime,
      scheduledEndTime: template.recurrenceEndTime,
      status: 'pending',
      checklistItems: template.checklistItems?.map(item => ({
        ...item,
        completed: false,
      })),
      estimatedDuration: template.estimatedDuration,
      occurrenceNumber: template.totalGenerated + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    return res.status(201).json(instance);
  } catch (error) {
    console.error('Error generating task:', error);
    res.status(500).json({ error: 'Failed to generate task' });
  }
});

export default router;
