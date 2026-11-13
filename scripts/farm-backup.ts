// Back up one farm's map, jobs and records to a JSON file, and restore a backup into a farm.
//
//   npx tsx scripts/farm-backup.ts export <farmId> [file]
//   npx tsx scripts/farm-backup.ts restore <file> <targetFarmId>
//
// Restore gives every row a new id, so a backup can be restored into a new (empty) farm alongside
// the original, checked, and the original left untouched. It refuses a target farm that already
// has paddocks or jobs. Users stay as they are (they're shared across farms). Uploaded files are
// referenced by their storage key, not copied: back up the uploads folder (or S3 bucket) as well.
// The database itself also has Neon point-in-time restore; this is the farm-level copy.
import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// In dependency order (parents first). where: which rows belong to the farm ($1 = farm id)
export const TABLES: { table: string; where: string }[] = [
  { table: "pastures", where: "farm_id = $1" },
  { table: "paddock_boundaries", where: "farm_id = $1" },
  { table: "map_layers", where: "farm_id = $1" },
  { table: "map_features", where: "farm_id = $1" },
  { table: "map_views", where: "farm_id = $1" },
  { table: "exclusions", where: "farm_id = $1" },
  { table: "input_products", where: "farm_id = $1" },
  { table: "product_versions", where: "product_id IN (SELECT id FROM input_products WHERE farm_id = $1)" },
  { table: "farm_product_prefs", where: "farm_id = $1" },
  { table: "rate_plans", where: "farm_id = $1" },
  { table: "rate_zones", where: "plan_id IN (SELECT id FROM rate_plans WHERE farm_id = $1)" },
  { table: "dockets", where: "farm_id = $1" },
  { table: "farm_records", where: "farm_id = $1" },
  { table: "applications", where: "farm_id = $1" },
  { table: "application_lines", where: "application_id IN (SELECT id FROM applications WHERE farm_id = $1)" },
  { table: "application_mix", where: "application_id IN (SELECT id FROM applications WHERE farm_id = $1)" },
  { table: "restrictions", where: "farm_id = $1" },
  { table: "application_dockets", where: "application_id IN (SELECT id FROM applications WHERE farm_id = $1)" },
  { table: "application_versions", where: "application_id IN (SELECT id FROM applications WHERE farm_id = $1)" },
  { table: "attachments", where: "farm_id = $1" },
  { table: "map_audit", where: "farm_id = $1" },
];

export interface Backup { format: "pulse-farm-backup"; version: 1; farmId: string; createdAt: string; tables: Record<string, any[]> }

export async function exportFarm(pool: Pool, farmId: string): Promise<Backup> {
  const tables: Record<string, any[]> = {};
  for (const t of TABLES) {
    // row_to_json writes geography as hex EWKB, which reads straight back in
    const r = await pool.query(`SELECT COALESCE(json_agg(t), '[]'::json) AS rows FROM ${t.table} t WHERE ${t.where}`, [farmId]);
    tables[t.table] = r.rows[0].rows;
  }
  return { format: "pulse-farm-backup", version: 1, farmId, createdAt: new Date().toISOString(), tables };
}

/**
 * Every id in the backup gets a new one (and the farm id becomes the target's), wherever it
 * appears: foreign keys, arrays, JSON details and snapshots.
 */
function remap(backup: Backup, targetFarmId: string) {
  const ids = new Map<string, string>([[backup.farmId, targetFarmId]]);
  for (const rows of Object.values(backup.tables)) for (const r of rows) if (r.id && !ids.has(r.id)) ids.set(r.id, crypto.randomUUID());
  let text = JSON.stringify(backup.tables);
  const re = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  text = text.replace(re, m => ids.get(m.toLowerCase()) ?? m);
  return JSON.parse(text) as Record<string, any[]>;
}

export async function restoreFarm(pool: Pool, backup: Backup, targetFarmId: string) {
  if (backup.format !== "pulse-farm-backup") throw new Error("Not a Pulse farm backup");
  const client = await pool.connect();
  try {
    const busy = await client.query(
      `SELECT (SELECT count(*) FROM pastures WHERE farm_id = $1 AND deleted_at IS NULL) + (SELECT count(*) FROM applications WHERE farm_id = $1) AS n`, [targetFarmId]);
    if (Number(busy.rows[0].n) > 0) throw new Error("The target farm already has paddocks or jobs. Restore into an empty farm.");
    const tables = remap(backup, targetFarmId);
    await client.query("BEGIN");
    // Map layers are created for every farm; the backup's replace them
    await client.query("DELETE FROM map_layers WHERE farm_id = $1", [targetFarmId]);
    const counts: Record<string, number> = {};
    for (const t of TABLES) {
      const rows = tables[t.table] ?? [];
      counts[t.table] = rows.length;
      if (!rows.length) continue;
      const cols = (await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND is_generated = 'NEVER' ORDER BY ordinal_position`, [t.table]))
        .rows.map((c: any) => `"${c.column_name}"`);
      await client.query(
        `INSERT INTO ${t.table} (${cols.join(", ")}) SELECT ${cols.join(", ")} FROM json_populate_recordset(NULL::${t.table}, $1::json)`,
        [JSON.stringify(rows)]);
    }
    await client.query("COMMIT");
    return counts;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (cmd === "export" && a) {
      const backup = await exportFarm(pool, a);
      const file = b ?? path.join("backups", `farm-${a}-${backup.createdAt.slice(0, 19).replace(/[:T]/g, "-")}.json`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(backup));
      console.log(`backed up ${Object.entries(backup.tables).map(([t, r]) => `${t} ${r.length}`).join(", ")} to ${file}`);
    } else if (cmd === "restore" && a && b) {
      const counts = await restoreFarm(pool, JSON.parse(fs.readFileSync(a, "utf8")), b);
      console.log(`restored into ${b}: ${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(", ")}`);
    } else {
      console.log("Usage: farm-backup.ts export <farmId> [file] | restore <file> <targetFarmId>");
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "farm-backup.ts"))) {
  main().catch(err => { console.error(err.message ?? err); process.exitCode = 1; });
}
