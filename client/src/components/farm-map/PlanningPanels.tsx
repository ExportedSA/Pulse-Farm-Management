import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as turf from "@turf/turf";
import { AlertTriangle, CheckCircle2, Copy, Pencil, Plus, Save, Square, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EXCLUSION_ACTIVITIES, FARM_MAP_KEY, PLAN_ACTIVITIES, RATE_UNITS, farmMap,
  type AreaBreakdown, type Exclusion, type ExclusionInput, type MapState, type RatePlan,
} from "@/lib/farm-map";
import type { Overlay } from "./FarmMapCanvas";

type Run = <T>(w: () => Promise<T>, s?: string) => Promise<T | undefined>;

const fmtHa = (ha: number | null | undefined) => (ha == null ? "—" : `${Number(ha).toFixed(3)} ha`);
const today = () => new Date().toISOString().slice(0, 10);
const activityLabel = (k: string) => EXCLUSION_ACTIVITIES.find(a => a.key === k)?.label ?? k;
const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";

// ===== Exclusions =====

export function ExclusionsSection({ exclusions, canEdit, onSelect, onAdd }: { exclusions: Exclusion[]; canEdit: boolean; onSelect: (id: string) => void; onAdd: () => void }) {
  const [showEnded, setShowEnded] = useState(false);
  const list = exclusions.filter(e => showEnded || e.status !== "ended");
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Exclusions</h2>
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={showEnded} onChange={e => setShowEnded(e.target.checked)} />Show ended</label>
      </div>
      {list.length === 0 ? <p className="text-xs text-muted-foreground">No exclusions yet. Add setbacks from streams, bores, soak holes or boundaries.</p> : (
        <ul className="divide-y rounded-md border text-sm">
          {list.map(e => (
            <li key={e.id}>
              <button className="w-full text-left px-2 py-1.5 hover:bg-muted" onClick={() => onSelect(e.id)}>
                <div className="flex justify-between gap-2">
                  <span className="truncate">{e.name}</span>
                  <span className={cn("text-xs", e.status === "active" ? "text-red-700" : "text-muted-foreground")}>{e.status}</span>
                </div>
                <div className="text-xs text-muted-foreground">{e.activities.map(activityLabel).join(", ")}{e.bufferM ? ` · ${e.bufferM} m` : ""}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {canEdit && <Button size="sm" variant="outline" onClick={onAdd}><Plus className="h-4 w-4 mr-1" />Add exclusion</Button>}
      <p className="text-xs text-muted-foreground">Exclusions always apply to area and rate calculations, even when their layer is hidden.</p>
    </section>
  );
}

export type ExclusionDraft = { sourceKind: Exclusion["sourceKind"]; geometry?: GeoJSON.Geometry | null; featureId?: string | null; pastureId?: string | null };

/**
 * Choosing what a new exclusion is based on: a drawn area, a margin around something, or a paddock edge
 */
export function ExclusionStart({ state, onDraw, onPick, onCancel }: {
  state: MapState; onDraw: (shape: "Polygon" | "Line" | "Marker") => void; onPick: (d: ExclusionDraft) => void; onCancel: () => void;
}) {
  const [featureId, setFeatureId] = useState("");
  const [pastureId, setPastureId] = useState("");
  return (
    <div className="space-y-3 text-sm">
      <h2 className="font-semibold">New exclusion</h2>
      <p className="text-muted-foreground">What is it based on?</p>
      <div className="grid gap-2">
        <Button variant="outline" className="justify-start" onClick={() => onDraw("Polygon")}><Square className="h-4 w-4 mr-2" />Draw the area</Button>
        <Button variant="outline" className="justify-start" onClick={() => onDraw("Line")}>A distance either side of a line I draw (stream, drain)</Button>
        <Button variant="outline" className="justify-start" onClick={() => onDraw("Marker")}>A distance around a point I place (bore, soak hole)</Button>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ex-feature">Or around a map feature</Label>
        <div className="flex gap-2">
          <select id="ex-feature" className={selectClass} value={featureId} onChange={e => setFeatureId(e.target.value)}>
            <option value="">Choose…</option>
            {state.features.map(f => <option key={f.id} value={f.id}>{f.name || f.kind} · {state.layers.find(l => l.id === f.layerId)?.name}</option>)}
          </select>
          <Button size="sm" disabled={!featureId} onClick={() => onPick({ sourceKind: "around", featureId })}>Use</Button>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ex-paddock">Or a strip along a paddock's edge</Label>
        <div className="flex gap-2">
          <select id="ex-paddock" className={selectClass} value={pastureId} onChange={e => setPastureId(e.target.value)}>
            <option value="">Choose…</option>
            {state.paddocks.filter(p => p.geometry).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button size="sm" disabled={!pastureId} onClick={() => onPick({ sourceKind: "edge", pastureId })}>Use</Button>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-4 w-4 mr-1" />Cancel</Button>
    </div>
  );
}

/**
 * The excluded area as it would be saved, shown on the map while filling in the form
 */
export function exclusionPreview(state: MapState, draft: ExclusionDraft, bufferM: number): GeoJSON.Geometry | null {
  try {
    if (draft.sourceKind === "edge") {
      const p = state.paddocks.find(x => x.id === draft.pastureId)?.geometry;
      if (!p || bufferM <= 0) return null;
      const strip = turf.buffer(turf.polygonToLine(p as any) as any, bufferM, { units: "meters" });
      return strip ? (turf.intersect(turf.featureCollection([strip as any, turf.feature(p) as any])) as any)?.geometry ?? null : null;
    }
    let g: GeoJSON.Geometry | undefined = draft.geometry ?? undefined;
    let extra = 0;
    if (draft.featureId) {
      const f = state.features.find(x => x.id === draft.featureId);
      g = f?.geometry;
      if (f?.kind === "circle") extra = f.radiusM ?? 0;
    }
    if (!g) return null;
    const d = bufferM + extra;
    if (d <= 0) return g.type.includes("Polygon") ? g : null;
    return (turf.buffer(turf.feature(g) as any, d, { units: "meters" }) as any)?.geometry ?? null;
  } catch {
    return null;
  }
}

export function ExclusionEditor({ state, exclusion, draft, canEdit, run, onPreview, onDone, onRedraw }: {
  state: MapState; exclusion?: Exclusion; draft?: ExclusionDraft; canEdit: boolean; run: Run;
  onPreview: (g: GeoJSON.Geometry | null) => void; onDone: () => void; onRedraw?: () => void;
}) {
  const [form, setForm] = useState<ExclusionInput>(() => exclusion ? {
    name: exclusion.name, reason: exclusion.reason, activities: exclusion.activities, sourceKind: exclusion.sourceKind,
    bufferM: exclusion.bufferM, permanent: exclusion.permanent, startsOn: exclusion.startsOn, endsOn: exclusion.endsOn,
    requirementSource: exclusion.requirementSource, confirmedBy: exclusion.confirmedBy, confirmedOn: exclusion.confirmedOn,
  } : {
    name: "", reason: "", activities: [], sourceKind: draft!.sourceKind, geometry: draft!.geometry, featureId: draft!.featureId,
    pastureId: draft!.pastureId, bufferM: draft!.geometry?.type.includes("Polygon") ? 0 : 20, permanent: true,
  });
  useEffect(() => {
    if (!exclusion) return;
    setForm(f => ({ ...f, name: exclusion.name, reason: exclusion.reason, activities: exclusion.activities, bufferM: exclusion.bufferM,
      permanent: exclusion.permanent, startsOn: exclusion.startsOn, endsOn: exclusion.endsOn, requirementSource: exclusion.requirementSource,
      confirmedBy: exclusion.confirmedBy, confirmedOn: exclusion.confirmedOn }));
  }, [exclusion?.id, exclusion?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof ExclusionInput>(k: K, v: ExclusionInput[K]) => setForm(f => ({ ...f, [k]: v }));

  // Preview the area that would be excluded
  useEffect(() => {
    if (exclusion && form.bufferM === exclusion.bufferM) { onPreview(null); return; }
    const source: ExclusionDraft = exclusion
      ? { sourceKind: exclusion.sourceKind, featureId: exclusion.featureId, pastureId: exclusion.pastureId, geometry: exclusion.featureId || exclusion.pastureId ? null : undefined }
      : draft!;
    onPreview(exclusion && !exclusion.featureId && !exclusion.pastureId ? null : exclusionPreview(state, source, Number(form.bufferM) || 0));
    return () => onPreview(null);
  }, [form.bufferM]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: string) => setForm(f => ({
    ...f,
    activities: key === "all"
      ? (f.activities.includes("all") ? [] : ["all"])
      : f.activities.includes(key) ? f.activities.filter(a => a !== key) : [...f.activities.filter(a => a !== "all"), key],
  }));
  const sourceText = form.sourceKind === "edge" ? `Strip along the inside of ${state.paddocks.find(p => p.id === (exclusion?.pastureId ?? form.pastureId))?.name ?? "a paddock"}'s edge`
    : (exclusion?.featureId ?? form.featureId) ? `Around ${state.features.find(f => f.id === (exclusion?.featureId ?? form.featureId))?.name ?? "a map feature"}`
    : form.sourceKind === "around" ? "Around a drawn point or line" : "A drawn area";
  const disabled = !canEdit;

  return (
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault();
      if (!form.name.trim()) return toast.error("Give the exclusion a name");
      if (form.activities.length === 0) return toast.error("Choose which activities it applies to");
      const ok = exclusion
        ? await run(() => farmMap.updateExclusion(exclusion.id, { ...form, geometry: undefined, version: exclusion.version }), "Exclusion saved")
        : await run(() => farmMap.createExclusion({ ...form, name: form.name.trim() }), "Exclusion saved");
      if (ok !== undefined) onDone();
    }}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{exclusion ? `Exclusion · ${exclusion.status}` : "New exclusion"}</p>
      <p className="text-sm">{sourceText}{exclusion ? ` · ${fmtHa(exclusion.areaHa)}` : ""}</p>
      <div className="space-y-1"><Label htmlFor="ex-name">Name</Label><Input id="ex-name" value={form.name} disabled={disabled} onChange={e => set("name", e.target.value)} placeholder="e.g. Bore 2 setback" /></div>
      <div className="space-y-1"><Label htmlFor="ex-reason">Reason</Label><Input id="ex-reason" value={form.reason ?? ""} disabled={disabled} onChange={e => set("reason", e.target.value)} placeholder="e.g. protect the bore head" /></div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Applies to</legend>
        <div className="flex flex-wrap gap-1.5">
          {EXCLUSION_ACTIVITIES.map(a => (
            <button key={a.key} type="button" disabled={disabled} aria-pressed={form.activities.includes(a.key)} onClick={() => toggle(a.key)}
              className={cn("px-2.5 py-1 rounded-full border text-xs", form.activities.includes(a.key) ? "bg-red-700 text-white border-transparent" : "hover:bg-muted")}>{a.label}</button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor="ex-buffer">{form.sourceKind === "edge" ? "Strip width" : form.sourceKind === "area" ? "Extra margin around the area" : "Distance"} (m)</Label>
        <Input id="ex-buffer" type="number" inputMode="decimal" min={0} step="any" value={form.bufferM} disabled={disabled} onChange={e => set("bufferM", e.target.value === "" ? 0 : Number(e.target.value))} />
        <p className="text-xs text-muted-foreground">Set it from your consent, regional plan or product label. No distance is assumed.</p>
      </div>
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form.permanent} disabled={disabled} onChange={() => set("permanent", true)} />Permanent</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!form.permanent} disabled={disabled} onChange={() => set("permanent", false)} />Temporary</label>
        {!form.permanent && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label htmlFor="ex-from">From</Label><Input id="ex-from" type="date" value={form.startsOn ?? ""} disabled={disabled} onChange={e => set("startsOn", e.target.value || null)} /></div>
            <div className="space-y-1"><Label htmlFor="ex-to">Until (optional)</Label><Input id="ex-to" type="date" value={form.endsOn ?? ""} disabled={disabled} onChange={e => set("endsOn", e.target.value || null)} /></div>
          </div>
        )}
      </div>
      <div className="space-y-1"><Label htmlFor="ex-source">Where the requirement comes from</Label><Input id="ex-source" value={form.requirementSource ?? ""} disabled={disabled} onChange={e => set("requirementSource", e.target.value)} placeholder="e.g. consent condition 12, regional plan rule" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor="ex-by">Confirmed by</Label><Input id="ex-by" value={form.confirmedBy ?? ""} disabled={disabled} onChange={e => set("confirmedBy", e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="ex-on">On</Label><Input id="ex-on" type="date" value={form.confirmedOn ?? ""} disabled={disabled} onChange={e => set("confirmedOn", e.target.value || null)} /></div>
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="bg-pulse-forest hover:bg-pulse-forest-dark"><Save className="h-4 w-4 mr-1" />Save</Button>
          <Button type="button" variant="outline" onClick={onDone}>{exclusion ? "Close" : "Cancel"}</Button>
          {exclusion && (
            <Button type="button" variant="ghost" className="text-red-700" onClick={async () => {
              if (!window.confirm(`Remove "${exclusion.name}"? It stops applying from now. Approved plans keep the copy they were worked out with.`)) return;
              const ok = await run(() => farmMap.deleteExclusion(exclusion.id), "Exclusion removed");
              if (ok !== undefined) onDone();
            }}><Trash2 className="h-4 w-4 mr-1" />Remove</Button>
          )}
          {onRedraw && <Button type="button" variant="ghost" onClick={onRedraw}><Pencil className="h-4 w-4 mr-1" />Redraw</Button>}
        </div>
      )}
    </form>
  );
}

export function exclusionOverlays(state: MapState): Overlay[] {
  const layer = state.layers.find(l => l.key === "exclusions");
  if (!layer) return [];
  return state.exclusions.map(e => ({
    key: `ex-${e.id}`,
    geometry: e.geometry,
    layerId: layer.id,
    sel: { type: "exclusion" as const, id: e.id },
    pickLabel: `Exclusion: ${e.name}`,
    rank: 2,
    style: {
      color: layer.style.color, fillColor: layer.style.fillColor,
      fillOpacity: e.status === "active" ? layer.style.fillOpacity : layer.style.fillOpacity / 3,
      weight: layer.style.weight, dashArray: e.status === "active" ? layer.style.dashArray ?? undefined : "2 6",
    },
  }));
}

// ===== Area breakdown =====

export function AreaBreakdownPanel({ pastureId, hasBoundary }: { pastureId: string; hasBoundary: boolean }) {
  const [activity, setActivity] = useState("fertiliser");
  const [date, setDate] = useState(today);
  const { data, error } = useQuery<AreaBreakdown>({
    queryKey: ["/api/farm-map/areas", pastureId, activity, date],
    queryFn: () => farmMap.areas(pastureId, activity, date),
    enabled: hasBoundary,
  });
  if (!hasBoundary) return null;
  return (
    <section className="space-y-2 rounded-md border p-2">
      <div className="flex gap-2">
        <select className="h-8 flex-1 rounded-md border bg-background px-1 text-sm" value={activity} onChange={e => setActivity(e.target.value)} aria-label="Activity">
          {PLAN_ACTIVITIES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
        <Input type="date" className="h-8 w-[9.5rem]" value={date} onChange={e => setDate(e.target.value)} aria-label="On date" />
      </div>
      {error ? <p className="text-xs text-red-700">{(error as Error).message}</p> : data ? (
        <>
          <dl className="grid grid-cols-3 text-center text-sm">
            <div><dt className="text-xs text-muted-foreground">Gross</dt><dd className="font-semibold tabular-nums">{fmtHa(data.grossHa)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Excluded</dt><dd className="font-semibold tabular-nums text-red-700">{fmtHa(data.excludedHa)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Net</dt><dd className="font-semibold tabular-nums text-green-700">{fmtHa(data.netHa)}</dd></div>
          </dl>
          {data.exclusions.length > 0 && (
            <ul className="text-xs text-muted-foreground">
              {data.exclusions.map(e => <li key={e.id}>{e.name}{e.bufferM ? ` (${e.bufferM} m)` : ""}: {fmtHa(e.ha)}</li>)}
              {data.exclusions.length > 1 && <li>Where these overlap the ground is only taken off once.</li>}
            </ul>
          )}
        </>
      ) : <p className="text-xs text-muted-foreground">Working out…</p>}
    </section>
  );
}

// ===== Variable-rate plans =====

export function PlansSection({ plans, canEdit, onOpen, onNew }: { plans: MapState["plans"]; canEdit: boolean; onOpen: (id: string) => void; onNew: () => void }) {
  const [status, setStatus] = useState<"all" | "draft" | "approved">("all");
  const list = plans.filter(p => status === "all" || p.status === status);
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Rate plans</h2>
        <select className="h-7 rounded border bg-background px-1 text-xs" value={status} onChange={e => setStatus(e.target.value as any)} aria-label="Plan status">
          <option value="all">All</option><option value="draft">Drafts</option><option value="approved">Approved</option>
        </select>
      </div>
      {list.length === 0 ? <p className="text-xs text-muted-foreground">Plan different rates for different parts of a paddock.</p> : (
        <ul className="divide-y rounded-md border text-sm">
          {list.map(p => (
            <li key={p.id}>
              <button className="w-full text-left px-2 py-1.5 hover:bg-muted" onClick={() => onOpen(p.id)}>
                <div className="flex justify-between gap-2"><span className="truncate">{p.name}</span><span className={cn("text-xs", p.status === "approved" ? "text-green-700" : "text-amber-700")}>{p.status}</span></div>
                <div className="text-xs text-muted-foreground">{activityLabel(p.activity)} · {p.zones} zone{p.zones === 1 ? "" : "s"}{p.plannedOn ? ` · ${p.plannedOn}` : ""}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {canEdit && <Button size="sm" variant="outline" onClick={onNew}><Plus className="h-4 w-4 mr-1" />New rate plan</Button>}
    </section>
  );
}

export function NewPlanForm({ state, selectedPaddockId, run, onCreated, onCancel }: {
  state: MapState; selectedPaddockId?: string; run: Run; onCreated: (id: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [activity, setActivity] = useState("fertiliser");
  const [plannedOn, setPlannedOn] = useState(today());
  const [pastureIds, setPastureIds] = useState<string[]>(selectedPaddockId ? [selectedPaddockId] : []);
  return (
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault();
      if (!name.trim()) return toast.error("Give the plan a name");
      const r = await run(() => farmMap.createPlan({ name: name.trim(), activity, plannedOn, pastureIds }), "Plan started");
      if (r) onCreated(r.id);
    }}>
      <h2 className="font-semibold">New rate plan</h2>
      <div className="space-y-1"><Label htmlFor="pl-name">Name</Label><Input id="pl-name" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Spring urea, back block" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor="pl-act">Activity</Label>
          <select id="pl-act" className={selectClass} value={activity} onChange={e => setActivity(e.target.value)}>{PLAN_ACTIVITIES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}</select>
        </div>
        <div className="space-y-1"><Label htmlFor="pl-date">Planned for</Label><Input id="pl-date" type="date" value={plannedOn} onChange={e => setPlannedOn(e.target.value)} /></div>
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Paddocks</legend>
        <div className="max-h-40 overflow-y-auto rounded-md border p-1">
          {state.paddocks.filter(p => p.geometry).map(p => (
            <label key={p.id} className="flex items-center gap-2 text-sm px-1 py-0.5">
              <input type="checkbox" checked={pastureIds.includes(p.id)} onChange={e => setPastureIds(ids => e.target.checked ? [...ids, p.id] : ids.filter(i => i !== p.id))} />{p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2"><Button type="submit" className="bg-pulse-forest hover:bg-pulse-forest-dark">Start plan</Button><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
}

// Lighter for lower rates, darker for higher, so the zones read at a glance
function rateColor(rate: number | null, min: number, max: number) {
  if (rate == null) return "#adb5bd";
  const t = max > min ? (rate - min) / (max - min) : 0.5;
  const from = [216, 245, 162], to = [43, 138, 62];
  return `rgb(${from.map((c, i) => Math.round(c + (to[i] - c) * t)).join(",")})`;
}

export function planOverlays(plan: RatePlan | undefined): Overlay[] {
  if (!plan) return [];
  const rates = plan.zones.map(z => z.rate).filter((r): r is number => r != null);
  const min = Math.min(...rates), max = Math.max(...rates);
  const out: Overlay[] = plan.zones.map((z, i) => ({
    key: `zone-${z.id}`,
    geometry: z.geometry,
    sel: { type: "zone" as const, id: z.id },
    label: `${z.name ?? `Zone ${i + 1}`}${z.rate != null ? ` · ${z.rate} ${z.rateUnit}` : ""}`,
    pickLabel: `Zone: ${z.name ?? i + 1}`,
    rank: 1,
    style: { color: "#2b8a3e", weight: 2, fillColor: rateColor(z.rate, min, max), fillOpacity: 0.55 },
  }));
  if (plan.check?.gapGeometry) out.push({ key: "gap", geometry: plan.check.gapGeometry, rank: 9, style: { color: "#f08c00", weight: 2, dashArray: "4 4", fillColor: "#ffd43b", fillOpacity: 0.45 }, label: "Gap" });
  (plan.check?.overlaps ?? []).forEach((o, i) => {
    out.push({ key: `overlap-${i}`, geometry: o.geometry, rank: 9, style: { color: "#e03131", weight: 3, fillColor: "#e03131", fillOpacity: 0.6 } });
  });
  if (plan.check?.outsideGeometry) out.push({ key: "outside", geometry: plan.check.outsideGeometry, rank: 9, style: { color: "#c2255c", weight: 2, dashArray: "2 4", fillOpacity: 0.2 } });
  return out;
}

export function PlanEditor({ planId, state, canEdit, run, onDrawZone, onClose, onOpenPlan, onPlan, selectedZoneId }: {
  planId: string; state: MapState; canEdit: boolean; run: Run; onDrawZone: () => void; onClose: () => void;
  onOpenPlan: (id: string) => void; onPlan: (p: RatePlan | undefined) => void; selectedZoneId?: string;
}) {
  const queryClient = useQueryClient();
  const { data: plan, error } = useQuery({ queryKey: ["/api/farm-map/plans", planId], queryFn: () => farmMap.plan(planId) });
  useEffect(() => { onPlan(plan); }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onPlan(undefined), []); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: products = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/records/products", plan?.activity],
    queryFn: async () => {
      const kind = plan?.activity === "effluent" ? "effluent" : "fertiliser";
      const res = await fetch(`/api/records/products?kind=${kind}`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!plan,
  });
  const [wholePaddock, setWholePaddock] = useState("");
  const [acceptGaps, setAcceptGaps] = useState(false);
  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/farm-map/plans", planId] });
    await queryClient.invalidateQueries({ queryKey: FARM_MAP_KEY });
  };
  const act = async <T,>(w: () => Promise<T>, msg?: string) => { const r = await run(w, msg); await reload(); return r; };

  if (error) return <p className="text-sm text-red-700">{(error as Error).message}</p>;
  if (!plan) return <p className="text-sm text-muted-foreground">Loading the plan…</p>;
  const draft = plan.status === "draft" && canEdit;
  const lastZone = plan.zones[plan.zones.length - 1];
  const defaults = { productName: lastZone?.productName ?? null, productId: lastZone?.productId ?? null, rateUnit: lastZone?.rateUnit ?? (plan.activity === "effluent" || plan.activity === "slurry" ? "m3/ha" : plan.activity === "spraying" ? "L/ha" : "kg/ha") };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{activityLabel(plan.activity)} plan · <span className={plan.status === "approved" ? "text-green-700" : "text-amber-700"}>{plan.status}</span></p>
          <h2 className="font-semibold">{plan.name}</h2>
          {plan.plannedOn && <p className="text-xs text-muted-foreground">Planned for {plan.plannedOn}</p>}
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close plan"><X className="h-4 w-4" /></Button>
      </div>
      {plan.status === "approved" && <p className="text-xs rounded border border-green-200 bg-green-50 dark:bg-green-950/30 p-2">Approved {plan.approvedAt ? new Date(plan.approvedAt).toLocaleString() : ""}. Its zones, rates and the {plan.snapshot?.exclusions?.length ?? 0} exclusion(s) it was worked out with are fixed. Copy it to change it.</p>}

      <datalist id="plan-products">{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
      <ul className="space-y-2">
        {plan.zones.map((z, i) => (
          <ZoneRow key={z.id} zone={z} index={i} editable={draft} highlighted={z.id === selectedZoneId} products={products}
            onSave={b => act(() => farmMap.updateZone(z.id, b))}
            onDelete={() => window.confirm(`Delete ${z.name ?? `zone ${i + 1}`}?`) && act(() => farmMap.deleteZone(z.id), "Zone deleted")} />
        ))}
      </ul>
      {plan.zones.length === 0 && <p className="text-sm text-muted-foreground">No zones yet. Draw zones inside the paddock, or use a whole paddock as one zone.</p>}

      {draft && (
        <div className="space-y-2 rounded-md border p-2">
          <Button size="sm" variant="outline" onClick={onDrawZone}><Square className="h-4 w-4 mr-1" />Draw a zone</Button>
          <div className="flex gap-2">
            <select className="h-8 flex-1 rounded-md border bg-background px-1 text-sm" value={wholePaddock} onChange={e => setWholePaddock(e.target.value)} aria-label="Whole paddock">
              <option value="">Whole paddock as a zone…</option>
              {state.paddocks.filter(p => p.geometry).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Button size="sm" disabled={!wholePaddock} onClick={async () => { await act(() => farmMap.addZone(plan.id, { wholePaddockId: wholePaddock, ...defaults }), "Zone added"); setWholePaddock(""); }}>Add</Button>
          </div>
        </div>
      )}

      {plan.totals.length > 0 && (
        <section className="rounded-md border p-2 text-sm space-y-1">
          <h3 className="font-semibold">Totals</h3>
          {plan.totals.map(t => <p key={`${t.product}-${t.unit}`} className="tabular-nums">{t.product}: <strong>{t.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })} {t.unit === "m3" ? "m³" : t.unit}</strong> over {fmtHa(t.netHa)} net</p>)}
          <p className="text-xs text-muted-foreground">Quantity of product (not nutrient) = net hectares × rate. Net is after exclusions for {activityLabel(plan.activity).toLowerCase()} on {plan.plannedOn ?? "today"}.</p>
        </section>
      )}

      {plan.check && (
        <section className="space-y-1 text-sm">
          {plan.check.overlaps.length > 0 && plan.check.overlaps.map((o, i) => <p key={i} className="text-red-700 flex gap-1"><AlertTriangle className="h-4 w-4 shrink-0" />{o.names} overlap by {fmtHa(o.ha)} (red on the map)</p>)}
          {plan.check.hasGaps && <p className="text-amber-800 flex gap-1"><AlertTriangle className="h-4 w-4 shrink-0" />{fmtHa(plan.check.gapHa)} of the planned paddocks has no zone (yellow on the map)</p>}
          {plan.check.outsideHa * 10000 > 1 && <p className="text-pink-800 flex gap-1"><AlertTriangle className="h-4 w-4 shrink-0" />{fmtHa(plan.check.outsideHa)} of the zones is outside the planned paddocks</p>}
          {plan.check.overlaps.length === 0 && !plan.check.hasGaps && plan.zones.length > 0 && <p className="text-green-700 flex gap-1"><CheckCircle2 className="h-4 w-4" />No gaps or overlaps</p>}
        </section>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {draft && (
            <>
              {plan.check?.hasGaps && <label className="flex items-center gap-1 text-xs w-full"><input type="checkbox" checked={acceptGaps} onChange={e => setAcceptGaps(e.target.checked)} />Approve with the gap left unplanned</label>}
              <Button size="sm" className="bg-pulse-forest hover:bg-pulse-forest-dark" disabled={plan.zones.length === 0 || (plan.check?.overlaps.length ?? 0) > 0}
                onClick={() => act(() => farmMap.approvePlan(plan.id, acceptGaps), "Plan approved")}><CheckCircle2 className="h-4 w-4 mr-1" />Approve</Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={async () => { const r = await run(() => farmMap.copyPlan(plan.id), "Copied to a new draft"); if (r) onOpenPlan(r.id); }}><Copy className="h-4 w-4 mr-1" />Copy</Button>
          {plan.status !== "cancelled" && <Button size="sm" variant="ghost" className="text-red-700" onClick={async () => {
            if (!window.confirm(`Cancel "${plan.name}"?`)) return;
            await act(() => farmMap.cancelPlan(plan.id), "Plan cancelled");
            onClose();
          }}><Trash2 className="h-4 w-4 mr-1" />Cancel plan</Button>}
        </div>
      )}
    </div>
  );
}

function ZoneRow({ zone, index, editable, highlighted, products, onSave, onDelete }: {
  zone: RatePlan["zones"][number]; index: number; editable: boolean; highlighted: boolean; products: { id: string; name: string }[];
  onSave: (b: { name?: string | null; productName?: string | null; productId?: string | null; rate?: number | null; rateUnit?: string }) => void; onDelete: () => void;
}) {
  const [name, setName] = useState(zone.name ?? "");
  const [product, setProduct] = useState(zone.productName ?? "");
  const [rate, setRate] = useState(zone.rate != null ? String(zone.rate) : "");
  const [unit, setUnit] = useState(zone.rateUnit);
  useEffect(() => { setName(zone.name ?? ""); setProduct(zone.productName ?? ""); setRate(zone.rate != null ? String(zone.rate) : ""); setUnit(zone.rateUnit); }, [zone.id, zone.name, zone.productName, zone.rate, zone.rateUnit]);
  const changed = name !== (zone.name ?? "") || product !== (zone.productName ?? "") || rate !== (zone.rate != null ? String(zone.rate) : "") || unit !== zone.rateUnit;
  const match = useMemo(() => products.find(p => p.name.toLowerCase() === product.trim().toLowerCase()), [products, product]);
  return (
    <li className={cn("rounded-md border p-2 space-y-1.5", highlighted && "ring-2 ring-yellow-400")}>
      <div className="flex items-center gap-2">
        <Input className="h-8 text-sm font-medium" value={name} placeholder={`Zone ${index + 1}`} disabled={!editable} onChange={e => setName(e.target.value)} aria-label="Zone name" />
        {editable && <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Delete zone"><Trash2 className="h-4 w-4" /></Button>}
      </div>
      <div className="grid grid-cols-[1fr_5rem_5.5rem] gap-1">
        <Input className="h-8 text-sm" list="plan-products" value={product} placeholder="Product" disabled={!editable} onChange={e => setProduct(e.target.value)} aria-label="Product" />
        <Input className="h-8 text-sm" type="number" inputMode="decimal" min={0} step="any" value={rate} placeholder="Rate" disabled={!editable} onChange={e => setRate(e.target.value)} aria-label="Rate" />
        <select className="h-8 rounded-md border bg-background px-1 text-sm" value={unit} disabled={!editable} onChange={e => setUnit(e.target.value)} aria-label="Rate unit">
          {RATE_UNITS.map(u => <option key={u} value={u}>{u.replace("m3", "m³")}</option>)}
        </select>
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {fmtHa(zone.grossHa)} gross{zone.excludedHa ? ` − ${fmtHa(zone.excludedHa)} excluded` : ""} = <strong>{fmtHa(zone.netHa)} net</strong>
        {zone.quantity != null && <> → <strong>{zone.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })} {zone.quantityUnit === "m3" ? "m³" : zone.quantityUnit}</strong></>}
      </p>
      {editable && changed && (
        <Button size="sm" onClick={() => onSave({
          name: name.trim() || null, productName: product.trim() || null, productId: match?.id ?? null,
          rate: rate === "" ? null : Number(rate), rateUnit: unit,
        })}><Save className="h-4 w-4 mr-1" />Save zone</Button>
      )}
    </li>
  );
}
