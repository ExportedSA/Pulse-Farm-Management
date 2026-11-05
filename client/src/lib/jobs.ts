// Fertiliser jobs, the product catalogue and dockets (API helpers and types)
// Job writes go through the device outbox when offline (see application-outbox.ts)
import { queued } from "./application-outbox";

export interface CatalogueProduct {
  id: string; farmId: string | null; kind: string; name: string; supplier: string | null; category: string | null;
  formulation: string | null; units: string[]; N: number | null; P: number | null; K: number | null; S: number | null;
  Mg: number | null; Ca: number | null; analysisBasis: string; oxideEntered: any; activeIngredients: any;
  registrationNumber: string | null; labelUrl: string | null; sourceUrl: string | null; sourceNote: string | null;
  verifiedOn: string | null; verification: "verified" | "farm_entered" | "unverified"; aliases: string[]; blend: any;
  notes: string | null; version: number; favourite: boolean | null; nickname: string | null; lastUsedAt: string | null;
  sdsUrl?: string | null;
}
export interface ActiveIngredient { name: string; concentration: number | null; unit: string | null }
export interface MixLine {
  id: string; productId: string; productVersion: number; role: "product" | "adjuvant"; rate: number | null; rateUnit: string;
  labelRef: string | null; actualQuantity: number | null; actualUnit: string | null;
  productSnapshot: { name: string; supplier: string | null; category: string | null; verification: string; verifiedOn: string | null;
    activeIngredients: ActiveIngredient[] | null; formulation: string | null; labelUrl: string | null; sdsUrl: string | null; sourceUrl: string | null };
}
export type RestrictionState = "not_started" | "unresolved" | "not_applicable" | "active" | "ended";
export interface Restriction {
  id: string; mixId: string | null; product: string | null; kind: "grazing" | "harvest" | "reentry" | "other";
  status: "unresolved" | "confirmed" | "not_applicable"; periodValue: number | null; periodUnit: "hours" | "days" | null;
  appliesTo: string | null; ruleSource: string | null; appliesFrom: string | null; endsAt: string | null; notes: string | null;
  confirmedBy: string | null; confirmedAt: string | null; state: RestrictionState;
}
export interface RestrictionPosition { state: "not_started" | "unresolved" | "active" | "clear"; until: string | null }
export interface SprayDetail {
  crop: string | null; target: string | null; waterRate: number | null; tankVolume: number | null; tankLoads: number | null;
  windSpeed: number | null; windDirection: string | null; temperature: number | null; operatorCert: string | null;
  mix: MixLine[]; restrictions: Restriction[];
  totals: {
    netHa: number; waterRate: number | null; waterL: number | null; tankVolume: number | null; tankLoadsPlanned: number | null; tankLoadsUsed: number | null;
    products: { mixId: string; product: string; planned: number | null; plannedUnit: string; reason: string | null; used: number | null; usedUnit: string | null; issues: string[] }[];
  };
  summary: { grazing: RestrictionPosition | null; harvest: RestrictionPosition | null; reentry: RestrictionPosition | null };
}
export interface ActiveRestriction {
  id: string; applicationId: string; kind: string; status: string; endsAt: string | null; periodValue: number | null; periodUnit: string | null;
  ruleSource: string | null; product: string | null; appliedAt: string; title: string | null; target: string | null; areas: string | null;
  geometry: GeoJSON.Geometry | null;
}
export interface JobLine {
  id: string; pastureId: string | null; name: string | null; partial: boolean; grossHa: number; excludedHa: number; netHa: number;
  exclusions: { id: string; name: string; ha: number }[]; productId: string; productVersion: number;
  productSnapshot: { name: string; supplier: string | null; verification: string; verifiedOn: string | null; analysis: Record<string, number | null>; sourceUrl: string | null };
  rate: number | null; rateUnit: string; plannedQuantity: number | null; appliedQuantity: number | null; quantityUnit: string;
  recordId: string | null; geometry: GeoJSON.MultiPolygon;
}
// Spray lines carry no product of their own (productSnapshot is null); the job's mix applies
export interface Docket {
  id: string; number: string; supplier: string | null; docketDate: string | null; productId: string | null; productName: string | null;
  quantity: number | null; unit: string | null; cost: number | null; notes: string | null; allocated: number | null;
  attachments: { id: string; kind: string; url: string; fileName: string | null }[];
}
export interface Job {
  id: string; activity: string; status: "draft" | "planned" | "in_progress" | "completed" | "cancelled"; title: string | null;
  plannedOn: string | null; startedAt: string | null; completedAt: string | null; evidence: "planned" | "manual" | "gps"; planId: string | null;
  supplier: string | null; contractor: string | null; operator: string | null; equipment: string | null; weather: string | null;
  notes: string | null; cost: number | null; version: number; createdBy: string | null; lines: JobLine[]; dockets: Docket[];
  reconciliation: { product: string; plannedKg: number; deliveredKg: number | null; appliedKg: number | null; unknownUnits: boolean; issues: string[] }[];
  nutrients: { basis: "applied" | "planned" | "mixed" | null; kg: Record<string, number>; perHa: Record<string, number> | null; netHa: number; notCounted: string[] } | null;
  spray: SprayDetail | null;
  work: WorkDetail | null;
  linkedJobId: string | null;
  sharedWith: string[];
  gps: null | { source: string; importedAt: string; geometry: GeoJSON.Geometry; trackM: number; trackOutsideM: number; points: number;
    coveredHa: number; coveredPct: number | null; coveredOutsideHa: number };
}
export interface JobHistory {
  events: { action: string; at: string; by: string | null }[];
  changes: { version: number; reason: string | null; at: string; by: string | null; changes: string[] }[];
}
export type Activity = "fertiliser" | "spray" | "effluent" | "slurry" | "baleage" | "silage" | "topping" | "mowing";
export const ACTIVITY_LABELS: Record<Activity, string> = {
  fertiliser: "Fertiliser", spray: "Spray", effluent: "Effluent", slurry: "Slurry",
  baleage: "Baleage", silage: "Silage", topping: "Topping", mowing: "Mowing",
};
// The map layer each activity's jobs are drawn on
export const ACTIVITY_LAYER: Record<Activity, string> = {
  fertiliser: "fertiliser", spray: "spraying", effluent: "effluent", slurry: "slurry",
  baleage: "baleage", silage: "silage", topping: "topping", mowing: "mowing",
};
export const WORK_ACTIVITIES: Activity[] = ["effluent", "slurry", "baleage", "silage", "topping", "mowing"];
export type WorkDetail =
  | { kind: "liquid"; netHa: number; details: Record<string, any>;
      totals: { volumeM3: number | null; volumeSource: string | null; estimate: boolean; rateM3Ha: number | null; depthMm: number | null;
        nutrientsKg: Record<string, number | null> | null; analysis: any; notes: string[] };
      footprint: null | { run: GeoJSON.LineString; wettedWidthM: number; driftM: number; reach: GeoJSON.Geometry;
        outsideHa: number; outside: GeoJSON.Geometry | null; exclusionHa: number; exclusion: GeoJSON.Geometry | null; allowed: string } }
  | { kind: "harvest"; netHa: number; details: Record<string, any>;
      totals: { freshT: number | null; freshBasis: "measured" | "estimated" | null; dmT: number | null; dmBasis: "measured" | "estimated" | null; kgDmPerBale: number | null; notes: string[] };
      mowing: { id: string; status: string; completedAt: string | null } | null }
  | { kind: "field"; netHa: number; details: Record<string, any>; linkedJob: { id: string; activity: string; title: string | null; status: string } | null };
