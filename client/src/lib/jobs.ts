// Fertiliser jobs, the product catalogue and dockets (API helpers and types)

export interface CatalogueProduct {
  id: string; farmId: string | null; kind: string; name: string; supplier: string | null; category: string | null;
  formulation: string | null; units: string[]; N: number | null; P: number | null; K: number | null; S: number | null;
  Mg: number | null; Ca: number | null; analysisBasis: string; oxideEntered: any; activeIngredients: any;
  registrationNumber: string | null; labelUrl: string | null; sourceUrl: string | null; sourceNote: string | null;
  verifiedOn: string | null; verification: "verified" | "farm_entered" | "unverified"; aliases: string[]; blend: any;
  notes: string | null; version: number; favourite: boolean | null; nickname: string | null; lastUsedAt: string | null;
}
export interface JobLine {
  id: string; pastureId: string | null; name: string | null; partial: boolean; grossHa: number; excludedHa: number; netHa: number;
  exclusions: { id: string; name: string; ha: number }[]; productId: string; productVersion: number;
  productSnapshot: { name: string; supplier: string | null; verification: string; verifiedOn: string | null; analysis: Record<string, number | null>; sourceUrl: string | null };
  rate: number | null; rateUnit: string; plannedQuantity: number | null; appliedQuantity: number | null; quantityUnit: string;
  recordId: string | null; geometry: GeoJSON.MultiPolygon;
}
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
  nutrients: { basis: "applied" | "planned" | "mixed" | null; kg: Record<string, number>; perHa: Record<string, number> | null; netHa: number; notCounted: string[] };
}
export interface JobSummary {
  id: string; activity: string; status: Job["status"]; title: string | null; plannedOn: string | null; completedAt: string | null;
  evidence: string; contractor: string | null; supplier: string | null; products: string | null; netHa: number | null; dockets: number;
  lines: { id: string; name: string | null; pastureId: string | null; status: string; product: string; rate: number | null; rateUnit: string; geometry: GeoJSON.MultiPolygon }[] | null;
}
export interface NewLine { key: string; pastureId?: string | null; geometry?: GeoJSON.Geometry | null; name?: string | null; productId?: string | null; rate?: number | null; rateUnit: string; appliedQuantity?: number | null }

export const JOB_STATUSES: { key: Job["status"]; label: string }[] = [
  { key: "draft", label: "Draft" }, { key: "planned", label: "Planned" }, { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" }, { key: "cancelled", label: "Cancelled" },
];
export const FERT_UNITS = ["kg/ha", "t/ha", "L/ha"];

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
  create: (b: any) => send<Job>("POST", "/api/applications", b),
  update: (id: string, b: any) => send<Job>("PATCH", `/api/applications/${id}`, b),
  applied: (id: string, b: { lineId: string; quantity: number | null }[]) => send<Job>("PUT", `/api/applications/${id}/applied`, b),
  cancel: (id: string) => send("DELETE", `/api/applications/${id}`),
  addDocket: (id: string, data: any, files: File[]) => {
    const form = new FormData();
    form.append("data", JSON.stringify(data));
    files.forEach(f => form.append("files", f));
    return api<Job>(`/api/applications/${id}/dockets`, { method: "POST", body: form });
  },
  linkDocket: (id: string, docketId: string, allocated?: number | null) => send<Job>("POST", `/api/applications/${id}/dockets`, { docketId, allocated: allocated ?? null }),
  unlinkDocket: (id: string, docketId: string) => send<Job>("DELETE", `/api/applications/${id}/dockets/${docketId}`),
  dockets: (q: string) => api<{ id: string; number: string; supplier: string | null; docketDate: string | null; productName: string | null; quantity: number | null; unit: string | null; jobs: number }[]>(`/api/dockets?q=${encodeURIComponent(q)}`),
};

export const analysisText = (p: Pick<CatalogueProduct, "N" | "P" | "K" | "S" | "Mg" | "Ca">) =>
  (["N", "P", "K", "S", "Mg", "Ca"] as const).filter(k => p[k] != null && (p[k] as number) > 0).map(k => `${k} ${p[k]}`).join(" · ") || (p.N == null ? "analysis not known" : "no N, P, K, S, Mg or Ca");
