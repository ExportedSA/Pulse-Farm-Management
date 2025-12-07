// Pasture Walk Recording API Routes
import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { 
  pastureWalkSessions, pastureCoverMeasurements, pastures
} from "@shared/schema";
import { 
  insertPastureWalkSessionSchema, insertPastureCoverMeasurementSchema
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql, isNull } from "drizzle-orm";
import { z } from "zod";
import { format, differenceInDays, subDays, subMonths } from "date-fns";

const router = Router();

// ===== PASTURE WALK SESSIONS =====

// GET /api/pasture-walks/sessions - Get all walk sessions
router.get("/sessions", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;
    
    let query = db.select().from(pastureWalkSessions);
    
    if (status) {
      query = query.where(eq(pastureWalkSessions.status, status)) as any;
    }
    
    const sessions = await query
      .orderBy(desc(pastureWalkSessions.walkDate))
      .limit(limit);
    
    res.json(sessions);
  } catch (error) {
    console.error("Error fetching walk sessions:", error);
    res.status(500).json({ error: "Failed to fetch walk sessions" });
  }
});

// GET /api/pasture-walks/sessions/:id - Get session with measurements
router.get("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const [session] = await db
      .select()
      .from(pastureWalkSessions)
      .where(eq(pastureWalkSessions.id, req.params.id));
    
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    // Get measurements for this session
    const measurements = await db
      .select({
        measurement: pastureCoverMeasurements,
        pasture: pastures,
      })
      .from(pastureCoverMeasurements)
      .leftJoin(pastures, eq(pastureCoverMeasurements.pastureId, pastures.id))
      .where(eq(pastureCoverMeasurements.sessionId, req.params.id))
      .orderBy(pastures.paddockNumber);
    
    res.json({
      ...session,
      measurements: measurements.map(m => ({
        ...m.measurement,
        pastureName: m.pasture?.name,
        paddockNumber: m.pasture?.paddockNumber,
        pastureArea: m.pasture?.area,
      })),
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

// POST /api/pasture-walks/sessions - Create new walk session
router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const validatedData = insertPastureWalkSessionSchema.parse(req.body);
    
    const [session] = await db
      .insert(pastureWalkSessions)
      .values(validatedData)
      .returning();
    
    res.status(201).json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

// PUT /api/pasture-walks/sessions/:id - Update session
router.put("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const [session] = await db
      .update(pastureWalkSessions)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(pastureWalkSessions.id, req.params.id))
      .returning();
    
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    res.json(session);
  } catch (error) {
    console.error("Error updating session:", error);
    res.status(500).json({ error: "Failed to update session" });
  }
});

// POST /api/pasture-walks/sessions/:id/complete - Complete a walk session
router.post("/sessions/:id/complete", async (req: Request, res: Response) => {
  try {
    // Get all measurements for this session
    const measurements = await db
      .select()
      .from(pastureCoverMeasurements)
      .where(eq(pastureCoverMeasurements.sessionId, req.params.id));
    
    // Calculate summary stats
    const totalPaddocks = measurements.length;
    const totalCover = measurements.reduce((sum, m) => sum + (m.coverKgDmHa || 0), 0);
    const averageCover = totalPaddocks > 0 ? Math.round(totalCover / totalPaddocks) : 0;
    
    // Get pasture areas for total farm cover calculation
    const pastureIds = measurements.map(m => m.pastureId);
    const pastureData = await db
      .select()
      .from(pastures)
      .where(sql`${pastures.id} IN (${sql.join(pastureIds.map(id => sql`${id}`), sql`, `)})`);
    
    const pastureAreaMap = new Map(pastureData.map(p => [p.id, p.area || 0]));
    
    // Calculate total farm cover (cover * area for each paddock)
    let totalFarmCover = 0;
    for (const m of measurements) {
      const area = pastureAreaMap.get(m.pastureId) || 1;
      totalFarmCover += (m.coverKgDmHa || 0) * area;
    }
    
    const [session] = await db
      .update(pastureWalkSessions)
      .set({
        status: 'completed',
        completedAt: new Date(),
        totalPaddocks,
        averageCover,
        totalFarmCover,
        updatedAt: new Date(),
      })
      .where(eq(pastureWalkSessions.id, req.params.id))
      .returning();
    
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    res.json(session);
  } catch (error) {
    console.error("Error completing session:", error);
    res.status(500).json({ error: "Failed to complete session" });
  }
});

