// The shed link's Pulse side (docs/shed-link-protocol.md): what Stride is told, and what it reports.
//
// compileSnapshot works out, from the farm's own records, which cows a Pulse draft rule sends to which
// lane and how many grams each is fed per bail visit. Nothing here supplies an amount or a rule of its
// own: every lane and gram comes from a rule or level the farm entered. storeEvents keeps what Stride
// reports, once per Stride event id.
import crypto from 'crypto';
import { z } from 'zod';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { db, systemDb, withFarmDb } from '../db';
import { animals, animalGroups, animalGroupMembers, animalTreatments, reproductionEvents, farms } from '@shared/schema';
import { hardwareGateways, shedDraftRules, shedEvents, shedFeedLevels } from '@shared/platform-schema';
import { hashSecret } from './accounts';
import { evaluateAnimalAgainstCriteria } from '../routes/groups';

export const LANES = ['LEFT', 'RIGHT', 'STRAIGHT'] as const;
export const CONDITIONS = ['milk_withholding', 'dose_due', 'in_group', 'heat', 'cow_numbers'] as const;
export type Lane = (typeof LANES)[number];

export type ShedSnapshot = {
  type: 'snapshot';
  version: string;
  generatedAt: string;
  herd: { eid: string; cowNumber: string | null; animalId: string; groups: string[] }[];
  draft: { eid: string; lane: Lane; reason: string; ruleId: string }[];
  feed: { eid: string; gramsPerVisit: number; reason: string }[];
};

export class ShedError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// ── Link tokens ──

/** A new link token for a Stride gateway: shown once, only its hash is kept */
export function newLinkToken(): { token: string; hash: string } {
  const token = `pst_${crypto.randomBytes(32).toString('base64url')}`;
  return { token, hash: hashSecret(token) };
}

/** The gateway a link token belongs to, before any farm is known (so as the database owner) */
export async function gatewayForToken(token: string) {
  if (!token || token.length > 200) return null;
  const [gateway] = await systemDb
    .select({ id: hardwareGateways.id, farmId: hardwareGateways.farmId, kind: hardwareGateways.kind, isActive: hardwareGateways.isActive })
    .from(hardwareGateways)
    .where(eq(hardwareGateways.linkTokenHash, hashSecret(token)))
    .limit(1);
  return gateway ?? null;
}

export async function markSeen(gatewayId: string) {
  await systemDb.update(hardwareGateways).set({ lastSeenAt: new Date() }).where(eq(hardwareGateways.id, gatewayId));
}

export async function farmName(farmId: string): Promise<string> {
  const [farm] = await systemDb.select({ name: farms.name }).from(farms).where(eq(farms.id, farmId)).limit(1);
  return farm?.name ?? '';
}

// ── The snapshot ──

function farmDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(d); // YYYY-MM-DD
}

function farmTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(d);
}

/** For a farm, from outside a request (the link) */
export function compileSnapshot(farmId: string, now = new Date()): Promise<ShedSnapshot> {
  return withFarmDb(farmId, () => compileSnapshotHere(now));
}

