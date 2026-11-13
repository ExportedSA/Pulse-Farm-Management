/**
 * Equipment maintenance API (mounted at /api/equipment behind requireAuth).
 * Equipment records themselves are managed through /api/farm-equipment; this router
 * serves the farm's equipment list, recurring maintenance schedules and service history.
 */
import { Router } from 'express';
import { z } from 'zod';
import { addMonths, addWeeks, addYears, format, differenceInCalendarDays } from 'date-fns';
import { db } from '../db';
import { equipment, equipmentMaintenanceSchedules, equipmentServiceHistory, users } from '@shared/schema';
import { and, asc, desc, eq } from 'drizzle-orm';
import { getFarmId, getUserId, requireFarm } from '../middleware/auth';

const router = Router();
router.use(requireFarm);

const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
type Frequency = typeof FREQUENCIES[number];

const DUE_SOON_DAYS = 7;

function nextDueAfter(date: Date, frequency: Frequency): Date {
  switch (frequency) {
    case 'weekly': return addWeeks(date, 1);
    case 'monthly': return addMonths(date, 1);
    case 'quarterly': return addMonths(date, 3);
    case 'yearly': return addYears(date, 1);
  }
}

function scheduleStatus(nextDue: string): 'overdue' | 'due-soon' | 'scheduled' {
  const days = differenceInCalendarDays(new Date(nextDue), new Date());
  if (days < 0) return 'overdue';
  if (days <= DUE_SOON_DAYS) return 'due-soon';
  return 'scheduled';
}

const scheduleSchema = z.object({
  equipmentId: z.string().uuid(),
  maintenanceType: z.string().min(1).max(100),
  frequency: z.enum(FREQUENCIES),
  nextDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  // The form sends "" when no cost is entered
  estimatedCost: z.union([z.number(), z.string()]).optional()
    .transform(v => (v === undefined || v === '' ? undefined : Number(v)))
    .refine(v => v === undefined || (Number.isFinite(v) && v >= 0), 'Must be a positive number'),
  notes: z.string().optional(),
});