// DELETE /api/pasture-walks/sessions/:id - Delete session
router.delete("/sessions/:id", async (req: Request, res: Response) => {
  try {
    await db
      .delete(pastureWalkSessions)
      .where(eq(pastureWalkSessions.id, req.params.id));
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

// ===== COVER MEASUREMENTS =====

// GET /api/pasture-walks/measurements - Get all measurements
router.get("/measurements", async (req: Request, res: Response) => {
  try {
    const pastureId = req.query.pastureId as string;
    const sessionId = req.query.sessionId as string;
    const days = parseInt(req.query.days as string) || 90;
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
    
    let conditions = [gte(pastureCoverMeasurements.measurementDate, startDate)];
    
    if (pastureId) {
      conditions.push(eq(pastureCoverMeasurements.pastureId, pastureId));
    }
    if (sessionId) {
      conditions.push(eq(pastureCoverMeasurements.sessionId, sessionId));
    }
    
    const measurements = await db
      .select({
        measurement: pastureCoverMeasurements,
        pasture: pastures,
      })
      .from(pastureCoverMeasurements)
      .leftJoin(pastures, eq(pastureCoverMeasurements.pastureId, pastures.id))
      .where(and(...conditions))
      .orderBy(desc(pastureCoverMeasurements.measurementDate));
    
    res.json(measurements.map(m => ({
      ...m.measurement,
      pastureName: m.pasture?.name,
      paddockNumber: m.pasture?.paddockNumber,
    })));
  } catch (error) {
    console.error("Error fetching measurements:", error);
    res.status(500).json({ error: "Failed to fetch measurements" });
  }
});

// GET /api/pasture-walks/measurements/pasture/:pastureId - Get history for a paddock
router.get("/measurements/pasture/:pastureId", async (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const startDate = format(subMonths(new Date(), months), 'yyyy-MM-dd');
    
    const measurements = await db
      .select()
      .from(pastureCoverMeasurements)
      .where(and(
        eq(pastureCoverMeasurements.pastureId, req.params.pastureId),
        gte(pastureCoverMeasurements.measurementDate, startDate)
      ))
      .orderBy(desc(pastureCoverMeasurements.measurementDate));
    
    // Calculate growth rates between measurements
    const withGrowth = measurements.map((m, i) => {
      if (i < measurements.length - 1) {
        const prevMeasurement = measurements[i + 1];
        const daysDiff = differenceInDays(
          new Date(m.measurementDate),
          new Date(prevMeasurement.measurementDate)
        );
        const coverDiff = (m.coverKgDmHa || 0) - (prevMeasurement.coverKgDmHa || 0);
        const growthRate = daysDiff > 0 ? Math.round(coverDiff / daysDiff) : 0;
        
        return { ...m, calculatedGrowthRate: growthRate, daysSincePrevious: daysDiff };
      }
      return { ...m, calculatedGrowthRate: null, daysSincePrevious: null };
    });
    
    res.json(withGrowth);
  } catch (error) {
    console.error("Error fetching pasture history:", error);
    res.status(500).json({ error: "Failed to fetch pasture history" });
  }
});

// POST /api/pasture-walks/measurements - Record a measurement
router.post("/measurements", async (req: Request, res: Response) => {
  try {
    const validatedData = insertPastureCoverMeasurementSchema.parse(req.body);
    
    // Get previous measurement for this pasture to calculate growth
    const [previousMeasurement] = await db
      .select()
      .from(pastureCoverMeasurements)
      .where(eq(pastureCoverMeasurements.pastureId, validatedData.pastureId))
      .orderBy(desc(pastureCoverMeasurements.measurementDate))
      .limit(1);
    
    let growthData: any = {};
    if (previousMeasurement) {
      const daysDiff = differenceInDays(
        new Date(validatedData.measurementDate),
        new Date(previousMeasurement.measurementDate)
      );
      const coverDiff = validatedData.coverKgDmHa - (previousMeasurement.coverKgDmHa || 0);
      
      growthData = {
        previousCover: previousMeasurement.coverKgDmHa,
        daysSinceLastMeasurement: daysDiff,
        growthRateKgDay: daysDiff > 0 ? Math.round(coverDiff / daysDiff) : 0,
      };
    }
    
    const [measurement] = await db
      .insert(pastureCoverMeasurements)
      .values({
        ...validatedData,
        ...growthData,
      })
      .returning();
    
    // Update session totals if part of a session
    if (validatedData.sessionId) {
      const sessionMeasurements = await db
        .select()
        .from(pastureCoverMeasurements)
        .where(eq(pastureCoverMeasurements.sessionId, validatedData.sessionId));
      
      const totalPaddocks = sessionMeasurements.length;
      const totalCover = sessionMeasurements.reduce((sum, m) => sum + (m.coverKgDmHa || 0), 0);
      const averageCover = totalPaddocks > 0 ? Math.round(totalCover / totalPaddocks) : 0;
      
      await db
        .update(pastureWalkSessions)
        .set({ totalPaddocks, averageCover, updatedAt: new Date() })
        .where(eq(pastureWalkSessions.id, validatedData.sessionId));
    }
    
    res.status(201).json(measurement);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Error creating measurement:", error);
    res.status(500).json({ error: "Failed to create measurement" });
  }
});

// POST /api/pasture-walks/measurements/quick - Quick entry for multiple paddocks
router.post("/measurements/quick", async (req: Request, res: Response) => {
  try {
    const { sessionId, measurements } = req.body as {
      sessionId?: string;
      measurements: Array<{
        pastureId: string;
        coverKgDmHa: number;
        plateMeterReading?: number;
        notes?: string;
      }>;
    };
    
    if (!measurements || !Array.isArray(measurements)) {
      return res.status(400).json({ error: "Measurements array required" });
    }
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const time = format(new Date(), 'HH:mm');
    
    const results = [];
    
    for (const m of measurements) {
      // Get previous measurement
      const [prev] = await db
        .select()
        .from(pastureCoverMeasurements)
        .where(eq(pastureCoverMeasurements.pastureId, m.pastureId))
        .orderBy(desc(pastureCoverMeasurements.measurementDate))
        .limit(1);
      
      let growthData: any = {};
      if (prev) {
        const daysDiff = differenceInDays(new Date(today), new Date(prev.measurementDate));
        const coverDiff = m.coverKgDmHa - (prev.coverKgDmHa || 0);
        growthData = {
          previousCover: prev.coverKgDmHa,
          daysSinceLastMeasurement: daysDiff,
          growthRateKgDay: daysDiff > 0 ? Math.round(coverDiff / daysDiff) : 0,
        };
      }
      
      const [measurement] = await db
        .insert(pastureCoverMeasurements)
        .values({
          sessionId,
          pastureId: m.pastureId,
          measurementDate: today,
          measurementTime: time,
          coverKgDmHa: m.coverKgDmHa,
          plateMeterReading: m.plateMeterReading,
          notes: m.notes,
          ...growthData,
        })
        .returning();
      
      results.push(measurement);
    }
    
    // Update session if provided
    if (sessionId) {
      const sessionMeasurements = await db
        .select()
        .from(pastureCoverMeasurements)
        .where(eq(pastureCoverMeasurements.sessionId, sessionId));
      
      const totalPaddocks = sessionMeasurements.length;
      const totalCover = sessionMeasurements.reduce((sum, m) => sum + (m.coverKgDmHa || 0), 0);
      const averageCover = totalPaddocks > 0 ? Math.round(totalCover / totalPaddocks) : 0;
      
      await db
        .update(pastureWalkSessions)
        .set({ totalPaddocks, averageCover, updatedAt: new Date() })
        .where(eq(pastureWalkSessions.id, sessionId));
    }
    
    res.status(201).json({
      created: results.length,
      measurements: results,
    });
  } catch (error) {
    console.error("Error creating quick measurements:", error);
    res.status(500).json({ error: "Failed to create measurements" });
  }
});

// PUT /api/pasture-walks/measurements/:id - Update measurement
router.put("/measurements/:id", async (req: Request, res: Response) => {
  try {
    const [measurement] = await db
      .update(pastureCoverMeasurements)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(pastureCoverMeasurements.id, req.params.id))
      .returning();
    
    if (!measurement) {
      return res.status(404).json({ error: "Measurement not found" });
    }
    
    res.json(measurement);
  } catch (error) {
    console.error("Error updating measurement:", error);
    res.status(500).json({ error: "Failed to update measurement" });
  }
});

// DELETE /api/pasture-walks/measurements/:id - Delete measurement
router.delete("/measurements/:id", async (req: Request, res: Response) => {
  try {
    await db
      .delete(pastureCoverMeasurements)
      .where(eq(pastureCoverMeasurements.id, req.params.id));
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting measurement:", error);
    res.status(500).json({ error: "Failed to delete measurement" });
  }
});

// ===== ANALYTICS =====

// GET /api/pasture-walks/analytics/farm-cover - Farm cover summary
router.get("/analytics/farm-cover", async (req: Request, res: Response) => {
  try {
    // Get all pastures
    const allPastures = await db.select().from(pastures);
    
    // Get latest measurement for each pasture
    const latestMeasurements: any[] = [];
    
    for (const pasture of allPastures) {
      const [latest] = await db
        .select()
        .from(pastureCoverMeasurements)
        .where(eq(pastureCoverMeasurements.pastureId, pasture.id))
        .orderBy(desc(pastureCoverMeasurements.measurementDate))
        .limit(1);
      
      if (latest) {
        latestMeasurements.push({
          ...latest,
          pastureName: pasture.name,
          paddockNumber: pasture.paddockNumber,
          area: pasture.area,
          status: pasture.status,
        });
      }
    }
    
    // Calculate farm totals
    const totalArea = allPastures.reduce((sum, p) => sum + (p.area || 0), 0);
    const measuredPaddocks = latestMeasurements.length;
    const totalCover = latestMeasurements.reduce((sum, m) => sum + (m.coverKgDmHa || 0), 0);
    const averageCover = measuredPaddocks > 0 ? Math.round(totalCover / measuredPaddocks) : 0;
    
    // Weighted average by area
    let weightedCover = 0;
    let weightedArea = 0;
    for (const m of latestMeasurements) {
      const area = m.area || 1;
      weightedCover += (m.coverKgDmHa || 0) * area;
      weightedArea += area;
    }
    const weightedAverageCover = weightedArea > 0 ? Math.round(weightedCover / weightedArea) : 0;
    
    // Calculate average growth rate
    const growthRates = latestMeasurements
      .filter(m => m.growthRateKgDay !== null)
      .map(m => m.growthRateKgDay);
    const averageGrowthRate = growthRates.length > 0 
      ? Math.round(growthRates.reduce((a, b) => a + b, 0) / growthRates.length)
      : 0;
    
    res.json({
      summary: {
        totalPaddocks: allPastures.length,
        measuredPaddocks,
        unmeasuredPaddocks: allPastures.length - measuredPaddocks,
        totalArea,
        averageCover,
        weightedAverageCover,
        averageGrowthRate,
      },
      paddocks: latestMeasurements.sort((a, b) => (a.paddockNumber || 0) - (b.paddockNumber || 0)),
    });
  } catch (error) {
    console.error("Error fetching farm cover:", error);
    res.status(500).json({ error: "Failed to fetch farm cover" });
  }
});

// GET /api/pasture-walks/analytics/growth-trends - Growth rate trends
router.get("/analytics/growth-trends", async (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 6;
    const startDate = format(subMonths(new Date(), months), 'yyyy-MM-dd');
    
    // Get all measurements in period
    const measurements = await db
      .select({
        date: pastureCoverMeasurements.measurementDate,
        cover: pastureCoverMeasurements.coverKgDmHa,
        growth: pastureCoverMeasurements.growthRateKgDay,
      })
      .from(pastureCoverMeasurements)
      .where(gte(pastureCoverMeasurements.measurementDate, startDate))
      .orderBy(pastureCoverMeasurements.measurementDate);
    
    // Group by week
    const weeklyData: Record<string, { covers: number[]; growths: number[] }> = {};
    
    for (const m of measurements) {
      const weekStart = format(new Date(m.date), 'yyyy-ww'); // Year-week
      if (!weeklyData[weekStart]) {
        weeklyData[weekStart] = { covers: [], growths: [] };
      }
      if (m.cover) weeklyData[weekStart].covers.push(m.cover);
      if (m.growth) weeklyData[weekStart].growths.push(m.growth);
    }
    
    const trends = Object.entries(weeklyData).map(([week, data]) => ({
      week,
      avgCover: data.covers.length > 0 
        ? Math.round(data.covers.reduce((a, b) => a + b, 0) / data.covers.length)
        : null,
      avgGrowth: data.growths.length > 0
        ? Math.round(data.growths.reduce((a, b) => a + b, 0) / data.growths.length)
        : null,
      measurementCount: data.covers.length,
    }));
    
    res.json(trends);
  } catch (error) {
    console.error("Error fetching growth trends:", error);
    res.status(500).json({ error: "Failed to fetch growth trends" });
  }
});

