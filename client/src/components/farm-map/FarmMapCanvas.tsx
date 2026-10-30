import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import * as turf from "@turf/turf";
import { BASEMAPS, LAYER_RECORD_TYPES, type MapState, type MapLayer } from "@/lib/farm-map";
import { DEFAULT_CENTER } from "@/components/records/AreaDrawer";

export type Selection = { type: "paddock" | "feature" | "record"; id: string };
export type DrawShape = "Polygon" | "Line" | "Marker" | "Circle" | "Rectangle";
export type Mode =
  | { kind: "view" }
  | { kind: "draw"; shape: DrawShape }
  | { kind: "edit"; target: Selection }
  | { kind: "measure" }
  | { kind: "split"; paddockId: string }
  | { kind: "merge"; keepId: string; picks: string[] };

export interface RecordShape {
  id: string;
  geometry: GeoJSON.Geometry;
  properties: { type: string; title: string; label: string; occurredAt: string; withholdingActive: boolean };
}
export interface Drawn { geometry: GeoJSON.Geometry; kind: "point" | "line" | "polygon" | "circle"; radiusM?: number }
export interface Measurement { lengthM: number; areaHa: number | null; points: number }
export type Focus = { rev: number } & ({ bounds: [number, number, number, number] } | { lat: number; lng: number; zoom: number });

interface Props {
  state: MapState;
  visible: Record<string, boolean>;
  records: RecordShape[];
  basemap: string;
  selection: Selection | null;
  mode: Mode;
  editGeometry: GeoJSON.Geometry | null;
  // A shape just drawn, shown until it's saved or discarded
  pending: Drawn | null;
  editRadius: number | null;
  editRevision: number;
  focus: Focus | null;
  onPick: (sel: Selection | null) => void;
  onDrawn: (shape: Drawn) => void;
  onEditChange: (geometry: GeoJSON.Geometry, radiusM: number | null) => void;
  onMeasure: (m: Measurement) => void;
  onSplitLine: (line: GeoJSON.LineString) => void;
  onMove: (view: { lat: number; lng: number; zoom: number }) => void;
  onAttribution: (text: string) => void;
}

const HIGHLIGHT = "#ffd43b";
const GEOMAN_SHAPE: Record<DrawShape, string> = { Polygon: "Polygon", Line: "Line", Marker: "Marker", Circle: "Circle", Rectangle: "Rectangle" };

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function geometryToLeaflet(g: GeoJSON.Geometry, style: L.PathOptions, radiusM?: number | null): L.Layer {
  if (g.type === "Point") {
    const [lng, lat] = g.coordinates;
    return radiusM ? L.circle([lat, lng], { ...style, radius: radiusM }) : L.circleMarker([lat, lng], { ...style, radius: 7, fillOpacity: 0.9 });
  }
  return L.geoJSON({ type: "Feature", geometry: g, properties: {} } as any, { style: () => style }).getLayers()[0];
}

/**
 * Metres covered by a few screen pixels here (for picking lines and points by tapping)
 */
function tapTolerance(map: L.Map, lat: number, px = 14) {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, map.getZoom() + 8) * px;
}

/**
 * Satellite map of the farm: paddocks, layer features and activity records, with tools to
 * draw, edit (snapping to neighbours), measure and split.
 */
