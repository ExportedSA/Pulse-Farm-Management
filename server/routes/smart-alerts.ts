// Smart Alerts & Notifications API Routes
import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { 
  alerts, animals, animalTreatments, breedingRecords, vaccinationSchedules,
  prescriptions, vetVisits, labResults, healthScores
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql, isNull, or } from "drizzle-orm";
import { addDays, subDays, differenceInDays, format } from "date-fns";

const router = Router();

// ===== ALERT RETRIEVAL =====

// GET /api/alerts - Get all active alerts
router.get("/", async (req: Request, res: Response) => {
  try {
    const includeDissmissed = req.query.includeDismissed === 'true';
    const type = req.query.type as string;
    const severity = req.query.severity as string;
    const limit = parseInt(req.query.limit as string) || 50;

    let query = db.select().from(alerts);
    
    const conditions = [];
    
    if (!includeDissmissed) {
      conditions.push(isNull(alerts.dismissedAt));
    }
    
    if (type) {
      conditions.push(sql`${alerts.type} = ${type}`);
    }
    
    if (severity) {
      conditions.push(sql`${alerts.severity} = ${severity}`);
    }

    const result = await db
      .select()
      .from(alerts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(alerts.createdAt))
      .limit(limit);

    res.json(result);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// GET /api/alerts/summary - Get alert counts by type
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const counts = await db
      .select({
        type: alerts.type,
        severity: alerts.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(alerts)
      .where(isNull(alerts.dismissedAt))
      .groupBy(alerts.type, alerts.severity);

    const bySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const byType: Record<string, number> = {};

    counts.forEach(c => {
      bySeverity[c.severity as keyof typeof bySeverity] += c.count;
      byType[c.type] = (byType[c.type] || 0) + c.count;
    });

    res.json({
      total: Object.values(bySeverity).reduce((a, b) => a + b, 0),
      bySeverity,
      byType,
    });
  } catch (error) {
    console.error("Error fetching alert summary:", error);
    res.status(500).json({ error: "Failed to fetch alert summary" });
  }
});

// GET /api/alerts/animal/:animalId - Get alerts for specific animal
router.get("/animal/:animalId", async (req: Request, res: Response) => {
  try {
    const result = await db
      .select()
      .from(alerts)
      .where(and(
        eq(alerts.animalId, req.params.animalId),
        isNull(alerts.dismissedAt)
      ))
      .orderBy(desc(alerts.createdAt));

    res.json(result);
  } catch (error) {
    console.error("Error fetching animal alerts:", error);
    res.status(500).json({ error: "Failed to fetch animal alerts" });
  }
});

// PUT /api/alerts/:id/dismiss - Dismiss an alert
router.put("/:id/dismiss", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    const [alert] = await db
      .update(alerts)
      .set({ 
        dismissedAt: new Date(),
        dismissedBy: userId,
      })
      .where(eq(alerts.id, req.params.id))
      .returning();

    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    res.json(alert);
  } catch (error) {
    console.error("Error dismissing alert:", error);
    res.status(500).json({ error: "Failed to dismiss alert" });
  }
});

// PUT /api/alerts/dismiss-all - Dismiss all alerts of a type
router.put("/dismiss-all", async (req: Request, res: Response) => {
  try {
    const { userId, type } = req.body;
    
    const conditions = [isNull(alerts.dismissedAt)];
    if (type) {
      conditions.push(sql`${alerts.type} = ${type}`);
    }

    await db
      .update(alerts)
      .set({ 
        dismissedAt: new Date(),
        dismissedBy: userId,
      })
      .where(and(...conditions));

    res.json({ success: true });
  } catch (error) {
    console.error("Error dismissing alerts:", error);
    res.status(500).json({ error: "Failed to dismiss alerts" });
  }
});

// ===== ALERT GENERATION =====

// POST /api/alerts/generate - Generate all pending alerts
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const generated = {
      treatmentDue: 0,
      withdrawalEnding: 0,
      calvingDue: 0,
      vaccinationDue: 0,
      healthCheck: 0,
      vetReminders: 0,
    };

    // Generate treatment due alerts
    generated.treatmentDue = await generateTreatmentDueAlerts();
    
    // Generate withdrawal ending alerts
    generated.withdrawalEnding = await generateWithdrawalAlerts();
    
    // Generate calving due alerts
    generated.calvingDue = await generateCalvingAlerts();
    
    // Generate vaccination due alerts
    generated.vaccinationDue = await generateVaccinationAlerts();
    
    // Generate health check reminders
    generated.healthCheck = await generateHealthCheckAlerts();
    
    // Generate vet reminders
    generated.vetReminders = await generateVetAlerts();

    res.json({
      success: true,
      generated,
      total: Object.values(generated).reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    console.error("Error generating alerts:", error);
    res.status(500).json({ error: "Failed to generate alerts" });
  }
});

