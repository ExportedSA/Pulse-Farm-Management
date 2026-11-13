/**
 * Billing: a 30-day free trial with no card, then a Stripe subscription.
 *
 * Prices (NZD, plus GST at 15%), set by the business:
 * - a one-off onboarding fee by the farm's area as the owner gives it: under 300 ha $500,
 *   300 to 500 ha $800, over 500 ha $1,200; charged on the first invoice when the farm subscribes;
 * - $1.80 per cow per year, billed monthly ($0.15 per cow a month), where cows are the active
 *   females in the farm's animal register. The count is sent to Stripe every day, so each monthly
 *   invoice uses the count from (at most a day before) its billing date.
 *
 * The Stripe prices and the GST tax rate live in Stripe and are found by lookup key and metadata
 * (scripts/stripe-setup.ts makes them). A farm without a paid-up subscription after its trial is
 * read-only (see middleware/read-only.ts); nothing is deleted.
 */
import Stripe from 'stripe';
import { and, eq, sql } from 'drizzle-orm';
import { systemDb } from '../db';
import { farms, farmMembers, users } from '@shared/schema';
import { farmBilling, type FarmBilling } from '@shared/platform-schema';
import { appUrl } from './accounts';

import {
  TRIAL_DAYS, GST_RATE, PER_COW_YEAR_CENTS, PER_COW_MONTH_CENTS, ONBOARDING_FEE_CENTS, LOOKUP_KEYS, GST_METADATA,
  feeBand, type FeeBand,
} from '@shared/billing-prices';

// The prices themselves are in shared/billing-prices.ts
export { TRIAL_DAYS, GST_RATE, PER_COW_YEAR_CENTS, PER_COW_MONTH_CENTS, ONBOARDING_FEE_CENTS, LOOKUP_KEYS, GST_METADATA, feeBand, type FeeBand };

// Stripe statuses where the farm is paid up (past_due: Stripe is still retrying the card)
const PAID_STATUSES = new Set(['active', 'trialing', 'past_due']);

export type BillingState = 'trial' | 'active' | 'read_only';

export function billingState(row: Pick<FarmBilling, 'trialEndsAt' | 'subscriptionStatus'>, now = new Date()): BillingState {
  if (row.subscriptionStatus && PAID_STATUSES.has(row.subscriptionStatus)) return 'active';
  if (row.trialEndsAt > now) return 'trial';
  return 'read_only';
}

/** Billing is switched on when Stripe is set up. Without it (development) nothing is read-only. */
export const billingEnabled = () => !!process.env.STRIPE_SECRET_KEY || process.env.BILLING_ENFORCED === '1';

let stripeClient: Stripe | null = null;
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new BillingError(503, 'Billing is not set up on this server yet');
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}
/** For tests: use a stand-in for the Stripe API */
export function setStripeForTests(client: Stripe | null) { stripeClient = client; }

export class BillingError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** The farm's billing row, made (with a trial from the farm's creation) the first time it's needed */
export async function getBilling(farmId: string): Promise<FarmBilling> {
  const [row] = await systemDb.select().from(farmBilling).where(eq(farmBilling.farmId, farmId));
  if (row) return row;
  const [farm] = await systemDb.select({ createdAt: farms.createdAt }).from(farms).where(eq(farms.id, farmId));
  if (!farm) throw new BillingError(404, 'Farm not found');
  const trialEndsAt = new Date(Math.max(farm.createdAt.getTime(), Date.now() - TRIAL_DAYS * 86_400_000) + TRIAL_DAYS * 86_400_000);
  const [created] = await systemDb.insert(farmBilling).values({ farmId, trialEndsAt })
    .onConflictDoNothing({ target: farmBilling.farmId }).returning();
  return created ?? (await systemDb.select().from(farmBilling).where(eq(farmBilling.farmId, farmId)))[0];
}

/** Cows billed on: active females in the animal register */
export async function countCows(farmId: string): Promise<number> {
  const result: any = await systemDb.execute(sql`
    SELECT count(*)::int AS n FROM animals
    WHERE farm_id = ${farmId} AND status = 'active' AND sex = 'female' AND deleted_at IS NULL`);
  return (result.rows ?? result)[0]?.n ?? 0;
}

// Read-only checks run on every change a user makes, so each farm's answer is kept for a minute
const stateCache = new Map<string, { state: BillingState; at: number }>();
export function forgetBillingState(farmId: string) { stateCache.delete(farmId); }
export async function cachedBillingState(farmId: string): Promise<BillingState> {
  const hit = stateCache.get(farmId);
  if (hit && Date.now() - hit.at < 60_000) return hit.state;
  const state = billingState(await getBilling(farmId));
  stateCache.set(farmId, { state, at: Date.now() });
  return state;
}

