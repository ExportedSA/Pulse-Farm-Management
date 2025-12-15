import { db } from '../db';
import { 
  animals, 
  animalHealthRecords,
  equipment,
  equipmentServiceHistory,
  staffProfiles,
  users,
  tasks,
  farmHazards,
} from '@shared/schema';
import { eq, and, lt, gte, isNull, sql, desc, inArray } from 'drizzle-orm';
import { createTask } from './tasks';
import { nanoid } from 'nanoid';
import logger from '../config/logger';

// Constants
const SYSTEM_USER_ID = 'system'; // Used for auto-generated tasks
const AUTO_TASK_PREFIX = '[Auto]';

// Thresholds (in days)
const ANIMAL_HEALTH_CHECK_THRESHOLD_DAYS = 365; // No health record in 1 year
const EQUIPMENT_SERVICE_THRESHOLD_DAYS = 180; // No service in 6 months
const HAZARD_UNRESOLVED_THRESHOLD_DAYS = 30; // Hazard open for 30+ days

// Types
interface ComplianceCheckResult {
  checkType: string;
  itemsChecked: number;
  issuesFound: number;
  tasksCreated: number;
  errors: string[];
}

interface ComplianceRunResult {
  runAt: Date;
  farmId?: string;
  checks: ComplianceCheckResult[];
  totalTasksCreated: number;
  success: boolean;
}

/**
 * Get manager user IDs for a farm to assign tasks to
 */
async function getManagerUserIds(farmId?: string): Promise<string[]> {
  const managers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        inArray(users.role, ['owner', 'manager', 'admin'])
      )
    );
  
  return managers.map(m => m.id);
}

/**
 * Check if an auto-generated task already exists for a specific item
 */
async function autoTaskExists(
  title: string,
  relatedId?: string,
  relatedType?: string
): Promise<boolean> {
  const conditions = [
    sql`${tasks.title} LIKE ${`${AUTO_TASK_PREFIX}%`}`,
    sql`${tasks.title} LIKE ${`%${title}%`}`,
    inArray(tasks.status, ['pending', 'in_progress']),
  ];

  if (relatedId && relatedType === 'animal') {
    conditions.push(eq(tasks.animalId, relatedId));
  }
  if (relatedId && relatedType === 'equipment') {
    conditions.push(eq(tasks.equipmentId, relatedId));
  }

  const existing = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(...conditions))
    .limit(1);

  return existing.length > 0;
}

/**
 * Check animals that haven't had a health record in the threshold period
 */
export async function checkAnimalHealthCompliance(farmId?: string): Promise<ComplianceCheckResult> {
  const result: ComplianceCheckResult = {
    checkType: 'animal_health',
    itemsChecked: 0,
    issuesFound: 0,
    tasksCreated: 0,
    errors: [],
  };

  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - ANIMAL_HEALTH_CHECK_THRESHOLD_DAYS);

    // Get all active animals
    const conditions = [eq(animals.status, 'active')];
    if (farmId) {
      conditions.push(eq(animals.farmId, farmId));
    }

    const activeAnimals = await db
      .select({
        id: animals.id,
        visualTag: animals.visualTag,
        name: animals.name,
        farmId: animals.farmId,
      })
      .from(animals)
      .where(and(...conditions));

    result.itemsChecked = activeAnimals.length;

    // For each animal, check if they have a recent health record
    for (const animal of activeAnimals) {
      const recentHealthRecord = await db
        .select({ id: animalHealthRecords.id })
        .from(animalHealthRecords)
        .where(
          and(
            eq(animalHealthRecords.animalId, animal.id),
            gte(animalHealthRecords.recordDate, thresholdDate.toISOString().split('T')[0])
          )
        )
        .limit(1);

      if (recentHealthRecord.length === 0) {
        result.issuesFound++;

        // Check if task already exists
        const animalName = animal.name || animal.visualTag || animal.id;
        const taskTitle = `Health check due for ${animalName}`;
        
        if (await autoTaskExists(taskTitle, animal.id, 'animal')) {
          continue; // Skip if task already exists
        }

        // Get managers to assign task to
        const managerIds = await getManagerUserIds(animal.farmId);
        const assigneeId = managerIds[0]; // Assign to first manager

        if (assigneeId) {
          try {
            await createTask({
              farmId: animal.farmId,
              title: `${AUTO_TASK_PREFIX} ${taskTitle}`,
              description: `This animal has not had a health record in over ${ANIMAL_HEALTH_CHECK_THRESHOLD_DAYS} days. Please schedule a health check or vet visit.`,
              priority: 'medium',
              status: 'pending',
              category: 'health',
              createdById: assigneeId, // Use manager as creator since we don't have system user
              assignedToId: assigneeId,
              animalId: animal.id,
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Due in 7 days
            });
            result.tasksCreated++;
            logger.info({ animalId: animal.id, animalName }, 'Created health check task for animal');
          } catch (err) {
            result.errors.push(`Failed to create task for animal ${animalName}: ${err}`);
          }
        }
      }
    }
  } catch (error) {
    result.errors.push(`Animal health check failed: ${error}`);
    logger.error({ error }, 'Animal health compliance check failed');
  }

  return result;
}

