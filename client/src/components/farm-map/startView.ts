import * as turf from "@turf/turf";
import type { MapState } from "@/lib/farm-map";

export type View = { lat: number; lng: number; zoom: number };
export type Bounds = [number, number, number, number];

/**
 * Everything drawn on the farm (paddocks, any layer's lines, points and areas, hazards and
 * exclusions), as [west, south, east, north]. Null when nothing has been drawn yet.
 * Paddocks alone aren't enough: a new farm often has a boundary or a fence before any paddock.
 */
export function farmBounds(state: Pick<MapState, "paddocks" | "features" | "hazards" | "exclusions">): Bounds | null {
  const shapes = [
    ...state.paddocks.map(p => p.geometry),
    ...state.features.map(f => f.geometry),
    ...(state.hazards ?? []).map(h => h.geometry),
    ...(state.exclusions ?? []).map(e => e.geometry),
  ].filter((g): g is GeoJSON.Geometry => !!g).map(g => turf.feature(g));
  if (shapes.length === 0) return null;
  const box = turf.bbox(turf.featureCollection(shapes)) as Bounds;
  return box.every(Number.isFinite) ? box : null;
}

/**
 * Where the map opens: the whole farm when anything is drawn; otherwise where this person last
 * looked at this farm on this device; otherwise the farm's first saved view; otherwise nothing
 * (the map's default spot).
 */
export function startView(
  state: Pick<MapState, "paddocks" | "features" | "hazards" | "exclusions" | "views">,
  lastView: View | null,
): { bounds: Bounds } | View | null {
  const bounds = farmBounds(state);
  if (bounds) return { bounds };
  if (isView(lastView)) return lastView;
  const saved = state.views?.[0];
  return saved ? { lat: saved.lat, lng: saved.lng, zoom: saved.zoom } : null;
}

export function isView(v: unknown): v is View {
  const o = v as View | null;
  return !!o && Number.isFinite(o.lat) && Number.isFinite(o.lng) && Number.isFinite(o.zoom)
    && Math.abs(o.lat) <= 90 && Math.abs(o.lng) <= 180;
}

/** Key for the last view of a farm, kept on this device */
export const lastViewKey = (farmId: string | undefined) => `pulse-farm-map-view:${farmId}`;
