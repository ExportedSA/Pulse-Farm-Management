import { sql } from 'drizzle-orm';
import { db } from '../db';
import { MapError, isoUtc, rowsOf } from './farm-map';

// Every change to a job first keeps the whole job as it was (application_versions), so a completed
// record can be corrected without losing what it said before. With map_audit (who did what, when)
// this gives the job's edit history.

export async function snapshotJob(tx: any, id: string, userId: string | null, reason: string) {
  const [app] = rowsOf(await tx.execute(sql`
    SELECT a.id, a.activity, a.status, a.title, a.planned_on::text AS "plannedOn", a.started_at AT TIME ZONE 'UTC' AS "startedAt",
      a.completed_at AT TIME ZONE 'UTC' AS "completedAt", a.evidence, a.contractor, a.operator, a.equipment, a.supplier, a.weather,
      a.notes, a.cost::float AS cost, a.crop, a.target, a.water_rate::float AS "waterRate", a.tank_volume::float AS "tankVolume",
      a.tank_loads::float AS "tankLoads", a.wind_speed::float AS "windSpeed", a.wind_direction AS "windDirection",
      a.temperature::float AS temperature, a.details, a.version, a.shared_with AS "sharedWith"
    FROM applications a WHERE a.id = ${id}`));
  if (!app) return;
  const lines = rowsOf(await tx.execute(sql`
    SELECT name, pasture_id AS "pastureId", partial, gross_ha::float AS "grossHa", excluded_ha::float AS "excludedHa", net_ha::float AS "netHa",
      product_snapshot->>'name' AS product, rate::float, rate_unit AS "rateUnit", planned_quantity::float AS "plannedQuantity",
      applied_quantity::float AS "appliedQuantity", quantity_unit AS "quantityUnit", ST_AsGeoJSON(geom, 7)::json AS geometry
    FROM application_lines WHERE application_id = ${id} ORDER BY sort_order`));
  const mix = rowsOf(await tx.execute(sql`
    SELECT product_snapshot->>'name' AS product, role, rate::float, rate_unit AS "rateUnit", actual_quantity::float AS "actualQuantity", actual_unit AS "actualUnit"
    FROM application_mix WHERE application_id = ${id} ORDER BY sort_order`));
  const restrictions = rowsOf(await tx.execute(sql`
    SELECT r.kind, r.status, r.period_value::float AS "periodValue", r.period_unit AS "periodUnit", r.rule_source AS "ruleSource",
      m.product_snapshot->>'name' AS product
    FROM restrictions r LEFT JOIN application_mix m ON m.id = r.mix_id WHERE r.application_id = ${id} ORDER BY r.created_at`));
  const dockets = rowsOf(await tx.execute(sql`
    SELECT d.number, ad.quantity::float AS allocated FROM application_dockets ad JOIN dockets d ON d.id = ad.docket_id WHERE ad.application_id = ${id}`));
  const data = { ...app, startedAt: isoUtc(app.startedAt), completedAt: isoUtc(app.completedAt), lines, mix, restrictions, dockets };
  await tx.execute(sql`
    INSERT INTO application_versions (application_id, version, data, reason, changed_by)
    VALUES (${id}, ${app.version}, ${JSON.stringify(data)}::jsonb, ${reason}, ${userId})
    ON CONFLICT (application_id, version) DO NOTHING`);
}

const label: Record<string, string> = {
  create: 'Created', update: 'Changed', applied: 'Applied amounts entered', used: 'Quantities used entered', cancel: 'Cancelled',
  docket_link: 'Docket attached', docket_unlink: 'Docket removed', share: 'Sharing changed', gps: 'GPS evidence imported', gps_remove: 'GPS evidence removed',
};

/**
 * What changed between two versions of a job, in words
 */
