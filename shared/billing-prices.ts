// Pulse's prices, set by the business (NZD, all plus GST at 15%). Used by the server
// (server/domain/billing.ts) and by scripts/stripe-setup.ts, which makes them in Stripe.
//
// - A one-off onboarding fee by the farm's area as the owner gives it: under 300 ha $500,
//   300 to 500 ha $800, over 500 ha $1,200.
// - $1.80 per cow per year, billed monthly ($0.15 per cow a month), on the active females in the
//   farm's animal register.

export const TRIAL_DAYS = 30;
export const GST_RATE = 0.15;
export const PER_COW_YEAR_CENTS = 180;
export const PER_COW_MONTH_CENTS = 15;

export type FeeBand = 'small' | 'medium' | 'large';
export const ONBOARDING_FEE_CENTS: Record<FeeBand, number> = { small: 50_000, medium: 80_000, large: 120_000 };

// How the server finds the prices and tax rate in Stripe
export const LOOKUP_KEYS = {
  perCow: 'pulse_per_cow_monthly',
  onboarding: { small: 'pulse_onboarding_small', medium: 'pulse_onboarding_medium', large: 'pulse_onboarding_large' } as Record<FeeBand, string>,
};
export const GST_METADATA = { pulse: 'gst' };

/** The onboarding fee band for a farm's area; unknown when the area hasn't been given */
export function feeBand(areaHa: number | null | undefined): FeeBand | null {
  if (areaHa == null || !(areaHa > 0)) return null;
  if (areaHa < 300) return 'small';
  if (areaHa <= 500) return 'medium';
  return 'large';
}
