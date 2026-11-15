-- Stock reconciliation counts killsheets, calvings and NAIT's own list of animals.
--
-- Animals sent to the works are counted apart from other sales ('killed'). A movement can come
-- from a killsheet (head on it that aren't in the animal register) or from a calving whose calf
-- isn't in the register (bobby calves), and points back at it so nothing is counted twice.
-- A class set by hand on an animal now carries the day it was set, so an age class (e.g. rising
-- one-year heifers) moves up a year at each balance date like a class worked out from age.
-- NAIT's "animals at this location" list can be uploaded, to be checked animal by animal.

ALTER TYPE stock_transaction_type ADD VALUE IF NOT EXISTS 'killed';

ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS killsheet_id uuid REFERENCES killsheets(id);
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS calving_id uuid REFERENCES calving_records(id);
CREATE INDEX IF NOT EXISTS stock_transactions_killsheet_idx ON stock_transactions (killsheet_id) WHERE killsheet_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stock_transactions_calving_idx
  ON stock_transactions (calving_id, type) WHERE calving_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE animals ADD COLUMN IF NOT EXISTS stock_class_as_at date;
-- Classes already set by hand: taken as set on the day the animal was last changed
UPDATE animals SET stock_class_as_at = updated_at::date WHERE stock_class IS NOT NULL AND stock_class_as_at IS NULL;

-- A list of the animals NAIT shows at the farm's location, uploaded from NAIT's export
CREATE TABLE IF NOT EXISTS nait_location_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL DEFAULT NULLIF(current_setting('app.farm_id', true), '')::uuid REFERENCES farms(id),
  as_at date NOT NULL,
  file_name varchar(255),
  head integer NOT NULL CHECK (head >= 0),
  -- [{ id, visualId, birthDate, sex }]: id is the animal's NAIT number (RFID / lifetime ID)
  animals jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nait_location_snapshots_farm_idx ON nait_location_snapshots (farm_id, as_at);

ALTER TABLE nait_location_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farm_isolation ON nait_location_snapshots;
CREATE POLICY farm_isolation ON nait_location_snapshots
  USING (farm_id = NULLIF(current_setting('app.farm_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON nait_location_snapshots TO pulse_app;

-- The farm guard checks the new links (as 0028 and 0029 do)
DO $$
DECLARE
  t record;
  l record;
  args text;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname IN ('stock_transactions', 'nait_location_snapshots')
  LOOP
    args := '';
    FOR l IN
      SELECT p.relname AS parent, a.attname AS col
      FROM pg_constraint k
      JOIN pg_class p ON p.oid = k.confrelid
      JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
      JOIN pg_attribute pk ON pk.attrelid = k.confrelid AND pk.attnum = k.confkey[1]
      WHERE k.conrelid = t.oid AND k.contype = 'f' AND array_length(k.conkey, 1) = 1
        AND pk.attname = 'id' AND a.attname <> 'farm_id' AND p.relname <> 'farms'
        AND EXISTS (SELECT 1 FROM pg_attribute f WHERE f.attrelid = p.oid AND f.attname = 'farm_id' AND NOT f.attisdropped)
      ORDER BY p.relname, a.attname
    LOOP
      args := args || CASE WHEN args = '' THEN '' ELSE ', ' END || quote_literal(l.parent) || ', ' || quote_literal(l.col);
    END LOOP;
    EXECUTE format('DROP TRIGGER IF EXISTS pulse_farm_guard ON %I', t.relname);
    EXECUTE format(
      'CREATE TRIGGER pulse_farm_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION pulse_farm_guard(%s)',
      t.relname, args);
  END LOOP;
END $$;
