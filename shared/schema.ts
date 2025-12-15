// Reference: blueprint:javascript_database
import { pgTable, uuid, varchar, text, integer, timestamp, boolean, jsonb, pgEnum, numeric, date } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== ENUMS =====

export const animalSexEnum = pgEnum('animal_sex', ['female', 'male']);
export const animalStatusEnum = pgEnum('animal_status', ['active', 'sold', 'deceased']);
export const healthRecordTypeEnum = pgEnum('health_record_type', ['illness', 'treatment', 'vaccination', 'injury', 'observation', 'checkup', 'other']);
export const pastureStatusEnum = pgEnum('pasture_status', ['available', 'grazing', 'resting', 'maintenance']);
export const treatmentStatusEnum = pgEnum('treatment_status', ['active', 'completed']);
export const reproEventTypeEnum = pgEnum('repro_event_type', ['heat', 'ai', 'pregnancy_check', 'calving']);
export const treatmentCategoryEnum = pgEnum('treatment_category', ['treatment', 'vaccination', 'drench']);
export const vaccinationProgramTypeEnum = pgEnum('vaccination_program_type', ['vaccination', 'drench']);
export const lamenessScoreEnum = pgEnum('lameness_score', ['1', '2', '3', '4', '5']);
export const mortalityCauseEnum = pgEnum('mortality_cause', ['disease', 'injury', 'calving', 'metabolic', 'unknown', 'culled', 'other']);
export const healthAlertSeverityEnum = pgEnum('health_alert_severity', ['low', 'medium', 'high', 'critical']);
export const breedingMethodEnum = pgEnum('breeding_method', ['natural', 'ai', 'et']);
export const heatIntensityEnum = pgEnum('heat_intensity', ['weak', 'moderate', 'strong']);
export const lactationStatusEnum = pgEnum('lactation_status', ['milking', 'dry', 'fresh', 'not_applicable']);
export const dryOffReasonEnum = pgEnum('dry_off_reason', ['planned', 'low_production', 'health', 'late_lactation', 'other']);
export const pregnancyResultEnum = pgEnum('pregnancy_result', ['pregnant', 'not_pregnant', 'unknown']);
export const calvingSexEnum = pgEnum('calving_sex', ['heifer', 'bull']);
export const calvingDifficultyEnum = pgEnum('calving_difficulty', ['easy', 'assisted', 'difficult']);
export const naitStatusEnum = pgEnum('nait_status', ['registered', 'pending', 'error']);
export const bodyPartTypeEnum = pgEnum('body_part_type', ['udder', 'foot']);
export const stockStatusEnum = pgEnum('stock_status', ['open', 'emptied']);
export const groupTypeEnum = pgEnum('group_type', ['static', 'dynamic']);
export const batchLifecycleEventTypeEnum = pgEnum('batch_lifecycle_event_type', ['opened', 'administered', 'transferred', 'emptied', 'disposed', 'reconciled']);
export const alertTypeEnum = pgEnum('alert_type', [
  // Treatment alerts
  'treatment_overdue', 
  'treatment_due',
  'mastitis_quarter_repeat', 
  'rtv_ready', 
  'awaiting_treatment',
  // Withholding alerts
  'withholding_ending',
  'withholding_meat_ending',
  'withholding_milk_ending',
  'withholding_cleared',
  'monitoring_complete',
  // Calving alerts
  'calving_due',
  'calving_overdue',
  'calving_imminent',
  // Vaccination alerts
  'vaccination_due',
  'vaccination_overdue',
  'vaccination_schedule_reminder',
  // Health check alerts
  'health_check_due',
  'health_score_critical',
  'lameness_detected',
  // Reproduction alerts
  'heat_predicted',
  'pregnancy_check_due',
  'dry_off_due',
  // Vet alerts
  'vet_visit_reminder',
  'lab_results_ready',
  'prescription_ending',
  // Vehicle compliance alerts
  'vehicle_service_overdue',
  'vehicle_service_due',
  'vehicle_wof_expired',
  'vehicle_wof_expiring',
  'vehicle_cof_expired',
  'vehicle_cof_expiring',
  'vehicle_registration_expired',
  'vehicle_registration_expiring',
  'vehicle_ruc_expired',
  'vehicle_ruc_expiring',
  'vehicle_inspection_overdue',
  'vehicle_inspection_due',
  'vehicle_insurance_expired',
  'vehicle_insurance_expiring',
]);
export const alertSeverityEnum = pgEnum('alert_severity', ['low', 'medium', 'high', 'critical']);

// User roles enum (Phase 6E)
export const userRoleEnum = pgEnum('user_role', ['owner', 'manager', 'worker', 'viewer']);

// ===== CORE TABLES =====

// Users (Authentication & Authorization)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  role: userRoleEnum('role').default('worker').notNull(), // Phase 6E
  isActive: boolean('is_active').default(true).notNull(), // Phase 6E
  lastLoginAt: timestamp('last_login_at'), // Phase 6E
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Products (Medicines/Treatments)
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  withdrawalDays: integer('withdrawal_days'),
  milkWithdrawalDays: integer('milk_withdrawal_days'),
  meatWithdrawalDays: integer('meat_withdrawal_days'),
  useByDays: integer('use_by_days'),
  treatmentPlan: text('treatment_plan'),
  barcode: varchar('barcode', { length: 100 }).unique(),
  stockQuantity: integer('stock_quantity').default(0).notNull(),
  stockExpiryDate: varchar('stock_expiry_date', { length: 10 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Farms (Multi-tenancy support)
export const farms = pgTable('farms', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }),
  address: text('address'),
  naitNumber: varchar('nait_number', { length: 50 }), // NAIT location number
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  timezone: varchar('timezone', { length: 50 }).default('Pacific/Auckland'),
  settings: jsonb('settings').$type<Record<string, any>>(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Product Batches (Stock/Inventory Records - formerly RecordItem)
export const productBatches = pgTable('product_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  batchNo: varchar('batch_no', { length: 100 }).notNull(),
  expiryDate: varchar('expiry_date', { length: 10 }),
  useByDate: varchar('use_by_date', { length: 10 }),
  dateOpened: varchar('date_opened', { length: 10 }).notNull(),
  openedBy: uuid('opened_by').references(() => users.id),
  emptiedDate: varchar('emptied_date', { length: 10 }),
  status: stockStatusEnum('status').default('open').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Batch Lifecycle Events (Immutable audit trail for batch state changes)
export const batchLifecycleEvents = pgTable('batch_lifecycle_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id').references(() => productBatches.id).notNull(),
  eventType: batchLifecycleEventTypeEnum('event_type').notNull(),
  userId: uuid('user_id').references(() => users.id),
  userName: varchar('user_name', { length: 255 }).notNull(),
  quantity: integer('quantity'),
  relatedTreatmentId: uuid('related_treatment_id').references(() => animalTreatments.id),
  payload: jsonb('payload').$type<Record<string, unknown>>(),
  eventTimestamp: timestamp('event_timestamp').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  batchIdTimestampIdx: sql`CREATE INDEX IF NOT EXISTS batch_lifecycle_events_batch_timestamp ON ${table} (batch_id, event_timestamp DESC)`,
  batchIdEventTypeIdx: sql`CREATE INDEX IF NOT EXISTS batch_lifecycle_events_batch_event_type ON ${table} (batch_id, event_type)`,
}));

