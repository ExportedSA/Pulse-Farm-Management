-- Shed hardware belongs to one farm, and every command sent to it is logged.
--
-- Before this, /api/hardware let any signed-in person, on any farm and in any role, start the bail
-- feed or work the drafting gate on the server's one gateway (PULSE_GATEWAY_URL), and see its EID
-- reads. Now a farm reaches shed hardware only through its own row here.
--
-- Rows are added by whoever runs the service (scripts/hardware-gateway.ts, as the database owner),
-- never from the app: base_url is an address the server calls, so a farm must not be able to set it.

CREATE TABLE IF NOT EXISTS hardware_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL DEFAULT NULLIF(current_setting('app.farm_id', true), '')::uuid REFERENCES farms(id),
  name varchar(100) NOT NULL DEFAULT 'Shed',
  base_url text,                             -- NULL = the server's own gateway, PULSE_GATEWAY_URL
  simulated boolean NOT NULL DEFAULT false,  -- true = the built-in simulator, no real hardware
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);
-- One working gateway per farm for now
CREATE UNIQUE INDEX IF NOT EXISTS hardware_gateways_one_per_farm
  ON hardware_gateways (farm_id) WHERE is_active;
-- A real gateway can only belong to one farm
CREATE UNIQUE INDEX IF NOT EXISTS hardware_gateways_one_farm_per_gateway
  ON hardware_gateways ((coalesce(base_url, ''))) WHERE is_active AND NOT simulated;

ALTER TABLE hardware_gateways ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farm_isolation ON hardware_gateways;
CREATE POLICY farm_isolation ON hardware_gateways
  USING (farm_id = NULLIF(current_setting('app.farm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS pulse_farm_guard ON hardware_gateways;
CREATE TRIGGER pulse_farm_guard BEFORE INSERT OR UPDATE ON hardware_gateways
  FOR EACH ROW EXECUTE FUNCTION pulse_farm_guard();
-- A farm's web requests may read their gateway but not add, change or remove one
REVOKE INSERT, UPDATE, DELETE ON hardware_gateways FROM pulse_app;
GRANT SELECT ON hardware_gateways TO pulse_app;

CREATE TABLE IF NOT EXISTS hardware_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL DEFAULT NULLIF(current_setting('app.farm_id', true), '')::uuid REFERENCES farms(id),
  gateway_id uuid NOT NULL REFERENCES hardware_gateways(id),
  user_id uuid REFERENCES users(id),
  command varchar(30) NOT NULL,              -- feed_start, feed_stop, draft
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  ok boolean NOT NULL,
  error text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hardware_commands_farm_idx ON hardware_commands (farm_id, created_at DESC);

ALTER TABLE hardware_commands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farm_isolation ON hardware_commands;
CREATE POLICY farm_isolation ON hardware_commands
  USING (farm_id = NULLIF(current_setting('app.farm_id', true), '')::uuid);
-- The log is only added to
REVOKE UPDATE, DELETE ON hardware_commands FROM pulse_app;
GRANT SELECT, INSERT ON hardware_commands TO pulse_app;

-- The farm guard checks the link to the gateway (as 0028 and 0036 do)
DO $$
DECLARE
  t record;
  l record;
  args text;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relname = 'hardware_commands'
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
