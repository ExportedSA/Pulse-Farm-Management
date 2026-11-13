-- Stage 3: product catalogue (sourced and dated), favourites and nicknames, product versions,
-- fertiliser jobs with per-paddock lines, and dockets.

-- The product library becomes the catalogue. Nutrient % are elemental; an oxide-basis analysis
-- entered by a farm is kept as entered (oxide_entered) and converted for calculations.
ALTER TABLE input_products
  ADD COLUMN IF NOT EXISTS supplier varchar(120),
  ADD COLUMN IF NOT EXISTS category varchar(40),
  ADD COLUMN IF NOT EXISTS formulation varchar(60),
  ADD COLUMN IF NOT EXISTS units text[] NOT NULL DEFAULT '{kg/ha,t/ha}',
  ADD COLUMN IF NOT EXISTS analysis_basis varchar(20) NOT NULL DEFAULT 'elemental',
  ADD COLUMN IF NOT EXISTS oxide_entered jsonb,
  ADD COLUMN IF NOT EXISTS active_ingredients jsonb,
  ADD COLUMN IF NOT EXISTS registration_number varchar(40),
  ADD COLUMN IF NOT EXISTS epa_approval varchar(40),
  ADD COLUMN IF NOT EXISTS label_url text,
  ADD COLUMN IF NOT EXISTS sds_url text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_note text,
  ADD COLUMN IF NOT EXISTS verified_on date,
  ADD COLUMN IF NOT EXISTS verification varchar(16) NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS blend jsonb,
  ADD COLUMN IF NOT EXISTS archived_at timestamp,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);
CREATE INDEX IF NOT EXISTS input_products_search_idx ON input_products (kind, lower(name));

-- The earlier shared entries were generic typical analyses with no source: kept for history,
-- hidden from product pickers. (The typical effluent entry is dealt with in the effluent stage.)
UPDATE input_products SET verification = 'unverified',
  source_note = 'Generic typical analysis with no source; not part of the verified catalogue',
  archived_at = CASE WHEN kind = 'fertiliser' THEN now() ELSE archived_at END
WHERE farm_id IS NULL AND source_url IS NULL;

-- Every change to a product keeps the previous details
CREATE TABLE IF NOT EXISTS product_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES input_products(id),
  version integer NOT NULL,
  data jsonb NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (product_id, version)
);

-- Each farm's favourites, nicknames and recently used products
CREATE TABLE IF NOT EXISTS farm_product_prefs (
  farm_id uuid NOT NULL REFERENCES farms(id),
  product_id uuid NOT NULL REFERENCES input_products(id),
  favourite boolean NOT NULL DEFAULT false,
  nickname varchar(80),
  last_used_at timestamp,
  PRIMARY KEY (farm_id, product_id)
);

-- Where the catalogue came from and what it covers
CREATE TABLE IF NOT EXISTS catalogue_sources (
  id varchar(40) PRIMARY KEY,
  name varchar(160) NOT NULL,
  url text NOT NULL,
  coverage text NOT NULL,
  retrieved_on date NOT NULL,
  notes text
);

-- A job: one activity (fertiliser now; sprays and effluent later) over one or more paddocks.
-- Planned, delivered and applied quantities are kept apart; nothing is adjusted to make them agree.
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  activity varchar(20) NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'draft',      -- draft | planned | in_progress | completed | cancelled
  title varchar(160),
  planned_on date,
  started_at timestamp,
  completed_at timestamp,
  evidence varchar(12) NOT NULL DEFAULT 'manual',    -- planned | manual | gps
  plan_id uuid REFERENCES rate_plans(id),
  supplier varchar(160),
  contractor varchar(160),
  operator varchar(120),
  equipment varchar(160),
  weather text,
  notes text,
  cost numeric(12, 2),
  client_id varchar(64),
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp,
  UNIQUE (farm_id, client_id)
);
CREATE INDEX IF NOT EXISTS applications_farm_idx ON applications (farm_id, activity, status);

-- Where, what and how much: one line per paddock (or part of one) and product. The treated
-- shape, the exclusions taken off and the product details are saved with the line.
CREATE TABLE IF NOT EXISTS application_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  pasture_id uuid REFERENCES pastures(id),
  boundary_id uuid REFERENCES paddock_boundaries(id),
  name varchar(120),
  geom geography(MultiPolygon, 4326) NOT NULL,
  partial boolean NOT NULL DEFAULT false,
  gross_ha numeric(12, 4),
  excluded_ha numeric(12, 4),
  net_ha numeric(12, 4),
  exclusions jsonb,
  product_id uuid REFERENCES input_products(id),
  product_version integer,
  product_snapshot jsonb NOT NULL,
  rate numeric(12, 4),
  rate_unit varchar(10) NOT NULL DEFAULT 'kg/ha',
  planned_quantity numeric(14, 4),
  applied_quantity numeric(14, 4),
  quantity_unit varchar(10),
  record_id uuid REFERENCES farm_records(id),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS application_lines_app_idx ON application_lines (application_id);
CREATE INDEX IF NOT EXISTS application_lines_pasture_idx ON application_lines (pasture_id);
CREATE INDEX IF NOT EXISTS application_lines_geom_idx ON application_lines USING gist (geom);

-- Delivery dockets. One docket can cover several jobs; a job can have several dockets.
CREATE TABLE IF NOT EXISTS dockets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  number varchar(60) NOT NULL,
  supplier varchar(160),
  docket_date date,
  product_id uuid REFERENCES input_products(id),
  product_name varchar(160),
  quantity numeric(14, 4),
  unit varchar(10),
  cost numeric(12, 2),
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  archived_at timestamp
);
CREATE INDEX IF NOT EXISTS dockets_farm_number_idx ON dockets (farm_id, lower(number));

CREATE TABLE IF NOT EXISTS application_dockets (
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  docket_id uuid NOT NULL REFERENCES dockets(id),
  quantity numeric(14, 4),                          -- how much of the docket went to this job, if split
  PRIMARY KEY (application_id, docket_id)
);
