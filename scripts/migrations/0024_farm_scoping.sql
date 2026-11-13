-- Every farm's data is its own: add farm_id to the tables that lacked it, fill it in, and
-- require it from now on.
--
-- Root tables (nothing above them on a farm) get farm_id from the app on every insert.
-- Child tables get it from their parent: the pulse_farm_guard trigger copies the parent's
-- farm when the insert leaves it out, and refuses a row whose parents belong to different
-- farms, or a change of farm. So a child can never be attached to another farm's animal,
-- vehicle, channel and so on.
--
-- Existing rows: children take their parent's farm; anything left over goes to the farm, but
-- only when the database has exactly one. With more than one farm the migration stops rather
-- than guess.

CREATE OR REPLACE FUNCTION pulse_farm_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  i int := 0;
  pid uuid;
  pfarm uuid;
  rec jsonb := to_jsonb(NEW);
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.farm_id IS NOT NULL AND NEW.farm_id IS DISTINCT FROM OLD.farm_id THEN
    RAISE EXCEPTION 'A % row cannot move to another farm', TG_TABLE_NAME USING ERRCODE = 'P0403';
  END IF;
  -- Arguments come in pairs: parent table, column holding the parent's id
  WHILE i < TG_NARGS LOOP
    pid := NULLIF(rec->>TG_ARGV[i + 1], '')::uuid;
    IF pid IS NOT NULL THEN
      EXECUTE format('SELECT farm_id FROM %I WHERE id = $1', TG_ARGV[i]) INTO pfarm USING pid;
      IF pfarm IS NOT NULL THEN
        IF NEW.farm_id IS NULL THEN
          NEW.farm_id := pfarm;
        ELSIF NEW.farm_id <> pfarm THEN
          RAISE EXCEPTION 'The linked % belongs to another farm', TG_ARGV[i] USING ERRCODE = 'P0403';
        END IF;
      END IF;
    END IF;
    i := i + 2;
  END LOOP;
  RETURN NEW;
END $$;

