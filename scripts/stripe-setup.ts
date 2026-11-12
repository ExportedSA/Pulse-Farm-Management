// Makes Pulse's products, prices and the GST tax rate in Stripe, so billing can find them (by
// lookup key and metadata; see server/domain/billing.ts). Safe to run again: anything already
// there is left as it is.
//
// TEST MODE ONLY: refuses a live key. Set up live mode on purpose, by hand or with a reviewed change.
// Usage: npx tsx scripts/stripe-setup.ts   (STRIPE_SECRET_KEY in .env)
import 'dotenv/config';
import Stripe from 'stripe';
import { LOOKUP_KEYS, ONBOARDING_FEE_CENTS, PER_COW_MONTH_CENTS, GST_METADATA, type FeeBand } from '../shared/billing-prices';

const key = process.env.STRIPE_SECRET_KEY ?? '';
if (!/^(sk|rk)_test_/.test(key)) {
  console.error('STRIPE_SECRET_KEY must be a Stripe TEST key (sk_test_… or rk_test_…). Nothing was changed.');
  process.exit(1);
}
const stripe = new Stripe(key);

const BANDS: Record<FeeBand, string> = { small: 'under 300 ha', medium: '300 to 500 ha', large: 'over 500 ha' };

async function product(name: string, description: string, tag: string) {
  const found = await stripe.products.search({ query: `metadata['pulse']:'${tag}'` });
  if (found.data[0]) return found.data[0];
  return stripe.products.create({ name, description, metadata: { pulse: tag } });
}

async function price(lookupKey: string, params: Omit<Stripe.PriceCreateParams, 'lookup_key'>) {
  const found = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (found.data[0]) return { id: found.data[0].id, made: false };
  const made = await stripe.prices.create({ ...params, lookup_key: lookupKey });
  return { id: made.id, made: true };
}

async function main() {
  const perCow = await product('Pulse subscription (per cow)', '$1.80 per cow per year, billed monthly, plus GST', 'per_cow');
  const onboarding = await product('Pulse onboarding fee', 'One-off fee by farm area, plus GST', 'onboarding');

  const results: [string, { id: string; made: boolean }][] = [];
  results.push([LOOKUP_KEYS.perCow, await price(LOOKUP_KEYS.perCow, {
    product: perCow.id, currency: 'nzd', unit_amount: PER_COW_MONTH_CENTS, tax_behavior: 'exclusive',
    recurring: { interval: 'month' }, nickname: 'Per cow, monthly',
  })]);
  for (const band of Object.keys(BANDS) as FeeBand[]) {
    results.push([LOOKUP_KEYS.onboarding[band], await price(LOOKUP_KEYS.onboarding[band], {
      product: onboarding.id, currency: 'nzd', unit_amount: ONBOARDING_FEE_CENTS[band], tax_behavior: 'exclusive',
      nickname: `Onboarding, ${BANDS[band]}`,
    })]);
  }

  const rates = await stripe.taxRates.list({ active: true, limit: 100 });
  let gst = rates.data.find(r => r.metadata?.pulse === GST_METADATA.pulse);
  const gstMade = !gst;
  gst ??= await stripe.taxRates.create({
    display_name: 'GST', description: 'New Zealand GST', percentage: 15, inclusive: false,
    country: 'NZ', tax_type: 'gst', metadata: GST_METADATA,
  });

  for (const [k, r] of results) console.log(`${r.made ? 'made   ' : 'exists '} price ${k} (${r.id})`);
  console.log(`${gstMade ? 'made   ' : 'exists '} tax rate GST 15% (${gst.id})`);
  console.log('Stripe test mode is ready for Pulse billing.');
}

main().catch(err => {
  console.error('Stripe setup failed:', err.message);
  process.exit(1);
});
