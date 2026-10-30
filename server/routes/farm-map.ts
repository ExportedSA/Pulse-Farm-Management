import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireFarm, getFarmId, getUserId } from '../middleware/auth';
import { getFarmRole } from '../domain/farms';
import logger from '../config/logger';
import {
  MapError, mapState, createPaddock, setPaddockBoundary, clearPaddockBoundary, updatePaddockDetails, archivePaddock,
  splitPaddock, mergePaddocks, paddockHistory, createFeature, updateFeature, deleteFeature, createLayer, updateLayer,
  archiveLayer, saveView, deleteView, exportMap, importShapes,
} from '../domain/farm-map';
import { EXCLUSION_ACTIVITIES, createExclusion, updateExclusion, archiveExclusion, listExclusions, paddockAreas } from '../domain/exclusions';
import {
  PLAN_ACTIVITIES, RATE_UNITS, createPlan, updatePlan, getPlan, listPlans, addZone, updateZone, deleteZone, approvePlan, copyPlan, cancelPlan,
} from '../domain/rate-plans';

// /api/farm-map - the farm map: paddock boundaries, layers, drawn features and saved views.
// Everyone on the farm can see it and save views; owners and managers change the map.
const router = Router();
router.use(requireFarm);

const uuid = z.string().uuid();
const geometry = z.object({ type: z.string(), coordinates: z.array(z.any()) }).passthrough();
const name = z.string().trim().min(1, 'Give it a name').max(100);
const note = z.string().trim().max(500).optional().nullable();

async function requireManager(req: Request) {
  const role = await getFarmRole(getUserId(req)!, getFarmId(req)!);
  if (role !== 'owner' && role !== 'manager') throw new MapError('Only owners and managers can change the farm map', 403);
}

function handle(res: Response, error: unknown, message: string) {
  if (error instanceof MapError) return res.status(error.status).json({ error: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0]?.message ?? 'Invalid request', details: error.errors });
  logger.error({ err: error }, message);
  res.status(500).json({ error: message });
}

const route = (fn: (req: Request, res: Response) => Promise<unknown>, message: string) =>
  async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (error) {
      handle(res, error, message);
    }
  };

const ctx = (req: Request) => ({ farmId: getFarmId(req)!, userId: getUserId(req)! });

// GET /api/farm-map - layers, paddocks, features and views
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const today = () => new Date().toISOString().slice(0, 10);

router.get('/', route(async (req, res) => {
  const farmId = getFarmId(req)!;
  const [state, exclusions, plans] = await Promise.all([mapState(farmId), listExclusions(farmId, today()), listPlans(farmId)]);
  res.json({ ...state, exclusions, plans });
}, 'Failed to load the farm map'));

// GET /api/farm-map/paddocks/:id/areas?activity&date - gross, excluded and net hectares
router.get('/paddocks/:id/areas', route(async (req, res) => {
  const q = z.object({ activity: z.enum(EXCLUSION_ACTIVITIES).default('fertiliser'), date: day.optional() }).parse(req.query);
  res.json(await paddockAreas(getFarmId(req)!, uuid.parse(req.params.id), q.activity, q.date ?? today()));
}, 'Failed to work out the areas'));

// ----- Exclusions -----

const exclusionInput = z.object({
  name: name.max(120),
  reason: z.string().max(1000).optional().nullable(),
  activities: z.array(z.enum(EXCLUSION_ACTIVITIES)).min(1, 'Choose which activities it applies to'),
  sourceKind: z.enum(['area', 'around', 'edge']),
  geometry: geometry.optional().nullable(),
  featureId: uuid.optional().nullable(),
  pastureId: uuid.optional().nullable(),
  bufferM: z.number().min(0).max(5000),
  permanent: z.boolean(),
  startsOn: day.optional().nullable(),
  endsOn: day.optional().nullable(),
  requirementSource: z.string().max(500).optional().nullable(),
  confirmedBy: z.string().max(120).optional().nullable(),
  confirmedOn: day.optional().nullable(),
});

router.post('/exclusions', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  res.status(201).json(await createExclusion(farmId, userId, exclusionInput.parse(req.body)));
}, 'Failed to save the exclusion'));

router.patch('/exclusions/:id', route(async (req, res) => {
  await requireManager(req);
  const input = exclusionInput.omit({ sourceKind: true, featureId: true, pastureId: true }).partial().extend({ version: z.number().int().optional() }).parse(req.body);
  const { farmId, userId } = ctx(req);
  await updateExclusion(farmId, userId, uuid.parse(req.params.id), input);
  res.json({ ok: true });
}, 'Failed to update the exclusion'));

router.delete('/exclusions/:id', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  await archiveExclusion(farmId, userId, uuid.parse(req.params.id));
  res.json({ ok: true });
}, 'Failed to remove the exclusion'));

