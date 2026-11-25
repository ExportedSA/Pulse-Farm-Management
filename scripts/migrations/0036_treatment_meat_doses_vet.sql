-- Animal treatments, as farmers keep them in MINDA: meat withholding next to the milk withholding,
-- a dose schedule (how many doses, how many hours apart), the day the animal was separated (or must
-- be separated) from the milking herd, and the vet who prescribed or authorised it.
-- The diagnosis pick-list (conditions) gets a code, a group and an order, so a full list such as
-- MINDA's can be loaded into it.
--
-- The server works out meat_clear_at and next_dose_due_at itself (shared/withholding.ts,
-- shared/dose-schedule.ts), as it does milk_clear_at (0035).

ALTER TABLE animal_treatments
  ADD COLUMN IF NOT EXISTS meat_withholding_hours integer CHECK (meat_withholding_hours >= 0),
  ADD COLUMN IF NOT EXISTS meat_clear_at timestamptz,
  ADD COLUMN IF NOT EXISTS dose_interval_hours integer CHECK (dose_interval_hours > 0 AND dose_interval_hours <= 8760),
  ADD COLUMN IF NOT EXISTS next_dose_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS separation_date date,
  ADD COLUMN IF NOT EXISTS veterinarian_id uuid REFERENCES veterinarians(id),
  ADD COLUMN IF NOT EXISTS vet_name varchar(255);

CREATE INDEX IF NOT EXISTS animal_treatments_meat_clear_idx ON animal_treatments (farm_id, meat_clear_at) WHERE meat_clear_at IS NOT NULL;

-- Existing treatments: the meat withholding of the product they used, and its end where the last dose
-- time is known (only treatments recorded since 0035 have it).
UPDATE animal_treatments t
SET meat_withholding_hours = p.meat_withdrawal_days * 24
FROM products p
WHERE p.id = t.product_id AND t.meat_withholding_hours IS NULL AND p.meat_withdrawal_days IS NOT NULL;

UPDATE animal_treatments
SET meat_clear_at = last_dose_at + make_interval(hours => meat_withholding_hours)
WHERE meat_clear_at IS NULL AND meat_withholding_hours IS NOT NULL AND last_dose_at IS NOT NULL
  AND coalesce(doses_given, 0) >= greatest(1, coalesce(total_doses, 1));

-- The diagnosis list: shared rows (no farm) and each farm's own, as before
ALTER TABLE conditions
  ADD COLUMN IF NOT EXISTS code varchar(20),
  ADD COLUMN IF NOT EXISTS category varchar(100),
  ADD COLUMN IF NOT EXISTS sort_order integer,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- The farm guard checks the new link to the vet (as 0028 and 0034 do)
DO $$
DECLARE
  t record;
  l record;
  args text;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relname = 'animal_treatments'
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
