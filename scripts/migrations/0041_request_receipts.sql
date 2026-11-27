-- One offline queue for every form (build guide F4).
--
-- A phone that saves a form without signal keeps it and sends it later, perhaps more than once if the
-- connection drops before the answer comes back. Each save carries a request id (the
-- Idempotency-Key header). The first time a farm's request id is seen it is claimed here; once the
-- save has worked its answer is kept, and a repeat of the same id gets that answer back without
-- saving anything again. A save that fails gives its claim up, so it can be tried again.
--
-- Written only by server/middleware/request-receipts.ts as the database owner; a farm's own web
-- requests have no access. Receipts older than 30 days are removed as new ones arrive.

CREATE TABLE IF NOT EXISTS request_receipts (
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  request_key varchar(100) NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  method varchar(10) NOT NULL,
  path varchar(300) NOT NULL,
  state varchar(10) NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'done')),
  status integer,
  body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (farm_id, request_key)
);
CREATE INDEX IF NOT EXISTS request_receipts_created ON request_receipts (created_at);

ALTER TABLE request_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farm_isolation ON request_receipts;
CREATE POLICY farm_isolation ON request_receipts
  USING (farm_id = NULLIF(current_setting('app.farm_id', true), '')::uuid);
REVOKE ALL ON request_receipts FROM pulse_app;
DROP TRIGGER IF EXISTS pulse_farm_guard ON request_receipts;
CREATE TRIGGER pulse_farm_guard BEFORE INSERT OR UPDATE ON request_receipts
  FOR EACH ROW EXECUTE FUNCTION pulse_farm_guard();
