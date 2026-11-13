import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireFarm, getFarmId, getUserId } from '../middleware/auth';
import { uploadAttachments } from '../middleware/upload';
import { STOCK_MOVEMENT_TYPES } from '@shared/stock';
import {
  StockError, adjustToCount, closeSeason, createMovement, deleteMovement, recordCount, reopenSeason, seasonReport,
  setBalanceDate, setOpening, startSeason, stockView, updateMovementAsd,
} from '../domain/stock';
import logger from '../config/logger';

// /api/stock-recon - stock seasons, tallies, movements (by hand with their ASDs, and from the
// animal register) and the checks against them, for the current farm
const router = Router();
router.use(requireFarm);

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be yyyy-mm-dd')
  .refine(d => new Date(d).getTime() <= Date.now() + 24 * 60 * 60 * 1000, "Can't be in the future");
const stockClass = z.string().trim().min(1).max(50);
const uuid = z.string().uuid();

const movementSchema = z.object({
  type: z.enum(STOCK_MOVEMENT_TYPES),
  date: day,
  asdNumber: z.string().trim().max(50).nullish(),
  otherParty: z.string().trim().max(255).nullish(),
  otherPartyNait: z.string().trim().max(50).nullish(),
  notes: z.string().max(2000).nullish(),
  lines: z.array(z.object({
    stockClass,
    // Adjustments may take stock off (negative); everything else is a head count
    quantity: z.number().int().refine(q => q !== 0, 'Enter how many head'),
  })).min(1, 'Add at least one line: class and number of head').max(20),
}).refine(m => m.type === 'adjustment' || m.lines.every(l => l.quantity > 0), {
  message: 'Head counts must be more than 0', path: ['lines'],
});

const asdSchema = z.object({
  asdNumber: z.string().trim().max(50).nullish(),
  otherParty: z.string().trim().max(255).nullish(),
  otherPartyNait: z.string().trim().max(50).nullish(),
});

const countSchema = z.object({
  kind: z.enum(['stocktake', 'nait']).default('stocktake'),
  stockClass: stockClass.nullish(),
  count: z.number().int().min(0),
  countedAt: day,
  notes: z.string().max(2000).nullish(),
});

const openingSchema = z.record(stockClass, z.number().int().min(0));

function handleError(res: Response, error: unknown, message: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: error.errors[0]?.message ?? 'Validation failed', details: error.errors });
  }
  if (error instanceof StockError) return res.status(400).json({ error: error.message });
  if (error instanceof SyntaxError) return res.status(400).json({ error: 'data must be JSON' });
  logger.error({ err: error }, message);
  res.status(500).json({ error: message });
}

