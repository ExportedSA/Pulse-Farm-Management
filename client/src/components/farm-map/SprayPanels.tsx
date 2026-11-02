import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FARM_MAP_KEY, type MapLayer, type MapState } from "@/lib/farm-map";
import {
  JOB_STATUSES, QTY_UNITS, RESTRICTION_LABELS, SPRAY_UNITS, WIND_DIRECTIONS, activesText, jobsApi,
  type CatalogueProduct, type Job, type JobSummary, type Restriction,
} from "@/lib/jobs";
import { JOBS_KEY, JobView, ProductPicker, type JobDraft } from "./JobPanels";
import { WorkJobView } from "./WorkPanels";
import type { Overlay } from "./FarmMapCanvas";

const fmtHa = (ha: number | null | undefined) => (ha == null ? "—" : `${Number(ha).toFixed(3)} ha`);
const fmtWhen = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const today = () => localNow().slice(0, 10);
const num = (v: string) => (v === "" ? null : Number(v));
const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";

/**
 * A saved job of either kind
 */
export function JobPanel({ jobId, canEdit, onClose, onOpenJob, onJob }: { jobId: string; canEdit: boolean; onClose: () => void; onOpenJob: (id: string) => void; onJob?: (j: Job | undefined) => void }) {
  const { data: job } = useQuery({ queryKey: [...JOBS_KEY, jobId], queryFn: () => jobsApi.get(jobId) });
  useEffect(() => { onJob?.(job); }, [job]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onJob?.(undefined), []); // eslint-disable-line react-hooks/exhaustive-deps
  if (job?.activity === "spray") return <SprayJobView job={job} canEdit={canEdit} onClose={onClose} />;
  if (job?.work) return <WorkJobView job={job} canEdit={canEdit} onClose={onClose} onOpenJob={onOpenJob} />;
  return <JobView jobId={jobId} canEdit={canEdit} onClose={onClose} />;
}

// ===== New spray job =====

interface MixRow { key: string; product: CatalogueProduct | null; rate: string; rateUnit: string; labelRef: string }
const newRow = (): MixRow => ({ key: crypto.randomUUID(), product: null, rate: "", rateUnit: "L/ha", labelRef: "" });

/**
 * Paddocks (tapped on the map) → tank mix → water and conditions → save. Rates come from the label,
 * not the catalogue. Restrictions are set up unresolved for every product and confirmed on the job.
 */