/** What the billing screen shows */
export async function billingSummary(farmId: string) {
  const row = await getBilling(farmId);
  const [farm] = await systemDb.select({ settings: farms.settings }).from(farms).where(eq(farms.id, farmId));
  const areaHa = (farm?.settings as any)?.areaHa ?? null;
  const band = feeBand(areaHa);
  const cows = await countCows(farmId);
  const state = billingState(row);
  return {
    state,
    enabled: billingEnabled(),
    trialEndsAt: row.trialEndsAt,
    subscriptionStatus: row.subscriptionStatus,
    currentPeriodEnd: row.currentPeriodEnd,
    hasCustomer: !!row.stripeCustomerId,
    onboardingFeePaidAt: row.onboardingFeePaidAt,
    areaHa,
    feeBand: band,
    onboardingFeeCents: band ? ONBOARDING_FEE_CENTS[band] : null,
    cows,
    perCowYearCents: PER_COW_YEAR_CENTS,
    perCowMonthCents: PER_COW_MONTH_CENTS,
    monthlyCents: cows * PER_COW_MONTH_CENTS,
    gstRate: GST_RATE,
  };
}

// The Stripe prices and tax rate, found once by lookup key / metadata
let catalogue: { perCow: string; onboarding: Record<FeeBand, string>; gst: string } | null = null;
export function forgetCatalogue() { catalogue = null; }
async function stripeCatalogue() {
  if (catalogue) return catalogue;
  const s = stripe();
  const keys = [LOOKUP_KEYS.perCow, ...Object.values(LOOKUP_KEYS.onboarding)];
  const prices = await s.prices.list({ lookup_keys: keys, active: true, limit: 10 });
  const byKey = new Map(prices.data.map(p => [p.lookup_key, p.id]));
  const rates = await s.taxRates.list({ active: true, limit: 100 });
  const gst = rates.data.find(r => r.metadata?.pulse === GST_METADATA.pulse);
  const missing = keys.filter(k => !byKey.has(k));
  if (missing.length || !gst) {
    throw new BillingError(503, `Billing isn't fully set up in Stripe (missing ${[...missing, ...(gst ? [] : ['GST tax rate'])].join(', ')}). Run scripts/stripe-setup.ts.`);
  }
  catalogue = {
    perCow: byKey.get(LOOKUP_KEYS.perCow)!,
    onboarding: Object.fromEntries(Object.entries(LOOKUP_KEYS.onboarding).map(([b, k]) => [b, byKey.get(k)!])) as Record<FeeBand, string>,
    gst: gst.id,
  };
  return catalogue;
}

async function ensureCustomer(farmId: string, row: FarmBilling): Promise<string> {
  if (row.stripeCustomerId) return row.stripeCustomerId;
  const [farm] = await systemDb.select({ name: farms.name, contactEmail: farms.contactEmail }).from(farms).where(eq(farms.id, farmId));
  const [owner] = await systemDb.select({ email: users.email, name: users.name }).from(farmMembers)
    .innerJoin(users, eq(users.id, farmMembers.userId))
    .where(and(eq(farmMembers.farmId, farmId), eq(farmMembers.role, 'owner'), eq(farmMembers.isActive, true)))
    .orderBy(farmMembers.createdAt).limit(1);
  const customer = await stripe().customers.create({
    name: farm?.name,
    email: farm?.contactEmail ?? owner?.email ?? undefined,
    metadata: { farm_id: farmId },
  }, { idempotencyKey: `pulse-customer-${farmId}` });
  await systemDb.update(farmBilling).set({ stripeCustomerId: customer.id, updatedAt: new Date() }).where(eq(farmBilling.farmId, farmId));
  return customer.id;
}

/**
 * A Stripe Checkout page for subscribing: the per-cow price with this month's count, plus the
 * onboarding fee if it hasn't been paid. Time left in the free trial stays free.
 */
export async function startCheckout(farmId: string): Promise<string> {
  const row = await getBilling(farmId);
  if (row.subscriptionStatus && PAID_STATUSES.has(row.subscriptionStatus)) throw new BillingError(409, 'This farm already has a subscription. Use Manage billing to change it.');
  const summary = await billingSummary(farmId);
  if (!summary.feeBand) throw new BillingError(400, "Enter the farm's total area (Setup › Farm details) first: it sets the onboarding fee.");
  if (summary.cows < 1) throw new BillingError(400, 'Add your cows to the animal register first: the monthly fee is per cow.');
  const prices = await stripeCatalogue();
  const customer = await ensureCustomer(farmId, row);
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: prices.perCow, quantity: summary.cows, tax_rates: [prices.gst] },
  ];
  if (!row.onboardingFeePaidAt) lineItems.push({ price: prices.onboarding[summary.feeBand], quantity: 1, tax_rates: [prices.gst] });
  // Stripe needs a trial end at least two days away
  const trialEnd = row.trialEndsAt.getTime() > Date.now() + 2 * 86_400_000 ? Math.floor(row.trialEndsAt.getTime() / 1000) : undefined;
  const base = appUrl();
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: lineItems,
    client_reference_id: farmId,
    metadata: { farm_id: farmId, onboarding_fee_band: row.onboardingFeePaidAt ? '' : summary.feeBand },
    subscription_data: { metadata: { farm_id: farmId }, ...(trialEnd ? { trial_end: trialEnd } : {}) },
    success_url: `${base}/app/billing?checkout=done`,
    cancel_url: `${base}/app/billing?checkout=cancelled`,
  });
  if (!session.url) throw new BillingError(502, "Stripe didn't return a checkout page");
  return session.url;
}

