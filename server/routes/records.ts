/**
 * Farm Records API (mounted at /api/records behind requireAuth)
 * One capture flow for inputs and work: fertiliser, spray, feed, baleage, effluent,
 * fencing, jobs done, maintenance, medical, H&S and notes, with tags and evidence.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { FARM_RECORD_TYPES } from '@shared/schema';
import { isAreaGeometry } from '@shared/geo';
import { getFarmId, getUserId, requireFarm } from '../middleware/auth';
import { uploadAttachments } from '../middleware/upload';
import { saveAttachments, toApiAttachment } from '../domain/attachments';
import {
  createRecord,
  getRecord,
  updateRecord,
  deleteRecord,
  listRecords,
  listMappedRecords,
  toApiRecords,
  RecordValidationError,
} from '../domain/records';

const router = Router();
router.use(requireFarm);

router.param('id', (_req, res, next, id) => {
  if (!z.string().uuid().safeParse(id).success) {
    return res.status(404).json({ error: 'Record not found' });
  }
  next();
});

const coordinate = z.coerce.number().min(-180).max(180).nullish();

const recordSchema = z.object({
  type: z.enum(FARM_RECORD_TYPES),
  title: z.string().trim().min(1, 'Give the record a short title').max(255),
  notes: z.string().max(5000).nullish(),
  occurredAt: z.coerce.date().refine(d => d.getTime() <= Date.now() + 5 * 60_000, "Can't be in the future"),
  pastureIds: z.array(z.string().uuid()).max(100).optional(),
  latitude: coordinate,
  longitude: coordinate,
  area: z.any().nullish().refine(v => v == null || isAreaGeometry(v), 'Draw the area with at least 3 points'),
  details: z.record(z.any()).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});

/**
 * Multipart requests (record + files, e.g. from the offline outbox) carry the record as
 * a JSON string in the `data` field; JSON requests carry it as the body
 */
function recordBody(req: Request): unknown {
  if (typeof req.body?.data === 'string') {
    try {
      return JSON.parse(req.body.data);
    } catch {
      throw new z.ZodError([{ code: 'custom', path: ['data'], message: 'data must be JSON' }]);
    }
  }
  return req.body;
}

function withUploads(req: Request, res: Response, next: NextFunction) {
  uploadAttachments(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

function handleError(res: Response, error: unknown, message: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: error.errors });
  }
  if (error instanceof RecordValidationError) {
    return res.status(400).json({ error: error.message });
  }
  console.error(`${message}:`, error);
  res.status(500).json({ error: message });
}

const csv = (v: unknown) => (typeof v === 'string' && v ? v.split(',').map(s => s.trim()).filter(Boolean) : undefined);

// GET /api/records?type=spray,fertiliser&tags=fencing&pastureId=&from=&to=&q=&limit=&offset=
router.get('/', async (req, res) => {
  try {
    const query = z.object({
      pastureId: z.string().uuid().optional(),
      recordedBy: z.string().uuid().optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      q: z.string().max(200).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    }).parse(req.query);
    const records = await listRecords(getFarmId(req)!, {
      ...query,
      types: csv(req.query.type),
      tags: csv(req.query.tags),
    });
    res.json(await toApiRecords(records));
  } catch (error) {
    handleError(res, error, 'Failed to fetch records');
  }
});

// POST /api/records - JSON, or multipart with `data` (JSON) and `files`
router.post('/', withUploads, async (req, res) => {
  try {
    const body = recordBody(req) as Record<string, unknown>;
    const input = recordSchema.parse(body);
    const clientId = z.string().max(64).optional().parse(body?.clientId);
    const farmId = getFarmId(req)!;
    const userId = getUserId(req)!;

    const { record, created } = await createRecord(farmId, userId, input, clientId);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    // A retried offline upload already stored its files the first time
    if (created && files.length > 0) {
      await saveAttachments(farmId, 'record', record.id, files, userId, {
        latitude: input.latitude ?? undefined,
        longitude: input.longitude ?? undefined,
        takenAt: input.occurredAt,
      });
    }
    const [apiRecord] = await toApiRecords([record]);
    res.status(created ? 201 : 200).json(apiRecord);
  } catch (error) {
    handleError(res, error, 'Failed to save record');
  }
});

