-- Hazards belonged to no farm; attach existing ones when the database has a single farm
ALTER TABLE farm_hazards ADD COLUMN IF NOT EXISTS farm_id uuid REFERENCES farms(id);
UPDATE farm_hazards
SET farm_id = (SELECT id FROM farms ORDER BY created_at LIMIT 1)
WHERE farm_id IS NULL AND (SELECT count(*) FROM farms) = 1;

CREATE TABLE IF NOT EXISTS safety_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  type varchar(50) NOT NULL,
  description text NOT NULL,
  severity varchar(20) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'open',
  occurred_at timestamp NOT NULL,
  location varchar(255),
  reported_by uuid NOT NULL REFERENCES users(id),
  resolved_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS safety_incidents_farm_occurred_idx ON safety_incidents (farm_id, occurred_at DESC);
