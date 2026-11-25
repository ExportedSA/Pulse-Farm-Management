// A diagnosis list as CSV, for the Condition / Diagnosis pick-list (conditions). Pulse ships no
// clinical list of its own: this reads one the farm or its vet supplies, such as MINDA's. Used by the
// Manage screen and scripts/import-diagnoses.ts.
//
// A header row with `name`, and optionally `code`, `category`, `body_part` (udder or foot).

export interface DiagnosisRow { code: string | null; name: string; category: string | null; bodyPart: "udder" | "foot" | null }

/** Splits one CSV line, allowing "quoted, fields" and "" inside quotes */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** The rows of a diagnosis CSV, or an error naming the first problem */
export function parseDiagnosisCsv(text: string): DiagnosisRow[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new Error("The file needs a header row and at least one diagnosis");
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const col = (n: string) => header.indexOf(n);
  if (col("name") < 0) throw new Error("The header row needs a 'name' column");
  return lines.slice(1).map((line, i) => {
    const f = splitCsvLine(line);
    const get = (n: string) => (col(n) >= 0 ? f[col(n)] || null : null);
    const name = get("name");
    if (!name) throw new Error(`Row ${i + 2} has no name`);
    const bp = get("body_part")?.toLowerCase() ?? null;
    if (bp && bp !== "udder" && bp !== "foot") throw new Error(`Row ${i + 2}: body_part must be udder or foot`);
    return { code: get("code"), name, category: get("category"), bodyPart: bp as DiagnosisRow["bodyPart"] };
  });
}
