-- Stage 4: spray jobs (tank mixes on mapped areas) and grazing/harvest/re-entry restrictions.

-- The old shared spray entries had no source; they're replaced by the sourced catalogue (0020)
UPDATE input_products SET archived_at = COALESCE(archived_at, now()), verification = 'unverified',
  source_note = 'Generic entry with no source; not part of the verified catalogue'
WHERE farm_id IS NULL AND kind = 'spray' AND source_url IS NULL;

-- Spray details on the job
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS crop varchar(160),
  ADD COLUMN IF NOT EXISTS target varchar(240),
  ADD COLUMN IF NOT EXISTS water_rate numeric(10, 2),        -- L/ha
  ADD COLUMN IF NOT EXISTS tank_volume numeric(10, 2),       -- L
  ADD COLUMN IF NOT EXISTS tank_loads numeric(8, 2),         -- actual loads used
  ADD COLUMN IF NOT EXISTS wind_speed numeric(6, 1),         -- km/h
  ADD COLUMN IF NOT EXISTS wind_direction varchar(8),
  ADD COLUMN IF NOT EXISTS temperature numeric(5, 1),        -- °C
  ADD COLUMN IF NOT EXISTS operator_cert varchar(80);

-- Spray area lines carry no product of their own (the mix applies to every line)
ALTER TABLE application_lines ALTER COLUMN product_snapshot DROP NOT NULL;

-- The tank mix: each product with its own rate, in its own units
CREATE TABLE IF NOT EXISTS application_mix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES input_products(id),
  product_version integer,
  product_snapshot jsonb NOT NULL,
  role varchar(12) NOT NULL DEFAULT 'product',       -- product | adjuvant
  rate numeric(14, 4),
  rate_unit varchar(10) NOT NULL,                    -- L/ha mL/ha kg/ha g/ha, or per 100 L of water
  label_ref text,                                    -- where on the label the rate came from
  actual_quantity numeric(14, 4),
  actual_unit varchar(4),                            -- L mL kg g
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS application_mix_app_idx ON application_mix (application_id);

-- Restrictions. Unresolved ones have no end date and stay visibly unresolved.
CREATE TABLE IF NOT EXISTS restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  mix_id uuid REFERENCES application_mix(id) ON DELETE CASCADE,
  kind varchar(12) NOT NULL,                         -- grazing | harvest | reentry | other
  status varchar(16) NOT NULL DEFAULT 'unresolved',  -- unresolved | confirmed | not_applicable
  period_value numeric(8, 2),
  period_unit varchar(8),                            -- hours | days
  applies_to varchar(160),                           -- e.g. dairy cows, lactating animals, the crop
  rule_source text,                                  -- the label section or document it came from
  applies_from timestamp,                            -- when the application finished
  ends_at timestamp,
  notes text,
  confirmed_by uuid REFERENCES users(id),
  confirmed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS restrictions_app_idx ON restrictions (application_id);
CREATE INDEX IF NOT EXISTS restrictions_farm_idx ON restrictions (farm_id, kind, status);
