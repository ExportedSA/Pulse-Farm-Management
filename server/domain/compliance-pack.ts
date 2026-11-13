import { db } from '../db';
import {
  farms, farmRecords, pastures, attachments, animals, animalTreatments, products, farmHazards, safetyIncidents,
  stockTransactions, type FarmRecord,
} from '@shared/schema';
import { and, asc, eq, gte, inArray, isNull, lt, ne, notInArray } from 'drizzle-orm';
import { MONTHLY_CHECK_ITEMS, SEASON_MONTHS } from '@shared/dairy-diary';
import { seasonRange, seasonSummary } from './season';
import { ASD_TYPES, STOCK_MOVEMENT_LABELS, type StockMovementType } from '@shared/stock';

// What the Fonterra Dairy Diary, the Farm Dairy Records return and the regional council expect
// to see, checked against the farm's records, plus the audit pack those records print as.

const DAY_MS = 24 * 60 * 60 * 1000;

export type RequirementStatus = 'ok' | 'attention' | 'missing';

// How the app can help fix an issue: open a new record (prefilled), open an existing one, or go to a page
export type Fix =
  | { kind: 'new'; recordType: string; details?: Record<string, unknown>; title?: string }
  | { kind: 'edit'; recordId: string }
  | { kind: 'link'; href: string; label: string };

export interface Issue { title: string; problem: string; fix?: Fix }

export interface Requirement {
  key: string;
  title: string;
  why: string;
  status: RequirementStatus;
  summary: string;
  issues: Issue[];
  packSection?: string;
}

const has = (v: unknown) => v !== undefined && v !== null && v !== '';
const num = (v: unknown): number | undefined => (has(v) && Number.isFinite(Number(v)) ? Number(v) : undefined);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Fields an auditor needs on a record that this one doesn't have
 */
export function missingFields(record: Pick<FarmRecord, 'type' | 'details' | 'pastureIds' | 'area'>, hasPhoto = false): string[] {
  const d = record.details ?? {};
  const located = record.pastureIds.length > 0 || record.area != null;
  const missing: string[] = [];
  switch (record.type) {
    case 'spray': {
      const mix: any[] = Array.isArray(d.products) ? d.products : has(d.product) ? [{ product: d.product, rate: d.rate }] : [];
      if (!has(d.operator)) missing.push('person applying');
      if (!has(d.reasonForUse)) missing.push('reason for use');
      if (mix.length === 0) missing.push('product');
      else if (mix.some(p => !has(p.rate))) missing.push('rate');
      if (!has(d.applicationMethod)) missing.push('application method');
      if (!has(d.withholdingDays)) missing.push('non-grazing period');
      if (!located) missing.push('paddock or area');
      break;
    }
    case 'fertiliser':
      if (!has(d.product)) missing.push('product');
      if (!has(d.rate) && !has(d.amountApplied)) missing.push('rate or amount');
      if (!has(d.applicationMethod)) missing.push('application method');
      if (!located) missing.push('paddock or area');
      break;
    case 'effluent':
      if (!has(d.depthMm) && !has(d.volumeM3)) missing.push('depth or volume');
      if (!located) missing.push('paddock or area');
      break;
    case 'feed_in':
      if (!has(d.supplier)) missing.push('supplier');
      if (!has(d.product)) missing.push('feed');
      if (!has(d.quantity)) missing.push('quantity');
      if (d.declaration !== 'On file') missing.push('feed declaration');
      if (!hasPhoto && !has(d.docketNumber)) missing.push('docket photo or number');
      break;
    case 'feed_out':
      if (!has(d.product)) missing.push('feed');
      if (!has(d.amount) && !has(d.hectaresGrazed)) missing.push('amount or area grazed');
      if (!has(d.source)) missing.push('source');
      if (!has(d.mob)) missing.push('mob');
      break;
    case 'baleage':
      if (!has(d.kind)) missing.push('what was made');
      if (!has(d.bales)) missing.push('bales');
      if (!located) missing.push('paddock or area');
      break;
    case 'monthly_check':
      if (!has(d.month)) missing.push('month');
      for (const item of MONTHLY_CHECK_ITEMS) if (!has(d[item.key])) missing.push(item.label.toLowerCase());
      break;
  }
  return missing;
}