// ----- Variable-rate plans -----

const planInput = z.object({
  name: name.max(120),
  activity: z.enum(PLAN_ACTIVITIES),
  plannedOn: day.optional().nullable(),
  pastureIds: z.array(uuid).max(200).default([]),
  notes: z.string().max(2000).optional().nullable(),
});
const zoneInput = z.object({
  geometry: geometry.optional().nullable(),
  wholePaddockId: uuid.optional().nullable(),
  name: z.string().trim().max(120).optional().nullable(),
  productName: z.string().trim().max(160).optional().nullable(),
  productId: uuid.optional().nullable(),
  rate: z.number().min(0).max(1000000).optional().nullable(),
  rateUnit: z.enum(Object.keys(RATE_UNITS) as [string, ...string[]]).optional(),
});

router.post('/plans', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  res.status(201).json(await createPlan(farmId, userId, planInput.parse(req.body)));
}, 'Failed to start the plan'));

router.get('/plans/:id', route(async (req, res) => {
  res.json(await getPlan(getFarmId(req)!, uuid.parse(req.params.id)));
}, 'Failed to load the plan'));

router.patch('/plans/:id', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  await updatePlan(farmId, userId, uuid.parse(req.params.id), planInput.partial().parse(req.body));
  res.json({ ok: true });
}, 'Failed to update the plan'));

router.post('/plans/:id/zones', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  res.status(201).json(await addZone(farmId, userId, uuid.parse(req.params.id), zoneInput.parse(req.body)));
}, 'Failed to add the zone'));

router.patch('/zones/:id', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  await updateZone(farmId, userId, uuid.parse(req.params.id), zoneInput.omit({ wholePaddockId: true }).parse(req.body));
  res.json({ ok: true });
}, 'Failed to update the zone'));

router.delete('/zones/:id', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  await deleteZone(farmId, userId, uuid.parse(req.params.id));
  res.json({ ok: true });
}, 'Failed to delete the zone'));

router.post('/plans/:id/approve', route(async (req, res) => {
  await requireManager(req);
  const { acceptGaps } = z.object({ acceptGaps: z.boolean().optional() }).parse(req.body ?? {});
  const { farmId, userId } = ctx(req);
  await approvePlan(farmId, userId, uuid.parse(req.params.id), !!acceptGaps);
  res.json(await getPlan(farmId, uuid.parse(req.params.id)));
}, 'Failed to approve the plan'));

router.post('/plans/:id/copy', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  res.status(201).json(await copyPlan(farmId, userId, uuid.parse(req.params.id)));
}, 'Failed to copy the plan'));

router.delete('/plans/:id', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  await cancelPlan(farmId, userId, uuid.parse(req.params.id));
  res.json({ ok: true });
}, 'Failed to cancel the plan'));

// ----- Paddocks -----

router.post('/paddocks', route(async (req, res) => {
  await requireManager(req);
  const input = z.object({ name, paddockNumber: z.number().int().min(0).max(100000).nullable().optional(), geometry, note }).parse(req.body);
  const { farmId, userId } = ctx(req);
  res.status(201).json(await createPaddock(farmId, userId, input));
}, 'Failed to add the paddock'));

router.put('/paddocks/:id/boundary', route(async (req, res) => {
  await requireManager(req);
  const id = uuid.parse(req.params.id);
  const input = z.object({ geometry: geometry.nullable(), note, updateRecordedArea: z.boolean().optional() }).parse(req.body);
  const { farmId, userId } = ctx(req);
  if (input.geometry === null) {
    await clearPaddockBoundary(farmId, userId, id);
    return res.json({ cleared: true });
  }
  res.json(await setPaddockBoundary(farmId, userId, id, input.geometry, input.note, { updateRecordedArea: input.updateRecordedArea }));
}, 'Failed to save the boundary'));

router.patch('/paddocks/:id', route(async (req, res) => {
  await requireManager(req);
  const id = uuid.parse(req.params.id);
  const input = z.object({ name: name.optional(), paddockNumber: z.number().int().min(0).max(100000).nullable().optional() }).parse(req.body);
  const { farmId, userId } = ctx(req);
  await updatePaddockDetails(farmId, userId, id, input);
  res.json({ ok: true });
}, 'Failed to update the paddock'));

router.delete('/paddocks/:id', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  await archivePaddock(farmId, userId, uuid.parse(req.params.id));
  res.json({ ok: true });
}, 'Failed to archive the paddock'));

router.post('/paddocks/:id/split', route(async (req, res) => {
  await requireManager(req);
  const id = uuid.parse(req.params.id);
  const input = z.object({ line: geometry, newName: name }).parse(req.body);
  const { farmId, userId } = ctx(req);
  res.json(await splitPaddock(farmId, userId, id, input.line, input.newName));
}, 'Failed to split the paddock'));

