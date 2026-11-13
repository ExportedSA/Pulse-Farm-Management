CREATE TABLE IF NOT EXISTS input_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid REFERENCES farms(id),
  kind varchar(20) NOT NULL,
  name varchar(120) NOT NULL,
  n_percent numeric(6, 3),
  p_percent numeric(6, 3),
  k_percent numeric(6, 3),
  s_percent numeric(6, 3),
  mg_percent numeric(6, 3),
  ca_percent numeric(6, 3),
  active_ingredient varchar(255),
  default_rate numeric(10, 3),
  rate_unit varchar(20),
  withholding_days integer,
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS input_products_farm_kind_idx ON input_products (farm_id, kind);

-- Shared starter library: typical analyses (% by weight). Products vary by supplier;
-- farmers should check their docket. Spray chemicals are not seeded because
-- withholding periods must come from each product's label.
INSERT INTO input_products (kind, name, n_percent, p_percent, k_percent, s_percent, mg_percent, ca_percent, rate_unit, notes)
SELECT v.kind, v.name, v.n, v.p, v.k, v.s, v.mg, v.ca, v.unit, 'Typical analysis; check your docket'
FROM (VALUES
  ('fertiliser', 'Urea', 46, 0, 0, 0, 0, 0, 'kg/ha'),
  ('fertiliser', 'Urea with urease inhibitor (e.g. SustaiN)', 46, 0, 0, 0, 0, 0, 'kg/ha'),
  ('fertiliser', 'Ammonium sulphate', 21, 0, 0, 24, 0, 0, 'kg/ha'),
  ('fertiliser', 'Calcium ammonium nitrate (CAN)', 27, 0, 0, 0, 0, 0, 'kg/ha'),
  ('fertiliser', 'Diammonium phosphate (DAP)', 18, 20, 0, 0, 0, 0, 'kg/ha'),
  ('fertiliser', 'Monoammonium phosphate (MAP)', 10, 22, 0, 0, 0, 0, 'kg/ha'),
  ('fertiliser', 'Superphosphate', 0, 9, 0, 11, 0, 20, 'kg/ha'),
  ('fertiliser', 'Triple superphosphate', 0, 20.5, 0, 1, 0, 14, 'kg/ha'),
  ('fertiliser', 'Muriate of potash (KCl)', 0, 0, 50, 0, 0, 0, 'kg/ha'),
  ('fertiliser', 'Sulphate of potash', 0, 0, 41.5, 17, 0, 0, 'kg/ha'),
  ('fertiliser', 'Gypsum', 0, 0, 0, 18, 0, 23, 'kg/ha'),
  ('fertiliser', 'Agricultural lime', 0, 0, 0, 0, 0, 38, 'kg/ha'),
  ('fertiliser', 'Dolomite', 0, 0, 0, 0, 12, 22, 'kg/ha'),
  ('fertiliser', 'Magnesium oxide', 0, 0, 0, 0, 50, 0, 'kg/ha'),
  ('fertiliser', 'Elemental sulphur', 0, 0, 0, 90, 0, 0, 'kg/ha'),
  ('effluent', 'Farm dairy effluent (typical)', 0.05, 0.03, 0.25, 0, 0, 0, 'mm')
) AS v(kind, name, n, p, k, s, mg, ca, unit)
WHERE NOT EXISTS (SELECT 1 FROM input_products ip WHERE ip.farm_id IS NULL AND ip.name = v.name);
