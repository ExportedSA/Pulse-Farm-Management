-- One diagnosis list: MINDA's (LIC), with its codes and groups, as farmers record health events in MINDA.
-- Read from MINDA's own Health Record form (116 conditions) and kept in scripts/data/minda-diagnoses.csv.
-- Pulse's older names without a code are hidden, and treatments recorded with them are moved to the
-- MINDA name: "Mastitis" -> "Mastitis - Clinical" (MC), "Lameness" -> "Other Lameness" (LM).
-- The words recorded on a treatment by a farm's own condition stay as written.
--
-- MINDA also records milk withholding in milkings (not only hours or days). The treatment keeps the
-- number of milkings and the hours between milkings, and the server works out the hours from them.

ALTER TABLE animal_treatments
  ADD COLUMN IF NOT EXISTS milk_withholding_milkings integer CHECK (milk_withholding_milkings > 0 AND milk_withholding_milkings <= 100),
  ADD COLUMN IF NOT EXISTS milking_interval_hours integer CHECK (milking_interval_hours > 0 AND milking_interval_hours <= 48);

-- MINDA's list, shared by every farm (no farm_id). Added, or brought up to date where the code is there.
CREATE TEMP TABLE minda_conditions (code varchar(20), name varchar(255), category varchar(100), sort_order int, body_part text) ON COMMIT DROP;
INSERT INTO minda_conditions (code, name, category, sort_order, body_part) VALUES
  ('CD', 'Calving Disorder - Unspecified', 'Calving Disorder', 1, NULL),
  ('CS', 'Caesarean', 'Calving Disorder', 2, NULL),
  ('CT', 'Calving Trouble', 'Calving Disorder', 3, NULL),
  ('CP', 'Calving Paralysis', 'Calving Disorder', 4, NULL),
  ('PU', 'Prolapsed Uterus', 'Calving Disorder', 5, NULL),
  ('RM', 'Retained Membranes', 'Calving Disorder', 6, NULL),
  ('RV', 'Rota Virus', 'Infectious Diseases', 7, NULL),
  ('SA', 'Salmonella', 'Infectious Diseases', 8, NULL),
  ('TB', 'Tuberculosis', 'Infectious Diseases', 9, NULL),
  ('TR', 'TB Reactor', 'Infectious Diseases', 10, NULL),
  ('YS', 'Yersinia', 'Infectious Diseases', 11, NULL),
  ('CC', 'Coccidiosis', 'Infectious Diseases', 12, NULL),
  ('BR', 'Brucellosis', 'Infectious Diseases', 13, NULL),
  ('LI', 'Listeria', 'Infectious Diseases', 14, NULL),
  ('LS', 'Leptospirosis', 'Infectious Diseases', 15, NULL),
  ('LM', 'Other Lameness', 'Lameness', 16, 'foot'),
  ('LN', 'Laminitis', 'Lameness', 17, 'foot'),
  ('LC', 'Interdigital Crack', 'Lameness', 18, 'foot'),
  ('OH', 'Overgrown Hoof', 'Lameness', 19, 'foot'),
  ('BS', 'Sole Bruise', 'Lameness', 20, 'foot'),
  ('DD', 'Digital Dermatitis', 'Lameness', 21, 'foot'),
  ('FR', 'Between Claw/Footrot', 'Lameness', 22, 'foot'),
  ('FU', 'Foot Ulcers', 'Lameness', 23, 'foot'),
  ('WC', 'Hoof Crack', 'Lameness', 24, 'foot'),
  ('WL', 'White Line Disease', 'Lameness', 25, 'foot'),
  ('SU', 'Sole Penetration', 'Lameness', 26, 'foot'),
  ('TC', 'Trace Element Deficiency - Unspecified', 'Metabolic Disorder', 27, NULL),
  ('SD', 'Selenium Deficiency', 'Metabolic Disorder', 28, NULL),
  ('CO', 'Cobalt/B12 Deficiency', 'Metabolic Disorder', 29, NULL),
  ('DC', 'Downer Cow', 'Metabolic Disorder', 30, NULL),
  ('CU', 'Copper Deficiency', 'Metabolic Disorder', 31, NULL),
  ('PT', 'Pregnancy Toxaemia', 'Metabolic Disorder', 32, NULL),
  ('MS', 'Magnesium/Grass Staggers', 'Metabolic Disorder', 33, NULL),
  ('KT', 'Ketosis/Acidosis', 'Metabolic Disorder', 34, NULL),
  ('ME', 'Metabolic Disorder - Unspecified', 'Metabolic Disorder', 35, NULL),
  ('MF', 'Milk Fever', 'Metabolic Disorder', 36, NULL),
  ('LU', 'Lungworm', 'Other Ailments', 37, NULL),
  ('LV', 'Liver Disorder - Unspecified', 'Other Ailments', 38, NULL),
  ('LA', 'Laceration/Cuts', 'Other Ailments', 39, NULL),
  ('EY', 'Eye Injury', 'Other Ailments', 40, NULL),
  ('LF', 'Liver Fluke', 'Other Ailments', 41, NULL),
  ('LJ', 'Lumpy Jaw', 'Other Ailments', 42, NULL),
  ('MO', 'Mouth Disorder - Unspecified', 'Other Ailments', 43, NULL),
  ('ND', 'Nervous Disorder (Non Metabolic)', 'Other Ailments', 44, NULL),
  ('NI', 'Navel Infection', 'Other Ailments', 45, NULL),
  ('OC', 'Other Condition - Unspecified', 'Other Ailments', 46, NULL),
  ('OE', 'Oesophageal Disorder - Unspecified', 'Other Ailments', 47, NULL),
  ('PR', 'Preventative', 'Other Ailments', 48, NULL),
  ('PM', 'PEM (Polioencephalomalacia)', 'Other Ailments', 49, NULL),
  ('PN', 'Pneumonia Or Respiratory Illness', 'Other Ailments', 50, NULL),
  ('OS', 'Ostertagia', 'Other Ailments', 51, NULL),
  ('PA', 'Parasite - Unspecified', 'Other Ailments', 52, NULL),
  ('PE', 'Pink Eye', 'Other Ailments', 53, NULL),
  ('CV', 'Cardiovascular Disorder - Unspecified', 'Other Ailments', 54, NULL),
  ('CE', 'Cancer Eye', 'Other Ailments', 55, NULL),
  ('CN', 'Cancer - Unspecified', 'Other Ailments', 56, NULL),
  ('BV', 'BVD (Bovine Viral Diarrhoea)', 'Other Ailments', 57, NULL),
  ('CA', 'CAE (Caprine Arthritis Encephalitis)', 'Other Ailments', 58, NULL),
  ('AC', 'Abscess - Unspecified', 'Other Ailments', 59, NULL),
  ('AM', 'Abomasal Disorder - Unspecified', 'Other Ailments', 60, NULL),
  ('AR', 'Arthritis', 'Other Ailments', 61, NULL),
  ('BK', 'Blackleg', 'Other Ailments', 62, NULL),
  ('BL', 'Bloat', 'Other Ailments', 63, NULL),
  ('CR', 'Catarrh', 'Other Ailments', 64, NULL),
  ('DI', 'Diarrhoea/Scours', 'Other Ailments', 65, NULL),
  ('DO', 'Dry Off', 'Other Ailments', 66, NULL),
  ('EB', 'EBL (Enzootic Bovine Leukosis)', 'Other Ailments', 67, NULL),
  ('FV', 'Fever', 'Other Ailments', 68, NULL),
  ('GR', 'Grain Overload/Acidosis', 'Other Ailments', 69, NULL),
  ('HE', 'Hernia', 'Other Ailments', 70, NULL),
  ('IB', 'IBR (Infectious Bovine Rhinotracheitis)', 'Other Ailments', 71, NULL),
  ('IC', 'Induction Treatment', 'Other Ailments', 72, NULL),
  ('IG', 'Indigestion', 'Other Ailments', 73, NULL),
  ('IL', 'Intestinal Disorder - Unspecified', 'Other Ailments', 74, NULL),
  ('IT', 'Severe Weight Loss/Ill Thrift', 'Other Ailments', 75, NULL),
  ('JD', 'Johnes Disease', 'Other Ailments', 76, NULL),
  ('SI', 'Sick - Undiagnosed', 'Other Ailments', 77, NULL),
  ('TH', 'Theileria', 'Other Ailments', 78, NULL),
  ('PY', 'Pulpy Kidney', 'Other Ailments', 79, NULL),
  ('RD', 'Respiratory Disorder - Unspecified', 'Other Ailments', 80, NULL),
  ('RE', 'Renal Disorder - Unspecified', 'Other Ailments', 81, NULL),
  ('SV', 'Severe Injury', 'Other Ailments', 82, NULL),
  ('TA', 'Tape Worm', 'Other Ailments', 83, NULL),
  ('TN', 'Tail Injury', 'Other Ailments', 84, NULL),
  ('TO', 'Toxoplasmosis', 'Other Ailments', 85, NULL),
  ('WT', 'Wooden Tongue', 'Other Ailments', 86, NULL),
  ('VA', 'Vaccination', 'Other Ailments', 87, NULL),
  ('RU', 'Rumen Disorder - Unspecified', 'Other Ailments', 88, NULL),
  ('VI', 'Vaginal Injury', 'Reproductive Disorder', 89, NULL),
  ('UI', 'Uterine Infection', 'Reproductive Disorder', 90, NULL),
  ('RP', 'Reproductive Disorder - Unspecified', 'Reproductive Disorder', 91, NULL),
  ('EN', 'Endometriosis', 'Reproductive Disorder', 92, NULL),
  ('AB', 'Abortion', 'Reproductive Disorder', 93, NULL),
  ('OV', 'Ovarian Cyst', 'Reproductive Disorder', 94, NULL),
  ('MR', 'Metri-Check', 'Reproductive Disorder', 95, NULL),
  ('NC', 'Non Cycling/Anoestrus', 'Reproductive Disorder', 96, NULL),
  ('LY', 'Lice', 'Skin Disorder', 97, NULL),
  ('RW', 'Ringworm', 'Skin Disorder', 98, NULL),
  ('SN', 'Skin Disorder - Unspecified', 'Skin Disorder', 99, NULL),
  ('WA', 'Warts', 'Skin Disorder', 100, NULL),
  ('SE', 'Spring Eczema', 'Toxicoses/Poisoning', 101, NULL),
  ('FE', 'Facial Eczema', 'Toxicoses/Poisoning', 102, NULL),
  ('NP', 'Nitrate Poisoning', 'Toxicoses/Poisoning', 103, NULL),
  ('PH', 'Photosensitivity', 'Toxicoses/Poisoning', 104, NULL),
  ('PO', 'Poisoning - Unspecified', 'Toxicoses/Poisoning', 105, NULL),
  ('GS', 'Ryegrass Staggers', 'Toxicoses/Poisoning', 106, NULL),
  ('MB', 'Mastitis - Subclinical', 'Udder Disorder', 107, 'udder'),
  ('MC', 'Mastitis - Clinical', 'Udder Disorder', 108, 'udder'),
  ('MK', 'Mastitis - Black', 'Udder Disorder', 109, 'udder'),
  ('ST', 'Staph Aureus Infection', 'Udder Disorder', 110, 'udder'),
  ('TI', 'Teat Injury', 'Udder Disorder', 111, 'udder'),
  ('TL', 'Teat End Lesions/Cracks', 'Udder Disorder', 112, 'udder'),
  ('RL', 'Ruptured Suspensory Ligament', 'Udder Disorder', 113, 'udder'),
  ('UO', 'Udder Oedema', 'Udder Disorder', 114, 'udder'),
  ('UA', 'Udder Abscess', 'Udder Disorder', 115, 'udder'),
  ('UD', 'Udder Disorder - Unspecified', 'Udder Disorder', 116, 'udder');