/** Inside a farm's request or withFarmDb: the farm's row-level security limits every query */
export async function compileSnapshotHere(now = new Date()): Promise<ShedSnapshot> {
  const [farm] = await db.select({ timezone: farms.timezone }).from(farms)
    .where(sql`${farms.id} = NULLIF(current_setting('app.farm_id', true), '')::uuid`).limit(1);
  const timeZone = farm?.timezone || 'Pacific/Auckland';
  const today = farmDate(now, timeZone);

  const herdRows = await db.select().from(animals).where(eq(animals.status, 'active'));
  const groups = await db.select({ id: animalGroups.id, name: animalGroups.name, groupType: animalGroups.groupType, criteria: animalGroups.criteria })
    .from(animalGroups)
    .where(isNull(animalGroups.deletedAt)); // a removed group or mob no longer drafts or feeds anyone
  const members = await db.select({ groupId: animalGroupMembers.groupId, animalId: animalGroupMembers.animalId })
    .from(animalGroupMembers);

  // Group membership: listed members, plus the animals a dynamic group's criteria select
  const groupsOf = new Map<string, Set<string>>(); // animal id -> group ids
  const add = (animalId: string, groupId: string) => {
    if (!groupsOf.has(animalId)) groupsOf.set(animalId, new Set());
    groupsOf.get(animalId)!.add(groupId);
  };
  const liveGroups = new Set(groups.map(g => g.id));
  for (const m of members) if (liveGroups.has(m.groupId)) add(m.animalId, m.groupId);
  for (const g of groups) {
    if (g.groupType !== 'dynamic' || !g.criteria) continue;
    for (const a of herdRows) {
      try {
        if (evaluateAnimalAgainstCriteria(a, g.criteria as any)) add(a.id, g.id);
      } catch {
        // a malformed criteria list selects nobody
      }
    }
  }
  const groupName = new Map(groups.map(g => [g.id, g.name]));

  const withEid = herdRows.filter(a => a.eid && a.eid.trim());
  const herd = withEid.map(a => ({
    eid: a.eid!.trim(),
    cowNumber: a.visualId || a.cowId || null,
    animalId: a.id,
    groups: Array.from(groupsOf.get(a.id) ?? new Set<string>()).map(id => groupName.get(id) ?? '').filter(Boolean).sort(),
  }));

  // ── Draft rules, highest priority first ──
  const rules = await db.select().from(shedDraftRules)
    .where(eq(shedDraftRules.enabled, true))
    .orderBy(desc(shedDraftRules.priority), asc(shedDraftRules.createdAt));

  // Only what the rules in use need
  const types = new Set(rules.map(r => r.conditionType));
  const milkReason = new Map<string, string>();
  if (types.has('milk_withholding')) {
    const rows = await db.select({ animalId: animalTreatments.animalId, milkClearAt: animalTreatments.milkClearAt })
      .from(animalTreatments)
      .where(and(
        sql`${animalTreatments.deletedAt} IS NULL`,
        eq(animalTreatments.status, 'active'),
        sql`coalesce(${animalTreatments.awaitingTreatment}, false) = false`,
        sql`${animalTreatments.returnedToVatAt} IS NULL`,
        sql`(${animalTreatments.milkClearAt} IS NULL OR ${animalTreatments.milkClearAt} > ${now})`,
        sql`coalesce(${animalTreatments.milkWithholdingHours}, 0) > 0`,
        isNotNull(animalTreatments.animalId),
      ));
    // A cow with several treatments is withheld until the latest clear time; a treatment with doses
    // still to give (no clear time yet) outlasts them all
    const latest = new Map<string, Date | null>();
    for (const r of rows) {
      const id = r.animalId!;
      const clear = r.milkClearAt ? new Date(r.milkClearAt) : null;
      if (!latest.has(id)) latest.set(id, clear);
      else {
        const prev = latest.get(id)!;
        if (prev !== null && (clear === null || clear > prev)) latest.set(id, clear);
      }
    }
    for (const [id, clear] of Array.from(latest.entries())) {
      milkReason.set(id, clear ? `Milk withholding until ${farmTime(clear, timeZone)}` : 'Milk withholding (doses still to give)');
    }
  }

  const maxHours = Math.max(0, ...rules.filter(r => r.conditionType === 'dose_due').map(r => r.withinHours ?? 0));
  const dosesDue: { animalId: string; due: Date }[] = [];
  if (maxHours > 0) {
    const rows = await db.select({ animalId: animalTreatments.animalId, due: animalTreatments.nextDoseDueAt })
      .from(animalTreatments)
      .where(and(
        sql`${animalTreatments.deletedAt} IS NULL`,
        eq(animalTreatments.status, 'active'),
        isNotNull(animalTreatments.animalId),
        isNotNull(animalTreatments.nextDoseDueAt),
        lte(animalTreatments.nextDoseDueAt, new Date(now.getTime() + maxHours * 3600_000)),
        sql`coalesce(${animalTreatments.dosesGiven}, 0) < coalesce(${animalTreatments.totalDoses}, 1)`,
      ));
    for (const r of rows) dosesDue.push({ animalId: r.animalId!, due: new Date(r.due!) });
  }

  const heatHours = Math.max(0, ...rules.filter(r => r.conditionType === 'heat').map(r => r.withinHours ?? 0));
  const heats: { animalId: string; date: string }[] = [];
  if (heatHours > 0) {
    // Heats are recorded by date, so "within N hours" counts whole farm days back from today
    const from = farmDate(new Date(now.getTime() - heatHours * 3600_000), timeZone);
    const rows = await db.select({ animalId: reproductionEvents.animalId, date: reproductionEvents.eventDate })
      .from(reproductionEvents)
      .where(and(eq(reproductionEvents.eventType, 'heat'), gte(reproductionEvents.eventDate, from), lte(reproductionEvents.eventDate, today)));
    heats.push(...rows);
  }

  const draft: ShedSnapshot['draft'] = [];
  for (const cow of herd) {
    for (const rule of rules) {
      let reason: string | null = null;
      switch (rule.conditionType) {
        case 'milk_withholding':
          reason = milkReason.get(cow.animalId) ?? null;
          break;
        case 'dose_due': {
          const limit = now.getTime() + (rule.withinHours ?? 0) * 3600_000;
          const due = dosesDue.filter(d => d.animalId === cow.animalId && d.due.getTime() <= limit)
            .sort((a, b) => a.due.getTime() - b.due.getTime())[0];
          if (due) reason = due.due.getTime() <= now.getTime() ? 'Dose overdue' : `Dose due ${farmTime(due.due, timeZone)}`;
          break;
        }
        case 'in_group':
          if (rule.groupId && groupsOf.get(cow.animalId)?.has(rule.groupId)) reason = `In ${groupName.get(rule.groupId) ?? 'group'}`;
          break;
        case 'heat': {
          const from = farmDate(new Date(now.getTime() - (rule.withinHours ?? 0) * 3600_000), timeZone);
          const heat = heats.filter(h => h.animalId === cow.animalId && h.date >= from).sort((a, b) => b.date.localeCompare(a.date))[0];
          if (heat) reason = `Heat recorded ${heat.date}`;
          break;
        }
        case 'cow_numbers':
          if (cow.cowNumber && (rule.cowNumbers ?? []).some(n => n.trim().toLowerCase() === cow.cowNumber!.trim().toLowerCase())) {
            reason = 'On the list';
          }
          break;
      }
      if (reason) {
        draft.push({ eid: cow.eid, lane: rule.lane as Lane, reason: `${rule.name}: ${reason}`, ruleId: rule.id });
        break; // the first matching rule decides
      }
    }
  }

  // ── Feed levels in force today: the animal's own beats a group's; then highest priority ──
  const levels = await db.select().from(shedFeedLevels)
    .where(and(
      eq(shedFeedLevels.enabled, true),
      sql`(${shedFeedLevels.validFrom} IS NULL OR ${shedFeedLevels.validFrom} <= ${today})`,
      sql`(${shedFeedLevels.validTo} IS NULL OR ${shedFeedLevels.validTo} >= ${today})`,
    ))
    .orderBy(desc(shedFeedLevels.priority), desc(shedFeedLevels.createdAt));
  const feed: ShedSnapshot['feed'] = [];
  for (const cow of herd) {
    const own = levels.find(l => l.animalId === cow.animalId);
    const group = own ? undefined : levels.find(l => l.groupId && groupsOf.get(cow.animalId)?.has(l.groupId));
    const level = own ?? group;
    if (!level) continue;
    feed.push({
      eid: cow.eid,
      gramsPerVisit: level.gramsPerVisit,
      reason: own ? 'Her own level' : `${groupName.get(level.groupId!) ?? 'Group'} level`,
    });
  }

  const content = { herd, draft, feed };
  const version = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 16);
  return { type: 'snapshot', version, generatedAt: now.toISOString(), ...content };
}

