import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, MapPinned, Printer, Share2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readMapFile } from "@/lib/farm-map";
import { jobsApi, type Job } from "@/lib/jobs";
import { JOBS_KEY } from "./JobPanels";

// Under every job: GPS evidence, products to check, sharing with contractors, the print sheet and
// the edit history.

const fmtWhen = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

export function JobExtras({ job, role }: { job: Job; role: string | undefined }) {
  const manager = role === "owner" || role === "manager";
  const staff = manager || role === "worker";
  const queryClient = useQueryClient();
  const refresh = (j?: Job) => {
    if (j) queryClient.setQueryData([...JOBS_KEY, job.id], j);
    queryClient.invalidateQueries({ queryKey: JOBS_KEY });
  };
  return (
    <div className="space-y-3 border-t pt-3">
      <GpsEvidence job={job} canImport={role !== "viewer"} canRemove={manager} onSaved={refresh} />
      {manager && <ProductChecks job={job} onSaved={() => refresh()} />}
      {manager && <ShareJob job={job} onSaved={refresh} />}
      <div className="flex flex-wrap gap-2">
        {staff && <Button asChild size="sm" variant="outline"><Link href={`/app/farm-map/jobs/${job.id}/print`}><Printer className="h-4 w-4 mr-1" />Job sheet and map</Link></Button>}
      </div>
      <JobHistoryPanel job={job} />
    </div>
  );
}

function GpsEvidence({ job, canImport, canRemove, onSaved }: { job: Job; canImport: boolean; canRemove: boolean; onSaved: (j: Job) => void }) {
  const [busy, setBusy] = useState(false);
  const g = job.gps;
  const load = async (file: File) => {
    setBusy(true);
    try {
      const items = await readMapFile(file);
      const j = await jobsApi.setGps(job.id, { geometries: items.map(i => i.geometry), source: file.name });
      onSaved(j);
      toast.success("GPS evidence added");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-1 text-sm">
      <h3 className="font-semibold flex items-center gap-1"><MapPinned className="h-4 w-4" />Evidence</h3>
      {g ? (
        <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/30 p-2 text-xs space-y-0.5">
          <p className="font-medium">GPS evidence from {g.source}, imported {fmtWhen(g.importedAt)}</p>
          {g.trackM > 0 && <p>Track {g.trackM.toLocaleString()} m{g.trackOutsideM > 0 ? `, of which ${g.trackOutsideM.toLocaleString()} m is outside the recorded area` : ", all inside the recorded area"}.</p>}
          {g.coveredHa > 0 && <p>Covered area {g.coveredHa} ha{g.coveredPct != null ? ` (${g.coveredPct}% of the recorded area)` : ""}{g.coveredOutsideHa > 0 ? `, ${g.coveredOutsideHa} ha outside it` : ""}.</p>}
          {g.points > 0 && <p>{g.points} logged points.</p>}
          <p className="text-muted-foreground">Shown on the map in black. The recorded area is unchanged.</p>
          {canRemove && <button className="underline" onClick={async () => { if (window.confirm("Remove the GPS evidence from this job?")) { try { onSaved(await jobsApi.clearGps(job.id)); } catch (e: any) { toast.error(e.message); } } }}>Remove</button>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{job.status === "completed" ? "Recorded by hand: the drawn area isn't GPS proof of where it was applied." : "Planned on the map."}</p>
      )}
      {canImport && job.status === "completed" && (
        <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs cursor-pointer hover:bg-muted">
          <Upload className="h-3.5 w-3.5" />{busy ? "Reading…" : g ? "Replace GPS file" : "Import GPS track (GPX, KML, KMZ, GeoJSON)"}
          <input type="file" accept=".gpx,.kml,.kmz,.geojson,.json" className="sr-only" disabled={busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) load(f); }} />
        </label>
      )}
    </section>
  );
}

