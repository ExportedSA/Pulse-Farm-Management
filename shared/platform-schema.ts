// Tables for running Pulse as a service: invites, password resets, billing and shed hardware.
// Kept apart from schema.ts; the SQL is in scripts/migrations (0030 onwards).
import { pgTable, uuid, varchar, timestamp, integer, boolean, text, jsonb } from 'drizzle-orm/pg-core';
import { farms, users, userRoleEnum } from './schema';

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
});

export type HardwareGateway = typeof hardwareGateways.$inferSelect;

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
