import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { 
  animals, 
  animalHealthRecords, 
  timesheets, 
  staffProfiles, 
  users,
  farmHazards,
  equipment,
  equipmentServiceHistory,
  tasks,
} from '@shared/schema';
import { eq, and, gte, lte, sql, desc, count, sum, inArray } from 'drizzle-orm';
import logger from '../config/logger';

const router = Router();

// Manager roles allowed to access reports
const REPORT_ALLOWED_ROLES = ['owner', 'manager', 'admin'];

/**
 * Check if user has permission to access reports
 */
function canAccessReports(userRole: string | undefined): boolean {
  if (!userRole) return false;
  return REPORT_ALLOWED_ROLES.includes(userRole.toLowerCase());
}

/**
 * GET /api/reports/animal-inventory
 * Returns overview of the herd with counts by breed/category
 * 
 * Response: {
 *   total: number,
 *   byBreed: { [breed: string]: number },
 *   byStatus: { [status: string]: number },
 *   animals: Array<{ id, visualTag, name, breed, dateOfBirth, status, sex }>
 * }
 */
router.get('/api/reports/animal-inventory', requireAuth, async (req: Request, res: Response) => {
  try {
    const farmId = (req.user as any).farmId;
    const userRole = (req.user as any).role;

    if (!canAccessReports(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to access reports' });
    }

    // Get all animals for the farm
    const allAnimals = await db
      .select({
        id: animals.id,
        visualTag: animals.visualId,
        name: animals.name,
        breed: animals.breed,
        dateOfBirth: animals.dateOfBirth,
        status: animals.status,
        sex: animals.sex,
      })
      .from(animals)
      .where(eq(animals.farmId, farmId))
      .orderBy(animals.visualId);

    // Group by breed
    const byBreed: Record<string, number> = {};
    for (const animal of allAnimals) {
      const breed = animal.breed || 'Unknown';
      byBreed[breed] = (byBreed[breed] || 0) + 1;
    }

    // Group by status
    const byStatus: Record<string, number> = {};
    for (const animal of allAnimals) {
      const status = animal.status || 'unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

    // Calculate ages
    const animalsWithAge = allAnimals.map(animal => {
      let ageMonths: number | null = null;
      if (animal.dateOfBirth) {
        const dob = new Date(animal.dateOfBirth);
        const now = new Date();
        ageMonths = Math.floor((now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30));
      }
      return {
        ...animal,
        ageMonths,
      };
    });

    res.json({
      total: allAnimals.length,
      byBreed,
      byStatus,
      animals: animalsWithAge,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate animal inventory report');
    res.status(500).json({ error: 'Failed to generate animal inventory report' });
  }
});

/**
 * GET /api/reports/health-records
 * Returns health records within a date range
 * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD)
 * 
 * Response: {
 *   total: number,
 *   byType: { [type: string]: number },
 *   records: Array<{ id, animalId, animalTag, recordDate, recordType, description, ... }>
 * }
 */
router.get('/api/reports/health-records', requireAuth, async (req: Request, res: Response) => {
  try {
    const farmId = (req.user as any).farmId;
    const userRole = (req.user as any).role;

    if (!canAccessReports(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to access reports' });
    }

    // Parse date range (default to last 30 days)
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const fromDate = req.query.from ? String(req.query.from) : defaultFrom.toISOString().split('T')[0];
    const toDate = req.query.to ? String(req.query.to) : now.toISOString().split('T')[0];

    // Get health records with animal info
    // Schema uses 'date' and 'type' instead of 'recordDate' and 'recordType'
    const records = await db
      .select({
        id: animalHealthRecords.id,
        animalId: animalHealthRecords.animalId,
        animalTag: animals.visualId,
        animalName: animals.name,
        recordDate: animalHealthRecords.date,
        recordType: animalHealthRecords.type,
        description: animalHealthRecords.description,
        notes: animalHealthRecords.notes,
        createdAt: animalHealthRecords.createdAt,
      })
      .from(animalHealthRecords)
      .innerJoin(animals, eq(animalHealthRecords.animalId, animals.id))
      .where(
        and(
          eq(animals.farmId, farmId),
          gte(animalHealthRecords.date, fromDate),
          lte(animalHealthRecords.date, toDate)
        )
      )
      .orderBy(desc(animalHealthRecords.date));

    // Group by type
    const byType: Record<string, number> = {};
    for (const record of records) {
      const type = record.recordType || 'other';
      byType[type] = (byType[type] || 0) + 1;
    }

    res.json({
      total: records.length,
      byType,
      dateRange: { from: fromDate, to: toDate },
      records,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate health records report');
    res.status(500).json({ error: 'Failed to generate health records report' });
  }
});

/**
 * GET /api/reports/timesheet-summary
 * Returns hours worked per staff member within a date range
 * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD)
 * 
 * Response: {
 *   totalHours: number,
 *   totalEntries: number,
 *   byStaff: Array<{ staffId, staffName, totalHours, entries }>
 * }
 */
router.get('/api/reports/timesheet-summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const farmId = (req.user as any).farmId;
    const userRole = (req.user as any).role;

    if (!canAccessReports(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to access reports' });
    }

    // Parse date range (default to last 30 days)
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const fromDate = req.query.from ? String(req.query.from) : defaultFrom.toISOString().split('T')[0];
    const toDate = req.query.to ? String(req.query.to) : now.toISOString().split('T')[0];

    // Get timesheet entries with staff info
    const entries = await db
      .select({
        id: timesheets.id,
        staffProfileId: timesheets.staffProfileId,
        staffName: users.name,
        date: timesheets.date,
        startTime: timesheets.startTime,
        endTime: timesheets.endTime,
        totalHours: timesheets.totalHours,
        status: timesheets.status,
        notes: timesheets.notes,
      })
      .from(timesheets)
      .innerJoin(staffProfiles, eq(timesheets.staffProfileId, staffProfiles.id))
      .innerJoin(users, eq(staffProfiles.userId, users.id))
      .where(
        and(
          eq(timesheets.farmId, farmId),
          gte(timesheets.date, fromDate),
          lte(timesheets.date, toDate)
        )
      )
      .orderBy(desc(timesheets.date));

    // Aggregate by staff
    const staffMap = new Map<string, {
      staffId: string;
      staffName: string;
      totalHours: number;
      entries: number;
    }>();

    let totalHoursSum = 0;
    for (const entry of entries) {
      const hours = entry.totalHours ? parseFloat(entry.totalHours) : 0;
      totalHoursSum += hours;

      const existing = staffMap.get(entry.staffProfileId);
      if (existing) {
        existing.totalHours += hours;
        existing.entries += 1;
      } else {
        staffMap.set(entry.staffProfileId, {
          staffId: entry.staffProfileId,
          staffName: entry.staffName || 'Unknown',
          totalHours: hours,
          entries: 1,
        });
      }
    }

    // Convert to array and sort by hours
    const byStaff = Array.from(staffMap.values())
      .map(s => ({ ...s, totalHours: parseFloat(s.totalHours.toFixed(2)) }))
      .sort((a, b) => b.totalHours - a.totalHours);

    res.json({
      totalHours: parseFloat(totalHoursSum.toFixed(2)),
      totalEntries: entries.length,
      dateRange: { from: fromDate, to: toDate },
      byStaff,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate timesheet summary report');
    res.status(500).json({ error: 'Failed to generate timesheet summary report' });
  }
});

/**
 * GET /api/reports/safety
 * Returns safety compliance summary including hazards, incidents, and training
 * 
 * Response: {
 *   hazards: { open, resolved, byRiskLevel },
 *   tasks: { pending, completed, overdue },
 *   equipment: { total, needingService, operational },
 *   recentHazards: Array<hazard>
 * }
 */
router.get('/api/reports/safety', requireAuth, async (req: Request, res: Response) => {
  try {
    const farmId = (req.user as any).farmId;
    const userRole = (req.user as any).role;

    if (!canAccessReports(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to access reports' });
    }

    // Get the farm's hazard counts (farmHazards uses createdAt, not identifiedAt)
    const allHazards = await db
      .select({
        id: farmHazards.id,
        title: farmHazards.title,
        status: farmHazards.status,
        riskLevel: farmHazards.riskLevel,
        severity: farmHazards.severity,
        createdAt: farmHazards.createdAt,
        location: farmHazards.location,
      })
      .from(farmHazards)
      .where(eq(farmHazards.farmId, farmId))
      .orderBy(desc(farmHazards.createdAt));

    const openHazards = allHazards.filter(h => 
      h.status === 'active' || h.status === 'monitoring'
    );
    const resolvedHazards = allHazards.filter(h => 
      h.status === 'resolved'
    );

    // Group hazards by risk level
    const byRiskLevel: Record<string, number> = {};
    for (const hazard of openHazards) {
      const level = hazard.riskLevel || 'unknown';
      byRiskLevel[level] = (byRiskLevel[level] || 0) + 1;
    }

    // Get task counts (tasks table doesn't have category column)
    const allTasks = await db
      .select({
        id: tasks.id,
        status: tasks.status,
        dueDate: tasks.dueDate,
        title: tasks.title,
      })
      .from(tasks)
      .where(eq(tasks.farmId, farmId));

    // Filter by title containing safety-related keywords
    const safetyTasks = allTasks.filter(t => 
      t.title?.toLowerCase().includes('safety') || 
      t.title?.toLowerCase().includes('maintenance') ||
      t.title?.toLowerCase().includes('hazard')
    );
    const pendingTasks = safetyTasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
    const completedTasks = safetyTasks.filter(t => t.status === 'done');
    const overdueTasks = pendingTasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < new Date()
    );

    // Get equipment status
    const allEquipment = await db
      .select({
        id: equipment.id,
        name: equipment.name,
        status: equipment.status,
        nextServiceDue: equipment.nextServiceDue,
      })
      .from(equipment)
      .where(and(eq(equipment.farmId, farmId), eq(equipment.isActive, true)));

    const today = new Date().toISOString().split('T')[0];
    const equipmentNeedingService = allEquipment.filter(e => 
      e.status === 'maintenance_due' || 
      e.status === 'in_maintenance' ||
      (e.nextServiceDue && e.nextServiceDue < today)
    );
    const operationalEquipment = allEquipment.filter(e => e.status === 'operational');

    // Get recent hazards (last 10)
    const recentHazards = allHazards.slice(0, 10);

    res.json({
      hazards: {
        total: allHazards.length,
        open: openHazards.length,
        resolved: resolvedHazards.length,
        byRiskLevel,
      },
      tasks: {
        total: safetyTasks.length,
        pending: pendingTasks.length,
        completed: completedTasks.length,
        overdue: overdueTasks.length,
      },
      equipment: {
        total: allEquipment.length,
        needingService: equipmentNeedingService.length,
        operational: operationalEquipment.length,
        outOfService: allEquipment.filter(e => e.status === 'out_of_service').length,
      },
      recentHazards,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate safety report');
    res.status(500).json({ error: 'Failed to generate safety report' });
  }
});

/**
 * GET /api/reports/equipment-maintenance
 * Returns equipment maintenance history and status
 * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD)
 * 
 * Response: {
 *   equipment: Array<{ id, name, status, lastService, nextService }>,
 *   maintenanceRecords: Array<{ equipmentName, serviceDate, serviceType, cost }>,
 *   totalMaintenanceCost: number
 * }
 */
router.get('/api/reports/equipment-maintenance', requireAuth, async (req: Request, res: Response) => {
  try {
    const farmId = (req.user as any).farmId;
    const userRole = (req.user as any).role;

    if (!canAccessReports(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to access reports' });
    }

    // Parse date range (default to last 90 days)
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    const fromDate = req.query.from ? String(req.query.from) : defaultFrom.toISOString().split('T')[0];
    const toDate = req.query.to ? String(req.query.to) : now.toISOString().split('T')[0];

    // Get all equipment
    const allEquipment = await db
      .select({
        id: equipment.id,
        name: equipment.name,
        type: equipment.type,
        status: equipment.status,
        lastServiceDate: equipment.lastServiceDate,
        nextServiceDue: equipment.nextServiceDue,
        location: equipment.location,
      })
      .from(equipment)
      .where(and(eq(equipment.farmId, farmId), eq(equipment.isActive, true)))
      .orderBy(equipment.name);

    // Get maintenance records in date range
    const maintenanceRecords = await db
      .select({
        id: equipmentServiceHistory.id,
        equipmentId: equipmentServiceHistory.equipmentId,
        equipmentName: equipment.name,
        serviceDate: equipmentServiceHistory.serviceDate,
        serviceType: equipmentServiceHistory.serviceType,
        description: equipmentServiceHistory.description,
        cost: equipmentServiceHistory.cost,
        performedBy: equipmentServiceHistory.performedBy,
      })
      .from(equipmentServiceHistory)
      .innerJoin(equipment, eq(equipmentServiceHistory.equipmentId, equipment.id))
      .where(
        and(
          eq(equipment.farmId, farmId),
          gte(equipmentServiceHistory.serviceDate, fromDate),
          lte(equipmentServiceHistory.serviceDate, toDate)
        )
      )
      .orderBy(desc(equipmentServiceHistory.serviceDate));

    // Calculate total maintenance cost
    let totalCost = 0;
    for (const record of maintenanceRecords) {
      if (record.cost) {
        totalCost += parseFloat(record.cost);
      }
    }

    // Group by service type
    const byServiceType: Record<string, number> = {};
    for (const record of maintenanceRecords) {
      const type = record.serviceType || 'other';
      byServiceType[type] = (byServiceType[type] || 0) + 1;
    }

    res.json({
      equipment: allEquipment,
      maintenanceRecords,
      summary: {
        totalEquipment: allEquipment.length,
        totalMaintenanceRecords: maintenanceRecords.length,
        totalMaintenanceCost: totalCost.toFixed(2),
        byServiceType,
      },
      dateRange: { from: fromDate, to: toDate },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to generate equipment maintenance report');
    res.status(500).json({ error: 'Failed to generate equipment maintenance report' });
  }
});

export default router;
