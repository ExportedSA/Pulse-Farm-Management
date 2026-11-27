-- The audit log (build guide F3): who created, changed, deleted, exported or opened what, and when.
--
-- Written by server/middleware/audit.ts after every successful change to a farm's data through the
-- API, and by recordAudit() for reads worth keeping (a farm's full export now; shared links later).
-- Only the names of the fields a change touched are kept, never their values, so the log holds no
-- passwords, tokens or personal details. A farm's web requests can read and add to its log, never
-- change or delete it.

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A farm's log goes with the farm only if the farm itself is ever deleted outright
  farm_id uuid NOT NULL DEFAULT NULLIF(current_setting('app.farm_id', true), '')::uuid REFERENCES farms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(10) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'view', 'export')),
  record_type varchar(60) NOT NULL,          -- e.g. animals, treatments, hardware/draft-rules
  record_id varchar(64),                     -- the record's id, when the request names or returns one
  method varchar(10),
  path varchar(300),
  status integer,
  details jsonb NOT NULL DEFAULT '{}'::jsonb, -- e.g. { "fields": ["name", "lane"] }
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_farm_time ON audit_events (farm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_farm_user ON audit_events (farm_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_record ON audit_events (farm_id, record_type, record_id);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farm_isolation ON audit_events;
CREATE POLICY farm_isolation ON audit_events
  USING (farm_id = NULLIF(current_setting('app.farm_id', true), '')::uuid);
REVOKE UPDATE, DELETE ON audit_events FROM pulse_app;
GRANT SELECT, INSERT ON audit_events TO pulse_app;
DROP TRIGGER IF EXISTS pulse_farm_guard ON audit_events;
CREATE TRIGGER pulse_farm_guard BEFORE INSERT OR UPDATE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION pulse_farm_guard();
