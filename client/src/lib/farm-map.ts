// Farm map: data from /api/farm-map, basemaps, and reading/writing KML, KMZ and GeoJSON files
import { gpx as gpxToGeoJSON, kml as kmlToGeoJSON } from "@tmcw/togeojson";
import JSZip from "jszip";

export interface LayerStyle { color: string; fillColor: string; fillOpacity: number; weight: number; dashArray: string | null }
export interface MapLayer { id: string; key: string; name: string; kind: "system" | "custom"; sortOrder: number; visible: boolean; locked: boolean; style: LayerStyle }
export interface MapPaddock {
  id: string; name: string; paddockNumber: number | null; recordedAreaHa: number | null; status: string | null;
  boundaryId: string | null; areaHa: number | null; boundaryFrom: string | null; geometry: GeoJSON.MultiPolygon | null; versions: number;
}
export interface MapFeature {
  id: string; layerId: string; kind: "point" | "line" | "polygon" | "circle"; name: string | null; notes: string | null;
  properties: Record<string, any>; radiusM: number | null; version: number; updatedAt: string;
  geometry: GeoJSON.Geometry; areaHa: number | null; lengthM: number | null;
}
export interface MapView { id: string; name: string; lat: number; lng: number; zoom: number; basemap: string; layers: Record<string, boolean>; createdAt: string }
export interface Exclusion {
  id: string; name: string; reason: string | null; activities: string[]; sourceKind: "area" | "around" | "edge";
  featureId: string | null; pastureId: string | null; bufferM: number; permanent: boolean; startsOn: string | null; endsOn: string | null;
  requirementSource: string | null; confirmedBy: string | null; confirmedOn: string | null; version: number;
  geometry: GeoJSON.MultiPolygon; areaHa: number; status: "active" | "upcoming" | "ended";
}
export interface PlanSummary { id: string; name: string; activity: string; status: "draft" | "approved" | "cancelled"; plannedOn: string | null; approvedAt: string | null; zones: number }
export interface RateZone {
  id: string; pastureId: string | null; name: string | null; productName: string | null; productId: string | null;
  rate: number | null; rateUnit: string; grossHa: number | null; excludedHa: number | null; netHa: number | null;
  quantity: number | null; quantityUnit: string | null; sortOrder: number; geometry: GeoJSON.MultiPolygon;
}
export interface RatePlan {
  id: string; name: string; activity: string; status: PlanSummary["status"]; plannedOn: string | null; pastureIds: string[];
  notes: string | null; approvedAt: string | null; snapshot: any; zones: RateZone[];
  totals: { product: string; unit: string; quantity: number; netHa: number }[];
  check: null | {
    overlaps: { zones: string[]; names: string; ha: number; geometry: GeoJSON.Geometry }[];
    gapHa: number; gapGeometry: GeoJSON.Geometry | null; hasGaps: boolean; outsideHa: number; outsideGeometry: GeoJSON.Geometry | null;
  };
}
export interface AreaBreakdown { grossHa: number; excludedHa: number; netHa: number; exclusions: { id: string; name: string; bufferM: number; ha: number }[] }
// A hazard from the register that isn't resolved; geometry is null until it's drawn on the map
export interface MapHazard {
  id: string; title: string; type: string; riskLevel: number | null; status: string; location: string | null;
  controls: string | null; reviewDue: string | null; radiusM: number | null; geometry: GeoJSON.Geometry | null;
}
export interface MapState { layers: MapLayer[]; paddocks: MapPaddock[]; features: MapFeature[]; views: MapView[]; exclusions: Exclusion[]; plans: PlanSummary[]; hazards: MapHazard[] }

export const EXCLUSION_ACTIVITIES = [
  { key: "all", label: "Everything" },
  { key: "fertiliser", label: "Fertiliser" },
  { key: "effluent", label: "Effluent" },
  { key: "slurry", label: "Slurry" },
  { key: "spraying", label: "Spraying" },
];
export const PLAN_ACTIVITIES = EXCLUSION_ACTIVITIES.filter(a => a.key !== "all");
export const RATE_UNITS = ["kg/ha", "t/ha", "g/ha", "L/ha", "mL/ha", "m3/ha"];