// ===== ALERT GENERATION FUNCTIONS =====

async function generateTreatmentDueAlerts(): Promise<number> {
  let count = 0;
  const today = new Date();
  const tomorrow = addDays(today, 1);

  // Find treatments that need follow-up (scheduled but not completed)
  const pendingTreatments = await db
    .select()
    .from(animalTreatments)
    .where(and(
      eq(animalTreatments.status, 'scheduled'),
      lte(animalTreatments.treatmentDate, format(tomorrow, 'yyyy-MM-dd'))
    ));

  for (const treatment of pendingTreatments) {
    // Check if alert already exists
    const [existing] = await db
      .select()
      .from(alerts)
      .where(and(
        eq(alerts.treatmentId, treatment.id),
        eq(alerts.type, 'treatment_due'),
        isNull(alerts.dismissedAt)
      ));

    if (!existing) {
      const isOverdue = treatment.treatmentDate < format(today, 'yyyy-MM-dd');
      
      await db.insert(alerts).values({
        type: isOverdue ? 'treatment_overdue' : 'treatment_due',
        severity: isOverdue ? 'high' : 'medium',
        animalId: treatment.animalId,
        treatmentId: treatment.id,
        title: isOverdue ? 'Treatment Overdue' : 'Treatment Due',
        message: `${treatment.treatmentType} treatment ${isOverdue ? 'was due' : 'is due'} on ${treatment.treatmentDate}`,
        metadata: { treatmentType: treatment.treatmentType, dueDate: treatment.treatmentDate },
      });
      count++;
    }
  }

  return count;
}

async function generateWithdrawalAlerts(): Promise<number> {
  let count = 0;
  const today = new Date();
  const alertWindow = addDays(today, 2); // Alert 2 days before withdrawal ends

  // Find treatments with active withholding periods
  const treatmentsWithWithholding = await db
    .select()
    .from(animalTreatments)
    .where(and(
      or(
        sql`${animalTreatments.meatWithholdingDays} > 0`,
        sql`${animalTreatments.milkWithholdingDays} > 0`
      ),
      eq(animalTreatments.status, 'completed')
    ));

  for (const treatment of treatmentsWithWithholding) {
    const treatmentDate = new Date(treatment.treatmentDate);
    
    // Check milk withholding
    if (treatment.milkWithholdingDays) {
      const milkClearDate = addDays(treatmentDate, treatment.milkWithholdingDays);
      const daysUntilClear = differenceInDays(milkClearDate, today);
      
      if (daysUntilClear >= 0 && daysUntilClear <= 2) {
        const [existing] = await db
          .select()
          .from(alerts)
          .where(and(
            eq(alerts.treatmentId, treatment.id),
            eq(alerts.type, 'withholding_milk_ending'),
            isNull(alerts.dismissedAt)
          ));

        if (!existing) {
          await db.insert(alerts).values({
            type: 'withholding_milk_ending',
            severity: daysUntilClear === 0 ? 'high' : 'medium',
            animalId: treatment.animalId,
            treatmentId: treatment.id,
            title: 'Milk Withholding Ending',
            message: `Milk withholding for ${treatment.treatmentType} ends ${daysUntilClear === 0 ? 'today' : `in ${daysUntilClear} days`}`,
            metadata: { 
              clearDate: format(milkClearDate, 'yyyy-MM-dd'),
              daysRemaining: daysUntilClear,
              treatmentType: treatment.treatmentType,
            },
          });
          count++;
        }
      }
    }

    // Check meat withholding
    if (treatment.meatWithholdingDays) {
      const meatClearDate = addDays(treatmentDate, treatment.meatWithholdingDays);
      const daysUntilClear = differenceInDays(meatClearDate, today);
      
      if (daysUntilClear >= 0 && daysUntilClear <= 2) {
        const [existing] = await db
          .select()
          .from(alerts)
          .where(and(
            eq(alerts.treatmentId, treatment.id),
            eq(alerts.type, 'withholding_meat_ending'),
            isNull(alerts.dismissedAt)
          ));

        if (!existing) {
          await db.insert(alerts).values({
            type: 'withholding_meat_ending',
            severity: daysUntilClear === 0 ? 'high' : 'medium',
            animalId: treatment.animalId,
            treatmentId: treatment.id,
            title: 'Meat Withholding Ending',
            message: `Meat withholding for ${treatment.treatmentType} ends ${daysUntilClear === 0 ? 'today' : `in ${daysUntilClear} days`}`,
            metadata: { 
              clearDate: format(meatClearDate, 'yyyy-MM-dd'),
              daysRemaining: daysUntilClear,
              treatmentType: treatment.treatmentType,
            },
          });
          count++;
        }
      }
    }
  }

  return count;
}

