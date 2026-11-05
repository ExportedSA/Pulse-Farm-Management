import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as turf from "@turf/turf";
import { AlertTriangle, CheckCircle2, Save, Spline, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { saveMessage } from "@/lib/application-outbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FARM_MAP_KEY, type MapState } from "@/lib/farm-map";
import { ACTIVITY_LABELS, JOB_STATUSES, WIND_DIRECTIONS, jobsApi, type Activity, type Job, type JobSummary } from "@/lib/jobs";
import { JOBS_KEY, type JobDraft } from "./JobPanels";
import type { Overlay } from "./FarmMapCanvas";

// Effluent, slurry, baleage, silage, topping and mowing: the form for a new job and the view of a
// saved one. Depth comes from a volume or a documented calibration, never from the machine
// setting; nutrients only from an entered analysis; estimates are labelled.

const fmtHa = (ha: number | null | undefined) => (ha == null ? "—" : `${Number(ha).toFixed(3)} ha`);
const fmtWhen = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const today = () => localNow().slice(0, 10);
const num = (v: string) => (v === "" ? null : Number(v));
const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const isLiquid = (a: Activity) => a === "effluent" || a === "slurry";
const isHarvest = (a: Activity) => a === "baleage" || a === "silage";

const METHODS: Record<string, string[]> = {
  effluent: ["Travelling irrigator", "Pods", "K-line", "Fixed sprinklers", "Umbilical", "Tanker", "Other"],
  slurry: ["Tanker", "Umbilical", "Dribble bar", "Trailing shoe", "Other"],
};

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  // A wrapping label gives the input its name
  return <label className={cn("block space-y-1", className)}><span className="text-xs font-medium">{label}</span>{children}</label>;
}

