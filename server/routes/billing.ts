/**
 * Billing (mounted at /api/billing). The farm is the one the user is working in.
 *   GET  /            what the farm pays and where its trial or subscription stands (any member)
 *   POST /checkout    a Stripe Checkout page to subscribe (owner)
 *   POST /portal      Stripe's billing portal: card, invoices, cancelling (owner)
 *   POST /webhook     Stripe's notices of payments and subscription changes (open; signed by Stripe)
 */
import { Router, type Request, type Response } from 'express';
import { getFarmId, getUserId } from '../middleware/auth';
import { getFarmRole } from '../domain/farms';
import { BillingError, billingSummary, startCheckout, startPortal, verifyWebhook, handleStripeEvent } from '../domain/billing';

const router = Router();

function failed(res: Response, error: unknown, what: string) {
  if (error instanceof BillingError) return res.status(error.status).json({ error: error.message });
  console.error(`[billing] ${what}:`, error);
  res.status(500).json({ error: `Failed ${what}` });
}

async function farmAndRole(req: Request, res: Response) {
  const farmId = getFarmId(req);
  const userId = getUserId(req);
  const role = farmId && userId ? await getFarmRole(userId, farmId) : undefined;
  if (!farmId || !role) {
    res.status(404).json({ error: 'No farm selected' });
    return null;
  }
  return { farmId, role };
}

router.post('/webhook', async (req, res) => {
  let event;
  try {
    const raw = (req as any).rawBody;
    if (!Buffer.isBuffer(raw)) return res.status(400).json({ error: 'Expected the raw request body' });
    event = verifyWebhook(raw, req.header('stripe-signature'));
  } catch (error) {
    if (error instanceof BillingError) return res.status(error.status).json({ error: error.message });
    return res.status(400).json({ error: 'Invalid Stripe signature' });
  }
  try {
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (error) {
    // A 500 makes Stripe send it again later
    failed(res, error, `handling Stripe event ${event.type}`);
  }
});

router.get('/', async (req, res) => {
  try {
    const m = await farmAndRole(req, res);
    if (!m) return;
    res.json({ ...(await billingSummary(m.farmId)), canManage: m.role === 'owner' });
  } catch (error) {
    failed(res, error, 'loading billing');
  }
});

router.post('/checkout', async (req, res) => {
  try {
    const m = await farmAndRole(req, res);
    if (!m) return;
    if (m.role !== 'owner') return res.status(403).json({ error: "Only the farm's owner can subscribe" });
    res.json({ url: await startCheckout(m.farmId) });
  } catch (error) {
    failed(res, error, 'starting checkout');
  }
});

router.post('/portal', async (req, res) => {
  try {
    const m = await farmAndRole(req, res);
    if (!m) return;
    if (m.role !== 'owner') return res.status(403).json({ error: "Only the farm's owner can manage billing" });
    res.json({ url: await startPortal(m.farmId) });
  } catch (error) {
    failed(res, error, 'opening the billing portal');
  }
});

export default router;
