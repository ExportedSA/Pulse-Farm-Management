-- Job completion proof (who, where, note, and the Job done record it made) and reminder tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_by_id uuid REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completion_note text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completion_latitude numeric(10, 7);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completion_longitude numeric(10, 7);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completion_record_id uuid REFERENCES farm_records(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS overdue_notified_at timestamp;

-- One "your jobs today" message per person per farm per day
CREATE TABLE IF NOT EXISTS job_digests (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  day date NOT NULL,
  sent_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, farm_id, day)
);