export interface JobSummary {
  id: string; activity: string; status: Job["status"]; title: string | null; plannedOn: string | null; completedAt: string | null;
  evidence: string; contractor: string | null; supplier: string | null; products: string | null; netHa: number | null; dockets: number;
  target: string | null; restriction: SprayDetail["summary"] | null; details: Record<string, any> | null; linkedJobId: string | null;
  sharedWith: string[]; hasGps: boolean;
  lines: { id: string; name: string | null; pastureId: string | null; status: string; product: string; rate: number | null; rateUnit: string; geometry: GeoJSON.MultiPolygon }[] | null;
}
export interface NewLine { key: string; pastureId?: string | null; geometry?: GeoJSON.Geometry | null; name?: string | null; productId?: string | null; rate?: number | null; rateUnit: string; appliedQuantity?: number | null }

export const JOB_STATUSES: { key: Job["status"]; label: string }[] = [
  { key: "draft", label: "Draft" }, { key: "planned", label: "Planned" }, { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" }, { key: "cancelled", label: "Cancelled" },
];
export const FERT_UNITS = ["kg/ha", "t/ha", "L/ha"];
// Hectare rates, and rates per 100 L of water (concentration directions) kept apart
export const SPRAY_UNITS = ["L/ha", "mL/ha", "kg/ha", "g/ha", "L/100L", "mL/100L", "kg/100L", "g/100L"];
export const QTY_UNITS = ["L", "mL", "kg", "g"];
export const WIND_DIRECTIONS = ["Calm", "N", "NE", "E", "SE", "S", "SW", "W", "NW", "Variable"];
export const RESTRICTION_LABELS: Record<Restriction["kind"], string> = { grazing: "Grazing", harvest: "Harvest", reentry: "Re-entry", other: "Other" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body?.error ?? `Request failed (${res.status})`), { status: res.status });
  return body as T;
}
const send = <T,>(method: string, url: string, body?: unknown) =>
  api<T>(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

export const jobsApi = {
  search: (kind: string, q: string) => api<CatalogueProduct[]>(`/api/catalogue?kind=${kind}&q=${encodeURIComponent(q)}&limit=40`),
  product: (id: string) => api<CatalogueProduct>(`/api/catalogue/${id}`),
  sources: () => api<{ id: string; name: string; url: string; coverage: string; retrievedOn: string; notes: string | null }[]>("/api/catalogue/sources"),
  addProduct: (b: any) => send<{ id: string }>("POST", "/api/catalogue", b),
  pref: (id: string, b: { favourite?: boolean; nickname?: string | null }) => send("PUT", `/api/catalogue/${id}/pref`, b),
  list: (q: Record<string, string | undefined>) => api<JobSummary[]>(`/api/applications?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as any)}`),
  get: (id: string) => api<Job>(`/api/applications/${id}`),
  create: (b: any) => queued<Job>("POST", "/api/applications", b, "New job"),
  update: (id: string, b: any) => queued<Job>("PATCH", `/api/applications/${id}`, b, "Job change"),
  applied: (id: string, b: { lineId: string; quantity: number | null }[]) => queued<Job>("PUT", `/api/applications/${id}/applied`, b, "Applied amounts"),
  cancel: (id: string) => send("DELETE", `/api/applications/${id}`),
  addDocket: (id: string, data: any, files: File[]) => {
    const form = new FormData();
    form.append("data", JSON.stringify(data));
    files.forEach(f => form.append("files", f));
    return api<Job>(`/api/applications/${id}/dockets`, { method: "POST", body: form });
  },
  linkDocket: (id: string, docketId: string, allocated?: number | null) => send<Job>("POST", `/api/applications/${id}/dockets`, { docketId, allocated: allocated ?? null }),
  unlinkDocket: (id: string, docketId: string) => send<Job>("DELETE", `/api/applications/${id}/dockets/${docketId}`),
  used: (id: string, b: { tankLoads?: number | null; used: { mixId: string; quantity: number | null; unit: string | null }[] }) => queued<Job>("PUT", `/api/applications/${id}/used`, b, "Quantities used"),
  history: (id: string) => api<JobHistory>(`/api/applications/${id}/history`),
  version: (id: string, v: number) => api<{ data: any; reason: string | null; at: string; by: string | null }>(`/api/applications/${id}/versions/${v}`),
  contractors: () => api<{ id: string; name: string; email: string }[]>("/api/applications/contractors"),
  share: (id: string, userIds: string[]) => send<Job>("PUT", `/api/applications/${id}/share`, { userIds }),
  setGps: (id: string, b: { geometries: GeoJSON.Geometry[]; source: string }) => send<Job>("PUT", `/api/applications/${id}/gps`, b),
  clearGps: (id: string) => send<Job>("DELETE", `/api/applications/${id}/gps`),
  verifyProduct: (id: string, b: { reference: string; labelUrl?: string | null }) => send<CatalogueProduct>("POST", `/api/catalogue/${id}/verify`, b),
  report: (q: Record<string, string | undefined>) => api<any>(`/api/activity-reports?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as any)}`),
  addRestriction: (id: string, b: any) => send<Job>("POST", `/api/applications/${id}/restrictions`, b),
  saveRestriction: (id: string, rid: string, b: any) => send<Job>("PUT", `/api/applications/${id}/restrictions/${rid}`, b),
  deleteRestriction: (id: string, rid: string) => send<Job>("DELETE", `/api/applications/${id}/restrictions/${rid}`),
  restrictions: (q: { pastureId?: string; kind?: string; at?: string }) =>
    api<ActiveRestriction[]>(`/api/restrictions?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as any)}`),
  dockets: (q: string) => api<{ id: string; number: string; supplier: string | null; docketDate: string | null; productName: string | null; quantity: number | null; unit: string | null; jobs: number }[]>(`/api/dockets?q=${encodeURIComponent(q)}`),
};

export const analysisText = (p: Pick<CatalogueProduct, "N" | "P" | "K" | "S" | "Mg" | "Ca">) =>
  (["N", "P", "K", "S", "Mg", "Ca"] as const).filter(k => p[k] != null && (p[k] as number) > 0).map(k => `${k} ${p[k]}`).join(" · ") || (p.N == null ? "analysis not known" : "no N, P, K, S, Mg or Ca");

export const activesText = (a: ActiveIngredient[] | null | undefined) =>
  (a ?? []).map(x => `${x.concentration != null ? `${x.concentration} ${x.unit ?? ""} ` : ""}${x.name}`.trim()).join(" + ") || "active ingredient not listed";
