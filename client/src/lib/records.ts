// Farm Records: record types, the API, and an offline outbox so records (with their
// photos) captured without signal are kept on the device and uploaded later.
import type { AreaGeometry } from "@shared/geo";

export type RecordType =
  | "spray" | "fertiliser" | "feed_in" | "baleage" | "effluent"
  | "fencing" | "job_done" | "maintenance" | "medical" | "health_safety" | "note" | "document";

export interface FieldDef {
  key: string;
  label: string;
  kind: "text" | "number" | "select" | "date";
  options?: string[];
  unit?: string;
  required?: boolean;
  placeholder?: string;
}

export interface RecordTypeDef {
  type: RecordType;
  label: string;
  color: string;
  defaultTags: string[];
  // Whether the record is usually tied to an area of the farm
  mapped: boolean;
  fields: FieldDef[];
  // The details key that best names the record, used to suggest a title
  titleFrom?: string;
}

export const RECORD_TYPES: RecordTypeDef[] = [
  {
    type: "spray", label: "Spray", color: "#9c36b5", defaultTags: ["Spray"], mapped: true, titleFrom: "product",
    fields: [
      { key: "product", label: "Chemical / product", kind: "text", required: true, placeholder: "e.g. Tordon Brushkiller" },
      { key: "activeIngredient", label: "Active ingredient", kind: "text", placeholder: "e.g. triclopyr + picloram" },
      { key: "rate", label: "Rate", kind: "number", required: true },
      { key: "rateUnit", label: "Rate unit", kind: "select", options: ["L/ha", "mL/ha", "kg/ha", "g/ha", "mL/10L"] },
      { key: "waterRate", label: "Water rate", kind: "number", unit: "L/ha" },
      { key: "target", label: "Target weed or pest", kind: "text", placeholder: "e.g. thistles, gorse" },
      { key: "withholdingDays", label: "Grazing withholding", kind: "number", unit: "days" },
      { key: "windDirection", label: "Wind direction", kind: "select", options: ["Calm", "N", "NE", "E", "SE", "S", "SW", "W", "NW"] },
      { key: "windSpeed", label: "Wind speed", kind: "number", unit: "km/h" },
      { key: "temperature", label: "Temperature", kind: "number", unit: "°C" },
      { key: "operator", label: "Applied by", kind: "text" },
      { key: "operatorCert", label: "Operator certificate no.", kind: "text", placeholder: "e.g. Growsafe number" },
    ],
  },
  {
    type: "fertiliser", label: "Fertiliser", color: "#5c940d", defaultTags: ["Fertiliser"], mapped: true, titleFrom: "product",
    fields: [
      { key: "product", label: "Product", kind: "text", required: true, placeholder: "e.g. Urea, SustaiN, Superten" },
      { key: "rate", label: "Rate", kind: "number", required: true, unit: "kg/ha" },
      { key: "nPercent", label: "Nitrogen (N)", kind: "number", unit: "%" },
      { key: "pPercent", label: "Phosphorus (P)", kind: "number", unit: "%" },
      { key: "kPercent", label: "Potassium (K)", kind: "number", unit: "%" },
      { key: "sPercent", label: "Sulphur (S)", kind: "number", unit: "%" },
      { key: "applicator", label: "Spread by", kind: "text", placeholder: "Owner, or contractor name" },
      { key: "docketNumber", label: "Docket number", kind: "text" },
    ],
  },
  {
    type: "baleage", label: "Baleage / silage", color: "#a87d10", defaultTags: ["Feed"], mapped: true, titleFrom: "kind",
    fields: [
      { key: "kind", label: "Made", kind: "select", options: ["Baleage", "Silage pit", "Hay", "Balage (wrapped)"], required: true },
      { key: "bales", label: "Bales", kind: "number" },
      { key: "kgDmPerBale", label: "kg DM per bale", kind: "number" },
      { key: "contractor", label: "Contractor", kind: "text" },
      { key: "wrapType", label: "Wrap", kind: "text" },
      { key: "stackLocation", label: "Stored at", kind: "text", placeholder: "e.g. by the cow shed" },
    ],
  },
  {
    type: "feed_in", label: "Feed in", color: "#c2410c", defaultTags: ["Feed"], mapped: false, titleFrom: "product",
    fields: [
      { key: "supplier", label: "Supplier", kind: "text", required: true },
      { key: "product", label: "Feed", kind: "text", required: true, placeholder: "e.g. PKE, barley, hay" },
      { key: "quantity", label: "Quantity", kind: "number" },
      { key: "unit", label: "Unit", kind: "select", options: ["t", "kg", "bales", "m³"] },
      { key: "docketNumber", label: "Docket number", kind: "text" },
      { key: "declaration", label: "Supplier feed declaration", kind: "select", options: ["On file", "Requested", "Not provided"] },
      { key: "cost", label: "Cost", kind: "number", unit: "NZD" },
    ],
  },
  {
    type: "effluent", label: "Effluent", color: "#5f3dc4", defaultTags: ["Effluent"], mapped: true,
    fields: [
      { key: "depthMm", label: "Depth applied", kind: "number", unit: "mm" },
      { key: "volumeM3", label: "Volume", kind: "number", unit: "m³" },
      { key: "pondLevel", label: "Pond level", kind: "number", unit: "%" },
      { key: "soilCondition", label: "Soil condition", kind: "select", options: ["Dry", "Moist", "Wet", "Saturated"] },
    ],
  },
  {
    type: "document", label: "Document", color: "#495057", defaultTags: ["Compliance"], mapped: false, titleFrom: "documentType",
    fields: [
      { key: "documentType", label: "Document", kind: "select", required: true, options: [
        "Feed declaration", "Consent", "Certificate", "Spray plan", "Nutrient budget", "Farm plan", "Contract", "Invoice", "Other",
      ] },
      { key: "issuer", label: "From", kind: "text", placeholder: "Supplier, council, vet…" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "expiryDate", label: "Expires", kind: "date" },
    ],
  },
  { type: "fencing", label: "Fencing", color: "#7a5c2e", defaultTags: ["Fencing"], mapped: true, fields: [] },
  { type: "job_done", label: "Job done", color: "#2c6a3f", defaultTags: ["Job done"], mapped: false, fields: [] },
  { type: "maintenance", label: "Maintenance", color: "#1971c2", defaultTags: ["Maintenance"], mapped: false, fields: [] },
  { type: "medical", label: "Medical", color: "#b03a48", defaultTags: ["Medical"], mapped: false, fields: [] },
  { type: "health_safety", label: "Health & safety", color: "#d9480f", defaultTags: ["Health & safety"], mapped: false, fields: [] },
  { type: "note", label: "Note", color: "#868e96", defaultTags: [], mapped: false, fields: [] },
];

