import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireFarm, getFarmId, getUserId } from '../middleware/auth';
import { uploadAttachments } from '../middleware/upload';
import { getFarmRole } from '../domain/farms';
import logger from '../config/logger';
import { MapError } from '../domain/farm-map';
import {
  PRODUCT_KINDS, FERTILISER_CATEGORIES, SPRAY_CATEGORIES, searchCatalogue, getProduct, catalogueSources,
  createCustomProduct, updateCustomProduct, archiveCustomProduct, setProductPref,
} from '../domain/catalogue';
import {
  STATUSES, ACTIVITIES, FERTILISER_UNITS, createApplication, updateApplication, setApplied, setSprayUsed, cancelApplication, getApplication,
  listApplications, createDocket, linkDocket, unlinkDocket, searchDockets,
} from '../domain/applications';
import {
  SPRAY_UNITS, QTY_UNITS, RESTRICTION_KINDS, RESTRICTION_STATUSES, addRestriction, updateRestriction, deleteRestriction, activeRestrictions,
} from '../domain/sprays';

// /api/catalogue (products), /api/applications (jobs) and /api/dockets.
// Viewers look; everyone else on the farm records work and adds farm-entered products;
// owners and managers change or archive products.

const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const when = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/));
const geometry = z.object({ type: z.string(), coordinates: z.array(z.any()) }).passthrough();
const text = (max: number) => z.string().trim().max(max).optional().nullable();

async function role(req: Request) {
  return getFarmRole(getUserId(req)!, getFarmId(req)!);
}
async function requireRecorder(req: Request) {
  const r = await role(req);
  if (!r || r === 'viewer') throw new MapError('Viewers can look but not record', 403);
}
async function requireManager(req: Request) {
  const r = await role(req);
  if (r !== 'owner' && r !== 'manager') throw new MapError('Only owners and managers can do that', 403);
}

function handle(res: Response, error: unknown, message: string) {
  if (error instanceof MapError) return res.status(error.status).json({ error: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0]?.message ?? 'Invalid request', details: error.errors });
  logger.error({ err: error }, message);
  res.status(500).json({ error: message });
}
const route = (fn: (req: Request, res: Response) => Promise<unknown>, message: string) =>
  async (req: Request, res: Response) => { try { await fn(req, res); } catch (error) { handle(res, error, message); } };
const ctx = (req: Request) => ({ farmId: getFarmId(req)!, userId: getUserId(req)! });

function withUploads(req: Request, res: Response, next: NextFunction) {
  uploadAttachments(req, res, (err: any) => (err ? res.status(400).json({ error: err.message }) : next()));
}
const bodyOf = (req: Request) => (typeof req.body?.data === 'string' ? JSON.parse(req.body.data) : req.body);

// ===== Catalogue =====

export const catalogueRouter = Router();
catalogueRouter.use(requireFarm);

catalogueRouter.get('/', route(async (req, res) => {
  const q = z.object({ kind: z.enum(PRODUCT_KINDS).default('fertiliser'), q: z.string().max(100).optional(), limit: z.coerce.number().int().min(1).max(200).optional(), archived: z.string().optional() }).parse(req.query);
  res.json(await searchCatalogue(getFarmId(req)!, { kind: q.kind, q: q.q, limit: q.limit, includeArchived: q.archived === '1' }));
}, 'Failed to search products'));

catalogueRouter.get('/sources', route(async (_req, res) => {
  res.json(await catalogueSources());
}, 'Failed to load the catalogue sources'));

catalogueRouter.get('/:id', route(async (req, res) => {
  res.json(await getProduct(getFarmId(req)!, uuid.parse(req.params.id)));
}, 'Failed to load the product'));

const nutrient = z.number().min(0).max(100).optional().nullable();
const productInput = z.object({
  kind: z.enum(PRODUCT_KINDS),
  name: z.string().trim().min(1, 'Give the product a name').max(160),
  supplier: text(120),
  category: z.enum([...FERTILISER_CATEGORIES, ...SPRAY_CATEGORIES] as [string, ...string[]]).optional().nullable(),
  formulation: text(60),
  units: z.array(z.string().max(10)).max(8).optional(),
  analysis: z.object({ basis: z.enum(['elemental', 'oxide']), N: nutrient, P: nutrient, K: nutrient, S: nutrient, Mg: nutrient, Ca: nutrient }).optional(),
  activeIngredients: z.array(z.object({ name: z.string().trim().min(1).max(120), concentration: z.number().min(0).optional().nullable(), unit: text(20) })).max(10).optional(),
  registrationNumber: text(40),
  epaApproval: text(40),
  labelUrl: z.string().url().max(500).optional().nullable(),
  sdsUrl: z.string().url().max(500).optional().nullable(),
  notes: text(2000),
  blend: z.array(z.object({ productId: uuid, percent: z.number().positive().max(100) })).max(12).optional(),
  nickname: text(80),
});

