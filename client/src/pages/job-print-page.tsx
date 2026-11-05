import { useEffect, useRef } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFarm } from "@/lib/farm-context";
import { BASEMAPS, FARM_MAP_KEY, defaultBasemap, farmMap, googleSession, googleTileUrl } from "@/lib/farm-map";
import { ACTIVITY_LABELS, RESTRICTION_LABELS, activesText, jobsApi, type Activity, type Job } from "@/lib/jobs";

// The job sheet for the contractor or operator: the map of where to work (and where not to), what
// to apply at what rate, the restrictions, and space to record what was done. Print, or save as PDF.

const fmtHa = (ha: number | null | undefined) => (ha == null ? "—" : `${Number(ha).toFixed(3)} ha`);
const fmtWhen = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

function JobMap({ job }: { job: Job }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { data: state } = useQuery({ queryKey: FARM_MAP_KEY, queryFn: farmMap.state });
  useEffect(() => {
    if (!ref.current || !state) return;
    const map = L.map(ref.current, { zoomControl: false, attributionControl: true });
    // The farm's imagery: Google satellite when available, else LINZ or Esri
    const pick = BASEMAPS.find(b => b.key === defaultBasemap())!;
    const esri = BASEMAPS[0];
    if (pick.key === "google") {
      googleSession()
        .then(s => L.tileLayer(googleTileUrl(s), { attribution: `Map data ©${new Date().getFullYear()} Google`, maxNativeZoom: pick.maxNativeZoom, maxZoom: 21 }).addTo(map).bringToBack())
        .catch(() => L.tileLayer(esri.url!, { attribution: esri.attribution, maxNativeZoom: esri.maxNativeZoom, maxZoom: 21 }).addTo(map).bringToBack());
    } else {
      L.tileLayer(pick.url ?? esri.url!, { attribution: pick.attribution, maxNativeZoom: pick.maxNativeZoom, maxZoom: 21 }).addTo(map);
    }
    const group = L.featureGroup().addTo(map);
    state.paddocks.filter(p => p.geometry).forEach(p => {
      L.geoJSON(p.geometry as any, { style: { color: "#ffffff", weight: 1.5, fillOpacity: 0 } }).bindTooltip(p.name, { permanent: true, direction: "center", className: "!bg-white/80 !text-[10px] !p-0.5 !border-0" }).addTo(map);
    });
    job.lines.forEach(l => L.geoJSON(l.geometry as any, { style: { color: "#fab005", weight: 3, fillColor: "#fab005", fillOpacity: 0.35 } }).addTo(group));
    state.exclusions.filter(e => e.status === "active").forEach(e => L.geoJSON(e.geometry as any, { style: { color: "#e03131", weight: 2, fillColor: "#e03131", fillOpacity: 0.45 } }).addTo(map));
    const fp = job.work?.kind === "liquid" ? job.work.footprint : null;
    if (fp) L.geoJSON(fp.run as any, { style: { color: "#5f3dc4", weight: 4 } }).addTo(map);
    const b = group.getBounds();
    if (b.isValid()) map.fitBounds(b.pad(0.25));
    return () => { map.remove(); };
  }, [state, job]);
  return <div ref={ref} className="h-[420px] w-full rounded border print:h-[150mm]" aria-label="Job map" />;
}