UPDATE conditions c
SET name = m.name, category = m.category, sort_order = m.sort_order, is_active = true,
    requires_body_part = m.body_part IS NOT NULL, body_part_type = m.body_part::body_part_type, updated_at = now()
FROM minda_conditions m
WHERE c.farm_id IS NULL AND c.code = m.code;

INSERT INTO conditions (farm_id, code, name, category, sort_order, is_active, requires_body_part, body_part_type)
SELECT NULL, m.code, m.name, m.category, m.sort_order, true, m.body_part IS NOT NULL, m.body_part::body_part_type
FROM minda_conditions m
WHERE NOT EXISTS (SELECT 1 FROM conditions c WHERE c.farm_id IS NULL AND c.code = m.code);

-- Treatments recorded with Pulse's old shared names, moved to the MINDA name
UPDATE animal_treatments t
SET condition = m.name, condition_id = m.id, updated_at = now()
FROM conditions old, conditions m
WHERE old.farm_id IS NULL AND old.code IS NULL AND m.farm_id IS NULL
  AND ((old.name = 'Mastitis' AND m.code = 'MC') OR (old.name = 'Lameness' AND m.code = 'LM'))
  AND (t.condition_id = old.id OR (t.condition_id IS NULL AND t.condition = old.name));

-- Only MINDA's names are offered from now on
UPDATE conditions SET is_active = false, updated_at = now() WHERE code IS NULL AND is_active;
