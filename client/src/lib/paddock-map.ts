// Paddock outlines drawn on the satellite map, shared by every map in Pulse
import L from "leaflet";
import type { AreaGeometry } from "@shared/geo";

export interface PaddockFeature {
  type: "Feature";
  id: string;
  geometry: AreaGeometry;
  properties: { id: string; name: string; paddockNumber: number | null; status: string | null; drawnHa: number };
}
export interface PaddockMap {
  type: "FeatureCollection";
  features: PaddockFeature[];
  unmapped: { id: string; name: string }[];
}

export const PADDOCK_MAP_KEY = ["/api/paddock-map"];

export async function fetchPaddockMap(): Promise<PaddockMap> {
  const res = await fetch("/api/paddock-map", { credentials: "include" });
  if (!res.ok) throw new Error("Couldn't load the paddock map");
  return res.json();
}

export async function savePaddockOutline(id: string, area: AreaGeometry | null, setArea = false) {
  const res = await fetch(`/api/paddock-map/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ area, setArea }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Couldn't save the outline");
  return body as { id: string; name: string; area: number | null; drawnHa: number | null };
}

/**
 * Leaflet layer of paddock outlines with their names, under everything else
 */
export function paddockLayer(features: PaddockFeature[]): L.GeoJSON {
  return L.geoJSON({ type: "FeatureCollection", features } as any, {
    style: { color: "#ffffff", weight: 1.5, fillOpacity: 0.04, interactive: false },
    onEachFeature: (feature, layer) =>
      layer.bindTooltip(String(feature.properties.name), { permanent: true, direction: "center", className: "paddock-label" }),
  });
}