// The season month a record is for: the month it names, else the month it happened
function checkMonth(record: FarmRecord): string {
  const named = record.details?.month;
  if (typeof named === 'string' && SEASON_MONTHS.includes(named)) return named;
  return SEASON_MONTHS[(record.occurredAt.getMonth() + 7) % 12];
}

// Months of the season that have finished, and the current one (if the season is under way)
function seasonMonthsSoFar(season: string, now = new Date()) {
  const { from, to } = seasonRange(season);
  if (now < from) return { finished: [] as string[], current: null as string | null };
  if (now >= to) return { finished: SEASON_MONTHS, current: null };
  const index = (now.getMonth() + 7) % 12;
  return { finished: SEASON_MONTHS.slice(0, index), current: SEASON_MONTHS[index] };
}

async function loadSeason(farmId: string, season: string) {
  const { from, to } = seasonRange(season);
  const [farm] = await db.select({ name: farms.name, settings: farms.settings }).from(farms).where(eq(farms.id, farmId));
  const paddocks = await db.select({ id: pastures.id, name: pastures.name }).from(pastures).where(eq(pastures.farmId, farmId));
  const records = await db
    .select()
    .from(farmRecords)
    .where(and(
      eq(farmRecords.farmId, farmId),
      isNull(farmRecords.deletedAt),
      gte(farmRecords.occurredAt, from),
      lt(farmRecords.occurredAt, to),
    ))
    .orderBy(asc(farmRecords.occurredAt));
  // Documents are kept until they expire, so they aren't limited to the season
  const documents = await db
    .select()
    .from(farmRecords)
    .where(and(eq(farmRecords.farmId, farmId), isNull(farmRecords.deletedAt), eq(farmRecords.type, 'document')))
    .orderBy(asc(farmRecords.occurredAt));
  const stock = await db
    .select()
    .from(stockTransactions)
    .where(and(
      eq(stockTransactions.farmId, farmId),
      isNull(stockTransactions.deletedAt),
      gte(stockTransactions.date, ymd(from)),
      lt(stockTransactions.date, ymd(to)),
    ))
    .orderBy(asc(stockTransactions.date));
  const ids = [...records.map(r => r.id), ...documents.map(d => d.id)];
  const photos = ids.length
    ? await db
      .select({ entityId: attachments.entityId })
      .from(attachments)
      .where(and(eq(attachments.farmId, farmId), eq(attachments.entityType, 'record'), inArray(attachments.entityId, ids)))
    : [];
  const treatments = await db
    .select({
      id: animalTreatments.id,
      dateTime: animalTreatments.dateTime,
      animal: animals.visualId,
      cowId: animalTreatments.cowId,
      condition: animalTreatments.condition,
      treatmentType: animalTreatments.treatmentType,
      product: products.name,
      doseAmount: animalTreatments.doseAmount,
      doseUnit: animalTreatments.doseUnit,
      withdrawalDays: animalTreatments.milkWithdrawalDays,
      productWithdrawalDays: products.milkWithdrawalDays,
      withdrawalEnd: animalTreatments.milkWithdrawalEndDate,
      staffMember: animalTreatments.staffMember,
    })
    .from(animalTreatments)
    .innerJoin(animals, eq(animals.id, animalTreatments.animalId))
    .leftJoin(products, eq(products.id, animalTreatments.productId))
    .where(and(
      eq(animals.farmId, farmId),
      gte(animalTreatments.dateTime, from.toISOString()),
      lt(animalTreatments.dateTime, to.toISOString()),
    ))
    .orderBy(asc(animalTreatments.dateTime));
  return {
    from, to, farm,
    paddockNames: new Map(paddocks.map(p => [p.id, p.name])),
    records,
    withPhoto: new Set(photos.map(p => p.entityId)),
    documents,
    treatments,
    stock,
  };
}

type SeasonData = Awaited<ReturnType<typeof loadSeason>>;

