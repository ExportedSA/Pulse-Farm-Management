import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format } from "date-fns";
import { recordTypeDef } from "@/lib/records";
import { SATELLITE_TILES, SATELLITE_ATTRIBUTION, DEFAULT_CENTER } from "./AreaDrawer";

export interface MapFeature {
  type: "Feature";
  id: string;
  geometry: any;
  properties: {
    id: string;
    type: string;
    title: string;
    occurredAt: string;
    areaHa: number | null;
    label: string;
    withholdingUntil: string | null;
    withholdingActive: boolean;
  };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/**
 * Satellite map with each record's area shaded in its type's colour. Spray areas still
 * inside their grazing withholding get a red dashed outline.
 */
export function RecordsMap({ features, onSelect }: { features: MapFeature[]; onSelect?: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 14);
    L.tileLayer(SATELLITE_TILES, { attribution: SATELLITE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layerRef.current?.remove();
    // Oldest first so the newest records sit on top
    const ordered = [...features].sort((a, b) => a.properties.occurredAt.localeCompare(b.properties.occurredAt));
    const layer = L.geoJSON({ type: "FeatureCollection", features: ordered } as any, {
      style: feature => {
        const p = (feature as MapFeature).properties;
        const color = recordTypeDef(p.type).color;
        return p.withholdingActive
          ? { color: "#e03131", weight: 3, dashArray: "6 4", fillColor: color, fillOpacity: 0.4 }
          : { color, weight: 2, fillColor: color, fillOpacity: 0.3 };
      },
      onEachFeature: (feature, l) => {
        const p = (feature as MapFeature).properties;
        const lines = [
          `<strong>${escapeHtml(recordTypeDef(p.type).label)}</strong> · ${format(new Date(p.occurredAt), "d MMM yyyy")}`,
          p.label ? escapeHtml(p.label) : "",
          p.areaHa != null ? `${p.areaHa.toFixed(2)} ha` : "",
          p.withholdingUntil
            ? (p.withholdingActive
              ? `<span style="color:#e03131;font-weight:600">Don't graze until ${format(new Date(p.withholdingUntil), "d MMM")}</span>`
              : `Withholding ended ${format(new Date(p.withholdingUntil), "d MMM")}`)
            : "",
          `<span style="color:#666">${escapeHtml(p.title)}</span>`,
        ].filter(Boolean);
        l.bindPopup(lines.join("<br>"));
        if (onSelect) l.on("dblclick", () => onSelect(p.id));
      },
    }).addTo(map);
    layerRef.current = layer;
    if (features.length > 0) {
      map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 17 });
    }
  }, [features, onSelect]);

  return <div ref={containerRef} className="h-[60vh] min-h-[320px] w-full rounded-md border overflow-hidden" data-testid="records-map" />;
}
