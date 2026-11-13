import { useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFarm } from "@/lib/farm-context";
import { BASEMAPS, FARM_MAP_KEY, defaultBasemap, farmMap, googleSession, googleTileUrl, type MapState } from "@/lib/farm-map";
import { hazardCategoryLabel, poiType, riskColour, riskText } from "@/lib/safety";

// The farm's hazard map for the sign-in point, inductions and contractors: every open hazard
// numbered on the map and listed with its controls, the points of interest, and the farm's
// emergency details. Print, or save as PDF.

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const mark = (text: string, colour: string, hazard = false) => L.divIcon({
  className: "",
  html: `<div class="map-mark${hazard ? " hazard" : ""}" style="background:${colour}"><span>${esc(text)}</span></div>`,
  iconSize: [26, 26], iconAnchor: [13, 13],
});

function HazardMap({ state, numbered }: { state: MapState; numbered: { id: string; n: number }[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { zoomControl: false, attributionControl: true });
    const pick = BASEMAPS.find(b => b.key === defaultBasemap())!;
    const esri = BASEMAPS[0];
    if (pick.key === "google") {
      googleSession()
        .then(s => L.tileLayer(googleTileUrl(s), { attribution: `Map data ©${new Date().getFullYear()} Google`, maxNativeZoom: pick.maxNativeZoom, maxZoom: 21 }).addTo(map).bringToBack())
        .catch(() => L.tileLayer(esri.url!, { attribution: esri.attribution, maxNativeZoom: esri.maxNativeZoom, maxZoom: 21 }).addTo(map).bringToBack());
    } else {
      L.tileLayer(pick.url ?? esri.url!, { attribution: pick.attribution, maxNativeZoom: pick.maxNativeZoom, maxZoom: 21 }).addTo(map);
    }
    const frame = L.featureGroup().addTo(map);
    state.paddocks.filter(p => p.geometry).forEach(p => {
      L.geoJSON(p.geometry as any, { style: { color: "#ffffff", weight: 1.5, fillOpacity: 0 } })
        .bindTooltip(esc(p.name), { permanent: true, direction: "center", className: "paddock-label" }).addTo(frame);
    });
    const number = new Map(numbered.map(x => [x.id, x.n]));
    for (const h of state.hazards.filter(x => x.geometry)) {
      const colour = riskColour(h.riskLevel);
      const g = h.geometry!;
      const n = String(number.get(h.id) ?? "!");
      if (g.type === "Point") {
        const [lng, lat] = g.coordinates;
        if (h.radiusM) L.circle([lat, lng], { radius: h.radiusM, color: colour, weight: 2, fillColor: colour, fillOpacity: 0.25 }).addTo(frame);
        L.marker([lat, lng], { icon: mark(n, colour, true) }).addTo(frame);
      } else {
        const shape = L.geoJSON(g as any, { style: { color: colour, weight: g.type.includes("LineString") ? 4 : 2, fillColor: colour, fillOpacity: 0.3 } }).addTo(frame);
        const c = shape.getBounds().getCenter();
        L.marker(c, { icon: mark(n, colour, true) }).addTo(frame);
      }
    }
    const poiLayer = state.layers.find(l => l.key === "poi");
    for (const f of state.features.filter(x => x.layerId === poiLayer?.id && x.kind === "point")) {
      const t = poiType(f.properties?.poiType);
      const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
      L.marker([lat, lng], { icon: mark(t.mark, t.colour) })
        .bindTooltip(esc(f.name || t.label), { permanent: true, direction: "right", offset: [12, 0], className: "mark-label" }).addTo(frame);
    }
    const b = frame.getBounds();
    if (b.isValid()) map.fitBounds(b.pad(0.08));
    return () => { map.remove(); };
  }, [state, numbered]);
  return <div ref={ref} className="h-[520px] w-full rounded border print:h-[170mm]" aria-label="Hazard map" />;
}