function withUploads(req: Request, res: Response, next: NextFunction) {
  uploadAttachments(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

// Multipart forms carry their fields as JSON in `data`
const bodyOf = (req: Request) => (typeof req.body?.data === 'string' ? JSON.parse(req.body.data) : req.body);
const notFound = (res: Response) => res.status(404).json({ error: 'Not found' });

// GET /api/stock-recon?season=<id> - a season's tallies, checks and movements (this season by default)
router.get('/', async (req, res) => {
  try {
    const season = typeof req.query.season === 'string' && uuid.safeParse(req.query.season).success ? req.query.season : undefined;
    res.json(await stockView(getFarmId(req)!, season));
  } catch (error) {
    handleError(res, error, 'Failed to load stock reconciliation');
  }
});

// PUT /api/stock-recon/balance-date - the day each season ends (MM-DD), before the first season
router.put('/balance-date', async (req, res) => {
  try {
    const { balanceDate } = z.object({ balanceDate: z.string() }).parse(req.body);
    await setBalanceDate(getFarmId(req)!, balanceDate);
    res.json({ balanceDate });
  } catch (error) {
    handleError(res, error, 'Failed to save the balance date');
  }
});

// POST /api/stock-recon/seasons - start the first season with its opening numbers
router.post('/seasons', async (req, res) => {
  try {
    const input = z.object({ startsOn: day, opening: openingSchema }).parse(req.body);
    res.status(201).json(await startSeason(getFarmId(req)!, getUserId(req)!, input));
  } catch (error) {
    handleError(res, error, 'Failed to start the season');
  }
});

// PUT /api/stock-recon/seasons/:id/opening - correct the first season's opening numbers
router.put('/seasons/:id/opening', async (req, res) => {
  try {
    if (!uuid.safeParse(req.params.id).success) return notFound(res);
    const season = await setOpening(getFarmId(req)!, req.params.id, openingSchema.parse(req.body?.opening));
    if (!season) return notFound(res);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Failed to save the opening numbers');
  }
});

// POST /api/stock-recon/seasons/:id/close - close on the closing numbers and open the next season
router.post('/seasons/:id/close', async (req, res) => {
  try {
    if (!uuid.safeParse(req.params.id).success) return notFound(res);
    const result = await closeSeason(getFarmId(req)!, getUserId(req)!, req.params.id);
    if (!result) return notFound(res);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to close the season');
  }
});

// POST /api/stock-recon/seasons/:id/reopen - reopen the latest closed season to correct it
router.post('/seasons/:id/reopen', async (req, res) => {
  try {
    if (!uuid.safeParse(req.params.id).success) return notFound(res);
    if (!(await reopenSeason(getFarmId(req)!, req.params.id))) return notFound(res);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Failed to reopen the season');
  }
});

// GET /api/stock-recon/seasons/:id/report - the season's numbers per class, for the accounts
router.get('/seasons/:id/report', async (req, res) => {
  try {
    if (!uuid.safeParse(req.params.id).success) return notFound(res);
    const report = await seasonReport(getFarmId(req)!, req.params.id);
    if (!report) return notFound(res);
    res.json(report);
  } catch (error) {
    handleError(res, error, 'Failed to load the season report');
  }
});

// POST /api/stock-recon/movements - JSON, or multipart with `data` (JSON) and ASD photos in `files`
router.post('/movements', withUploads, async (req, res) => {
  try {
    const input = movementSchema.parse(bodyOf(req));
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const id = await createMovement(getFarmId(req)!, getUserId(req)!, input, files);
    res.status(201).json({ id });
  } catch (error) {
    handleError(res, error, 'Failed to save stock movement');
  }
});

// PATCH /api/stock-recon/movements/:id - add or correct the ASD details and photo
router.patch('/movements/:id', withUploads, async (req, res) => {
  try {
    if (!uuid.safeParse(req.params.id).success) return notFound(res);
    const input = asdSchema.parse(bodyOf(req));
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!(await updateMovementAsd(getFarmId(req)!, getUserId(req)!, req.params.id, input, files))) return notFound(res);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Failed to save the ASD details');
  }
});

// DELETE /api/stock-recon/movements/:id - hides a movement entered by hand (kept for audit history)
router.delete('/movements/:id', async (req, res) => {
  try {
    if (!uuid.safeParse(req.params.id).success) return notFound(res);
    if (!(await deleteMovement(getFarmId(req)!, req.params.id))) return notFound(res);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Failed to delete stock movement');
  }
});

// POST /api/stock-recon/counts - a stocktake of one class, or NAIT's count for the farm's location
router.post('/counts', async (req, res) => {
  try {
    res.status(201).json(await recordCount(getFarmId(req)!, getUserId(req)!, countSchema.parse(req.body)));
  } catch (error) {
    handleError(res, error, 'Failed to save stock count');
  }
});

// POST /api/stock-recon/counts/:id/adjust - make the tally agree with a stocktake
router.post('/counts/:id/adjust', async (req, res) => {
  try {
    if (!uuid.safeParse(req.params.id).success) return notFound(res);
    const result = await adjustToCount(getFarmId(req)!, getUserId(req)!, req.params.id);
    if (!result) return notFound(res);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Failed to adjust the tally');
  }
});

export default router;
