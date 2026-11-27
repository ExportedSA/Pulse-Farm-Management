// Tables for running Pulse as a service: invites, password resets, billing and shed hardware.
// Kept apart from schema.ts; the SQL is in scripts/migrations (0030 onwards).
import { pgTable, uuid, varchar, timestamp, integer, boolean, text, jsonb, date, primaryKey } from 'drizzle-orm/pg-core';
import { farms, users, userRoleEnum, animals, animalGroups } from './schema';

// An emailed invite to join a farm with a role. Only a hash of the link's secret is kept.
export const farmInvitations = pgTable('farm_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').references(() => farms.id).notNull(),
  email: varchar('email', { length: 255 }).notNull(), // lower-case
  role: userRoleEnum('role').default('worker').notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  invitedBy: uuid('invited_by').references(() => users.id),
  expiresAt: timestamp('expires_at').notNull(),
  lastSentAt: timestamp('last_sent_at').defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at'),
  acceptedBy: uuid('accepted_by').references(() => users.id),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type FarmInvitation = typeof farmInvitations.$inferSelect;

// A one-time password reset link. Only a hash of the link's secret is kept.
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// A farm's subscription (migration 0031): its free trial, then its Stripe subscription
export const farmBilling = pgTable('farm_billing', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').references(() => farms.id).notNull().unique(),
  trialEndsAt: timestamp('trial_ends_at').notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 100 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 100 }),
  subscriptionStatus: varchar('subscription_status', { length: 30 }),
  currentPeriodEnd: timestamp('current_period_end'),
  onboardingFeeBand: varchar('onboarding_fee_band', { length: 10 }),
  onboardingFeePaidAt: timestamp('onboarding_fee_paid_at'),
  billedCows: integer('billed_cows'),
  billedCowsAt: timestamp('billed_cows_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type FarmBilling = typeof farmBilling.$inferSelect;

// A farm's shed hardware (migration 0038). Added by whoever runs the service, never from the app:
// base_url is an address the server calls. NULL base_url = the server's PULSE_GATEWAY_URL.
export const hardwareGateways = pgTable('hardware_gateways', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').references(() => farms.id).notNull(),
  name: varchar('name', { length: 100 }).default('Shed').notNull(),
  baseUrl: text('base_url'),
  simulated: boolean('simulated').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // 'http': Pulse calls base_url. 'stride': Stride connects in with a link token (migration 0039)
  kind: varchar('kind', { length: 10 }).default('http').notNull(),
  linkTokenHash: varchar('link_token_hash', { length: 64 }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
});

export type HardwareGateway = typeof hardwareGateways.$inferSelect;

// Where Stride sends a cow at the gate (migration 0039; docs/shed-link-protocol.md)
export const shedDraftRules = pgTable('shed_draft_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').references(() => farms.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  lane: varchar('lane', { length: 10 }).notNull(), // LEFT, RIGHT, STRAIGHT
  priority: integer('priority').default(0).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  // milk_withholding, dose_due, in_group, heat, cow_numbers
  conditionType: varchar('condition_type', { length: 30 }).notNull(),
  groupId: uuid('group_id').references(() => animalGroups.id, { onDelete: 'cascade' }),
  withinHours: integer('within_hours'),
  cowNumbers: text('cow_numbers').array(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ShedDraftRule = typeof shedDraftRules.$inferSelect;

// Grams of in-shed feed per bail visit, for one animal or one group (migration 0039)
export const shedFeedLevels = pgTable('shed_feed_levels', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').references(() => farms.id).notNull(),
  animalId: uuid('animal_id').references(() => animals.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').references(() => animalGroups.id, { onDelete: 'cascade' }),
  gramsPerVisit: integer('grams_per_visit').notNull(),
  priority: integer('priority').default(0).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  validFrom: date('valid_from'),
  validTo: date('valid_to'),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ShedFeedLevel = typeof shedFeedLevels.$inferSelect;

// What Stride reports from the shed: EID reads, drafts and feeds, once per Stride event id (migration 0039)
export const shedEvents = pgTable('shed_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').references(() => farms.id).notNull(),
  gatewayId: uuid('gateway_id').references(() => hardwareGateways.id).notNull(),
  clientId: varchar('client_id', { length: 64 }).notNull(),
  kind: varchar('kind', { length: 10 }).notNull(), // eid, draft, feed
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  eid: varchar('eid', { length: 50 }),
  animalId: uuid('animal_id').references(() => animals.id, { onDelete: 'set null' }),
  reader: varchar('reader', { length: 20 }),
  lane: varchar('lane', { length: 10 }),
  source: varchar('source', { length: 10 }),
  reason: text('reason'),
  bail: integer('bail'),
  targetGrams: integer('target_grams'),
  actualGrams: integer('actual_grams'),
});

export type ShedEvent = typeof shedEvents.$inferSelect;

// Every feed or gate command sent to a farm's shed hardware, and whether it worked (migration 0038)
export const hardwareCommands = pgTable('hardware_commands', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').references(() => farms.id).notNull(),
  gatewayId: uuid('gateway_id').references(() => hardwareGateways.id).notNull(),
  userId: uuid('user_id').references(() => users.id),
  command: varchar('command', { length: 30 }).notNull(),
  params: jsonb('params').default({}).notNull(),
  ok: boolean('ok').notNull(),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Who created, changed, deleted, exported or opened what, and when (migration 0040; build guide F3).
// Only the names of changed fields are kept, never their values.
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').references(() => farms.id).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 10 }).notNull(), // create, update, delete, view, export
  recordType: varchar('record_type', { length: 60 }).notNull(),
  recordId: varchar('record_id', { length: 64 }),
  method: varchar('method', { length: 10 }),
  path: varchar('path', { length: 300 }),
  status: integer('status'),
  details: jsonb('details').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AuditEvent = typeof auditEvents.$inferSelect;

// One save per request id, for the offline queue (migration 0041; build guide F4). Written only by
// server/middleware/request-receipts.ts, which keeps the first answer to give back to a repeat.
export const requestReceipts = pgTable('request_receipts', {
  farmId: uuid('farm_id').references(() => farms.id, { onDelete: 'cascade' }).notNull(),
  requestKey: varchar('request_key', { length: 100 }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  method: varchar('method', { length: 10 }).notNull(),
  path: varchar('path', { length: 300 }).notNull(),
  state: varchar('state', { length: 10 }).default('pending').notNull(), // pending, done
  status: integer('status'),
  body: jsonb('body'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, t => ({ pk: primaryKey({ columns: [t.farmId, t.requestKey] }) }));
