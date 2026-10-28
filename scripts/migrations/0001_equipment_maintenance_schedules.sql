CREATE TABLE IF NOT EXISTS equipment_maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  maintenance_type varchar(100) NOT NULL,
  frequency varchar(20) NOT NULL,
  next_due date NOT NULL,
  last_completed date,
  priority varchar(10) NOT NULL DEFAULT 'medium',
  estimated_cost numeric(10, 2),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_maintenance_schedules_farm_due_idx
  ON equipment_maintenance_schedules (farm_id, next_due);
