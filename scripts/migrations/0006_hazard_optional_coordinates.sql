-- Hazards are often logged without GPS; the API used to fill in made-up coordinates
ALTER TABLE farm_hazards ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE farm_hazards ALTER COLUMN longitude DROP NOT NULL;
