import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireFarm, getFarmId, getUserId } from '../middleware/auth';
import { uploadAttachments } from '../middleware/upload';
import { STOCK_MOVEMENT_TYPES } from '@shared/stock';
import { createMovement, deleteMovement, recordCount, stockReconciliation } from '../domain/stock';
import logger from '../config/logger';

// /api/stock-recon - stock tallies, ASD movements and stocktakes for the current farm
const router = Router();
router.use(requireFarm);

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be yyyy-mm-dd')
  .refine(d => new Date(d).getTime() <= Date.now() + 24 * 60 * 60 * 1000, "Can't be in the future");

const movementSchema = z.object({
  type: z.enum(STOCK_MOVEMENT_TYPES),
  date: day,
  asdNumber: z.string().trim().max(50).nullish(),
  otherParty: z.string().trim().max(255).nullish(),
  otherPartyNait: z.string().trim().max(50).nullish(),
  notes: z.string().max(2000).nullish(),
  lines: z.array(z.object({
    stockClass: z.string().trim().min(1).max(50),
    // Adjustments may take stock off (negative); everything else is a head count
    quantity: z.number().int().refine(q => q !== 0, 'Enter how many head'),
  })).min(1, 'Add at least one line: class and number of head').max(20),
}).refine(m => m.type === 'adjustment' || m.lines.every(l => l.quantity > 0), {
  message: 'Head counts must be more than 0', path: ['lines'],
});

const countSchema = z.object({
  stockClass: z.string().trim().min(1).max(50),
  count: z.number().int().min(0),
  countedAt: day,
  notes: z.string().max(2000).nullish(),
});

function handleError(res: Response, error: unknown, message: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: error.errors[0]?.message ?? 'Validation failed', details: error.errors });
  }
  logger.error({ err: error }, message);
  res.status(500).json({ error: message });
}

function withUploads(req: Request, res: Response, next: NextFunction) {
  uploadAttachments(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

// GET /api/stock-recon - tallies per class, register count, recent movements
router.get('/', async (req, res) => {
  try {
    res.json(await stockReconciliation(getFarmId(req)!));
  } catch (error) {
    handleError(res, error, 'Failed to load stock reconciliation');
  }
});

// POST /api/stock-recon/movements - JSON, or multipart with `data` (JSON) and ASD photos in `files`
router.post('/movements', withUploads, async (req, res) => {
  try {
    const body = typeof req.body?.data === 'string' ? JSON.parse(req.body.data) : req.body;
    const input = movementSchema.parse(body);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const id = await createMovement(getFarmId(req)!, getUserId(req)!, input, files);
    res.status(201).json({ id });
  } catch (error) {
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'data must be JSON' });
    handleError(res, error, 'Failed to save stock movement');
  }
});

// DELETE /api/stock-recon/movements/:id - hides a movement (kept for audit history)
router.delete('/movements/:id', async (req, res) => {
  try {
    if (!z.string().uuid().safeParse(req.params.id).success) return res.status(404).json({ error: 'Not found' });
    const deleted = await deleteMovement(getFarmId(req)!, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Failed to delete stock movement');
  }
});

// POST /api/stock-recon/counts - a stocktake for one class
router.post('/counts', async (req, res) => {
  try {
    const input = countSchema.parse(req.body);
    res.status(201).json(await recordCount(getFarmId(req)!, getUserId(req)!, input));
  } catch (error) {
    handleError(res, error, 'Failed to save stock count');
  }
});

export default router;
