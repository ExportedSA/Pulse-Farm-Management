/**
 * Everything a farm has in Pulse, as a zip: one CSV (for spreadsheets) and one JSON file (exact
 * values) per table, the farm's details and its people. Map shapes are GeoJSON.
 *
 * Runs on the request's farm-limited connection, so row-level security also keeps it to the
 * farm, and every query filters by the farm as well. Password and link hashes are left out.
 * Uploaded files themselves aren't included yet; their rows (names and links) are.
 */
import { zipSync, strToU8 } from 'fflate';
import { sql } from 'drizzle-orm';
import { db } from '../db';

// Tables handled on their own, or not the farm's data
const SKIP = new Set(['farms', 'farm_members']);
// Columns never exported
const SECRET_COLUMNS = new Set(['farm_invitations.token_hash']);
// Tables with no farm_id of their own: their rows belong to the farm of the parent they point at
const CHILD_TABLES: Record<string, { column: string; parent: string }> = {
  application_dockets: { column: 'application_id', parent: 'applications' },
  application_lines: { column: 'application_id', parent: 'applications' },
  application_mix: { column: 'application_id', parent: 'applications' },
  application_versions: { column: 'application_id', parent: 'applications' },
  rate_zones: { column: 'plan_id', parent: 'rate_plans' },
  taggings: { column: 'tag_id', parent: 'tags' },
};

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
const rowsOf = (result: any): any[] => result?.rows ?? result ?? [];

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Spreadsheets treat a cell starting with = + @ (or - before text) as a formula
  if (typeof value === 'string' && /^([=+@\t\r]|-(?![\d.]))/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  return [columns.map(cell).join(','), ...rows.map(r => columns.map(c => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}

export interface ExportedTable { name: string; columns: string[]; rows: Record<string, unknown>[] }

/** Every row of the farm's data, table by table */
export async function collectFarmData(farmId: string): Promise<{ farm: any; members: any[]; tables: ExportedTable[] }> {
  const columns = rowsOf(await db.execute(sql`
    SELECT c.table_name AS "table", c.column_name AS "column", c.udt_name AS "type"
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY c.table_name, c.ordinal_position`));
  const byTable = new Map<string, { column: string; type: string }[]>();
  for (const c of columns) {
    if (!byTable.has(c.table)) byTable.set(c.table, []);
    byTable.get(c.table)!.push(c);
  }

  const tables: ExportedTable[] = [];
  for (const [table, cols] of [...byTable.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (SKIP.has(table)) continue;
    const child = CHILD_TABLES[table];
    const hasFarm = cols.some(c => c.column === 'farm_id');
    if (!hasFarm && !child) continue;

    const kept = cols.filter(c => !SECRET_COLUMNS.has(`${table}.${c.column}`));
    const select = kept.map(c => (c.type === 'geometry' || c.type === 'geography')
      ? `ST_AsGeoJSON(x.${ident(c.column)})::json AS ${ident(c.column)}`
      : `x.${ident(c.column)}`).join(', ');
    const query = child
      ? sql`SELECT ${sql.raw(select)} FROM ${sql.raw(ident(table))} x JOIN ${sql.raw(ident(child.parent))} p ON p.id = x.${sql.raw(ident(child.column))} WHERE p.farm_id = ${farmId}`
      : sql`SELECT ${sql.raw(select)} FROM ${sql.raw(ident(table))} x WHERE x.farm_id = ${farmId}`;
    const rows = rowsOf(await db.execute(query));
    tables.push({ name: table, columns: kept.map(c => c.column), rows });
  }

  const [farm] = rowsOf(await db.execute(sql`SELECT * FROM farms WHERE id = ${farmId}`));
  const members = rowsOf(await db.execute(sql`
    SELECT u.id AS user_id, u.name, u.email, m.role, m.is_active, m.created_at AS joined_at
    FROM farm_members m JOIN users u ON u.id = m.user_id
    WHERE m.farm_id = ${farmId} ORDER BY m.created_at`));
  return { farm, members, tables };
}

/** The zip a farm owner downloads */
export async function buildFarmExport(farmId: string): Promise<{ zip: Uint8Array; filename: string }> {
  const { farm, members, tables } = await collectFarmData(farmId);
  const exportedAt = new Date().toISOString();
  const withRows = tables.filter(t => t.rows.length > 0);
  const files: Record<string, Uint8Array> = {};
  const json = (value: unknown) => strToU8(JSON.stringify(value, null, 2));

  files['README.txt'] = strToU8([
    `Pulse data export for ${farm?.name ?? 'your farm'}`,
    `Exported ${exportedAt}`,
    '',
    'farm.json        the farm\'s details and settings',
    'people.csv/.json everyone who is or was on the farm, and their role',
    'csv/<table>.csv  each kind of record, for spreadsheets (map shapes are GeoJSON text)',
    'json/<table>.json the same records with exact values',
    '',
    'Records refer to each other by id (for example animal_id). Uploaded photos and documents are',
    'listed with their file names and links, but the files themselves are not in this zip.',
    '',
    'Tables in this export, with their row counts:',
    ...withRows.map(t => `  ${t.name}: ${t.rows.length}`),
    '',
  ].join('\r\n'));
  files['farm.json'] = json({ exportedAt, farm });
  files['people.json'] = json(members);
  files['people.csv'] = strToU8(toCsv(['user_id', 'name', 'email', 'role', 'is_active', 'joined_at'], members));
  for (const t of withRows) {
    files[`csv/${t.name}.csv`] = strToU8(toCsv(t.columns, t.rows));
    files[`json/${t.name}.json`] = json(t.rows);
  }

  const safeName = String(farm?.name ?? 'farm').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'farm';
  return { zip: zipSync(files, { level: 6 }), filename: `pulse-${safeName}-${exportedAt.slice(0, 10)}.zip` };
}