catalogueRouter.post('/', route(async (req, res) => {
  await requireRecorder(req);
  const { farmId, userId } = ctx(req);
  res.status(201).json(await createCustomProduct(farmId, userId, productInput.parse(req.body)));
}, 'Failed to add the product'));

catalogueRouter.patch('/:id', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  await updateCustomProduct(farmId, userId, uuid.parse(req.params.id), productInput.partial().parse(req.body));
  res.json({ ok: true });
}, 'Failed to update the product'));

catalogueRouter.delete('/:id', route(async (req, res) => {
  await requireManager(req);
  await archiveCustomProduct(getFarmId(req)!, uuid.parse(req.params.id));
  res.json({ ok: true });
}, 'Failed to archive the product'));

catalogueRouter.put('/:id/pref', route(async (req, res) => {
  await requireRecorder(req);
  const input = z.object({ favourite: z.boolean().optional(), nickname: text(80) }).parse(req.body);
  await setProductPref(getFarmId(req)!, uuid.parse(req.params.id), input);
  res.json({ ok: true });
}, 'Failed to save'));

// ===== Jobs =====

export const applicationsRouter = Router();
applicationsRouter.use(requireFarm);

const lineInput = z.object({
  pastureId: uuid.optional().nullable(),
  geometry: geometry.optional().nullable(),
  name: text(120),
  productId: uuid.optional().nullable(),
  rate: z.number().min(0).max(1000000).optional().nullable(),
  rateUnit: z.enum(Object.keys(FERTILISER_UNITS) as [string, ...string[]]).optional(),
  appliedQuantity: z.number().min(0).max(100000000).optional().nullable(),
});
const mixInput = z.object({
  productId: uuid,
  role: z.enum(['product', 'adjuvant']).optional(),
  rate: z.number().min(0).max(1000000).optional().nullable(),
  rateUnit: z.enum(Object.keys(SPRAY_UNITS) as [string, ...string[]]),
  labelRef: text(500),
  actualQuantity: z.number().min(0).max(100000000).optional().nullable(),
  actualUnit: z.enum(QTY_UNITS).optional().nullable(),
});
const optNum = (max: number) => z.number().min(0).max(max).optional().nullable();
const appInput = z.object({
  activity: z.enum(ACTIVITIES).optional(),
  status: z.enum(STATUSES).optional(),
  title: text(160),
  plannedOn: day.optional().nullable(),
  startedAt: when.optional().nullable(),
  completedAt: when.optional().nullable(),
  evidence: z.enum(['planned', 'manual', 'gps']).optional(),
  planId: uuid.optional().nullable(),
  supplier: text(160), contractor: text(160), operator: text(120), equipment: text(160),
  weather: text(1000), notes: text(4000),
  cost: z.number().min(0).max(100000000).optional().nullable(),
  clientId: z.string().max(64).optional().nullable(),
  lines: z.array(lineInput).max(200).optional(),
  version: z.number().int().optional(),
  mix: z.array(mixInput).max(12).optional(),
  crop: text(160), target: text(240), operatorCert: text(80),
  waterRate: optNum(100000), tankVolume: optNum(100000), tankLoads: optNum(10000),
  windSpeed: optNum(300), windDirection: z.enum(['Calm', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'Variable']).optional().nullable(),
  temperature: z.number().min(-30).max(60).optional().nullable(),
});

applicationsRouter.get('/', route(async (req, res) => {
  const q = z.object({ activity: z.string().max(20).optional(), status: z.enum(STATUSES).optional(), from: day.optional(), to: day.optional(), pastureId: uuid.optional() }).parse(req.query);
  res.json(await listApplications(getFarmId(req)!, q));
}, 'Failed to load jobs'));

applicationsRouter.post('/', route(async (req, res) => {
  await requireRecorder(req);
  const { farmId, userId } = ctx(req);
  const r = await createApplication(farmId, userId, appInput.parse(req.body));
  res.status(r.created ? 201 : 200).json(await getApplication(farmId, r.id));
}, 'Failed to save the job'));

applicationsRouter.get('/:id', route(async (req, res) => {
  res.json(await getApplication(getFarmId(req)!, uuid.parse(req.params.id)));
}, 'Failed to load the job'));

applicationsRouter.patch('/:id', route(async (req, res) => {
  await requireRecorder(req);
  const { farmId, userId } = ctx(req);
  const id = uuid.parse(req.params.id);
  await updateApplication(farmId, userId, id, appInput.parse(req.body));
  res.json(await getApplication(farmId, id));
}, 'Failed to update the job'));

applicationsRouter.put('/:id/applied', route(async (req, res) => {
  await requireRecorder(req);
  const { farmId, userId } = ctx(req);
  const id = uuid.parse(req.params.id);
  const input = z.array(z.object({ lineId: uuid, quantity: z.number().min(0).nullable() })).max(200).parse(req.body);
  await setApplied(farmId, userId, id, input);
  res.json(await getApplication(farmId, id));
}, 'Failed to save the applied amounts'));