async function generateCalvingAlerts(): Promise<number> {
  let count = 0;
  const today = new Date();
  const alertWindow = addDays(today, 14); // Alert 14 days before expected calving

  // Find breeding records with expected calving dates
  const pregnantAnimals = await db
    .select()
    .from(breedingRecords)
    .where(and(
      eq(breedingRecords.conceptionConfirmed, true),
      sql`${breedingRecords.expectedCalvingDate} IS NOT NULL`,
      gte(breedingRecords.expectedCalvingDate, subDays(today, 7)), // Include overdue up to 7 days
      lte(breedingRecords.expectedCalvingDate, alertWindow)
    ));

  for (const record of pregnantAnimals) {
    if (!record.expectedCalvingDate) continue;
    
    const expectedDate = new Date(record.expectedCalvingDate);
    const daysUntil = differenceInDays(expectedDate, today);
    
    let alertType: 'calving_imminent' | 'calving_due' | 'calving_overdue';
    let severity: 'low' | 'medium' | 'high' | 'critical';
    
    if (daysUntil < 0) {
      alertType = 'calving_overdue';
      severity = 'critical';
    } else if (daysUntil <= 3) {
      alertType = 'calving_imminent';
      severity = 'high';
    } else {
      alertType = 'calving_due';
      severity = 'medium';
    }

    const [existing] = await db
      .select()
      .from(alerts)
      .where(and(
        eq(alerts.animalId, record.animalId),
        sql`${alerts.type} IN ('calving_due', 'calving_imminent', 'calving_overdue')`,
        isNull(alerts.dismissedAt)
      ));

    if (!existing) {
      await db.insert(alerts).values({
        type: alertType,
        severity,
        animalId: record.animalId,
        title: alertType === 'calving_overdue' ? 'Calving Overdue' : 
               alertType === 'calving_imminent' ? 'Calving Imminent' : 'Calving Due',
        message: daysUntil < 0 
          ? `Expected calving was ${Math.abs(daysUntil)} days ago`
          : daysUntil === 0 
            ? 'Expected calving is today'
            : `Expected calving in ${daysUntil} days`,
        metadata: { 
          expectedDate: format(expectedDate, 'yyyy-MM-dd'),
          daysUntil,
          breedingRecordId: record.id,
        },
      });
      count++;
    }
  }

  return count;
}

async function generateVaccinationAlerts(): Promise<number> {
  let count = 0;
  const today = new Date();
  const alertWindow = addDays(today, 7); // Alert 7 days before vaccination due

  // Find vaccination schedules
  const schedules = await db
    .select()
    .from(vaccinationSchedules)
    .where(and(
      eq(vaccinationSchedules.isActive, true),
      sql`${vaccinationSchedules.nextDueDate} IS NOT NULL`,
      lte(vaccinationSchedules.nextDueDate, alertWindow)
    ));

  for (const schedule of schedules) {
    if (!schedule.nextDueDate) continue;
    
    const dueDate = new Date(schedule.nextDueDate);
    const daysUntil = differenceInDays(dueDate, today);
    
    const isOverdue = daysUntil < 0;
    
    const [existing] = await db
      .select()
      .from(alerts)
      .where(and(
        sql`${alerts.metadata}->>'scheduleId' = ${schedule.id}`,
        sql`${alerts.type} IN ('vaccination_due', 'vaccination_overdue')`,
        isNull(alerts.dismissedAt)
      ));

    if (!existing) {
      await db.insert(alerts).values({
        type: isOverdue ? 'vaccination_overdue' : 'vaccination_due',
        severity: isOverdue ? 'high' : 'medium',
        animalId: schedule.animalId,
        title: isOverdue ? 'Vaccination Overdue' : 'Vaccination Due',
        message: `${schedule.vaccineName} ${isOverdue ? 'was due' : 'is due'} ${isOverdue ? `${Math.abs(daysUntil)} days ago` : daysUntil === 0 ? 'today' : `in ${daysUntil} days`}`,
        metadata: { 
          scheduleId: schedule.id,
          vaccineName: schedule.vaccineName,
          dueDate: format(dueDate, 'yyyy-MM-dd'),
          daysUntil,
        },
      });
      count++;
    }
  }

  return count;
}

async function generateHealthCheckAlerts(): Promise<number> {
  let count = 0;
  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);

  // Find animals without recent health scores
  const activeAnimals = await db
    .select()
    .from(animals)
    .where(eq(animals.status, 'active'));

  for (const animal of activeAnimals) {
    const [recentScore] = await db
      .select()
      .from(healthScores)
      .where(and(
        eq(healthScores.animalId, animal.id),
        gte(healthScores.recordDate, format(thirtyDaysAgo, 'yyyy-MM-dd'))
      ))
      .orderBy(desc(healthScores.recordDate))
      .limit(1);

    if (!recentScore) {
      // Check if alert already exists
      const [existing] = await db
        .select()
        .from(alerts)
        .where(and(
          eq(alerts.animalId, animal.id),
          eq(alerts.type, 'health_check_due'),
          isNull(alerts.dismissedAt)
        ));

      if (!existing) {
        await db.insert(alerts).values({
          type: 'health_check_due',
          severity: 'low',
          animalId: animal.id,
          title: 'Health Check Due',
          message: `No health score recorded in the last 30 days`,
          metadata: { 
            cowId: animal.cowId,
            lastCheckDate: null,
          },
        });
        count++;
      }
    }
  }

  return count;
}