export const recordTypeDef = (type: string): RecordTypeDef =>
  RECORD_TYPES.find(t => t.type === type) ?? RECORD_TYPES[RECORD_TYPES.length - 1];

export interface RecordTag { id: string; name: string; slug: string; color: string | null }
export interface RecordAttachment {
  id: string; kind: "photo" | "voice" | "document"; url: string; fileName: string | null; caption: string | null;
}
export interface FarmRecord {
  id: string;
  type: RecordType;
  title: string;
  notes: string | null;
  occurredAt: string;
  paddocks: { id: string; name: string }[];
  latitude: number | null;
  longitude: number | null;
  area: AreaGeometry | null;
  areaHa: number | null;
  details: Record<string, any>;
  tags: RecordTag[];
  attachments: RecordAttachment[];
  recordedBy: { id: string; name: string };
  createdAt: string;
}

export interface RecordDraft {
  type: RecordType;
  title: string;
  notes?: string;
  occurredAt: string;
  pastureIds: string[];
  latitude?: number | null;
  longitude?: number | null;
  area?: AreaGeometry | null;
  details: Record<string, any>;
  tags: string[];
}

/**
 * Short summary of the details, e.g. "Tordon · 2.5 L/ha · 7 day withholding"
 */
export function detailSummary(record: Pick<FarmRecord, "type" | "details">): string {
  const d = record.details ?? {};
  const has = (v: unknown) => v !== undefined && v !== null && v !== "";
  const parts: string[] = [];
  switch (record.type) {
    case "spray":
      if (has(d.product)) parts.push(d.product);
      if (has(d.rate)) parts.push(`${d.rate} ${d.rateUnit ?? "L/ha"}`);
      if (has(d.withholdingDays)) parts.push(`${d.withholdingDays} day withholding`);
      break;
    case "fertiliser":
      if (has(d.product)) parts.push(d.product);
      if (has(d.rate)) parts.push(`${d.rate} kg/ha`);
      if (has(d.rate) && has(d.nPercent)) parts.push(`${Math.round(Number(d.rate) * Number(d.nPercent)) / 100} kg N/ha`);
      break;
    case "feed_in":
      if (has(d.product)) parts.push(d.product);
      if (has(d.quantity)) parts.push(`${d.quantity} ${d.unit ?? ""}`.trim());
      if (has(d.supplier)) parts.push(d.supplier);
      if (has(d.declaration)) parts.push(`Declaration: ${d.declaration.toLowerCase()}`);
      break;
    case "baleage":
      if (has(d.kind)) parts.push(d.kind);
      if (has(d.bales)) parts.push(`${d.bales} bales`);
      if (has(d.contractor)) parts.push(d.contractor);
      break;
    case "effluent":
      if (has(d.depthMm)) parts.push(`${d.depthMm} mm`);
      if (has(d.volumeM3)) parts.push(`${d.volumeM3} m³`);
      break;
    case "document":
      if (has(d.documentType)) parts.push(d.documentType);
      if (has(d.issuer)) parts.push(d.issuer);
      if (has(d.expiryDate)) parts.push(`expires ${d.expiryDate}`);
      break;
  }
  return parts.join(" · ");
}