/** Stripe's billing portal, where the owner changes card, sees invoices or cancels */
export async function startPortal(farmId: string): Promise<string> {
  const row = await getBilling(farmId);
  if (!row.stripeCustomerId) throw new BillingError(400, 'This farm has no billing account yet. Subscribe first.');
  const session = await stripe().billingPortal.sessions.create({ customer: row.stripeCustomerId, return_url: `${appUrl()}/app/billing` });
  return session.url;
}

function periodEnd(sub: any): Date | null {
  const seconds = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;
  return seconds ? new Date(seconds * 1000) : null;
}

async function saveSubscription(sub: Stripe.Subscription, farmIdHint?: string) {
  const farmId = sub.metadata?.farm_id || farmIdHint;
  if (!farmId) return;
  await getBilling(farmId);
  await systemDb.update(farmBilling).set({
    stripeSubscriptionId: sub.id,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    subscriptionStatus: sub.status,
    currentPeriodEnd: periodEnd(sub),
    updatedAt: new Date(),
  }).where(eq(farmBilling.farmId, farmId));
  forgetBillingState(farmId);
}

/** Check a webhook's signature and turn it into a Stripe event (throws when it isn't from Stripe) */
export function verifyWebhook(rawBody: Buffer, signature: string | undefined): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new BillingError(503, 'STRIPE_WEBHOOK_SECRET is not set');
  if (!signature) throw new BillingError(400, 'Missing Stripe signature');
  return stripe().webhooks.constructEvent(rawBody, signature, secret);
}

/** Keep the farm's billing row in step with Stripe */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const farmId = session.metadata?.farm_id || session.client_reference_id;
      if (!farmId || session.mode !== 'subscription') return;
      const band = session.metadata?.onboarding_fee_band as FeeBand | '' | undefined;
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (subId) {
        const sub = await stripe().subscriptions.retrieve(subId);
        await saveSubscription(sub, farmId);
        const cows = sub.items.data.find(i => i.price.lookup_key === LOOKUP_KEYS.perCow)?.quantity;
        if (cows != null) await systemDb.update(farmBilling).set({ billedCows: cows, billedCowsAt: new Date() }).where(eq(farmBilling.farmId, farmId));
      }
      // The fee is on the first invoice; with time left in the trial that invoice may come later,
      // so "paid" here means it's been charged or put on the subscription's first invoice
      if (band && session.status === 'complete') {
        await systemDb.update(farmBilling).set({ onboardingFeeBand: band, onboardingFeePaidAt: new Date(), updatedAt: new Date() })
          .where(eq(farmBilling.farmId, farmId));
      }
      forgetBillingState(farmId);
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
      await saveSubscription(event.data.object as Stripe.Subscription);
      return;
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const invoice = event.data.object as any;
      const subId = invoice.parent?.subscription_details?.subscription ?? invoice.subscription;
      if (typeof subId === 'string') await saveSubscription(await stripe().subscriptions.retrieve(subId));
      return;
    }
    default:
      return;
  }
}

/**
 * Send each subscribed farm's current cow count to Stripe, without prorating, so the next
 * monthly invoice charges for the herd as it is then. Runs daily.
 */
export async function syncCowCounts(): Promise<{ farms: number; changed: number }> {
  if (!process.env.STRIPE_SECRET_KEY) return { farms: 0, changed: 0 };
  const rows = await systemDb.select().from(farmBilling)
    .where(sql`${farmBilling.stripeSubscriptionId} IS NOT NULL AND ${farmBilling.subscriptionStatus} IN ('active', 'trialing', 'past_due')`);
  let changed = 0;
  for (const row of rows) {
    try {
      const cows = await countCows(row.farmId);
      if (cows === row.billedCows) continue;
      const sub = await stripe().subscriptions.retrieve(row.stripeSubscriptionId!);
      const item = sub.items.data.find(i => i.price.lookup_key === LOOKUP_KEYS.perCow);
      if (!item) continue;
      // No cows recorded (say, the register is being re-imported): keep billing the last count
      // rather than dropping to nothing
      if (cows < 1) continue;
      await stripe().subscriptionItems.update(item.id, { quantity: cows, proration_behavior: 'none' });
      await systemDb.update(farmBilling).set({ billedCows: cows, billedCowsAt: new Date(), updatedAt: new Date() }).where(eq(farmBilling.id, row.id));
      changed++;
    } catch (err) {
      console.error(`[billing] Couldn't update the cow count for farm ${row.farmId}:`, err);
    }
  }
  return { farms: rows.length, changed };
}