export type ExclusionInput = {
  name: string; reason?: string | null; activities: string[]; sourceKind: Exclusion["sourceKind"];
  geometry?: GeoJSON.Geometry | null; featureId?: string | null; pastureId?: string | null; bufferM: number;
  permanent: boolean; startsOn?: string | null; endsOn?: string | null; requirementSource?: string | null;
  confirmedBy?: string | null; confirmedOn?: string | null;
};
export type ZoneInput = { geometry?: GeoJSON.Geometry | null; wholePaddockId?: string | null; name?: string | null; productName?: string | null; productId?: string | null; rate?: number | null; rateUnit?: string };
export interface BoundaryVersion { id: string; areaHa: number; validFrom: string; validTo: string | null; note: string | null; by: string | null; geometry: GeoJSON.MultiPolygon }

export const FARM_MAP_KEY = ["/api/farm-map"];

// Record types shown on each activity layer
export const LAYER_RECORD_TYPES: Record<string, string[]> = {
  fertiliser: ["fertiliser"],
  effluent: ["effluent"],
  spraying: ["spray"],
  baleage: ["baleage"],
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body?.error ?? `Request failed (${res.status})`), { status: res.status });
  return body as T;
}
const send = <T,>(method: string, url: string, body?: unknown) =>
  api<T>(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

export const farmMap = {
  state: () => api<MapState>("/api/farm-map"),
  createPaddock: (b: { name: string; paddockNumber?: number | null; geometry: GeoJSON.Geometry; note?: string }) => send<{ id: string; areaHa: number }>("POST", "/api/farm-map/paddocks", b),
  setBoundary: (id: string, b: { geometry: GeoJSON.Geometry | null; note?: string; updateRecordedArea?: boolean }) => send<{ areaHa: number }>("PUT", `/api/farm-map/paddocks/${id}/boundary`, b),
  updatePaddock: (id: string, b: { name?: string; paddockNumber?: number | null }) => send("PATCH", `/api/farm-map/paddocks/${id}`, b),
  archivePaddock: (id: string) => send("DELETE", `/api/farm-map/paddocks/${id}`),
  split: (id: string, line: GeoJSON.LineString, newName: string) => send<{ kept: { areaHa: number }; created: { id: string; name: string; areaHa: number } }>("POST", `/api/farm-map/paddocks/${id}/split`, { line, newName }),
  merge: (keepId: string, otherIds: string[]) => send<{ areaHa: number }>("POST", "/api/farm-map/paddocks/merge", { keepId, otherIds }),
  history: (id: string) => api<BoundaryVersion[]>(`/api/farm-map/paddocks/${id}/history`),
  createFeature: (b: { layerId: string; kind: MapFeature["kind"]; name?: string | null; notes?: string | null; geometry: GeoJSON.Geometry; radiusM?: number | null; properties?: Record<string, unknown> }) => send<{ id: string }>("POST", "/api/farm-map/features", b),
  updateFeature: (id: string, b: Partial<{ layerId: string; name: string | null; notes: string | null; geometry: GeoJSON.Geometry; radiusM: number | null; version: number }>) => send("PATCH", `/api/farm-map/features/${id}`, b),
  deleteFeature: (id: string) => send("DELETE", `/api/farm-map/features/${id}`),
  createLayer: (b: { name: string; color?: string }) => send<{ id: string }>("POST", "/api/farm-map/layers", b),
  updateLayer: (id: string, b: Partial<{ name: string; visible: boolean; locked: boolean; sortOrder: number; style: Partial<LayerStyle> }>) => send("PATCH", `/api/farm-map/layers/${id}`, b),
  deleteLayer: (id: string) => send("DELETE", `/api/farm-map/layers/${id}`),
  saveView: (b: Omit<MapView, "id" | "createdAt">) => send<{ id: string }>("POST", "/api/farm-map/views", b),
  deleteView: (id: string) => send("DELETE", `/api/farm-map/views/${id}`),
  importShapes: (b: { as: "paddocks" | "layer"; layerId?: string; items: ImportItem[] }) => send<{ created: number; skipped: { name: string | null; reason: string }[] }>("POST", "/api/farm-map/import", b),
  exportGeoJSON: (opts?: { layers?: string[]; paddocks?: boolean; exclusions?: boolean }) => {
    const q = new URLSearchParams();
    if (opts?.layers) q.set("layers", opts.layers.join(","));
    if (opts?.paddocks === false) q.set("paddocks", "0");
    if (opts?.exclusions === false) q.set("exclusions", "0");
    return api<GeoJSON.FeatureCollection>(`/api/farm-map/export.geojson${q.toString() ? `?${q}` : ""}`);
  },
  areas: (pastureId: string, activity: string, date?: string) => api<AreaBreakdown>(`/api/farm-map/paddocks/${pastureId}/areas?activity=${activity}${date ? `&date=${date}` : ""}`),
  createExclusion: (b: ExclusionInput) => send<{ id: string; areaHa: number }>("POST", "/api/farm-map/exclusions", b),
  updateExclusion: (id: string, b: Partial<ExclusionInput> & { version?: number }) => send("PATCH", `/api/farm-map/exclusions/${id}`, b),
  deleteExclusion: (id: string) => send("DELETE", `/api/farm-map/exclusions/${id}`),
  createPlan: (b: { name: string; activity: string; plannedOn?: string | null; pastureIds: string[]; notes?: string | null }) => send<{ id: string }>("POST", "/api/farm-map/plans", b),
  plan: (id: string) => api<RatePlan>(`/api/farm-map/plans/${id}`),
  updatePlan: (id: string, b: Partial<{ name: string; activity: string; plannedOn: string | null; pastureIds: string[]; notes: string | null }>) => send("PATCH", `/api/farm-map/plans/${id}`, b),
  addZone: (planId: string, b: ZoneInput) => send<{ id: string }>("POST", `/api/farm-map/plans/${planId}/zones`, b),
  updateZone: (id: string, b: ZoneInput) => send("PATCH", `/api/farm-map/zones/${id}`, b),
  deleteZone: (id: string) => send("DELETE", `/api/farm-map/zones/${id}`),
  approvePlan: (id: string, acceptGaps: boolean) => send<RatePlan>("POST", `/api/farm-map/plans/${id}/approve`, { acceptGaps }),
  copyPlan: (id: string) => send<{ id: string }>("POST", `/api/farm-map/plans/${id}/copy`),
  cancelPlan: (id: string) => send("DELETE", `/api/farm-map/plans/${id}`),
};

// ===== Basemaps =====

export interface Basemap {
  key: string;
  label: string;
  available: boolean;
  why?: string;
  attribution: string;
  captureNote: string;
  url?: string;
  maxNativeZoom: number;
}

const env = (import.meta as any).env ?? {};

export const BASEMAPS: Basemap[] = [
  {
    key: "esri",
    label: "Esri World Imagery",
    available: true,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    captureNote: "Capture dates vary and aren't shown by this source.",
    maxNativeZoom: 19,
  },
  {
    key: "linz",
    label: "LINZ aerial (NZ)",
    available: !!env.VITE_LINZ_BASEMAPS_KEY,
    why: "Needs a LINZ Basemaps API key (free) in VITE_LINZ_BASEMAPS_KEY",
    url: env.VITE_LINZ_BASEMAPS_KEY
      ? `https://basemaps.linz.govt.nz/v1/tiles/aerial/WebMercatorQuad/{z}/{x}/{y}.webp?api=${env.VITE_LINZ_BASEMAPS_KEY}`
      : undefined,
    attribution: "© Toitū Te Whenua Land Information New Zealand, CC BY 4.0",
    captureNote: "Capture dates vary by region; see the LINZ Data Service for each survey.",
    maxNativeZoom: 21,
  },
  {
    key: "google",
    label: "Google satellite",
    available: !!env.VITE_GOOGLE_MAPS_API_KEY,
    why: "Needs a Google Maps Platform key with the Map Tiles API enabled in VITE_GOOGLE_MAPS_API_KEY",
    attribution: "Google",
    captureNote: "Imagery dates are shown by Google in the attribution where available.",
    maxNativeZoom: 20,
  },
];

const GOOGLE_KEY: string | undefined = env.VITE_GOOGLE_MAPS_API_KEY;
const SESSION_KEY = "pulse-google-tiles-session";

/**
 * A Google Map Tiles API session for satellite imagery. A session lasts about two weeks, so it's
 * kept on the device and reused instead of starting a new one each time the map opens.
 */
export async function googleSession(): Promise<{ session: string; key: string }> {
  if (!GOOGLE_KEY) throw new Error("No Google Maps key");
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    // Reuse it if it's for this key and has more than an hour left
    if (saved?.key === GOOGLE_KEY && Number(saved.expiry) * 1000 > Date.now() + 3600_000) return { session: saved.session, key: GOOGLE_KEY };
  } catch { /* not readable: start a new one */ }
  const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${GOOGLE_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mapType: "satellite", language: "en-NZ", region: "NZ" }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.session) throw new Error(body?.error?.message ?? "Google imagery couldn't be loaded");
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ key: GOOGLE_KEY, session: body.session, expiry: body.expiry })); } catch { /* private mode */ }
  return { session: body.session, key: GOOGLE_KEY };
}
export function forgetGoogleSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* nothing kept */ }
}
export const googleTileUrl = (s: { session: string; key: string }) => `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${s.session}&key=${s.key}`;

