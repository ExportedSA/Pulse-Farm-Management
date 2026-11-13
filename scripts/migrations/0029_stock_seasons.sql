-- Stock reconciliation by season, counted the way farm accounts and IRD count stock.
--
-- A season runs to the farm's balance date (31 May unless the farm sets another). It opens with
-- a head count per class; births, purchases, sales, deaths and transfers during the season add
-- up to its closing numbers; closing it moves each class up a year to open the next season.
-- Movements for animals in the register are worked out from the animals themselves (how they
-- arrived, and when and how they left), so nothing is entered twice.

-- Killed on farm for the farm's own use
ALTER TYPE stock_transaction_type ADD VALUE IF NOT EXISTS 'rations';

-- How an animal came onto the farm: born, purchased or transferred_in. Empty means it was already
-- here when records started (it's in the opening numbers). start_date holds the day it arrived.
ALTER TABLE animals ADD COLUMN IF NOT EXISTS arrival varchar(20);
-- A class set by hand (e.g. Breeding bulls), instead of the one worked out from age and sex
ALTER TABLE animals ADD COLUMN IF NOT EXISTS stock_class varchar(80);

-- A movement made from an animal's record: its arrival or its departure
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS animal_id uuid REFERENCES animals(id);
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS source varchar(20);
CREATE UNIQUE INDEX IF NOT EXISTS stock_transactions_animal_event_idx
  ON stock_transactions (animal_id, source) WHERE animal_id IS NOT NULL AND deleted_at IS NULL;

-- Stocktakes, and NAIT's count of animals at the farm's location, are checks against the tally
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS kind varchar(20) NOT NULL DEFAULT 'stocktake';

-- Mobs: a group the farm runs together, with its class, head count and paddock
ALTER TABLE animal_groups ADD COLUMN IF NOT EXISTS is_mob boolean NOT NULL DEFAULT false;
ALTER TABLE animal_groups ADD COLUMN IF NOT EXISTS stock_class varchar(80);
ALTER TABLE animal_groups ADD COLUMN IF NOT EXISTS head_count integer CHECK (head_count >= 0);
ALTER TABLE animal_groups ADD COLUMN IF NOT EXISTS current_pasture_id uuid REFERENCES pastures(id);

CREATE TABLE IF NOT EXISTS stock_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL DEFAULT NULLIF(current_setting('app.farm_id', true), '')::uuid REFERENCES farms(id),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  closed_at timestamp,
  closed_by uuid REFERENCES users(id),
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CHECK (ends_on > starts_on),
  UNIQUE (farm_id, starts_on)
);
CREATE INDEX IF NOT EXISTS stock_seasons_farm_idx ON stock_seasons (farm_id);

-- Opening numbers per class, and the closing numbers once the season is closed
CREATE TABLE IF NOT EXISTS stock_season_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL DEFAULT NULLIF(current_setting('app.farm_id', true), '')::uuid REFERENCES farms(id),
  season_id uuid NOT NULL REFERENCES stock_seasons(id) ON DELETE CASCADE,
  stock_class varchar(80) NOT NULL,
  opening integer NOT NULL CHECK (opening >= 0),
  closing integer,
  UNIQUE (season_id, stock_class)
);
CREATE INDEX IF NOT EXISTS stock_season_classes_farm_idx ON stock_season_classes (farm_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['stock_seasons', 'stock_season_classes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS farm_isolation ON %I', t);
    EXECUTE format('CREATE POLICY farm_isolation ON %I USING (farm_id = NULLIF(current_setting(''app.farm_id'', true), '''')::uuid)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO pulse_app', t);
  END LOOP;
END $$;

-- The farm guard checks the new links (as 0028 does for every farm table)
DO $$
DECLARE
  t record;
  l record;
  args text;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname IN ('stock_transactions', 'animal_groups', 'stock_seasons', 'stock_season_classes')
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