function ProductChecks({ job, onSaved }: { job: Job; onSaved: () => void }) {
  const products = new Map<string, string>();
  job.lines.forEach(l => { if (l.productSnapshot && l.productSnapshot.verification === "farm_entered") products.set(l.productId, l.productSnapshot.name); });
  job.spray?.mix.forEach(m => { if (m.productSnapshot.verification === "farm_entered") products.set(m.productId, m.productSnapshot.name); });
  const [open, setOpen] = useState<string | null>(null);
  const [ref, setRef] = useState("");
  if (products.size === 0) return null;
  return (
    <section className="space-y-1 text-sm">
      <h3 className="font-semibold flex items-center gap-1"><ShieldCheck className="h-4 w-4" />Farm-entered products</h3>
      {Array.from(products.entries()).map(([id, name]) => (
        <div key={id} className="text-xs space-y-1">
          <div className="flex items-center justify-between gap-2"><span>{name}: not checked</span>
            {open !== id && <button className="underline" onClick={() => { setOpen(id); setRef(""); }}>Check against its label</button>}</div>
          {open === id && (
            <div className="flex gap-1">
              <Input className="h-8 text-xs" value={ref} onChange={e => setRef(e.target.value)} placeholder="What it was checked against (e.g. label photo, 2 Nov)" aria-label="Checked against" />
              <Button size="sm" onClick={async () => {
                try { await jobsApi.verifyProduct(id, { reference: ref }); toast.success(`${name} checked. Its details count from now on; saved jobs keep the version they used.`); setOpen(null); onSaved(); }
                catch (e: any) { toast.error(e.message); }
              }}>Save</Button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function ShareJob({ job, onSaved }: { job: Job; onSaved: (j: Job) => void }) {
  const { data: people = [] } = useQuery({ queryKey: ["/api/applications/contractors"], queryFn: jobsApi.contractors });
  if (people.length === 0) {
    return <p className="text-xs text-muted-foreground flex items-center gap-1"><Share2 className="h-3.5 w-3.5" />Add a contractor in Settings → Team to share jobs with them.</p>;
  }
  const toggle = async (id: string) => {
    const next = job.sharedWith.includes(id) ? job.sharedWith.filter(x => x !== id) : [...job.sharedWith, id];
    try { onSaved(await jobsApi.share(job.id, next)); } catch (e: any) { toast.error(e.message); }
  };
  return (
    <section className="space-y-1 text-sm">
      <h3 className="font-semibold flex items-center gap-1"><Share2 className="h-4 w-4" />Shared with</h3>
      <div className="flex flex-wrap gap-2">
        {people.map(p => (
          <label key={p.id} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={job.sharedWith.includes(p.id)} onChange={() => toggle(p.id)} />{p.name}</label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Contractors see only the jobs shared with them, with the farm map and exclusions.</p>
    </section>
  );
}

function JobHistoryPanel({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState<number | null>(null);
  const { data } = useQuery({ queryKey: [...JOBS_KEY, job.id, "history", job.version], queryFn: () => jobsApi.history(job.id), enabled: open });
  const { data: v } = useQuery({ queryKey: [...JOBS_KEY, job.id, "version", version], queryFn: () => jobsApi.version(job.id, version!), enabled: version != null });
  return (
    <details className="text-sm" onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer font-semibold flex items-center gap-1"><History className="h-4 w-4" />Edit history</summary>
      {!data ? <p className="text-xs text-muted-foreground mt-1">Loading…</p> : (
        <div className="mt-1 space-y-2">
          <ul className="text-xs space-y-1">
            {data.changes.map(c => (
              <li key={c.version} className="rounded border p-1.5">
                <div className="flex justify-between gap-2"><span>{fmtWhen(c.at)} · {c.by ?? "—"} · {c.reason}</span>
                  <button className="underline" onClick={() => setVersion(version === c.version ? null : c.version)}>{version === c.version ? "Hide" : `Version ${c.version}`}</button></div>
                {c.changes.length ? <ul className="list-disc pl-4">{c.changes.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-muted-foreground">No recorded fields changed</p>}
                {version === c.version && v && (
                  <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-1 text-[10px] whitespace-pre-wrap">{JSON.stringify({ ...v.data, lines: v.data.lines?.map(({ geometry, ...l }: any) => l) }, null, 1)}</pre>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">All actions: {data.events.map(e => `${e.action} (${e.by ?? "—"}, ${fmtWhen(e.at)})`).join(" · ")}</p>
        </div>
      )}
    </details>
  );
}
