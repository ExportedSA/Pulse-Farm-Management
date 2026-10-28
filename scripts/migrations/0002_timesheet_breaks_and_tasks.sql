ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS breaks jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS task_log jsonb NOT NULL DEFAULT '[]'::jsonb;