// Checks every record of the given types and reports each incomplete one
function recordsRequirement(
  data: SeasonData,
  types: string[],
  base: Omit<Requirement, 'status' | 'summary' | 'issues'>,
  noun: string,
  whenNone: { status: RequirementStatus; summary: string; fix?: Fix },
): Requirement {
  const records = data.records.filter(r => types.includes(r.type));
  if (records.length === 0) {
    return { ...base, status: whenNone.status, summary: whenNone.summary, issues: whenNone.fix && whenNone.status !== 'ok' ? [{ title: `No ${noun} yet`, problem: whenNone.summary, fix: whenNone.fix }] : [] };
  }
  const issues: Issue[] = [];
  for (const r of records) {
    const missing = missingFields(r, data.withPhoto.has(r.id));
    if (missing.length) {
      issues.push({ title: `${r.title} (${ymd(r.occurredAt)})`, problem: `Missing ${missing.join(', ')}`, fix: { kind: 'edit', recordId: r.id } });
    }
  }
  return {
    ...base,
    status: issues.length ? 'attention' : 'ok',
    summary: issues.length
      ? `${plural(issues.length, noun.replace(/s$/, ''))} of ${records.length} need${issues.length === 1 ? 's' : ''} more detail`
      : `${plural(records.length, noun.replace(/s$/, ''))}, all complete`,
    issues,
  };
}

// Documents an audit asks to see; the feed declaration only when feed was bought in
const REQUIRED_DOCUMENTS = [
  { type: 'Nutrient budget', why: 'Regional council and the Farm Dairy Records return' },
  { type: 'Consent', why: 'Effluent discharge consent (regional council)' },
  { type: 'Spray plan', why: 'Agrichemical use plan for the spray diary' },
];

