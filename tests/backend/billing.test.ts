// Billing: prices, the trial, Stripe Checkout and webhooks, and read-only farms.
//
// Stripe is replaced by a stand-in (no calls leave the machine), but webhooks are signed and
// checked exactly as Stripe's are. Runs the real routes in-process against the database in .env,
// with a TEST farm that is removed at the end. Needs DATABASE_URL and JWT_SECRET.
import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import Stripe from 'stripe';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { feeBand, billingState } from '../../server/domain/billing';

const live = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;
const stamp = Date.now();
const WEBHOOK_SECRET = 'whsec_test_pulse_billing';

describe('billing prices and states', () => {
  it('puts the farm area in the right onboarding fee band', () => {
    expect(feeBand(null)).toBeNull();
    expect(feeBand(0)).toBeNull();
    expect(feeBand(120)).toBe('small');
    expect(feeBand(299.9)).toBe('small');
    expect(feeBand(300)).toBe('medium');
    expect(feeBand(500)).toBe('medium');
    expect(feeBand(500.1)).toBe('large');
  });

  it('is on trial, paid up or read-only', () => {
    const now = new Date('2026-11-12T00:00:00Z');
    const later = new Date('2026-12-01T00:00:00Z');
    const earlier = new Date('2026-11-01T00:00:00Z');
    expect(billingState({ trialEndsAt: later, subscriptionStatus: null }, now)).toBe('trial');
    expect(billingState({ trialEndsAt: earlier, subscriptionStatus: null }, now)).toBe('read_only');
    expect(billingState({ trialEndsAt: earlier, subscriptionStatus: 'active' }, now)).toBe('active');
    expect(billingState({ trialEndsAt: earlier, subscriptionStatus: 'past_due' }, now)).toBe('active');
    expect(billingState({ trialEndsAt: earlier, subscriptionStatus: 'canceled' }, now)).toBe('read_only');
    expect(billingState({ trialEndsAt: earlier, subscriptionStatus: 'unpaid' }, now)).toBe('read_only');
  });
});

