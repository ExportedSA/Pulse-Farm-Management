ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'blocked';

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS start_time varchar(5);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS end_time varchar(5);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS end_date timestamp;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS latitude numeric(10, 7);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS longitude numeric(10, 7);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS checklist_items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_duration integer;

CREATE TABLE IF NOT EXISTS job_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id)
);