export function NewSprayForm({ state, draft, setDraft, onDrawPart, onCreated, onCancel }: {
  state: MapState; draft: JobDraft; setDraft: (fn: (d: JobDraft) => JobDraft) => void;
  onDrawPart: () => void; onCreated: (job: Job) => void; onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [mix, setMix] = useState<MixRow[]>([newRow()]);
  const [crop, setCrop] = useState("Pasture");
  const [target, setTarget] = useState("");
  const [waterRate, setWaterRate] = useState("");
  const [tankVolume, setTankVolume] = useState("");
  const [status, setStatus] = useState<"planned" | "completed">("completed");
  const [plannedOn, setPlannedOn] = useState(today());
  const [startedAt, setStartedAt] = useState("");
  const [completedAt, setCompletedAt] = useState(localNow());
  const [windSpeed, setWindSpeed] = useState("");
  const [windDirection, setWindDirection] = useState("");
  const [temperature, setTemperature] = useState("");
  const [weather, setWeather] = useState("");
  const [operator, setOperator] = useState("");
  const [operatorCert, setOperatorCert] = useState("");
  const [contractor, setContractor] = useState("");
  const [equipment, setEquipment] = useState("Boom sprayer");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const name = (id?: string | null) => state.paddocks.find(p => p.id === id)?.name ?? "Area";
  const setRow = (key: string, patch: Partial<MixRow>) => setMix(m => m.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const save = async () => {
    if (draft.lines.length === 0) return toast.error("Tap the paddocks on the map, or draw the area sprayed");
    const rows = mix.filter(r => r.product);
    if (rows.length === 0) return toast.error("Add the products in the tank");
    if (status === "completed" && !operator.trim() && !contractor.trim()) return toast.error("Enter who applied it");
    setSaving(true);
    try {
      const job = await jobsApi.create({
        activity: "spray", status, title: draft.title || null, plannedOn: status === "planned" ? plannedOn : null,
        startedAt: startedAt ? new Date(startedAt).toISOString() : null,
        completedAt: status === "completed" ? new Date(completedAt).toISOString() : null,
        crop: crop || null, target: target || null, waterRate: num(waterRate), tankVolume: num(tankVolume),
        windSpeed: num(windSpeed), windDirection: windDirection || null, temperature: num(temperature), weather: weather || null,
        operator: operator || null, operatorCert: operatorCert || null, contractor: contractor || null, equipment: equipment || null, notes: notes || null,
        clientId: draft.lines.map(l => l.key).join("").slice(0, 60),
        lines: draft.lines.map(l => ({ pastureId: l.pastureId ?? null, geometry: l.geometry ?? null, name: l.name ?? null })),
        mix: rows.map(r => ({ productId: r.product!.id, rate: num(r.rate), rateUnit: r.rateUnit, labelRef: r.labelRef || null })),
      });
      toast.success(status === "completed" ? "Spray recorded. Check its restrictions against the labels." : "Spray job saved");
      queryClient.invalidateQueries({ queryKey: JOBS_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restrictions"] });
      queryClient.invalidateQueries({ queryKey: FARM_MAP_KEY });
      onCreated(job);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-semibold">Spray job</h2><Button size="sm" variant="ghost" onClick={onCancel} aria-label="Close"><X className="h-4 w-4" /></Button></div>
      <section className="space-y-1">
        <Label>1. Paddocks</Label>
        <p className="text-xs text-muted-foreground">Tap paddocks on the map to add or remove them, or draw the area actually sprayed.</p>
        {draft.lines.length > 0 && (
          <ul className="space-y-1">
            {draft.lines.map(l => (
              <li key={l.key} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
                <span className="flex-1 truncate">{l.name ?? (l.geometry ? `${name(l.pastureId)} (part)` : name(l.pastureId))}</span>
                <button type="button" onClick={() => setDraft(d => ({ ...d, lines: d.lines.filter(x => x.key !== l.key) }))} aria-label="Remove"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        <Button size="sm" variant="outline" onClick={onDrawPart}>Draw the area sprayed</Button>
      </section>

      <section className="space-y-2">
        <Label>2. Tank mix</Label>
        {mix.map((r, i) => (
          <div key={r.key} className="rounded-md border p-2 space-y-2">
            <div className="flex items-start gap-1">
              <div className="flex-1"><ProductPicker kind="spray" value={r.product} label={`Product ${i + 1}`}
                onChange={p => setRow(r.key, { product: p, rateUnit: p?.units?.find(u => SPRAY_UNITS.includes(u)) ?? r.rateUnit })} /></div>
              {mix.length > 1 && <button type="button" className="mt-6" onClick={() => setMix(m => m.filter(x => x.key !== r.key))} aria-label="Remove product"><X className="h-4 w-4" /></button>}
            </div>
            {r.product && (
              <>
                <div className="grid grid-cols-[1fr_6.5rem] gap-1">
                  <Input type="number" inputMode="decimal" value={r.rate} placeholder="Rate from the label" aria-label={`Rate for ${r.product.name}`} onChange={e => setRow(r.key, { rate: e.target.value })} />
                  <select className={selectClass} value={r.rateUnit} aria-label="Rate unit" onChange={e => setRow(r.key, { rateUnit: e.target.value })}>
                    {SPRAY_UNITS.map(u => <option key={u} value={u}>{u.replace("/100L", " per 100 L")}</option>)}
                  </select>
                </div>
                <Input value={r.labelRef} placeholder="Where on the label (optional), e.g. pasture, thistles" aria-label="Label reference" onChange={e => setRow(r.key, { labelRef: e.target.value })} />
                {r.product.labelUrl && <a href={r.product.labelUrl} target="_blank" rel="noreferrer" className="text-xs underline inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" />Open the label</a>}
              </>
            )}
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setMix(m => [...m, newRow()])}><Plus className="h-4 w-4 mr-1" />Add a product or adjuvant</Button>
        <p className="text-xs text-muted-foreground">Rates aren't filled in from the product list: take them from the label for this crop and target. Recording a tank mix doesn't check that the products are compatible.</p>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor="sp-crop">3. Crop or pasture</Label><Input id="sp-crop" value={crop} onChange={e => setCrop(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="sp-target">Target</Label><Input id="sp-target" value={target} onChange={e => setTarget(e.target.value)} placeholder="Weed, pest or disease" /></div>
        <div className="space-y-1"><Label htmlFor="sp-water">Water rate (L/ha)</Label><Input id="sp-water" type="number" inputMode="decimal" value={waterRate} onChange={e => setWaterRate(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="sp-tank">Tank volume (L)</Label><Input id="sp-tank" type="number" inputMode="decimal" value={tankVolume} onChange={e => setTankVolume(e.target.value)} /></div>
      </section>

      <section className="space-y-2">
        <Label>4. When</Label>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1"><input type="radio" checked={status === "completed"} onChange={() => setStatus("completed")} />It's been sprayed</label>
          <label className="flex items-center gap-1"><input type="radio" checked={status === "planned"} onChange={() => setStatus("planned")} />Plan it</label>
        </div>
        {status === "completed" ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label htmlFor="sp-start" className="text-xs">Started</Label><Input id="sp-start" type="datetime-local" value={startedAt} max={localNow()} onChange={e => setStartedAt(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="sp-end" className="text-xs">Finished</Label><Input id="sp-end" type="datetime-local" value={completedAt} max={localNow()} onChange={e => setCompletedAt(e.target.value)} /></div>
          </div>
        ) : <Input type="date" value={plannedOn} onChange={e => setPlannedOn(e.target.value)} aria-label="Planned for" />}
        <p className="text-xs text-muted-foreground">Restrictions run from the finish time.</p>
      </section>

      <section className="space-y-2">
        <Label>5. Conditions and who applied it</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input type="number" inputMode="decimal" value={windSpeed} onChange={e => setWindSpeed(e.target.value)} placeholder="Wind km/h" aria-label="Wind speed" />
          <select className={selectClass} value={windDirection} onChange={e => setWindDirection(e.target.value)} aria-label="Wind direction">
            <option value="">Wind from…</option>{WIND_DIRECTIONS.map(d => <option key={d}>{d}</option>)}
          </select>
          <Input type="number" inputMode="decimal" value={temperature} onChange={e => setTemperature(e.target.value)} placeholder="Temp °C" aria-label="Temperature" />
        </div>
        <Input value={weather} onChange={e => setWeather(e.target.value)} placeholder="Other conditions (e.g. dry, no rain forecast)" aria-label="Conditions" />
        <div className="grid grid-cols-2 gap-2">
          <Input value={operator} onChange={e => setOperator(e.target.value)} placeholder="Person applying" aria-label="Operator" />
          <Input value={operatorCert} onChange={e => setOperatorCert(e.target.value)} placeholder="Certificate no." aria-label="Operator certificate" />
          <Input value={contractor} onChange={e => setContractor(e.target.value)} placeholder="Contractor" aria-label="Contractor" />
          <Input value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="Equipment" aria-label="Equipment" />
        </div>
        <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" aria-label="Notes" />
      </section>
      <div className="flex gap-2"><Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Save"}</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>
    </div>
  );
}

// ===== A saved spray job =====

const STATE_STYLE: Record<Restriction["state"], { label: string; cls: string }> = {
  not_started: { label: "Starts when the spray is done", cls: "bg-gray-100 text-gray-700" },
  unresolved: { label: "Unresolved", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  not_applicable: { label: "Label: doesn't apply", cls: "bg-gray-100 text-gray-700" },
  active: { label: "In force", cls: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200" },
  ended: { label: "Ended", cls: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
};

export function SprayJobView({ job, canEdit, onClose }: { job: Job; canEdit: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const sp = job.spray!;
  const [used, setUsed] = useState<Record<string, { q: string; u: string }>>({});
  const [loads, setLoads] = useState("");
  const [completedAt, setCompletedAt] = useState(localNow());
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    setUsed(Object.fromEntries(sp.mix.map(m => [m.id, { q: m.actualQuantity != null ? String(m.actualQuantity) : "", u: m.actualUnit ?? (m.rateUnit.startsWith("m") ? "mL" : m.rateUnit.startsWith("g") ? "g" : m.rateUnit.startsWith("k") ? "kg" : "L") }])));
    setLoads(sp.tankLoads != null ? String(sp.tankLoads) : "");
  }, [job.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = (j?: Job) => {
    if (j) queryClient.setQueryData([...JOBS_KEY, job.id], j);
    queryClient.invalidateQueries({ queryKey: JOBS_KEY });
    queryClient.invalidateQueries({ queryKey: ["/api/records"] });
    queryClient.invalidateQueries({ queryKey: ["/api/restrictions"] });
  };
  const act = async (w: () => Promise<Job | unknown>, msg: string) => {
    try { const j = await w(); refresh(j as Job); toast.success(msg); return true; } catch (e: any) { toast.error(e.message); return false; }
  };
  const editable = canEdit && job.status !== "cancelled";
  const usedChanged = sp.mix.some(m => (used[m.id]?.q ?? "") !== (m.actualQuantity != null ? String(m.actualQuantity) : "")) || loads !== (sp.tankLoads != null ? String(sp.tankLoads) : "");
  const g = sp.summary.grazing;
  const evidence = { planned: "Planned on the map", manual: "Recorded by hand (not GPS evidence)", gps: "Imported GPS evidence" }[job.evidence];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Spray job · {JOB_STATUSES.find(s => s.key === job.status)?.label}</p>
          <h2 className="font-semibold">{job.title || sp.mix.map(m => m.productSnapshot.name).join(" + ")}</h2>
          <p className="text-xs text-muted-foreground">{job.completedAt ? `Finished ${fmtWhen(job.completedAt)}` : job.plannedOn ? `Planned for ${job.plannedOn}` : ""}{job.startedAt ? ` · started ${fmtWhen(job.startedAt)}` : ""} · {evidence}</p>
          {(sp.target || sp.crop) && <p className="text-xs">{[sp.crop, sp.target && `for ${sp.target}`].filter(Boolean).join(" ")}</p>}
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close job"><X className="h-4 w-4" /></Button>
      </div>

      {g && (
        <div className={cn("rounded-md border p-2 text-sm flex gap-2",
          g.state === "unresolved" ? "border-red-300 bg-red-50 dark:bg-red-950/30" : g.state === "active" ? "border-orange-300 bg-orange-50 dark:bg-orange-950/30" : "")}>
          {g.state === "unresolved" ? <AlertTriangle className="h-4 w-4 text-red-700 shrink-0" /> : g.state === "active" ? <AlertTriangle className="h-4 w-4 text-orange-700 shrink-0" /> : <CheckCircle2 className="h-4 w-4 text-green-700 shrink-0" />}
          <span>{g.state === "unresolved" ? "Grazing restriction unresolved: treat these paddocks as not to be grazed until each product's label is checked below."
            : g.state === "active" ? `No grazing until ${fmtWhen(g.until)}.`
            : g.state === "not_started" ? "Restrictions start when the spray is recorded as done."
            : g.until ? `Grazing restriction ended ${fmtWhen(g.until)}.` : "The labels show no grazing restriction."}</span>
        </div>
      )}

      <section className="space-y-1">
        <h3 className="text-sm font-semibold">Areas</h3>
        <ul className="text-sm space-y-0.5">
          {job.lines.map(l => <li key={l.id} className="flex justify-between gap-2"><span>{l.name ?? "Area"}</span><span className="text-xs tabular-nums text-muted-foreground">{l.excludedHa ? `${fmtHa(l.grossHa)} − ${fmtHa(l.excludedHa)} excluded = ${fmtHa(l.netHa)}` : fmtHa(l.netHa)}</span></li>)}
        </ul>
        <p className="text-xs tabular-nums">Total {fmtHa(sp.totals.netHa)} · water {sp.totals.waterL != null ? `${sp.totals.waterL.toLocaleString()} L at ${sp.totals.waterRate} L/ha` : "rate not entered"}
          {sp.totals.tankLoadsPlanned != null ? ` · ${sp.totals.tankLoadsPlanned} tank load${sp.totals.tankLoadsPlanned === 1 ? "" : "s"} of ${sp.totals.tankVolume} L` : ""}</p>
      </section>

      <section className="space-y-1">
        <h3 className="text-sm font-semibold">Tank mix</h3>
        <ul className="space-y-1.5">
          {sp.mix.map(m => {
            const t = sp.totals.products.find(p => p.mixId === m.id);
            return (
              <li key={m.id} className="rounded-md border p-2 text-sm space-y-1">
                <div className="flex justify-between gap-2"><span className="font-medium">{m.productSnapshot.name}{m.role === "adjuvant" ? " (adjuvant)" : ""}</span><span className="text-xs">{m.rate ?? "—"} {m.rateUnit.replace("/100L", " per 100 L")}</span></div>
                <p className="text-xs text-muted-foreground">{activesText(m.productSnapshot.activeIngredients)}{m.productSnapshot.formulation ? ` · ${m.productSnapshot.formulation}` : ""}{m.productSnapshot.verification !== "verified" ? " · farm-entered" : ""}</p>
                {m.labelRef && <p className="text-xs">Label: {m.labelRef}</p>}
                <p className="text-xs tabular-nums">Needed: <strong>{t?.planned != null ? `${t.planned.toLocaleString()} ${t.plannedUnit}` : "not known"}</strong>{t?.reason ? ` (${t.reason})` : ""}</p>
                <div className="flex items-center gap-1 text-xs">
                  <span className="w-12">Used</span>
                  <Input className="h-7 text-xs w-24" type="number" inputMode="decimal" disabled={!editable} value={used[m.id]?.q ?? ""} placeholder="not entered"
                    onChange={e => setUsed(u => ({ ...u, [m.id]: { ...(u[m.id] ?? { u: "L" }), q: e.target.value } }))} aria-label={`Used of ${m.productSnapshot.name}`} />
                  <select className="h-7 rounded border bg-background px-1 text-xs" disabled={!editable} value={used[m.id]?.u ?? "L"} aria-label="Unit used"
                    onChange={e => setUsed(u => ({ ...u, [m.id]: { ...(u[m.id] ?? { q: "" }), u: e.target.value } }))}>{QTY_UNITS.map(q => <option key={q}>{q}</option>)}</select>
                  {m.productSnapshot.labelUrl && <a href={m.productSnapshot.labelUrl} target="_blank" rel="noreferrer" className="ml-auto underline inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" />Label</a>}
                </div>
                {t?.issues.map((x, n) => <p key={n} className="text-xs text-amber-800 flex gap-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{x}</p>)}
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-1 text-xs">
          <span>Tank loads used</span>
          <Input className="h-7 text-xs w-20" type="number" inputMode="decimal" disabled={!editable} value={loads} onChange={e => setLoads(e.target.value)} aria-label="Tank loads used" />
        </div>
        {editable && usedChanged && (
          <Button size="sm" onClick={() => act(() => jobsApi.used(job.id, { tankLoads: num(loads), used: sp.mix.map(m => ({ mixId: m.id, quantity: num(used[m.id]?.q ?? ""), unit: used[m.id]?.q ? used[m.id].u : null })) }), "Quantities saved")}>
            <Save className="h-4 w-4 mr-1" />Save quantities used
          </Button>
        )}
        <p className="text-xs text-muted-foreground">Recording a mix doesn't mean the products were checked as compatible.</p>
      </section>

      <section className="space-y-1">
        <h3 className="text-sm font-semibold">Restrictions</h3>
        <p className="text-xs text-muted-foreground">Enter each period from the product label for this use. An end date is worked out only once a period is confirmed with its source.</p>
        <ul className="space-y-1.5">
          {sp.restrictions.map(r => <RestrictionRow key={r.id} job={job} r={r} editable={editable} onSaved={refresh} />)}
        </ul>
        {editable && (adding
          ? <AddRestriction job={job} onDone={j => { setAdding(false); if (j) refresh(j); }} />
          : <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />Add re-entry or other restriction</Button>)}
      </section>

      {(sp.windSpeed != null || sp.windDirection || sp.temperature != null || job.weather || job.operator || job.contractor || job.equipment || job.notes) && (
        <dl className="grid grid-cols-[6.5rem_1fr] gap-x-2 text-xs">
          {(sp.windSpeed != null || sp.windDirection) && <><dt className="text-muted-foreground">Wind</dt><dd>{[sp.windSpeed != null ? `${sp.windSpeed} km/h` : null, sp.windDirection ? `from ${sp.windDirection}` : null].filter(Boolean).join(" ")}</dd></>}
          {sp.temperature != null && <><dt className="text-muted-foreground">Temperature</dt><dd>{sp.temperature} °C</dd></>}
          {job.weather && <><dt className="text-muted-foreground">Conditions</dt><dd>{job.weather}</dd></>}
          {job.operator && <><dt className="text-muted-foreground">Applied by</dt><dd>{job.operator}{sp.operatorCert ? ` (cert ${sp.operatorCert})` : ""}</dd></>}
          {job.contractor && <><dt className="text-muted-foreground">Contractor</dt><dd>{job.contractor}</dd></>}
          {job.equipment && <><dt className="text-muted-foreground">Equipment</dt><dd>{job.equipment}</dd></>}
          {job.notes && <><dt className="text-muted-foreground">Notes</dt><dd className="whitespace-pre-wrap">{job.notes}</dd></>}
        </dl>
      )}

      {editable && job.status !== "completed" && (
        <div className="space-y-2 rounded-md border p-2">
          <Label htmlFor="sp-done-at">Finished at</Label>
          <Input id="sp-done-at" type="datetime-local" value={completedAt} max={localNow()} onChange={e => setCompletedAt(e.target.value)} />
          <Button size="sm" className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => act(() => jobsApi.update(job.id, { status: "completed", completedAt: new Date(completedAt).toISOString(), version: job.version }), "Spray recorded as done")}><CheckCircle2 className="h-4 w-4 mr-1" />Sprayed</Button>
        </div>
      )}
      {editable && (
        <div className="flex flex-wrap gap-2">
          {job.status === "completed" && <Button size="sm" variant="outline" onClick={() => act(() => jobsApi.update(job.id, { status: "planned", completedAt: null, version: job.version }), "Job reopened")}>Reopen</Button>}
          <Button size="sm" variant="ghost" className="text-red-700" onClick={async () => {
            if (!window.confirm("Cancel this spray job? It stays in the history, and its restrictions stop applying.")) return;
            await act(() => jobsApi.cancel(job.id), "Job cancelled");
          }}><Trash2 className="h-4 w-4 mr-1" />Cancel job</Button>
        </div>
      )}
    </div>
  );
}

function RestrictionRow({ job, r, editable, onSaved }: { job: Job; r: Restriction; editable: boolean; onSaved: (j: Job) => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(r.status);
  const [value, setValue] = useState(r.periodValue != null ? String(r.periodValue) : "");
  const [unit, setUnit] = useState<"hours" | "days">(r.periodUnit ?? "days");
  const [appliesTo, setAppliesTo] = useState(r.appliesTo ?? "");
  const [source, setSource] = useState(r.ruleSource ?? "");
  const [saving, setSaving] = useState(false);
  const st = STATE_STYLE[r.state];
  const save = async () => {
    setSaving(true);
    try {
      const j = await jobsApi.saveRestriction(job.id, r.id, { status, periodValue: status === "confirmed" ? num(value) : null, periodUnit: status === "confirmed" ? unit : null, appliesTo: appliesTo || null, ruleSource: source || null });
      onSaved(j);
      toast.success("Restriction saved");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <li className="rounded-md border p-2 text-sm space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{RESTRICTION_LABELS[r.kind]}{r.product ? ` · ${r.product}` : ""}</span>
        <span className={cn("text-[11px] rounded px-1.5", st.cls)}>{st.label}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {r.status === "confirmed" ? `${r.periodValue} ${r.periodUnit}${r.appliesTo ? ` for ${r.appliesTo}` : ""}${r.endsAt ? ` · until ${fmtWhen(r.endsAt)}` : ""}`
          : r.status === "not_applicable" ? "The label shows none applies"
          : "Period not entered yet. It stays unresolved, not zero."}
        {r.ruleSource ? ` · source: ${r.ruleSource}` : ""}{r.confirmedBy ? ` · ${r.confirmedBy}` : ""}
      </p>
      {editable && !open && <button type="button" className="text-xs underline" onClick={() => setOpen(true)}>{r.status === "unresolved" ? "Enter from the label" : "Change"}</button>}
      {open && (
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1"><input type="radio" checked={status === "confirmed"} onChange={() => setStatus("confirmed")} />Label gives a period</label>
            <label className="flex items-center gap-1"><input type="radio" checked={status === "not_applicable"} onChange={() => setStatus("not_applicable")} />Label says none</label>
            <label className="flex items-center gap-1"><input type="radio" checked={status === "unresolved"} onChange={() => setStatus("unresolved")} />Not checked yet</label>
          </div>
          {status === "confirmed" && (
            <div className="grid grid-cols-[5rem_6rem_1fr] gap-1">
              <Input type="number" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} aria-label="Period" placeholder="e.g. 7" />
              <select className="h-9 rounded-md border bg-background px-1 text-sm" value={unit} onChange={e => setUnit(e.target.value as any)} aria-label="Period unit"><option value="days">days</option><option value="hours">hours</option></select>
              <Input value={appliesTo} onChange={e => setAppliesTo(e.target.value)} placeholder="Applies to (e.g. dairy cows)" aria-label="Applies to" />
            </div>
          )}
          {status !== "unresolved" && <Input value={source} onChange={e => setSource(e.target.value)} placeholder="Where it comes from: label section, or document" aria-label="Rule source" />}
          <div className="flex gap-2"><Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button><Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button></div>
        </div>
      )}
    </li>
  );
}

function AddRestriction({ job, onDone }: { job: Job; onDone: (j?: Job) => void }) {
  const [kind, setKind] = useState<"reentry" | "other">("reentry");
  const [mixId, setMixId] = useState(job.spray!.mix[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<"hours" | "days">("hours");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const save = async () => {
    try {
      const resolved = value !== "";
      onDone(await jobsApi.addRestriction(job.id, {
        kind, mixId: mixId || null, status: resolved ? "confirmed" : "unresolved",
        periodValue: resolved ? Number(value) : null, periodUnit: resolved ? unit : null, ruleSource: source || null, notes: notes || null,
      }));
      toast.success("Restriction added");
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="grid grid-cols-2 gap-2">
        <select className={selectClass} value={kind} onChange={e => setKind(e.target.value as any)} aria-label="Kind"><option value="reentry">Re-entry</option><option value="other">Other</option></select>
        <select className={selectClass} value={mixId} onChange={e => setMixId(e.target.value)} aria-label="Product">
          {job.spray!.mix.map(m => <option key={m.id} value={m.id}>{m.productSnapshot.name}</option>)}<option value="">Whole mix</option>
        </select>
      </div>
      <div className="grid grid-cols-[5rem_6rem] gap-1">
        <Input type="number" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} placeholder="Period" aria-label="Period" />
        <select className="h-9 rounded-md border bg-background px-1 text-sm" value={unit} onChange={e => setUnit(e.target.value as any)} aria-label="Period unit"><option value="hours">hours</option><option value="days">days</option></select>
      </div>
      <Input value={source} onChange={e => setSource(e.target.value)} placeholder="Where it comes from (needed with a period)" aria-label="Rule source" />
      <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" aria-label="Notes" />
      <p className="text-xs text-muted-foreground">Leave the period blank if it isn't known yet: it's kept as unresolved.</p>
      <div className="flex gap-2"><Button size="sm" onClick={save}>Add</Button><Button size="sm" variant="outline" onClick={() => onDone()}>Cancel</Button></div>
    </div>
  );
}

// ===== Map and paddock warnings =====

/**
 * The restriction layer: paddocks still under a grazing or harvest restriction. Unresolved ones are
 * drawn red and hatched-dashed; confirmed ones in force orange.
 */
export function restrictionOverlays(jobs: JobSummary[], layers: MapLayer[]): Overlay[] {
  const layer = layers.find(l => l.key === "restrictions");
  if (!layer) return [];
  const out: Overlay[] = [];
  for (const j of jobs) {
    if (j.activity !== "spray" || j.status !== "completed" || !j.restriction) continue;
    const states = [j.restriction.grazing?.state, j.restriction.harvest?.state];
    const unresolved = states.includes("unresolved");
    if (!unresolved && !states.includes("active")) continue;
    for (const l of j.lines ?? []) {
      out.push({
        key: `restr-${j.id}-${l.id}`, geometry: l.geometry, layerId: layer.id, rank: 2, sel: { type: "job", id: j.id },
        pickLabel: `Restriction: ${unresolved ? "unresolved" : `no grazing until ${fmtWhen(j.restriction.grazing?.until)}`} · ${j.products ?? ""}`,
        label: unresolved ? "Restriction unresolved" : `No grazing until ${new Date(j.restriction.grazing?.until ?? j.restriction.harvest?.until ?? "").toLocaleDateString()}`,
        style: unresolved
          ? { color: "#e03131", weight: 3, dashArray: "4 4", fillColor: "#e03131", fillOpacity: 0.2 }
          : { color: layer.style.color, weight: 2, fillColor: layer.style.fillColor, fillOpacity: layer.style.fillOpacity },
      });
    }
  }
  return out;
}

/**
 * Restrictions in force on a paddock now (or at a given time); used on the paddock panel and when
 * recording grazing or harvest
 */
export function RestrictionWarning({ pastureIds, kind, at, compact }: { pastureIds: string[]; kind: "grazing" | "harvest" | "grazing,harvest"; at?: string; compact?: boolean }) {
  const { data = [] } = useQuery({
    queryKey: ["/api/restrictions", pastureIds.join(","), kind, at ?? "now"],
    queryFn: async () => (await Promise.all(pastureIds.map(id => jobsApi.restrictions({ pastureId: id, kind, at }).then(rs => rs.map(r => ({ ...r, pastureId: id })))))).flat(),
    enabled: pastureIds.length > 0,
  });
  if (data.length === 0) return null;
  const byJob = new Map<string, typeof data>();
  data.forEach(r => byJob.set(r.applicationId, [...(byJob.get(r.applicationId) ?? []), r]));
  return (
    <div className="rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/30 p-2 text-sm space-y-1" role="alert">
      <p className="font-medium flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-orange-700" />Spray restriction in force{at ? " at that time" : ""}</p>
      {Array.from(byJob.values()).map(rs => {
        const unresolved = rs.some(r => r.status === "unresolved");
        const until = rs.filter(r => r.endsAt).map(r => r.endsAt!).sort().pop();
        return (
          <p key={rs[0].applicationId} className="text-xs">
            {rs[0].areas ?? "Area"}: {Array.from(new Set(rs.map(r => r.product).filter(Boolean))).join(" + ")} sprayed {fmtWhen(rs[0].appliedAt)} ·{" "}
            {unresolved ? <strong className="text-red-700">{Array.from(new Set(rs.filter(r => r.status === "unresolved").map(r => RESTRICTION_LABELS[r.kind as Restriction["kind"]].toLowerCase()))).join(" and ")} restriction unresolved</strong>
              : <strong>{Array.from(new Set(rs.map(r => RESTRICTION_LABELS[r.kind as Restriction["kind"]].toLowerCase()))).join(" and ")} until {fmtWhen(until)}</strong>}
          </p>
        );
      })}
      {!compact && <p className="text-xs text-muted-foreground">Unresolved means a label period hasn't been entered on the spray job yet.</p>}
    </div>
  );
}