export function FarmMapCanvas(props: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.TileLayer | null>(null);
  const dataRef = useRef<L.LayerGroup | null>(null);
  const editRef = useRef<L.Layer | null>(null);
  const measureRef = useRef<{ points: L.LatLng[]; layer: L.LayerGroup } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Map, once
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(DEFAULT_CENTER, 14);
    dataRef.current = L.layerGroup().addTo(map);
    map.pm.setGlobalOptions({
      snappable: true,
      snapDistance: 18,
      allowSelfIntersection: false,
      finishOn: null as any,
      templineStyle: { color: HIGHLIGHT },
      hintlineStyle: { color: HIGHLIGHT, dashArray: "4 4" },
      pathOptions: { color: HIGHLIGHT, weight: 3, fillOpacity: 0.2 },
    } as any);
    map.on("moveend", () => {
      const c = map.getCenter();
      propsRef.current.onMove({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    });
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    mapRef.current = map;
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    baseRef.current?.remove();
    const def = BASEMAPS.find(b => b.key === props.basemap && b.available) ?? BASEMAPS[0];
    let cancelled = false;
    let onMove: (() => void) | null = null;
    const add = (url: string, attribution: string) => {
      if (cancelled) return;
      baseRef.current = L.tileLayer(url, { attribution, maxZoom: 21, maxNativeZoom: def.maxNativeZoom }).addTo(map);
      baseRef.current.bringToBack();
    };
    if (def.key === "google") {
      // Google Map Tiles API: a session per map, and the copyright for what's in view
      const key = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;
      fetch(`https://tile.googleapis.com/v1/createSession?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapType: "satellite", language: "en-NZ", region: "NZ" }),
      }).then(r => r.json()).then(s => {
        add(`https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${s.session}&key=${key}`, "Google");
        onMove = () => {
          const b = map.getBounds();
          fetch(`https://tile.googleapis.com/tile/v1/viewport?session=${s.session}&key=${key}&zoom=${map.getZoom()}&north=${b.getNorth()}&south=${b.getSouth()}&east=${b.getEast()}&west=${b.getWest()}`)
            .then(r => r.json()).then(v => propsRef.current.onAttribution(`Google${v.copyright ? ` · ${v.copyright}` : ""}`)).catch(() => {});
        };
        map.on("moveend", onMove);
        onMove();
      }).catch(() => propsRef.current.onAttribution("Google imagery couldn't be loaded"));
    } else {
      add(def.url!, def.attribution);
      props.onAttribution(def.attribution);
    }
    return () => {
      cancelled = true;
      if (onMove) map.off("moveend", onMove);
    };
  }, [props.basemap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus requests (fit the farm, go to a paddock, apply a saved view)
  useEffect(() => {
    const map = mapRef.current;
    const f = props.focus;
    if (!map || !f) return;
    if ("bounds" in f) {
      const [w, s, e, n] = f.bounds;
      map.fitBounds([[s, w], [n, e]], { padding: [30, 30], maxZoom: 18 });
    } else {
      map.setView([f.lat, f.lng], f.zoom);
    }
  }, [props.focus?.rev]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw everything visible
  useEffect(() => {
    const map = mapRef.current;
    const group = dataRef.current;
    if (!map || !group) return;
    group.clearLayers();
    const { state, visible, selection, mode, records } = props;
    const layerByKey = new Map(state.layers.map(l => [l.key, l]));
    const editing = mode.kind === "edit" ? mode.target : null;
    const isSelected = (type: Selection["type"], id: string) => selection?.type === type && selection.id === id;
    const styleOf = (layer: MapLayer | undefined, selected: boolean): L.PathOptions => ({
      color: selected ? HIGHLIGHT : layer?.style.color ?? "#fff",
      fillColor: layer?.style.fillColor ?? layer?.style.color ?? "#fff",
      fillOpacity: layer?.style.fillOpacity ?? 0.2,
      weight: selected ? (layer?.style.weight ?? 2) + 2 : layer?.style.weight ?? 2,
      dashArray: layer?.style.dashArray ?? undefined,
      interactive: false,
    });

    // Activity records, under the paddock outlines' labels
    for (const [layerKey, types] of Object.entries(LAYER_RECORD_TYPES)) {
      const layer = layerByKey.get(layerKey);
      if (!layer || !visible[layer.id]) continue;
      for (const r of records.filter(x => types.includes(x.properties.type))) {
        const style = styleOf(layer, isSelected("record", r.id));
        if (r.properties.withholdingActive) Object.assign(style, { color: "#e03131", dashArray: "6 4", weight: 3 });
        group.addLayer(geometryToLeaflet(r.geometry, style));
      }
    }

    // Paddocks
    const paddockLayer = layerByKey.get("paddocks");
    if (paddockLayer && visible[paddockLayer.id]) {
      for (const p of state.paddocks) {
        if (!p.geometry || (editing?.type === "paddock" && editing.id === p.id)) continue;
        const picked = mode.kind === "merge" && (mode.keepId === p.id || mode.picks.includes(p.id));
        const shape = geometryToLeaflet(p.geometry, styleOf(paddockLayer, isSelected("paddock", p.id) || picked)) as L.Polygon;
        shape.bindTooltip(esc(`${p.paddockNumber != null ? `${p.paddockNumber} ` : ""}${p.name}`), { permanent: true, direction: "center", className: "paddock-label" });
        group.addLayer(shape);
      }
    }

    // Just drawn, waiting to be named and saved
    if (props.pending) {
      group.addLayer(geometryToLeaflet(props.pending.geometry, { color: HIGHLIGHT, weight: 3, dashArray: "6 4", fillOpacity: 0.25, interactive: false }, props.pending.kind === "circle" ? props.pending.radiusM : null));
    }

    // Layer features
    const layerById = new Map(state.layers.map(l => [l.id, l]));
    for (const f of state.features) {
      const layer = layerById.get(f.layerId);
      if (!layer || !visible[layer.id] || (editing?.type === "feature" && editing.id === f.id)) continue;
      const shape = geometryToLeaflet(f.geometry, styleOf(layer, isSelected("feature", f.id)), f.kind === "circle" ? f.radiusM : null);
      if (f.name && f.kind === "point") (shape as L.Path).bindTooltip(esc(f.name), { direction: "top" });
      group.addLayer(shape);
    }
  }, [props.state, props.visible, props.records, props.selection, props.mode, props.pending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tap to select; where shapes overlap, offer a list to choose from
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      const p = propsRef.current;
      if (p.mode.kind !== "view" && p.mode.kind !== "merge") return;
      const pt = turf.point([e.latlng.lng, e.latlng.lat]);
      const tol = tapTolerance(map, e.latlng.lat);
      const hits: { sel: Selection; label: string; rank: number }[] = [];
      const shown = (layerId?: string) => !!layerId && p.visible[layerId];
      const layerById = new Map(p.state.layers.map(l => [l.id, l]));
      for (const f of p.state.features) {
        if (!shown(f.layerId)) continue;
        const g = f.geometry as any;
        let hit = false;
        if (f.kind === "point") hit = turf.distance(pt, turf.point(g.coordinates), { units: "meters" }) <= tol;
        else if (f.kind === "circle") hit = turf.distance(pt, turf.point(g.coordinates), { units: "meters" }) <= (f.radiusM ?? 0);
        else if (f.kind === "line") hit = turf.pointToLineDistance(pt, g.type === "LineString" ? turf.lineString(g.coordinates) : turf.multiLineString(g.coordinates) as any, { units: "meters" }) <= tol;
        else hit = turf.booleanPointInPolygon(pt, g);
        if (hit) hits.push({ sel: { type: "feature", id: f.id }, label: `${f.name || f.kind} · ${layerById.get(f.layerId)?.name ?? ""}`, rank: f.kind === "point" ? 0 : f.kind === "line" ? 1 : 2 });
      }
      for (const [layerKey, types] of Object.entries(LAYER_RECORD_TYPES)) {
        const layer = p.state.layers.find(l => l.key === layerKey);
        if (!layer || !shown(layer.id)) continue;
        for (const r of p.records.filter(x => types.includes(x.properties.type))) {
          if (r.geometry.type.includes("Polygon") && turf.booleanPointInPolygon(pt, r.geometry as any)) {
            hits.push({ sel: { type: "record", id: r.id }, label: `${r.properties.title} · ${r.properties.occurredAt.slice(0, 10)}`, rank: 3 });
          }
        }
      }
      const paddockLayer = p.state.layers.find(l => l.key === "paddocks");
      if (paddockLayer && shown(paddockLayer.id)) {
        for (const pd of p.state.paddocks) {
          if (pd.geometry && turf.booleanPointInPolygon(pt, pd.geometry)) hits.push({ sel: { type: "paddock", id: pd.id }, label: `Paddock ${pd.paddockNumber ?? ""} ${pd.name}`.replace("  ", " "), rank: 4 });
        }
      }
      // In merge mode only paddocks can be picked
      const pick = p.mode.kind === "merge" ? hits.filter(h => h.sel.type === "paddock") : hits;
      pick.sort((a, b) => a.rank - b.rank);
      if (pick.length <= 1) {
        p.onPick(pick[0]?.sel ?? null);
        return;
      }
      const box = L.DomUtil.create("div", "space-y-1");
      const title = L.DomUtil.create("div", "text-xs font-semibold mb-1", box);
      title.textContent = "Which one?";
      for (const h of pick) {
        const b = L.DomUtil.create("button", "block w-full text-left text-sm px-2 py-1 rounded hover:bg-gray-100", box) as HTMLButtonElement;
        b.type = "button";
        b.textContent = h.label;
        L.DomEvent.on(b, "click", ev => {
          L.DomEvent.stop(ev);
          map.closePopup();
          propsRef.current.onPick(h.sel);
        });
      }
      L.popup({ closeButton: true }).setLatLng(e.latlng).setContent(box).openOn(map);
    };
    map.on("click", onClick);
    return () => { map.off("click", onClick); };
  }, []);

  // Drawing a new shape, or the line to split a paddock with
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const mode = props.mode;
    const shape = mode.kind === "draw" ? mode.shape : mode.kind === "split" ? "Line" : null;
    if (!shape) return;
    map.pm.enableDraw(GEOMAN_SHAPE[shape] as any, { snappable: true, snapDistance: 18, allowSelfIntersection: false } as any);
    const onCreate = (e: any) => {
      const layer = e.layer as L.Layer;
      let drawn: Drawn;
      if (e.shape === "Circle") {
        const c = (layer as L.Circle).getLatLng();
        drawn = { kind: "circle", geometry: { type: "Point", coordinates: [c.lng, c.lat] }, radiusM: Math.round((layer as L.Circle).getRadius() * 100) / 100 };
      } else {
        const geometry = (layer as any).toGeoJSON().geometry as GeoJSON.Geometry;
        drawn = { kind: geometry.type === "Point" ? "point" : geometry.type === "LineString" ? "line" : "polygon", geometry };
      }
      map.removeLayer(layer);
      map.pm.disableDraw();
      const p = propsRef.current;
      if (p.mode.kind === "split" && drawn.geometry.type === "LineString") p.onSplitLine(drawn.geometry);
      else p.onDrawn(drawn);
    };
    map.on("pm:create", onCreate);
    return () => {
      map.off("pm:create", onCreate);
      map.pm.disableDraw();
    };
  }, [props.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Editing one shape: drag corners, add (tap a midpoint) or remove (right-click / long-press) corners, snap to neighbours
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    editRef.current?.remove();
    editRef.current = null;
    if (props.mode.kind !== "edit" || !props.editGeometry) return;
    const g = props.editGeometry;
    const style = { color: HIGHLIGHT, weight: 3, fillOpacity: 0.15 };
    let layer: L.Layer;
    if (g.type === "Point") {
      const [lng, lat] = g.coordinates;
      layer = props.editRadius ? L.circle([lat, lng], { ...style, radius: props.editRadius }) : L.marker([lat, lng]);
    } else {
      layer = L.geoJSON({ type: "Feature", geometry: g, properties: {} } as any, { style: () => style }).getLayers()[0];
    }
    layer.addTo(map);
    const pmLayer = (layer as any).pm;
    pmLayer.enable({ allowSelfIntersection: false, snappable: true, snapDistance: 18, draggable: true });
    const emit = () => {
      if (layer instanceof L.Circle) {
        const c = layer.getLatLng();
        propsRef.current.onEditChange({ type: "Point", coordinates: [c.lng, c.lat] }, Math.round(layer.getRadius() * 100) / 100);
      } else {
        propsRef.current.onEditChange((layer as any).toGeoJSON().geometry, null);
      }
    };
    layer.on("pm:edit pm:dragend pm:markerdragend pm:vertexremoved", emit);
    editRef.current = layer;
    return () => {
      layer.off("pm:edit pm:dragend pm:markerdragend pm:vertexremoved", emit);
      pmLayer.disable();
      layer.remove();
    };
    // Rebuilt only when editing starts or on undo/redo, not on every drag
  }, [props.mode.kind === "edit" ? `${props.mode.target.type}:${props.mode.target.id}` : "none", props.editRevision]); // eslint-disable-line react-hooks/exhaustive-deps

  // Measuring: tap points; shows distance, and area once there are three or more
  useEffect(() => {
    const map = mapRef.current;
    if (!map || props.mode.kind !== "measure") return;
    const group = L.layerGroup().addTo(map);
    const state = { points: [] as L.LatLng[], layer: group };
    measureRef.current = state;
    map.doubleClickZoom.disable();
    const redraw = () => {
      group.clearLayers();
      const pts = state.points;
      pts.forEach(p => L.circleMarker(p, { radius: 4, color: "#fff", fillColor: HIGHLIGHT, fillOpacity: 1, weight: 2 }).addTo(group));
      if (pts.length >= 3) L.polygon(pts, { color: HIGHLIGHT, weight: 2, dashArray: "5 5", fillOpacity: 0.1 }).addTo(group);
      else if (pts.length === 2) L.polyline(pts, { color: HIGHLIGHT, weight: 2, dashArray: "5 5" }).addTo(group);
      const coords = pts.map(p => [p.lng, p.lat]);
      const lengthM = coords.length >= 2 ? turf.length(turf.lineString(coords), { units: "meters" }) : 0;
      const areaHa = coords.length >= 3 ? turf.area(turf.polygon([[...coords, coords[0]]])) / 10000 : null;
      propsRef.current.onMeasure({ lengthM, areaHa, points: pts.length });
    };
    const onClick = (e: L.LeafletMouseEvent) => { state.points.push(e.latlng); redraw(); };
    map.on("click", onClick);
    redraw();
    return () => {
      map.off("click", onClick);
      map.doubleClickZoom.enable();
      group.remove();
      measureRef.current = null;
    };
  }, [props.mode.kind === "measure", props.editRevision]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="h-full w-full" data-testid="farm-map" />;
}
