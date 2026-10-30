import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { pastures } from '@shared/schema';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { requireFarm, getFarmId, getUserId } from '../middleware/auth';
import { getFarmRole } from '../domain/farms';
import { areaHectares, isAreaGeometry, type AreaGeometry } from '@shared/geo';
import logger from '../config/logger';

// /api/paddock-map - paddock outlines drawn on the satellite map, for every map in Pulse
const router = Router();
router.use(requireFarm);

/**
 * Middle of a drawn outline (average of its outer ring's corners), as [lat, lng]
 */
export function outlineCenter(area: AreaGeometry): [number, number] {
  const ring = (area.type === 'Polygon' ? area.coordinates[0] : area.coordinates[0][0]).slice(0, -1);
  const lng = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
  const lat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
  return [Number(lat.toFixed(7)), Number(lng.toFixed(7))];
}

// GET /api/paddock-map - the farm's paddocks; those with an outline come as GeoJSON features
router.get('/', async (req, res) => {
  try {
    const rows = await db
      .select({ id: pastures.id, name: pastures.name, paddockNumber: pastures.paddockNumber, area: pastures.area, boundaries: pastures.boundaries, status: pastures.status })
      .from(pastures)
      .where(and(eq(pastures.farmId, getFarmId(req)!), isNull(pastures.deletedAt)))
      .orderBy(asc(pastures.paddockNumber), asc(pastures.name));
    const features = rows
      .filter(p => isAreaGeometry(p.boundaries))
      .map(p => ({
        type: 'Feature' as const,
        id: p.id,
        geometry: p.boundaries as AreaGeometry,
        properties: { id: p.id, name: p.name, paddockNumber: p.paddockNumber, status: p.status, drawnHa: areaHectares(p.boundaries as AreaGeometry) },
      }));
    res.json({
      type: 'FeatureCollection',
      features,
      unmapped: rows.filter(p => !isAreaGeometry(p.boundaries)).map(p => ({ id: p.id, name: p.name })),
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to load paddock map');
    res.status(500).json({ error: 'Failed to load paddock map' });
  }
});

// PUT /api/paddock-map/:id - save (or clear, with area: null) a paddock's outline
router.put('/:id', async (req, res) => {
  try {
    if (!z.string().uuid().safeParse(req.params.id).success) return res.status(404).json({ error: 'Paddock not found' });
    const role = await getFarmRole(getUserId(req)!, getFarmId(req)!);
    if (role !== 'owner' && role !== 'manager') return res.status(403).json({ error: 'Only owners and managers can map paddocks' });
    const { area, setArea } = z.object({
      area: z.any().refine(v => v === null || isAreaGeometry(v), 'Draw the paddock with at least 3 points'),
      // Also replace the paddock's recorded hectares with the drawn ones
      setArea: z.boolean().optional(),
    }).parse(req.body);
    const center = area ? outlineCenter(area) : null;
    const drawnHa = area ? areaHectares(area) : null;
    const [row] = await db
      .update(pastures)
      .set({
        boundaries: area,
        centerLatitude: center ? String(center[0]) : null,
        centerLongitude: center ? String(center[1]) : null,
        ...(setArea && drawnHa != null ? { area: Math.max(1, Math.round(drawnHa)) } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(pastures.id, req.params.id), eq(pastures.farmId, getFarmId(req)!), isNull(pastures.deletedAt)))
      .returning({ id: pastures.id, name: pastures.name, area: pastures.area });
    if (!row) return res.status(404).json({ error: 'Paddock not found' });
    res.json({ ...row, drawnHa, center });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0]?.message ?? 'Invalid outline' });
    logger.error({ err: error }, 'Failed to save paddock outline');
    res.status(500).json({ error: 'Failed to save paddock outline' });
  }
});

export default router;
