-- Numbers and names that only have to be unique within a farm: two farms can both have cow 1,
-- stock the same product barcode, keep the same setting, and an animal, vehicle or piece of
-- equipment sold from one farm to another can be recorded on both.
-- QR codes stay unique everywhere (a visitor's scan finds the farm from the code).

ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_cow_id_unique;
ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_eid_unique;
ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_lifetime_id_unique;
ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_national_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS animals_farm_cow_id_unique ON animals (farm_id, cow_id);
CREATE UNIQUE INDEX IF NOT EXISTS animals_farm_eid_unique ON animals (farm_id, eid);
CREATE UNIQUE INDEX IF NOT EXISTS animals_farm_lifetime_id_unique ON animals (farm_id, lifetime_id);
CREATE UNIQUE INDEX IF NOT EXISTS animals_farm_national_id_unique ON animals (farm_id, national_id);

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_unique;
CREATE UNIQUE INDEX IF NOT EXISTS products_farm_barcode_unique ON products (farm_id, barcode);

ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_unique;
CREATE UNIQUE INDEX IF NOT EXISTS settings_farm_key_unique ON settings (farm_id, key);

ALTER TABLE bulls DROP CONSTRAINT IF EXISTS bulls_code_unique;
CREATE UNIQUE INDEX IF NOT EXISTS bulls_farm_code_unique ON bulls (farm_id, code);

ALTER TABLE staff_profiles DROP CONSTRAINT IF EXISTS staff_profiles_user_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS staff_profiles_farm_user_unique ON staff_profiles (farm_id, user_id);

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_registration_unique;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vin_unique;
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_farm_registration_unique ON vehicles (farm_id, registration);
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_farm_vin_unique ON vehicles (farm_id, vin);

ALTER TABLE equipment DROP CONSTRAINT IF EXISTS equipment_serial_number_unique;
CREATE UNIQUE INDEX IF NOT EXISTS equipment_farm_serial_number_unique ON equipment (farm_id, serial_number);

ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_serial_number_unique;
CREATE UNIQUE INDEX IF NOT EXISTS devices_farm_serial_number_unique ON devices (farm_id, serial_number);

-- Built-in vehicle types are unique by name; a farm's own may reuse a built-in name
ALTER TABLE vehicle_types DROP CONSTRAINT IF EXISTS vehicle_types_name_unique;
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_types_builtin_name_unique ON vehicle_types (name) WHERE farm_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_types_farm_name_unique ON vehicle_types (farm_id, name) WHERE farm_id IS NOT NULL;
