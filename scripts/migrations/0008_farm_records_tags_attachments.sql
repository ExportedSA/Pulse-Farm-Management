-- Paddocks belonged to no farm; attach existing ones when the database has a single farm
ALTER TABLE pastures ADD COLUMN IF NOT EXISTS farm_id uuid REFERENCES farms(id);
UPDATE pastures
SET farm_id = (SELECT id FROM farms ORDER BY created_at LIMIT 1)
WHERE farm_id IS NULL AND (SELECT count(*) FROM farms) = 1;

CREATE TABLE IF NOT EXISTS farm_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  type varchar(30) NOT NULL,
  title varchar(255) NOT NULL,
  notes text,
  occurred_at timestamp NOT NULL,
  pasture_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_by uuid NOT NULL REFERENCES users(id),
  client_id varchar(64),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp,
  UNIQUE (farm_id, client_id),
  -- Words to search: title, notes and any text inside details (product, supplier, docket...)
  search tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(notes, '')), 'B') ||
    setweight(jsonb_to_tsvector('english', details, '["string"]'), 'C')
  ) STORED
);
CREATE INDEX IF NOT EXISTS farm_records_farm_occurred_idx ON farm_records (farm_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS farm_records_search_idx ON farm_records USING gin (search);
CREATE INDEX IF NOT EXISTS farm_records_pastures_idx ON farm_records USING gin (pasture_ids);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  name varchar(60) NOT NULL,
  slug varchar(60) NOT NULL,
  color varchar(20),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (farm_id, slug)
);

CREATE TABLE IF NOT EXISTS taggings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type varchar(30) NOT NULL,
  entity_id uuid NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (tag_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS taggings_entity_idx ON taggings (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  entity_type varchar(30) NOT NULL,
  entity_id uuid NOT NULL,
  kind varchar(20) NOT NULL,
  url text NOT NULL,
  storage_key text NOT NULL,
  file_name varchar(255),
  mime_type varchar(100),
  file_size integer,
  caption text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  taken_at timestamp,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attachments_entity_idx ON attachments (entity_type, entity_id);
