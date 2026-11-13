-- Health & safety on the farm map: hazards drawn where they are (a point, a line such as a
-- power line, or an area such as an effluent pond), incidents placed where they happened, and
-- the farm's own safety documents.

ALTER TABLE farm_hazards ADD COLUMN IF NOT EXISTS geom geography(Geometry, 4326);
ALTER TABLE farm_hazards ADD COLUMN IF NOT EXISTS radius_m numeric(10, 2);
-- Hazards logged with GPS become points
UPDATE farm_hazards SET geom = ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography
WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS farm_hazards_geom_idx ON farm_hazards USING gist (geom);

ALTER TABLE safety_incidents ADD COLUMN IF NOT EXISTS geom geography(Point, 4326);

-- The farm's H&S documents (safety plan, emergency procedures, chemical register, ...). The
-- files themselves are attachments (entity_type 'safety_document').
CREATE TABLE IF NOT EXISTS safety_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL DEFAULT NULLIF(current_setting('app.farm_id', true), '')::uuid REFERENCES farms(id),
  title varchar(200) NOT NULL,
  doc_type varchar(40) NOT NULL,
  review_due date,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  archived_at timestamp
);
CREATE INDEX IF NOT EXISTS safety_documents_farm_idx ON safety_documents (farm_id);
ALTER TABLE safety_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farm_isolation ON safety_documents;
CREATE POLICY farm_isolation ON safety_documents USING (farm_id = NULLIF(current_setting('app.farm_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON safety_documents TO pulse_app;
