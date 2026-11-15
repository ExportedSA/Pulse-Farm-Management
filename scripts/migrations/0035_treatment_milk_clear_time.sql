-- Milk withholding to the minute, counted from the last dose (shared/withholding.ts).
-- Before this, a treatment kept only a date for its last dose and a "withdrawal end" date worked out
-- on the device from the FIRST dose, so a cow on a course of several doses could show as clear for
-- the vat days early, and the server never heard about doses given after the first.
ALTER TABLE animal_treatments
  ADD COLUMN IF NOT EXISTS last_dose_at timestamptz,
  ADD COLUMN IF NOT EXISTS milk_withholding_hours integer CHECK (milk_withholding_hours >= 0),
  ADD COLUMN IF NOT EXISTS milk_clear_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_to_vat_at timestamptz;

-- Existing treatments: their withholding in hours, from the days they recorded. Their last dose time
-- isn't known, so no clear time is set; the app shows them as still withheld until it's recorded.
UPDATE animal_treatments
SET milk_withholding_hours = milk_withdrawal_days * 24
WHERE milk_withholding_hours IS NULL AND milk_withdrawal_days IS NOT NULL;
