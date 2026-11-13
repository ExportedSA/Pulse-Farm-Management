// Finds `table.column` references in server code that don't exist in shared/schema.ts.
// Drizzle turns a missing column into `undefined`, which only fails at runtime
// (e.g. "Cannot convert undefined or null to object" or `syntax error at or near "="`).
// Usage: npx tsx scripts/check-schema-refs.ts
import fs from "fs";
import path from "path";
import { is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";

const tables = new Map<string, Set<string>>();
for (const [name, value] of Object.entries(schema)) {
  if (is(value, PgTable)) tables.set(name, new Set(Object.keys(value)));
}

const root = path.resolve(import.meta.dirname, "..", "server");
const files: string[] = [];
const walk = (dir: string) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) files.push(full);
  }
};
walk(root);

let problems = 0;
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  // Only check identifiers that this file actually imports from the schema
  const imported = new Set<string>();
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'](?:@shared\/schema|(?:\.\.\/)+shared\/schema)["']/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, "");
      if (tables.has(name)) imported.add(name);
    }
  }
  if (imported.size === 0) continue;

  const lines = src.split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\b([a-zA-Z]+)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g)) {
      const [, table, column] = m;
      if (!imported.has(table)) continue;
      if (tables.get(table)!.has(column)) continue;
      if (["$inferSelect", "$inferInsert", "_", "getSQL"].includes(column)) continue;
      // Local arrays often share a table's name (e.g. `conditions.push(...)`)
      if (column in Array.prototype) continue;
      problems++;
      console.log(`${path.relative(root, file)}:${i + 1}  ${table}.${column}`);
    }
  });
}
console.log(problems ? `\n${problems} reference(s) to columns that do not exist` : "All table.column references exist");