describe.skipIf(!live)('billing with Stripe', () => {
  let app: express.Express;
  let systemDb: any;
  let billing: typeof import('../../server/domain/billing');
  const saved = { key: process.env.STRIPE_SECRET_KEY, secret: process.env.STRIPE_WEBHOOK_SECRET };
  const farmId = { id: '' };
  const tokens: Record<string, string> = {};
  const checkouts: any[] = [];
  const subscriptions = new Map<string, any>();
  const realStripe = new Stripe('sk_test_not_a_real_key');

  const fake = {
    webhooks: realStripe.webhooks,
    prices: {
      list: async () => ({ data: ['pulse_per_cow_monthly', 'pulse_onboarding_small', 'pulse_onboarding_medium', 'pulse_onboarding_large']
        .map(k => ({ id: `price_${k}`, lookup_key: k })) }),
    },
    taxRates: { list: async () => ({ data: [{ id: 'txr_gst', metadata: { pulse: 'gst' } }] }) },
    customers: { create: async () => ({ id: `cus_test_${stamp}` }) },
    checkout: { sessions: { create: async (params: any) => { checkouts.push(params); return { url: 'https://checkout.stripe.test/session' }; } } },
    billingPortal: { sessions: { create: async () => ({ url: 'https://billing.stripe.test/portal' }) } },
    subscriptions: { retrieve: async (id: string) => subscriptions.get(id) },
    subscriptionItems: { update: async () => ({}) },
  };

  const one = async (q: any) => ((await systemDb.execute(q)) as any).rows[0];
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const signed = (event: object) => {
    const payload = JSON.stringify(event);
    return { payload, header: Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) };
  };
  const subscription = (status: string) => ({
    id: `sub_test_${stamp}`, object: 'subscription', status, customer: `cus_test_${stamp}`, metadata: { farm_id: farmId.id },
    items: { data: [{ id: 'si_test', quantity: 3, price: { lookup_key: 'pulse_per_cow_monthly' }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
  });

  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_not_a_real_key';
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const dbm = await import('../../server/db');
    systemDb = dbm.systemDb;
    billing = await import('../../server/domain/billing');
    billing.setStripeForTests(fake as any);
    billing.forgetCatalogue();
    const auth = await import('../../server/middleware/auth');
    const { readOnlyWhenLapsed } = await import('../../server/middleware/read-only');
    const farmsRouter = (await import('../../server/routes/farms')).default;
    const billingRouter = (await import('../../server/routes/billing')).default;
    app = express();
    app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
    app.use('/api', (req, res, next) => (req.path === '/billing/webhook' ? next() : auth.requireAuth(req as any, res, next)));
    app.use('/api', dbm.farmDbContext((req: any) => auth.getFarmId(req) ?? null));
    app.use('/api', readOnlyWhenLapsed);
    app.use('/api/farms', farmsRouter);
    app.use('/api/billing', billingRouter);

    farmId.id = (await one(sql`INSERT INTO farms (name, settings) VALUES ('TEST Billing Farm', '{"areaHa": 420}'::jsonb) RETURNING id`)).id;
    for (const who of ['owner', 'manager']) {
      const id = (await one(sql`INSERT INTO users (name, email, password) VALUES (${`TEST Billing ${who}`}, ${`test-billing-${who}-${stamp}@example.test`}, 'x') RETURNING id`)).id;
      await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farmId.id}, ${id}, ${who}::user_role)`);
      tokens[who] = auth.generateToken({ userId: id, farmId: farmId.id, role: who });
    }
    // 3 cows billed: active females. Not the bull or the sold cow.
    for (const [sex, status] of [['female', 'active'], ['female', 'active'], ['female', 'active'], ['male', 'active'], ['female', 'sold']]) {
      await systemDb.execute(sql`INSERT INTO animals (farm_id, name, sex, status) VALUES (${farmId.id}, 'TEST billing cow', ${sex}::animal_sex, ${status}::animal_status)`);
    }
  }, 60_000);

  afterAll(async () => {
    billing?.setStripeForTests(null);
    process.env.STRIPE_SECRET_KEY = saved.key;
    process.env.STRIPE_WEBHOOK_SECRET = saved.secret;
    if (saved.key === undefined) delete process.env.STRIPE_SECRET_KEY;
    if (saved.secret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    if (!systemDb || !farmId.id) return;
    for (const t of ['animals', 'farm_billing', 'farm_invitations', 'farm_members']) {
      await systemDb.execute(sql`DELETE FROM ${sql.identifier(t)} WHERE farm_id = ${farmId.id}`);
    }
    await systemDb.execute(sql`DELETE FROM farms WHERE id = ${farmId.id}`);
    await systemDb.execute(sql`DELETE FROM users WHERE email LIKE ${`test-billing-%-${stamp}@example.test`}`);
  }, 60_000);

  it('a new farm starts a 30-day trial and sees what it will pay', async () => {
    const res = await request(app).get('/api/billing').set(as('manager'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ state: 'trial', feeBand: 'medium', onboardingFeeCents: 80_000, cows: 3, monthlyCents: 45, canManage: false });
    const days = (new Date(res.body.trialEndsAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });

  it('only the owner subscribes, through Stripe Checkout with GST on each line', async () => {
    expect((await request(app).post('/api/billing/checkout').set(as('manager'))).status).toBe(403);
    const res = await request(app).post('/api/billing/checkout').set(as('owner'));
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.test/session');
    const params = checkouts.at(-1);
    expect(params.mode).toBe('subscription');
    expect(params.line_items).toEqual([
      { price: 'price_pulse_per_cow_monthly', quantity: 3, tax_rates: ['txr_gst'] },
      { price: 'price_pulse_onboarding_medium', quantity: 1, tax_rates: ['txr_gst'] },
    ]);
    // The rest of the free trial stays free
    expect(params.subscription_data.trial_end).toBeGreaterThan(Date.now() / 1000 + 29 * 86400);
    expect(params.subscription_data.metadata.farm_id).toBe(farmId.id);
  });

  it('refuses webhooks Stripe did not sign', async () => {
    const { payload } = signed({ id: 'evt_x', type: 'customer.subscription.updated', data: { object: subscription('active') } });
    const res = await request(app).post('/api/billing/webhook').set({ 'Content-Type': 'application/json', 'Stripe-Signature': 't=1,v1=forged' }).send(payload);
    expect(res.status).toBe(400);
  });

  it('a lapsed farm is read-only, and paying makes it writable again', async () => {
    await systemDb.execute(sql`UPDATE farm_billing SET trial_ends_at = now() - interval '1 day' WHERE farm_id = ${farmId.id}`);
    billing.forgetBillingState(farmId.id);

    const blocked = await request(app).post(`/api/farms/${farmId.id}/invites`).set(as('owner')).send({ email: `test-billing-x-${stamp}@example.test` });
    expect(blocked.status).toBe(402);
    expect(blocked.body.code).toBe('farm_read_only');
    // Still readable, and the owner can still get to billing
    expect((await request(app).get(`/api/farms/${farmId.id}/members`).set(as('owner'))).status).toBe(200);
    expect((await request(app).get('/api/billing').set(as('owner'))).body.state).toBe('read_only');
    expect((await request(app).post('/api/billing/checkout').set(as('owner'))).status).toBe(200);
    // Nothing was deleted
    expect((await one(sql`SELECT count(*)::int AS n FROM animals WHERE farm_id = ${farmId.id}`)).n).toBe(5);

    const sub = subscription('active');
    subscriptions.set(sub.id, sub);
    const { payload, header } = signed({
      id: 'evt_checkout', object: 'event', type: 'checkout.session.completed',
      data: { object: { id: 'cs_test', object: 'checkout.session', mode: 'subscription', status: 'complete', payment_status: 'paid',
        subscription: sub.id, client_reference_id: farmId.id, metadata: { farm_id: farmId.id, onboarding_fee_band: 'medium' } } },
    });
    const hook = await request(app).post('/api/billing/webhook').set({ 'Content-Type': 'application/json', 'Stripe-Signature': header }).send(payload);
    expect(hook.status).toBe(200);

    const row = await one(sql`SELECT * FROM farm_billing WHERE farm_id = ${farmId.id}`);
    expect(row).toMatchObject({ subscription_status: 'active', stripe_subscription_id: sub.id, onboarding_fee_band: 'medium', billed_cows: 3 });
    expect(row.onboarding_fee_paid_at).not.toBeNull();
    const ok = await request(app).post(`/api/farms/${farmId.id}/invites`).set(as('owner')).send({ email: `test-billing-x-${stamp}@example.test` });
    expect(ok.status).toBe(201);

    // The onboarding fee isn't charged twice
    await request(app).post('/api/billing/checkout').set(as('owner')).expect(409);
  });

  it('a cancelled subscription makes the farm read-only again', async () => {
    const { payload, header } = signed({ id: 'evt_cancel', object: 'event', type: 'customer.subscription.deleted', data: { object: subscription('canceled') } });
    await request(app).post('/api/billing/webhook').set({ 'Content-Type': 'application/json', 'Stripe-Signature': header }).send(payload).expect(200);
    expect((await request(app).post(`/api/farms/${farmId.id}/invites`).set(as('owner')).send({ email: `test-billing-y-${stamp}@example.test` })).status).toBe(402);
    // Subscribing again doesn't charge the onboarding fee again
    await request(app).post('/api/billing/checkout').set(as('owner')).expect(200);
    expect(checkouts.at(-1).line_items).toEqual([{ price: 'price_pulse_per_cow_monthly', quantity: 3, tax_rates: ['txr_gst'] }]);
  });
});
