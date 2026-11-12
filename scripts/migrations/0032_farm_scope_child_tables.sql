-- The last farm tables without their own farm: application_dockets, application_lines,
-- application_mix, application_versions (under applications), rate_zones (under rate_plans) and
-- taggings (under tags).
--
-- They had no farm_id, so row-level security couldn't apply to them and a web request (running
-- as pulse_app) could read or change any farm's rows in them; only the routes' joins through the
-- parent kept farms apart. Now they work like every other farm table (0024, 0025, 0028):
--   - farm_id is required, filled in for existing rows from the parent;
--   - it defaults to the request's farm (app.farm_id);
--   - the farm guard fills it from the parent when it's left out (scripts and jobs running as the
--     owner) and refuses a link to another farm's row, through any of the table's links; tables
--     linking to these get their guard rebuilt too, since those links now join two farm tables;
--   - row-level security shows and accepts only the request's farm's rows.

DO $$
DECLARE
  -- Table, its parent, and the column holding the parent's id
  kids text[][] := ARRAY[
    ['application_dockets', 'applications', 'application_id'],
    ['application_lines', 'applications', 'application_id'],
    ['application_mix', 'applications', 'application_id'],
    ['application_versions', 'applications', 'application_id'],
    ['rate_zones', 'rate_plans', 'plan_id'],
    ['taggings', 'tags', 'tag_id']
  ];
  t text;
  l record;
  args text;
  bad int;
BEGIN
  FOR i IN 1 .. array_length(kids, 1) LOOP
    t := kids[i][1];
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS farm_id uuid REFERENCES farms(id)', t);
    EXECUTE format('UPDATE %I c SET farm_id = p.farm_id FROM %I p WHERE p.id = c.%I AND c.farm_id IS NULL',
      t, kids[i][2], kids[i][3]);
    -- The parent link is required and every parent has a farm, so nothing should be left
    EXECUTE format('SELECT count(*) FROM %I WHERE farm_id IS NULL', t) INTO bad;
    IF bad > 0 THEN
      RAISE EXCEPTION '% has % rows whose % has no farm; fix them first', t, bad, kids[i][2];
    END IF;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN farm_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN farm_id SET DEFAULT NULLIF(current_setting(''app.farm_id'', true), '''')::uuid', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (farm_id)', t || '_farm_idx', t);

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS farm_isolation ON %I', t);
    EXECUTE format('CREATE POLICY farm_isolation ON %I USING (farm_id = NULLIF(current_setting(''app.farm_id'', true), '''')::uuid)', t);
  END LOOP;

  -- The guard, with every link to a farm table (built as 0028 does), on these tables and on the
  -- tables that link to them (restrictions.mix_id -> application_mix is now a farm-to-farm link)
  FOR t IN
    SELECT c.relname FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
      AND EXISTS (SELECT 1 FROM pg_attribute f WHERE f.attrelid = c.oid AND f.attname = 'farm_id' AND NOT f.attisdropped)
      AND (c.relname = ANY (SELECT kids[j][1] FROM generate_subscripts(kids, 1) j)
        OR EXISTS (SELECT 1 FROM pg_constraint k JOIN pg_class p ON p.oid = k.confrelid
                   WHERE k.conrelid = c.oid AND k.contype = 'f'
                     AND p.relname = ANY (SELECT kids[j][1] FROM generate_subscripts(kids, 1) j)))
    ORDER BY c.relname
  LOOP
    args := '';
    FOR l IN
      SELECT p.relname AS parent, a.attname AS col
      FROM pg_constraint k
      JOIN pg_class p ON p.oid = k.confrelid
      JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
      JOIN pg_attribute pk ON pk.attrelid = k.confrelid AND pk.attnum = k.confkey[1]
      WHERE k.conrelid = t::regclass AND k.contype = 'f' AND array_length(k.conkey, 1) = 1
        AND pk.attname = 'id' AND a.attname <> 'farm_id' AND p.relname <> 'farms'
        AND EXISTS (SELECT 1 FROM pg_attribute f WHERE f.attrelid = p.oid AND f.attname = 'farm_id' AND NOT f.attisdropped)
      ORDER BY p.relname, a.attname
    LOOP
      -- Rows that already cross farms would make every later edit of them fail
      EXECUTE format(
        'SELECT count(*) FROM %I c JOIN %I p ON p.id = c.%I WHERE c.farm_id <> p.farm_id',
        t, l.parent, l.col) INTO bad;
      IF bad > 0 THEN
        RAISE EXCEPTION '% % rows link (%) to another farm''s %; fix them first', bad, t, l.col, l.parent;
      END IF;
      args := args || CASE WHEN args = '' THEN '' ELSE ', ' END || quote_literal(l.parent) || ', ' || quote_literal(l.col);
    END LOOP;
    EXECUTE format('DROP TRIGGER IF EXISTS pulse_farm_guard ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER pulse_farm_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION pulse_farm_guard(%s)',
      t, args);
  END LOOP;
END $$;