/**
 * Check equipment that is overdue for service
 */
export async function checkEquipmentMaintenance(farmId?: string): Promise<ComplianceCheckResult> {
  const result: ComplianceCheckResult = {
    checkType: 'equipment_maintenance',
    itemsChecked: 0,
    issuesFound: 0,
    tasksCreated: 0,
    errors: [],
  };

  try {
    const today = new Date().toISOString().split('T')[0];
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - EQUIPMENT_SERVICE_THRESHOLD_DAYS);

    // Get all active equipment
    const conditions = [eq(equipment.isActive, true)];
    if (farmId) {
      conditions.push(eq(equipment.farmId, farmId));
    }

    const activeEquipment = await db
      .select({
        id: equipment.id,
        name: equipment.name,
        type: equipment.type,
        farmId: equipment.farmId,
        lastServiceDate: equipment.lastServiceDate,
        nextServiceDue: equipment.nextServiceDue,
        status: equipment.status,
      })
      .from(equipment)
      .where(and(...conditions));

    result.itemsChecked = activeEquipment.length;

    for (const equip of activeEquipment) {
      let needsService = false;
      let reason = '';

      // Check if next service due date has passed
      if (equip.nextServiceDue && equip.nextServiceDue < today) {
        needsService = true;
        reason = `Service was due on ${equip.nextServiceDue}`;
      }
      // Or if last service was too long ago
      else if (equip.lastServiceDate && equip.lastServiceDate < thresholdDate.toISOString().split('T')[0]) {
        needsService = true;
        reason = `Last service was on ${equip.lastServiceDate} (over ${EQUIPMENT_SERVICE_THRESHOLD_DAYS} days ago)`;
      }
      // Or if never serviced
      else if (!equip.lastServiceDate) {
        needsService = true;
        reason = 'No service record found';
      }

      if (needsService) {
        result.issuesFound++;

        // Check if task already exists
        const taskTitle = `Service due for ${equip.name}`;
        
        if (await autoTaskExists(taskTitle, equip.id, 'equipment')) {
          continue;
        }

        // Get managers to assign task to
        const managerIds = await getManagerUserIds(equip.farmId);
        const assigneeId = managerIds[0];

        if (assigneeId) {
          try {
            await createTask({
              farmId: equip.farmId,
              title: `${AUTO_TASK_PREFIX} ${taskTitle}`,
              description: `${equip.type} "${equip.name}" requires maintenance. ${reason}. Please schedule service.`,
              priority: equip.status === 'maintenance_due' ? 'high' : 'medium',
              status: 'pending',
              category: 'maintenance',
              createdById: assigneeId,
              assignedToId: assigneeId,
              equipmentId: equip.id,
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // Due in 14 days
            });
            result.tasksCreated++;
            logger.info({ equipmentId: equip.id, equipmentName: equip.name }, 'Created maintenance task for equipment');
          } catch (err) {
            result.errors.push(`Failed to create task for equipment ${equip.name}: ${err}`);
          }
        }
      }
    }
  } catch (error) {
    result.errors.push(`Equipment maintenance check failed: ${error}`);
    logger.error({ error }, 'Equipment maintenance compliance check failed');
  }

  return result;
}

/**
 * Check for unresolved hazards that have been open too long
 */
