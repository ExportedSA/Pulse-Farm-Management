-- Farm map, stage 2: exclusion zones and variable-rate plans.

-- Areas where some activities mustn't be applied (streams, bores, soak holes, boundaries...).
-- geom is the excluded area itself: the drawn shape, or the source buffered by buffer_m.
-- Hiding the exclusions layer on the map never switches these off.
CREATE TABLE IF NOT EXISTS exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  name varchar(120) NOT NULL,
  reason text,
  activities text[] NOT NULL,                 -- e.g. {fertiliser,effluent} or {all}
  source_kind varchar(10) NOT NULL,           -- area | around | edge
  source_feature_id uuid REFERENCES map_features(id),
  source_pasture_id uuid REFERENCES pastures(id),
  source_geom geography(Geometry, 4326) NOT NULL,
  buffer_m numeric(8, 2) NOT NULL DEFAULT 0,
  geom geography(MultiPolygon, 4326) NOT NULL,
  permanent boolean NOT NULL DEFAULT true,
  starts_on date,
  ends_on date,
  requirement_source text,                    -- e.g. consent condition, regional plan rule, label
  confirmed_by varchar(120),
  confirmed_on date,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  archived_at timestamp
);
CREATE INDEX IF NOT EXISTS exclusions_geom_idx ON exclusions USING gist (geom);
CREATE INDEX IF NOT EXISTS exclusions_farm_idx ON exclusions (farm_id) WHERE archived_at IS NULL;

-- A planned application with different rates in different zones
CREATE TABLE IF NOT EXISTS rate_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  name varchar(120) NOT NULL,
  activity varchar(20) NOT NULL,              -- fertiliser, effluent, slurry, spraying
  status varchar(12) NOT NULL DEFAULT 'draft',-- draft | approved | cancelled
  planned_on date,
  pasture_ids uuid[] NOT NULL DEFAULT '{}',
  notes text,
  snapshot jsonb,                             -- on approval: exclusions and boundary versions that applied
  approved_by uuid REFERENCES users(id),
  approved_at timestamp,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_plans_farm_idx ON rate_plans (farm_id, status);

CREATE TABLE IF NOT EXISTS rate_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
  pasture_id uuid REFERENCES pastures(id),
  name varchar(120),
  geom geography(MultiPolygon, 4326) NOT NULL,
  product_name varchar(160),
  product_id uuid REFERENCES input_products(id),
  rate numeric(12, 4),
  rate_unit varchar(10) NOT NULL DEFAULT 'kg/ha',
  -- Worked out from the zone, the active exclusions and the rate (frozen once the plan is approved)
  gross_ha numeric(12, 4),
  excluded_ha numeric(12, 4),
  net_ha numeric(12, 4),
  quantity numeric(14, 4),
  quantity_unit varchar(10),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_zones_plan_idx ON rate_zones (plan_id);
CREATE INDEX IF NOT EXISTS rate_zones_geom_idx ON rate_zones USING gist (geom);