router.post('/paddocks/merge', route(async (req, res) => {
  await requireManager(req);
  const input = z.object({ keepId: uuid, otherIds: z.array(uuid).min(1).max(20) }).parse(req.body);
  const { farmId, userId } = ctx(req);
  res.json(await mergePaddocks(farmId, userId, input.keepId, input.otherIds));
}, 'Failed to merge the paddocks'));

router.get('/paddocks/:id/history', route(async (req, res) => {
  res.json(await paddockHistory(getFarmId(req)!, uuid.parse(req.params.id)));
}, 'Failed to load the boundary history'));

// ----- Features -----

const featureInput = z.object({
  layerId: uuid,
  kind: z.enum(['point', 'line', 'polygon', 'circle']),
  name: z.string().trim().max(120).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  geometry,
  radiusM: z.number().positive().max(100000).optional().nullable(),
  properties: z.record(z.any()).optional(),
});

router.post('/features', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  res.status(201).json(await createFeature(farmId, userId, featureInput.parse(req.body)));
}, 'Failed to save the shape'));

router.patch('/features/:id', route(async (req, res) => {
  await requireManager(req);
  const input = featureInput.omit({ kind: true }).partial().extend({ version: z.number().int().optional() }).parse(req.body);
  const { farmId, userId } = ctx(req);
  await updateFeature(farmId, userId, uuid.parse(req.params.id), input);
  res.json({ ok: true });
}, 'Failed to update the shape'));

router.delete('/features/:id', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  await deleteFeature(farmId, userId, uuid.parse(req.params.id));
  res.json({ ok: true });
}, 'Failed to delete the shape'));

// ----- Layers -----

router.post('/layers', route(async (req, res) => {
  await requireManager(req);
  const input = z.object({ name: name.max(80), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional() }).parse(req.body);
  const { farmId, userId } = ctx(req);
  res.status(201).json(await createLayer(farmId, userId, input));
}, 'Failed to add the layer'));

router.patch('/layers/:id', route(async (req, res) => {
  const input = z.object({
    name: name.max(80).optional(),
    visible: z.boolean().optional(),
    locked: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    style: z.object({
      color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
      fillColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
      fillOpacity: z.number().min(0).max(1).optional(),
      weight: z.number().min(0).max(12).optional(),
      dashArray: z.string().max(20).nullable().optional(),
    }).optional(),
  }).parse(req.body);
  // Showing and hiding is each person's own (kept on their device and in saved views);
  // this sets the farm's default, along with names, order, looks and locks: managers only
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  await updateLayer(farmId, userId, uuid.parse(req.params.id), input);
  res.json({ ok: true });
}, 'Failed to update the layer'));

router.delete('/layers/:id', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  await archiveLayer(farmId, userId, uuid.parse(req.params.id));
  res.json({ ok: true });
}, 'Failed to remove the layer'));

// ----- Saved views -----

router.post('/views', route(async (req, res) => {
  const input = z.object({
    name: name.max(80),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    zoom: z.number().min(0).max(22),
    basemap: z.string().max(20),
    layers: z.record(z.boolean()),
  }).parse(req.body);
  const { farmId, userId } = ctx(req);
  res.status(201).json(await saveView(farmId, userId, input));
}, 'Failed to save the view'));

router.delete('/views/:id', route(async (req, res) => {
  await deleteView(getFarmId(req)!, uuid.parse(req.params.id));
  res.json({ ok: true });
}, 'Failed to delete the view'));

// ----- Import / export -----

router.get('/export.geojson', route(async (req, res) => {
  const q = z.object({ layers: z.string().optional(), paddocks: z.string().optional(), exclusions: z.string().optional() }).parse(req.query);
  const data = await exportMap(getFarmId(req)!, {
    layerIds: q.layers !== undefined ? q.layers.split(',').filter(Boolean) : undefined,
    paddocks: q.paddocks !== '0',
    exclusions: q.exclusions !== '0',
  });
  res.setHeader('Content-Type', 'application/geo+json');
  res.setHeader('Content-Disposition', 'attachment; filename="farm-map.geojson"');
  res.send(JSON.stringify(data));
}, 'Failed to export the map'));

router.post('/import', route(async (req, res) => {
  await requireManager(req);
  const input = z.object({
    as: z.enum(['paddocks', 'layer']),
    layerId: uuid.optional(),
    items: z.array(z.object({
      geometry,
      name: z.string().max(200).optional().nullable(),
      paddockNumber: z.number().int().optional().nullable(),
    })).min(1).max(500),
  }).refine(v => v.as === 'paddocks' || !!v.layerId, { message: 'Choose a layer to import into' }).parse(req.body);
  const { farmId, userId } = ctx(req);
  res.json(await importShapes(farmId, userId, input));
}, 'Failed to import'));

export default router;
