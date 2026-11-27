-- The shed link to Stride (docs/shed-link-protocol.md): Stride, on the shed PC, connects out to Pulse.
--
-- hardware_gateways learns its kind: 'http' (Pulse calls the gateway's address, as before) or 'stride'
-- (Stride connects in with a link token; only the token's SHA-256 is kept). Draft rules and feed levels
-- are set in Pulse and sent to Stride; every EID read, draft and feed Stride reports is kept in
-- shed_events, once per Stride event id.

ALTER TABLE hardware_gateways ADD COLUMN IF NOT EXISTS kind varchar(10) NOT NULL DEFAULT 'http';
ALTER TABLE hardware_gateways DROP CONSTRAINT IF EXISTS hardware_gateways_kind_check;
ALTER TABLE hardware_gateways ADD CONSTRAINT hardware_gateways_kind_check CHECK (kind IN ('http', 'stride'));
ALTER TABLE hardware_gateways ADD COLUMN IF NOT EXISTS link_token_hash varchar(64);
ALTER TABLE hardware_gateways ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS hardware_gateways_link_token ON hardware_gateways (link_token_hash)
  WHERE link_token_hash IS NOT NULL;
-- "A real gateway belongs to one farm" is about addresses Pulse calls; Stride gateways have none
DROP INDEX IF EXISTS hardware_gateways_one_farm_per_gateway;
CREATE UNIQUE INDEX hardware_gateways_one_farm_per_gateway
  ON hardware_gateways ((coalesce(base_url, ''))) WHERE is_active AND NOT simulated AND kind = 'http';

CREATE TABLE IF NOT EXISTS shed_draft_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL DEFAULT NULLIF(current_setting('app.farm_id', true), '')::uuid REFERENCES farms(id),
  name varchar(100) NOT NULL,
  lane varchar(10) NOT NULL CHECK (lane IN ('LEFT', 'RIGHT', 'STRAIGHT')),
  priority integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  condition_type varchar(30) NOT NULL
    CHECK (condition_type IN ('milk_withholding', 'dose_due', 'in_group', 'heat', 'cow_numbers')),
  group_id uuid REFERENCES animal_groups(id) ON DELETE CASCADE,
  within_hours integer CHECK (within_hours IS NULL OR within_hours BETWEEN 1 AND 720),
  cow_numbers text[],
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CHECK (condition_type <> 'in_group' OR group_id IS NOT NULL),
  CHECK (condition_type NOT IN ('dose_due', 'heat') OR within_hours IS NOT NULL),
  CHECK (condition_type <> 'cow_numbers' OR coalesce(array_length(cow_numbers, 1), 0) > 0)
);
CREATE INDEX IF NOT EXISTS shed_draft_rules_farm ON shed_draft_rules (farm_id);

CREATE TABLE IF NOT EXISTS shed_feed_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL DEFAULT NULLIF(current_setting('app.farm_id', true), '')::uuid REFERENCES farms(id),
  animal_id uuid REFERENCES animals(id) ON DELETE CASCADE,
  group_id uuid REFERENCES animal_groups(id) ON DELETE CASCADE,
  grams_per_visit integer NOT NULL CHECK (grams_per_visit BETWEEN 1 AND 20000),
  priority integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_to date,
  note text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  -- One animal or one group, not both
  CHECK ((animal_id IS NULL) <> (group_id IS NULL)),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);
CREATE INDEX IF NOT EXISTS shed_feed_levels_farm ON shed_feed_levels (farm_id);

CREATE TABLE IF NOT EXISTS shed_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL DEFAULT NULLIF(current_setting('app.farm_id', true), '')::uuid REFERENCES farms(id),
  gateway_id uuid NOT NULL REFERENCES hardware_gateways(id),
  client_id varchar(64) NOT NULL,            -- Stride's own event id
  kind varchar(10) NOT NULL CHECK (kind IN ('eid', 'draft', 'feed')),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  eid varchar(50),
  animal_id uuid REFERENCES animals(id) ON DELETE SET NULL,
  reader varchar(20),
  lane varchar(10),
  source varchar(10),
  reason text,
  bail integer,
  target_grams integer,
  actual_grams integer,
  UNIQUE (gateway_id, client_id)
);
CREATE INDEX IF NOT EXISTS shed_events_farm_time ON shed_events (farm_id, occurred_at DESC);

ALTER TABLE shed_draft_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farm_isolation ON shed_draft_rules;
CREATE POLICY farm_isolation ON shed_draft_rules
  USING (farm_id = NULLIF(current_setting('app.farm_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON shed_draft_rules TO pulse_app;

ALTER TABLE shed_feed_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farm_isolation ON shed_feed_levels;
CREATE POLICY farm_isolation ON shed_feed_levels
  USING (farm_id = NULLIF(current_setting('app.farm_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON shed_feed_levels TO pulse_app;

ALTER TABLE shed_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farm_isolation ON shed_events;
CREATE POLICY farm_isolation ON shed_events
  USING (farm_id = NULLIF(current_setting('app.farm_id', true), '')::uuid);
-- What happened in the shed is only added to
REVOKE UPDATE, DELETE ON shed_events FROM pulse_app;
GRANT SELECT, INSERT ON shed_events TO pulse_app;

-- The farm guard checks the new tables' links to groups, animals and the gateway (as 0028 and 0038 do)
DO $$
DECLARE
  t record;
  l record;
  args text;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname IN ('shed_draft_rules', 'shed_feed_levels', 'shed_events')
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
