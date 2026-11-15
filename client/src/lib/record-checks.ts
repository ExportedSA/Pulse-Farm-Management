// What a record or job must have before it's saved, beyond what each form marks with a *.
// One place, so the quick record form and the farm-map jobs ask for the same things.
// Anything not covered by a field goes in the notes, which every record and job has.

const has = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== "";
const positive = (v: unknown) => has(v) && Number(v) > 0;

// What was cut, for baleage and silage (records and jobs)
export const FEED_TYPES = [
  "Pasture", "Lucerne", "Clover", "Cereal (oats, barley, triticale)", "Maize", "Brassica / fodder crop", "Other (say in notes)",
];

/**
 * A quick record's problems, as the names of what's missing (shown as "Still needed: …")
 */
export function recordProblems(type: string, d: Record<string, any>): string[] {
  if (type === "spray") {
    const products: { product: string; rate: unknown }[] = d.products ?? [];
    if (!products.some(p => p.product?.trim() && has(p.rate))) return ["at least one product with its rate"];
    if (products.some(p => p.product?.trim() && !has(p.rate))) return ["a rate for every product"];
  }
  if (type === "fertiliser") {
    const problems = [];
    if (!has(d.product)) problems.push("Product");
    if (!has(d.rate) && !has(d.amountApplied)) problems.push("Rate or total applied");
    return problems;
  }
  // A silage pit is measured in tonnes, not bales
  if (type === "baleage" && d.kind && d.kind !== "Silage pit" && !positive(d.bales)) return ["Bales"];
  if (type === "effluent" && !positive(d.depthMm) && !positive(d.volumeM3)) return ["Depth or volume applied"];
  return [];
}

/**
 * A new farm-map work job's problem (effluent, slurry, baleage, silage, topping, mowing), or null.
 * Planned jobs only need what's known in advance; work recorded as done needs its quantities.
 * v is the form's values, as typed.
 */
export function workJobProblem(activity: string, status: "planned" | "completed", v: Record<string, string | undefined>): string | null {
  const harvest = activity === "baleage" || activity === "silage";
  const liquid = activity === "effluent" || activity === "slurry";
  if (harvest && !has(v.feedType)) return "Choose what was cut (pasture, lucerne, a crop…)";
  if (status !== "completed") return null;
  if (activity === "baleage" && !positive(v.baleCount)) return "Enter how many bales were made";
  if (activity === "silage" && !positive(v.weighbridge) && !positive(v.loads)) return "Enter the weighbridge tonnes, or the number of loads";
  if (liquid && !positive(v.volume) && !(positive(v.loads) && positive(v.loadSize)) && !(positive(v.calDepth) && has(v.calRef))) {
    return "Enter the volume applied (choose \"estimate\" if it's an estimate), or a documented calibration";
  }
  return null;
}

/**
 * A new spray job's problem, or null. Rates come from the label, so they're needed even to plan.
 */
export function sprayJobProblem(status: "planned" | "completed", rows: { rate: string }[], target: string): string | null {
  if (rows.some(r => !positive(r.rate))) return "Enter the rate for every product, from the label";
  if (status === "completed" && !has(target)) return "Enter what it was sprayed for (the weed, pest or disease)";
  return null;
}