export async function checkUnresolvedHazards(farmId?: string): Promise<ComplianceCheckResult> {
  const result: ComplianceCheckResult = {
    checkType: 'unresolved_hazards',
    itemsChecked: 0,
    issuesFound: 0,
    tasksCreated: 0,
    errors: [],
  };

  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - HAZARD_UNRESOLVED_THRESHOLD_DAYS);

    // Get all open hazards
    const conditions = [
      inArray(farmHazards.status, ['identified', 'under_review']),
      lt(farmHazards.identifiedAt, thresholdDate),
    ];
    if (farmId) {
      conditions.push(eq(farmHazards.farmId, farmId));
    }

    const openHazards = await db
      .select({
        id: farmHazards.id,
        title: farmHazards.title,
        farmId: farmHazards.farmId,
        riskLevel: farmHazards.riskLevel,
        identifiedAt: farmHazards.identifiedAt,
        status: farmHazards.status,
      })
      .from(farmHazards)
      .where(and(...conditions));

    result.itemsChecked = openHazards.length;
    result.issuesFound = openHazards.length;

    for (const hazard of openHazards) {
      // Check if task already exists
      const taskTitle = `Resolve hazard: ${hazard.title}`;
      
      if (await autoTaskExists(taskTitle)) {
        continue;
      }

      // Get managers to assign task to
      const managerIds = await getManagerUserIds(hazard.farmId);
      const assigneeId = managerIds[0];

      if (assigneeId) {
        try {
          const daysOpen = Math.floor((Date.now() - new Date(hazard.identifiedAt).getTime()) / (1000 * 60 * 60 * 24));
          
          await createTask({
            farmId: hazard.farmId,
            title: `${AUTO_TASK_PREFIX} ${taskTitle}`,
            description: `This hazard has been open for ${daysOpen} days. Risk level: ${hazard.riskLevel}. Please take action to resolve or mitigate.`,
            priority: hazard.riskLevel === 'critical' || hazard.riskLevel === 'high' ? 'urgent' : 'high',
            status: 'pending',
            category: 'safety',
            createdById: assigneeId,
            assignedToId: assigneeId,
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // Due in 3 days for safety
          });
          result.tasksCreated++;
          logger.info({ hazardId: hazard.id, hazardTitle: hazard.title }, 'Created task for unresolved hazard');
        } catch (err) {
          result.errors.push(`Failed to create task for hazard ${hazard.title}: ${err}`);
        }
      }
    }
  } catch (error) {
    result.errors.push(`Unresolved hazards check failed: ${error}`);
    logger.error({ error }, 'Unresolved hazards compliance check failed');
  }

  return result;
}

/**
 * Check for staff without required training/induction
 * This is a placeholder - would need actual induction module tracking
 */
export async function checkStaffTrainingCompliance(farmId?: string): Promise<ComplianceCheckResult> {
  const result: ComplianceCheckResult = {
    checkType: 'staff_training',
    itemsChecked: 0,
    issuesFound: 0,
    tasksCreated: 0,
    errors: [],
  };

  try {
    // Get all active staff profiles
    const conditions = [eq(staffProfiles.isActive, true)];
    if (farmId) {
      conditions.push(eq(staffProfiles.farmId, farmId));
    }

    const activeStaff = await db
      .select({
        id: staffProfiles.id,
        userId: staffProfiles.userId,
        farmId: staffProfiles.farmId,
        startDate: staffProfiles.startDate,
      })
      .from(staffProfiles)
      .where(and(...conditions));

    result.itemsChecked = activeStaff.length;

    // For now, check if staff started within last 30 days and might need induction
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const staff of activeStaff) {
      if (staff.startDate && new Date(staff.startDate) > thirtyDaysAgo) {
        // New staff - check if induction task exists
        const taskTitle = `Complete induction for new staff`;
        
        if (await autoTaskExists(taskTitle)) {
          continue;
        }

        result.issuesFound++;

        // Get user details
        const [userDetails] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, staff.userId))
          .limit(1);

        const staffName = userDetails?.name || 'New Staff Member';

        // Get managers to assign task to
        const managerIds = await getManagerUserIds(staff.farmId);
        const assigneeId = managerIds[0];

        if (assigneeId) {
          try {
            await createTask({
              farmId: staff.farmId,
              title: `${AUTO_TASK_PREFIX} Complete induction for ${staffName}`,
              description: `New staff member ${staffName} started recently. Please ensure all required induction modules are completed including health & safety training.`,
              priority: 'high',
              status: 'pending',
              category: 'training',
              createdById: assigneeId,
              assignedToId: staff.userId, // Assign to the staff member
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Due in 7 days
            });
            result.tasksCreated++;
            logger.info({ staffId: staff.id, staffName }, 'Created induction task for new staff');
          } catch (err) {
            result.errors.push(`Failed to create task for staff ${staffName}: ${err}`);
          }
        }
      }
    }
  } catch (error) {
    result.errors.push(`Staff training check failed: ${error}`);
    logger.error({ error }, 'Staff training compliance check failed');
  }

  return result;
}

/**
 * Main function to run all compliance checks
 */