async function generateVetAlerts(): Promise<number> {
  let count = 0;
  const today = new Date();
  const tomorrow = addDays(today, 1);

  // Upcoming vet visits
  const upcomingVisits = await db
    .select()
    .from(vetVisits)
    .where(and(
      sql`${vetVisits.status} IN ('scheduled', 'confirmed')`,
      gte(vetVisits.scheduledDate, format(today, 'yyyy-MM-dd')),
      lte(vetVisits.scheduledDate, format(tomorrow, 'yyyy-MM-dd'))
    ));

  for (const visit of upcomingVisits) {
    const [existing] = await db
      .select()
      .from(alerts)
      .where(and(
        sql`${alerts.metadata}->>'visitId' = ${visit.id}`,
        eq(alerts.type, 'vet_visit_reminder'),
        isNull(alerts.dismissedAt)
      ));

    if (!existing) {
      const visitDate = new Date(visit.scheduledDate);
      const isToday = differenceInDays(visitDate, today) === 0;
      
      await db.insert(alerts).values({
        type: 'vet_visit_reminder',
        severity: isToday ? 'high' : 'medium',
        title: 'Vet Visit Reminder',
        message: `Vet visit ${isToday ? 'today' : 'tomorrow'}${visit.scheduledTime ? ` at ${visit.scheduledTime}` : ''}`,
        metadata: { 
          visitId: visit.id,
          visitDate: format(visitDate, 'yyyy-MM-dd'),
          visitTime: visit.scheduledTime,
          visitType: visit.visitType,
        },
      });
      count++;
    }
  }

  // Pending lab results
  const pendingLabs = await db
    .select()
    .from(labResults)
    .where(eq(labResults.status, 'completed'));

  // Check for recently completed labs that haven't been reviewed
  for (const lab of pendingLabs) {
    if (lab.resultsReceivedDate) {
      const receivedDate = new Date(lab.resultsReceivedDate);
      const daysSinceReceived = differenceInDays(today, receivedDate);
      
      if (daysSinceReceived <= 1) {
        const [existing] = await db
          .select()
          .from(alerts)
          .where(and(
            sql`${alerts.metadata}->>'labResultId' = ${lab.id}`,
            eq(alerts.type, 'lab_results_ready'),
            isNull(alerts.dismissedAt)
          ));

        if (!existing) {
          await db.insert(alerts).values({
            type: 'lab_results_ready',
            severity: lab.overallResult === 'critical' ? 'critical' : 'medium',
            animalId: lab.animalId,
            title: 'Lab Results Ready',
            message: `${lab.testName} results are ready`,
            metadata: { 
              labResultId: lab.id,
              testName: lab.testName,
              overallResult: lab.overallResult,
            },
          });
          count++;
        }
      }
    }
  }

  // Expiring prescriptions
  const activePrescriptions = await db
    .select()
    .from(prescriptions)
    .where(and(
      eq(prescriptions.status, 'active'),
      sql`${prescriptions.endDate} IS NOT NULL`,
      lte(prescriptions.endDate, format(addDays(today, 3), 'yyyy-MM-dd'))
    ));

  for (const rx of activePrescriptions) {
    if (!rx.endDate) continue;
    
    const endDate = new Date(rx.endDate);
    const daysUntilEnd = differenceInDays(endDate, today);
    
    if (daysUntilEnd >= 0 && daysUntilEnd <= 3) {
      const [existing] = await db
        .select()
        .from(alerts)
        .where(and(
          sql`${alerts.metadata}->>'prescriptionId' = ${rx.id}`,
          eq(alerts.type, 'prescription_ending'),
          isNull(alerts.dismissedAt)
        ));

      if (!existing) {
        await db.insert(alerts).values({
          type: 'prescription_ending',
          severity: daysUntilEnd === 0 ? 'high' : 'medium',
          animalId: rx.animalId,
          title: 'Prescription Ending',
          message: `${rx.medicationName} prescription ends ${daysUntilEnd === 0 ? 'today' : `in ${daysUntilEnd} days`}`,
          metadata: { 
            prescriptionId: rx.id,
            medicationName: rx.medicationName,
            endDate: format(endDate, 'yyyy-MM-dd'),
          },
        });
        count++;
      }
    }
  }

  return count;
}

export default router;