const daysMs = 24 * 60 * 60 * 1000;
const num = (v: unknown) => (v === '' || v == null || Number.isNaN(Number(v)) ? undefined : Number(v));

/**
 * One-line summary shown on the map, e.g. "Tordon 2.5 L/ha" or "45 bales"
 */
function mapLabel(type: string, d: Record<string, any>): string {
  const rate = num(d.rate) != null ? `${num(d.rate)} ${d.rateUnit ?? (type === 'fertiliser' ? 'kg/ha' : 'L/ha')}` : '';
  switch (type) {
    case 'spray':
    case 'fertiliser':
      return [d.product, rate].filter(Boolean).join(' ');
    case 'baleage':
      return [num(d.bales) != null ? `${num(d.bales)} bales` : '', d.contractor].filter(Boolean).join(' · ');
    case 'effluent':
      return num(d.depthMm) != null ? `${num(d.depthMm)} mm` : '';
    default:
      return '';
  }
}

// GET /api/records/map?type=spray,fertiliser,baleage&from=&to= - drawn areas as GeoJSON
router.get('/map', async (req, res) => {
  try {
    const query = z.object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    }).parse(req.query);
    const records = await listMappedRecords(getFarmId(req)!, { ...query, types: csv(req.query.type) });
    const now = Date.now();
    res.json({
      type: 'FeatureCollection',
      features: records.map(r => {
        const d = r.details ?? {};
        const withholdingDays = r.type === 'spray' ? num(d.withholdingDays) : undefined;
        const withholdingUntil = withholdingDays != null ? new Date(r.occurredAt.getTime() + withholdingDays * daysMs) : undefined;
        return {
          type: 'Feature',
          id: r.id,
          geometry: r.area,
          properties: {
            id: r.id,
            type: r.type,
            title: r.title,
            occurredAt: r.occurredAt.toISOString(),
            areaHa: r.areaHa != null ? Number(r.areaHa) : null,
            label: mapLabel(r.type, d),
            product: d.product ?? null,
            rate: num(d.rate) ?? null,
            rateUnit: d.rateUnit ?? null,
            withholdingUntil: withholdingUntil?.toISOString() ?? null,
            withholdingActive: withholdingUntil ? withholdingUntil.getTime() > now : false,
          },
        };
      }),
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch map records');
  }
});

// GET /api/records/:id
router.get('/:id', async (req, res) => {
  try {
    const record = await getRecord(getFarmId(req)!, req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    const [apiRecord] = await toApiRecords([record]);
    res.json(apiRecord);
  } catch (error) {
    handleError(res, error, 'Failed to fetch record');
  }
});

// PATCH /api/records/:id
router.patch('/:id', async (req, res) => {
  try {
    const input = recordSchema.partial().parse(req.body);
    const record = await updateRecord(getFarmId(req)!, req.params.id, input);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    const [apiRecord] = await toApiRecords([record]);
    res.json(apiRecord);
  } catch (error) {
    handleError(res, error, 'Failed to update record');
  }
});

// DELETE /api/records/:id - hides the record; it stays in the audit history
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteRecord(getFarmId(req)!, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Failed to delete record');
  }
});

// POST /api/records/:id/attachments - add photos, voice notes or documents
router.post('/:id/attachments', withUploads, async (req, res) => {
  try {
    const farmId = getFarmId(req)!;
    const record = await getRecord(farmId, req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) return res.status(400).json({ error: 'Attach at least one file' });
    const meta = z.object({
      caption: z.string().max(500).optional(),
      latitude: z.coerce.number().optional(),
      longitude: z.coerce.number().optional(),
    }).parse(req.body);
    const saved = await saveAttachments(farmId, 'record', record.id, files, getUserId(req)!, meta);
    res.status(201).json(saved.map(toApiAttachment));
  } catch (error) {
    handleError(res, error, 'Failed to attach files');
  }
});

export default router;