/**
 * The imagery everyone starts on: Google satellite when the farm's app has a key, then LINZ, then Esri
 */
export const defaultBasemap = () => (BASEMAPS.find(b => b.key === "google")?.available ? "google" : BASEMAPS.find(b => b.key === "linz")?.available ? "linz" : "esri");

// Fence lines carry their type (and wires) so lengths can be totalled by type
export const FENCE_TYPES = ["Post and wire", "Electric (permanent)", "Electric (temporary)", "Post and rail", "Netting", "Deer fence", "Boundary fence", "Other"];

// ===== Files: KML, KMZ, GeoJSON =====

export interface ImportItem { geometry: GeoJSON.Geometry; name?: string | null; paddockNumber?: number | null }

function flatten(features: GeoJSON.Feature[]): ImportItem[] {
  const items: ImportItem[] = [];
  const add = (geometry: GeoJSON.Geometry | null, props: Record<string, any>) => {
    if (!geometry) return;
    if (geometry.type === "GeometryCollection") {
      geometry.geometries.forEach(g => add(g, props));
      return;
    }
    const name = props.name ?? props.Name ?? props.NAME ?? props.title ?? props.paddock ?? props.Paddock ?? null;
    const num = props.paddockNumber ?? props.number ?? props.Number ?? props.paddock_no ?? null;
    items.push({
      geometry: dropHeights(geometry),
      name: name != null ? String(name).trim().slice(0, 200) || null : null,
      paddockNumber: num != null && Number.isInteger(Number(num)) ? Number(num) : null,
    });
  };
  features.forEach(f => add(f.geometry, f.properties ?? {}));
  return items;
}