// ── Draft rules and feed levels (set in Pulse) ──

const uuid = z.string().uuid();

export const draftRuleInput = z.object({
  name: z.string().trim().min(1).max(100),
  lane: z.enum(LANES),
  priority: z.number().int().min(-1000).max(1000).default(0),
  enabled: z.boolean().default(true),
  conditionType: z.enum(CONDITIONS),
  groupId: uuid.nullable().optional(),
  withinHours: z.number().int().min(1).max(720).nullable().optional(),
  cowNumbers: z.array(z.string().trim().min(1).max(50)).max(2000).nullable().optional(),
}).superRefine((r, ctx) => {
  if (r.conditionType === 'in_group' && !r.groupId) ctx.addIssue({ code: 'custom', message: 'Choose the group or mob' });
  if ((r.conditionType === 'dose_due' || r.conditionType === 'heat') && !r.withinHours) {
    ctx.addIssue({ code: 'custom', message: 'Say how many hours' });
  }
  if (r.conditionType === 'cow_numbers' && !(r.cowNumbers ?? []).length) ctx.addIssue({ code: 'custom', message: 'List at least one cow number' });
});

/** Keep only the fields the condition uses */
export function draftRuleValues(input: z.infer<typeof draftRuleInput>) {
  return {
    name: input.name,
    lane: input.lane,
    priority: input.priority,
    enabled: input.enabled,
    conditionType: input.conditionType,
    groupId: input.conditionType === 'in_group' ? input.groupId ?? null : null,
    withinHours: input.conditionType === 'dose_due' || input.conditionType === 'heat' ? input.withinHours ?? null : null,
    cowNumbers: input.conditionType === 'cow_numbers' ? input.cowNumbers ?? null : null,
  };
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const feedLevelInput = z.object({
  animalId: uuid.nullable().optional(),
  groupId: uuid.nullable().optional(),
  gramsPerVisit: z.number().int().min(1).max(20000),
  priority: z.number().int().min(-1000).max(1000).default(0),
  enabled: z.boolean().default(true),
  validFrom: day.nullable().optional(),
  validTo: day.nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
}).superRefine((l, ctx) => {
  if (!l.animalId === !l.groupId) ctx.addIssue({ code: 'custom', message: 'Choose one animal or one group' });
  if (l.validFrom && l.validTo && l.validTo < l.validFrom) ctx.addIssue({ code: 'custom', message: 'The end date is before the start date' });
});

// ── Events from Stride ──

const eventInput = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(['eid', 'draft', 'feed']),
  at: z.string().datetime({ offset: true }),
  eid: z.string().trim().max(50).nullable().optional(),
  reader: z.string().trim().max(20).nullable().optional(),
  lane: z.enum(LANES).nullable().optional(),
  source: z.enum(['pulse', 'local', 'default', 'manual', 'remote']).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
  bail: z.number().int().min(1).max(99).nullable().optional(),
  targetGrams: z.number().int().min(0).max(100000).nullable().optional(),
  actualGrams: z.number().int().min(0).max(100000).nullable().optional(),
});