// GET /api/pasture-walks/analytics/cover-distribution - Cover distribution
router.get("/analytics/cover-distribution", async (req: Request, res: Response) => {
  try {
    // Get all pastures with latest measurements
    const allPastures = await db.select().from(pastures);
    
    const distribution = {
      veryLow: [] as any[],    // < 1500 kg DM/ha
      low: [] as any[],        // 1500-2000
      optimal: [] as any[],    // 2000-2800
      high: [] as any[],       // 2800-3200
      veryHigh: [] as any[],   // > 3200
      unmeasured: [] as any[],
    };
    
    for (const pasture of allPastures) {
      const [latest] = await db
        .select()
        .from(pastureCoverMeasurements)
        .where(eq(pastureCoverMeasurements.pastureId, pasture.id))
        .orderBy(desc(pastureCoverMeasurements.measurementDate))
        .limit(1);
      
      const paddockInfo = {
        id: pasture.id,
        name: pasture.name,
        paddockNumber: pasture.paddockNumber,
        area: pasture.area,
        cover: latest?.coverKgDmHa,
        lastMeasured: latest?.measurementDate,
      };
      
      if (!latest) {
        distribution.unmeasured.push(paddockInfo);
      } else if (latest.coverKgDmHa < 1500) {
        distribution.veryLow.push(paddockInfo);
      } else if (latest.coverKgDmHa < 2000) {
        distribution.low.push(paddockInfo);
      } else if (latest.coverKgDmHa < 2800) {
        distribution.optimal.push(paddockInfo);
      } else if (latest.coverKgDmHa < 3200) {
        distribution.high.push(paddockInfo);
      } else {
        distribution.veryHigh.push(paddockInfo);
      }
    }
    
    res.json({
      distribution,
      counts: {
        veryLow: distribution.veryLow.length,
        low: distribution.low.length,
        optimal: distribution.optimal.length,
        high: distribution.high.length,
        veryHigh: distribution.veryHigh.length,
        unmeasured: distribution.unmeasured.length,
      },
    });
  } catch (error) {
    console.error("Error fetching cover distribution:", error);
    res.status(500).json({ error: "Failed to fetch cover distribution" });
  }
});

export default router;