export function NewWorkForm({ activity, state, draft, setDraft, jobs, onDrawPart, onDrawRun, onCreated, onCancel }: {
  activity: Activity; state: MapState; draft: JobDraft; setDraft: (fn: (d: JobDraft) => JobDraft) => void; jobs: JobSummary[];
  onDrawPart: () => void; onDrawRun: () => void; onCreated: (job: Job) => void; onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [v, setV] = useState<Record<string, string>>({ method: METHODS[activity]?.[0] ?? "", volumeSource: "flow meter", weightBasis: "estimated", dmBasis: "estimated", analysisUnit: "kg/m3", moistureUnit: "% VWC", purpose: activity === "mowing" ? "quality" : "", wettedWidth: "", drift: "5" });
  const set = (k: string) => (e: { target: { value: string } }) => setV(x => ({ ...x, [k]: e.target.value }));
  const [status, setStatus] = useState<"planned" | "completed">("completed");
  const [plannedOn, setPlannedOn] = useState(today());
  const [startedAt, setStartedAt] = useState("");
  const [completedAt, setCompletedAt] = useState(localNow());
  const [linkedJobId, setLinkedJobId] = useState("");
  const [saving, setSaving] = useState(false);
  const name = (id?: string | null) => state.paddocks.find(p => p.id === id)?.name ?? "Area";
  const harvests = jobs.filter(j => (j.activity === "baleage" || j.activity === "silage") && j.status !== "cancelled");

  const details = (): Record<string, unknown> => {
    const d: Record<string, unknown> = {};
    const put = (k: string, val: unknown) => { if (val !== "" && val != null) d[k] = val; };
    if (isLiquid(activity)) {
      put("method", v.method); put("machineSetting", v.machineSetting);
      if (v.volume) { d.volumeM3 = Number(v.volume); d.volumeSource = v.volumeSource; }
      if (v.loads) put("loads", num(v.loads));
      if (v.loadSize) put("loadSizeM3", num(v.loadSize));
      if (v.calDepth || v.calRef) d.calibration = { depthMm: num(v.calDepth), reference: v.calRef ?? "" };
      if (v.moisture) d.soilMoisture = { reading: Number(v.moisture), unit: v.moistureUnit, probe: v.probe || null, observedAt: v.moistureAt ? new Date(v.moistureAt).toISOString() : null };
      put("soilCondition", v.soilCondition); put("pondLevel", num(v.pondLevel ?? ""));
      if (v.n || v.p || v.k) d.analysis = { n: num(v.n ?? ""), p: num(v.p ?? ""), k: num(v.k ?? ""), unit: v.analysisUnit, sampledOn: v.sampledOn || null, source: v.lab || null };
    } else if (activity === "baleage") {
      put("cutOn", v.cutOn); put("baledOn", v.baledOn); put("wrappedOn", v.wrappedOn);
      put("baleCount", num(v.baleCount ?? "")); put("baleSize", v.baleSize);
      if (v.baleWeight) { d.baleWeightKg = Number(v.baleWeight); d.weightBasis = v.weightBasis; }
    } else if (activity === "silage") {
      put("cutOn", v.cutOn); put("harvestedOn", v.harvestedOn);
      put("weighbridgeTonnes", num(v.weighbridge ?? "")); put("loads", num(v.loads ?? "")); put("loadTonnes", num(v.loadTonnes ?? ""));
    } else {
      put("purpose", v.purpose); put("observations", v.observations); put("followUp", v.followUp);
    }
    if (isHarvest(activity)) {
      if (v.dm) { d.dmPercent = Number(v.dm); d.dmBasis = v.dmBasis; }
      put("additive", v.additive); put("destination", v.destination);
    }
    return d;
  };

  const save = async () => {
    if (draft.lines.length === 0 && !draft.run) return toast.error("Tap the paddocks on the map, or draw the area");
    if (draft.run && !(Number(v.wettedWidth) > 0)) return toast.error("Enter the wetted width of the run");
    if (activity === "mowing" && v.purpose === "feed" && !linkedJobId) return toast.error("Choose the baleage or silage job this cut is for");
    setSaving(true);
    try {
      const job = await jobsApi.create({
        activity, status, plannedOn: status === "planned" ? plannedOn : null,
        startedAt: startedAt ? new Date(startedAt).toISOString() : null,
        completedAt: status === "completed" ? new Date(completedAt).toISOString() : null,
        operator: v.operator || null, contractor: v.contractor || null, equipment: v.equipment || null, weather: v.weather || null,
        windSpeed: num(v.windSpeed ?? ""), windDirection: v.windDirection || null, cost: num(v.cost ?? ""), notes: v.notes || null,
        linkedJobId: activity === "mowing" && v.purpose === "feed" ? linkedJobId : null,
        clientId: (draft.lines.map(l => l.key).join("") || crypto.randomUUID()).slice(0, 60),
        lines: draft.lines.map(l => ({ pastureId: l.pastureId ?? null, geometry: l.geometry ?? null, name: l.name ?? null })),
        run: draft.run ? { geometry: draft.run, wettedWidthM: Number(v.wettedWidth), driftM: num(v.drift ?? "") ?? 0 } : null,
        details: details(),
      });
      toast.success(`${ACTIVITY_LABELS[activity]} ${status === "completed" ? "recorded" : "planned"}`);
      queryClient.invalidateQueries({ queryKey: JOBS_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: FARM_MAP_KEY });
      onCreated(job);
    } catch (e: any) {
      // Offline: kept on the device and uploaded later
      if (saveMessage(e, toast)) onCancel();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-semibold">{ACTIVITY_LABELS[activity]} job</h2><Button size="sm" variant="ghost" onClick={onCancel} aria-label="Close"><X className="h-4 w-4" /></Button></div>

      <section className="space-y-1">
        <Label>1. Where</Label>
        <p className="text-xs text-muted-foreground">Tap paddocks on the map{isLiquid(activity) ? ", draw the irrigator run," : ""} or draw a part of a paddock.</p>
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
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onDrawPart}>Draw part of a paddock</Button>
          {activity === "effluent" && <Button size="sm" variant="outline" onClick={onDrawRun}><Spline className="h-4 w-4 mr-1" />{draft.run ? "Redraw the run" : "Draw the irrigator run"}</Button>}
        </div>
        {draft.run && (
          <div className="rounded-md border p-2 space-y-2">
            <div className="flex items-center justify-between text-sm"><span>Run drawn ({Math.round(turf.length(turf.feature(draft.run), { units: "meters" }))} m)</span>
              <button type="button" className="text-xs underline" onClick={() => setDraft(d => ({ ...d, run: null }))}>Remove</button></div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Wetted width (m)"><Input type="number" inputMode="decimal" value={v.wettedWidth} onChange={set("wettedWidth")} /></Field>
              <Field label="Drift allowance (m)"><Input type="number" inputMode="decimal" value={v.drift} onChange={set("drift")} /></Field>
            </div>
            <p className="text-xs text-muted-foreground">The wetted footprint (dashed on the map) is the treated area. The paddocks tapped are where it's allowed to go. The drift allowance is a margin for the check, not a prediction of where spray will land.</p>
          </div>
        )}
      </section>

      {isLiquid(activity) && (
        <section className="space-y-2">
          <Label>2. How much</Label>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Method"><select className={selectClass} value={v.method} onChange={set("method")}>{METHODS[activity].map(m => <option key={m}>{m}</option>)}</select></Field>
            <Field label="Machine setting"><Input value={v.machineSetting ?? ""} onChange={set("machineSetting")} placeholder="e.g. Fast, Slow" /></Field>
            <Field label="Volume (m³)"><Input type="number" inputMode="decimal" value={v.volume ?? ""} onChange={set("volume")} /></Field>
            <Field label="Volume from"><select className={selectClass} value={v.volumeSource} onChange={set("volumeSource")}>
              {["flow meter", "pump hours", "tanker loads", "estimate", "other"].map(s => <option key={s}>{s}</option>)}</select></Field>
            {activity === "slurry" && <>
              <Field label="Tanker loads"><Input type="number" inputMode="decimal" value={v.loads ?? ""} onChange={set("loads")} /></Field>
              <Field label="Load size (m³)"><Input type="number" inputMode="decimal" value={v.loadSize ?? ""} onChange={set("loadSize")} /></Field>
            </>}
          </div>
          <details className="rounded-md border p-2">
            <summary className="text-xs font-medium cursor-pointer">Documented calibration (instead of a volume)</summary>
            <div className="grid grid-cols-[6rem_1fr] gap-2 mt-2">
              <Field label="Depth (mm)"><Input type="number" inputMode="decimal" value={v.calDepth ?? ""} onChange={set("calDepth")} /></Field>
              <Field label="Where it's documented"><Input value={v.calRef ?? ""} onChange={set("calRef")} placeholder="e.g. bucket test, 12 Sep" /></Field>
            </div>
          </details>
          <p className="text-xs text-muted-foreground">A fast/slow setting isn't a measured depth. Depth and rate are worked out only from the volume over the treated area, or a documented calibration (1 mm over 1 ha = 10 m³).</p>
          <Label>3. Soil and weather</Label>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Soil moisture"><Input type="number" inputMode="decimal" value={v.moisture ?? ""} onChange={set("moisture")} /></Field>
            <Field label="Unit"><select className={selectClass} value={v.moistureUnit} onChange={set("moistureUnit")}>{["% VWC", "kPa", "mm deficit", "other"].map(u => <option key={u}>{u}</option>)}</select></Field>
            <Field label="Probe / site"><Input value={v.probe ?? ""} onChange={set("probe")} /></Field>
            <Field label="Read at" className="col-span-2"><Input type="datetime-local" value={v.moistureAt ?? ""} onChange={set("moistureAt")} /></Field>
            <Field label="Soil"><select className={selectClass} value={v.soilCondition ?? ""} onChange={set("soilCondition")}><option value="">—</option>{["Dry", "Moist", "Wet", "Saturated"].map(s => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Wind km/h"><Input type="number" inputMode="decimal" value={v.windSpeed ?? ""} onChange={set("windSpeed")} /></Field>
            <Field label="Wind from"><select className={selectClass} value={v.windDirection ?? ""} onChange={set("windDirection")}><option value="">—</option>{WIND_DIRECTIONS.map(d => <option key={d}>{d}</option>)}</select></Field>
            {activity === "effluent" && <Field label="Pond level %"><Input type="number" inputMode="decimal" value={v.pondLevel ?? ""} onChange={set("pondLevel")} /></Field>}
          </div>
          <Input value={v.weather ?? ""} onChange={set("weather")} placeholder="Weather (e.g. dry, no rain forecast)" aria-label="Weather" />
          <details className="rounded-md border p-2">
            <summary className="text-xs font-medium cursor-pointer">Nutrient analysis (if sampled)</summary>
            <div className="grid grid-cols-4 gap-2 mt-2">
              <Field label="N"><Input type="number" inputMode="decimal" value={v.n ?? ""} onChange={set("n")} /></Field>
              <Field label="P"><Input type="number" inputMode="decimal" value={v.p ?? ""} onChange={set("p")} /></Field>
              <Field label="K"><Input type="number" inputMode="decimal" value={v.k ?? ""} onChange={set("k")} /></Field>
              <Field label="Unit"><select className={selectClass} value={v.analysisUnit} onChange={set("analysisUnit")}><option value="kg/m3">kg/m³</option><option value="mg/L">mg/L</option></select></Field>
              <Field label="Sampled" className="col-span-2"><Input type="date" value={v.sampledOn ?? ""} onChange={set("sampledOn")} /></Field>
              <Field label="Lab / source" className="col-span-2"><Input value={v.lab ?? ""} onChange={set("lab")} /></Field>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Without an analysis its nutrients stay unknown. No typical value is assumed.</p>
          </details>
        </section>
      )}

      {activity === "baleage" && (
        <section className="grid grid-cols-3 gap-2">
          <Field label="Cut"><Input type="date" value={v.cutOn ?? ""} onChange={set("cutOn")} /></Field>
          <Field label="Baled"><Input type="date" value={v.baledOn ?? ""} onChange={set("baledOn")} /></Field>
          <Field label="Wrapped"><Input type="date" value={v.wrappedOn ?? ""} onChange={set("wrappedOn")} /></Field>
          <Field label="Bales"><Input type="number" inputMode="numeric" value={v.baleCount ?? ""} onChange={set("baleCount")} /></Field>
          <Field label="Bale size" className="col-span-2"><Input value={v.baleSize ?? ""} onChange={set("baleSize")} placeholder="e.g. 1.2 m round" /></Field>
          <Field label="Bale weight (kg)"><Input type="number" inputMode="decimal" value={v.baleWeight ?? ""} onChange={set("baleWeight")} /></Field>
          <Field label="Weight is" className="col-span-2"><select className={selectClass} value={v.weightBasis} onChange={set("weightBasis")}><option value="estimated">estimated</option><option value="measured">measured (weighed)</option></select></Field>
        </section>
      )}
      {activity === "silage" && (
        <section className="grid grid-cols-2 gap-2">
          <Field label="Cut"><Input type="date" value={v.cutOn ?? ""} onChange={set("cutOn")} /></Field>
          <Field label="Harvested"><Input type="date" value={v.harvestedOn ?? ""} onChange={set("harvestedOn")} /></Field>
          <Field label="Weighbridge (fresh t)" className="col-span-2"><Input type="number" inputMode="decimal" value={v.weighbridge ?? ""} onChange={set("weighbridge")} /></Field>
          <Field label="Or loads"><Input type="number" inputMode="decimal" value={v.loads ?? ""} onChange={set("loads")} /></Field>
          <Field label="× tonnes per load (estimate)"><Input type="number" inputMode="decimal" value={v.loadTonnes ?? ""} onChange={set("loadTonnes")} /></Field>
        </section>
      )}
      {isHarvest(activity) && (
        <section className="grid grid-cols-2 gap-2">
          <Field label="Dry matter %"><Input type="number" inputMode="decimal" value={v.dm ?? ""} onChange={set("dm")} /></Field>
          <Field label="DM % is"><select className={selectClass} value={v.dmBasis} onChange={set("dmBasis")}><option value="estimated">estimated</option><option value="measured">measured (tested)</option></select></Field>
          <Field label="Additive"><Input value={v.additive ?? ""} onChange={set("additive")} /></Field>
          <Field label={activity === "silage" ? "Stack or pit" : "Stored at"}><Input value={v.destination ?? ""} onChange={set("destination")} /></Field>
          <p className="text-xs text-muted-foreground col-span-2">Fresh tonnes and tonnes of dry matter are kept apart. Anything worked out from an estimate is shown as an estimate.</p>
        </section>
      )}
      {(activity === "topping" || activity === "mowing") && (
        <section className="space-y-2">
          {activity === "mowing" ? (
            <>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-1"><input type="radio" checked={v.purpose === "quality"} onChange={() => setV(x => ({ ...x, purpose: "quality" }))} />For pasture quality</label>
                <label className="flex items-center gap-1"><input type="radio" checked={v.purpose === "feed"} onChange={() => setV(x => ({ ...x, purpose: "feed" }))} />Cut for baleage or silage</label>
              </div>
              {v.purpose === "feed" && (
                <Field label="The harvest it's for">
                  <select className={selectClass} value={linkedJobId} onChange={e => setLinkedJobId(e.target.value)}>
                    <option value="">Choose…</option>
                    {harvests.map(j => <option key={j.id} value={j.id}>{ACTIVITY_LABELS[j.activity as Activity]} · {(j.completedAt ?? j.plannedOn ?? "").slice(0, 10)}{j.title ? ` · ${j.title}` : ""}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground">The cut is part of that harvest, so it isn't counted as a second operation. Record the harvest first if it isn't listed.</p>
                </Field>
              )}
            </>
          ) : <Field label="Purpose"><Input value={v.purpose ?? ""} onChange={set("purpose")} placeholder="e.g. seed heads, residuals" /></Field>}
          <Field label="Observations"><Textarea rows={2} value={v.observations ?? ""} onChange={set("observations")} /></Field>
          <Field label="Follow-up"><Input value={v.followUp ?? ""} onChange={set("followUp")} /></Field>
        </section>
      )}

      <section className="space-y-2">
        <Label>When and who</Label>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1"><input type="radio" checked={status === "completed"} onChange={() => setStatus("completed")} />It's been done</label>
          <label className="flex items-center gap-1"><input type="radio" checked={status === "planned"} onChange={() => setStatus("planned")} />Plan it</label>
        </div>
        {status === "completed" ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Started"><Input type="datetime-local" value={startedAt} max={localNow()} onChange={e => setStartedAt(e.target.value)} /></Field>
            <Field label="Finished"><Input type="datetime-local" value={completedAt} max={localNow()} onChange={e => setCompletedAt(e.target.value)} /></Field>
          </div>
        ) : <Input type="date" value={plannedOn} onChange={e => setPlannedOn(e.target.value)} aria-label="Planned for" />}
        <div className="grid grid-cols-2 gap-2">
          <Input value={v.operator ?? ""} onChange={set("operator")} placeholder="Operator" aria-label="Operator" />
          <Input value={v.contractor ?? ""} onChange={set("contractor")} placeholder="Contractor" aria-label="Contractor" />
          <Input value={v.equipment ?? ""} onChange={set("equipment")} placeholder="Equipment" aria-label="Equipment" />
          <Input type="number" inputMode="decimal" value={v.cost ?? ""} onChange={set("cost")} placeholder="Cost ($)" aria-label="Cost" />
        </div>
        <Textarea rows={2} value={v.notes ?? ""} onChange={set("notes")} placeholder="Notes" aria-label="Notes" />
        <p className="text-xs text-muted-foreground">Attach a docket or contractor record after saving.</p>
      </section>
      <div className="flex gap-2"><Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Save"}</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>
    </div>
  );
}

const basisTag = (b: string | null | undefined) => (b === "estimated" ? <span className="text-[10px] rounded px-1 bg-amber-100 text-amber-900">estimate</span> : b === "measured" ? <span className="text-[10px] rounded px-1 bg-green-100 text-green-800">measured</span> : null);

export function WorkJobView({ job, canEdit, onClose, onOpenJob }: { job: Job; canEdit: boolean; onClose: () => void; onOpenJob: (id: string) => void }) {
  const queryClient = useQueryClient();
  const w = job.work!;
  const d = w.details ?? {};
  const activity = job.activity as Activity;
  const [completedAt, setCompletedAt] = useState(localNow());
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      const j = await fn();
      if (j && (j as Job).id) queryClient.setQueryData([...JOBS_KEY, job.id], j);
      queryClient.invalidateQueries({ queryKey: JOBS_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      toast.success(msg);
    } catch (e: any) { saveMessage(e, toast); }
  };
  const editable = canEdit && job.status !== "cancelled";
  const evidence = { planned: "Planned on the map", manual: "Recorded by hand (not GPS evidence)", gps: "Imported GPS evidence" }[job.evidence];
  const row = (k: string, val: React.ReactNode) => (val == null || val === "" ? null : <><dt className="text-muted-foreground">{k}</dt><dd>{val}</dd></>);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{ACTIVITY_LABELS[activity]} · {JOB_STATUSES.find(s => s.key === job.status)?.label}</p>
          <h2 className="font-semibold">{job.title || job.lines.map(l => l.name).filter(Boolean).join(", ") || ACTIVITY_LABELS[activity]}</h2>
          <p className="text-xs text-muted-foreground">{job.completedAt ? `Finished ${fmtWhen(job.completedAt)}` : job.plannedOn ? `Planned for ${job.plannedOn}` : ""}{job.startedAt ? ` · started ${fmtWhen(job.startedAt)}` : ""} · {evidence}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close job"><X className="h-4 w-4" /></Button>
      </div>

      <section className="space-y-1">
        <h3 className="text-sm font-semibold">Area</h3>
        <ul className="text-sm space-y-0.5">
          {job.lines.map(l => <li key={l.id} className="flex justify-between gap-2"><span>{l.name ?? "Area"}</span><span className="text-xs tabular-nums text-muted-foreground">{l.excludedHa ? `${fmtHa(l.grossHa)} − ${fmtHa(l.excludedHa)} excluded = ${fmtHa(l.netHa)}` : fmtHa(l.netHa)}</span></li>)}
        </ul>
        {job.lines.some(l => l.exclusions?.length) && <p className="text-xs text-muted-foreground">Exclusions taken off: {Array.from(new Set(job.lines.flatMap(l => l.exclusions.map(e => e.name)))).join(", ")}</p>}
      </section>

      {w.kind === "liquid" && (
        <>
          {w.footprint && (
            <div className={cn("rounded-md border p-2 text-sm space-y-1", (w.footprint.outsideHa > 0 || w.footprint.exclusionHa > 0) ? "border-red-300 bg-red-50 dark:bg-red-950/30" : "border-green-200 bg-green-50 dark:bg-green-950/30")}>
              <p className="font-medium flex items-center gap-1">{(w.footprint.outsideHa > 0 || w.footprint.exclusionHa > 0) ? <AlertTriangle className="h-4 w-4 text-red-700" /> : <CheckCircle2 className="h-4 w-4 text-green-700" />}Run footprint</p>
              <p className="text-xs">Wetted width {w.footprint.wettedWidthM} m, drift allowance {w.footprint.driftM} m.</p>
              {w.footprint.outsideHa > 0 && <p className="text-xs text-red-800">{fmtHa(w.footprint.outsideHa)} reaches outside {w.footprint.allowed} (red on the map).</p>}
              {w.footprint.exclusionHa > 0 && <p className="text-xs text-red-800">{fmtHa(w.footprint.exclusionHa)} reaches into an exclusion (orange on the map).</p>}
              {w.footprint.outsideHa === 0 && w.footprint.exclusionHa === 0 && <p className="text-xs">Stays inside {w.footprint.allowed} and clear of exclusions, with the drift allowance.</p>}
              <p className="text-xs text-muted-foreground">The drift allowance is a margin, not a guaranteed prediction.</p>
            </div>
          )}
          <section className="rounded-md border p-2 text-sm space-y-1">
            <h3 className="font-semibold">Volume, rate and depth</h3>
            <div className="grid grid-cols-3 text-center tabular-nums text-xs">
              <div><div className="text-muted-foreground">Volume</div>{w.totals.volumeM3 != null ? `${w.totals.volumeM3} m³` : "unknown"}</div>
              <div><div className="text-muted-foreground">Rate</div>{w.totals.rateM3Ha != null ? `${w.totals.rateM3Ha} m³/ha` : "unknown"}</div>
              <div><div className="text-muted-foreground">Depth</div>{w.totals.depthMm != null ? `${w.totals.depthMm} mm` : "unknown"}</div>
            </div>
            {w.totals.volumeSource && <p className="text-xs">From {w.totals.volumeSource} {w.totals.estimate ? basisTag("estimated") : null}</p>}
            {d.machineSetting && <p className="text-xs">Machine setting: {d.machineSetting} (not used for depth)</p>}
            {w.totals.notes.map((n, i) => <p key={i} className="text-xs text-amber-800">{n}</p>)}
          </section>
          <section className="rounded-md border p-2 text-sm space-y-1">
            <h3 className="font-semibold">Nutrients</h3>
            {w.totals.nutrientsKg
              ? <p className="text-xs tabular-nums">{Object.entries(w.totals.nutrientsKg).map(([k, v]) => `${k} ${v ?? "unknown"} kg`).join(" · ")} · from the analysis{w.totals.analysis?.sampledOn ? ` sampled ${w.totals.analysis.sampledOn}` : ""}{w.totals.analysis?.source ? ` (${w.totals.analysis.source})` : ""}</p>
              : <p className="text-xs text-muted-foreground">Unknown: {w.totals.analysis ? "the volume is needed" : "no analysis entered. No typical value is assumed."}</p>}
          </section>
          <dl className="grid grid-cols-[7rem_1fr] gap-x-2 text-xs">
            {row("Method", d.method)}
            {row("Soil moisture", d.soilMoisture ? `${d.soilMoisture.reading} ${d.soilMoisture.unit}${d.soilMoisture.probe ? ` at ${d.soilMoisture.probe}` : ""}${d.soilMoisture.observedAt ? `, ${fmtWhen(d.soilMoisture.observedAt)}` : ""}` : null)}
            {row("Soil", d.soilCondition)}
            {row("Pond level", d.pondLevel != null ? `${d.pondLevel}%` : null)}
            {row("Calibration", d.calibration ? `${d.calibration.depthMm} mm (${d.calibration.reference})` : null)}
          </dl>
        </>
      )}

      {w.kind === "harvest" && (
        <>
          <section className="rounded-md border p-2 text-sm space-y-1">
            <h3 className="font-semibold">Quantities</h3>
            <div className="grid grid-cols-2 text-center tabular-nums text-xs">
              <div><div className="text-muted-foreground">Fresh</div>{w.totals.freshT != null ? `${w.totals.freshT} t` : "unknown"} {basisTag(w.totals.freshBasis)}</div>
              <div><div className="text-muted-foreground">Dry matter</div>{w.totals.dmT != null ? `${w.totals.dmT} t DM` : "unknown"} {basisTag(w.totals.dmBasis)}</div>
            </div>
            {w.totals.kgDmPerBale != null && <p className="text-xs">{w.totals.kgDmPerBale} kg DM per bale</p>}
            {w.totals.notes.map((n, i) => <p key={i} className="text-xs text-amber-800">{n}</p>)}
          </section>
          <dl className="grid grid-cols-[7rem_1fr] gap-x-2 text-xs">
            {row("Cut", d.cutOn)}{row("Baled", d.baledOn)}{row("Wrapped", d.wrappedOn)}{row("Harvested", d.harvestedOn)}
            {row("Bales", d.baleCount != null ? `${d.baleCount}${d.baleSize ? ` × ${d.baleSize}` : ""}` : null)}
            {row("Bale weight", d.baleWeightKg != null ? <>{d.baleWeightKg} kg {basisTag(d.weightBasis)}</> : null)}
            {row("Weighbridge", d.weighbridgeTonnes != null ? `${d.weighbridgeTonnes} t` : null)}
            {row("Loads", d.loads != null ? `${d.loads}${d.loadTonnes != null ? ` × ${d.loadTonnes} t (estimate)` : ""}` : null)}
            {row("Dry matter", d.dmPercent != null ? <>{d.dmPercent}% {basisTag(d.dmBasis)}</> : null)}
            {row("Additive", d.additive)}{row(activity === "silage" ? "Stack / pit" : "Stored at", d.destination)}
          </dl>
          <p className="text-xs">{w.mowing ? <>Mowing: <button className="underline" onClick={() => onOpenJob(w.mowing!.id)}>open the mowing job</button></> : "No mowing job linked. Record the cut as mowing for feed, linked to this job."}</p>
        </>
      )}

      {w.kind === "field" && (
        <dl className="grid grid-cols-[7rem_1fr] gap-x-2 text-xs">
          {row("Purpose", activity === "mowing" ? (d.purpose === "feed" ? "Cut for feed" : "Pasture quality") : d.purpose)}
          {row("Harvest", w.linkedJob ? <button className="underline" onClick={() => onOpenJob(w.linkedJob!.id)}>{ACTIVITY_LABELS[w.linkedJob.activity as Activity]} job</button> : null)}
          {row("Observations", d.observations)}{row("Follow-up", d.followUp)}
        </dl>
      )}

      <dl className="grid grid-cols-[7rem_1fr] gap-x-2 text-xs">
        {row("Operator", job.operator)}{row("Contractor", job.contractor)}{row("Equipment", job.equipment)}
        {row("Weather", job.weather)}{row("Cost", job.cost != null ? `$${job.cost.toLocaleString()}` : null)}
        {row("Notes", job.notes ? <span className="whitespace-pre-wrap">{job.notes}</span> : null)}
      </dl>

      {editable && job.status !== "completed" && (
        <div className="space-y-2 rounded-md border p-2">
          <Label htmlFor="wk-done-at">Finished at</Label>
          <Input id="wk-done-at" type="datetime-local" value={completedAt} max={localNow()} onChange={e => setCompletedAt(e.target.value)} />
          <Button size="sm" className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => act(() => jobsApi.update(job.id, { status: "completed", completedAt: new Date(completedAt).toISOString(), version: job.version }), "Recorded as done")}><CheckCircle2 className="h-4 w-4 mr-1" />Done</Button>
        </div>
      )}
      {editable && (
        <div className="flex flex-wrap gap-2">
          {job.status === "completed" && <Button size="sm" variant="outline" onClick={() => act(() => jobsApi.update(job.id, { status: "planned", completedAt: null, version: job.version }), "Job reopened")}>Reopen</Button>}
          <Button size="sm" variant="ghost" className="text-red-700" onClick={async () => {
            if (!window.confirm("Cancel this job? It stays in the history.")) return;
            await act(() => jobsApi.cancel(job.id), "Job cancelled");
          }}><Trash2 className="h-4 w-4 mr-1" />Cancel job</Button>
        </div>
      )}
    </div>
  );
}

/**
 * The open effluent job's run check on the map: wetted footprint, drift reach, and where it goes
 * outside the allowed paddocks or into an exclusion
 */
export function footprintOverlays(job: Job | undefined): Overlay[] {
  const f = job?.work?.kind === "liquid" ? job.work.footprint : null;
  if (!f) return [];
  const out: Overlay[] = [
    { key: "fp-reach", geometry: f.reach, rank: 7, style: { color: "#5f3dc4", weight: 1, dashArray: "3 5", fillOpacity: 0 } },
    { key: "fp-run", geometry: f.run, rank: 7, style: { color: "#5f3dc4", weight: 3 } },
  ];
  if (f.outside) out.push({ key: "fp-out", geometry: f.outside, rank: 6, label: "Outside the allowed area", style: { color: "#e03131", weight: 2, fillColor: "#e03131", fillOpacity: 0.45 } });
  if (f.exclusion) out.push({ key: "fp-ex", geometry: f.exclusion, rank: 6, label: "Into an exclusion", style: { color: "#f76707", weight: 2, fillColor: "#f76707", fillOpacity: 0.55 } });
  return out;
}

/**
 * The run being set up: the line and (once a width is entered on save) its footprint preview
 */
export function runPreview(draft: JobDraft | null, widthM = 0): Overlay[] {
  if (!draft?.run) return [];
  const out: Overlay[] = [{ key: "run-line", geometry: draft.run, rank: 8, style: { color: "#5f3dc4", weight: 3 } }];
  if (widthM > 0) out.push({ key: "run-fp", geometry: turf.buffer(turf.feature(draft.run), widthM / 2, { units: "meters" })!.geometry, rank: 8, style: { color: "#5f3dc4", weight: 1, dashArray: "6 4", fillColor: "#5f3dc4", fillOpacity: 0.2 } });
  return out;
}