DO $$
DECLARE
  -- Table, then its parents as (table, column) pairs. Parents come before children.
  scoped text[][] := ARRAY[
    ['activity_logs', '', '', '', '', '', ''],
    ['animal_groups', '', '', '', '', '', ''],
    ['budgets', '', '', '', '', '', ''],
    ['chat_channels', '', '', '', '', '', ''],
    ['compliance_audits', '', '', '', '', '', ''],
    ['compliance_documents', '', '', '', '', '', ''],
    ['compliance_checks', '', '', '', '', '', ''],
    ['contractors', '', '', '', '', '', ''],
    ['forecasts', '', '', '', '', '', ''],
    ['killsheets', '', '', '', '', '', ''],
    ['milk_records', '', '', '', '', '', ''],
    ['pasture_walk_sessions', '', '', '', '', '', ''],
    ['products', '', '', '', '', '', ''],
    ['qr_codes', '', '', '', '', '', ''],
    ['settings', '', '', '', '', '', ''],
    ['staff_profiles', '', '', '', '', '', ''],
    ['veterinarians', '', '', '', '', '', ''],
    ['vet_cost_records', '', '', '', '', '', ''],
    ['visitors', '', '', '', '', '', ''],
    ['vehicles', '', '', '', '', '', ''],
    ['vehicle_inspection_templates', '', '', '', '', '', ''],
    ['product_batches', 'products', 'product_id', '', '', '', ''],
    ['treatment_templates', 'products', 'product_id', '', '', '', ''],
    ['batch_treatments', 'products', 'product_id', 'treatment_templates', 'template_id', '', ''],
    ['eid_scan_sessions', 'batch_treatments', 'related_batch_treatment_id', '', '', '', ''],
    ['vet_visits', 'veterinarians', 'veterinarian_id', '', '', '', ''],
    ['animal_treatments', 'animals', 'animal_id', 'products', 'product_id', 'product_batches', 'batch_id'],
    ['treatment_events', 'animal_treatments', 'treatment_id', '', '', '', ''],
    ['batch_lifecycle_events', 'product_batches', 'batch_id', 'animal_treatments', 'related_treatment_id', '', ''],
    ['alerts', 'animals', 'animal_id', 'animal_treatments', 'treatment_id', 'vehicles', 'vehicle_id'],
    ['notification_logs', 'alerts', 'alert_id', '', '', '', ''],
    ['animal_group_members', 'animal_groups', 'group_id', 'animals', 'animal_id', '', ''],
    ['weight_targets', 'animal_groups', 'group_id', '', '', '', ''],
    ['vaccination_schedules', 'animal_groups', 'group_id', 'products', 'vaccine_product_id', '', ''],
    ['animal_health_records', 'animals', 'animal_id', 'animal_treatments', 'treatment_id', 'vet_visits', 'vet_visit_id'],
    ['animal_tag_history', 'animals', 'animal_id', '', '', '', ''],
    ['bulls', 'animals', 'animal_id', '', '', '', ''],
    ['breeding_records', 'animals', 'animal_id', 'bulls', 'bull_id', '', ''],
    ['calving_records', 'animals', 'dam_id', 'bulls', 'sire_id', 'breeding_records', 'breeding_record_id'],
    ['heat_records', 'animals', 'animal_id', 'breeding_records', 'breeding_record_id', '', ''],
    ['lactation_records', 'animals', 'animal_id', 'calving_records', 'calving_record_id', '', ''],
    ['health_scores', 'animals', 'animal_id', '', '', '', ''],
    ['health_alerts', 'animals', 'animal_id', 'health_scores', 'related_health_score_id', '', ''],
    ['herd_test_results', 'animals', 'animal_id', '', '', '', ''],
    ['lab_results', 'animals', 'animal_id', 'vet_visits', 'vet_visit_id', '', ''],
    ['milk_withholdings', 'animals', 'animal_id', 'animal_treatments', 'treatment_id', '', ''],
    ['mortality_records', 'animals', 'animal_id', 'animal_treatments', 'related_treatment_id', '', ''],
    ['nait_queue', 'animals', 'animal_id', '', '', '', ''],
    ['nait_records', 'animals', 'animal_id', '', '', '', ''],
    ['photo_attachments', 'animals', 'animal_id', 'animal_treatments', 'treatment_id', 'vet_visits', 'vet_visit_id'],
    ['prescriptions', 'animals', 'animal_id', 'vet_visits', 'vet_visit_id', 'products', 'product_id'],
    ['reproduction_events', 'animals', 'animal_id', '', '', '', ''],
    ['voice_notes', 'animals', 'animal_id', 'animal_treatments', 'treatment_id', '', ''],
    ['weight_records', 'animals', 'animal_id', '', '', '', ''],
    ['pasture_movements', 'animals', 'animal_id', 'pastures', 'to_pasture_id', 'pastures', 'from_pasture_id'],
    ['pasture_health_records', 'pastures', 'pasture_id', '', '', '', ''],
    ['pasture_cover_measurements', 'pastures', 'pasture_id', 'pasture_walk_sessions', 'session_id', '', ''],
    ['task_pins', 'pastures', 'pasture_id', 'animals', 'animal_id', '', ''],
    ['expenses', 'animals', 'animal_id', 'pastures', 'pasture_id', 'vehicles', 'vehicle_id'],
    ['budget_categories', 'budgets', 'budget_id', '', '', '', ''],
    ['forecast_data', 'forecasts', 'forecast_id', '', '', '', ''],
    ['killsheet_items', 'killsheets', 'killsheet_id', 'animals', 'animal_id', '', ''],
    ['milk_quality_alerts', 'milk_records', 'milk_record_id', '', '', '', ''],
    ['chat_channel_members', 'chat_channels', 'channel_id', '', '', '', ''],
    ['chat_messages', 'chat_channels', 'channel_id', '', '', '', ''],
    ['chat_message_pins', 'chat_channels', 'channel_id', 'chat_messages', 'message_id', '', ''],
    ['chat_message_reads', 'chat_messages', 'message_id', '', '', '', ''],
    ['contractor_documents', 'contractors', 'contractor_id', '', '', '', ''],
    ['contractor_work_records', 'contractors', 'contractor_id', '', '', '', ''],
    ['staff_certifications', 'staff_profiles', 'staff_profile_id', '', '', '', ''],
    ['visitor_sign_ins', 'visitors', 'visitor_id', '', '', '', ''],
    ['vehicle_inspection_items', 'vehicle_inspection_templates', 'template_id', '', '', '', ''],
    ['vehicle_inspections', 'vehicles', 'vehicle_id', 'vehicle_inspection_templates', 'template_id', '', ''],
    ['vehicle_inspection_results', 'vehicle_inspections', 'inspection_id', '', '', '', ''],
    ['vehicle_maintenance_records', 'vehicles', 'vehicle_id', '', '', '', ''],
    ['device_data_logs', 'devices', 'device_id', '', '', '', ''],
    ['equipment_service_history', 'equipment', 'equipment_id', '', '', '', ''],
    ['job_assignments', 'jobs', 'job_id', '', '', '', '']
  ];
  -- Tables that already had farm_id but allowed it to be empty
  tighten text[] := ARRAY['animals', 'farm_hazards', 'financial_transactions', 'milk_production', 'notifications',
    'pastures', 'recurring_task_instances', 'recurring_task_templates', 'report_history', 'scheduled_reports',
    'stock_transactions', 'timesheets'];
  farm_count int;
  only_farm uuid;
  t text;
  args text;
  left_over int;
  j int;
