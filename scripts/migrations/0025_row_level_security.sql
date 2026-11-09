-- The database itself keeps each farm's rows to that farm.
--
-- Web requests run as pulse_app (switched to with SET ROLE for the request) with the
-- request's farm in the app.farm_id setting. Row-level security then shows and accepts only
-- that farm's rows, so a query that forgets its farm filter returns nothing from other farms
-- instead of everything. With no farm set, these tables show nothing.
--
-- Migrations, scheduled jobs and scripts keep running as the database owner, which is not
-- limited, and must say which farm they're working on.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pulse_app') THEN
    CREATE ROLE pulse_app NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT pulse_app TO CURRENT_USER;

GRANT USAGE ON SCHEMA public TO pulse_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pulse_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO pulse_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pulse_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO pulse_app;

-- The guard looks up a parent's farm, which may be another farm's row it can't otherwise see
ALTER FUNCTION pulse_farm_guard() SECURITY DEFINER SET search_path = public;

DO $$
DECLARE
  t text;
  -- Read before a farm is chosen (signing in, picking a farm) or shared across farms
  unscoped text[] := ARRAY['farm_members', 'farms', 'input_products', 'users'];
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_name = c.table_name AND tb.table_schema = c.table_schema
    WHERE c.table_schema = 'public' AND c.column_name = 'farm_id' AND c.is_nullable = 'NO'
      AND tb.table_type = 'BASE TABLE' AND c.table_name <> ALL (unscoped)
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN farm_id SET DEFAULT NULLIF(current_setting(''app.farm_id'', true), '''')::uuid', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS farm_isolation ON %I', t);
    EXECUTE format('CREATE POLICY farm_isolation ON %I USING (farm_id = NULLIF(current_setting(''app.farm_id'', true), '''')::uuid)', t);
  END LOOP;

  -- Built-in entries (no farm) are read by every farm; a farm adds and changes only its own
  FOREACH t IN ARRAY ARRAY['conditions', 'vehicle_types'] LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN farm_id SET DEFAULT NULLIF(current_setting(''app.farm_id'', true), '''')::uuid', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS farm_isolation ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS farm_isolation_read ON %I', t);
    EXECUTE format('CREATE POLICY farm_isolation_read ON %I FOR SELECT USING (farm_id IS NULL OR farm_id = NULLIF(current_setting(''app.farm_id'', true), '''')::uuid)', t);
    EXECUTE format('CREATE POLICY farm_isolation ON %I USING (farm_id = NULLIF(current_setting(''app.farm_id'', true), '''')::uuid)', t);
  END LOOP;
END $$;
