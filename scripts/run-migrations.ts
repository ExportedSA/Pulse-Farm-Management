// Applies scripts/migrations/*.sql in filename order, once each, recording them in
// the pulse_migrations table. Each file runs in its own transaction.
// An empty database is first set up from scripts/baseline.sql (see make-baseline.ts), which
// records the migrations it already includes.
// Keep shared/schema.ts in step with these files.
// Usage: npx tsx scripts/run-migrations.ts, with DATABASE_URL set to the direct (non-pooled) address
import "dotenv/config";
import fs from "fs";
import path from "path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const dir = path.resolve(import.meta.dirname, "migrations");

async function main() {
  const { rows: [state] } = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'spatial_ref_sys') AS tables,
      to_regclass('public.pulse_migrations') IS NOT NULL AS tracked`);
  if (state.tables === 0) {
    await applyBaseline();
  } else if (!state.tracked) {
    // Tables but no record of which migrations made them: applying them could leave it half-done
    throw new Error(
      `this database has ${state.tables} tables but no pulse_migrations table, so it's not known which ` +
        "migrations it has. Nothing was changed. Use an empty database, or one these migrations set up.",
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pulse_migrations (
      name text PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT now()
    )`);
  const applied = new Set(
    (await pool.query("SELECT name FROM pulse_migrations")).rows.map((r) => r.name),
  );

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
      await client.query("INSERT INTO pulse_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
  console.log("migrations up to date");
}

async function applyBaseline() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(fs.readFileSync(path.resolve(import.meta.dirname, "baseline.sql"), "utf8"));
    await client.query("COMMIT");
    console.log("empty database: set up from baseline.sql");
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(`baseline.sql failed: ${(err as Error).message}`);
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
