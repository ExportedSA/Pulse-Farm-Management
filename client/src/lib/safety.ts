// Health & safety: the hazard register (hazards can be drawn on the farm map) and the farm's
// safety documents, from /api/compliance
export { HAZARD_CATEGORIES, HAZARD_STATUSES, POI_TYPES, SAFETY_DOCUMENT_TYPES, hazardCategoryLabel, poiType, riskColour, safetyDocumentLabel } from "@shared/safety";

export interface Attachment { id: string; kind: string; url: string; fileName: string | null; mimeType: string | null; fileSize: number | null; createdAt: string }

export interface Hazard {
  id: string; title: string; type: string; description: string | null; riskLevel: number | null; severity: string | null;
  status: "active" | "monitoring" | "resolved"; location: string | null; controls: string | null; reviewDue: string | null;
  assignedTo: string | null; reportedBy: string | null; reportedByName: string | null; resolvedAt: string | null;
  createdAt: string; updatedAt: string; radiusM: number | null; geometry: GeoJSON.Geometry | null; photos?: Attachment[];
}

export interface HazardInput {
  title: string; type: string; description?: string | null; riskLevel: number; controls?: string | null; location?: string | null;
  status?: Hazard["status"]; reviewDue?: string | null; geometry?: GeoJSON.Geometry | null; radiusM?: number | null;
}

export interface SafetyDocument {
  id: string; title: string; docType: string; reviewDue: string | null; notes: string | null; createdAt: string; updatedAt: string;
  archivedAt: string | null; createdByName: string | null; files: Attachment[];
}

export const HAZARDS_KEY = ["/api/compliance/hazards"];
export const DOCUMENTS_KEY = ["/api/compliance/documents"];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body?.error ?? `Request failed (${res.status})`), { status: res.status });
  return body as T;
}
const send = <T,>(method: string, url: string, body?: unknown) =>
  api<T>(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const upload = <T,>(url: string, files: File[], data?: unknown) => {
  const form = new FormData();
  files.forEach(f => form.append("files", f));
  if (data !== undefined) form.append("data", JSON.stringify(data));
  return api<T>(url, { method: "POST", body: form });
};

export const safety = {
  hazards: (includeResolved = false) => api<Hazard[]>(`/api/compliance/hazards${includeResolved ? "?all=1" : ""}`),
  hazard: (id: string) => api<Hazard>(`/api/compliance/hazards/${id}`),
  createHazard: (b: HazardInput) => send<{ id: string }>("POST", "/api/compliance/hazards", b),
  updateHazard: (id: string, b: Partial<HazardInput>) => send<Hazard>("PATCH", `/api/compliance/hazards/${id}`, b),
  resolveHazard: (id: string) => send<Hazard>("POST", `/api/compliance/hazards/${id}/resolve`),
  addHazardPhotos: (id: string, files: File[]) => upload<Attachment[]>(`/api/compliance/hazards/${id}/photos`, files),
  documents: (includeArchived = false) => api<SafetyDocument[]>(`/api/compliance/documents${includeArchived ? "?all=1" : ""}`),
  createDocument: (b: { title: string; docType: string; reviewDue?: string | null; notes?: string | null }, files: File[]) =>
    upload<{ id: string }>("/api/compliance/documents", files, b),
  updateDocument: (id: string, b: Partial<{ title: string; docType: string; reviewDue: string | null; notes: string | null; archived: boolean }>) =>
    send("PATCH", `/api/compliance/documents/${id}`, b),
  addDocumentFiles: (id: string, files: File[]) => upload<Attachment[]>(`/api/compliance/documents/${id}/files`, files),
};

export const riskText = (risk: number | null | undefined) => (risk == null ? "Not scored" : `Risk ${risk} of 5`);
