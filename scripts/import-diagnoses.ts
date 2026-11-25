// Loads a diagnosis list into the shared conditions list (rows with no farm, which every farm sees in
// the treatment form's Condition / Diagnosis picker). Pulse ships no clinical list of its own: this is
// for a list the farm or its vet supplies, such as MINDA's.
//
// The CSV has a header row with `name` and optionally `code`, `category`, `body_part` (udder or foot).
// Rows are matched to shared rows by code, or by name when there's no code: matches are updated, the
// rest added, and the file's order kept. Nothing is removed. Nothing is written with --dry-run.
//
// Usage: npx tsx scripts/import-diagnoses.ts <file.csv> [--dry-run]
// DATABASE_URL must be the direct (non-pooled) address of the database to change.
import "dotenv/config";
import fs from "fs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { parseDiagnosisCsv } from "../shared/diagnosis-list";

neonConfig.webSocketConstructor = ws;

async function main() {
  const file = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!file) throw new Error("Usage: npx tsx scripts/import-diagnoses.ts <file.csv> [--dry-run]");
  const rows = parseDiagnosisCsv(fs.readFileSync(file, "utf8"));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  let added = 0;
  let updated = 0;
  try {
    await client.query("BEGIN");
    const { rows: existing } = await client.query("SELECT id, code, name FROM conditions WHERE farm_id IS NULL");
    const byCode = new Map(existing.filter((c) => c.code).map((c) => [String(c.code).toLowerCase(), c.id]));
    const byName = new Map(existing.map((c) => [String(c.name).toLowerCase(), c.id]));
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const id = (r.code && byCode.get(r.code.toLowerCase())) || byName.get(r.name.toLowerCase());
      const values = [r.name, r.code, r.category, i + 1, r.bodyPart !== null, r.bodyPart];
      if (id) {
        await client.query(
          `UPDATE conditions SET name = $1, code = $2, category = $3, sort_order = $4, requires_body_part = $5,
             body_part_type = $6, is_active = true, updated_at = now() WHERE id = $7`, [...values, id]);
        updated++;
      } else {
        const { rows: [row] } = await client.query(
          `INSERT INTO conditions (farm_id, name, code, category, sort_order, requires_body_part, body_part_type)
           VALUES (NULL, $1, $2, $3, $4, $5, $6) RETURNING id`, values);
        byName.set(r.name.toLowerCase(), row.id);
        if (r.code) byCode.set(r.code.toLowerCase(), row.id);
        added++;
      }
    }
    await client.query(dryRun ? "ROLLBACK" : "COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
  console.log(`${dryRun ? "Dry run, nothing written: would have" : "Shared diagnosis list:"} added ${added}, updated ${updated}.`);
}

if (process.argv[1] && /import-diagnoses/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}
