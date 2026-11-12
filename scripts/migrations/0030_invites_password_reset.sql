-- Email invites to a farm, and password reset links.
--
-- Only a hash of each link's secret is stored, so the table alone can't be used to join a farm
-- or reset a password.

CREATE TABLE IF NOT EXISTS farm_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL DEFAULT NULLIF(current_setting('app.farm_id', true), '')::uuid REFERENCES farms(id),
  email varchar(255) NOT NULL,              -- stored lower-case
  role user_role NOT NULL DEFAULT 'worker',
  token_hash varchar(64) NOT NULL UNIQUE,   -- sha256 of the link's secret, hex
  invited_by uuid REFERENCES users(id),
  expires_at timestamp NOT NULL,
  last_sent_at timestamp NOT NULL DEFAULT now(),
  accepted_at timestamp,
  accepted_by uuid REFERENCES users(id),
  revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS farm_invitations_farm ON farm_invitations (farm_id);
-- At most one open invite per person per farm; inviting again renews it
CREATE UNIQUE INDEX IF NOT EXISTS farm_invitations_open
  ON farm_invitations (farm_id, email) WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- A farm's invites are that farm's rows, like every other farm table (see 0025 and 0028)
ALTER TABLE farm_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farm_isolation ON farm_invitations;
CREATE POLICY farm_isolation ON farm_invitations
  USING (farm_id = NULLIF(current_setting('app.farm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS pulse_farm_guard ON farm_invitations;
CREATE TRIGGER pulse_farm_guard BEFORE INSERT OR UPDATE ON farm_invitations
  FOR EACH ROW EXECUTE FUNCTION pulse_farm_guard();

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user ON password_reset_tokens (user_id);

-- Only signing in (which runs as the database owner) uses these. With row-level security on and
-- no policy, a farm's web request (pulse_app) can't read or write any of them.
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