export const MAX_EVENTS_PER_MESSAGE = 200;

/**
 * Keeps a batch of Stride's events for its farm, each id once. Returns every id it can acknowledge:
 * the stored ones, ones it already had, and malformed ones (which would otherwise be resent forever).
 */
export async function storeEvents(farmId: string, gatewayId: string, raw: unknown[]): Promise<{ acked: string[]; rejected: number }> {
  const acked: string[] = [];
  const valid: z.infer<typeof eventInput>[] = [];
  let rejected = 0;
  for (const item of raw.slice(0, MAX_EVENTS_PER_MESSAGE)) {
    const parsed = eventInput.safeParse(item);
    if (parsed.success) valid.push(parsed.data);
    else {
      rejected++;
      const id = (item as any)?.id;
      if (typeof id === 'string' && id.length <= 64) acked.push(id);
    }
  }
  if (!valid.length) return { acked, rejected };

  await withFarmDb(farmId, async () => {
    const eids = Array.from(new Set(valid.map(e => e.eid?.trim()).filter((e): e is string => !!e)));
    const byEid = new Map<string, string>();
    if (eids.length) {
      const rows = await db.select({ id: animals.id, eid: animals.eid }).from(animals).where(inArray(animals.eid, eids));
      for (const r of rows) if (r.eid) byEid.set(r.eid.trim(), r.id);
    }
    await db.insert(shedEvents).values(valid.map(e => ({
      farmId,
      gatewayId,
      clientId: e.id,
      kind: e.kind,
      occurredAt: new Date(e.at),
      eid: e.eid?.trim() || null,
      animalId: e.eid ? byEid.get(e.eid.trim()) ?? null : null,
      reader: e.reader ?? null,
      lane: e.lane ?? null,
      source: e.source ?? null,
      reason: e.reason ?? null,
      bail: e.bail ?? null,
      targetGrams: e.targetGrams ?? null,
      actualGrams: e.actualGrams ?? null,
    }))).onConflictDoNothing({ target: [shedEvents.gatewayId, shedEvents.clientId] });
  });
  acked.push(...valid.map(e => e.id));
  return { acked, rejected };
}
