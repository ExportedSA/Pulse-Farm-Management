// Restore check: back up a farm, restore it into a new temporary farm, compare every table, then
// remove the temporary farm. The original is only read.
//   npx tsx scripts/farm-backup-check.ts [farmId]   (default: the demo owner's farm)
import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { TABLES, exportFarm, restoreFarm } from "./farm-backup";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = async (s: string, p: any[] = []) => (await pool.query(s, p)).rows;
const check = (label: string, ok: boolean, extra = "") => console.log(`${ok ? "PASS" : "FAIL"} ${label}${extra ? ` | ${extra}` : ""}`);

const farmId = process.argv[2] ?? (await q(`SELECT m.farm_id FROM farm_members m JOIN users u ON u.id = m.user_id WHERE u.email = 'owner@demo.com' LIMIT 1`))[0]?.farm_id;
if (!farmId) throw new Error("Give the farm id to check");
let testFarm: string | null = null;
try {
  const backup = await exportFarm(pool, farmId);
  const sizes = Object.fromEntries(Object.entries(backup.tables).map(([t, r]) => [t, r.length]));
  check("backup has the farm's data", sizes.pastures > 0 && sizes.applications > 0, JSON.stringify(sizes));
  [{ id: testFarm }] = await q(`INSERT INTO farms (name) VALUES ('TEST restore farm') RETURNING id`);
  const counts = await restoreFarm(pool, JSON.parse(JSON.stringify(backup)), testFarm!);
  // Same number of rows in every table
  const after: Record<string, number> = {};
  for (const t of TABLES) after[t.table] = Number((await q(`SELECT count(*) AS n FROM ${t.table} WHERE ${t.where}`, [testFarm]))[0].n);
  const diff = TABLES.filter(t => after[t.table] !== sizes[t.table]).map(t => `${t.table} ${sizes[t.table]}→${after[t.table]}`);
  check("every table restored with the same row count", diff.length === 0, diff.join(", ") || `${Object.values(counts).reduce((a, b) => a + b, 0)} rows`);
  // Same areas and quantities
  const sums = async (f: string) => (await q(`
    SELECT (SELECT round(sum(ST_Area(geom))::numeric, 1) FROM paddock_boundaries WHERE farm_id = $1) AS boundary_m2,
           (SELECT round(sum(net_ha)::numeric, 4) FROM application_lines l JOIN applications a ON a.id = l.application_id WHERE a.farm_id = $1) AS net_ha,
           (SELECT count(*) FROM restrictions WHERE farm_id = $1 AND status = 'unresolved') AS unresolved,
           (SELECT count(*) FROM farm_records WHERE farm_id = $1 AND deleted_at IS NULL) AS records,
           (SELECT count(*) FROM application_lines l JOIN farm_records r ON r.id = l.record_id WHERE r.farm_id = $1) AS linked_records`, [f]))[0];
  const a = await sums(farmId), b = await sums(testFarm!);
  check("areas, quantities and links match", JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  // Nothing in the copy points back at the original farm's rows
  const leaks = Number((await q(`SELECT count(*) AS n FROM application_lines l JOIN applications a ON a.id = l.application_id
    WHERE a.farm_id = $1 AND l.pasture_id IN (SELECT id FROM pastures WHERE farm_id = $2)`, [testFarm, farmId]))[0].n);
  check("the copy is independent of the original", leaks === 0);
  const again = await restoreFarm(pool, backup, testFarm!).then(() => "restored twice", e => e.message);
  check("won't restore over a farm that has data", /already has/.test(again), again);
} finally {
  if (testFarm) {
    for (const t of [...TABLES].reverse()) {
      if (t.table === "applications") await q(`UPDATE applications SET linked_job_id = NULL WHERE farm_id = $1`, [testFarm]);
      if (t.table === "farm_records") await q(`UPDATE application_lines SET record_id = NULL WHERE application_id IN (SELECT id FROM applications WHERE farm_id = $1)`, [testFarm]);
      await q(`DELETE FROM ${t.table} WHERE ${t.where}`, [testFarm]);
    }
    await q(`DELETE FROM map_layers WHERE farm_id = $1`, [testFarm]);
    await q(`DELETE FROM farms WHERE id = $1`, [testFarm]);
    console.log("TEST farm removed");
  }
  await pool.end();
}
