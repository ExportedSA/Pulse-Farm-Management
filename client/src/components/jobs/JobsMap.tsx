import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SATELLITE_TILES, SATELLITE_ATTRIBUTION, DEFAULT_CENTER } from "@/components/records/AreaDrawer";

export interface MapJob {
  id: string;
  title: string;
  status: string;
  priority: string;
  latitude: number;
  longitude: number;
  assignedToNames?: string[];
  overdue: boolean;
}

// Pin colour by status, matching the badges on the list
export const JOB_STATUS_COLORS: Record<string, string> = {
  pending: "#f59f00",
  "in-progress": "#1c7ed6",
  blocked: "#7048e8",
  completed: "#2f9e44",
  cancelled: "#868e96",
};

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join("");

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function pin(job: MapJob, selected: boolean): L.DivIcon {
  const color = JOB_STATUS_COLORS[job.status] ?? "#868e96";
  const who = (job.assignedToNames ?? []).map(initials);
  const label = who.length === 0 ? "?" : who.length > 2 ? `${who[0]}+${who.length - 1}` : who.join(" ");
  const size = selected ? 40 : 32;
  const ring = job.overdue ? "#e03131" : "#fff";
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid ${ring};box-shadow:0 1px 5px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center">
      <span style="transform:rotate(45deg);color:#fff;font:600 ${label.length > 3 ? 9 : 11}px system-ui,sans-serif;white-space:nowrap">${escapeHtml(label)}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

/**
 * Satellite map with a pin for every job that has a location, labelled with who it's assigned to
 */
export function JobsMap({ jobs, selectedId, onSelect }: { jobs: MapJob[]; selectedId?: string | null; onSelect: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef<string>("");
  const boundsRef = useRef<L.LatLngBounds | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 14);
    L.tileLayer(SATELLITE_TILES, { attribution: SATELLITE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    // The card around the map can settle its size after the map starts; re-measure and re-fit
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (boundsRef.current) map.fitBounds(boundsRef.current, { padding: [40, 40], maxZoom: 17 });
    });
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
    const layer = L.layerGroup();
    for (const job of jobs) {
      const marker = L.marker([job.latitude, job.longitude], {
        icon: pin(job, job.id === selectedId),
        title: job.title,
        zIndexOffset: job.id === selectedId ? 1000 : 0,
      });
      marker.bindTooltip(escapeHtml(job.title), { direction: "top", offset: [0, -30] });
      marker.on("click", () => onSelect(job.id));
      layer.addLayer(marker);
    }
    layer.addTo(map);
    layerRef.current = layer;

    // Fit to the pins when the set of jobs shown changes (not when one is selected)
    const key = jobs.map(j => j.id).sort().join(",");
    if (jobs.length > 0 && key !== fittedRef.current) {
      fittedRef.current = key;
      boundsRef.current = L.latLngBounds(jobs.map(j => [j.latitude, j.longitude] as [number, number]));
      map.invalidateSize();
      map.fitBounds(boundsRef.current, { padding: [40, 40], maxZoom: 17 });
    }
  }, [jobs, selectedId, onSelect]);

  return <div ref={containerRef} className="h-full w-full" />;
}