// Conditions (Health conditions)
export const conditions = pgTable('conditions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  requiresBodyPart: boolean('requires_body_part').default(false),
  bodyPartType: bodyPartTypeEnum('body_part_type'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Animals (Herd)
export const animals = pgTable('animals', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').references(() => farms.id),
  // Tag Identification
  visualId: varchar('visual_id', { length: 50 }), // VID - Visual ID (farm tag number)
  lifetimeId: varchar('lifetime_id', { length: 50 }).unique(), // LID - Lifetime ID (NAIT birth tag)
  naitTag: varchar('nait_tag', { length: 50 }), // NAIT location number (NOT unique - shared by all animals at location)
  eid: varchar('eid', { length: 50 }).unique(), // Electronic ID for RFID tags
  cowId: varchar('cow_id', { length: 50 }).unique(), // Legacy Visual ID field
  birthId: jsonb('birth_id').$type<{ participantCode: string; year: string; number: string }>(),
  ahbId: varchar('ahb_id', { length: 50 }), // Animal Health Board ID
  name: varchar('name', { length: 100 }), // Animal name
  breed: varchar('breed', { length: 100 }),
  breedType: varchar('breed_type', { length: 100 }), // e.g., "Holstein Friesian", "Jersey", "Crossbred"
  origin: varchar('origin', { length: 255 }), // Source farm or purchase info
  nationalId: varchar('national_id', { length: 50 }).unique(), // National compliance ID (alias for NAIT)
  dateOfBirth: varchar('date_of_birth', { length: 10 }),
  yearBorn: integer('year_born'),
  sex: animalSexEnum('sex'),
  herd: varchar('herd', { length: 100 }),
  currentPastureId: uuid('current_pasture_id').references(() => pastures.id),
  status: animalStatusEnum('status').default('active').notNull(),
  // Minda status fields
  milkStatus: varchar('milk_status', { length: 50 }), // In Milk, Dry, etc.
  a2Status: varchar('a2_status', { length: 20 }), // A2/A2, A1/A2, etc.
  bvdStatus: varchar('bvd_status', { length: 50 }), // BVD test status
  bvdTestDate: date('bvd_test_date'),
  dnaProfile: varchar('dna_profile', { length: 20 }), // GEv, G3, etc.
  pedigreeIndicator: varchar('pedigree_indicator', { length: 20 }),
  // Removal info
  dateRemoved: date('date_removed'),
  removalFate: varchar('removal_fate', { length: 50 }), // Sold, Died, etc.
  removalReason: varchar('removal_reason', { length: 100 }),
  startDate: date('start_date'), // Date entered herd
  // Health scores
  bodyConditionScore: numeric('body_condition_score', { precision: 3, scale: 1 }),
  bcsDate: date('bcs_date'),
  liveWeight: numeric('live_weight', { precision: 6, scale: 1 }),
  liveWeightDate: date('live_weight_date'),
  photoUrl: text('photo_url'),
  notes: text('notes'),
  // NAIT location
  naitDescription: varchar('nait_description', { length: 100 }), // e.g., "Hinterlands"
  // Lineage tracking
  damId: uuid('dam_id'), // Mother - self-reference handled at app level
  sireId: uuid('sire_id'), // Father - self-reference handled at app level  
  sireInfo: jsonb('sire_info').$type<{ 
    name?: string; 
    breed?: string; 
    registrationNumber?: string;
    externalId?: string; // For AI sires not in system
  }>(),
  // Dam info from Minda
  damInfo: jsonb('dam_info').$type<{
    officialId?: string;
    breed?: string;
    managementNumber?: string;
    bw?: number;
    pw?: number;
    lw?: number;
  }>(),
  // Breeding Values (BW, PW, LW with reliability)
  breedingValues: jsonb('breeding_values').$type<{
    bw?: number; bwReliability?: number;
    pw?: number; pwReliability?: number;
    lw?: number;
    // Production BVs
    milkBV?: number; milkBVReliability?: number;
    fatBV?: number; fatBVReliability?: number;
    proteinBV?: number; proteinBVReliability?: number;
    // Functional BVs
    fertilityBV?: number; fertilityBVReliability?: number;
    sccBV?: number; sccBVReliability?: number;
    liveweightBV?: number; liveweightBVReliability?: number;
    survivalBV?: number; survivalBVReliability?: number;
    gestationBV?: number; gestationBVReliability?: number;
    calvingDifficultyBV?: number; calvingDifficultyBVReliability?: number;
    bcsBV?: number; bcsBVReliability?: number;
    // Conformation BVs
    statureBV?: number; capacityBV?: number;
    rumpAngleBV?: number; rumpWidthBV?: number;
    rearLegBV?: number;
    // Udder BVs
    udderOverallBV?: number; udderSupportBV?: number;
    foreUdderBV?: number; rearUdderBV?: number;
    frontTeatBV?: number; rearTeatBV?: number; teatLengthBV?: number;
    // Workability BVs
    dairyConformationBV?: number;
    milkingSpeedBV?: number; adaptabilityBV?: number;
    temperamentBV?: number; overallOpinionBV?: number;
  }>(),
  geneticInfo: jsonb('genetic_info').$type<{
    breedingValue?: number;
    inbreedingCoefficient?: number;
    geneticMerit?: string;
    dnaTestResults?: Record<string, any>;
  }>(),
  // Current lactation summary
  lactationInfo: jsonb('lactation_info').$type<{
    lactationNumber?: number;
    lactationStartDate?: string;
    daysInMilk?: number;
    daysLactating?: number;
    milkKgMS?: number;
    milkLitres?: number;
    fatKg?: number; fatPercent?: number;
    proteinKg?: number; proteinPercent?: number;
    dryOffDate?: string;
  }>(),
  // Current reproduction status
  reproductionStatus: jsonb('reproduction_status').$type<{
    lastMatingDate?: string;
    matingType?: string;
    matingSire?: string;
    heatDate?: string;
    daysPregnant?: number;
    pregnancyStatus?: string; // Confirmed, Nominated, etc.
    dueDate?: string;
    foetalCount?: number;
    atRiskCow?: boolean;
    nonCycling?: boolean;
    calvingDate?: string;
    calvingAssistance?: string;
  }>(),
  // Last calf info
  lastCalfInfo: jsonb('last_calf_info').$type<{
    calfBirthId?: string;
    calfBirthDate?: string;
    calfSex?: string;
    calfBreed?: string;
    calfBW?: number;
    calfFate?: string;
  }>(),
  // Latest herd test results
  latestHerdTest: jsonb('latest_herd_test').$type<{
    testDate?: string;
    milkTotal?: number;
    fatPercent?: number; fatKg?: number;
    proteinPercent?: number; proteinKg?: number;
    milkSolidsKg?: number;
    scc?: number;
    assessment?: string;
    abnormalCode?: string;
  }>(),
  // Health summary
  healthSummary: jsonb('health_summary').$type<{
    mastitisCount?: number;
    lamenessCount?: number;
    lastCondition?: string;
    lastConditionCategory?: string;
    lastTreatment?: string;
    lastTreatmentDate?: string;
    lastHealthEventDate?: string;
    meatWithholdDays?: number;
    milkWithholdHours?: number;
    vetName?: string;
  }>(),
  // Pre-calving info (for pregnant cows)
  preCalvingInfo: jsonb('pre_calving_info').$type<{
    expectedCalfBW?: number;
    expectedCalfSireId?: string;
    expectedCalfSireBreed?: string;
    expectedCalfSireName?: string;
    expectedCalfSireBW?: number;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  version: integer('version').default(0).notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Animal Health Records (Consolidated health event tracking)
export const animalHealthRecords = pgTable('animal_health_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id).notNull(),
  recordedById: uuid('recorded_by_id').references(() => users.id).notNull(),
  date: date('date').notNull(),
  type: healthRecordTypeEnum('type').notNull(),
  description: text('description').notNull(),
  notes: text('notes'),
  // Optional links to specific record types
  treatmentId: uuid('treatment_id').references(() => animalTreatments.id),
  vetVisitId: uuid('vet_visit_id').references(() => vetVisits.id),
  // Severity/priority
  severity: healthAlertSeverityEnum('severity').default('low'),
  // Follow-up tracking
  requiresFollowUp: boolean('requires_follow_up').default(false),
  followUpDate: date('follow_up_date'),
  followUpCompleted: boolean('follow_up_completed').default(false),
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tag type enum for tag history
export const tagTypeEnum = pgEnum('tag_type', ['visual_id', 'lifetime_id', 'nait_tag', 'eid']);

// Tag change reason enum
export const tagChangeReasonEnum = pgEnum('tag_change_reason', [
  'lost', 'damaged', 'illegible', 'replacement', 'correction', 'initial', 'other'
]);

// Animal Tag History - tracks all tag changes
export const animalTagHistory = pgTable('animal_tag_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id).notNull(),
  tagType: tagTypeEnum('tag_type').notNull(),
  oldValue: varchar('old_value', { length: 50 }),
  newValue: varchar('new_value', { length: 50 }),
  changeReason: tagChangeReasonEnum('change_reason').notNull(),
  changeDate: date('change_date').notNull(),
  notes: text('notes'),
  // For NAIT compliance - track if reported to NAIT
  naitReported: boolean('nait_reported').default(false),
  naitReportedAt: timestamp('nait_reported_at'),
  naitConfirmationNumber: varchar('nait_confirmation_number', { length: 100 }),
  recordedBy: uuid('recorded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Weight Records (Health Tracking)
export const weightRecords = pgTable('weight_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id).notNull(),
  weight: numeric('weight', { precision: 8, scale: 2 }).notNull(), // Weight in kg
  date: date('date').notNull(),
  bodyConditionScore: integer('body_condition_score'), // 1-5 scale, optional for historical tracking
  notes: text('notes'),
  recordedBy: uuid('recorded_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Weight Targets (Group-based goals)
export const weightTargets = pgTable('weight_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').references(() => animalGroups.id).notNull(),
  targetWeight: numeric('target_weight', { precision: 8, scale: 2 }).notNull(),
  targetAgeMonths: integer('target_age_months').notNull(),
  breed: varchar('breed', { length: 100 }),
  sex: animalSexEnum('sex'),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Vaccination Schedules (Planned preventive health programs)
export const vaccinationSchedules = pgTable('vaccination_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').references(() => animalGroups.id).notNull(),
  programType: vaccinationProgramTypeEnum('program_type').notNull(),
  vaccineProductId: uuid('vaccine_product_id').references(() => products.id).notNull(),
  programName: varchar('program_name', { length: 255 }).notNull(),
  description: text('description'),
  scheduledDate: date('scheduled_date').notNull(),
  frequencyMonths: integer('frequency_months'), // How often to repeat (null = one-time)
  nextDueDate: date('next_due_date'),
  targetAgeMonths: integer('target_age_months'), // Target age for this vaccination
  breed: varchar('breed', { length: 100 }),
  sex: animalSexEnum('sex'),
  doseAmount: numeric('dose_amount', { precision: 10, scale: 2 }),
  doseUnit: varchar('dose_unit', { length: 20 }),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Health Scores (Lameness, Temperature, SCC, Rumination tracking)
export const healthScores = pgTable('health_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id).notNull(),
  recordDate: date('record_date').notNull(),
  // Lameness scoring (1-5 scale)
  lamenessScore: lamenessScoreEnum('lameness_score'),
  lamenessNotes: text('lameness_notes'),
  affectedLimb: varchar('affected_limb', { length: 50 }), // 'front_left', 'front_right', 'rear_left', 'rear_right'
  // Temperature recording
  temperature: numeric('temperature', { precision: 4, scale: 1 }), // e.g., 38.5°C
  temperatureUnit: varchar('temperature_unit', { length: 5 }).default('C'), // 'C' or 'F'
  // Somatic Cell Count (SCC) for mastitis tracking
  somaticCellCount: integer('somatic_cell_count'), // cells/ml (thousands)
  sccQuarter: varchar('scc_quarter', { length: 20 }), // 'front_left', 'front_right', 'rear_left', 'rear_right', 'bulk'
  // Rumination monitoring
  ruminationMinutes: integer('rumination_minutes'), // minutes per day
  activityLevel: integer('activity_level'), // steps or activity units
  // General health indicators
  bodyConditionScore: integer('body_condition_score'), // 1-5 scale
  respiratoryRate: integer('respiratory_rate'), // breaths per minute
  heartRate: integer('heart_rate'), // beats per minute
  // Metadata
  notes: text('notes'),
  recordedBy: uuid('recorded_by').references(() => users.id).notNull(),
  source: varchar('source', { length: 50 }).default('manual'), // 'manual', 'sensor', 'imported'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Herd Test Results (Individual animal milk testing from LIC/Minda)
export const herdTestResults = pgTable('herd_test_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id).notNull(),
  testDate: date('test_date').notNull(),
  // Milk production
  milkAmLitres: numeric('milk_am_litres', { precision: 6, scale: 2 }),
  milkPmLitres: numeric('milk_pm_litres', { precision: 6, scale: 2 }),
  milkTotalLitres: numeric('milk_total_litres', { precision: 6, scale: 2 }),
  // Components
  fatPercent: numeric('fat_percent', { precision: 4, scale: 2 }),
  fatKg: numeric('fat_kg', { precision: 6, scale: 2 }),
  proteinPercent: numeric('protein_percent', { precision: 4, scale: 2 }),
  proteinKg: numeric('protein_kg', { precision: 6, scale: 2 }),
  milkSolidsKg: numeric('milk_solids_kg', { precision: 6, scale: 2 }),
  // Health indicators
  scc: integer('scc'), // Somatic Cell Count (000s)
  // Assessment
  assessment: varchar('assessment', { length: 50 }), // Not Assessed, etc.
  abnormalCode: varchar('abnormal_code', { length: 20 }),
  // Lactation context
  daysInMilk: integer('days_in_milk'),
  lactationNumber: integer('lactation_number'),
  // Metadata
  source: varchar('source', { length: 50 }).default('minda'), // 'minda', 'lic', 'manual'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Mortality Records (Death tracking with cause analysis)
export const mortalityRecords = pgTable('mortality_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id).notNull(),
  deathDate: date('death_date').notNull(),
  cause: mortalityCauseEnum('cause').notNull(),
  causeDetails: text('cause_details'),
  // Additional context
  ageAtDeath: integer('age_at_death'), // in months
  wasUnderTreatment: boolean('was_under_treatment').default(false),
  relatedTreatmentId: uuid('related_treatment_id').references(() => animalTreatments.id),
  // Financial impact
  estimatedValue: numeric('estimated_value', { precision: 10, scale: 2 }),
  insuranceClaimed: boolean('insurance_claimed').default(false),
  // Post-mortem
  postMortemPerformed: boolean('post_mortem_performed').default(false),
  postMortemFindings: text('post_mortem_findings'),
  veterinarianId: uuid('veterinarian_id').references(() => users.id),
  // Metadata
  notes: text('notes'),
  recordedBy: uuid('recorded_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Health Alerts (Auto-flagging sick animals)
export const healthAlerts = pgTable('health_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id).notNull(),
  alertType: varchar('alert_type', { length: 50 }).notNull(), // 'high_scc', 'fever', 'lameness', 'low_rumination', 'weight_loss'
  severity: healthAlertSeverityEnum('severity').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  // Trigger data
  triggerValue: varchar('trigger_value', { length: 100 }), // The value that triggered the alert
  thresholdValue: varchar('threshold_value', { length: 100 }), // The threshold that was exceeded
  relatedHealthScoreId: uuid('related_health_score_id').references(() => healthScores.id),
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  acknowledgedAt: timestamp('acknowledged_at'),
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolutionNotes: text('resolution_notes'),
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Bulls/Sires (Bull management and fertility tracking)
export const bulls = pgTable('bulls', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).unique(), // Bull code for AI straws
  breed: varchar('breed', { length: 100 }),
  dateOfBirth: date('date_of_birth'),
  // Ownership
  isOwned: boolean('is_owned').default(false), // Farm-owned vs AI straw
  animalId: uuid('animal_id').references(() => animals.id), // Link to animal if owned
  // Fertility data
  fertilityRating: numeric('fertility_rating', { precision: 4, scale: 2 }), // Percentage
  provenStatus: boolean('proven_status').default(false),
  // Genetic traits
  geneticMerit: jsonb('genetic_merit').$type<{
    bw?: number; // Birth weight
    ww?: number; // Weaning weight
    yw?: number; // Yearling weight
    milk?: number;
    calving_ease?: number;
  }>(),
  // AI straw inventory
  strawsAvailable: integer('straws_available').default(0),
  strawBatchNumber: varchar('straw_batch_number', { length: 100 }),
  supplier: varchar('supplier', { length: 255 }),
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Breeding Records (Comprehensive breeding tracking)
export const breedingRecords = pgTable('breeding_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id).notNull(),
  bullId: uuid('bull_id').references(() => bulls.id),
  breedingDate: date('breeding_date').notNull(),
  breedingMethod: breedingMethodEnum('breeding_method').notNull(),
  // AI specific
  technicianId: uuid('technician_id').references(() => users.id),
  strawBatch: varchar('straw_batch', { length: 100 }),
  // Heat detection
  heatDetectedDate: date('heat_detected_date'),
  heatIntensity: heatIntensityEnum('heat_intensity'),
  heatDetectionMethod: varchar('heat_detection_method', { length: 100 }), // 'visual', 'sensor', 'tail_paint'
  // Pregnancy outcome
  pregnancyCheckDate: date('pregnancy_check_date'),
  pregnancyResult: pregnancyResultEnum('pregnancy_result'),
  expectedCalvingDate: date('expected_calving_date'),
  actualCalvingDate: date('actual_calving_date'),
  // Conception tracking
  conceptionConfirmed: boolean('conception_confirmed').default(false),
  serviceNumber: integer('service_number').default(1), // 1st, 2nd, 3rd service etc.
  // Notes
  notes: text('notes'),
  recordedBy: uuid('recorded_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Calving Records (Detailed calving tracking)
export const calvingRecords = pgTable('calving_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  damId: uuid('dam_id').references(() => animals.id).notNull(),
  sireId: uuid('sire_id').references(() => bulls.id),
  breedingRecordId: uuid('breeding_record_id').references(() => breedingRecords.id),
  calvingDate: date('calving_date').notNull(),
  // Calf details
  calfId: uuid('calf_id').references(() => animals.id),
  calfSex: calvingSexEnum('calf_sex'),
  calfBirthWeight: numeric('calf_birth_weight', { precision: 5, scale: 2 }),
  // Calving difficulty
  calvingDifficulty: calvingDifficultyEnum('calving_difficulty'),
  assistanceRequired: boolean('assistance_required').default(false),
  assistanceType: varchar('assistance_type', { length: 100 }), // 'none', 'light_pull', 'hard_pull', 'vet', 'caesarean'
  // Health outcomes
  damHealthStatus: varchar('dam_health_status', { length: 100 }),
  calfHealthStatus: varchar('calf_health_status', { length: 100 }),
  stillborn: boolean('stillborn').default(false),
  twinning: boolean('twinning').default(false),
  // Gestation
  gestationDays: integer('gestation_days'),
  // Notes
  notes: text('notes'),
  recordedBy: uuid('recorded_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Lactation Records (Days in milk and dry-off tracking)
export const lactationRecords = pgTable('lactation_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id).notNull(),
  lactationNumber: integer('lactation_number').notNull(), // 1st, 2nd, 3rd lactation
  // Calving that started this lactation
  calvingRecordId: uuid('calving_record_id').references(() => calvingRecords.id),
  calvingDate: date('calving_date').notNull(),
  // Lactation status
  status: lactationStatusEnum('status').default('milking').notNull(),
  // Dry-off
  dryOffDate: date('dry_off_date'),
  dryOffReason: dryOffReasonEnum('dry_off_reason'),
  dryOffProtocol: varchar('dry_off_protocol', { length: 255 }), // Treatment protocol used
  expectedDryPeriodDays: integer('expected_dry_period_days').default(60),
  // Production metrics
  peakMilkYield: numeric('peak_milk_yield', { precision: 6, scale: 2 }), // kg/day
  peakMilkDate: date('peak_milk_date'),
  totalLactationYield: numeric('total_lactation_yield', { precision: 10, scale: 2 }), // kg
  averageDailyYield: numeric('average_daily_yield', { precision: 6, scale: 2 }), // kg/day
  // Days in milk
  daysInMilk: integer('days_in_milk').default(0),
  // Notes
  notes: text('notes'),
  recordedBy: uuid('recorded_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Heat Detection Records (Predicted and observed heats)
export const heatRecords = pgTable('heat_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id).notNull(),
  detectionDate: date('detection_date').notNull(),
  detectionTime: varchar('detection_time', { length: 10 }), // HH:MM format
  // Heat characteristics
  intensity: heatIntensityEnum('intensity'),
  detectionMethod: varchar('detection_method', { length: 100 }), // 'visual', 'sensor', 'tail_paint', 'mount_detector'
  // Predicted vs observed
  isPredicted: boolean('is_predicted').default(false),
  predictedFromDate: date('predicted_from_date'), // Previous heat date used for prediction
  cycleLength: integer('cycle_length'), // Days since last heat
  // Action taken
  breedingPlanned: boolean('breeding_planned').default(false),
  breedingRecordId: uuid('breeding_record_id').references(() => breedingRecords.id),
  // Notes
  notes: text('notes'),
  detectedBy: uuid('detected_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== VETERINARY INTEGRATION =====

// Vet Visit Status Enum
export const vetVisitStatusEnum = pgEnum('vet_visit_status', [
  'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'
]);

// Vet Visit Type Enum
export const vetVisitTypeEnum = pgEnum('vet_visit_type', [
  'routine', 'emergency', 'pregnancy_check', 'herd_health', 'surgery', 'consultation', 'follow_up'
]);

// Lab Test Status Enum
export const labTestStatusEnum = pgEnum('lab_test_status', [
  'pending', 'in_progress', 'completed', 'cancelled'
]);

// Lab Test Type Enum
export const labTestTypeEnum = pgEnum('lab_test_type', [
  'blood', 'milk', 'fecal', 'urine', 'tissue', 'swab', 'other'
]);

// Prescription Status Enum
export const prescriptionStatusEnum = pgEnum('prescription_status', [
  'active', 'completed', 'discontinued', 'expired'
]);

// Veterinarians (External vet contacts)
export const veterinarians = pgTable('veterinarians', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  clinicName: varchar('clinic_name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  mobile: varchar('mobile', { length: 50 }),
  address: text('address'),
  // Specializations
  specializations: jsonb('specializations').$type<string[]>(),
  // Licensing
  licenseNumber: varchar('license_number', { length: 100 }),
  licenseExpiry: date('license_expiry'),
  // Preferences
  preferredContactMethod: varchar('preferred_contact_method', { length: 50 }).default('phone'),
  emergencyAvailable: boolean('emergency_available').default(false),
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Vet Visits (Appointments and completed visits)
export const vetVisits = pgTable('vet_visits', {
  id: uuid('id').primaryKey().defaultRandom(),
  veterinarianId: uuid('veterinarian_id').references(() => veterinarians.id),
  // Scheduling
  scheduledDate: date('scheduled_date').notNull(),
  scheduledTime: varchar('scheduled_time', { length: 10 }), // HH:MM format
  estimatedDuration: integer('estimated_duration'), // Minutes
  // Visit details
  visitType: vetVisitTypeEnum('visit_type').notNull(),
  status: vetVisitStatusEnum('status').default('scheduled').notNull(),
  reason: text('reason'),
  // Animals involved
  animalIds: jsonb('animal_ids').$type<string[]>(), // Array of animal UUIDs
  isHerdWide: boolean('is_herd_wide').default(false),
  // Completion details
  actualStartTime: timestamp('actual_start_time'),
  actualEndTime: timestamp('actual_end_time'),
  // Vet notes and findings
  clinicalNotes: text('clinical_notes'),
  diagnosis: text('diagnosis'),
  recommendations: text('recommendations'),
  followUpRequired: boolean('follow_up_required').default(false),
  followUpDate: date('follow_up_date'),
  // Costs
  consultationFee: numeric('consultation_fee', { precision: 10, scale: 2 }),
  medicationCost: numeric('medication_cost', { precision: 10, scale: 2 }),
  procedureCost: numeric('procedure_cost', { precision: 10, scale: 2 }),
  travelCost: numeric('travel_cost', { precision: 10, scale: 2 }),
  totalCost: numeric('total_cost', { precision: 10, scale: 2 }),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  invoicePaid: boolean('invoice_paid').default(false),
  // Attachments
  attachments: jsonb('attachments').$type<{ name: string; url: string; type: string }[]>(),
  // Metadata
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Lab Results (Blood tests, milk tests, fecal tests, etc.)
export const labResults = pgTable('lab_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id),
  vetVisitId: uuid('vet_visit_id').references(() => vetVisits.id),
  // Test details
  testType: labTestTypeEnum('test_type').notNull(),
  testName: varchar('test_name', { length: 255 }).notNull(),
  labName: varchar('lab_name', { length: 255 }),
  sampleCollectionDate: date('sample_collection_date').notNull(),
  sampleId: varchar('sample_id', { length: 100 }), // Lab reference number
  // Status
  status: labTestStatusEnum('status').default('pending').notNull(),
  resultsReceivedDate: date('results_received_date'),
  // Results
  results: jsonb('results').$type<{
    parameter: string;
    value: string | number;
    unit?: string;
    referenceRange?: string;
    status?: 'normal' | 'low' | 'high' | 'critical';
  }[]>(),
  overallResult: varchar('overall_result', { length: 50 }), // 'normal', 'abnormal', 'critical'
  interpretation: text('interpretation'),
  // Costs
  testCost: numeric('test_cost', { precision: 10, scale: 2 }),
  // Attachments (lab reports)
  reportUrl: text('report_url'),
  attachments: jsonb('attachments').$type<{ name: string; url: string }[]>(),
  // Metadata
  orderedBy: uuid('ordered_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Prescriptions (Vet prescriptions for treatments)
export const prescriptions = pgTable('prescriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id),
  vetVisitId: uuid('vet_visit_id').references(() => vetVisits.id),
  veterinarianId: uuid('veterinarian_id').references(() => veterinarians.id),
  // Prescription details
  prescriptionNumber: varchar('prescription_number', { length: 100 }),
  prescriptionDate: date('prescription_date').notNull(),
  // Medication
  medicationName: varchar('medication_name', { length: 255 }).notNull(),
  productId: uuid('product_id').references(() => products.id), // Link to inventory
  activeIngredient: varchar('active_ingredient', { length: 255 }),
  // Dosage
  dosage: varchar('dosage', { length: 100 }).notNull(),
  dosageUnit: varchar('dosage_unit', { length: 50 }),
  frequency: varchar('frequency', { length: 100 }), // e.g., 'twice daily', 'every 8 hours'
  route: varchar('route', { length: 50 }), // 'oral', 'injection', 'topical', 'intramammary'
  duration: varchar('duration', { length: 100 }), // e.g., '7 days', '2 weeks'
  // Treatment period
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  // Withholding periods
  meatWithholdingDays: integer('meat_withholding_days'),
  milkWithholdingDays: integer('milk_withholding_days'),
  witholdingEndDate: date('witholding_end_date'),
  // Status
  status: prescriptionStatusEnum('status').default('active').notNull(),
  completedDate: date('completed_date'),
  discontinuedReason: text('discontinued_reason'),
  // Refills
  refillsAllowed: integer('refills_allowed').default(0),
  refillsUsed: integer('refills_used').default(0),
  // Instructions
  instructions: text('instructions'),
  warnings: text('warnings'),
  // Costs
  medicationCost: numeric('medication_cost', { precision: 10, scale: 2 }),
  // Metadata
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Vet Cost Summary (Aggregated costs for reporting)
export const vetCostRecords = pgTable('vet_cost_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Period
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  // Costs by category
  consultationCosts: numeric('consultation_costs', { precision: 10, scale: 2 }).default('0'),
  medicationCosts: numeric('medication_costs', { precision: 10, scale: 2 }).default('0'),
  procedureCosts: numeric('procedure_costs', { precision: 10, scale: 2 }).default('0'),
  labTestCosts: numeric('lab_test_costs', { precision: 10, scale: 2 }).default('0'),
  travelCosts: numeric('travel_costs', { precision: 10, scale: 2 }).default('0'),
  totalCosts: numeric('total_costs', { precision: 10, scale: 2 }).default('0'),
  // Visit counts
  totalVisits: integer('total_visits').default(0),
  emergencyVisits: integer('emergency_visits').default(0),
  routineVisits: integer('routine_visits').default(0),
  // Animal counts
  animalsSeenCount: integer('animals_seen_count').default(0),
  // Notes
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== MOBILE & FIELD FEATURES =====

// Treatment Templates (Quick treatment presets)
export const treatmentTemplates = pgTable('treatment_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  // Treatment details
  treatmentType: varchar('treatment_type', { length: 100 }).notNull(),
  category: treatmentCategoryEnum('category').default('treatment'),
  productId: uuid('product_id').references(() => products.id),
  // Default dosage
  defaultDosage: varchar('default_dosage', { length: 100 }),
  dosageUnit: varchar('dosage_unit', { length: 50 }),
  route: varchar('route', { length: 50 }), // 'oral', 'injection', 'topical', 'pour-on'
  // Withholding periods
  meatWithholdingDays: integer('meat_withholding_days'),
  milkWithholdingDays: integer('milk_withholding_days'),
  // Usage tracking
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  // Visibility
  isGlobal: boolean('is_global').default(false), // Available to all users
  createdBy: uuid('created_by').references(() => users.id),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Voice Notes (Hands-free recording)
export const voiceNotes = pgTable('voice_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Association
  animalId: uuid('animal_id').references(() => animals.id),
  treatmentId: uuid('treatment_id').references(() => animalTreatments.id),
  // Recording details
  audioUrl: text('audio_url').notNull(),
  duration: integer('duration'), // Seconds
  fileSize: integer('file_size'), // Bytes
  mimeType: varchar('mime_type', { length: 50 }).default('audio/webm'),
  // Transcription
  transcription: text('transcription'),
  isTranscribed: boolean('is_transcribed').default(false),
  // Metadata
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  recordedBy: uuid('recorded_by').references(() => users.id).notNull(),
  // Location context
  latitude: numeric('latitude', { precision: 10, scale: 8 }),
  longitude: numeric('longitude', { precision: 11, scale: 8 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Photo Attachments (Document conditions)
export const photoAttachments = pgTable('photo_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Association
  animalId: uuid('animal_id').references(() => animals.id),
  treatmentId: uuid('treatment_id').references(() => animalTreatments.id),
  vetVisitId: uuid('vet_visit_id').references(() => vetVisits.id),
  // Photo details
  photoUrl: text('photo_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  fileName: varchar('file_name', { length: 255 }),
  fileSize: integer('file_size'), // Bytes
  mimeType: varchar('mime_type', { length: 50 }).default('image/jpeg'),
  // Metadata
  caption: text('caption'),
  tags: jsonb('tags').$type<string[]>(),
  // Location context
  latitude: numeric('latitude', { precision: 10, scale: 8 }),
  longitude: numeric('longitude', { precision: 11, scale: 8 }),
  // Timestamps
  takenAt: timestamp('taken_at'),
  uploadedBy: uuid('uploaded_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Batch Treatments (Treat multiple animals at once)
export const batchTreatments = pgTable('batch_treatments', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Batch details
  batchName: varchar('batch_name', { length: 255 }),
  treatmentDate: varchar('treatment_date', { length: 10 }).notNull(),
  // Treatment info
  treatmentType: varchar('treatment_type', { length: 100 }).notNull(),
  category: treatmentCategoryEnum('category').default('treatment'),
  productId: uuid('product_id').references(() => products.id),
  dosage: varchar('dosage', { length: 100 }),
  route: varchar('route', { length: 50 }),
  // Animals treated
  animalIds: jsonb('animal_ids').$type<string[]>().notNull(),
  animalCount: integer('animal_count').notNull(),
  // Template used
  templateId: uuid('template_id').references(() => treatmentTemplates.id),
  // Withholding
  meatWithholdingDays: integer('meat_withholding_days'),
  milkWithholdingDays: integer('milk_withholding_days'),
  // Notes
  notes: text('notes'),
  // Metadata
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// EID Scan Sessions (Scanner integration tracking)
export const eidScanSessions = pgTable('eid_scan_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Session details
  sessionName: varchar('session_name', { length: 255 }),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  // Scans
  scannedEids: jsonb('scanned_eids').$type<{
    eid: string;
    scannedAt: string;
    animalId?: string;
    matched: boolean;
  }[]>(),
  totalScans: integer('total_scans').default(0),
  matchedScans: integer('matched_scans').default(0),
  unmatchedScans: integer('unmatched_scans').default(0),
  // Purpose
  purpose: varchar('purpose', { length: 100 }), // 'treatment', 'weighing', 'movement', 'inventory'
  relatedBatchTreatmentId: uuid('related_batch_treatment_id').references(() => batchTreatments.id),
  // Metadata
  scannedBy: uuid('scanned_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Pastures (Paddocks)
export const pastures = pgTable('pastures', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  paddockNumber: integer('paddock_number'),
  area: integer('area'),
  currentStock: integer('current_stock').default(0).notNull(),
  status: pastureStatusEnum('status').default('available').notNull(),
  lastGrazed: varchar('last_grazed', { length: 10 }),
  grazingDays: integer('grazing_days').default(0),
  restPeriodDays: integer('rest_period_days').default(0),
  soilQuality: integer('soil_quality'),
  grassCoverKg: integer('grass_cover_kg'),
  notes: text('notes'),
  // Geospatial mapping fields
  boundaries: jsonb('boundaries'), // GeoJSON polygon data for paddock boundaries
  centerLatitude: numeric('center_latitude', { precision: 10, scale: 8 }),
  centerLongitude: numeric('center_longitude', { precision: 11, scale: 8 }),
  pastureType: varchar('pasture_type', { length: 50 }).default('pasture').notNull(), // 'pasture', 'crop', 'fallow', 'native'
  nextGrazingDue: date('next_grazing_due'),
  carryingCapacity: integer('carrying_capacity'), // animals per hectare
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Farm Hazards (Interactive Mapping)
export const farmHazards = pgTable('farm_hazards', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 50 }).notNull(), // 'chemical', 'machinery', 'terrain', 'water', 'electrical', 'biosecurity'
  severity: varchar('severity', { length: 20 }).notNull(), // 'low', 'medium', 'high', 'critical'
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  latitude: numeric('latitude', { precision: 10, scale: 8 }).notNull(),
  longitude: numeric('longitude', { precision: 11, scale: 8 }).notNull(),
  location: varchar('location', { length: 255 }), // Human readable location description
  status: varchar('status', { length: 20 }).default('active').notNull(), // 'active', 'resolved', 'monitoring'
  riskLevel: integer('risk_level').default(1), // 1-5 risk assessment score
  mitigationRequired: boolean('mitigation_required').default(false).notNull(),
  mitigationDescription: text('mitigation_description'),
  mitigationDeadline: date('mitigation_deadline'),
  reportedBy: uuid('reported_by').references(() => users.id),
  assignedTo: uuid('assigned_to').references(() => users.id),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  verifiedAt: timestamp('verified_at'),
  nextInspectionDate: date('next_inspection_date'),
  photos: jsonb('photos'), // JSON array of photo URLs
  documents: jsonb('documents'), // JSON array of document URLs
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Animal Treatments (Core RVM records)
export const animalTreatments = pgTable('animal_treatments', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id),
  staffMemberId: uuid('staff_member_id').references(() => users.id).notNull(),
  staffMember: varchar('staff_member', { length: 255 }).notNull(),
  dateTime: varchar('date_time', { length: 25 }).notNull(),
  cowId: varchar('cow_id', { length: 50 }),
  birthId: jsonb('birth_id').$type<{ participantCode: string; year: string; number: string }>(),
  condition: varchar('condition', { length: 255 }),
  conditionId: uuid('condition_id').references(() => conditions.id),
  bodyPart: varchar('body_part', { length: 100 }),
  treatmentType: varchar('treatment_type', { length: 255 }),
  category: treatmentCategoryEnum('category').default('treatment'),
  productId: uuid('product_id').references(() => products.id),
  batchId: uuid('batch_id').references(() => productBatches.id),
  doseAmount: numeric('dose_amount', { precision: 10, scale: 2 }),
  doseUnit: varchar('dose_unit', { length: 20 }),
  treatmentPlan: text('treatment_plan'),
  clinicalNotes: text('clinical_notes'),
  status: treatmentStatusEnum('status').default('active').notNull(),
  completedDate: varchar('completed_date', { length: 10 }),
  dosesGiven: integer('doses_given').default(0),
  totalDoses: integer('total_doses').default(1),
  lastDoseDate: varchar('last_dose_date', { length: 10 }),
  milkWithdrawalDays: integer('milk_withdrawal_days'),
  milkWithdrawalEndDate: varchar('milk_withdrawal_end_date', { length: 10 }),
  retreatmentOf: uuid('retreatment_of').references((): any => animalTreatments.id),
  retreatmentReason: text('retreatment_reason'),
  awaitingTreatment: boolean('awaiting_treatment').default(false),
  monitoring: boolean('monitoring').default(false),
  monitoringDays: integer('monitoring_days'),
  monitoringStartDate: varchar('monitoring_start_date', { length: 10 }),
  monitoringEndDate: varchar('monitoring_end_date', { length: 10 }),
  returnedToHerd: boolean('returned_to_herd').default(false),
  returnToHerdNotes: text('return_to_herd_notes'),
  // Cost tracking
  medicineCost: numeric('medicine_cost', { precision: 10, scale: 2 }), // Cost of medicine used
  labourCost: numeric('labour_cost', { precision: 10, scale: 2 }), // Labour/time cost
  vetCalloutCost: numeric('vet_callout_cost', { precision: 10, scale: 2 }), // Vet visit cost if applicable
  otherCosts: numeric('other_costs', { precision: 10, scale: 2 }), // Any other costs
  totalCost: numeric('total_cost', { precision: 10, scale: 2 }), // Calculated total
  costNotes: text('cost_notes'), // Notes about costs
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  version: integer('version').default(0).notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Treatment Events (Immutable audit trail for RVM phase transitions)
export const treatmentEvents = pgTable('treatment_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  treatmentId: uuid('treatment_id').references(() => animalTreatments.id, { onDelete: 'restrict' }).notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(), // 'created', 'dose_given', 'phase_change', 'completed', etc.
  phase: varchar('phase', { length: 50 }), // 'awaiting', 'treatment', 'withholding', 'monitoring', 'return_to_vat'
  actorId: uuid('actor_id').references(() => users.id),
  actorName: varchar('actor_name', { length: 255 }),
  payload: jsonb('payload'), // Snapshot of relevant data at time of event
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  sequence: integer('sequence').notNull(), // Order within treatment
});

// Milk Withholdings (Active withdrawal tracking)
export const milkWithholdings = pgTable('milk_withholdings', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id).notNull(),
  treatmentId: uuid('treatment_id').references(() => animalTreatments.id).notNull(),
  startDate: varchar('start_date', { length: 10 }).notNull(),
  endDate: varchar('end_date', { length: 10 }).notNull(),
  productName: varchar('product_name', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Reproduction Events (Heat, AI, Pregnancy, Calving)
export const reproductionEvents = pgTable('reproduction_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id).notNull(),
  eventType: reproEventTypeEnum('event_type').notNull(),
  eventDate: varchar('event_date', { length: 10 }).notNull(),
  notes: text('notes'),
  aiDetails: jsonb('ai_details').$type<{ bullCode?: string; technician?: string; strawBatch?: string }>(),
  pregnancyDetails: jsonb('pregnancy_details').$type<{ 
    result?: 'pregnant' | 'not_pregnant' | 'unknown'; 
    dueDate?: string; 
    foetalAgeDays?: number;
  }>(),
  calvingDetails: jsonb('calving_details').$type<{ 
    calvingSex?: 'heifer' | 'bull'; 
    calvingDifficulty?: 'easy' | 'assisted' | 'difficult'; 
    calfId?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// NAIT Records (Compliance tracking)
export const naitRecords = pgTable('nait_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id).notNull(),
  naitTag: varchar('nait_tag', { length: 50 }).notNull(),
  registrationDate: varchar('registration_date', { length: 10 }).notNull(),
  status: naitStatusEnum('status').default('pending').notNull(),
  lastSyncDate: varchar('last_sync_date', { length: 10 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// NAIT Queue (Pending submissions)
export const naitQueue = pgTable('nait_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id),
  actionType: varchar('action_type', { length: 50 }).notNull(), // 'register', 'transfer', 'death', etc.
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  lastAttempt: timestamp('last_attempt'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Sync Cursors (Offline sync tracking)
export const syncCursors = pgTable('sync_cursors', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: varchar('device_id', { length: 100 }).notNull(),
  module: varchar('module', { length: 50 }).notNull(), // 'animals', 'treatments', 'pastures', etc.
  lastSync: timestamp('last_sync').notNull(),
  cursor: varchar('cursor', { length: 255 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Settings (Application settings - not user-specific)
export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User Preferences (Phase 6A: User-specific settings including dashboard layout)
export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  dashboardWidgets: jsonb('dashboard_widgets').$type<{
    layout: Array<{ i: string; x: number; y: number; w: number; h: number }>;
    hidden: string[];
  }>(),
  notificationSettings: jsonb('notification_settings').$type<{
    email: boolean;
    push: boolean;
    alertTypes: string[];
  }>(),
  theme: varchar('theme', { length: 20 }).default('light'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Notification Logs (Phase 6D: Track sent notifications)
export const notificationLogs = pgTable('notification_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  alertId: uuid('alert_id').references(() => alerts.id, { onDelete: 'set null' }),
  notificationType: varchar('notification_type', { length: 20 }).notNull(), // 'email', 'push', 'sms'
  recipient: varchar('recipient', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }),
  body: text('body').notNull(),
  status: varchar('status', { length: 20 }).default('sent').notNull(), // 'sent', 'failed', 'pending'
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
});

// Activity Logs (Phase 6E: Audit trail for user actions)
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  userName: varchar('user_name', { length: 255 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(), // 'create', 'update', 'delete', 'login', 'logout'
  resourceType: varchar('resource_type', { length: 50 }).notNull(), // 'animal', 'treatment', 'pasture', etc.
  resourceId: varchar('resource_id', { length: 255 }),
  details: jsonb('details').$type<Record<string, unknown>>(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: sql`CREATE INDEX IF NOT EXISTS activity_logs_user ON ${table} (user_id, created_at DESC)`,
  resourceIdx: sql`CREATE INDEX IF NOT EXISTS activity_logs_resource ON ${table} (resource_type, resource_id, created_at DESC)`,
}));

// Alerts (Automated farm management alerts)
export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: alertTypeEnum('type').notNull(),
  severity: alertSeverityEnum('severity').default('medium').notNull(),
  animalId: uuid('animal_id').references(() => animals.id),
  treatmentId: uuid('treatment_id').references(() => animalTreatments.id),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(), // Additional context (cowId, quarter, etc.)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  dismissedAt: timestamp('dismissed_at'),
  dismissedBy: uuid('dismissed_by').references(() => users.id),
}, (table) => ({
  activeAlertsIdx: sql`CREATE INDEX IF NOT EXISTS alerts_active ON ${table} (created_at DESC) WHERE dismissed_at IS NULL`,
  animalAlertsIdx: sql`CREATE INDEX IF NOT EXISTS alerts_animal ON ${table} (animal_id, created_at DESC)`,
  vehicleAlertsIdx: sql`CREATE INDEX IF NOT EXISTS alerts_vehicle ON ${table} (vehicle_id, created_at DESC)`,
}));

// Animal Groups (Phase 4: Animal Intelligence - Groups/Herds Management)
export const animalGroups = pgTable('animal_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }), // Hex color for UI badges (e.g., "#4d9f5f")
  groupType: groupTypeEnum('group_type').default('static').notNull(),
  criteria: jsonb('criteria'), // For future dynamic groups: { breed: 'Holstein', status: 'active' }
  sortOrder: integer('sort_order').default(0).notNull(),
  metadata: jsonb('metadata'), // Extensibility: { tags: [], autoActions: {} }
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'), // Soft delete for audit history
});

// Animal Group Members (Junction table for many-to-many)
export const animalGroupMembers = pgTable('animal_group_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').references(() => animalGroups.id, { onDelete: 'cascade' }).notNull(),
  animalId: uuid('animal_id').references(() => animals.id, { onDelete: 'cascade' }).notNull(),
  addedBy: uuid('added_by').references(() => users.id),
  addedAt: timestamp('added_at').defaultNow().notNull(),
  notes: text('notes'), // Per-membership notes (e.g., "Added to breeding program 2025")
}, (table) => ({
  // Unique constraint to prevent duplicate memberships
  uniqueMembership: sql`UNIQUE (group_id, animal_id)`,
}));

// Pasture Movements (Phase 5: Pasture Performance - Rotation tracking)
export const pastureMovements = pgTable('pasture_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id').references(() => animals.id, { onDelete: 'cascade' }).notNull(),
  fromPastureId: uuid('from_pasture_id').references(() => pastures.id),
  toPastureId: uuid('to_pasture_id').references(() => pastures.id).notNull(),
  movedAt: timestamp('moved_at').defaultNow().notNull(),
  movedBy: uuid('moved_by').references(() => users.id).notNull(),
  reason: text('reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Pasture Health Records (Phase 5.3: Health Tracking History)
export const pastureHealthRecords = pgTable('pasture_health_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  pastureId: uuid('pasture_id').references(() => pastures.id, { onDelete: 'cascade' }).notNull(),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  recordedBy: varchar('recorded_by', { length: 255 }).notNull(), // User ID or name
  grazingDays: integer('grazing_days'),
  restPeriodDays: integer('rest_period_days'),
  soilQuality: integer('soil_quality'), // 1-10 scale
  grassCoverKg: integer('grass_cover_kg'), // Dry matter kg/ha
  notes: text('notes'),
});

// Pasture Walk Sessions - Group multiple paddock measurements
export const pastureWalkSessions = pgTable('pasture_walk_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  walkDate: date('walk_date').notNull(),
  walkTime: varchar('walk_time', { length: 10 }), // HH:MM format
  recordedBy: uuid('recorded_by').references(() => users.id),
  weatherConditions: varchar('weather_conditions', { length: 100 }), // sunny, cloudy, rainy, etc.
  temperature: integer('temperature'), // Celsius
  notes: text('notes'),
  totalPaddocks: integer('total_paddocks').default(0),
  averageCover: integer('average_cover'), // Average kg DM/ha across all paddocks
  totalFarmCover: integer('total_farm_cover'), // Total kg DM across farm
  status: varchar('status', { length: 20 }).default('in_progress'), // in_progress, completed
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Pasture Cover Measurements - Individual paddock readings
export const pastureCoverMeasurements = pgTable('pasture_cover_measurements', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => pastureWalkSessions.id, { onDelete: 'cascade' }),
  pastureId: uuid('pasture_id').references(() => pastures.id, { onDelete: 'cascade' }).notNull(),
  measurementDate: date('measurement_date').notNull(),
  measurementTime: varchar('measurement_time', { length: 10 }), // HH:MM format
  
  // Rising Plate Meter readings
  plateMeterReading: integer('plate_meter_reading'), // Raw plate meter reading (clicks/height)
  plateMeterReadings: text('plate_meter_readings'), // JSON array of multiple readings per paddock
  numberOfReadings: integer('number_of_readings').default(1), // How many readings taken
  
  // Calculated/entered cover
  coverKgDmHa: integer('cover_kg_dm_ha').notNull(), // Dry matter kg/ha
  preGrazingCover: integer('pre_grazing_cover'), // If measured before grazing
  postGrazingCover: integer('post_grazing_cover'), // If measured after grazing (residual)
  
  // Growth calculations
  previousCover: integer('previous_cover'), // Last measurement for growth calc
  growthRateKgDay: integer('growth_rate_kg_day'), // Calculated daily growth
  daysSinceLastMeasurement: integer('days_since_last_measurement'),
  
  // Quality indicators
  grassQuality: integer('grass_quality'), // 1-5 scale
  cloverPercentage: integer('clover_percentage'), // 0-100%
  weedPercentage: integer('weed_percentage'), // 0-100%
  
  // Grazing info
  currentlyGrazing: boolean('currently_grazing').default(false),
  stockCount: integer('stock_count'), // Animals currently in paddock
  daysInPaddock: integer('days_in_paddock'),
  
  // Additional data
  soilMoisture: varchar('soil_moisture', { length: 20 }), // dry, moist, wet, saturated
  photoUrl: text('photo_url'),
  gpsCoordinates: text('gps_coordinates'), // JSON {lat, lng}
  notes: text('notes'),
  
  recordedBy: uuid('recorded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Insert schemas for pasture walk
export const insertPastureWalkSessionSchema = createInsertSchema(pastureWalkSessions, {
  walkDate: z.string().min(1, "Walk date required"),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertPastureCoverMeasurementSchema = createInsertSchema(pastureCoverMeasurements, {
  measurementDate: z.string().min(1, "Measurement date required"),
  coverKgDmHa: z.number().int().min(0, "Cover must be positive"),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type PastureWalkSession = typeof pastureWalkSessions.$inferSelect;
export type InsertPastureWalkSession = z.infer<typeof insertPastureWalkSessionSchema>;
export type PastureCoverMeasurement = typeof pastureCoverMeasurements.$inferSelect;
export type InsertPastureCoverMeasurement = z.infer<typeof insertPastureCoverMeasurementSchema>;

// ===== RELATIONS =====

export const usersRelations = relations(users, ({ many }) => ({
  treatments: many(animalTreatments),
  openedBatches: many(productBatches),
}));

export const productsRelations = relations(products, ({ many }) => ({
  batches: many(productBatches),
  treatments: many(animalTreatments),
}));

export const productBatchesRelations = relations(productBatches, ({ one }) => ({
  product: one(products, {
    fields: [productBatches.productId],
    references: [products.id],
  }),
  openedByUser: one(users, {
    fields: [productBatches.openedBy],
    references: [users.id],
  }),
}));

export const animalsRelations = relations(animals, ({ one, many }) => ({
  farm: one(farms, {
    fields: [animals.farmId],
    references: [farms.id],
  }),
  currentPasture: one(pastures, {
    fields: [animals.currentPastureId],
    references: [pastures.id],
  }),
  treatments: many(animalTreatments),
  reproductionEvents: many(reproductionEvents),
  withholdings: many(milkWithholdings),
  naitRecords: many(naitRecords),
  groupMembers: many(animalGroupMembers), // Phase 4: Group memberships
  weightRecords: many(weightRecords), // Health tracking
  healthRecords: many(animalHealthRecords), // Consolidated health records
}));

// Weight Records Relations
export const weightRecordsRelations = relations(weightRecords, ({ one }) => ({
  animal: one(animals, {
    fields: [weightRecords.animalId],
    references: [animals.id],
  }),
  recordedByUser: one(users, {
    fields: [weightRecords.recordedBy],
    references: [users.id],
  }),
}));

// Animal Health Records Relations
export const animalHealthRecordsRelations = relations(animalHealthRecords, ({ one }) => ({
  animal: one(animals, {
    fields: [animalHealthRecords.animalId],
    references: [animals.id],
  }),
  recordedBy: one(users, {
    fields: [animalHealthRecords.recordedById],
    references: [users.id],
  }),
  treatment: one(animalTreatments, {
    fields: [animalHealthRecords.treatmentId],
    references: [animalTreatments.id],
  }),
  vetVisit: one(vetVisits, {
    fields: [animalHealthRecords.vetVisitId],
    references: [vetVisits.id],
  }),
}));

// Weight Targets Relations
export const weightTargetsRelations = relations(weightTargets, ({ one }) => ({
  group: one(animalGroups, {
    fields: [weightTargets.groupId],
    references: [animalGroups.id],
  }),
  createdByUser: one(users, {
    fields: [weightTargets.createdBy],
    references: [users.id],
  }),
}));

export const pasturesRelations = relations(pastures, ({ many }) => ({
  animals: many(animals),
}));

export const farmHazardsRelations = relations(farmHazards, ({ one }) => ({
  reportedByUser: one(users, {
    fields: [farmHazards.reportedBy],
    references: [users.id],
  }),
  assignedToUser: one(users, {
    fields: [farmHazards.assignedTo],
    references: [users.id],
  }),
  resolvedByUser: one(users, {
    fields: [farmHazards.resolvedBy],
    references: [users.id],
  }),
}));

export const animalTreatmentsRelations = relations(animalTreatments, ({ one, many }) => ({
  animal: one(animals, {
    fields: [animalTreatments.animalId],
    references: [animals.id],
  }),
  staffMemberUser: one(users, {
    fields: [animalTreatments.staffMemberId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [animalTreatments.productId],
    references: [products.id],
  }),
  condition: one(conditions, {
    fields: [animalTreatments.conditionId],
    references: [conditions.id],
  }),
  parentTreatment: one(animalTreatments, {
    fields: [animalTreatments.retreatmentOf],
    references: [animalTreatments.id],
  }),
  events: many(treatmentEvents),
  withholdings: many(milkWithholdings),
}));

export const treatmentEventsRelations = relations(treatmentEvents, ({ one }) => ({
  treatment: one(animalTreatments, {
    fields: [treatmentEvents.treatmentId],
    references: [animalTreatments.id],
  }),
  actor: one(users, {
    fields: [treatmentEvents.actorId],
    references: [users.id],
  }),
}));

export const reproductionEventsRelations = relations(reproductionEvents, ({ one }) => ({
  animal: one(animals, {
    fields: [reproductionEvents.animalId],
    references: [animals.id],
  }),
}));

// Visitor Management (Phase 1 - Competitive Advantage)
export const visitors = pgTable('visitors', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  company: varchar('company', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }).notNull(),
  emergencyContact: varchar('emergency_contact', { length: 255 }).notNull(),
  emergencyPhone: varchar('emergency_phone', { length: 50 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const visitorSignIns = pgTable('visitor_sign_ins', {
  id: uuid('id').primaryKey().defaultRandom(),
  visitorId: uuid('visitor_id').references(() => visitors.id).notNull(),
  farmName: varchar('farm_name', { length: 255 }).notNull(),
  locationCode: varchar('location_code', { length: 50 }).notNull(),
  purpose: varchar('purpose', { length: 100 }).notNull(),
  hostPerson: varchar('host_person', { length: 255 }).notNull(),
  vehicleRegistration: varchar('vehicle_registration', { length: 20 }),
  signInTime: timestamp('sign_in_time').defaultNow().notNull(),
  signOutTime: timestamp('sign_out_time'),
  safetyAcknowledged: boolean('safety_acknowledged').default(false).notNull(),
  biosecurityAcknowledged: boolean('biosecurity_acknowledged').default(false).notNull(),
  emergencyAcknowledged: boolean('emergency_acknowledged').default(false).notNull(),
  signatureData: text('signature_data'),
  photoConsent: boolean('photo_consent').default(false).notNull(),
  complianceVersion: varchar('compliance_version', { length: 20 }).default('1.0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Vehicle Registry (Phase 1 Extension)
export const vehicleTypes = pgTable('vehicle_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  category: varchar('category', { length: 50 }).notNull(), // 'light', 'heavy', 'machinery', 'motorcycle'
  description: text('description'),
  inspectionFrequencyDays: integer('inspection_frequency_days').default(7).notNull(),
  requiresLicense: boolean('requires_license').default(true).notNull(),
  maxWeightKg: integer('max_weight_kg'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vehicles = pgTable('vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  registration: varchar('registration', { length: 20 }).notNull().unique(),
  make: varchar('make', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  year: integer('year').notNull(),
  typeId: uuid('type_id').references(() => vehicleTypes.id).notNull(),
  vin: varchar('vin', { length: 20 }).unique(),
  engineNumber: varchar('engine_number', { length: 50 }),
  color: varchar('color', { length: 50 }),
  fuelType: varchar('fuel_type', { length: 20 }),
  odometerReading: integer('odometer_reading'),
  purchaseDate: date('purchase_date'),
  purchasePrice: integer('purchase_price'), // in cents
  currentOwner: varchar('current_owner', { length: 255 }),
  insuranceCompany: varchar('insurance_company', { length: 255 }),
  insurancePolicyNumber: varchar('insurance_policy_number', { length: 100 }),
  insuranceExpiry: date('insurance_expiry'),
  registrationExpiry: date('registration_expiry'),
  wofExpiry: date('wof_expiry'), // Warrant of Fitness expiry
  cofExpiry: date('cof_expiry'), // Certificate of Fitness expiry
  rucExpiry: date('ruc_expiry'), // Road User Charges expiry
  lastServiceDate: date('last_service_date'),
  nextServiceDue: date('next_service_due'),
  lastWofDate: date('last_wof_date'),
  lastCofDate: date('last_cof_date'),
  lastRucDate: date('last_ruc_date'),
  status: varchar('status', { length: 20 }).default('active').notNull(), // 'active', 'maintenance', 'retired', 'sold'
  location: varchar('location', { length: 255 }),
  assignedTo: varchar('assigned_to', { length: 255 }),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vehicleInspectionTemplates = pgTable('vehicle_inspection_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  typeId: uuid('type_id').references(() => vehicleTypes.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vehicleInspectionItems = pgTable('vehicle_inspection_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').references(() => vehicleInspectionTemplates.id).notNull(),
  category: varchar('category', { length: 100 }).notNull(), // 'safety', 'mechanical', 'electrical', 'exterior', 'documentation'
  itemName: varchar('item_name', { length: 255 }).notNull(),
  description: text('description'),
  itemType: varchar('item_type', { length: 20 }).notNull(), // 'check', 'measure', 'visual', 'document'
  requiredValue: varchar('required_value', { length: 100 }),
  minValue: integer('min_value'),
  maxValue: integer('max_value'),
  unit: varchar('unit', { length: 20 }),
  isCritical: boolean('is_critical').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vehicleInspections = pgTable('vehicle_inspections', {
  id: uuid('id').primaryKey().defaultRandom(),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id).notNull(),
  templateId: uuid('template_id').references(() => vehicleInspectionTemplates.id).notNull(),
  inspectionDate: timestamp('inspection_date').defaultNow().notNull(),
  inspectorId: uuid('inspector_id').references(() => users.id).notNull(),
  odometerReading: integer('odometer_reading'),
  weatherConditions: varchar('weather_conditions', { length: 100 }),
  temperature: integer('temperature'), // in Celsius
  overallStatus: varchar('overall_status', { length: 20 }).notNull(), // 'pass', 'fail', 'pass_with_notes'
  nextInspectionDue: date('next_inspection_due').notNull(),
  defectsFound: integer('defects_found').default(0).notNull(),
  criticalDefects: integer('critical_defects').default(0).notNull(),
  notes: text('notes'),
  signatureData: text('signature_data'),
  photos: text('photos'), // JSON array of photo URLs
  completedAt: timestamp('completed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vehicleInspectionResults = pgTable('vehicle_inspection_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  inspectionId: uuid('inspection_id').references(() => vehicleInspections.id).notNull(),
  itemId: uuid('item_id').references(() => vehicleInspectionItems.id).notNull(),
  status: varchar('status', { length: 20 }).notNull(), // 'pass', 'fail', 'not_applicable'
  value: varchar('value', { length: 100 }),
  measurement: integer('measurement'),
  notes: text('notes'),
  photoUrl: varchar('photo_url', { length: 500 }),
  isDefect: boolean('is_defect').default(false).notNull(),
  isCritical: boolean('is_critical').default(false).notNull(),
  requiresAction: boolean('requires_action').default(false).notNull(),
  actionRequired: text('action_required'),
  actionDeadline: date('action_deadline'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vehicleMaintenanceRecords = pgTable('vehicle_maintenance_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'service', 'repair', 'inspection', 'modification'
  description: text('description').notNull(),
  performedBy: varchar('performed_by', { length: 255 }).notNull(),
  performedDate: date('performed_date').notNull(),
  cost: integer('cost'), // in cents
  odometerReading: integer('odometer_reading'),
  partsReplaced: text('parts_replaced'), // JSON array of parts
  nextMaintenanceDue: date('next_maintenance_due'),
  warrantyInfo: text('warranty_info'),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  notes: text('notes'),
  documents: text('documents'), // JSON array of document URLs
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== MAP TASK PINS (Phase 3) =====
export const taskPinStatusEnum = pgEnum('task_pin_status', [
  'pending',
  'in_progress',
  'completed',
  'cancelled'
]);

export const taskPinPriorityEnum = pgEnum('task_pin_priority', [
  'low',
  'medium',
  'high',
  'urgent'
]);

export const taskPins = pgTable('task_pins', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  latitude: numeric('latitude', { precision: 10, scale: 8 }).notNull(),
  longitude: numeric('longitude', { precision: 11, scale: 8 }).notNull(),
  status: taskPinStatusEnum('status').default('pending').notNull(),
  priority: taskPinPriorityEnum('priority').default('medium').notNull(),
  category: varchar('category', { length: 100 }), // 'fence_repair', 'water_issue', 'animal_check', etc.
  dueDate: date('due_date'),
  assignedTo: uuid('assigned_to').references(() => users.id),
  pastureId: uuid('pasture_id').references(() => pastures.id),
  animalId: uuid('animal_id').references(() => animals.id),
  photos: text('photos'), // JSON array of photo URLs
  notes: text('notes'),
  completedAt: timestamp('completed_at'),
  completedBy: uuid('completed_by').references(() => users.id),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertTaskPinSchema = createInsertSchema(taskPins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ===== STOCK TRANSACTIONS (Phase 2) =====
export const stockTransactionTypeEnum = pgEnum('stock_transaction_type', [
  'purchase',
  'sale', 
  'death',
  'transfer_in',
  'transfer_out',
  'birth',
  'adjustment'
]);

export const stockTransactions = pgTable('stock_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: stockTransactionTypeEnum('type').notNull(),
  date: date('date').notNull(),
  quantity: integer('quantity').notNull(),
  description: text('description'),
  reference: varchar('reference', { length: 100 }), // Invoice/reference number
  fromLocation: varchar('from_location', { length: 255 }),
  toLocation: varchar('to_location', { length: 255 }),
  pricePerHead: integer('price_per_head'), // in cents
  totalValue: integer('total_value'), // in cents
  animalIds: text('animal_ids'), // JSON array of animal IDs involved
  breed: varchar('breed', { length: 100 }),
  sex: varchar('sex', { length: 20 }),
  ageGroup: varchar('age_group', { length: 50 }),
  herd: varchar('herd', { length: 100 }),
  buyer: varchar('buyer', { length: 255 }),
  seller: varchar('seller', { length: 255 }),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertStockTransactionSchema = createInsertSchema(stockTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Phase 4: Animal Groups Relations
export const animalGroupsRelations = relations(animalGroups, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [animalGroups.createdBy],
    references: [users.id],
  }),
  members: many(animalGroupMembers),
  vaccinationSchedules: many(vaccinationSchedules),
}));

// Vaccination Schedules Relations
export const vaccinationSchedulesRelations = relations(vaccinationSchedules, ({ one }) => ({
  group: one(animalGroups, {
    fields: [vaccinationSchedules.groupId],
    references: [animalGroups.id],
  }),
  vaccineProduct: one(products, {
    fields: [vaccinationSchedules.vaccineProductId],
    references: [products.id],
  }),
  createdByUser: one(users, {
    fields: [vaccinationSchedules.createdBy],
    references: [users.id],
  }),
}));

// Health Scores Relations
export const healthScoresRelations = relations(healthScores, ({ one }) => ({
  animal: one(animals, {
    fields: [healthScores.animalId],
    references: [animals.id],
  }),
  recordedByUser: one(users, {
    fields: [healthScores.recordedBy],
    references: [users.id],
  }),
}));

// Mortality Records Relations
export const mortalityRecordsRelations = relations(mortalityRecords, ({ one }) => ({
  animal: one(animals, {
    fields: [mortalityRecords.animalId],
    references: [animals.id],
  }),
  relatedTreatment: one(animalTreatments, {
    fields: [mortalityRecords.relatedTreatmentId],
    references: [animalTreatments.id],
  }),
  veterinarian: one(users, {
    fields: [mortalityRecords.veterinarianId],
    references: [users.id],
  }),
  recordedByUser: one(users, {
    fields: [mortalityRecords.recordedBy],
    references: [users.id],
  }),
}));

// Health Alerts Relations
export const healthAlertsRelations = relations(healthAlerts, ({ one }) => ({
  animal: one(animals, {
    fields: [healthAlerts.animalId],
    references: [animals.id],
  }),
  relatedHealthScore: one(healthScores, {
    fields: [healthAlerts.relatedHealthScoreId],
    references: [healthScores.id],
  }),
  acknowledgedByUser: one(users, {
    fields: [healthAlerts.acknowledgedBy],
    references: [users.id],
  }),
  resolvedByUser: one(users, {
    fields: [healthAlerts.resolvedBy],
    references: [users.id],
  }),
}));

// Bulls Relations
export const bullsRelations = relations(bulls, ({ one, many }) => ({
  animal: one(animals, {
    fields: [bulls.animalId],
    references: [animals.id],
  }),
  breedingRecords: many(breedingRecords),
  calvingRecords: many(calvingRecords),
}));

// Breeding Records Relations
export const breedingRecordsRelations = relations(breedingRecords, ({ one }) => ({
  animal: one(animals, {
    fields: [breedingRecords.animalId],
    references: [animals.id],
  }),
  bull: one(bulls, {
    fields: [breedingRecords.bullId],
    references: [bulls.id],
  }),
  technician: one(users, {
    fields: [breedingRecords.technicianId],
    references: [users.id],
  }),
  recordedByUser: one(users, {
    fields: [breedingRecords.recordedBy],
    references: [users.id],
  }),
}));

// Calving Records Relations
export const calvingRecordsRelations = relations(calvingRecords, ({ one }) => ({
  dam: one(animals, {
    fields: [calvingRecords.damId],
    references: [animals.id],
  }),
  sire: one(bulls, {
    fields: [calvingRecords.sireId],
    references: [bulls.id],
  }),
  calf: one(animals, {
    fields: [calvingRecords.calfId],
    references: [animals.id],
  }),
  breedingRecord: one(breedingRecords, {
    fields: [calvingRecords.breedingRecordId],
    references: [breedingRecords.id],
  }),
  recordedByUser: one(users, {
    fields: [calvingRecords.recordedBy],
    references: [users.id],
  }),
}));

// Lactation Records Relations
export const lactationRecordsRelations = relations(lactationRecords, ({ one }) => ({
  animal: one(animals, {
    fields: [lactationRecords.animalId],
    references: [animals.id],
  }),
  calvingRecord: one(calvingRecords, {
    fields: [lactationRecords.calvingRecordId],
    references: [calvingRecords.id],
  }),
  recordedByUser: one(users, {
    fields: [lactationRecords.recordedBy],
    references: [users.id],
  }),
}));

// Heat Records Relations
export const heatRecordsRelations = relations(heatRecords, ({ one }) => ({
  animal: one(animals, {
    fields: [heatRecords.animalId],
    references: [animals.id],
  }),
  breedingRecord: one(breedingRecords, {
    fields: [heatRecords.breedingRecordId],
    references: [breedingRecords.id],
  }),
  detectedByUser: one(users, {
    fields: [heatRecords.detectedBy],
    references: [users.id],
  }),
}));

// ===== VETERINARY INTEGRATION RELATIONS =====

export const veterinariansRelations = relations(veterinarians, ({ many }) => ({
  visits: many(vetVisits),
  prescriptions: many(prescriptions),
}));

export const vetVisitsRelations = relations(vetVisits, ({ one, many }) => ({
  veterinarian: one(veterinarians, {
    fields: [vetVisits.veterinarianId],
    references: [veterinarians.id],
  }),
  createdByUser: one(users, {
    fields: [vetVisits.createdBy],
    references: [users.id],
  }),
  labResults: many(labResults),
  prescriptions: many(prescriptions),
}));

export const labResultsRelations = relations(labResults, ({ one }) => ({
  animal: one(animals, {
    fields: [labResults.animalId],
    references: [animals.id],
  }),
  vetVisit: one(vetVisits, {
    fields: [labResults.vetVisitId],
    references: [vetVisits.id],
  }),
  orderedByUser: one(users, {
    fields: [labResults.orderedBy],
    references: [users.id],
  }),
}));

export const prescriptionsRelations = relations(prescriptions, ({ one }) => ({
  animal: one(animals, {
    fields: [prescriptions.animalId],
    references: [animals.id],
  }),
  vetVisit: one(vetVisits, {
    fields: [prescriptions.vetVisitId],
    references: [vetVisits.id],
  }),
  veterinarian: one(veterinarians, {
    fields: [prescriptions.veterinarianId],
    references: [veterinarians.id],
  }),
  product: one(products, {
    fields: [prescriptions.productId],
    references: [products.id],
  }),
  createdByUser: one(users, {
    fields: [prescriptions.createdBy],
    references: [users.id],
  }),
}));

export const animalGroupMembersRelations = relations(animalGroupMembers, ({ one }) => ({
  group: one(animalGroups, {
    fields: [animalGroupMembers.groupId],
    references: [animalGroups.id],
  }),
  animal: one(animals, {
    fields: [animalGroupMembers.animalId],
    references: [animals.id],
  }),
  addedByUser: one(users, {
    fields: [animalGroupMembers.addedBy],
    references: [users.id],
  }),
}));

// Visitor Management Relations
export const visitorsRelations = relations(visitors, ({ many }) => ({
  signIns: many(visitorSignIns),
}));

export const visitorSignInsRelations = relations(visitorSignIns, ({ one }) => ({
  visitor: one(visitors, {
    fields: [visitorSignIns.visitorId],
    references: [visitors.id],
  }),
}));

export const qrCodes = pgTable('qr_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).unique().notNull(),
  locationName: varchar('location_name', { length: 255 }).notNull(),
  farmName: varchar('farm_name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  expiresAt: timestamp('expires_at'),
  usageCount: integer('usage_count').default(0).notNull(),
  maxUsage: integer('max_usage'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const qrCodesRelations = relations(qrCodes, ({ one }) => ({
  createdByUser: one(users, {
    fields: [qrCodes.createdBy],
    references: [users.id],
  }),
}));

// Vehicle Registry Relations
export const vehicleTypesRelations = relations(vehicleTypes, ({ many }) => ({
  vehicles: many(vehicles),
  inspectionTemplates: many(vehicleInspectionTemplates),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  type: one(vehicleTypes, {
    fields: [vehicles.typeId],
    references: [vehicleTypes.id],
  }),
  inspections: many(vehicleInspections),
  maintenanceRecords: many(vehicleMaintenanceRecords),
}));

export const vehicleInspectionTemplatesRelations = relations(vehicleInspectionTemplates, ({ one, many }) => ({
  vehicleType: one(vehicleTypes, {
    fields: [vehicleInspectionTemplates.typeId],
    references: [vehicleTypes.id],
  }),
  items: many(vehicleInspectionItems),
  inspections: many(vehicleInspections),
}));

export const vehicleInspectionItemsRelations = relations(vehicleInspectionItems, ({ one, many }) => ({
  template: one(vehicleInspectionTemplates, {
    fields: [vehicleInspectionItems.templateId],
    references: [vehicleInspectionTemplates.id],
  }),
  results: many(vehicleInspectionResults),
}));

export const vehicleInspectionsRelations = relations(vehicleInspections, ({ one, many }) => ({
  vehicle: one(vehicles, {
    fields: [vehicleInspections.vehicleId],
    references: [vehicles.id],
  }),
  template: one(vehicleInspectionTemplates, {
    fields: [vehicleInspections.templateId],
    references: [vehicleInspectionTemplates.id],
  }),
  inspector: one(users, {
    fields: [vehicleInspections.inspectorId],
    references: [users.id],
  }),
  results: many(vehicleInspectionResults),
}));

export const vehicleInspectionResultsRelations = relations(vehicleInspectionResults, ({ one }) => ({
  inspection: one(vehicleInspections, {
    fields: [vehicleInspectionResults.inspectionId],
    references: [vehicleInspections.id],
  }),
  item: one(vehicleInspectionItems, {
    fields: [vehicleInspectionResults.itemId],
    references: [vehicleInspectionItems.id],
  }),
}));

export const vehicleMaintenanceRecordsRelations = relations(vehicleMaintenanceRecords, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [vehicleMaintenanceRecords.vehicleId],
    references: [vehicles.id],
  }),
}));

// ===== DRIZZLE-ZOD INSERT SCHEMAS =====

export const insertUserSchema = createInsertSchema(users, {
  name: z.string().min(1, "Name required"),
  email: z.string().email().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertProductSchema = createInsertSchema(products, {
  name: z.string().min(1, "Product name required"),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });

export const insertProductBatchSchema = createInsertSchema(productBatches, {
  productName: z.string().min(1, "Product name required"),
  batchNo: z.string().min(1, "Batch number required"),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertBatchLifecycleEventSchema = createInsertSchema(batchLifecycleEvents, {
  batchId: z.string().min(1, "Batch ID required"),
  eventType: z.enum(['opened', 'administered', 'transferred', 'emptied', 'disposed', 'reconciled']),
  userName: z.string().min(1, "User name required"),
}).omit({ id: true, createdAt: true, eventTimestamp: true });

export const insertConditionSchema = createInsertSchema(conditions, {
  name: z.string().min(1, "Condition name required"),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertAnimalSchema = createInsertSchema(animals).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true, 
  version: true 
});

export const insertAnimalTagHistorySchema = createInsertSchema(animalTagHistory).omit({
  id: true,
  createdAt: true,
});

export const insertWeightRecordSchema = createInsertSchema(weightRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWeightTargetSchema = createInsertSchema(weightTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVaccinationScheduleSchema = createInsertSchema(vaccinationSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHealthScoreSchema = createInsertSchema(healthScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMortalityRecordSchema = createInsertSchema(mortalityRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHealthAlertSchema = createInsertSchema(healthAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBullSchema = createInsertSchema(bulls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBreedingRecordSchema = createInsertSchema(breedingRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCalvingRecordSchema = createInsertSchema(calvingRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLactationRecordSchema = createInsertSchema(lactationRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHeatRecordSchema = createInsertSchema(heatRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ===== VETERINARY INTEGRATION INSERT SCHEMAS =====

export const insertVeterinarianSchema = createInsertSchema(veterinarians, {
  name: z.string().min(1, "Veterinarian name required"),
  email: z.string().email().optional().or(z.literal('')),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVetVisitSchema = createInsertSchema(vetVisits, {
  scheduledDate: z.string().min(1, "Scheduled date required"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLabResultSchema = createInsertSchema(labResults, {
  testName: z.string().min(1, "Test name required"),
  sampleCollectionDate: z.string().min(1, "Sample collection date required"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPrescriptionSchema = createInsertSchema(prescriptions, {
  medicationName: z.string().min(1, "Medication name required"),
  dosage: z.string().min(1, "Dosage required"),
  prescriptionDate: z.string().min(1, "Prescription date required"),
  startDate: z.string().min(1, "Start date required"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVetCostRecordSchema = createInsertSchema(vetCostRecords, {
  periodStart: z.string().min(1, "Period start required"),
  periodEnd: z.string().min(1, "Period end required"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ===== MOBILE & FIELD FEATURES INSERT SCHEMAS =====

export const insertTreatmentTemplateSchema = createInsertSchema(treatmentTemplates, {
  name: z.string().min(1, "Template name required"),
  treatmentType: z.string().min(1, "Treatment type required"),
}).omit({
  id: true,
  usageCount: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVoiceNoteSchema = createInsertSchema(voiceNotes, {
  audioUrl: z.string().min(1, "Audio URL required"),
}).omit({
  id: true,
  createdAt: true,
});

export const insertPhotoAttachmentSchema = createInsertSchema(photoAttachments, {
  photoUrl: z.string().min(1, "Photo URL required"),
}).omit({
  id: true,
  createdAt: true,
});

export const insertBatchTreatmentSchema = createInsertSchema(batchTreatments, {
  treatmentDate: z.string().min(1, "Treatment date required"),
  treatmentType: z.string().min(1, "Treatment type required"),
}).omit({
  id: true,
  createdAt: true,
});

export const insertEidScanSessionSchema = createInsertSchema(eidScanSessions).omit({
  id: true,
  createdAt: true,
});

export const insertPastureSchema = createInsertSchema(pastures, {
  name: z.string().min(1, "Pasture name required"),
  soilQuality: z.number().int().min(0).max(10).optional(),
  grazingDays: z.number().int().min(0).optional(),
  restPeriodDays: z.number().int().min(0).optional(),
  grassCoverKg: z.number().int().min(0).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });

export const insertPastureMovementSchema = createInsertSchema(pastureMovements, {
  animalId: z.string().min(1, "Animal ID required"),
  toPastureId: z.string().min(1, "Destination pasture required"),
  movedBy: z.string().min(1, "Moved by user ID required"),
}).omit({ id: true, createdAt: true });

export const insertPastureHealthRecordSchema = createInsertSchema(pastureHealthRecords, {
  pastureId: z.string().min(1, "Pasture ID required"),
  recordedBy: z.string().min(1, "Recorded by required"),
  soilQuality: z.number().int().min(1).max(10).optional(),
  grazingDays: z.number().int().min(0).optional(),
  restPeriodDays: z.number().int().min(0).optional(),
  grassCoverKg: z.number().int().min(0).optional(),
}).omit({ id: true, recordedAt: true });

export const insertAnimalTreatmentSchema = createInsertSchema(animalTreatments, {
  staffMember: z.string().min(1, "Staff member required"),
  dateTime: z.string(),
  batchId: z.string().uuid().optional().nullable(),
  doseAmount: z.string().optional().nullable(),
  doseUnit: z.string().optional().nullable(),
}).omit({ id: true, createdAt: true, updatedAt: true, version: true });

export const insertReproductionEventSchema = createInsertSchema(reproductionEvents, {
  animalId: z.string().min(1, "Animal ID required"),
  eventDate: z.string(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertNaitRecordSchema = createInsertSchema(naitRecords, {
  animalId: z.string().min(1, "Animal ID required"),
  naitTag: z.string().min(1, "NAIT tag required"),
  registrationDate: z.string(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertMilkWithholdingSchema = createInsertSchema(milkWithholdings, {
  animalId: z.string().min(1, "Animal ID required"),
  treatmentId: z.string().min(1, "Treatment ID required"),
  startDate: z.string(),
  endDate: z.string(),
}).omit({ id: true, createdAt: true });

// Phase 4: Animal Groups Insert Schemas
export const insertAnimalGroupSchema = createInsertSchema(animalGroups, {
  name: z.string().min(1, "Group name required"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });

export const insertAnimalGroupMemberSchema = createInsertSchema(animalGroupMembers, {
  groupId: z.string().min(1, "Group ID required"),
  animalId: z.string().min(1, "Animal ID required"),
}).omit({ id: true, addedAt: true });

// Alerts Insert Schema
export const insertAlertSchema = createInsertSchema(alerts, {
  type: z.enum([
    // Treatment alerts
    'treatment_overdue', 'treatment_due', 'mastitis_quarter_repeat', 'rtv_ready', 'awaiting_treatment',
    // Withholding alerts
    'withholding_ending', 'withholding_meat_ending', 'withholding_milk_ending', 'withholding_cleared', 'monitoring_complete',
    // Calving alerts
    'calving_due', 'calving_overdue', 'calving_imminent',
    // Vaccination alerts
    'vaccination_due', 'vaccination_overdue', 'vaccination_schedule_reminder',
    // Health check alerts
    'health_check_due', 'health_score_critical', 'lameness_detected',
    // Reproduction alerts
    'heat_predicted', 'pregnancy_check_due', 'dry_off_due',
    // Vet alerts
    'vet_visit_reminder', 'lab_results_ready', 'prescription_ending',
    // Vehicle compliance alerts
    'vehicle_service_overdue', 'vehicle_service_due', 'vehicle_wof_expired', 'vehicle_wof_expiring',
    'vehicle_cof_expired', 'vehicle_cof_expiring', 'vehicle_registration_expired', 'vehicle_registration_expiring',
    'vehicle_ruc_expired', 'vehicle_ruc_expiring', 'vehicle_inspection_overdue', 'vehicle_inspection_due',
    'vehicle_insurance_expired', 'vehicle_insurance_expiring',
  ]),
  title: z.string().min(1, "Alert title required"),
  message: z.string().min(1, "Alert message required"),
}).omit({ id: true, createdAt: true });

// User Preferences Insert Schema (Phase 6A)
export const insertUserPreferencesSchema = createInsertSchema(userPreferences, {
  userId: z.string().uuid("Valid user ID required"),
  theme: z.enum(['light', 'dark', 'system']).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Visitor Management Insert Schemas (Phase 1)
export const insertVisitorSchema = createInsertSchema(visitors, {
  name: z.string().min(1, "Visitor name required"),
  company: z.string().min(1, "Company required"),
  phone: z.string().min(1, "Phone number required"),
  emergencyContact: z.string().min(1, "Emergency contact required"),
  emergencyPhone: z.string().min(1, "Emergency phone required"),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertVisitorSignInSchema = createInsertSchema(visitorSignIns, {
  visitorId: z.string().uuid("Valid visitor ID required"),
  farmName: z.string().min(1, "Farm name required"),
  locationCode: z.string().min(1, "Location code required"),
  purpose: z.string().min(1, "Purpose required"),
  hostPerson: z.string().min(1, "Host person required"),
}).omit({ id: true, signInTime: true, signOutTime: true, createdAt: true, updatedAt: true });

export const insertQRCodeSchema = createInsertSchema(qrCodes, {
  code: z.string().min(1, "QR code required"),
  locationName: z.string().min(1, "Location name required"),
  farmName: z.string().min(1, "Farm name required"),
  createdBy: z.string().uuid("Valid user ID required"),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Vehicle Registry Insert Schemas (Phase 1 Extension)
export const insertVehicleTypeSchema = createInsertSchema(vehicleTypes, {
  name: z.string().min(1, "Vehicle type name required"),
  category: z.enum(['light', 'heavy', 'machinery', 'motorcycle']),
  inspectionFrequencyDays: z.number().positive().default(7),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertVehicleSchema = createInsertSchema(vehicles, {
  registration: z.string().min(1, "Vehicle registration required"),
  make: z.string().min(1, "Vehicle make required"),
  model: z.string().min(1, "Vehicle model required"),
  year: z.number().min(1900).max(new Date().getFullYear() + 1),
  typeId: z.string().uuid("Valid vehicle type ID required"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVehicleInspectionTemplateSchema = createInsertSchema(vehicleInspectionTemplates, {
  typeId: z.string().uuid("Valid vehicle type ID required"),
  name: z.string().min(1, "Template name required"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVehicleInspectionItemSchema = createInsertSchema(vehicleInspectionItems, {
  templateId: z.string().uuid("Valid template ID required"),
  category: z.string().min(1, "Item category required"),
  itemName: z.string().min(1, "Item name required"),
  itemType: z.enum(['check', 'measure', 'visual', 'document']),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVehicleInspectionSchema = createInsertSchema(vehicleInspections, {
  vehicleId: z.string().uuid("Valid vehicle ID required"),
  templateId: z.string().uuid("Valid template ID required"),
  inspectorId: z.string().uuid("Valid inspector ID required"),
  overallStatus: z.enum(['pass', 'fail', 'pass_with_notes']),
  nextInspectionDue: z.string().min(1, "Next inspection date required"),
}).omit({
  id: true,
  inspectionDate: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVehicleInspectionResultSchema = createInsertSchema(vehicleInspectionResults, {
  inspectionId: z.string().uuid("Valid inspection ID required"),
  itemId: z.string().uuid("Valid item ID required"),
  status: z.enum(['pass', 'fail', 'not_applicable']),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVehicleMaintenanceRecordSchema = createInsertSchema(vehicleMaintenanceRecords, {
  vehicleId: z.string().uuid("Valid vehicle ID required"),
  type: z.enum(['service', 'repair', 'inspection', 'modification']),
  description: z.string().min(1, "Maintenance description required"),
  performedBy: z.string().min(1, "Performed by required"),
  performedDate: z.string().min(1, "Performed date required"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Geospatial Mapping Insert Schemas

export const insertFarmHazardSchema = createInsertSchema(farmHazards, {
  type: z.enum(['chemical', 'machinery', 'terrain', 'water', 'electrical', 'biosecurity']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string().min(1, "Hazard title required"),
  description: z.string().min(1, "Hazard description required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  status: z.enum(['active', 'resolved', 'monitoring']).default('active'),
  riskLevel: z.number().min(1).max(5).default(1),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ===== TYPES (for backwards compatibility) =====

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductBatch = typeof productBatches.$inferSelect;
export type RecordItem = ProductBatch; // Alias for backwards compatibility
export type BatchLifecycleEvent = typeof batchLifecycleEvents.$inferSelect; // Phase 6
export type Condition = typeof conditions.$inferSelect;
export type Animal = typeof animals.$inferSelect;
export type AnimalTagHistory = typeof animalTagHistory.$inferSelect;
export type HerdTestResult = typeof herdTestResults.$inferSelect;
export type Pasture = typeof pastures.$inferSelect;
export type AnimalTreatment = typeof animalTreatments.$inferSelect;
export type TreatmentEvent = typeof treatmentEvents.$inferSelect;
export type MilkWithholding = typeof milkWithholdings.$inferSelect;
export type ReproductionEvent = typeof reproductionEvents.$inferSelect;
export type NAITRecord = typeof naitRecords.$inferSelect;
export type NaitQueue = typeof naitQueue.$inferSelect;
export type SyncCursor = typeof syncCursors.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect; // Phase 6A
export type AnimalGroup = typeof animalGroups.$inferSelect; // Phase 4
export type AnimalGroupMember = typeof animalGroupMembers.$inferSelect; // Phase 4
export type PastureMovement = typeof pastureMovements.$inferSelect; // Phase 5
export type PastureHealthRecord = typeof pastureHealthRecords.$inferSelect; // Phase 5.3
export type Alert = typeof alerts.$inferSelect;

// Visitor Management Types (Phase 1)
export type Visitor = typeof visitors.$inferSelect;
export type VisitorSignIn = typeof visitorSignIns.$inferSelect;
export type QRCode = typeof qrCodes.$inferSelect;

// Vehicle Registry Types (Phase 1 Extension)
export type VehicleType = typeof vehicleTypes.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type VehicleInspectionTemplate = typeof vehicleInspectionTemplates.$inferSelect;
export type VehicleInspectionItem = typeof vehicleInspectionItems.$inferSelect;
export type VehicleInspection = typeof vehicleInspections.$inferSelect;
export type VehicleInspectionResult = typeof vehicleInspectionResults.$inferSelect;
export type VehicleMaintenanceRecord = typeof vehicleMaintenanceRecords.$inferSelect;

// Geospatial Mapping Types
export type FarmHazard = typeof farmHazards.$inferSelect;

// Stock Transaction Types (Phase 2)
export type StockTransaction = typeof stockTransactions.$inferSelect;
export type InsertStockTransaction = z.infer<typeof insertStockTransactionSchema>;

// Task Pin Types (Phase 3)
export type TaskPin = typeof taskPins.$inferSelect;
export type InsertTaskPin = z.infer<typeof insertTaskPinSchema>;

// ===== FINANCIAL INTEGRATION (Phase 4) =====
export const expenseCategoryEnum = pgEnum('expense_category', [
  'feed',
  'veterinary',
  'equipment',
  'fuel',
  'labor',
  'maintenance',
  'supplies',
  'utilities',
  'insurance',
  'other'
]);

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull(),
  category: expenseCategoryEnum('category').notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  vendor: varchar('vendor', { length: 255 }),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  paymentMethod: varchar('payment_method', { length: 50 }),
  receiptUrl: text('receipt_url'),
  notes: text('notes'),
  animalId: uuid('animal_id').references(() => animals.id),
  pastureId: uuid('pasture_id').references(() => pastures.id),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Killsheet data for tracking animal processing/sales
export const killsheets = pgTable('killsheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull(),
  processorName: varchar('processor_name', { length: 255 }).notNull(),
  lotNumber: varchar('lot_number', { length: 100 }),
  animalCount: integer('animal_count').notNull(),
  totalLiveWeight: numeric('total_live_weight', { precision: 10, scale: 2 }),
  totalCarcassWeight: numeric('total_carcass_weight', { precision: 10, scale: 2 }),
  averageDressingPercentage: numeric('avg_dressing_percentage', { precision: 5, scale: 2 }),
  gradeBreakdown: jsonb('grade_breakdown'), // { "P": 10, "T": 5, "F": 3 }
  pricePerKg: numeric('price_per_kg', { precision: 8, scale: 2 }),
  totalValue: numeric('total_value', { precision: 12, scale: 2 }),
  deductions: numeric('deductions', { precision: 10, scale: 2 }),
  netPayment: numeric('net_payment', { precision: 12, scale: 2 }),
  paymentDate: date('payment_date'),
  paymentReceived: boolean('payment_received').default(false),
  notes: text('notes'),
  documentUrl: text('document_url'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertKillsheetSchema = createInsertSchema(killsheets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Killsheet line items (individual animals or groups)
export const killsheetItems = pgTable('killsheet_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  killsheetId: uuid('killsheet_id').references(() => killsheets.id).notNull(),
  animalId: uuid('animal_id').references(() => animals.id),
  tagNumber: varchar('tag_number', { length: 50 }),
  liveWeight: numeric('live_weight', { precision: 8, scale: 2 }),
  carcassWeight: numeric('carcass_weight', { precision: 8, scale: 2 }),
  dressingPercentage: numeric('dressing_percentage', { precision: 5, scale: 2 }),
  grade: varchar('grade', { length: 10 }),
  fatScore: varchar('fat_score', { length: 10 }),
  pricePerKg: numeric('price_per_kg', { precision: 8, scale: 2 }),
  totalValue: numeric('total_value', { precision: 10, scale: 2 }),
  condemnations: text('condemnations'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertKillsheetItemSchema = createInsertSchema(killsheetItems).omit({
  id: true,
  createdAt: true,
});

// Financial Types (Phase 4)
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Killsheet = typeof killsheets.$inferSelect;
export type InsertKillsheet = z.infer<typeof insertKillsheetSchema>;
export type KillsheetItem = typeof killsheetItems.$inferSelect;
export type InsertKillsheetItem = z.infer<typeof insertKillsheetItemSchema>;

// ===== MILK PRODUCTION TRACKING (Phase 5) =====
export const milkRecords = pgTable('milk_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull(),
  herdId: uuid('herd_id'), // Optional reference to herd
  totalVolume: numeric('total_volume', { precision: 10, scale: 2 }).notNull(), // Litres
  averageFat: numeric('average_fat', { precision: 5, scale: 2 }), // Percentage
  averageProtein: numeric('average_protein', { precision: 5, scale: 2 }), // Percentage
  averageSomaticCellCount: numeric('average_somatic_cell_count', { precision: 10, scale: 0 }), // Cells/ml
  milkPrice: numeric('milk_price', { precision: 8, scale: 4 }), // $/kg milk solids
  fatPrice: numeric('fat_price', { precision: 8, scale: 4 }), // $/kg
  proteinPrice: numeric('protein_price', { precision: 8, scale: 4 }), // $/kg
  totalValue: numeric('total_value', { precision: 12, scale: 2 }), // $
  milkingTime: varchar('milking_time', { length: 20 }), // 'morning', 'evening', 'combined'
  temperature: numeric('temperature', { precision: 5, scale: 2 }), // Celsius
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertMilkRecordSchema = createInsertSchema(milkRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Milk Quality Alerts
export const milkQualityAlerts = pgTable('milk_quality_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull(),
  alertType: varchar('alert_type', { length: 50 }).notNull(), // 'high_scc', 'low_fat', 'low_protein', 'temperature'
  severity: varchar('severity', { length: 20 }).notNull(), // 'low', 'medium', 'high', 'critical'
  message: text('message').notNull(),
  value: numeric('value', { precision: 10, scale: 2 }),
  threshold: numeric('threshold', { precision: 10, scale: 2 }),
  milkRecordId: uuid('milk_record_id').references(() => milkRecords.id),
  acknowledged: boolean('acknowledged').default(false),
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
  acknowledgedAt: timestamp('acknowledged_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertMilkQualityAlertSchema = createInsertSchema(milkQualityAlerts).omit({
  id: true,
  createdAt: true,
});

// Milk Production Types
export type MilkRecord = typeof milkRecords.$inferSelect;
export type InsertMilkRecord = z.infer<typeof insertMilkRecordSchema>;
export type MilkQualityAlert = typeof milkQualityAlerts.$inferSelect;
export type InsertMilkQualityAlert = z.infer<typeof insertMilkQualityAlertSchema>;

// ===== BUDGETING & FORECASTING (Phase 5) =====
export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft, active, archived
  totalBudgetedIncome: numeric('total_budgeted_income', { precision: 14, scale: 2 }),
  totalBudgetedExpenses: numeric('total_budgeted_expenses', { precision: 14, scale: 2 }),
  netBudgetedProfit: numeric('net_budgeted_profit', { precision: 14, scale: 2 }),
  actualIncome: numeric('actual_income', { precision: 14, scale: 2 }),
  actualExpenses: numeric('actual_expenses', { precision: 14, scale: 2 }),
  actualProfit: numeric('actual_profit', { precision: 14, scale: 2 }),
  variance: numeric('variance', { precision: 14, scale: 2 }),
  variancePercentage: numeric('variance_percentage', { precision: 5, scale: 2 }),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const budgetCategories = pgTable('budget_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  budgetId: uuid('budget_id').references(() => budgets.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // income, expense
  budgetedAmount: numeric('budgeted_amount', { precision: 12, scale: 2 }).notNull(),
  actualAmount: numeric('actual_amount', { precision: 12, scale: 2 }),
  variance: numeric('variance', { precision: 12, scale: 2 }),
  variancePercentage: numeric('variance_percentage', { precision: 5, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const forecasts = pgTable('forecasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  forecastType: varchar('forecast_type', { length: 50 }).notNull(), // cash_flow, production, financial
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  periodType: varchar('period_type', { length: 20 }).notNull(), // monthly, quarterly, yearly
  assumptions: text('assumptions'), // JSON string of forecast assumptions
  isBaseline: boolean('is_baseline').default(false),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const forecastData = pgTable('forecast_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  forecastId: uuid('forecast_id').references(() => forecasts.id, { onDelete: 'cascade' }),
  period: date('period').notNull(),
  category: varchar('category', { length: 100 }),
  metricType: varchar('metric_type', { length: 50 }).notNull(), // revenue, expense, milk_volume, etc.
  predictedValue: numeric('predicted_value', { precision: 12, scale: 2 }).notNull(),
  confidenceLevel: numeric('confidence_level', { precision: 3, scale: 2 }), // 0-1
  actualValue: numeric('actual_value', { precision: 12, scale: 2 }),
  accuracy: numeric('accuracy', { precision: 3, scale: 2 }), // percentage 0-1
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertBudgetSchema = createInsertSchema(budgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBudgetCategorySchema = createInsertSchema(budgetCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertForecastSchema = createInsertSchema(forecasts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertForecastDataSchema = createInsertSchema(forecastData).omit({
  id: true,
  createdAt: true,
});

// Budgeting & Forecasting Types
export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type BudgetCategory = typeof budgetCategories.$inferSelect;
export type InsertBudgetCategory = z.infer<typeof insertBudgetCategorySchema>;
export type Forecast = typeof forecasts.$inferSelect;
export type InsertForecast = z.infer<typeof insertForecastSchema>;
export type ForecastData = typeof forecastData.$inferSelect;
export type InsertForecastData = z.infer<typeof insertForecastDataSchema>;

// ===== NZFAP COMPLIANCE (Phase 5) =====
export const complianceStandards = pgTable('compliance_standards', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull(), // NZFAP-001, etc.
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(), // animal_welfare, biosecurity, environment, etc.
  requirementLevel: varchar('requirement_level', { length: 20 }).notNull(), // mandatory, recommended, best_practice
  checkFrequency: varchar('check_frequency', { length: 20 }).notNull(), // daily, weekly, monthly, quarterly, annually
  documentationRequired: boolean('documentation_required').default(false),
  isActive: boolean('is_active').default(true),
  lastUpdated: date('last_updated'),
});

export const complianceChecks = pgTable('compliance_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  standardId: uuid('standard_id').references(() => complianceStandards.id),
  checkDate: date('check_date').notNull(),
  status: varchar('status', { length: 20 }).notNull(), // compliant, non_compliant, not_applicable, pending_review
  score: numeric('score', { precision: 5, scale: 2 }), // 0-100
  findings: text('findings'),
  correctiveActions: text('corrective_actions'),
  dueDate: date('due_date'),
  completedDate: date('completed_date'),
  checkedBy: uuid('checked_by').references(() => users.id),
  evidence: text('evidence'), // JSON array of evidence documents/notes
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const complianceAudits = pgTable('compliance_audits', {
  id: uuid('id').primaryKey().defaultRandom(),
  auditType: varchar('audit_type', { length: 50 }).notNull(), // internal, external, nzfap
  auditDate: date('audit_date').notNull(),
  auditor: varchar('auditor', { length: 200 }),
  overallScore: numeric('overall_score', { precision: 5, scale: 2 }),
  status: varchar('status', { length: 20 }).notNull(), // scheduled, in_progress, completed, failed
  findings: text('findings'),
  recommendations: text('recommendations'),
  nextAuditDate: date('next_audit_date'),
  certificateIssued: boolean('certificate_issued').default(false),
  certificateExpiry: date('certificate_expiry'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const complianceDocuments = pgTable('compliance_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  documentType: varchar('document_type', { length: 50 }).notNull(), // policy, procedure, record, certificate
  category: varchar('category', { length: 100 }).notNull(),
  filePath: varchar('file_path', { length: 500 }),
  fileSize: numeric('file_size', { precision: 10, scale: 0 }),
  mimeType: varchar('mime_type', { length: 100 }),
  version: varchar('version', { length: 20 }).default('1.0'),
  expiryDate: date('expiry_date'),
  isRequired: boolean('is_required').default(false),
  isCurrent: boolean('is_current').default(true),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertComplianceStandardSchema = createInsertSchema(complianceStandards).omit({
  id: true,
});

export const insertComplianceCheckSchema = createInsertSchema(complianceChecks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplianceAuditSchema = createInsertSchema(complianceAudits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplianceDocumentSchema = createInsertSchema(complianceDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// NZFAP Compliance Types
export type ComplianceStandard = typeof complianceStandards.$inferSelect;
export type InsertComplianceStandard = z.infer<typeof insertComplianceStandardSchema>;
export type ComplianceCheck = typeof complianceChecks.$inferSelect;
export type InsertComplianceCheck = z.infer<typeof insertComplianceCheckSchema>;
export type ComplianceAudit = typeof complianceAudits.$inferSelect;
export type InsertComplianceAudit = z.infer<typeof insertComplianceAuditSchema>;
export type ComplianceDocument = typeof complianceDocuments.$inferSelect;
export type InsertComplianceDocument = z.infer<typeof insertComplianceDocumentSchema>;

// ===== CHAT SYSTEM (Phase 7) =====

// Channel context type enum
export const channelContextTypeEnum = pgEnum('channel_context_type', ['job', 'animal', 'equipment']);

// Chat Channels (Direct messages and group chats)
export const chatChannels = pgTable('chat_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }), // null for direct messages, name for group chats
  type: varchar('type', { length: 20 }).notNull().default('direct'), // 'direct', 'group', 'context'
  contextType: channelContextTypeEnum('context_type'), // 'job', 'animal', 'equipment' for context channels
  contextId: uuid('context_id'), // Reference to job, animal, or equipment ID
  description: text('description'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Chat Channel Members (Many-to-many relationship between users and channels)
export const chatChannelMembers = pgTable('chat_channel_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => chatChannels.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 20 }).default('member').notNull(), // 'admin', 'member'
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  isMuted: boolean('is_muted').default(false).notNull(),
  lastReadAt: timestamp('last_read_at'),
}, (table) => ({
  uniqueChannelUser: sql`UNIQUE (channel_id, user_id)`,
}));

// Chat Messages
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => chatChannels.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  body: text('body').notNull(),
  messageType: varchar('message_type', { length: 20 }).default('text').notNull(), // 'text', 'image', 'file', 'system'
  replyToId: uuid('reply_to_id').references(() => chatMessages.id), // For threaded replies
  attachments: jsonb('attachments'), // JSON array of file URLs and metadata
  isEdited: boolean('is_edited').default(false).notNull(),
  editedAt: timestamp('edited_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  channelCreatedAtIdx: sql`CREATE INDEX IF NOT EXISTS chat_messages_channel_created ON ${table} (channel_id, created_at DESC)`,
}));

// Message Read Receipts
export const chatMessageReads = pgTable('chat_message_reads', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').references(() => chatMessages.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  readAt: timestamp('read_at').defaultNow().notNull(),
}, (table) => ({
  uniqueMessageUser: sql`UNIQUE (message_id, user_id)`,
}));

// Message Pins (Pinned messages in channels)
export const chatMessagePins = pgTable('chat_message_pins', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => chatChannels.id, { onDelete: 'cascade' }).notNull(),
  messageId: uuid('message_id').references(() => chatMessages.id, { onDelete: 'cascade' }).notNull(),
  pinnedBy: uuid('pinned_by').references(() => users.id).notNull(),
  pinnedAt: timestamp('pinned_at').defaultNow().notNull(),
}, (table) => ({
  uniqueChannelMessage: sql`UNIQUE (channel_id, message_id)`,
}));

// Chat System Relations
export const chatChannelsRelations = relations(chatChannels, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [chatChannels.createdBy],
    references: [users.id],
  }),
  members: many(chatChannelMembers),
  messages: many(chatMessages),
  pins: many(chatMessagePins),
}));

export const chatChannelMembersRelations = relations(chatChannelMembers, ({ one, many }) => ({
  channel: one(chatChannels, {
    fields: [chatChannelMembers.channelId],
    references: [chatChannels.id],
  }),
  user: one(users, {
    fields: [chatChannelMembers.userId],
    references: [users.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one, many }) => ({
  channel: one(chatChannels, {
    fields: [chatMessages.channelId],
    references: [chatChannels.id],
  }),
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
  replyTo: one(chatMessages, {
    fields: [chatMessages.replyToId],
    references: [chatMessages.id],
  }),
  reads: many(chatMessageReads),
}));

export const chatMessageReadsRelations = relations(chatMessageReads, ({ one }) => ({
  message: one(chatMessages, {
    fields: [chatMessageReads.messageId],
    references: [chatMessages.id],
  }),
  user: one(users, {
    fields: [chatMessageReads.userId],
    references: [users.id],
  }),
}));

export const chatMessagePinsRelations = relations(chatMessagePins, ({ one }) => ({
  channel: one(chatChannels, {
    fields: [chatMessagePins.channelId],
    references: [chatChannels.id],
  }),
  message: one(chatMessages, {
    fields: [chatMessagePins.messageId],
    references: [chatMessages.id],
  }),
  pinnedByUser: one(users, {
    fields: [chatMessagePins.pinnedBy],
    references: [users.id],
  }),
}));

// Chat System Validation Schemas
export const insertChatChannelSchema = createInsertSchema(chatChannels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatChannelMemberSchema = createInsertSchema(chatChannelMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageReadSchema = createInsertSchema(chatMessageReads).omit({
  id: true,
  readAt: true,
});

export const insertChatMessagePinSchema = createInsertSchema(chatMessagePins).omit({
  id: true,
  pinnedAt: true,
});

// Chat System Types
export type ChatChannel = typeof chatChannels.$inferSelect;
export type InsertChatChannel = z.infer<typeof insertChatChannelSchema>;
export type ChatChannelMember = typeof chatChannelMembers.$inferSelect;
export type InsertChatChannelMember = z.infer<typeof insertChatChannelMemberSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessageRead = typeof chatMessageReads.$inferSelect;
export type InsertChatMessageRead = z.infer<typeof insertChatMessageReadSchema>;
export type ChatMessagePin = typeof chatMessagePins.$inferSelect;
export type InsertChatMessagePin = z.infer<typeof insertChatMessagePinSchema>;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertProductBatch = z.infer<typeof insertProductBatchSchema>;
export type InsertRecord = InsertProductBatch; // Alias for backwards compatibility
export type InsertBatchLifecycleEvent = z.infer<typeof insertBatchLifecycleEventSchema>; // Phase 6
export type InsertCondition = z.infer<typeof insertConditionSchema>;
export type InsertAnimal = z.infer<typeof insertAnimalSchema>;
export type InsertAnimalTagHistory = z.infer<typeof insertAnimalTagHistorySchema>;
export type WeightRecord = typeof weightRecords.$inferSelect;
export type WeightTarget = typeof weightTargets.$inferSelect;
export type InsertWeightRecord = z.infer<typeof insertWeightRecordSchema>;
export type InsertWeightTarget = z.infer<typeof insertWeightTargetSchema>;
export type VaccinationSchedule = typeof vaccinationSchedules.$inferSelect;
export type InsertVaccinationSchedule = z.infer<typeof insertVaccinationScheduleSchema>;
export type HealthScore = typeof healthScores.$inferSelect;
export type InsertHealthScore = z.infer<typeof insertHealthScoreSchema>;
export type MortalityRecord = typeof mortalityRecords.$inferSelect;
export type InsertMortalityRecord = z.infer<typeof insertMortalityRecordSchema>;
export type HealthAlert = typeof healthAlerts.$inferSelect;
export type InsertHealthAlert = z.infer<typeof insertHealthAlertSchema>;
export type Bull = typeof bulls.$inferSelect;
export type InsertBull = z.infer<typeof insertBullSchema>;
export type BreedingRecord = typeof breedingRecords.$inferSelect;
export type InsertBreedingRecord = z.infer<typeof insertBreedingRecordSchema>;
export type CalvingRecord = typeof calvingRecords.$inferSelect;
export type InsertCalvingRecord = z.infer<typeof insertCalvingRecordSchema>;
export type LactationRecord = typeof lactationRecords.$inferSelect;
export type InsertLactationRecord = z.infer<typeof insertLactationRecordSchema>;
export type HeatRecord = typeof heatRecords.$inferSelect;
export type InsertHeatRecord = z.infer<typeof insertHeatRecordSchema>;
export type Veterinarian = typeof veterinarians.$inferSelect;
export type InsertVeterinarian = z.infer<typeof insertVeterinarianSchema>;
export type VetVisit = typeof vetVisits.$inferSelect;
export type InsertVetVisit = z.infer<typeof insertVetVisitSchema>;
export type LabResult = typeof labResults.$inferSelect;
export type InsertLabResult = z.infer<typeof insertLabResultSchema>;
export type Prescription = typeof prescriptions.$inferSelect;
export type InsertPrescription = z.infer<typeof insertPrescriptionSchema>;
export type VetCostRecord = typeof vetCostRecords.$inferSelect;
export type InsertVetCostRecord = z.infer<typeof insertVetCostRecordSchema>;
export type TreatmentTemplate = typeof treatmentTemplates.$inferSelect;
export type InsertTreatmentTemplate = z.infer<typeof insertTreatmentTemplateSchema>;
export type VoiceNote = typeof voiceNotes.$inferSelect;
export type InsertVoiceNote = z.infer<typeof insertVoiceNoteSchema>;
export type PhotoAttachment = typeof photoAttachments.$inferSelect;
export type InsertPhotoAttachment = z.infer<typeof insertPhotoAttachmentSchema>;
export type BatchTreatment = typeof batchTreatments.$inferSelect;
export type InsertBatchTreatment = z.infer<typeof insertBatchTreatmentSchema>;
export type EidScanSession = typeof eidScanSessions.$inferSelect;
export type InsertEidScanSession = z.infer<typeof insertEidScanSessionSchema>;
export type InsertPasture = z.infer<typeof insertPastureSchema>;
export type InsertAnimalTreatment = z.infer<typeof insertAnimalTreatmentSchema>;
export type InsertReproductionEvent = z.infer<typeof insertReproductionEventSchema>;
export type InsertNaitRecord = z.infer<typeof insertNaitRecordSchema>;
export type InsertMilkWithholding = z.infer<typeof insertMilkWithholdingSchema>;
export type InsertAnimalGroup = z.infer<typeof insertAnimalGroupSchema>; // Phase 4
export type InsertAnimalGroupMember = z.infer<typeof insertAnimalGroupMemberSchema>; // Phase 4
export type InsertPastureMovement = z.infer<typeof insertPastureMovementSchema>; // Phase 5
export type InsertPastureHealthRecord = z.infer<typeof insertPastureHealthRecordSchema>; // Phase 5.3
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>; // Phase 6A
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type InsertVisitorSignIn = z.infer<typeof insertVisitorSignInSchema>;
export type InsertQRCode = z.infer<typeof insertQRCodeSchema>;

// ReminderSettings type (stored in settings table as JSON)
export type ReminderSettings = {
  enabled: boolean;
  leadExpiryDays: number;
  leadUseByDays: number;
  dailySummaryHour: number;
  treatmentAlertBufferHours: number;
};

// ===== STAFF & CONTRACTOR MANAGEMENT (Phase 8) =====

// Staff Profiles (Extended user information for farm workers)
export const staffProfiles = pgTable('staff_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  employeeId: varchar('employee_id', { length: 50 }),
  position: varchar('position', { length: 100 }),
  department: varchar('department', { length: 100 }),
  phone: varchar('phone', { length: 50 }),
  emergencyContact: varchar('emergency_contact', { length: 255 }),
  emergencyPhone: varchar('emergency_phone', { length: 50 }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  employmentType: varchar('employment_type', { length: 50 }).default('full_time'), // full_time, part_time, casual, seasonal
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Staff Certifications (Training records, licenses, qualifications)
export const staffCertifications = pgTable('staff_certifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffProfileId: uuid('staff_profile_id').references(() => staffProfiles.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }), // license, certification, training, qualification
  issuingBody: varchar('issuing_body', { length: 255 }),
  certificateNumber: varchar('certificate_number', { length: 100 }),
  issueDate: date('issue_date'),
  expiryDate: date('expiry_date'),
  documentUrl: varchar('document_url', { length: 500 }),
  status: varchar('status', { length: 50 }).default('active'), // active, expired, pending_renewal
  reminderDays: integer('reminder_days').default(30), // Days before expiry to send reminder
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Contractors (External service providers)
export const contractors = pgTable('contractors', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  contactName: varchar('contact_name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  serviceType: varchar('service_type', { length: 100 }), // fencing, shearing, veterinary, transport, etc.
  taxNumber: varchar('tax_number', { length: 50 }), // IRD/GST number
  insuranceProvider: varchar('insurance_provider', { length: 255 }),
  insurancePolicyNumber: varchar('insurance_policy_number', { length: 100 }),
  insuranceExpiryDate: date('insurance_expiry_date'),
  healthSafetyPlanUrl: varchar('health_safety_plan_url', { length: 500 }),
  preQualificationStatus: varchar('pre_qualification_status', { length: 50 }).default('pending'), // pending, approved, rejected, expired
  preQualificationDate: date('pre_qualification_date'),
  preQualificationExpiryDate: date('pre_qualification_expiry_date'),
  rating: integer('rating'), // 1-5 star rating
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Contractor Documents (Required documents for pre-qualification)
export const contractorDocuments = pgTable('contractor_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractorId: uuid('contractor_id').references(() => contractors.id, { onDelete: 'cascade' }).notNull(),
  documentType: varchar('document_type', { length: 100 }).notNull(), // insurance, h&s_plan, license, certification
  documentName: varchar('document_name', { length: 255 }).notNull(),
  documentUrl: varchar('document_url', { length: 500 }),
  expiryDate: date('expiry_date'),
  isVerified: boolean('is_verified').default(false),
  verifiedBy: uuid('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Roster Entry Status Enum
export const rosterStatusEnum = pgEnum('roster_status', ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']);

// Roster Entries (Shift scheduling for staff)
export const rosterEntries = pgTable('roster_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').references(() => farms.id).notNull(),
  staffProfileId: uuid('staff_profile_id').references(() => staffProfiles.id, { onDelete: 'cascade' }).notNull(),
  
  // Shift timing
  date: date('date').notNull(),
  startTime: varchar('start_time', { length: 10 }).notNull(), // HH:MM format
  endTime: varchar('end_time', { length: 10 }).notNull(), // HH:MM format
  breakMinutes: integer('break_minutes').default(0),
  
  // Role and assignment
  role: varchar('role', { length: 100 }), // e.g., "Milker", "Tractor Operator", "General"
  position: varchar('position', { length: 100 }), // Specific position if needed
  
  // Link to job/task (optional)
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  
  // Status tracking
  status: rosterStatusEnum('status').default('scheduled').notNull(),
  confirmedAt: timestamp('confirmed_at'),
  
  // Location
  location: varchar('location', { length: 255 }),
  pastureId: uuid('pasture_id').references(() => pastures.id),
  
  // Metadata
  notes: text('notes'), // e.g., "Covering for John"
  color: varchar('color', { length: 20 }), // For calendar display
  
  // Created by (manager who scheduled)
  createdById: uuid('created_by_id').references(() => users.id).notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Timesheet Status Enum
export const timesheetStatusEnum = pgEnum('timesheet_status', ['draft', 'pending', 'approved', 'rejected']);

// Timesheets (Time tracking for staff)
export const timesheets = pgTable('timesheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').references(() => farms.id),
  staffProfileId: uuid('staff_profile_id').references(() => staffProfiles.id, { onDelete: 'cascade' }).notNull(),
  date: date('date').notNull(),
  startTime: varchar('start_time', { length: 10 }).notNull(), // HH:MM format
  endTime: varchar('end_time', { length: 10 }), // HH:MM format
  breakMinutes: integer('break_minutes').default(0),
  totalHours: numeric('total_hours', { precision: 5, scale: 2 }),
  jobId: uuid('job_id'), // Link to job if applicable (no FK for now)
  taskDescription: text('task_description'),
  location: varchar('location', { length: 255 }),
  status: varchar('status', { length: 50 }).default('pending'), // pending, approved, rejected
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Contractor Work Records (Track contractor work on farm)
export const contractorWorkRecords = pgTable('contractor_work_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractorId: uuid('contractor_id').references(() => contractors.id, { onDelete: 'cascade' }).notNull(),
  date: date('date').notNull(),
  description: text('description').notNull(),
  location: varchar('location', { length: 255 }),
  hoursWorked: numeric('hours_worked', { precision: 5, scale: 2 }),
  cost: numeric('cost', { precision: 10, scale: 2 }),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  invoiceUrl: varchar('invoice_url', { length: 500 }),
  status: varchar('status', { length: 50 }).default('completed'), // scheduled, in_progress, completed, invoiced, paid
  jobId: uuid('job_id'), // Link to job if applicable (no FK for now)
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Staff & Contractor Relations
export const staffProfilesRelations = relations(staffProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [staffProfiles.userId],
    references: [users.id],
  }),
  certifications: many(staffCertifications),
  timesheets: many(timesheets),
}));

export const staffCertificationsRelations = relations(staffCertifications, ({ one }) => ({
  staffProfile: one(staffProfiles, {
    fields: [staffCertifications.staffProfileId],
    references: [staffProfiles.id],
  }),
}));

export const contractorsRelations = relations(contractors, ({ many }) => ({
  documents: many(contractorDocuments),
  workRecords: many(contractorWorkRecords),
}));

export const contractorDocumentsRelations = relations(contractorDocuments, ({ one }) => ({
  contractor: one(contractors, {
    fields: [contractorDocuments.contractorId],
    references: [contractors.id],
  }),
  verifiedByUser: one(users, {
    fields: [contractorDocuments.verifiedBy],
    references: [users.id],
  }),
}));

export const rosterEntriesRelations = relations(rosterEntries, ({ one }) => ({
  farm: one(farms, {
    fields: [rosterEntries.farmId],
    references: [farms.id],
  }),
  staffProfile: one(staffProfiles, {
    fields: [rosterEntries.staffProfileId],
    references: [staffProfiles.id],
  }),
  job: one(jobs, {
    fields: [rosterEntries.jobId],
    references: [jobs.id],
  }),
  pasture: one(pastures, {
    fields: [rosterEntries.pastureId],
    references: [pastures.id],
  }),
  createdBy: one(users, {
    fields: [rosterEntries.createdById],
    references: [users.id],
  }),
}));

export const timesheetsRelations = relations(timesheets, ({ one }) => ({
  farm: one(farms, {
    fields: [timesheets.farmId],
    references: [farms.id],
  }),
  staffProfile: one(staffProfiles, {
    fields: [timesheets.staffProfileId],
    references: [staffProfiles.id],
  }),
  approvedByUser: one(users, {
    fields: [timesheets.approvedBy],
    references: [users.id],
  }),
}));

export const contractorWorkRecordsRelations = relations(contractorWorkRecords, ({ one }) => ({
  contractor: one(contractors, {
    fields: [contractorWorkRecords.contractorId],
    references: [contractors.id],
  }),
}));

// Staff & Contractor Validation Schemas
export const insertStaffProfileSchema = createInsertSchema(staffProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffCertificationSchema = createInsertSchema(staffCertifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractorSchema = createInsertSchema(contractors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractorDocumentSchema = createInsertSchema(contractorDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRosterEntrySchema = createInsertSchema(rosterEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRosterEntrySchema = insertRosterEntrySchema.partial();

export const insertTimesheetSchema = createInsertSchema(timesheets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTimesheetSchema = insertTimesheetSchema.partial();

export const insertContractorWorkRecordSchema = createInsertSchema(contractorWorkRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Staff & Contractor Types
export type StaffProfile = typeof staffProfiles.$inferSelect;
export type InsertStaffProfile = z.infer<typeof insertStaffProfileSchema>;
export type StaffCertification = typeof staffCertifications.$inferSelect;
export type InsertStaffCertification = z.infer<typeof insertStaffCertificationSchema>;
export type Contractor = typeof contractors.$inferSelect;
export type InsertContractor = z.infer<typeof insertContractorSchema>;
export type RosterEntry = typeof rosterEntries.$inferSelect;
export type InsertRosterEntry = z.infer<typeof insertRosterEntrySchema>;
export type ContractorDocument = typeof contractorDocuments.$inferSelect;
export type InsertContractorDocument = z.infer<typeof insertContractorDocumentSchema>;
export type Timesheet = typeof timesheets.$inferSelect;
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type ContractorWorkRecord = typeof contractorWorkRecords.$inferSelect;
export type InsertContractorWorkRecord = z.infer<typeof insertContractorWorkRecordSchema>;

// ============================================
// RECURRING TASKS SCHEMA
// ============================================

// Recurring Task Templates - defines the pattern for recurring tasks
export const recurringTaskTemplates = pgTable('recurring_task_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id'), // Optional farm reference for multi-farm support
  
  // Task details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull().default('general'),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'), // low, medium, high, urgent
  estimatedDuration: integer('estimated_duration'), // in minutes
  
  // Location
  location: varchar('location', { length: 255 }),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  pastureId: uuid('pasture_id'),
  
  // Assignment
  assignedTo: jsonb('assigned_to').$type<string[]>().default([]), // Array of user IDs
  
  // Recurrence pattern
  recurrenceType: varchar('recurrence_type', { length: 20 }).notNull(), // daily, weekly, monthly, custom
  recurrenceInterval: integer('recurrence_interval').notNull().default(1), // Every X days/weeks/months
  recurrenceDays: jsonb('recurrence_days').$type<number[]>(), // For weekly: [0,1,2,3,4,5,6] (Sun-Sat), For monthly: [1,15] (day of month)
  recurrenceTime: varchar('recurrence_time', { length: 5 }).notNull().default('09:00'), // HH:MM format
  recurrenceEndTime: varchar('recurrence_end_time', { length: 5 }), // Optional end time
  
  // Schedule boundaries
  startDate: date('start_date').notNull(), // When recurrence starts
  endDate: date('end_date'), // Optional: when recurrence ends (null = indefinite)
  maxOccurrences: integer('max_occurrences'), // Optional: stop after X occurrences
  
  // Checklist items (sub-tasks)
  checklistItems: jsonb('checklist_items').$type<{ id: string; text: string; required: boolean }[]>(),
  
  // Weather conditions
  weatherSensitive: boolean('weather_sensitive').default(false),
  skipIfRaining: boolean('skip_if_raining').default(false),
  minTemperature: integer('min_temperature'), // Celsius
  maxTemperature: integer('max_temperature'),
  
  // Metadata
  isActive: boolean('is_active').default(true).notNull(),
  lastGeneratedDate: date('last_generated_date'), // Track last task generation
  totalGenerated: integer('total_generated').default(0),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Generated Tasks from recurring templates
export const recurringTaskInstances = pgTable('recurring_task_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').references(() => recurringTaskTemplates.id, { onDelete: 'cascade' }).notNull(),
  farmId: uuid('farm_id'), // Optional farm reference for multi-farm support
  
  // Task details (copied from template, can be modified)
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(),
  priority: varchar('priority', { length: 20 }).notNull(),
  
  // Location
  location: varchar('location', { length: 255 }),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  pastureId: uuid('pasture_id'),
  
  // Assignment
  assignedTo: jsonb('assigned_to').$type<string[]>().default([]),
  
  // Scheduling
  scheduledDate: date('scheduled_date').notNull(),
  scheduledTime: varchar('scheduled_time', { length: 5 }).notNull(),
  scheduledEndTime: varchar('scheduled_end_time', { length: 5 }),
  dueDate: timestamp('due_date'),
  
  // Status tracking
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, in_progress, completed, skipped, cancelled
  
  // Checklist progress
  checklistItems: jsonb('checklist_items').$type<{ id: string; text: string; required: boolean; completed: boolean; completedAt?: string; completedBy?: string }[]>(),
  
  // Completion details
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  completedBy: uuid('completed_by').references(() => users.id),
  skipReason: varchar('skip_reason', { length: 255 }),
  
  // Time tracking
  estimatedDuration: integer('estimated_duration'), // minutes
  actualDuration: integer('actual_duration'), // minutes
  
  // Notes and photos
  notes: text('notes'),
  photoUrls: jsonb('photo_urls').$type<string[]>(),
  
  // Weather at time of task
  weatherCondition: varchar('weather_condition', { length: 50 }),
  temperature: integer('temperature'),
  
  // Metadata
  occurrenceNumber: integer('occurrence_number').notNull(), // Which occurrence this is (1st, 2nd, etc.)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations for recurring tasks
export const recurringTaskTemplatesRelations = relations(recurringTaskTemplates, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [recurringTaskTemplates.createdBy],
    references: [users.id],
  }),
  instances: many(recurringTaskInstances),
}));

export const recurringTaskInstancesRelations = relations(recurringTaskInstances, ({ one }) => ({
  template: one(recurringTaskTemplates, {
    fields: [recurringTaskInstances.templateId],
    references: [recurringTaskTemplates.id],
  }),
  completedByUser: one(users, {
    fields: [recurringTaskInstances.completedBy],
    references: [users.id],
  }),
}));

// Validation schemas for recurring tasks
export const insertRecurringTaskTemplateSchema = createInsertSchema(recurringTaskTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastGeneratedDate: true,
  totalGenerated: true,
});

export const insertRecurringTaskInstanceSchema = createInsertSchema(recurringTaskInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Recurring Task Types
export type RecurringTaskTemplate = typeof recurringTaskTemplates.$inferSelect;
export type InsertRecurringTaskTemplate = z.infer<typeof insertRecurringTaskTemplateSchema>;
export type RecurringTaskInstance = typeof recurringTaskInstances.$inferSelect;
export type InsertRecurringTaskInstance = z.infer<typeof insertRecurringTaskInstanceSchema>;

// ============================================
// JOBS AND TASKS SCHEMA
// ============================================

// Job status enum
export const jobStatusEnum = pgEnum('job_status', ['open', 'in_progress', 'completed', 'cancelled']);

// Task status enum
export const taskStatusEnum = pgEnum('task_status', ['pending', 'in_progress', 'done', 'cancelled']);

// Task priority enum
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);

// Jobs - groups related tasks together
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').references(() => farms.id).notNull(),
  
  // Job details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: jobStatusEnum('status').default('open').notNull(),
  
  // Assignment and ownership
  createdById: uuid('created_by_id').references(() => users.id).notNull(),
  assignedToId: uuid('assigned_to_id').references(() => users.id),
  
  // Scheduling
  dueDate: timestamp('due_date'),
  startDate: timestamp('start_date'),
  completedAt: timestamp('completed_at'),
  
  // Categorization
  category: varchar('category', { length: 100 }),
  priority: taskPriorityEnum('priority').default('medium'),
  
  // Location (optional)
  location: varchar('location', { length: 255 }),
  pastureId: uuid('pasture_id').references(() => pastures.id),
  
  // Metadata
  notes: text('notes'),
  tags: jsonb('tags').$type<string[]>().default([]),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tasks - individual work items, can be standalone or part of a job
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').references(() => farms.id).notNull(),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }), // Optional: task can be standalone
  
  // Task details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: taskStatusEnum('status').default('pending').notNull(),
  priority: taskPriorityEnum('priority').default('medium'),
  
  // Assignment
  createdById: uuid('created_by_id').references(() => users.id).notNull(),
  assignedToId: uuid('assigned_to_id').references(() => users.id),
  
  // Scheduling
  dueDate: timestamp('due_date'),
  startDate: timestamp('start_date'),
  completedAt: timestamp('completed_at'),
  completedById: uuid('completed_by_id').references(() => users.id),
  
  // Time tracking
  estimatedMinutes: integer('estimated_minutes'),
  actualMinutes: integer('actual_minutes'),
  
  // Location (optional)
  location: varchar('location', { length: 255 }),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  pastureId: uuid('pasture_id').references(() => pastures.id),
  
  // Related entities (optional)
  animalId: uuid('animal_id').references(() => animals.id),
  equipmentId: uuid('equipment_id'),
  
  // Checklist items (sub-tasks)
  checklistItems: jsonb('checklist_items').$type<{ id: string; text: string; completed: boolean }[]>(),
  
  // Metadata
  notes: text('notes'),
  tags: jsonb('tags').$type<string[]>().default([]),
  attachments: jsonb('attachments').$type<{ name: string; url: string; type: string }[]>(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations for jobs
export const jobsRelations = relations(jobs, ({ one, many }) => ({
  farm: one(farms, {
    fields: [jobs.farmId],
    references: [farms.id],
  }),
  createdBy: one(users, {
    fields: [jobs.createdById],
    references: [users.id],
    relationName: 'jobCreatedBy',
  }),
  assignedTo: one(users, {
    fields: [jobs.assignedToId],
    references: [users.id],
    relationName: 'jobAssignedTo',
  }),
  pasture: one(pastures, {
    fields: [jobs.pastureId],
    references: [pastures.id],
  }),
  tasks: many(tasks),
}));

// Relations for tasks
export const tasksRelations = relations(tasks, ({ one }) => ({
  farm: one(farms, {
    fields: [tasks.farmId],
    references: [farms.id],
  }),
  job: one(jobs, {
    fields: [tasks.jobId],
    references: [jobs.id],
  }),
  createdBy: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
    relationName: 'taskCreatedBy',
  }),
  assignedTo: one(users, {
    fields: [tasks.assignedToId],
    references: [users.id],
    relationName: 'taskAssignedTo',
  }),
  completedBy: one(users, {
    fields: [tasks.completedById],
    references: [users.id],
    relationName: 'taskCompletedBy',
  }),
  pasture: one(pastures, {
    fields: [tasks.pastureId],
    references: [pastures.id],
  }),
  animal: one(animals, {
    fields: [tasks.animalId],
    references: [animals.id],
  }),
}));

// Validation schemas for jobs
export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateJobSchema = insertJobSchema.partial();

// Validation schemas for tasks
export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTaskSchema = insertTaskSchema.partial();

// Job and Task Types
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

// Equipment/Device tracking for farm assets
export const equipmentStatusEnum = pgEnum('equipment_status', ['operational', 'maintenance_due', 'in_maintenance', 'out_of_service']);

export const equipment = pgTable('equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(), // e.g., "Tractor", "Milk Pump", "Drone", "Irrigation System"
  model: varchar('model', { length: 100 }), // Model number or identifier
  serialNumber: varchar('serial_number', { length: 100 }).unique(),
  manufacturer: varchar('manufacturer', { length: 100 }),
  yearManufactured: integer('year_manufactured'),
  purchaseDate: date('purchase_date'),
  purchasePrice: numeric('purchase_price', { precision: 10, scale: 2 }),
  location: varchar('location', { length: 255 }), // Current location of equipment
  status: equipmentStatusEnum('status').default('operational').notNull(),
  lastServiceDate: date('last_service_date'),
  nextServiceDue: date('next_service_due'),
  serviceIntervalDays: integer('service_interval_days'), // Days between services
  warrantyExpiry: date('warranty_expiry'),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Equipment Service History
export const equipmentServiceHistory = pgTable('equipment_service_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  equipmentId: uuid('equipment_id').references(() => equipment.id, { onDelete: 'cascade' }).notNull(),
  serviceDate: date('service_date').notNull(),
  serviceType: varchar('service_type', { length: 100 }).notNull(), // e.g., "Routine Maintenance", "Repair", "Inspection"
  description: text('description'),
  cost: numeric('cost', { precision: 10, scale: 2 }),
  performedBy: varchar('performed_by', { length: 255 }), // Who performed the service
  nextServiceDue: date('next_service_due'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// IoT Device types and status
export const deviceTypeEnum = pgEnum('device_type', [
  'temperature_sensor',
  'humidity_sensor',
  'gps_tracker',
  'water_level_sensor',
  'milk_meter',
  'weight_scale',
  'camera',
  'weather_station',
  'soil_sensor',
  'fence_monitor',
  'tank_level_sensor',
  'other'
]);

export const deviceStatusEnum = pgEnum('device_status', ['online', 'offline', 'error', 'maintenance']);

// IoT Devices for farm monitoring
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').notNull(),
  equipmentId: uuid('equipment_id').references(() => equipment.id, { onDelete: 'set null' }), // Optional link to equipment
  
  // Device identification
  name: varchar('name', { length: 255 }).notNull(),
  type: deviceTypeEnum('type').notNull(),
  serialNumber: varchar('serial_number', { length: 100 }).unique(),
  manufacturer: varchar('manufacturer', { length: 100 }),
  model: varchar('model', { length: 100 }),
  firmwareVersion: varchar('firmware_version', { length: 50 }),
  
  // Status and connectivity
  status: deviceStatusEnum('status').default('offline').notNull(),
  lastSeenAt: timestamp('last_seen_at'),
  ipAddress: varchar('ip_address', { length: 45 }), // IPv4 or IPv6
  macAddress: varchar('mac_address', { length: 17 }),
  
  // Location
  location: varchar('location', { length: 255 }), // Description of where device is installed
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  
  // Configuration and data
  config: jsonb('config').$type<Record<string, any>>(), // Device-specific configuration
  lastData: jsonb('last_data').$type<Record<string, any>>(), // Last reported sensor data
  
  // Alerts and thresholds
  alertThresholds: jsonb('alert_thresholds').$type<{
    min?: number;
    max?: number;
    unit?: string;
    alertOnOffline?: boolean;
  }>(),
  
  // Metadata
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  installedAt: timestamp('installed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Device Data Logs - Historical sensor readings
export const deviceDataLogs = pgTable('device_data_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }).notNull(),
  
  // Reading data
  timestamp: timestamp('timestamp').notNull(),
  data: jsonb('data').$type<Record<string, any>>().notNull(), // Sensor readings
  
  // Optional parsed values for common metrics
  temperature: numeric('temperature', { precision: 5, scale: 2 }),
  humidity: numeric('humidity', { precision: 5, scale: 2 }),
  batteryLevel: integer('battery_level'), // Percentage 0-100
  signalStrength: integer('signal_strength'), // RSSI or percentage
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations for Equipment and Devices
export const equipmentRelations = relations(equipment, ({ many }) => ({
  serviceHistory: many(equipmentServiceHistory),
  devices: many(devices),
}));

export const equipmentServiceHistoryRelations = relations(equipmentServiceHistory, ({ one }) => ({
  equipment: one(equipment, {
    fields: [equipmentServiceHistory.equipmentId],
    references: [equipment.id],
  }),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  equipment: one(equipment, {
    fields: [devices.equipmentId],
    references: [equipment.id],
  }),
  dataLogs: many(deviceDataLogs),
}));

export const deviceDataLogsRelations = relations(deviceDataLogs, ({ one }) => ({
  device: one(devices, {
    fields: [deviceDataLogs.deviceId],
    references: [devices.id],
  }),
}));

// Validation schemas for Equipment and Devices
export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEquipmentServiceHistorySchema = createInsertSchema(equipmentServiceHistory).omit({
  id: true,
  createdAt: true,
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeviceDataLogSchema = createInsertSchema(deviceDataLogs).omit({
  id: true,
  createdAt: true,
});

// Types for Equipment and Devices
export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type EquipmentServiceHistory = typeof equipmentServiceHistory.$inferSelect;
export type InsertEquipmentServiceHistory = z.infer<typeof insertEquipmentServiceHistorySchema>;
export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type DeviceDataLog = typeof deviceDataLogs.$inferSelect;
export type InsertDeviceDataLog = z.infer<typeof insertDeviceDataLogSchema>;

// ===== FINANCIAL TABLES =====

// Transaction type enum
export const transactionTypeEnum = pgEnum('transaction_type', ['revenue', 'expense']);

// Financial Transactions - Core table for all financial records
export const financialTransactions = pgTable('financial_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id'), // For multi-farm support
  
  // Transaction details
  type: transactionTypeEnum('type').notNull(),
  category: varchar('category', { length: 100 }).notNull(), // e.g., 'milk_revenue', 'feed', 'labour'
  subcategory: varchar('subcategory', { length: 100 }), // e.g., 'hay', 'grain', 'permanent_staff'
  description: text('description'),
  
  // Financial data
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  gstAmount: numeric('gst_amount', { precision: 12, scale: 2 }).default('0'),
  netAmount: numeric('net_amount', { precision: 12, scale: 2 }),
  
  // Date and period
  transactionDate: date('transaction_date').notNull(),
  financialYear: varchar('financial_year', { length: 10 }), // e.g., '2024-25'
  financialMonth: integer('financial_month'), // 1-12
  
  // Reference data
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  supplier: varchar('supplier', { length: 255 }),
  customer: varchar('customer', { length: 255 }),
  
  // Linked entities
  animalId: uuid('animal_id').references(() => animals.id),
  pastureId: uuid('pasture_id').references(() => pastures.id),
  
  // Payment details
  paymentMethod: varchar('payment_method', { length: 50 }), // cash, bank, credit
  paymentStatus: varchar('payment_status', { length: 20 }).default('paid'), // paid, pending, overdue
  
  // Metadata
  notes: text('notes'),
  tags: jsonb('tags').$type<string[]>(),
  attachments: jsonb('attachments').$type<string[]>(),
  
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Milk production records (for revenue tracking)
export const milkProduction = pgTable('milk_production', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id'),
  
  // Production date
  productionDate: date('production_date').notNull(),
  
  // Volume data
  totalLitres: numeric('total_litres', { precision: 10, scale: 2 }).notNull(),
  fatPercent: numeric('fat_percent', { precision: 4, scale: 2 }),
  proteinPercent: numeric('protein_percent', { precision: 4, scale: 2 }),
  milkSolidsKg: numeric('milk_solids_kg', { precision: 10, scale: 2 }),
  
  // Quality
  somaticCellCount: integer('somatic_cell_count'),
  bacteriaCount: integer('bacteria_count'),
  temperature: numeric('temperature', { precision: 4, scale: 1 }),
  
  // Pricing
  pricePerKgMs: numeric('price_per_kg_ms', { precision: 6, scale: 2 }),
  totalValue: numeric('total_value', { precision: 12, scale: 2 }),
  
  // Collection details
  collectionTime: varchar('collection_time', { length: 5 }),
  vatNumber: varchar('vat_number', { length: 20 }),
  docketNumber: varchar('docket_number', { length: 50 }),
  
  // Herd info
  cowsMilked: integer('cows_milked'),
  
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Scheduled reports configuration
export const scheduledReports = pgTable('scheduled_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id'),
  
  // Report details
  name: varchar('name', { length: 255 }).notNull(),
  reportType: varchar('report_type', { length: 100 }).notNull(),
  
  // Schedule
  frequency: varchar('frequency', { length: 20 }).notNull(), // daily, weekly, monthly, quarterly, annually
  cronExpression: varchar('cron_expression', { length: 100 }),
  nextRunAt: timestamp('next_run_at'),
  lastRunAt: timestamp('last_run_at'),
  
  // Delivery
  recipients: jsonb('recipients').$type<string[]>().notNull(),
  format: varchar('format', { length: 20 }).notNull().default('PDF'), // PDF, Excel, Both
  
  // Configuration
  reportConfig: jsonb('report_config').$type<{
    dateRange?: string;
    sections?: string[];
    filters?: Record<string, any>;
  }>(),
  
  // Status
  enabled: boolean('enabled').default(true),
  lastStatus: varchar('last_status', { length: 20 }), // success, failed
  lastError: text('last_error'),
  
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Report generation history
export const reportHistory = pgTable('report_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id'),
  scheduledReportId: uuid('scheduled_report_id').references(() => scheduledReports.id),
  
  // Report details
  reportType: varchar('report_type', { length: 100 }).notNull(),
  reportName: varchar('report_name', { length: 255 }).notNull(),
  format: varchar('format', { length: 20 }).notNull(),
  
  // Generation details
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
  generatedBy: uuid('generated_by').references(() => users.id),
  
  // File storage
  fileUrl: varchar('file_url', { length: 500 }),
  fileSize: integer('file_size'), // bytes
  
  // Delivery status
  deliveryStatus: varchar('delivery_status', { length: 20 }), // sent, failed, pending
  deliveredTo: jsonb('delivered_to').$type<string[]>(),
  deliveredAt: timestamp('delivered_at'),
  
  // Error tracking
  errorMessage: text('error_message'),
});

// Financial validation schemas
export const insertFinancialTransactionSchema = createInsertSchema(financialTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMilkProductionSchema = createInsertSchema(milkProduction).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduledReportSchema = createInsertSchema(scheduledReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Financial Types
export type FinancialTransaction = typeof financialTransactions.$inferSelect;
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;
export type MilkProduction = typeof milkProduction.$inferSelect;
export type InsertMilkProduction = z.infer<typeof insertMilkProductionSchema>;
export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type InsertScheduledReport = z.infer<typeof insertScheduledReportSchema>;
