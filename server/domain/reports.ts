import { sql } from 'drizzle-orm';
import { db } from '../db';
import { isoUtc, rowsOf } from './farm-map';
import { harvestTotals, isHarvest, isLiquid, liquidTotals } from './activities';

// Reports over jobs: one row per job area (with planned/recorded/GPS evidence kept apart),
// nutrients per paddock (verified analyses only), sprays and their restrictions, harvest, and
// docket reconciliation. The same rows feed the screen, CSV and print.

export interface ReportFilters { from: string; to: string; activity?: string; pastureId?: string; product?: string; contractor?: string }

const NUTRIENTS = ['N', 'P', 'K', 'S'] as const;
const KG: Record<string, number | null> = { kg: 1, t: 1000, L: null };
const round = (v: number, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;

export async function activityReport(farmId: string, f: ReportFilters) {
  const like = f.product ? `%${f.product.trim().toLowerCase()}%` : null;
  const cLike = f.contractor ? `%${f.contractor.trim().toLowerCase()}%` : null;
  const rows = rowsOf(await db.execute(sql`
    SELECT a.id AS "jobId", a.activity, a.status, a.evidence, a.title, a.target, a.crop, a.contractor, a.operator, a.equipment,
      a.cost::float AS cost, a.planned_on::text AS "plannedOn", a.completed_at AT TIME ZONE 'UTC' AS "completedAt", a.details,
      a.water_rate::float AS "waterRate", a.gps_source AS "gpsSource",
      l.id AS "lineId", l.name AS area, l.pasture_id AS "pastureId", p.name AS paddock, l.partial,
      l.gross_ha::float AS "grossHa", l.excluded_ha::float AS "excludedHa", l.net_ha::float AS "netHa",
      l.product_snapshot AS product, l.rate::float AS rate, l.rate_unit AS "rateUnit",
      l.planned_quantity::float AS "plannedQuantity", l.applied_quantity::float AS "appliedQuantity", l.quantity_unit AS "quantityUnit",
      (SELECT json_agg(json_build_object('product', m.product_snapshot->>'name', 'rate', m.rate, 'rateUnit', m.rate_unit,
          'used', m.actual_quantity, 'usedUnit', m.actual_unit) ORDER BY m.sort_order) FROM application_mix m WHERE m.application_id = a.id) AS mix,
      (SELECT string_agg(d.number, ', ') FROM application_dockets ad JOIN dockets d ON d.id = ad.docket_id WHERE ad.application_id = a.id) AS dockets,
      (SELECT json_agg(json_build_object('kind', r.kind, 'status', r.status, 'endsAt', r.ends_at AT TIME ZONE 'UTC', 'product', rm.product_snapshot->>'name',
          'period', r.period_value, 'unit', r.period_unit, 'source', r.rule_source))
       FROM restrictions r LEFT JOIN application_mix rm ON rm.id = r.mix_id WHERE r.application_id = a.id) AS restrictions,
      (SELECT sum(net_ha)::float FROM application_lines x WHERE x.application_id = a.id) AS "jobNetHa"
    FROM applications a
    JOIN application_lines l ON l.application_id = a.id
    LEFT JOIN pastures p ON p.id = l.pasture_id
    WHERE a.farm_id = ${farmId} AND a.deleted_at IS NULL AND a.status <> 'cancelled'
      AND COALESCE(a.completed_at::date, a.planned_on, a.created_at::date) BETWEEN ${f.from}::date AND ${f.to}::date
      AND (${f.activity ?? null}::text IS NULL OR a.activity = ${f.activity ?? null})
      AND (${f.pastureId ?? null}::uuid IS NULL OR l.pasture_id = ${f.pastureId ?? null}::uuid)
      AND (${cLike}::text IS NULL OR lower(COALESCE(a.contractor, '') || ' ' || COALESCE(a.operator, '')) LIKE ${cLike})
      AND (${like}::text IS NULL OR lower(COALESCE(l.product_snapshot->>'name', '')) LIKE ${like}
           OR EXISTS (SELECT 1 FROM application_mix m WHERE m.application_id = a.id AND lower(m.product_snapshot->>'name') LIKE ${like}))
    ORDER BY COALESCE(a.completed_at, a.planned_on::timestamp, a.created_at), a.id, l.sort_order`));

  const evidenceText = (r: any) => (r.status !== 'completed' ? 'Planned' : r.evidence === 'gps' ? `Completed: GPS evidence (${r.gpsSource ?? 'imported'})` : 'Completed: recorded by hand');
  const jobs = rows.map((r: any) => {
    const share = r.jobNetHa > 0 ? r.netHa / r.jobNetHa : 0;
    let what = '', quantity = '';
    if (r.activity === 'fertiliser') {
      what = `${r.product?.name ?? ''} ${r.rate ?? ''} ${r.rateUnit}`.trim();
      const dp = r.quantityUnit === 't' ? 3 : 1;
      quantity = `planned ${r.plannedQuantity != null ? round(r.plannedQuantity, dp) : '—'} ${r.quantityUnit ?? ''}; applied ${r.appliedQuantity != null ? `${round(r.appliedQuantity, dp)} ${r.quantityUnit}` : 'not entered'}`;
    } else if (r.activity === 'spray') {
      what = (r.mix ?? []).map((m: any) => `${m.product} ${m.rate ?? ''} ${m.rateUnit}`).join(' + ');
      quantity = (r.mix ?? []).filter((m: any) => m.used != null).map((m: any) => `${m.product} used ${m.used} ${m.usedUnit}`).join('; ');
    } else if (isLiquid(r.activity)) {
      const t = liquidTotals(r.details ?? {}, r.jobNetHa ?? 0);
      what = `${r.details?.method ?? r.activity}${r.details?.machineSetting ? ` (${r.details.machineSetting})` : ''}`;
      quantity = t.volumeM3 != null ? `${round(t.volumeM3 * share)} m³ of ${t.volumeM3} m³; ${t.depthMm ?? '—'} mm${t.estimate ? ' (estimate)' : ''}` : 'volume unknown';
    } else if (isHarvest(r.activity)) {
      const t = harvestTotals(r.activity, r.details ?? {});
      what = r.activity === 'baleage' ? `${r.details?.baleCount ?? '—'} bales` : 'silage';
      quantity = `${t.freshT ?? '—'} t fresh${t.freshBasis === 'estimated' ? ' (est.)' : ''}; ${t.dmT ?? '—'} t DM${t.dmBasis === 'estimated' ? ' (est.)' : ''}`;
    } else {
      what = r.details?.purpose === 'feed' ? 'mowing for feed' : r.details?.purpose ?? r.activity;
    }
    const rs = r.restrictions ?? [];
    const unresolved = rs.some((x: any) => x.status === 'unresolved');
    const grazingEnds = rs.filter((x: any) => x.kind === 'grazing' && x.endsAt).map((x: any) => isoUtc(x.endsAt)!).sort().pop() ?? null;
    return {
      jobId: r.jobId, lineId: r.lineId, date: (isoUtc(r.completedAt) ?? r.plannedOn ?? '').slice(0, 10), activity: r.activity, status: r.status,
      evidence: evidenceText(r), paddock: r.paddock ?? r.area ?? 'Drawn area', area: r.area, partial: r.partial,
      grossHa: round(r.grossHa, 3), excludedHa: round(r.excludedHa ?? 0, 3), netHa: round(r.netHa, 3),
      what, quantity, target: r.target, contractor: r.contractor, operator: r.operator, dockets: r.dockets,
      cost: r.cost != null ? round(r.cost * share, 2) : null,
      restriction: r.activity !== 'spray' ? null : r.status !== 'completed' ? 'starts when done' : unresolved ? 'UNRESOLVED' : grazingEnds ? `no grazing until ${grazingEnds.slice(0, 16).replace('T', ' ')} UTC` : 'none applies',
      _r: r,
    };
  });

  // Nutrients per paddock from completed work: verified fertiliser analyses and entered effluent analyses
  const byPaddock = new Map<string, { paddock: string; netHa: number; kg: Record<string, number>; notCounted: string[] }>();
  const add = (key: string, name: string) => {
    if (!byPaddock.has(key)) byPaddock.set(key, { paddock: name, netHa: 0, kg: { N: 0, P: 0, K: 0, S: 0 }, notCounted: [] });
    return byPaddock.get(key)!;
  };
  for (const j of jobs) {
    const r = j._r;
    if (r.status !== 'completed') continue;
    const row = add(r.pastureId ?? `area:${r.lineId}`, j.paddock);
    if (r.activity === 'fertiliser') {
      const qty = r.appliedQuantity ?? r.plannedQuantity;
      const factor = KG[r.quantityUnit ?? ''];
      const p = r.product ?? {};
      if (qty == null || factor == null) { row.notCounted.push(`${j.date} ${p.name}: amount not known in kg`); continue; }
      if (p.verification !== 'verified' || !p.analysis) { row.notCounted.push(`${j.date} ${p.name}: analysis not verified`); continue; }
      // A nutrient the supplier doesn't state is unknown, not zero: count the others and say which is missing
      const missing = NUTRIENTS.filter(n => p.analysis[n] == null);
      if (missing.length) row.notCounted.push(`${j.date} ${p.name}: ${missing.join(', ')} not stated in its analysis`);
      for (const n of NUTRIENTS) if (p.analysis[n] != null) row.kg[n] += qty * factor * Number(p.analysis[n]) / 100;
    } else if (isLiquid(r.activity)) {
      const t = liquidTotals(r.details ?? {}, r.jobNetHa ?? 0);
      if (!t.nutrientsKg) { row.notCounted.push(`${j.date} ${r.activity}: ${t.analysis ? 'volume unknown' : 'no analysis'}`); continue; }
      // Split over the job's areas by net area
      const share = r.jobNetHa > 0 ? r.netHa / r.jobNetHa : 0;
      for (const n of ['N', 'P', 'K'] as const) if (t.nutrientsKg[n] != null) row.kg[n] += Number(t.nutrientsKg[n]) * share;
    }
  }
  // Paddock area for per-hectare figures: its current mapped area
  const pIds = Array.from(byPaddock.keys()).filter(k => !k.startsWith('area:'));
  const areas = pIds.length ? rowsOf(await db.execute(sql`
    SELECT b.pasture_id AS id, ST_Area(b.geom) / 10000 AS ha FROM paddock_boundaries b WHERE b.valid_to IS NULL AND b.pasture_id IN (${sql.join(pIds.map(id => sql`${id}::uuid`), sql`, `)})`)) : [];
  const haOf = new Map(areas.map((a: any) => [a.id, Number(a.ha)]));
  const nutrients = Array.from(byPaddock.entries()).map(([k, v]) => {
    const ha = haOf.get(k) ?? null;
    return {
      paddock: v.paddock, mappedHa: ha != null ? round(ha, 3) : null,
      kg: Object.fromEntries(Object.entries(v.kg).map(([n, x]) => [n, round(x)])),
      perHa: ha ? Object.fromEntries(Object.entries(v.kg).map(([n, x]) => [n, round(x / ha)])) : null,
      notCounted: v.notCounted,
    };
  }).filter(n => Object.values(n.kg).some(x => x > 0) || n.notCounted.length);

  // Harvest per job
  const seen = new Set<string>();
  const harvest = jobs.filter(j => isHarvest(j.activity) && !seen.has(j.jobId) && seen.add(j.jobId)).map(j => {
    const t = harvestTotals(j.activity, j._r.details ?? {});
    return {
      date: j.date, activity: j.activity, status: j.status, paddocks: jobs.filter(x => x.jobId === j.jobId).map(x => x.paddock).join(', '),
      netHa: round(jobs.filter(x => x.jobId === j.jobId).reduce((s, x) => s + x.netHa, 0), 3),
      freshT: t.freshT, freshBasis: t.freshBasis, dmT: t.dmT, dmBasis: t.dmBasis, destination: j._r.details?.destination ?? null, contractor: j.contractor,
    };
  });

  // Docket reconciliation: delivered vs allocated vs applied (kg), per docket
  const dockets = rowsOf(await db.execute(sql`
    SELECT d.id, d.number, d.supplier, d.docket_date::text AS "date", d.product_name AS product, d.product_id AS "productId",
      d.quantity::float AS quantity, d.unit,
      (SELECT json_agg(json_build_object('jobId', a.id, 'status', a.status, 'allocated', ad.quantity,
          'applied', (SELECT sum(CASE l.quantity_unit WHEN 't' THEN l.applied_quantity * 1000 WHEN 'kg' THEN l.applied_quantity END)
                      FROM application_lines l WHERE l.application_id = a.id AND (d.product_id IS NULL OR l.product_id = d.product_id)),
          'planned', (SELECT sum(CASE l.quantity_unit WHEN 't' THEN l.planned_quantity * 1000 WHEN 'kg' THEN l.planned_quantity END)
                      FROM application_lines l WHERE l.application_id = a.id AND (d.product_id IS NULL OR l.product_id = d.product_id))))
       FROM application_dockets ad JOIN applications a ON a.id = ad.application_id AND a.deleted_at IS NULL AND a.status <> 'cancelled'
       WHERE ad.docket_id = d.id) AS jobs
    FROM dockets d
    WHERE d.farm_id = ${farmId} AND d.archived_at IS NULL
      AND (d.docket_date BETWEEN ${f.from}::date AND ${f.to}::date
        OR EXISTS (SELECT 1 FROM application_dockets ad JOIN applications a ON a.id = ad.application_id
                   WHERE ad.docket_id = d.id AND COALESCE(a.completed_at::date, a.planned_on, a.created_at::date) BETWEEN ${f.from}::date AND ${f.to}::date))
    ORDER BY d.docket_date NULLS LAST, d.number`)).map((d: any) => {
    const toKg = (q: number | null, u: string | null) => (q == null || u == null || KG[u] == null ? null : q * KG[u]!);
    const deliveredKg = toKg(d.quantity, d.unit);
    const js = d.jobs ?? [];
    const allocatedKg = js.some((j: any) => j.allocated != null) ? js.reduce((s: number, j: any) => s + (toKg(j.allocated, d.unit) ?? 0), 0) : null;
    const appliedKg = js.some((j: any) => j.applied != null) ? js.reduce((s: number, j: any) => s + Number(j.applied ?? 0), 0) : null;
    const issues: string[] = [];
    if (!js.length) issues.push('Not linked to a job');
    if (deliveredKg != null && appliedKg != null && Math.abs(appliedKg - deliveredKg) / Math.max(deliveredKg, 1) > 0.05) issues.push(`Applied ${round(appliedKg)} kg vs delivered ${round(deliveredKg)} kg`);
    if (deliveredKg != null && allocatedKg != null && allocatedKg > deliveredKg * 1.001) issues.push('More allocated than delivered');
    if (d.unit === 'L') issues.push('Litres: not compared with kilograms');
    return {
      number: d.number, supplier: d.supplier, date: d.date, product: d.product, delivered: d.quantity != null ? `${d.quantity} ${d.unit ?? ''}` : '—',
      deliveredKg, allocatedKg, appliedKg, jobs: js.length, issues,
    };
  });

  const sprays = Array.from(new Map(jobs.filter(j => j.activity === 'spray').map(j => [j.jobId, j])).values()).map(j => ({
    date: j.date, status: j.status, evidence: j.evidence, paddocks: jobs.filter(x => x.jobId === j.jobId).map(x => x.paddock).join(', '),
    mix: j.what, target: j.target, operator: j.operator ?? j.contractor, restriction: j.restriction,
    restrictions: (j._r.restrictions ?? []).map((x: any) => `${x.product ?? 'mix'} ${x.kind}: ${x.status === 'confirmed' ? `${x.period} ${x.unit} (${x.source})` : x.status === 'not_applicable' ? `none (${x.source})` : 'UNRESOLVED'}`),
  }));

  return {
    filters: f,
    jobs: jobs.map(({ _r, ...j }) => j),
    nutrients, sprays, harvest, dockets,
    totals: {
      jobs: new Set(jobs.map(j => j.jobId)).size,
      completed: new Set(jobs.filter(j => j.status === 'completed').map(j => j.jobId)).size,
      gps: new Set(jobs.filter(j => j.evidence.includes('GPS')).map(j => j.jobId)).size,
      cost: round(jobs.reduce((s, j) => s + (j.cost ?? 0), 0), 2),
    },
  };
}

const csvCell = (v: unknown) => {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(rows: Record<string, unknown>[], columns: [string, string][]) {
  return [columns.map(c => csvCell(c[1])).join(','), ...rows.map(r => columns.map(c => csvCell(r[c[0]])).join(','))].join('\r\n') + '\r\n';
}

export const CSV_SECTIONS: Record<string, [string, string][]> = {
  jobs: [['date', 'Date'], ['activity', 'Activity'], ['status', 'Status'], ['evidence', 'Evidence'], ['paddock', 'Paddock / area'], ['grossHa', 'Gross ha'],
    ['excludedHa', 'Excluded ha'], ['netHa', 'Net ha'], ['what', 'Product / work'], ['quantity', 'Quantities'], ['target', 'Target'], ['contractor', 'Contractor'],
    ['operator', 'Operator'], ['dockets', 'Dockets'], ['cost', 'Cost (share)'], ['restriction', 'Restriction'], ['jobId', 'Job id']],
  sprays: [['date', 'Date'], ['status', 'Status'], ['evidence', 'Evidence'], ['paddocks', 'Paddocks'], ['mix', 'Tank mix'], ['target', 'Target'],
    ['operator', 'Applied by'], ['restriction', 'Grazing'], ['restrictions', 'Restrictions (label source)']],
  harvest: [['date', 'Date'], ['activity', 'Activity'], ['status', 'Status'], ['paddocks', 'Paddocks'], ['netHa', 'Net ha'], ['freshT', 'Fresh t'],
    ['freshBasis', 'Fresh basis'], ['dmT', 'DM t'], ['dmBasis', 'DM basis'], ['destination', 'Destination'], ['contractor', 'Contractor']],
  dockets: [['number', 'Docket'], ['supplier', 'Supplier'], ['date', 'Date'], ['product', 'Product'], ['delivered', 'Delivered'], ['deliveredKg', 'Delivered kg'],
    ['allocatedKg', 'Allocated kg'], ['appliedKg', 'Applied kg'], ['jobs', 'Jobs'], ['issues', 'Issues']],
};

export function nutrientCsv(nutrients: any[]) {
  return toCsv(nutrients.map(n => ({ paddock: n.paddock, ha: n.mappedHa, ...Object.fromEntries(Object.entries(n.kg).map(([k, v]) => [`${k}kg`, v])),
    ...Object.fromEntries(Object.entries(n.perHa ?? {}).map(([k, v]) => [`${k}ha`, v])), notCounted: n.notCounted })),
  [['paddock', 'Paddock'], ['ha', 'Mapped ha'], ['Nkg', 'N kg'], ['Pkg', 'P kg'], ['Kkg', 'K kg'], ['Skg', 'S kg'], ['Nha', 'N kg/ha'], ['Pha', 'P kg/ha'],
    ['Kha', 'K kg/ha'], ['Sha', 'S kg/ha'], ['notCounted', 'Not counted']]);
}

/**
 * The farm's own job areas as GeoJSON (for KML/GIS): one feature per area, with what was done
 */
export async function jobsGeoJson(farmId: string, f: ReportFilters) {
  const report = await activityReport(farmId, f);
  const geoms = rowsOf(await db.execute(sql`
    SELECT l.id, ST_AsGeoJSON(l.geom, 7)::json AS g FROM application_lines l JOIN applications a ON a.id = l.application_id
    WHERE a.farm_id = ${farmId} AND l.id IN (${report.jobs.length ? sql.join(report.jobs.map(j => sql`${j.lineId}::uuid`), sql`, `) : sql`NULL::uuid`})`));
  const byId = new Map(geoms.map((g: any) => [g.id, g.g]));
  return {
    type: 'FeatureCollection',
    features: report.jobs.map(j => ({
      type: 'Feature', geometry: byId.get(j.lineId) ?? null,
      properties: { name: `${j.date} ${j.activity} ${j.paddock}`, date: j.date, activity: j.activity, status: j.status, evidence: j.evidence,
        netHa: j.netHa, what: j.what, quantity: j.quantity, contractor: j.contractor, restriction: j.restriction, jobId: j.jobId },
    })),
  };
}
