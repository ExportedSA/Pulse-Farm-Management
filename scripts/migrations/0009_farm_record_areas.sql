-- Area worked (sprayed, spread, cut...) drawn on the farm map, and its size
ALTER TABLE farm_records ADD COLUMN IF NOT EXISTS area jsonb;
ALTER TABLE farm_records ADD COLUMN IF NOT EXISTS area_ha numeric(10, 2);
