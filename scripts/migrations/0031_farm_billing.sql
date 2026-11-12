-- Each farm's subscription: its free trial, and its Stripe customer and subscription once it
-- subscribes. A farm whose trial has ended without a paid subscription becomes read-only; its data
-- is never deleted for that.

CREATE TABLE IF NOT EXISTS farm_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL UNIQUE DEFAULT NULLIF(current_setting('app.farm_id', true), '')::uuid REFERENCES farms(id),
  trial_ends_at timestamp NOT NULL,
  stripe_customer_id varchar(100),
  stripe_subscription_id varchar(100),
  -- Stripe's subscription status (active, trialing, past_due, canceled, unpaid, ...); empty before subscribing
  subscription_status varchar(30),
  current_period_end timestamp,
  onboarding_fee_band varchar(10),            -- small | medium | large, as charged
  onboarding_fee_paid_at timestamp,
  billed_cows integer,                        -- the cow count last sent to Stripe
  billed_cows_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS farm_billing_subscription ON farm_billing (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE farm_billing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farm_isolation ON farm_billing;
CREATE POLICY farm_isolation ON farm_billing
  USING (farm_id = NULLIF(current_setting('app.farm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS pulse_farm_guard ON farm_billing;
CREATE TRIGGER pulse_farm_guard BEFORE INSERT OR UPDATE ON farm_billing
  FOR EACH ROW EXECUTE FUNCTION pulse_farm_guard();

-- Farms already in Pulse get a full 30-day trial from today, so none turns read-only the moment
-- billing starts. Farms made later start theirs when they're created.
INSERT INTO farm_billing (farm_id, trial_ends_at)
SELECT id, now() + interval '30 days' FROM farms
ON CONFLICT (farm_id) DO NOTHING;
