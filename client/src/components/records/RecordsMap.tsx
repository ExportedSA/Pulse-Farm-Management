import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format } from "date-fns";
import { recordTypeDef } from "@/lib/records";
import { SATELLITE_TILES, SATELLITE_ATTRIBUTION, DEFAULT_CENTER } from "./AreaDrawer";
import { paddockLayer, type PaddockFeature } from "@/lib/paddock-map";
import { jobPinIcon, type MapJob } from "@/components/jobs/JobsMap";

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
export function RecordsMap({ features, onSelect, paddocks = [], jobs = [] }: {
  features: MapFeature[]; onSelect?: (id: string) => void; paddocks?: PaddockFeature[]; jobs?: MapJob[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const paddocksRef = useRef<L.GeoJSON | null>(null);
  const jobsRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 14);
    L.tileLayer(SATELLITE_TILES, { attribution: SATELLITE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    // The page can settle the map's size after it starts; re-measure so every tile loads
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
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
      fittedRef.current = true;
      map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 17 });
    }
  }, [features, onSelect]);

  // Paddock outlines underneath; frame the farm by them when no records are shown
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    paddocksRef.current?.remove();
    paddocksRef.current = paddocks.length > 0 ? paddockLayer(paddocks).addTo(map) : null;
    paddocksRef.current?.bringToBack();
    if (paddocksRef.current && !fittedRef.current) {
      fittedRef.current = true;
      map.fitBounds(paddocksRef.current.getBounds(), { padding: [24, 24], maxZoom: 17 });
    }
  }, [paddocks]);

  // Job pins on top, each linking to the job
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    jobsRef.current?.remove();
    const group = L.layerGroup(jobs.map(job => L.marker([job.latitude, job.longitude], { icon: jobPinIcon(job), zIndexOffset: 500 })
      .bindPopup(`<strong>${escapeHtml(job.title)}</strong><br>${escapeHtml((job.assignedToNames ?? []).join(", ") || "Unassigned")}`
        + `${job.overdue ? '<br><span style="color:#e03131;font-weight:600">Overdue</span>' : ""}`
        + `<br><a href="/app/jobs?job=${encodeURIComponent(job.id)}">Open job</a>`)));
    jobsRef.current = group.addTo(map);
  }, [jobs]);

  return <div ref={containerRef} className="h-[60vh] min-h-[320px] w-full rounded-md border overflow-hidden" data-testid="records-map" />;
}
