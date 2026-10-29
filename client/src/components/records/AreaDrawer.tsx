import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Undo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { areaHectares, pointsToPolygon, type AreaGeometry, type Position } from "@shared/geo";

export const SATELLITE_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const SATELLITE_ATTRIBUTION = "Imagery © Esri";
// Waikato, used until the farm has mapped records or the device shares its location
export const DEFAULT_CENTER: [number, number] = [-37.787, 175.279];

interface AreaDrawerProps {
  value: AreaGeometry | null;
  onChange: (area: AreaGeometry | null) => void;
  color?: string;
  center?: [number, number] | null;
  // Paddock outlines already drawn, shown faintly with their names to trace along
  background?: { geometry: AreaGeometry; label: string }[];
}

/**
 * Tap the map to outline the area worked; the shape closes itself after three points
 */
export function AreaDrawer({ value, onChange, color = "#2c6a3f", center, background }: AreaDrawerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const shapeRef = useRef<L.Polygon | L.Polyline | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const backgroundRef = useRef<L.GeoJSON | null>(null);
  const fittedRef = useRef(false);
  const [points, setPoints] = useState<Position[]>(() =>
    value?.type === "Polygon" ? value.coordinates[0].slice(0, -1) : []);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(center ?? DEFAULT_CENTER, center ? 16 : 14);
    L.tileLayer(SATELLITE_TILES, { attribution: SATELLITE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      setPoints(prev => [...prev, [Number(e.latlng.lng.toFixed(7)), Number(e.latlng.lat.toFixed(7))]]);
    });
    mapRef.current = map;
    // The dialog animates open; let Leaflet measure its final size
    const resize = setTimeout(() => map.invalidateSize(), 250);
    return () => {
      clearTimeout(resize);
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; later center changes are applied below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (center && mapRef.current && points.length === 0) mapRef.current.setView(center, 16);
  }, [center, points.length]);

  // Other paddocks, faint, with their names; start the view on them (or on this outline)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    backgroundRef.current?.remove();
    backgroundRef.current = null;
    if (background && background.length > 0) {
      const layer = L.geoJSON({
        type: "FeatureCollection",
        features: background.map(b => ({ type: "Feature", geometry: b.geometry, properties: { label: b.label } })),
      } as any, {
        style: { color: "#ffffff", weight: 1.5, dashArray: "4 4", fillOpacity: 0.05, interactive: false },
        onEachFeature: (feature, l) => l.bindTooltip(String(feature.properties.label), { permanent: true, direction: "center", className: "paddock-label" }),
      }).addTo(map);
      backgroundRef.current = layer;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!fittedRef.current) {
      const own = points.length >= 3 ? L.latLngBounds(points.map(([lng, lat]) => L.latLng(lat, lng))) : null;
      const bounds = own ?? backgroundRef.current?.getBounds();
      if (bounds?.isValid()) {
        // After the dialog has finished opening, and only if this map is still the live one
        timer = setTimeout(() => {
          if (mapRef.current !== map) return;
          fittedRef.current = true;
          map.invalidateSize();
          map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
        }, 300);
      }
    }
    return () => clearTimeout(timer);
    // Only re-run when the outlines change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [background]);

  // Redraw the outline and report the closed polygon
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    shapeRef.current?.remove();
    markersRef.current.forEach(m => m.remove());
    const latlngs = points.map(([lng, lat]) => L.latLng(lat, lng));
    markersRef.current = latlngs.map(ll =>
      L.circleMarker(ll, { radius: 5, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }).addTo(map));
    shapeRef.current = latlngs.length >= 3
      ? L.polygon(latlngs, { color, weight: 2, fillOpacity: 0.3 }).addTo(map)
      : latlngs.length === 2 ? L.polyline(latlngs, { color, weight: 2, dashArray: "4 4" }).addTo(map) : null;
    onChange(pointsToPolygon(points));
    // onChange is a new function each render; only the points matter here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, color]);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 17);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const polygon = pointsToPolygon(points);
  return (
    <div className="space-y-2">
      <div ref={containerRef} className="h-64 w-full rounded-md border overflow-hidden" data-testid="map-area-drawer" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground flex-1 min-w-[12rem]">
          {points.length < 3
            ? `Tap the map to mark the corners of the area (${points.length}/3 or more)`
            : `${areaHectares(polygon!).toFixed(2)} ha outlined`}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
          <Crosshair className="h-4 w-4 mr-1" />{locating ? "Finding you…" : "My location"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setPoints(p => p.slice(0, -1))} disabled={points.length === 0}>
          <Undo2 className="h-4 w-4 mr-1" />Undo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setPoints([])} disabled={points.length === 0}>
          <Trash2 className="h-4 w-4 mr-1" />Clear
        </Button>
      </div>
    </div>
  );
}