// ===== API =====

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.details?.[0]?.message;
    throw Object.assign(new Error(detail || body?.error || `Request failed (${res.status})`), { status: res.status });
  }
  return body as T;
}

export const fetchRecords = (params: URLSearchParams) => apiJson<FarmRecord[]>(`/api/records?${params}`);
export const fetchTags = () => apiJson<(RecordTag & { isDefault: boolean })[]>("/api/tags");
export const deleteRecord = (id: string) => apiJson(`/api/records/${id}`, { method: "DELETE" });

function recordForm(draft: RecordDraft, clientId: string, files: File[] | Blob[]): FormData {
  const form = new FormData();
  form.append("data", JSON.stringify({ ...draft, clientId }));
  files.forEach((file, i) => form.append("files", file, (file as File).name ?? `file-${i}`));
  return form;
}

// ===== OFFLINE OUTBOX =====

interface OutboxItem {
  clientId: string;
  draft: RecordDraft;
  files: { name: string; type: string; blob: Blob }[];
  createdAt: string;
  error?: string;
}

const DB_NAME = "pulse-records";
const STORE = "outbox";
const OUTBOX_EVENT = "pulse:outbox-changed";

function openOutbox(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "clientId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function outboxRequest<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openOutbox();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function listOutbox(): Promise<OutboxItem[]> {
  try {
    return await outboxRequest("readonly", s => s.getAll() as IDBRequest<OutboxItem[]>);
  } catch {
    return [];
  }
}

const notifyOutbox = () => window.dispatchEvent(new Event(OUTBOX_EVENT));
export const onOutboxChange = (cb: () => void) => {
  window.addEventListener(OUTBOX_EVENT, cb);
  return () => window.removeEventListener(OUTBOX_EVENT, cb);
};

/**
 * Save a record: straight to the server when online, otherwise into the outbox.
 * Returns whether it was saved now or queued.
 */
export async function saveRecord(draft: RecordDraft, files: File[]): Promise<"saved" | "queued"> {
  const clientId = crypto.randomUUID();
  if (navigator.onLine) {
    try {
      await apiJson("/api/records", { method: "POST", body: recordForm(draft, clientId, files) });
      return "saved";
    } catch (error: any) {
      // A rejected record (bad input) is shown to the user; only connection failures are queued
      if (error?.status) throw error;
    }
  }
  const item: OutboxItem = {
    clientId,
    draft,
    files: files.map(f => ({ name: f.name, type: f.type, blob: f })),
    createdAt: new Date().toISOString(),
  };
  await outboxRequest("readwrite", s => s.put(item));
  notifyOutbox();
  return "queued";
}

let draining = false;

/**
 * Upload queued records. Each keeps its clientId, so a retry never makes a duplicate.
 */
export async function drainOutbox(): Promise<number> {
  if (draining || !navigator.onLine) return 0;
  draining = true;
  let sent = 0;
  try {
    for (const item of await listOutbox()) {
      const files = item.files.map(f => new File([f.blob], f.name, { type: f.type }));
      try {
        await apiJson("/api/records", { method: "POST", body: recordForm(item.draft, item.clientId, files) });
        await outboxRequest("readwrite", s => s.delete(item.clientId));
        sent++;
      } catch (error: any) {
        if (!error?.status) break; // still offline; try again later
        await outboxRequest("readwrite", s => s.put({ ...item, error: error.message }));
      }
    }
  } finally {
    draining = false;
    notifyOutbox();
  }
  return sent;
}

export async function discardOutboxItem(clientId: string) {
  await outboxRequest("readwrite", s => s.delete(clientId));
  notifyOutbox();
}