function describeChange(a: any, b: any): string[] {
  if (!a || !b) return [];
  const out: string[] = [];
  const day = (v: string | null) => (v ? v.slice(0, 16).replace('T', ' ') : 'none');
  if (a.status !== b.status) out.push(`status ${a.status} → ${b.status}`);
  if ((a.completedAt ?? null) !== (b.completedAt ?? null)) out.push(`finished ${day(a.completedAt)} → ${day(b.completedAt)}`);
  for (const k of ['title', 'contractor', 'operator', 'equipment', 'notes', 'cost', 'target', 'waterRate', 'tankLoads', 'evidence'] as const) {
    if ((a[k] ?? null) !== (b[k] ?? null)) out.push(`${k} ${a[k] ?? '—'} → ${b[k] ?? '—'}`);
  }
  const lineText = (l: any) => `${l.name ?? 'area'}${l.product ? ` ${l.product} ${l.rate ?? ''} ${l.rateUnit}` : ''} ${Number(l.netHa ?? 0).toFixed(3)} ha${l.appliedQuantity != null ? `, applied ${l.appliedQuantity} ${l.quantityUnit}` : ''}`;
  const la = (a.lines ?? []).map(lineText).join('; '), lb = (b.lines ?? []).map(lineText).join('; ');
  if (la !== lb) out.push(`areas: ${la || 'none'} → ${lb || 'none'}`);
  const mixText = (m: any) => `${m.product} ${m.rate ?? ''} ${m.rateUnit}${m.actualQuantity != null ? `, used ${m.actualQuantity} ${m.actualUnit}` : ''}`;
  const ma = (a.mix ?? []).map(mixText).join('; '), mb = (b.mix ?? []).map(mixText).join('; ');
  if (ma !== mb) out.push(`mix: ${ma || 'none'} → ${mb || 'none'}`);
  const rText = (r: any) => `${r.product ?? 'mix'} ${r.kind} ${r.status}${r.periodValue != null ? ` ${r.periodValue} ${r.periodUnit}` : ''}`;
  const ra = (a.restrictions ?? []).map(rText).join('; '), rb = (b.restrictions ?? []).map(rText).join('; ');
  if (ra !== rb) out.push(`restrictions: ${ra || 'none'} → ${rb || 'none'}`);
  if (JSON.stringify(a.details ?? {}) !== JSON.stringify(b.details ?? {})) {
    const keys = Array.from(new Set([...Object.keys(a.details ?? {}), ...Object.keys(b.details ?? {})]))
      .filter(k => JSON.stringify(a.details?.[k]) !== JSON.stringify(b.details?.[k]));
    out.push(`details changed: ${keys.join(', ')}`);
  }
  const da = (a.dockets ?? []).map((d: any) => d.number).sort().join(', '), dbs = (b.dockets ?? []).map((d: any) => d.number).sort().join(', ');
  if (da !== dbs) out.push(`dockets: ${da || 'none'} → ${dbs || 'none'}`);
  return out;
}

/**
 * The job's history, newest first: each change with who made it, when, and what it changed.
 * Each earlier version can be opened in full.
 */
export async function jobHistory(farmId: string, id: string) {
  const [app] = rowsOf(await db.execute(sql`SELECT id FROM applications WHERE id = ${id} AND farm_id = ${farmId}`));
  if (!app) throw new MapError('Job not found', 404);
  const versions = rowsOf(await db.execute(sql`
    SELECT v.version, v.data, v.reason, v.changed_at AT TIME ZONE 'UTC' AS at, u.name AS "by"
    FROM application_versions v LEFT JOIN users u ON u.id = v.changed_by WHERE v.application_id = ${id} ORDER BY v.version`));
  const events = rowsOf(await db.execute(sql`
    SELECT m.action, m.entity_type AS "entityType", m.at AT TIME ZONE 'UTC' AS at, u.name AS "by"
    FROM map_audit m LEFT JOIN users u ON u.id = m.user_id
    WHERE m.farm_id = ${farmId} AND ((m.entity_type = 'application' AND m.entity_id = ${id})
      OR (m.entity_type = 'restriction' AND (m.entity_id IN (SELECT id FROM restrictions WHERE application_id = ${id}) OR m.before->>'application_id' = ${id})))
    ORDER BY m.at`));
  // The current state, to compare the last version with
  const { getApplication } = await import('./applications');
  const now = await getApplication(farmId, id);
  const current = {
    ...now, lines: now.lines.map((l: any) => ({ ...l, product: l.productSnapshot?.name ?? null })),
    mix: now.spray?.mix.map((m: any) => ({ product: m.productSnapshot.name, role: m.role, rate: m.rate, rateUnit: m.rateUnit, actualQuantity: m.actualQuantity, actualUnit: m.actualUnit })) ?? [],
    restrictions: now.spray?.restrictions.map((r: any) => ({ kind: r.kind, status: r.status, periodValue: r.periodValue, periodUnit: r.periodUnit, ruleSource: r.ruleSource, product: r.product })) ?? [],
    details: (now.work as any)?.details ?? {}, dockets: now.dockets.map((d: any) => ({ number: d.number, allocated: d.allocated })),
  };
  const changes = versions.map((v: any, i: number) => ({
    version: v.version, reason: v.reason, at: isoUtc(v.at), by: v.by,
    changes: describeChange(v.data, i + 1 < versions.length ? versions[i + 1].data : current),
  }));
  return {
    events: events.map((e: any) => ({ action: e.entityType === 'restriction' ? `Restriction ${e.action}` : label[e.action] ?? e.action, at: isoUtc(e.at), by: e.by })).reverse(),
    changes: changes.reverse(),
  };
}

export async function jobVersion(farmId: string, id: string, version: number) {
  const [v] = rowsOf(await db.execute(sql`
    SELECT v.data, v.reason, v.changed_at AT TIME ZONE 'UTC' AS at, u.name AS "by"
    FROM application_versions v JOIN applications a ON a.id = v.application_id LEFT JOIN users u ON u.id = v.changed_by
    WHERE v.application_id = ${id} AND a.farm_id = ${farmId} AND v.version = ${version}`));
  if (!v) throw new MapError('That version was not found', 404);
  return { ...v, at: isoUtc(v.at) };
}
