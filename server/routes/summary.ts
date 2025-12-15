import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db } from "../db";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import logger from "../config/logger";

const router = Router();

// GET /api/summary - Get dashboard summary data
router.get("/", requireAuth, async (req, res) => {
  try {
    const farmId = (req.user as any).farmId;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Get summary counts in parallel
    const [
      jobsResult,
      hazardsResult,
      incidentsResult,
      animalsResult,
      equipmentResult,
      shiftsResult,
    ] = await Promise.all([
      // Open jobs count
      db.execute(sql`
        SELECT COUNT(*) as count FROM jobs 
        WHERE status IN ('PENDING', 'IN_PROGRESS')
      `).catch(() => ({ rows: [{ count: 0 }] })),
      
      // Active hazards count
      db.execute(sql`
        SELECT COUNT(*) as count FROM hazards 
        WHERE status != 'resolved'
      `).catch(() => ({ rows: [{ count: 0 }] })),
      
      // Recent incidents (last 7 days)
      db.execute(sql`
        SELECT COUNT(*) as count FROM incidents 
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `).catch(() => ({ rows: [{ count: 0 }] })),
      
      // Active animals count
      db.execute(sql`
        SELECT COUNT(*) as count FROM animals 
        WHERE status = 'active'
      `).catch(() => ({ rows: [{ count: 0 }] })),
      
      // Equipment needing maintenance
      db.execute(sql`
        SELECT COUNT(*) as count FROM equipment 
        WHERE status IN ('maintenance_due', 'out_of_service') AND is_active = true
      `).catch(() => ({ rows: [{ count: 0 }] })),
      
      // Today's shifts
      db.execute(sql`
        SELECT COUNT(*) as count FROM roster_shifts 
        WHERE date = ${todayStr}
      `).catch(() => ({ rows: [{ count: 0 }] })),
    ]);

    // Get next upcoming job
    const nextJobResult = await db.execute(sql`
      SELECT id, title, due_date, status FROM jobs 
      WHERE status IN ('PENDING', 'IN_PROGRESS') 
      ORDER BY due_date ASC NULLS LAST 
      LIMIT 1
    `).catch(() => ({ rows: [] }));

    // Get top hazards
    const topHazardsResult = await db.execute(sql`
      SELECT id, title, risk_level, location FROM hazards 
      WHERE status != 'resolved' 
      ORDER BY 
        CASE risk_level 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END 
      LIMIT 3
    `).catch(() => ({ rows: [] }));

    // Get next shift
    const nextShiftResult = await db.execute(sql`
      SELECT rs.id, rs.staff_id, rs.date, rs.start_time, rs.end_time, rs.shift_type
      FROM roster_shifts rs
      WHERE rs.date >= ${todayStr}
      ORDER BY rs.date ASC, rs.start_time ASC
      LIMIT 1
    `).catch(() => ({ rows: [] }));

    // Get equipment needing attention
    const equipmentAttentionResult = await db.execute(sql`
      SELECT id, name, type, status, next_service_due FROM equipment 
      WHERE status IN ('maintenance_due', 'out_of_service') AND is_active = true
      ORDER BY next_service_due ASC NULLS LAST
      LIMIT 3
    `).catch(() => ({ rows: [] }));

    const summary = {
      jobs: {
        openCount: parseInt(jobsResult.rows[0]?.count || '0'),
        nextJob: nextJobResult.rows[0] || null,
      },
      hazards: {
        activeCount: parseInt(hazardsResult.rows[0]?.count || '0'),
        topHazards: topHazardsResult.rows || [],
      },
      incidents: {
        recentCount: parseInt(incidentsResult.rows[0]?.count || '0'),
      },
      animals: {
        activeCount: parseInt(animalsResult.rows[0]?.count || '0'),
      },
      equipment: {
        needsAttentionCount: parseInt(equipmentResult.rows[0]?.count || '0'),
        needsAttention: equipmentAttentionResult.rows || [],
      },
      roster: {
        todayShiftsCount: parseInt(shiftsResult.rows[0]?.count || '0'),
        nextShift: nextShiftResult.rows[0] || null,
      },
      generatedAt: new Date().toISOString(),
    };

    res.json(summary);
  } catch (error) {
    logger.error({ error }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

export default router;