export default function HazardMapPrintPage() {
  const { currentFarm } = useFarm();
  const { data: state, error } = useQuery({ queryKey: FARM_MAP_KEY, queryFn: farmMap.state });
  const { data: farm } = useQuery<{ name: string; address: string | null; contactPhone: string | null; settings: Record<string, any> | null }>({
    queryKey: ["/api/farms/current"],
    queryFn: async () => { const r = await fetch("/api/farms/current", { credentials: "include" }); return r.ok ? r.json() : null; },
  });
  // Hazards on the map first (numbered as on the map), then those not drawn yet
  const hazards = useMemo(() => [...(state?.hazards ?? [])].sort((a, b) => Number(!a.geometry) - Number(!b.geometry) || (b.riskLevel ?? 0) - (a.riskLevel ?? 0)), [state]);
  const numbered = useMemo(() => hazards.map((h, i) => ({ id: h.id, n: i + 1 })), [hazards]);
  if (!state) return <div className="p-6 text-sm text-muted-foreground">{error ? (error as Error).message : "Loading the hazard map…"}</div>;
  const poiLayer = state.layers.find(l => l.key === "poi");
  const pois = state.features.filter(f => f.layerId === poiLayer?.id);
  const emergency = farm?.settings?.emergency ?? {};
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4 print:p-0 print:max-w-none bg-white text-black">
      <div className="flex items-center gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm"><Link href="/app/farm-map"><ArrowLeft className="h-4 w-4 mr-1" />Farm map</Link></Button>
        <Button size="sm" className="ml-auto" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print / save as PDF</Button>
      </div>
      <header className="flex flex-wrap items-end justify-between gap-2 border-b pb-2">
        <div>
          <h1 className="text-2xl font-bold">Hazard map · {farm?.name ?? currentFarm?.name ?? "Farm"}</h1>
          {farm?.address && <p className="text-sm">{farm.address}</p>}
        </div>
        <p className="text-xs">Printed {new Date().toLocaleDateString(undefined, { dateStyle: "long" })}. Check with the farm for anything new since.</p>
      </header>
      <section className="rounded border-2 border-red-700 p-3 text-sm">
        <p className="font-bold text-red-800">In an emergency call 111</p>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-1">
          <div><dt className="inline font-semibold">Farm address for 111: </dt><dd className="inline">{emergency.address111 || farm?.address || "not recorded"}</dd></div>
          <div><dt className="inline font-semibold">RAPID number: </dt><dd className="inline">{emergency.rapidNumber || "not recorded"}</dd></div>
          <div><dt className="inline font-semibold">Nearest medical centre: </dt><dd className="inline">{emergency.medicalCentre || "not recorded"}{emergency.medicalPhone ? ` · ${emergency.medicalPhone}` : ""}</dd></div>
          <div><dt className="inline font-semibold">Farm contact: </dt><dd className="inline">{farm?.contactPhone || "not recorded"}</dd></div>
        </dl>
        {!(emergency.address111 || emergency.rapidNumber || emergency.medicalCentre) && <p className="text-xs mt-1 print:hidden">Add these under Settings › Farm profile.</p>}
      </section>
      <HazardMap state={state} numbered={numbered} />
      <section className="space-y-1">
        <h2 className="text-lg font-semibold">Hazards ({hazards.length})</h2>
        {hazards.length === 0 ? <p className="text-sm">No open hazards are recorded.</p> : (
          <table className="w-full text-sm border-collapse">
            <thead><tr className="text-left border-b"><th className="py-1 pr-2">#</th><th className="pr-2">Hazard</th><th className="pr-2">Kind</th><th className="pr-2">Risk</th><th className="pr-2">Controls</th><th>Where</th></tr></thead>
            <tbody>
              {hazards.map((h, i) => (
                <tr key={h.id} className="border-b align-top break-inside-avoid">
                  <td className="py-1 pr-2 font-semibold">{i + 1}</td>
                  <td className="pr-2 font-medium">{h.title}</td>
                  <td className="pr-2">{hazardCategoryLabel(h.type)}</td>
                  <td className="pr-2 whitespace-nowrap"><span className="inline-block h-2.5 w-2.5 mr-1 rounded-sm" style={{ background: riskColour(h.riskLevel) }} />{riskText(h.riskLevel)}{h.status === "monitoring" ? " · controlled" : ""}</td>
                  <td className="pr-2">{h.controls || "—"}</td>
                  <td>{h.location || (h.geometry ? "On the map" : "Not on the map")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {pois.length > 0 && (
        <section className="space-y-1 break-inside-avoid">
          <h2 className="text-lg font-semibold">Points of interest</h2>
          <ul className="grid sm:grid-cols-2 gap-1 text-sm">
            {pois.map(f => { const t = poiType(f.properties?.poiType); return <li key={f.id}><span className="font-semibold">{t.mark}</span> {f.name || t.label}{f.name && f.name !== t.label ? ` (${t.label})` : ""}</li>; })}
          </ul>
        </section>
      )}
    </div>
  );
}