export async function runComplianceChecks(farmId?: string): Promise<ComplianceRunResult> {
  const runResult: ComplianceRunResult = {
    runAt: new Date(),
    farmId,
    checks: [],
    totalTasksCreated: 0,
    success: true,
  };

  logger.info({ farmId }, 'Starting compliance checks run');

  try {
    // Run all compliance checks
    const animalHealthResult = await checkAnimalHealthCompliance(farmId);
    runResult.checks.push(animalHealthResult);

    const equipmentResult = await checkEquipmentMaintenance(farmId);
    runResult.checks.push(equipmentResult);

    const hazardsResult = await checkUnresolvedHazards(farmId);
    runResult.checks.push(hazardsResult);

    const staffTrainingResult = await checkStaffTrainingCompliance(farmId);
    runResult.checks.push(staffTrainingResult);

    // Calculate totals
    runResult.totalTasksCreated = runResult.checks.reduce((sum, check) => sum + check.tasksCreated, 0);

    // Check for any errors
    const allErrors = runResult.checks.flatMap(check => check.errors);
    if (allErrors.length > 0) {
      runResult.success = false;
      logger.warn({ errors: allErrors }, 'Compliance checks completed with errors');
    }

    logger.info({
      farmId,
      totalChecks: runResult.checks.length,
      totalTasksCreated: runResult.totalTasksCreated,
      checksWithIssues: runResult.checks.filter(c => c.issuesFound > 0).length,
    }, 'Compliance checks run completed');

  } catch (error) {
    runResult.success = false;
    logger.error({ error }, 'Compliance checks run failed');
  }

  return runResult;
}

/**
 * Get a summary of compliance status without creating tasks
 */
export async function getComplianceSummary(farmId?: string): Promise<{
  animalsNeedingHealthCheck: number;
  equipmentNeedingService: number;
  unresolvedHazards: number;
  staffNeedingTraining: number;
}> {
  const summary = {
    animalsNeedingHealthCheck: 0,
    equipmentNeedingService: 0,
    unresolvedHazards: 0,
    staffNeedingTraining: 0,
  };

  try {
    // Count animals needing health check
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - ANIMAL_HEALTH_CHECK_THRESHOLD_DAYS);

    const animalConditions = [eq(animals.status, 'active')];
    if (farmId) animalConditions.push(eq(animals.farmId, farmId));

    const activeAnimals = await db
      .select({ id: animals.id })
      .from(animals)
      .where(and(...animalConditions));

    for (const animal of activeAnimals) {
      const recentRecord = await db
        .select({ id: animalHealthRecords.id })
        .from(animalHealthRecords)
        .where(
          and(
            eq(animalHealthRecords.animalId, animal.id),
            gte(animalHealthRecords.recordDate, thresholdDate.toISOString().split('T')[0])
          )
        )
        .limit(1);

      if (recentRecord.length === 0) {
        summary.animalsNeedingHealthCheck++;
      }
    }

    // Count equipment needing service
    const today = new Date().toISOString().split('T')[0];
    const equipConditions = [
      eq(equipment.isActive, true),
      sql`(${equipment.nextServiceDue} < ${today} OR ${equipment.lastServiceDate} IS NULL)`,
    ];
    if (farmId) equipConditions.push(eq(equipment.farmId, farmId));

    const overdueEquipment = await db
      .select({ id: equipment.id })
      .from(equipment)
      .where(and(...equipConditions));

    summary.equipmentNeedingService = overdueEquipment.length;

    // Count unresolved hazards
    const hazardThreshold = new Date();
    hazardThreshold.setDate(hazardThreshold.getDate() - HAZARD_UNRESOLVED_THRESHOLD_DAYS);

    const hazardConditions = [
      inArray(farmHazards.status, ['identified', 'under_review']),
      lt(farmHazards.identifiedAt, hazardThreshold),
    ];
    if (farmId) hazardConditions.push(eq(farmHazards.farmId, farmId));

    const openHazards = await db
      .select({ id: farmHazards.id })
      .from(farmHazards)
      .where(and(...hazardConditions));

    summary.unresolvedHazards = openHazards.length;

    // Count staff needing training (new staff in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const staffConditions = [
      eq(staffProfiles.isActive, true),
      gte(staffProfiles.startDate, thirtyDaysAgo.toISOString().split('T')[0]),
    ];
    if (farmId) staffConditions.push(eq(staffProfiles.farmId, farmId));

    const newStaff = await db
      .select({ id: staffProfiles.id })
      .from(staffProfiles)
      .where(and(...staffConditions));

    summary.staffNeedingTraining = newStaff.length;

  } catch (error) {
    logger.error({ error }, 'Failed to get compliance summary');
  }

  return summary;
}
