-- Stage 5: effluent, slurry, baleage, silage, topping and mowing as jobs on the map.
-- Each activity's own fields live in applications.details (checked by the server per activity).

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Travelling irrigator: the run as drawn, the wetted width and a drift allowance (metres)
  ADD COLUMN IF NOT EXISTS run_geom geography(LineString, 4326),
  ADD COLUMN IF NOT EXISTS wetted_width_m numeric(8, 2),
  ADD COLUMN IF NOT EXISTS drift_m numeric(8, 2),
  -- Mowing for feed belongs to one baleage or silage job, so the cut isn't counted twice
  ADD COLUMN IF NOT EXISTS linked_job_id uuid REFERENCES applications(id);

CREATE UNIQUE INDEX IF NOT EXISTS applications_linked_job_idx ON applications (linked_job_id)
  WHERE linked_job_id IS NOT NULL AND deleted_at IS NULL AND status <> 'cancelled';

-- The shared "typical" effluent analysis had no source; nitrogen is no longer estimated from it
UPDATE input_products SET archived_at = COALESCE(archived_at, now()), verification = 'unverified',
  source_note = 'Generic typical analysis with no source; no longer used for nitrogen totals'
WHERE farm_id IS NULL AND kind = 'effluent';
