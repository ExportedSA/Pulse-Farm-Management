import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useFarm } from "@/lib/farm-context";
import { currentSeason, previousSeasons } from "@/components/records/SeasonPanel";
import { FARM_MAP_KEY, download, farmMap, toKml } from "@/lib/farm-map";
import { ACTIVITY_LABELS, jobsApi, type Activity } from "@/lib/jobs";

// Reports over the farm map jobs: applications and sprays, nutrients per paddock, harvest, and
// docket reconciliation. Filter by season or dates, activity, paddock, product or contractor.
// Each table exports as CSV; "Print / PDF" prints every section (choose "Save as PDF").

const SECTIONS = [
  { key: "jobs", label: "Applications" }, { key: "sprays", label: "Sprays" }, { key: "nutrients", label: "Nutrients" },
  { key: "harvest", label: "Harvest" }, { key: "dockets", label: "Dockets" },
] as const;
type Section = typeof SECTIONS[number]["key"];

const seasonRange = (season: string) => { const s = Number(season.slice(0, 4)); return { from: `${s}-06-01`, to: `${s + 1}-05-31` }; };
const calendarYear = (y: number) => ({ from: `${y}-01-01`, to: `${y}-12-31` });

function Table({ columns, rows, empty }: { columns: [string, string][]; rows: any[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground py-2">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead><tr>{columns.map(([k, l]) => <th key={k} className="text-left font-semibold border-b px-1.5 py-1 whitespace-nowrap">{l}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b align-top">
              {columns.map(([k]) => {
                const v = r[k];
                const text = Array.isArray(v) ? v.join("; ") : v == null || v === "" ? "—" : String(v);
                return <td key={k} className={cn("px-1.5 py-1", /UNRESOLVED/.test(text) && "text-red-700 font-semibold")}>{text}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FarmReportsPage() {
  const { currentFarm } = useFarm();
  const [period, setPeriod] = useState<string>(`season:${currentSeason()}`);
  const [custom, setCustom] = useState(() => seasonRange(currentSeason()));
  const [activity, setActivity] = useState("");
  const [pastureId, setPastureId] = useState("");
  const [product, setProduct] = useState("");
  const [contractor, setContractor] = useState("");
  const [section, setSection] = useState<Section>("jobs");
  const range = period.startsWith("season:") ? seasonRange(period.slice(7)) : period.startsWith("year:") ? calendarYear(Number(period.slice(5))) : custom;
  const filters = { from: range.from, to: range.to, activity: activity || undefined, pastureId: pastureId || undefined, product: product.trim() || undefined, contractor: contractor.trim() || undefined };
  const { data: state } = useQuery({ queryKey: FARM_MAP_KEY, queryFn: farmMap.state });
  const { data: report, isLoading, error } = useQuery({ queryKey: ["/api/activity-reports", filters], queryFn: () => jobsApi.report(filters) });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as any).toString();
  const year = new Date().getFullYear();
  const title = `${currentFarm?.name ?? "Farm"}: activity ${range.from} to ${range.to}`;

  const kml = async () => {
    try {
      const res = await fetch(`/api/activity-reports/jobs.geojson?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Couldn't export");
      const fc = await res.json();
      download(new Blob([toKml({ ...fc, features: fc.features.filter((f: any) => f.geometry) }, title)], { type: "application/vnd.google-earth.kml+xml" }), `pulse-jobs-${range.from}-to-${range.to}.kml`);
    } catch (e: any) { toast.error(e.message); }
  };

  const columns: Record<Section, [string, string][]> = useMemo(() => ({
    jobs: [["date", "Date"], ["activity", "Activity"], ["evidence", "Status / evidence"], ["paddock", "Paddock / area"], ["netHa", "Net ha"], ["excludedHa", "Excluded ha"],
      ["what", "Product / work"], ["quantity", "Quantities"], ["contractor", "Contractor"], ["dockets", "Dockets"], ["cost", "Cost share $"]],
    sprays: [["date", "Date"], ["evidence", "Status / evidence"], ["paddocks", "Paddocks"], ["mix", "Tank mix"], ["target", "Target"], ["operator", "Applied by"], ["restriction", "Grazing"], ["restrictions", "Restrictions (label source)"]],
    nutrients: [["paddock", "Paddock"], ["mappedHa", "Mapped ha"], ["N", "N kg"], ["P", "P kg"], ["K", "K kg"], ["S", "S kg"], ["Nha", "N kg/ha"], ["notCounted", "Not counted"]],
    harvest: [["date", "Date"], ["activity", "Activity"], ["status", "Status"], ["paddocks", "Paddocks"], ["netHa", "Net ha"], ["fresh", "Fresh t"], ["dm", "DM t"], ["destination", "Destination"], ["contractor", "Contractor"]],
    dockets: [["number", "Docket"], ["supplier", "Supplier"], ["date", "Date"], ["product", "Product"], ["delivered", "Delivered"], ["allocatedKg", "Allocated kg"], ["appliedKg", "Applied kg"], ["jobs", "Jobs"], ["issues", "Check"]],
  }), []);
  const rows: Record<Section, any[]> = report ? {
    jobs: report.jobs, sprays: report.sprays,
    nutrients: report.nutrients.map((n: any) => ({ ...n, ...n.kg, Nha: n.perHa?.N ?? "—" })),
    harvest: report.harvest.map((h: any) => ({ ...h, fresh: h.freshT != null ? `${h.freshT}${h.freshBasis === "estimated" ? " (est.)" : ""}` : "unknown", dm: h.dmT != null ? `${h.dmT}${h.dmBasis === "estimated" ? " (est.)" : ""}` : "unknown" })),
    dockets: report.dockets.map((d: any) => ({ ...d, issues: d.issues.length ? d.issues : "OK" })),
  } : { jobs: [], sprays: [], nutrients: [], harvest: [], dockets: [] };
  const empty = { jobs: "No jobs in these dates.", sprays: "No sprays in these dates.", nutrients: "No completed fertiliser or effluent with a known analysis.", harvest: "No baleage or silage.", dockets: "No dockets." };

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto bg-background min-h-full print:p-0">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm"><Link href="/app/farm-map"><ArrowLeft className="h-4 w-4 mr-1" />Farm map</Link></Button>
        <h1 className="text-xl font-bold text-pulse-forest mr-auto">Activity reports</h1>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print / PDF</Button>
        <Button asChild variant="outline" size="sm"><a href={`/api/activity-reports/jobs.geojson?${qs}`} download={`pulse-jobs-${range.from}-to-${range.to}.geojson`}><Download className="h-4 w-4 mr-1" />Job areas GeoJSON</a></Button>
        <Button variant="outline" size="sm" onClick={kml}><Download className="h-4 w-4 mr-1" />KML</Button>
      </div>
      <h1 className="hidden print:block text-lg font-bold">{title}</h1>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6 print:hidden">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={period} onChange={e => setPeriod(e.target.value)} aria-label="Period">
          {previousSeasons(5).map(s => <option key={s} value={`season:${s}`}>Season {s}</option>)}
          {[year, year - 1, year - 2].map(y => <option key={y} value={`year:${y}`}>Calendar {y}</option>)}
          <option value="custom">Custom dates</option>
        </select>
        {period === "custom" ? (
          <div className="flex gap-1 sm:col-span-2">
            <Input type="date" value={custom.from} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} aria-label="From" />
            <Input type="date" value={custom.to} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} aria-label="To" />
          </div>
        ) : <p className="text-sm self-center sm:col-span-2 text-muted-foreground">{range.from} to {range.to}</p>}
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={activity} onChange={e => setActivity(e.target.value)} aria-label="Activity">
          <option value="">All activities</option>{(Object.keys(ACTIVITY_LABELS) as Activity[]).map(a => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={pastureId} onChange={e => setPastureId(e.target.value)} aria-label="Paddock">
          <option value="">All paddocks</option>{state?.paddocks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex gap-1">
          <Input value={product} onChange={e => setProduct(e.target.value)} placeholder="Product" aria-label="Product" />
          <Input value={contractor} onChange={e => setContractor(e.target.value)} placeholder="Contractor" aria-label="Contractor" />
        </div>
      </div>

      {error ? <p className="text-sm text-red-700">{(error as Error).message}</p> : isLoading || !report ? <p className="text-sm text-muted-foreground">Building the report…</p> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            {[["Jobs", report.totals.jobs], ["Completed", report.totals.completed], ["With GPS evidence", report.totals.gps], ["Costs", `$${report.totals.cost.toLocaleString()}`]].map(([l, v]) => (
              <div key={l as string} className="rounded-md border p-2"><div className="text-xs text-muted-foreground">{l}</div><div className="text-lg font-semibold tabular-nums">{v}</div></div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Planned work, work recorded by hand, and work with imported GPS evidence are shown separately. A drawn area isn't GPS proof of placement. Nutrients count only verified product analyses and entered effluent analyses.</p>
          <div className="flex flex-wrap gap-1 border-b print:hidden" role="tablist">
            {SECTIONS.map(s => (
              <button key={s.key} role="tab" aria-selected={section === s.key} onClick={() => setSection(s.key)}
                className={cn("px-3 py-1.5 text-sm border-b-2 -mb-px", section === s.key ? "border-pulse-forest font-semibold" : "border-transparent text-muted-foreground")}>
                {s.label} <span className="text-xs">({rows[s.key].length})</span>
              </button>
            ))}
          </div>
          {SECTIONS.map(s => (
            <section key={s.key} className={cn("space-y-2", section === s.key ? "block" : "hidden print:block")}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{s.label}</h2>
                <Button asChild size="sm" variant="outline" className="print:hidden"><a href={`/api/activity-reports/export.csv?section=${s.key}&${qs}`}><Download className="h-4 w-4 mr-1" />CSV</a></Button>
              </div>
              <Table columns={columns[s.key]} rows={rows[s.key]} empty={empty[s.key]} />
            </section>
          ))}
        </>
      )}
    </div>
  );
}
