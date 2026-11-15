// What a record or job must have before it's saved, beyond what each form marks with a *.
// One place, so the quick record form and the farm-map jobs ask for the same things.
// Anything not covered by a field goes in the notes, which every record and job has.

const has = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== "";
const positive = (v: unknown) => has(v) && Number(v) > 0;

// Fence types, for fence lines on the farm map and fencing records
export const FENCE_TYPES = ["Post and wire", "Electric (permanent)", "Electric (temporary)", "Post and rail", "Netting", "Deer fence", "Boundary fence", "Other"];

// How a medicine was given, for medical (animal treatment) records
export const TREATMENT_ROUTES = ["Injection (muscle)", "Injection (under the skin)", "Injection (vein)", "Oral / drench", "Intramammary (teat)", "Pour-on", "Bolus", "Topical", "Other"];

// What kind of health and safety event a record is
export const HS_KINDS = ["Injury", "Near miss", "Hazard spotted", "Incident (no injury)", "Toolbox talk / training", "Safety inspection"];
export const HS_INJURY = ["No injury", "First aid only", "Medical treatment", "Lost time", "Notifiable to WorkSafe"];

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
 * A saved work job's details in the new-job form's terms, so workJobProblem can judge them
 */
export function detailsAsForm(d: Record<string, any>): Record<string, string | undefined> {
  const s = (x: unknown) => (x == null ? undefined : String(x));
  return {
    feedType: s(d.feedType), baleCount: s(d.baleCount), weighbridge: s(d.weighbridgeTonnes), loads: s(d.loads),
    loadSize: s(d.loadSizeM3), volume: s(d.volumeM3), calDepth: s(d.calibration?.depthMm), calRef: s(d.calibration?.reference),
  };
}

/**
 * What a planned work job still needs before it can be marked done, or null. Same rules as recording
 * it as done in the first place.
 */
export const workDoneProblem = (activity: string, details: Record<string, any>) =>
  workJobProblem(activity, "completed", detailsAsForm(details));

/**
 * What a planned spray job still needs before it can be marked done, or null
 */
export function sprayDoneProblem(job: { target: string | null | undefined; operator: string | null | undefined; contractor: string | null | undefined }): string | null {
  if (!has(job.target)) return "Enter what it was sprayed for (the weed, pest or disease)";
  if (!has(job.operator) && !has(job.contractor)) return "Enter who applied it";
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