// KML coordinates often carry a height; the farm map is 2D
function dropHeights(g: GeoJSON.Geometry): GeoJSON.Geometry {
  const strip = (c: any): any => (typeof c[0] === "number" ? [c[0], c[1]] : c.map(strip));
  return g.type === "GeometryCollection" ? g : ({ ...g, coordinates: strip((g as any).coordinates) } as GeoJSON.Geometry);
}

/**
 * Read a .kml, .kmz, .geojson or .json file into shapes with names
 */
export async function readMapFile(file: File): Promise<ImportItem[]> {
  const name = file.name.toLowerCase();
  let collection: GeoJSON.FeatureCollection;
  if (name.endsWith(".kmz")) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = Object.values(zip.files).find(f => !f.dir && f.name.toLowerCase().endsWith(".kml"));
    if (!entry) throw new Error("That KMZ file has no KML map inside it");
    collection = kmlToGeoJSON(new DOMParser().parseFromString(await entry.async("text"), "text/xml")) as GeoJSON.FeatureCollection;
  } else if (name.endsWith(".kml")) {
    collection = kmlToGeoJSON(new DOMParser().parseFromString(await file.text(), "text/xml")) as GeoJSON.FeatureCollection;
  } else if (name.endsWith(".gpx")) {
    collection = gpxToGeoJSON(new DOMParser().parseFromString(await file.text(), "text/xml")) as GeoJSON.FeatureCollection;
  } else if (name.endsWith(".geojson") || name.endsWith(".json")) {
    const data = JSON.parse(await file.text());
    collection = data.type === "FeatureCollection" ? data
      : data.type === "Feature" ? { type: "FeatureCollection", features: [data] }
      : { type: "FeatureCollection", features: [{ type: "Feature", geometry: data, properties: {} }] };
  } else {
    throw new Error("Choose a .kml, .kmz, .gpx or .geojson file");
  }
  const items = flatten(collection.features ?? []);
  if (items.length === 0) throw new Error("No shapes found in that file");
  return items;
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
const coords = (ring: number[][]) => ring.map(c => `${c[0]},${c[1]},0`).join(" ");