export async function complianceReadiness(farmId: string, season: string, now = new Date()) {
  const data = await loadSeason(farmId, season);
  const summary = await seasonSummary(farmId, season);
  const requirements: Requirement[] = [];

  requirements.push(recordsRequirement(data, ['spray'], {
    key: 'spray', title: 'Agrichemical spray diary', packSection: 'spray',
    why: 'Fonterra Dairy Diary: who sprayed, when, where, product, rate, method and the non-grazing period',
  }, 'spray records', { status: 'ok', summary: 'No spraying recorded this season' }));

  requirements.push(recordsRequirement(data, ['fertiliser', 'effluent'], {
    key: 'nutrients', title: 'Fertiliser and effluent applications', packSection: 'nutrients',
    why: 'Fonterra Dairy Diary and regional council: where, product, rate, amount and method',
  }, 'applications', { status: 'ok', summary: 'No fertiliser or effluent recorded this season' }));

  const feedIn = recordsRequirement(data, ['feed_in'], {
    key: 'feed_in', title: 'Feed bought in, with declarations', packSection: 'feed_in',
    why: 'Fonterra feed rules: a supplier feed declaration and the docket for every load bought in',
  }, 'loads', { status: 'ok', summary: 'No feed bought in this season' });
  requirements.push(feedIn);

  const feedOut = recordsRequirement(data, ['feed_out', 'baleage'], {
    key: 'feed_out', title: 'Grazing, feed out and supplement made', packSection: 'feed',
    why: 'Fonterra Dairy Diary grazing and feed records, and imported feed for the Farm Dairy Records return',
  }, 'feed records', {
    status: data.records.some(r => r.type === 'feed_in') ? 'attention' : 'ok',
    summary: data.records.some(r => r.type === 'feed_in') ? 'Feed was bought in but none has been recorded as fed' : 'No feeding recorded this season',
    fix: { kind: 'new', recordType: 'feed_out' },
  });
  requirements.push(feedOut);

  // A monthly check for every month that has finished, and one due for this month
  const checks = data.records.filter(r => r.type === 'monthly_check');
  const done = new Map<string, FarmRecord>();
  for (const r of checks) done.set(checkMonth(r), r);
  const { finished, current } = seasonMonthsSoFar(season, now);
  const monthIssues: Issue[] = [];
  for (const month of finished) {
    if (!done.has(month)) {
      monthIssues.push({ title: `${month} check`, problem: 'Not recorded', fix: { kind: 'new', recordType: 'monthly_check', details: { month }, title: `${month} monthly check` } });
    }
  }
  for (const [month, r] of Array.from(done)) {
    const fails = MONTHLY_CHECK_ITEMS.filter(i => r.details?.[i.key] === 'Fail').map(i => i.label.toLowerCase());
    const missing = missingFields(r);
    if (fails.length) monthIssues.push({ title: `${month} check`, problem: `Failed: ${fails.join(', ')}. Note what was done to fix it.`, fix: { kind: 'edit', recordId: r.id } });
    else if (missing.length) monthIssues.push({ title: `${month} check`, problem: `Not filled in: ${missing.join(', ')}`, fix: { kind: 'edit', recordId: r.id } });
  }
  const missedMonths = finished.filter(m => !done.has(m)).length;
  const dueNow = current && !done.has(current);
  if (dueNow) {
    monthIssues.push({ title: `${current} check`, problem: 'Due by the end of the month', fix: { kind: 'new', recordType: 'monthly_check', details: { month: current }, title: `${current} monthly check` } });
  }
  requirements.push({
    key: 'monthly_checks', title: 'Monthly shed checks', packSection: 'monthly_checks',
    why: 'Fonterra Dairy Diary: nine checks every month, from plant check to milk hygiene',
    status: missedMonths > 0 ? 'missing' : monthIssues.length > (dueNow ? 1 : 0) ? 'attention' : dueNow ? 'attention' : 'ok',
    summary: missedMonths > 0
      ? `${plural(missedMonths, 'month')} not checked`
      : `${done.size} of ${finished.length + (current ? 1 : 0)} months checked${dueNow ? `, ${current} due` : ''}`,
    issues: monthIssues,
  });

  // Animal treatments need the product and a milk withholding period
  const treatmentIssues: Issue[] = [];
  for (const t of data.treatments) {
    const missing: string[] = [];
    if (!t.product && !t.treatmentType) missing.push('product');
    if (t.withdrawalDays == null && t.productWithdrawalDays == null && !t.withdrawalEnd) missing.push('milk withholding period');
    if (missing.length) {
      treatmentIssues.push({
        title: `${t.animal ?? t.cowId ?? 'Animal'}: ${t.condition ?? 'treatment'} (${t.dateTime.slice(0, 10)})`,
        problem: `Missing ${missing.join(', ')}`,
        fix: { kind: 'link', href: '/app/treatments/current', label: 'Open treatments' },
      });
    }
  }
  requirements.push({
    key: 'treatments', title: 'Animal treatments', packSection: 'treatments',
    why: 'Fonterra Dairy Diary: every treatment with its product, dose and milk withholding',
    status: treatmentIssues.length ? 'attention' : 'ok',
    summary: data.treatments.length === 0
      ? 'No treatments recorded this season'
      : treatmentIssues.length ? `${plural(treatmentIssues.length, 'treatment')} of ${data.treatments.length} missing detail` : `${plural(data.treatments.length, 'treatment')}, all complete`,
    issues: treatmentIssues,
  });

  // Documents on file and in date
  const docIssues: Issue[] = [];
  const soon = new Date(now.getTime() + 30 * DAY_MS);
  const docsOfType = (type: string) => data.documents.filter(d => d.details?.documentType === type);
  const required = [...REQUIRED_DOCUMENTS];
  if (data.records.some(r => r.type === 'feed_in')) required.unshift({ type: 'Feed declaration', why: 'Supplier feed declarations for feed bought in' });
  let missingDocs = 0;
  for (const req of required) {
    const docs = docsOfType(req.type);
    const current = docs.filter(d => !has(d.details?.expiryDate) || new Date(d.details.expiryDate) >= now);
    if (docs.length === 0 || current.length === 0) {
      missingDocs++;
      docIssues.push({
        title: req.type,
        problem: docs.length ? 'Expired. Add the new one.' : `Not on file. ${req.why}.`,
        fix: { kind: 'new', recordType: 'document', details: { documentType: req.type }, title: req.type },
      });
    }
  }
  for (const d of data.documents) {
    const expiry = has(d.details?.expiryDate) ? new Date(d.details.expiryDate) : null;
    if (expiry && expiry >= now && expiry < soon) {
      docIssues.push({ title: d.title, problem: `Expires ${ymd(expiry)}`, fix: { kind: 'edit', recordId: d.id } });
    }
  }
  requirements.push({
    key: 'documents', title: 'Documents on file', packSection: 'documents',
    why: 'Consents, nutrient budget, spray plan and feed declarations, kept in date',
    status: missingDocs ? 'missing' : docIssues.length ? 'attention' : 'ok',
    summary: missingDocs ? `${plural(missingDocs, 'document')} missing or expired` : docIssues.length ? `${plural(docIssues.length, 'document')} expiring soon` : `${plural(data.documents.length, 'document')} on file`,
    issues: docIssues,
  });

  // Farm Dairy Records return and the nitrogen cap
  const n = summary.nitrogen;
  const returnIssues: Issue[] = [];
  if (summary.effectiveAreaHa == null) {
    returnIssues.push({ title: 'Effective area', problem: 'Not set, so per-hectare figures can\'t be worked out', fix: { kind: 'link', href: '/app/records', label: 'Set it on Records' } });
  }
  if (n.syntheticKgPerHa != null && n.syntheticKgPerHa > n.capKgPerHa) {
    returnIssues.push({ title: 'Synthetic nitrogen', problem: `${n.syntheticKgPerHa} kg N/ha is over the ${n.capKgPerHa} kg cap` });
  } else if (n.syntheticKgPerHa != null && n.syntheticKgPerHa > n.capKgPerHa * 0.85) {
    returnIssues.push({ title: 'Synthetic nitrogen', problem: `${n.syntheticKgPerHa} kg N/ha is close to the ${n.capKgPerHa} kg cap` });
  }
  for (const i of summary.incomplete) {
    returnIssues.push({ title: i.title, problem: `Not counted in the totals: ${i.reason}`, fix: { kind: 'edit', recordId: i.id } });
  }
  const overCap = n.syntheticKgPerHa != null && n.syntheticKgPerHa > n.capKgPerHa;
  requirements.push({
    key: 'farm_dairy_records', title: 'Farm Dairy Records return', packSection: 'season',
    why: 'Fonterra annual return, due 30 June: effective area, nitrogen per hectare and imported feed',
    status: overCap || summary.effectiveAreaHa == null ? 'missing' : returnIssues.length ? 'attention' : 'ok',
    summary: [
      n.syntheticKgPerHa != null ? `${n.syntheticKgPerHa} kg N/ha` : null,
      `${summary.feed.importedFedT} t imported feed fed`,
      summary.effectiveAreaHa != null ? `${summary.effectiveAreaHa} ha` : 'effective area not set',
    ].filter(Boolean).join(' · '),
    issues: returnIssues,
  });

  // Stock movements on and off the farm need an ASD (number or photo)
  const offFarm = new Map<string, typeof data.stock>();
  for (const line of data.stock) {
    if (!ASD_TYPES.includes(line.type as StockMovementType)) continue;
    const key = line.movementId ?? line.id;
    offFarm.set(key, [...(offFarm.get(key) ?? []), line]);
  }
  const stockIssues: Issue[] = [];
  for (const [id, lines] of Array.from(offFarm)) {
    const first = lines[0];
    if (!first.asdNumber && !(first.recordId && data.withPhoto.has(first.recordId))) {
      const head = lines.reduce((sum, l) => sum + l.quantity, 0);
      stockIssues.push({
        title: `${STOCK_MOVEMENT_LABELS[first.type as StockMovementType]}: ${head} head (${first.date})`,
        problem: 'No ASD photo or number',
        fix: { kind: 'link', href: '/app/stock-reconciliation', label: 'Add the ASD' },
      });
    }
  }
  requirements.push({
    key: 'stock_movements', title: 'Stock movements and ASDs', packSection: 'stock',
    why: 'NAIT and Fonterra: an Animal Status Declaration for every mob moved on or off the farm',
    status: stockIssues.length ? 'attention' : 'ok',
    summary: offFarm.size === 0
      ? 'No stock moved on or off this season'
      : stockIssues.length ? `${plural(stockIssues.length, 'movement')} of ${offFarm.size} without an ASD` : `${plural(offFarm.size, 'movement')}, all with ASDs`,
    issues: stockIssues,
  });

  // Health and safety: open hazards past their fix-by date, and open incidents
  const hazards = await db
    .select({ id: farmHazards.id, title: farmHazards.title, deadline: farmHazards.mitigationDeadline, riskLevel: farmHazards.riskLevel })
    .from(farmHazards)
    .where(and(eq(farmHazards.farmId, farmId), notInArray(farmHazards.status, ['resolved', 'closed'])));
  const incidents = await db
    .select({ id: safetyIncidents.id, type: safetyIncidents.type, occurredAt: safetyIncidents.occurredAt, status: safetyIncidents.status })
    .from(safetyIncidents)
    .where(and(eq(safetyIncidents.farmId, farmId), ne(safetyIncidents.status, 'closed'), ne(safetyIncidents.status, 'resolved')));
  const hsIssues: Issue[] = [];
  const hsLink: Fix = { kind: 'link', href: '/app/compliance', label: 'Open Health & Safety' };
  for (const h of hazards) {
    if (h.deadline && new Date(h.deadline) < now) hsIssues.push({ title: h.title, problem: `Hazard fix was due ${h.deadline}`, fix: hsLink });
  }
  for (const i of incidents) hsIssues.push({ title: `${i.type} incident`, problem: `Still ${i.status} (${ymd(i.occurredAt)})`, fix: hsLink });
  requirements.push({
    key: 'health_safety', title: 'Health and safety', packSection: undefined,
    why: 'WorkSafe: hazards managed and incidents followed up',
    status: hsIssues.length ? 'attention' : 'ok',
    summary: `${plural(hazards.length, 'open hazard')} · ${plural(incidents.length, 'open incident')}`,
    issues: hsIssues,
  });

  const counts = { ok: 0, attention: 0, missing: 0 } as Record<RequirementStatus, number>;
  for (const r of requirements) counts[r.status]++;
  return { season, farmName: data.farm?.name ?? null, generatedAt: now.toISOString(), counts, requirements };
}

