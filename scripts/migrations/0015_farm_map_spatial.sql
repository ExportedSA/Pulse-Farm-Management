-- Farm map, stage 1: real geographic shapes (PostGIS), versioned paddock boundaries,
-- map layers and features, saved map views and an edit history.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Each change to a paddock's boundary closes the old version; the current one has no valid_to.
-- Records keep pointing at the version that applied when they were saved.
CREATE TABLE IF NOT EXISTS paddock_boundaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  pasture_id uuid NOT NULL REFERENCES pastures(id),
  geom geography(MultiPolygon, 4326) NOT NULL,
  area_ha numeric(12, 4) NOT NULL,
  valid_from timestamp NOT NULL DEFAULT now(),
  valid_to timestamp,
  change_note text,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS paddock_boundaries_geom_idx ON paddock_boundaries USING gist (geom);
CREATE INDEX IF NOT EXISTS paddock_boundaries_pasture_idx ON paddock_boundaries (pasture_id, valid_from);
CREATE UNIQUE INDEX IF NOT EXISTS paddock_boundaries_current_idx ON paddock_boundaries (pasture_id) WHERE valid_to IS NULL;

-- Display layers. Activity records stay separate; a layer only says how things are shown.
CREATE TABLE IF NOT EXISTS map_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  key varchar(40) NOT NULL,
  name varchar(80) NOT NULL,
  kind varchar(10) NOT NULL DEFAULT 'custom',
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  locked boolean NOT NULL DEFAULT false,
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  archived_at timestamp,
  UNIQUE (farm_id, key)
);

-- Points, lines, polygons and circles drawn on a layer (farm boundary, work areas, features)
CREATE TABLE IF NOT EXISTS map_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  layer_id uuid NOT NULL REFERENCES map_layers(id),
  kind varchar(10) NOT NULL,
  name varchar(120),
  notes text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  geom geography(Geometry, 4326) NOT NULL,
  radius_m numeric(10, 2),
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);
CREATE INDEX IF NOT EXISTS map_features_geom_idx ON map_features USING gist (geom);
CREATE INDEX IF NOT EXISTS map_features_farm_layer_idx ON map_features (farm_id, layer_id);

-- Saved map views: where the map was, which basemap, and each layer's visibility
CREATE TABLE IF NOT EXISTS map_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  name varchar(80) NOT NULL,
  center_lat numeric(10, 7) NOT NULL,
  center_lng numeric(10, 7) NOT NULL,
  zoom numeric(5, 2) NOT NULL,
  basemap varchar(20) NOT NULL,
  layers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);

-- Who changed what on the map, and when
CREATE TABLE IF NOT EXISTS map_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  entity_type varchar(30) NOT NULL,
  entity_id uuid NOT NULL,
  action varchar(30) NOT NULL,
  before jsonb,
  after jsonb,
  user_id uuid REFERENCES users(id),
  at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS map_audit_entity_idx ON map_audit (entity_type, entity_id, at);

-- Records keep the paddock areas (and boundary versions) that applied when they were saved
ALTER TABLE farm_records ADD COLUMN IF NOT EXISTS paddock_snapshot jsonb;

-- Paddocks drawn before boundaries were versioned become their first version
INSERT INTO paddock_boundaries (farm_id, pasture_id, geom, area_ha, change_note)
SELECT p.farm_id, p.id,
       ST_Multi(ST_MakeValid(ST_GeomFromGeoJSON(p.boundaries::text)))::geography,
       ST_Area(ST_Multi(ST_MakeValid(ST_GeomFromGeoJSON(p.boundaries::text)))::geography) / 10000,
       'Existing outline'
FROM pastures p
WHERE p.boundaries IS NOT NULL AND p.farm_id IS NOT NULL AND p.deleted_at IS NULL
  AND p.boundaries->>'type' IN ('Polygon', 'MultiPolygon')
  AND NOT EXISTS (SELECT 1 FROM paddock_boundaries b WHERE b.pasture_id = p.id);