function kmlGeometry(g: GeoJSON.Geometry): string {
  switch (g.type) {
    case "Point": return `<Point><coordinates>${g.coordinates[0]},${g.coordinates[1]},0</coordinates></Point>`;
    case "LineString": return `<LineString><coordinates>${coords(g.coordinates)}</coordinates></LineString>`;
    case "Polygon": return `<Polygon>${g.coordinates.map((r, i) => `<${i === 0 ? "outerBoundaryIs" : "innerBoundaryIs"}><LinearRing><coordinates>${coords(r)}</coordinates></LinearRing></${i === 0 ? "outerBoundaryIs" : "innerBoundaryIs"}>`).join("")}</Polygon>`;
    case "MultiPolygon": return `<MultiGeometry>${g.coordinates.map(p => kmlGeometry({ type: "Polygon", coordinates: p })).join("")}</MultiGeometry>`;
    case "MultiLineString": return `<MultiGeometry>${g.coordinates.map(l => kmlGeometry({ type: "LineString", coordinates: l })).join("")}</MultiGeometry>`;
    default: return "";
  }
}

/**
 * GeoJSON to KML, one folder per layer, with the farm's details as extended data
 */
export function toKml(collection: GeoJSON.FeatureCollection, title: string): string {
  const folders = new Map<string, GeoJSON.Feature[]>();
  for (const f of collection.features) {
    const layer = String(f.properties?.layer ?? "Map");
    folders.set(layer, [...(folders.get(layer) ?? []), f]);
  }
  const placemark = (f: GeoJSON.Feature) => {
    const p = f.properties ?? {};
    const data = Object.entries(p).filter(([, v]) => v != null && typeof v !== "object")
      .map(([k, v]) => `<Data name="${esc(k)}"><value>${esc(v)}</value></Data>`).join("");
    return `<Placemark><name>${esc(p.name ?? "")}</name><ExtendedData>${data}</ExtendedData>${kmlGeometry(f.geometry)}</Placemark>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(title)}</name>${
    Array.from(folders.entries()).map(([name, fs]) => `<Folder><name>${esc(name)}</name>${fs.map(placemark).join("")}</Folder>`).join("")
  }</Document></kml>`;
}

export async function toKmz(collection: GeoJSON.FeatureCollection, title: string): Promise<Blob> {
  const zip = new JSZip();
  zip.file("doc.kml", toKml(collection, title));
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.google-earth.kmz" });
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