// ===== Audit pack =====

export interface PackSection { key: string; title: string; headers: string[]; rows: string[][] }

export const PACK_SECTIONS = ['spray', 'nutrients', 'feed_in', 'feed', 'monthly_checks', 'treatments', 'stock', 'documents'] as const;

const text = (v: unknown) => (has(v) ? String(v) : '');

function where(record: FarmRecord, names: Map<string, string>): string {
  const paddocks = record.pastureIds.map(id => names.get(id)).filter(Boolean).join(', ');
  if (paddocks) return paddocks;
  return record.area ? 'Drawn area' : record.latitude != null ? `${record.latitude}, ${record.longitude}` : '';
}

const hectares = (record: FarmRecord) => (record.areaHa != null ? String(Math.round(Number(record.areaHa) * 100) / 100) : '');

export async function auditPack(farmId: string, season: string) {
  const data = await loadSeason(farmId, season);
  const names = data.paddockNames;
  const of = (...types: string[]) => data.records.filter(r => types.includes(r.type));
  const sections: PackSection[] = [];

  // Column order follows the Fonterra Dairy Diary pages
  sections.push({
    key: 'spray', title: 'Agrichemical spray diary',
    headers: ['Person applying', 'Date', 'Reason for use', 'Paddocks / area', 'Area (ha)', 'Products', 'Rate', 'Application method', 'Non-grazing period (days)', 'Date clear', 'Weather', 'Notes'],
    rows: of('spray').map(r => {
      const d = r.details ?? {};
      const mix: any[] = Array.isArray(d.products) ? d.products : has(d.product) ? [{ product: d.product, rate: d.rate, rateUnit: d.rateUnit }] : [];
      const days = num(d.withholdingDays);
      const clear = has(d.dateClear) ? d.dateClear : days !== undefined ? ymd(new Date(r.occurredAt.getTime() + days * DAY_MS)) : '';
      const weather = [d.windDirection && `wind ${d.windDirection}`, has(d.windSpeed) && `${d.windSpeed} km/h`, has(d.temperature) && `${d.temperature}°C`].filter(Boolean).join(', ');
      return [
        [text(d.operator), has(d.operatorCert) ? `(${d.operatorCert})` : ''].filter(Boolean).join(' '),
        ymd(r.occurredAt), text(d.reasonForUse), where(r, names), hectares(r),
        mix.map(p => text(p.product)).join(' + '),
        mix.map(p => (has(p.rate) ? `${p.rate} ${p.rateUnit ?? 'L/ha'}` : '')).join(' + '),
        text(d.applicationMethod), text(d.withholdingDays), clear, weather, text(r.notes),
      ];
    }),
  });

  sections.push({
    key: 'nutrients', title: 'Fertiliser and effluent applications',
    headers: ['Date', 'Paddocks / area', 'Area covered (ha)', 'Product', 'Rate', 'Amount applied', 'Method', 'Spread by', 'Notes'],
    rows: of('fertiliser', 'effluent').map(r => {
      const d = r.details ?? {};
      if (r.type === 'effluent') {
        return [ymd(r.occurredAt), where(r, names), hectares(r), 'Farm dairy effluent', has(d.depthMm) ? `${d.depthMm} mm` : '',
          has(d.volumeM3) ? `${d.volumeM3} m³` : '', 'Effluent irrigation', '', [has(d.soilCondition) && `Soil ${String(d.soilCondition).toLowerCase()}`, text(r.notes)].filter(Boolean).join('. ')];
      }
      return [ymd(r.occurredAt), where(r, names), hectares(r), text(d.product), has(d.rate) ? `${d.rate} kg/ha` : '',
        has(d.amountApplied) ? `${d.amountApplied} ${d.amountUnit ?? 'kg'}` : '', text(d.applicationMethod), text(d.applicator), text(r.notes)];
    }),
  });

  sections.push({
    key: 'feed_in', title: 'Feed bought in',
    headers: ['Date', 'Supplier', 'Feed', 'Quantity', 'Docket number', 'Docket photo', 'Feed declaration', 'Notes'],
    rows: of('feed_in').map(r => {
      const d = r.details ?? {};
      return [ymd(r.occurredAt), text(d.supplier), text(d.product), [text(d.quantity), text(d.unit)].filter(Boolean).join(' '),
        text(d.docketNumber), data.withPhoto.has(r.id) ? 'Yes' : 'No', text(d.declaration), text(r.notes)];
    }),
  });

  sections.push({
    key: 'feed', title: 'Grazing, feed and supplement made',
    headers: ['Date', 'Mob', 'Location', 'Hectares', 'Feed', 'Amount', 'Source', 'Notes'],
    rows: of('feed_out', 'baleage').map(r => {
      const d = r.details ?? {};
      if (r.type === 'baleage') {
        return [ymd(r.occurredAt), '', where(r, names), hectares(r), `${text(d.kind) || 'Supplement'} made`,
          has(d.bales) ? `${d.bales} bales` : '', 'Home-grown', [has(d.contractor) && `Contractor: ${d.contractor}`, text(r.notes)].filter(Boolean).join('. ')];
      }
      return [ymd(r.occurredAt), text(d.mob), where(r, names), text(d.hectaresGrazed) || hectares(r), text(d.product),
        [text(d.amount), text(d.unit)].filter(Boolean).join(' '), text(d.source), text(r.notes)];
    }),
  });

  sections.push({
    key: 'monthly_checks', title: 'Monthly shed checks',
    headers: ['Month', 'Date checked', ...MONTHLY_CHECK_ITEMS.map(i => i.label), 'Notes'],
    rows: of('monthly_check').map(r => [checkMonth(r), ymd(r.occurredAt), ...MONTHLY_CHECK_ITEMS.map(i => text(r.details?.[i.key])), text(r.notes)]),
  });

  sections.push({
    key: 'treatments', title: 'Animal treatments',
    headers: ['Date', 'Animal', 'Condition', 'Product', 'Dose', 'Milk withholding (days)', 'Milk clear date', 'Treated by'],
    rows: data.treatments.map(t => {
      const days = t.withdrawalDays ?? t.productWithdrawalDays;
      const clear = t.withdrawalEnd ?? (days != null ? ymd(new Date(new Date(t.dateTime).getTime() + days * DAY_MS)) : '');
      return [t.dateTime.slice(0, 10), text(t.animal ?? t.cowId), text(t.condition), text(t.product ?? t.treatmentType),
        [text(t.doseAmount), text(t.doseUnit)].filter(Boolean).join(' '), days != null ? String(days) : '', clear, text(t.staffMember)];
    }),
  });

  sections.push({
    key: 'stock', title: 'Stock movements',
    headers: ['Date', 'Movement', 'Stock class', 'Head', 'From / to', 'Their NAIT number', 'ASD number', 'ASD photo', 'Notes'],
    rows: data.stock.map(l => [l.date, STOCK_MOVEMENT_LABELS[l.type as StockMovementType] ?? l.type, text(l.stockClass), String(l.quantity),
      text(l.fromLocation ?? l.toLocation), text(l.otherPartyNait), text(l.asdNumber),
      l.recordId && data.withPhoto.has(l.recordId) ? 'Yes' : 'No', text(l.notes)]),
  });

  sections.push({
    key: 'documents', title: 'Documents on file',
    headers: ['Document', 'Title', 'From', 'Reference', 'Dated', 'Expires', 'Files attached'],
    rows: data.documents.map(d => [text(d.details?.documentType), d.title, text(d.details?.issuer), text(d.details?.reference),
      ymd(d.occurredAt), text(d.details?.expiryDate), data.withPhoto.has(d.id) ? 'Yes' : 'No']),
  });

  return { season, farmName: data.farm?.name ?? null, generatedAt: new Date().toISOString(), sections };
}

/**
 * RFC 4180 CSV, with a BOM so Excel opens it as UTF-8
 */
export function toCsv(section: PackSection): string {
  const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return '﻿' + [section.headers, ...section.rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