applicationsRouter.put('/:id/used', route(async (req, res) => {
  await requireRecorder(req);
  const { farmId, userId } = ctx(req);
  const id = uuid.parse(req.params.id);
  const input = z.object({
    tankLoads: optNum(10000),
    used: z.array(z.object({ mixId: uuid, quantity: z.number().min(0).nullable(), unit: z.enum(QTY_UNITS).nullable() })).max(12),
  }).parse(req.body);
  await setSprayUsed(farmId, userId, id, input);
  res.json(await getApplication(farmId, id));
}, 'Failed to save the quantities used'));

const restrictionInput = z.object({
  kind: z.enum(RESTRICTION_KINDS).optional(),
  mixId: uuid.optional().nullable(),
  status: z.enum(RESTRICTION_STATUSES),
  periodValue: z.number().min(0).max(10000).optional().nullable(),
  periodUnit: z.enum(['hours', 'days']).optional().nullable(),
  appliesTo: text(160), ruleSource: text(1000), notes: text(2000),
});

// Restrictions: anyone recording can enter what the label says; the end date is worked out
applicationsRouter.post('/:id/restrictions', route(async (req, res) => {
  await requireRecorder(req);
  const { farmId, userId } = ctx(req);
  const id = uuid.parse(req.params.id);
  await addRestriction(farmId, userId, id, restrictionInput.parse(req.body));
  res.status(201).json(await getApplication(farmId, id));
}, 'Failed to add the restriction'));

applicationsRouter.put('/:id/restrictions/:rid', route(async (req, res) => {
  await requireRecorder(req);
  const { farmId, userId } = ctx(req);
  const id = uuid.parse(req.params.id);
  await updateRestriction(farmId, userId, id, uuid.parse(req.params.rid), restrictionInput.parse(req.body));
  res.json(await getApplication(farmId, id));
}, 'Failed to save the restriction'));

applicationsRouter.delete('/:id/restrictions/:rid', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  const id = uuid.parse(req.params.id);
  await deleteRestriction(farmId, userId, id, uuid.parse(req.params.rid));
  res.json(await getApplication(farmId, id));
}, 'Failed to remove the restriction'));

applicationsRouter.delete('/:id', route(async (req, res) => {
  await requireManager(req);
  const { farmId, userId } = ctx(req);
  await cancelApplication(farmId, userId, uuid.parse(req.params.id));
  res.json({ ok: true });
}, 'Failed to cancel the job'));

const docketInput = z.object({
  number: z.string().trim().min(1, 'Enter the docket number').max(60),
  supplier: text(160),
  docketDate: day.optional().nullable(),
  productId: uuid.optional().nullable(),
  productName: text(160),
  quantity: z.number().min(0).max(100000000).optional().nullable(),
  unit: z.enum(['kg', 't', 'L']).optional().nullable(),
  cost: z.number().min(0).max(100000000).optional().nullable(),
  notes: text(2000),
});

// POST /api/applications/:id/dockets - attach a new docket (multipart: data + files), or link one: { docketId, quantity }
applicationsRouter.post('/:id/dockets', withUploads, route(async (req, res) => {
  await requireRecorder(req);
  const { farmId, userId } = ctx(req);
  const id = uuid.parse(req.params.id);
  const body = bodyOf(req);
  const quantity = z.number().min(0).nullable().optional().parse(body?.allocated ?? null) ?? null;
  let docketId: string;
  if (body?.docketId) {
    docketId = uuid.parse(body.docketId);
  } else {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    docketId = (await createDocket(farmId, userId, docketInput.parse(body), files)).id;
  }
  await linkDocket(farmId, userId, id, docketId, quantity);
  res.status(201).json(await getApplication(farmId, id));
}, 'Failed to attach the docket'));

applicationsRouter.delete('/:id/dockets/:docketId', route(async (req, res) => {
  await requireRecorder(req);
  const { farmId, userId } = ctx(req);
  const id = uuid.parse(req.params.id);
  await unlinkDocket(farmId, userId, id, uuid.parse(req.params.docketId));
  res.json(await getApplication(farmId, id));
}, 'Failed to remove the docket'));

// GET /api/restrictions?pastureId&at&kind=grazing,harvest - restrictions in force (unresolved ones count)
export const restrictionsRouter = Router();
restrictionsRouter.use(requireFarm);
restrictionsRouter.get('/', route(async (req, res) => {
  const q = z.object({ pastureId: uuid.optional(), at: when.optional(), kind: z.string().max(60).optional() }).parse(req.query);
  const kinds = q.kind ? q.kind.split(',').filter(k => (RESTRICTION_KINDS as readonly string[]).includes(k)) : undefined;
  res.json(await activeRestrictions(getFarmId(req)!, { pastureId: q.pastureId, at: q.at ? new Date(q.at).toISOString() : undefined, kinds }));
}, 'Failed to check restrictions'));

export const docketsRouter = Router();
docketsRouter.use(requireFarm);
docketsRouter.get('/', route(async (req, res) => {
  const { q } = z.object({ q: z.string().max(60).default('') }).parse(req.query);
  res.json(await searchDockets(getFarmId(req)!, q));
}, 'Failed to search dockets'));