export default function JobPrintPage() {
  const [, params] = useRoute("/app/farm-map/jobs/:id/print");
  const { currentFarm } = useFarm();
  const { data: job, error } = useQuery({ queryKey: ["/api/applications", params?.id], queryFn: () => jobsApi.get(params!.id), enabled: !!params?.id });
  if (error) return <p className="p-4 text-sm text-red-700">{(error as Error).message}</p>;
  if (!job) return <p className="p-4 text-sm text-muted-foreground">Loading the job…</p>;
  const activity = job.activity as Activity;
  const exclusions = Array.from(new Map(job.lines.flatMap(l => l.exclusions).map(e => [e.id, e])).values());

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4 text-sm bg-background min-h-full print:p-0">
      <div className="flex items-center gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm"><Link href="/app/farm-map"><ArrowLeft className="h-4 w-4 mr-1" />Farm map</Link></Button>
        <Button size="sm" className="ml-auto" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print / save as PDF</Button>
      </div>
      <header className="flex justify-between gap-4 border-b pb-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{currentFarm?.name ?? "Farm"} · job sheet</p>
          <h1 className="text-xl font-bold">{ACTIVITY_LABELS[activity]}: {job.title || job.lines.map(l => l.name).filter(Boolean).join(", ")}</h1>
          <p>{job.status === "completed" ? `Done ${fmtWhen(job.completedAt)}` : job.plannedOn ? `Planned for ${job.plannedOn}` : "Not scheduled"}{job.contractor ? ` · ${job.contractor}` : ""}</p>
        </div>
        <p className="text-xs text-right text-muted-foreground">Printed {new Date().toLocaleString()}<br />Job {job.id.slice(0, 8)} · version {job.version}</p>
      </header>

      <JobMap job={job} />
      <p className="text-xs">Yellow: the area to {activity === "spray" ? "spray" : "treat"}. Red: exclusion zones, no application. White: paddock boundaries. The map is a guide drawn over aerial imagery, not a survey.</p>

      <section>
        <h2 className="font-semibold">Areas</h2>
        <table className="w-full text-xs border-collapse">
          <thead><tr className="border-b"><th className="text-left py-1">Paddock / area</th><th className="text-right">Gross</th><th className="text-right">Excluded</th><th className="text-right">Net</th>{activity === "fertiliser" && <><th className="text-left pl-2">Product and rate</th><th className="text-right">Quantity</th></>}</tr></thead>
          <tbody>
            {job.lines.map(l => (
              <tr key={l.id} className="border-b">
                <td className="py-1">{l.name ?? "Area"}</td><td className="text-right">{fmtHa(l.grossHa)}</td><td className="text-right">{fmtHa(l.excludedHa)}</td><td className="text-right font-semibold">{fmtHa(l.netHa)}</td>
                {activity === "fertiliser" && <><td className="pl-2">{l.productSnapshot?.name} @ {l.rate} {l.rateUnit}</td><td className="text-right">{l.plannedQuantity != null ? `${Math.round(l.plannedQuantity * 10) / 10} ${l.quantityUnit}` : "—"}</td></>}
              </tr>
            ))}
          </tbody>
        </table>
        {exclusions.length > 0 && <p className="text-xs mt-1">Excluded: {exclusions.map(e => `${e.name} (${e.ha.toFixed(3)} ha)`).join("; ")}.</p>}
      </section>

      {job.spray && (
        <section className="space-y-1">
          <h2 className="font-semibold">Tank mix</h2>
          <ul className="text-xs list-disc pl-4">
            {job.spray.mix.map(m => {
              const t = job.spray!.totals.products.find(p => p.mixId === m.id);
              return <li key={m.id}><strong>{m.productSnapshot.name}</strong> ({activesText(m.productSnapshot.activeIngredients)}) at {m.rate ?? "—"} {m.rateUnit.replace("/100L", " per 100 L")}: needs {t?.planned != null ? `${t.planned} ${t.plannedUnit}` : `unknown${t?.reason ? ` (${t.reason})` : ""}`}{m.labelRef ? `. Label: ${m.labelRef}` : ""}</li>;
            })}
          </ul>
          <p className="text-xs">Water {job.spray.waterRate ?? "—"} L/ha · {job.spray.totals.waterL ?? "—"} L total{job.spray.totals.tankLoadsPlanned != null ? ` · ${job.spray.totals.tankLoadsPlanned} tank loads of ${job.spray.tankVolume} L` : ""}. Target: {job.spray.target ?? "—"}. Follow each product's label. The mix hasn't been checked for compatibility.</p>
          <h3 className="font-semibold">Restrictions</h3>
          <ul className="text-xs list-disc pl-4">
            {job.spray.restrictions.map(r => <li key={r.id}>{RESTRICTION_LABELS[r.kind]} · {r.product ?? "mix"}: {r.status === "confirmed" ? `${r.periodValue} ${r.periodUnit} (${r.ruleSource})${r.endsAt ? `, until ${fmtWhen(r.endsAt)}` : ""}` : r.status === "not_applicable" ? `none (${r.ruleSource})` : "UNRESOLVED: check the label before grazing or harvesting"}</li>)}
          </ul>
        </section>
      )}

      {job.work?.kind === "liquid" && (
        <section className="text-xs space-y-0.5">
          <h2 className="font-semibold text-sm">{ACTIVITY_LABELS[activity]}</h2>
          <p>Method: {job.work.details.method ?? "—"}{job.work.details.machineSetting ? ` · setting ${job.work.details.machineSetting} (not a measured depth)` : ""}</p>
          <p>Volume {job.work.totals.volumeM3 ?? "—"} m³ · rate {job.work.totals.rateM3Ha ?? "—"} m³/ha · depth {job.work.totals.depthMm ?? "—"} mm</p>
          {job.work.footprint && <p>Run: wetted width {job.work.footprint.wettedWidthM} m, drift allowance {job.work.footprint.driftM} m{job.work.footprint.outsideHa > 0 || job.work.footprint.exclusionHa > 0 ? ". WARNING: the footprint reaches outside the allowed area or into an exclusion." : "."}</p>}
        </section>
      )}
      {job.notes && <section className="text-xs"><h2 className="font-semibold text-sm">Notes</h2><p className="whitespace-pre-wrap">{job.notes}</p></section>}

      <section className="border rounded p-3 space-y-3 text-xs break-inside-avoid">
        <h2 className="font-semibold text-sm">Completed by the operator</h2>
        {["Date and finish time", "Operator / certificate no.", activity === "spray" ? "Wind speed and direction, temperature" : "Weather and soil conditions",
          activity === "fertiliser" ? "Quantity applied and docket no." : activity === "spray" ? "Quantities used and tank loads" : "Quantities and docket no.", "Notes / problems", "Signature"].map(l => (
          <div key={l} className="flex gap-2 items-end"><span className="w-56 shrink-0">{l}</span><span className="flex-1 border-b border-dashed h-5" /></div>
        ))}
      </section>
    </div>
  );
}
