-- A farm's own products stay with that farm.
--
-- input_products holds the shared catalogue (no farm) and each farm's own products. It had no
-- row-level security, so a web request (running as pulse_app) could read and change every farm's
-- own products, and change the shared catalogue; only the routes' filters kept farms apart.
-- product_versions (the earlier details of a changed product) had no farm_id at all.
--
-- input_products now works like conditions and vehicle_types (0025): every farm reads the shared
-- entries and its own; a farm adds and changes only its own. The shared catalogue is changed by
-- migrations and scripts, which run as the owner.
--
-- product_versions now works like every other farm table (0024, 0025, 0028, 0032): a required
-- farm_id filled from the product, defaulting to the request's farm, checked by the farm guard,
-- with row-level security. Only a farm's own products are ever changed in the app, so every
-- version belongs to a farm.

ALTER TABLE input_products ALTER COLUMN farm_id SET DEFAULT NULLIF(current_setting('app.farm_id', true), '')::uuid;
ALTER TABLE input_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farm_isolation ON input_products;
DROP POLICY IF EXISTS farm_isolation_read ON input_products;
CREATE POLICY farm_isolation_read ON input_products FOR SELECT
  USING (farm_id IS NULL OR farm_id = NULLIF(current_setting('app.farm_id', true), '')::uuid);
CREATE POLICY farm_isolation ON input_products
  USING (farm_id = NULLIF(current_setting('app.farm_id', true), '')::uuid);

ALTER TABLE product_versions ADD COLUMN IF NOT EXISTS farm_id uuid REFERENCES farms(id);
UPDATE product_versions v SET farm_id = p.farm_id FROM input_products p WHERE p.id = v.product_id AND v.farm_id IS NULL;

DO $$
DECLARE
  bad int;
BEGIN
  SELECT count(*) INTO bad FROM product_versions WHERE farm_id IS NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION 'product_versions has % rows for shared catalogue products, which belong to no farm; remove them or give them a farm first', bad;
  END IF;
END $$;

ALTER TABLE product_versions ALTER COLUMN farm_id SET NOT NULL;
ALTER TABLE product_versions ALTER COLUMN farm_id SET DEFAULT NULLIF(current_setting('app.farm_id', true), '')::uuid;
CREATE INDEX IF NOT EXISTS product_versions_farm_idx ON product_versions (farm_id);

DROP TRIGGER IF EXISTS pulse_farm_guard ON product_versions;
CREATE TRIGGER pulse_farm_guard BEFORE INSERT OR UPDATE ON product_versions
  FOR EACH ROW EXECUTE FUNCTION pulse_farm_guard('input_products', 'product_id');

ALTER TABLE product_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farm_isolation ON product_versions;
CREATE POLICY farm_isolation ON product_versions
  USING (farm_id = NULLIF(current_setting('app.farm_id', true), '')::uuid);
