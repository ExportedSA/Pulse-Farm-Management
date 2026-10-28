// Applies scripts/migrations/*.sql in filename order, once each, recording them in
// the pulse_migrations table. Each file runs in its own transaction.
// Keep shared/schema.ts in step with these files.
// Usage: npx tsx scripts/run-migrations.ts
import "dotenv/config";
import fs from "fs";
import path from "path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const dir = path.resolve(import.meta.dirname, "migrations");

async function main() {
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

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
