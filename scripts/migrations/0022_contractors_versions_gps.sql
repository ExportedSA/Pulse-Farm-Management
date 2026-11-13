-- Stage 6: contractor access, versioned job corrections, GPS evidence, farm product checks.

-- Contractors see only the jobs shared with them (and the map needed to do them)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'contractor';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS shared_with uuid[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS applications_shared_idx ON applications USING gin (shared_with);

-- The whole job as it was before each change, so a completed record can be corrected and the
-- earlier version still read
CREATE TABLE IF NOT EXISTS application_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  version integer NOT NULL,
  data jsonb NOT NULL,
  reason text,
  changed_by uuid REFERENCES users(id),
  changed_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (application_id, version)
);

-- Imported GPS evidence (a track or covered area from the machine), kept apart from the drawn lines
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS gps_geom geography(Geometry, 4326),
  ADD COLUMN IF NOT EXISTS gps_source text,
  ADD COLUMN IF NOT EXISTS gps_imported_at timestamp;

-- A manager's check of a farm-entered product against its label
ALTER TABLE input_products
  ADD COLUMN IF NOT EXISTS checked_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS checked_at timestamp,
  ADD COLUMN IF NOT EXISTS check_reference text;