// GET /api/equipment - The farm's active equipment (for pickers and filters)
router.get('/', async (req, res) => {
  try {
    const items = await db
      .select({
        id: equipment.id,
        name: equipment.name,
        type: equipment.type,
        status: equipment.status,
        location: equipment.location,
        lastServiceDate: equipment.lastServiceDate,
        nextServiceDue: equipment.nextServiceDue,
      })
      .from(equipment)
      .where(and(eq(equipment.farmId, getFarmId(req)!), eq(equipment.isActive, true)))
      .orderBy(asc(equipment.name));
    res.json(items);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

// GET /api/equipment/maintenance - Recurring schedules with computed status
router.get('/maintenance', async (req, res) => {
  try {
    const rows = await db
      .select({ schedule: equipmentMaintenanceSchedules, equipmentName: equipment.name })
      .from(equipmentMaintenanceSchedules)
      .innerJoin(equipment, eq(equipmentMaintenanceSchedules.equipmentId, equipment.id))
      .where(and(
        eq(equipmentMaintenanceSchedules.farmId, getFarmId(req)!),
        eq(equipmentMaintenanceSchedules.isActive, true),
      ))
      .orderBy(asc(equipmentMaintenanceSchedules.nextDue));

    res.json(rows.map(({ schedule, equipmentName }) => ({
      id: schedule.id,
      equipmentId: schedule.equipmentId,
      equipmentName,
      maintenanceType: schedule.maintenanceType,
      frequency: schedule.frequency,
      lastCompleted: schedule.lastCompleted ?? undefined,
      nextDue: schedule.nextDue,
      status: scheduleStatus(schedule.nextDue),
      priority: schedule.priority,
      estimatedCost: schedule.estimatedCost != null ? Number(schedule.estimatedCost) : undefined,
      notes: schedule.notes ?? undefined,
    })));
  } catch (error) {
    console.error('Error fetching maintenance schedules:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance schedules' });
  }
});

// POST /api/equipment/maintenance - Create a schedule for one of the farm's machines
router.post('/maintenance', async (req, res) => {
  try {
    const data = scheduleSchema.parse(req.body);
    const farmId = getFarmId(req)!;

    const [item] = await db
      .select({ id: equipment.id })
      .from(equipment)
      .where(and(eq(equipment.id, data.equipmentId), eq(equipment.farmId, farmId)));
    if (!item) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const [schedule] = await db
      .insert(equipmentMaintenanceSchedules)
      .values({
        farmId,
        equipmentId: data.equipmentId,
        maintenanceType: data.maintenanceType,
        frequency: data.frequency,
        nextDue: data.nextDue,
        priority: data.priority,
        estimatedCost: data.estimatedCost?.toFixed(2),
        notes: data.notes || null,
      })
      .returning();
    res.status(201).json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to create maintenance schedule' });
  }
});

// POST /api/equipment/maintenance/:id/complete - Log the service and roll the schedule forward
router.post('/maintenance/:id/complete', async (req, res) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id);
    const farmId = getFarmId(req)!;
    const [schedule] = id.success
      ? await db
          .select()
          .from(equipmentMaintenanceSchedules)
          .where(and(eq(equipmentMaintenanceSchedules.id, id.data), eq(equipmentMaintenanceSchedules.farmId, farmId)))
      : [];
    if (!schedule) {
      return res.status(404).json({ error: 'Maintenance schedule not found' });
    }

    const body = z.object({
      cost: z.number().nonnegative().optional(),
      notes: z.string().optional(),
    }).parse(req.body ?? {});

    const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, getUserId(req)!));
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const nextDue = format(nextDueAfter(today, schedule.frequency as Frequency), 'yyyy-MM-dd');
    const cost = body.cost ?? (schedule.estimatedCost != null ? Number(schedule.estimatedCost) : undefined);

    const updated = await db.transaction(async (tx) => {
      await tx.insert(equipmentServiceHistory).values({
        equipmentId: schedule.equipmentId,
        serviceDate: todayStr,
        serviceType: schedule.maintenanceType,
        description: `Scheduled ${schedule.frequency} maintenance`,
        cost: cost?.toFixed(2),
        performedBy: user?.name,
        nextServiceDue: nextDue,
        notes: body.notes ?? schedule.notes,
      });
      await tx
        .update(equipment)
        .set({ lastServiceDate: todayStr, nextServiceDue: nextDue, updatedAt: today })
        .where(eq(equipment.id, schedule.equipmentId));
      const [row] = await tx
        .update(equipmentMaintenanceSchedules)
        .set({ lastCompleted: todayStr, nextDue, updatedAt: today })
        .where(eq(equipmentMaintenanceSchedules.id, schedule.id))
        .returning();
      return row;
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error completing maintenance:', error);
    res.status(500).json({ error: 'Failed to complete maintenance' });
  }
});

// GET /api/equipment/service-history - All service records for the farm's equipment
router.get('/service-history', async (req, res) => {
  try {
    const rows = await db
      .select({ record: equipmentServiceHistory, equipmentName: equipment.name })
      .from(equipmentServiceHistory)
      .innerJoin(equipment, eq(equipmentServiceHistory.equipmentId, equipment.id))
      .where(eq(equipment.farmId, getFarmId(req)!))
      .orderBy(desc(equipmentServiceHistory.serviceDate));

    res.json(rows.map(({ record, equipmentName }) => ({
      id: record.id,
      equipmentId: record.equipmentId,
      equipmentName,
      serviceType: record.serviceType,
      serviceDate: record.serviceDate,
      performedBy: record.performedBy ?? '',
      cost: record.cost != null ? Number(record.cost) : 0,
      description: record.description ?? '',
      nextServiceDue: record.nextServiceDue ?? undefined,
      status: 'completed' as const,
    })));
  } catch (error) {
    console.error('Error fetching service history:', error);
    res.status(500).json({ error: 'Failed to fetch service history' });
  }
});

export default router;