BEGIN
  SELECT count(*), min(id::text)::uuid INTO farm_count, only_farm FROM farms;

  FOR i IN 1 .. array_length(scoped, 1) LOOP
    t := scoped[i][1];
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS farm_id uuid REFERENCES farms(id)', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (farm_id)', t || '_farm_idx', t);

    args := '';
    j := 2;
    WHILE j <= 6 AND scoped[i][j] <> '' LOOP
      args := args || CASE WHEN args = '' THEN '' ELSE ', ' END || quote_literal(scoped[i][j]) || ', ' || quote_literal(scoped[i][j + 1]);
      j := j + 2;
    END LOOP;
    EXECUTE format('DROP TRIGGER IF EXISTS pulse_farm_guard ON %I', t);
    EXECUTE format('CREATE TRIGGER pulse_farm_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION pulse_farm_guard(%s)', t, args);

    -- Children: the trigger fills farm_id from the parent
    IF args <> '' THEN
      EXECUTE format('UPDATE %I SET farm_id = NULL WHERE farm_id IS NULL', t);
    END IF;
    EXECUTE format('SELECT count(*) FROM %I WHERE farm_id IS NULL', t) INTO left_over;
    IF left_over > 0 THEN
      IF farm_count <> 1 THEN
        RAISE EXCEPTION '% has % rows with no farm and there are % farms; assign them by hand first', t, left_over, farm_count;
      END IF;
      EXECUTE format('UPDATE %I SET farm_id = %L WHERE farm_id IS NULL', t, only_farm);
    END IF;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN farm_id SET NOT NULL', t);
  END LOOP;

  FOREACH t IN ARRAY tighten LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE farm_id IS NULL', t) INTO left_over;
    IF left_over > 0 THEN
      IF farm_count <> 1 THEN
        RAISE EXCEPTION '% has % rows with no farm and there are % farms; assign them by hand first', t, left_over, farm_count;
      END IF;
      EXECUTE format('UPDATE %I SET farm_id = %L WHERE farm_id IS NULL', t, only_farm);
    END IF;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN farm_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (farm_id)', t || '_farm_idx', t);
  END LOOP;
END $$;

-- Lists a farm can add to but which start with built-in entries: farm_id is empty for the
-- built-in ones (shared by every farm) and set for a farm's own
ALTER TABLE conditions ADD COLUMN IF NOT EXISTS farm_id uuid REFERENCES farms(id);
ALTER TABLE vehicle_types ADD COLUMN IF NOT EXISTS farm_id uuid REFERENCES farms(id);
CREATE INDEX IF NOT EXISTS conditions_farm_idx ON conditions (farm_id);
CREATE INDEX IF NOT EXISTS vehicle_types_farm_idx ON vehicle_types (farm_id);
