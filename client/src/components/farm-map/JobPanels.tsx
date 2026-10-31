import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, CheckCircle2, ExternalLink, Link2, Paperclip, Plus, Save, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FARM_MAP_KEY, type MapState } from "@/lib/farm-map";
import {
  FERT_UNITS, JOB_STATUSES, analysisText, jobsApi, type CatalogueProduct, type Job, type JobSummary, type NewLine,
} from "@/lib/jobs";
import type { Overlay } from "./FarmMapCanvas";

const fmtHa = (ha: number | null | undefined) => (ha == null ? "—" : `${Number(ha).toFixed(3)} ha`);
const fmtQty = (q: number | null | undefined, unit: string | null | undefined) =>
  q == null ? "—" : `${q.toLocaleString(undefined, { maximumFractionDigits: unit === "t" ? 3 : 1 })} ${unit ?? ""}`;
const fmtKg = (kg: number | null | undefined) => (kg == null ? "—" : `${Math.round(kg).toLocaleString()} kg`);
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const today = () => localNow().slice(0, 10);
const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";
export const JOBS_KEY = ["/api/applications"];

// ===== Product picker =====

function VerificationBadge({ p }: { p: Pick<CatalogueProduct, "verification" | "verifiedOn"> }) {
  return p.verification === "verified"
    ? <span className="text-[10px] rounded px-1 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" title={`Checked against the supplier's published analysis on ${p.verifiedOn}`}>Verified {p.verifiedOn}</span>
    : p.verification === "farm_entered"
      ? <span className="text-[10px] rounded px-1 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300" title="Added by this farm; its details haven't been checked">Farm-entered</span>
      : <span className="text-[10px] rounded px-1 bg-gray-200 text-gray-700">Unverified</span>;
}

/**
 * Search the catalogue by name, supplier, ingredient, category, registration number or nickname.
 * Favourites and recently used come first. "Add custom product" works without leaving the job.
 */
export function ProductPicker({ kind = "fertiliser", value, onChange, label = "Product" }: {
  kind?: string; value: CatalogueProduct | null; onChange: (p: CatalogueProduct | null) => void; label?: string;
}) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const { data: results = [] } = useQuery({ queryKey: ["/api/catalogue", kind, q], queryFn: () => jobsApi.search(kind, q), enabled: open });
  const boxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const star = async (p: CatalogueProduct) => {
    await jobsApi.pref(p.id, { favourite: !p.favourite });
    queryClient.invalidateQueries({ queryKey: ["/api/catalogue"] });
  };
  if (adding) return <CustomProductForm kind={kind} initialName={q} onCancel={() => setAdding(false)} onCreated={async id => { setAdding(false); onChange(await jobsApi.product(id)); queryClient.invalidateQueries({ queryKey: ["/api/catalogue"] }); }} />;
  return (
    <div className="space-y-1 relative" ref={boxRef}>
      <Label>{label}</Label>
      {value && !open ? (
        <button type="button" className="w-full text-left rounded-md border px-2 py-1.5 hover:bg-muted" onClick={() => { setOpen(true); setQ(""); }}>
          <div className="flex items-center gap-2"><span className="font-medium text-sm">{value.nickname ?? value.name}</span><VerificationBadge p={value} /></div>
          <div className="text-xs text-muted-foreground">{value.supplier ?? "—"} · {analysisText(value)}</div>
        </button>
      ) : (
        <Input autoFocus={open} value={q} onFocus={() => setOpen(true)} onChange={e => { setQ(e.target.value); setOpen(true); }}
          placeholder="Search: name, supplier, ingredient, registration no." aria-label={label} />
      )}
      {open && (
        <div className="absolute z-[900] mt-1 w-full max-h-80 overflow-y-auto rounded-md border bg-popover shadow-lg">
          {results.map(p => (
            <div key={p.id} className="flex items-start gap-1 px-2 py-1.5 hover:bg-muted">
              <button type="button" className="flex-1 text-left" onClick={() => { onChange(p); setOpen(false); }}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium">{p.nickname ? `${p.nickname} (${p.name})` : p.name}</span>
                  <VerificationBadge p={p} />
                </div>
                <div className="text-xs text-muted-foreground">{p.supplier ?? "Own product"}{p.category ? ` · ${p.category}` : ""} · {analysisText(p)}{p.registrationNumber ? ` · reg ${p.registrationNumber}` : ""}</div>
              </button>
              <button type="button" className="p-1" onClick={() => star(p)} aria-label={p.favourite ? `Unfavourite ${p.name}` : `Favourite ${p.name}`}>
                <Star className={cn("h-4 w-4", p.favourite ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
              </button>
            </div>
          ))}
          {results.length === 0 && <p className="px-2 py-2 text-sm text-muted-foreground">No matching product in the catalogue.</p>}
          <button type="button" className="w-full text-left px-2 py-2 border-t text-sm font-medium text-pulse-forest hover:bg-muted flex items-center gap-1" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />Add custom product{q ? ` "${q}"` : ""}
          </button>
        </div>
      )}
    </div>
  );
}

function CustomProductForm({ kind, initialName, onCreated, onCancel }: { kind: string; initialName: string; onCreated: (id: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(initialName);
  const [supplier, setSupplier] = useState("");
  const [category, setCategory] = useState("compound");
  const [basis, setBasis] = useState<"elemental" | "oxide">("elemental");
  const [vals, setVals] = useState<Record<string, string>>({ N: "", P: "", K: "", S: "", Mg: "", Ca: "" });
  const [isBlend, setIsBlend] = useState(false);
  const [parts, setParts] = useState<{ product: CatalogueProduct | null; percent: string }[]>([{ product: null, percent: "" }, { product: null, percent: "" }]);
  const [labelUrl, setLabelUrl] = useState("");
  const [nickname, setNickname] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const total = parts.reduce((s, p) => s + (Number(p.percent) || 0), 0);
  const save = async () => {
    if (!name.trim()) return toast.error("Give the product a name");
    setSaving(true);
    try {
      const anyValue = Object.values(vals).some(v => v !== "");
      const body: any = {
        kind, name: name.trim(), supplier: supplier || null, category: isBlend ? undefined : category,
        labelUrl: labelUrl || null, notes: notes || null, nickname: nickname || null,
      };
      if (isBlend) {
        if (parts.some(p => !p.product || !(Number(p.percent) > 0))) throw new Error("Choose each ingredient and its percentage");
        body.blend = parts.map(p => ({ productId: p.product!.id, percent: Number(p.percent) }));
      } else if (anyValue) {
        // Blank means not known (kept unknown, not zero)
        body.analysis = { basis, ...Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, v === "" ? null : Number(v)])) };
      }
      const r = await jobsApi.addProduct(body);
      toast.success(`${name} added. It's marked farm-entered until its label is checked.`);
      onCreated(r.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-2 rounded-md border p-2 bg-muted/30">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Add custom product</h3><button type="button" onClick={onCancel} aria-label="Cancel"><X className="h-4 w-4" /></button></div>
      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Product name" aria-label="Product name" />
      <div className="grid grid-cols-2 gap-2">
        <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier" aria-label="Supplier" />
        <Input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Farm nickname (optional)" aria-label="Nickname" />
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isBlend} onChange={e => setIsBlend(e.target.checked)} />It's a blend of catalogue products</label>
      {isBlend ? (
        <div className="space-y-2">
          {parts.map((part, i) => (
            <div key={i} className="grid grid-cols-[1fr_4.5rem_auto] gap-1 items-end">
              <ProductPicker kind={kind} value={part.product} label={`Ingredient ${i + 1}`} onChange={p => setParts(ps => ps.map((x, j) => (j === i ? { ...x, product: p } : x)))} />
              <Input type="number" inputMode="decimal" value={part.percent} placeholder="%" aria-label="Percent" onChange={e => setParts(ps => ps.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))} />
              {parts.length > 2 && <Button type="button" size="sm" variant="ghost" onClick={() => setParts(ps => ps.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>}
            </div>
          ))}
          <div className="flex justify-between text-xs">
            <button type="button" className="underline" onClick={() => setParts(ps => [...ps, { product: null, percent: "" }])}>Add ingredient</button>
            <span className={cn(Math.abs(total - 100) > 0.5 && "text-red-700")}>Total {total}%</span>
          </div>
        </div>
      ) : (
        <>
          <select className={selectClass} value={category} onChange={e => setCategory(e.target.value)} aria-label="Category">
            {["nitrogen", "phosphate", "potassium", "sulphur", "lime", "calcium", "magnesium", "trace", "liquid", "compound"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex gap-3 text-xs">
            <label className="flex items-center gap-1"><input type="radio" checked={basis === "elemental"} onChange={() => setBasis("elemental")} />Elemental % (N, P, K…)</label>
            <label className="flex items-center gap-1"><input type="radio" checked={basis === "oxide"} onChange={() => setBasis("oxide")} />Oxide % (P₂O₅, K₂O…)</label>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {Object.keys(vals).map(k => (
              <div key={k}><Label className="text-xs">{basis === "oxide" ? ({ N: "N", P: "P₂O₅", K: "K₂O", S: "SO₃", Mg: "MgO", Ca: "CaO" } as any)[k] : k}</Label>
                <Input className="h-8 px-1 text-sm" type="number" inputMode="decimal" value={vals[k]} onChange={e => setVals(v => ({ ...v, [k]: e.target.value }))} aria-label={`${k} percent`} /></div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Leave a box blank if it's not on the label: it stays unknown, not zero. Oxide figures are converted to elemental for totals and kept as entered.</p>
        </>
      )}
      <Input value={labelUrl} onChange={e => setLabelUrl(e.target.value)} placeholder="Label or SDS link (optional)" aria-label="Label link" />
      <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" aria-label="Notes" />
      <div className="flex gap-2"><Button type="button" size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Add product"}</Button><Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button></div>
    </div>
  );
}

/**
 * Where the shared product list came from and what it doesn't cover
 */
export function CatalogueCoverage() {
  const [open, setOpen] = useState(false);
  const { data: sources = [] } = useQuery({ queryKey: ["/api/catalogue/sources"], queryFn: jobsApi.sources, enabled: open });
  return (
    <details className="text-xs" onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-muted-foreground">What's in the product list?</summary>
      <ul className="mt-1 space-y-1">
        {sources.map(s => (
          <li key={s.id}><a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.name}</a> (checked {s.retrievedOn}): {s.coverage}{s.notes ? ` ${s.notes}` : ""}</li>
        ))}
      </ul>
      <p className="mt-1 text-muted-foreground">Anything else can be added as a custom product. It's marked farm-entered, and its nutrients are listed as not counted in totals because its analysis hasn't been checked against a published label.</p>
    </details>
  );
}

// ===== New fertiliser job =====

export interface JobDraft { lines: NewLine[]; planId?: string | null; title?: string | null }

/**
 * Select paddocks (tap them on the map) → product → rate → save. Each paddock can have its own
 * rate; part of a paddock can be drawn as its own line.
 */
export function NewJobForm({ state, draft, setDraft, onDrawPart, onCreated, onCancel }: {
  state: MapState; draft: JobDraft; setDraft: (fn: (d: JobDraft) => JobDraft) => void;
  onDrawPart: () => void; onCreated: (job: Job) => void; onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [product, setProduct] = useState<CatalogueProduct | null>(null);
  const [rate, setRate] = useState("");
  const [unit, setUnit] = useState("kg/ha");
  const [title, setTitle] = useState(draft.title ?? "");
  const [status, setStatus] = useState<Job["status"]>("planned");
  const [plannedOn, setPlannedOn] = useState(today());
  const [completedAt, setCompletedAt] = useState(localNow());
  const [supplier, setSupplier] = useState("");
  const [contractor, setContractor] = useState("");
  const [operator, setOperator] = useState("");
  const [equipment, setEquipment] = useState("");
  const [weather, setWeather] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const paddockName = (id?: string | null) => state.paddocks.find(p => p.id === id)?.name ?? "Area";

  // Net hectares of each whole paddock after exclusions, to show the quantity needed
  const { data: areas = {} } = useQuery({
    queryKey: ["/api/farm-map/areas", "job", draft.lines.filter(l => l.pastureId && !l.geometry).map(l => l.pastureId).join(",")],
    queryFn: async () => {
      const out: Record<string, number> = {};
      for (const l of draft.lines.filter(l => l.pastureId && !l.geometry)) {
        const res = await fetch(`/api/farm-map/paddocks/${l.pastureId}/areas?activity=fertiliser`, { credentials: "include" });
        if (res.ok) out[l.pastureId!] = (await res.json()).netHa;
      }
      return out;
    },
  });
  const setLine = (key: string, patch: Partial<NewLine>) => setDraft(d => ({ ...d, lines: d.lines.map(l => (l.key === key ? { ...l, ...patch } : l)) }));
  const lineRate = (l: NewLine) => (l.rate != null ? l.rate : rate === "" ? null : Number(rate));
  const lineUnit = (l: NewLine) => (l.rate != null ? l.rateUnit : unit);
  const qtyUnit = (u: string) => ({ "kg/ha": "kg", "t/ha": "t", "L/ha": "L" } as any)[u];

  const save = async () => {
    if (draft.lines.length === 0) return toast.error("Tap the paddocks on the map, or draw part of one");
    if (draft.lines.some(l => !(l.productId ?? product?.id))) return toast.error("Choose the product");
    if (draft.lines.some(l => lineRate(l) == null)) return toast.error("Enter the rate");
    setSaving(true);
    try {
      const job = await jobsApi.create({
        activity: "fertiliser", status, title: title || null, plannedOn, planId: draft.planId ?? null,
        completedAt: status === "completed" ? new Date(completedAt).toISOString() : null,
        supplier: supplier || null, contractor: contractor || null, operator: operator || null, equipment: equipment || null,
        weather: weather || null, cost: cost === "" ? null : Number(cost), notes: notes || null,
        clientId: draft.lines.map(l => l.key).join("").slice(0, 60),
        lines: draft.lines.map(l => ({
          pastureId: l.pastureId ?? null, geometry: l.geometry ?? null, name: l.name ?? null,
          productId: l.productId ?? product!.id, rate: lineRate(l), rateUnit: lineUnit(l),
        })),
      });
      toast.success(status === "completed" ? "Job recorded" : "Job saved");
      queryClient.invalidateQueries({ queryKey: JOBS_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
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
      <div className="flex items-center justify-between"><h2 className="font-semibold">Fertiliser job</h2><Button size="sm" variant="ghost" onClick={onCancel} aria-label="Close"><X className="h-4 w-4" /></Button></div>
      <section className="space-y-1">
        <Label>1. Paddocks</Label>
        <p className="text-xs text-muted-foreground">Tap paddocks on the map to add or remove them.</p>
        {draft.lines.length > 0 && (
          <ul className="space-y-1">
            {draft.lines.map(l => {
              const r = lineRate(l), u = lineUnit(l);
              const net = l.pastureId && !l.geometry ? areas[l.pastureId] : null;
              return (
                <li key={l.key} className="rounded-md border p-1.5 text-sm space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="flex-1 truncate">{l.name ?? (l.geometry ? `${paddockName(l.pastureId)} (part)` : paddockName(l.pastureId))}</span>
                    <button type="button" onClick={() => setDraft(d => ({ ...d, lines: d.lines.filter(x => x.key !== l.key) }))} aria-label="Remove"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-[1fr_5rem] gap-1 items-center">
                    <span className="text-xs text-muted-foreground tabular-nums">{net != null ? `${fmtHa(net)} net` : l.geometry ? "net worked out on save" : "…"}{net != null && r != null ? ` → ${fmtQty(net * r, qtyUnit(u))}` : ""}</span>
                    <Input className="h-7 text-xs" type="number" inputMode="decimal" placeholder={rate ? `${rate}` : "rate"} value={l.rate ?? ""}
                      onChange={e => setLine(l.key, { rate: e.target.value === "" ? null : Number(e.target.value), rateUnit: unit })} aria-label="Rate for this paddock" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Button size="sm" variant="outline" onClick={onDrawPart}>Draw part of a paddock</Button>
      </section>
      <section className="space-y-2">
        <ProductPicker value={product} onChange={setProduct} label="2. Product" />
        <CatalogueCoverage />
      </section>
      <section className="grid grid-cols-[1fr_6rem] gap-2">
        <div className="space-y-1"><Label htmlFor="job-rate">3. Rate (all paddocks)</Label><Input id="job-rate" type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="job-unit">Unit</Label><select id="job-unit" className={selectClass} value={unit} onChange={e => setUnit(e.target.value)}>{FERT_UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
      </section>
      <p className="text-xs text-muted-foreground">A rate typed against a paddock above overrides this one for that paddock.</p>
      <section className="space-y-2">
        <Label>4. When</Label>
        <div className="flex gap-2 text-sm">
          {(["planned", "completed"] as const).map(s => (
            <label key={s} className="flex items-center gap-1"><input type="radio" checked={status === s} onChange={() => setStatus(s)} />{s === "planned" ? "Plan it" : "It's been done"}</label>
          ))}
        </div>
        {status === "completed"
          ? <Input type="datetime-local" value={completedAt} max={localNow()} onChange={e => setCompletedAt(e.target.value)} aria-label="Applied at" />
          : <Input type="date" value={plannedOn} onChange={e => setPlannedOn(e.target.value)} aria-label="Planned for" />}
      </section>
      <details className="rounded-md border p-2">
        <summary className="text-sm font-medium cursor-pointer">More: supplier, contractor, equipment, weather, cost</summary>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier" aria-label="Supplier" />
          <Input value={contractor} onChange={e => setContractor(e.target.value)} placeholder="Contractor" aria-label="Contractor" />
          <Input value={operator} onChange={e => setOperator(e.target.value)} placeholder="Operator" aria-label="Operator" />
          <Input value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="Equipment" aria-label="Equipment" />
          <Input value={weather} onChange={e => setWeather(e.target.value)} placeholder="Weather" aria-label="Weather" className="col-span-2" />
          <Input type="number" inputMode="decimal" value={cost} onChange={e => setCost(e.target.value)} placeholder="Cost ($)" aria-label="Cost" />
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Job name (optional)" aria-label="Job name" />
          <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" aria-label="Notes" className="col-span-2" />
        </div>
      </details>
      <p className="text-xs text-muted-foreground">5. Attach the docket after saving (photo or PDF).</p>
      <div className="flex gap-2"><Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Save"}</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>
    </div>
  );
}

// ===== A saved job =====

export function JobView({ jobId, canEdit, onClose, onJob }: { jobId: string; canEdit: boolean; onClose: () => void; onJob?: (j: Job | undefined) => void }) {
  const queryClient = useQueryClient();
  const { data: job, error } = useQuery({ queryKey: [...JOBS_KEY, jobId], queryFn: () => jobsApi.get(jobId) });
  useEffect(() => { onJob?.(job); }, [job]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onJob?.(undefined), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [completedAt, setCompletedAt] = useState(localNow());
  const [docketOpen, setDocketOpen] = useState(false);
  useEffect(() => { if (job) setApplied(Object.fromEntries(job.lines.map(l => [l.id, l.appliedQuantity != null ? String(l.appliedQuantity) : ""]))); }, [job?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = (j?: Job) => {
    if (j) queryClient.setQueryData([...JOBS_KEY, jobId], j);
    queryClient.invalidateQueries({ queryKey: JOBS_KEY });
    queryClient.invalidateQueries({ queryKey: ["/api/records"] });
  };
  const act = async (w: () => Promise<Job | unknown>, msg: string) => {
    try { const j = await w(); refresh(j as Job); toast.success(msg); } catch (e: any) { toast.error(e.message); }
  };
  if (error) return <p className="text-sm text-red-700">{(error as Error).message}</p>;
  if (!job) return <p className="text-sm text-muted-foreground">Loading the job…</p>;
  const editable = canEdit && job.status !== "cancelled";
  const appliedChanged = job.lines.some(l => (applied[l.id] ?? "") !== (l.appliedQuantity != null ? String(l.appliedQuantity) : ""));
  const evidence = { planned: "Planned on the map", manual: "Completed: recorded by hand (not GPS evidence)", gps: "Completed: imported GPS evidence" }[job.evidence];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Fertiliser job · {JOB_STATUSES.find(s => s.key === job.status)?.label}</p>
          <h2 className="font-semibold">{job.title || job.lines.map(l => l.productSnapshot.name).filter((v, i, a) => a.indexOf(v) === i).join(", ")}</h2>
          <p className="text-xs text-muted-foreground">{job.completedAt ? `Applied ${new Date(job.completedAt).toLocaleString()}` : job.plannedOn ? `Planned for ${job.plannedOn}` : ""} · {evidence}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close job"><X className="h-4 w-4" /></Button>
      </div>

      <section className="space-y-1">
        <h3 className="text-sm font-semibold">Paddocks and quantities</h3>
        <ul className="space-y-1.5">
          {job.lines.map(l => (
            <li key={l.id} className="rounded-md border p-2 text-sm space-y-1">
              <div className="flex justify-between gap-2"><span className="font-medium">{l.name ?? "Area"}</span><span className="text-xs">{l.productSnapshot.name} @ {l.rate} {l.rateUnit}</span></div>
              <p className="text-xs text-muted-foreground tabular-nums">{fmtHa(l.grossHa)} gross{l.excludedHa ? ` − ${fmtHa(l.excludedHa)} excluded` : ""} = {fmtHa(l.netHa)} net · planned <strong>{fmtQty(l.plannedQuantity, l.quantityUnit)}</strong></p>
              <div className="flex items-center gap-1 text-xs">
                <span className="w-16">Applied</span>
                <Input className="h-7 text-xs w-28" type="number" inputMode="decimal" disabled={!editable} value={applied[l.id] ?? ""} placeholder="not entered"
                  onChange={e => setApplied(a => ({ ...a, [l.id]: e.target.value }))} aria-label={`Applied on ${l.name}`} />
                <span>{l.quantityUnit}</span>
              </div>
              {l.productSnapshot.verification !== "verified" && <p className="text-xs text-amber-800">Product analysis not verified (farm-entered).</p>}
            </li>
          ))}
        </ul>
        {editable && appliedChanged && (
          <Button size="sm" onClick={() => act(() => jobsApi.applied(job.id, job.lines.map(l => ({ lineId: l.id, quantity: applied[l.id] === "" || applied[l.id] == null ? null : Number(applied[l.id]) }))), "Applied amounts saved")}>
            <Save className="h-4 w-4 mr-1" />Save applied amounts
          </Button>
        )}
      </section>

      <section className="rounded-md border p-2 text-sm space-y-1">
        <h3 className="font-semibold">Planned, delivered and applied</h3>
        {job.reconciliation.map(r => (
          <div key={r.product}>
            <p className="font-medium">{r.product}</p>
            <div className="grid grid-cols-3 text-center tabular-nums text-xs">
              <div><div className="text-muted-foreground">Planned</div>{fmtKg(r.plannedKg)}</div>
              <div><div className="text-muted-foreground">Delivered</div>{fmtKg(r.deliveredKg)}</div>
              <div><div className="text-muted-foreground">Applied</div>{fmtKg(r.appliedKg)}</div>
            </div>
            {r.issues.map((i, n) => <p key={n} className="text-xs text-amber-800 flex gap-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{i}</p>)}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">These are kept separate and never adjusted to match.</p>
      </section>

      <section className="rounded-md border p-2 text-sm space-y-1">
        <h3 className="font-semibold">{job.nutrients.basis === "planned" ? "Nutrients planned" : "Nutrients applied"}</h3>
        {job.nutrients.basis ? (
          <>
            <div className="grid grid-cols-6 text-center text-xs tabular-nums">
              {Object.entries(job.nutrients.kg).map(([k, v]) => <div key={k}><div className="text-muted-foreground">{k}</div>{v} kg</div>)}
            </div>
            {job.nutrients.perHa && <p className="text-xs tabular-nums">Per hectare (net {fmtHa(job.nutrients.netHa)}): {Object.entries(job.nutrients.perHa).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"} kg/ha</p>}
            <p className="text-xs text-muted-foreground">kg of nutrient (not kg of product), from {job.nutrients.basis === "applied" ? "the applied amounts" : job.nutrients.basis === "planned" ? "the planned amounts" : "applied amounts where entered, planned elsewhere"} and verified analyses.</p>
          </>
        ) : <p className="text-xs text-muted-foreground">Nothing to total yet.</p>}
        {job.nutrients.notCounted.map((n, i) => <p key={i} className="text-xs text-amber-800">Not counted: {n}</p>)}
      </section>

      <section className="space-y-1">
        <h3 className="text-sm font-semibold">Dockets</h3>
        {job.dockets.length === 0 && <p className="text-xs text-muted-foreground">No docket attached yet.</p>}
        <ul className="space-y-1">
          {job.dockets.map(d => (
            <li key={d.id} className="rounded-md border p-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">#{d.number}</span>
                {editable && <button type="button" className="text-xs underline" onClick={() => window.confirm(`Remove docket ${d.number} from this job?`) && act(() => jobsApi.unlinkDocket(job.id, d.id), "Docket removed")}>Remove</button>}
              </div>
              <p className="text-xs text-muted-foreground">{[d.supplier, d.docketDate, d.productName, d.quantity != null ? `${d.quantity} ${d.unit ?? ""}` : null, d.allocated != null ? `${d.allocated} ${d.unit ?? ""} to this job` : null].filter(Boolean).join(" · ")}</p>
              {d.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {d.attachments.map(a => a.kind === "photo"
                    ? <a key={a.id} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={`Docket ${d.number}`} className="h-14 w-14 rounded object-cover border" /></a>
                    : <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="text-xs underline flex items-center gap-1"><ExternalLink className="h-3 w-3" />{a.fileName ?? "Docket file"}</a>)}
                </div>
              )}
            </li>
          ))}
        </ul>
        {editable && (docketOpen
          ? <DocketForm job={job} onDone={j => { setDocketOpen(false); if (j) refresh(j); }} />
          : <Button size="sm" variant="outline" onClick={() => setDocketOpen(true)}><Paperclip className="h-4 w-4 mr-1" />Attach a docket</Button>)}
      </section>

      {(job.supplier || job.contractor || job.operator || job.equipment || job.weather || job.cost != null || job.notes) && (
        <dl className="grid grid-cols-[6rem_1fr] gap-x-2 text-xs">
          {job.supplier && <><dt className="text-muted-foreground">Supplier</dt><dd>{job.supplier}</dd></>}
          {job.contractor && <><dt className="text-muted-foreground">Contractor</dt><dd>{job.contractor}</dd></>}
          {job.operator && <><dt className="text-muted-foreground">Operator</dt><dd>{job.operator}</dd></>}
          {job.equipment && <><dt className="text-muted-foreground">Equipment</dt><dd>{job.equipment}</dd></>}
          {job.weather && <><dt className="text-muted-foreground">Weather</dt><dd>{job.weather}</dd></>}
          {job.cost != null && <><dt className="text-muted-foreground">Cost</dt><dd>${job.cost.toLocaleString()}</dd></>}
          {job.notes && <><dt className="text-muted-foreground">Notes</dt><dd className="whitespace-pre-wrap">{job.notes}</dd></>}
        </dl>
      )}

      {editable && job.status !== "completed" && (
        <div className="space-y-2 rounded-md border p-2">
          <Label htmlFor="job-done-at">Mark as done</Label>
          <Input id="job-done-at" type="datetime-local" value={completedAt} max={localNow()} onChange={e => setCompletedAt(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => act(() => jobsApi.update(job.id, { status: "completed", completedAt: new Date(completedAt).toISOString(), version: job.version }), "Job completed")}><CheckCircle2 className="h-4 w-4 mr-1" />Completed</Button>
            {job.status !== "in_progress" && <Button size="sm" variant="outline" onClick={() => act(() => jobsApi.update(job.id, { status: "in_progress", startedAt: new Date().toISOString(), version: job.version }), "Job started")}>Started</Button>}
          </div>
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

function DocketForm({ job, onDone }: { job: Job; onDone: (j?: Job) => void }) {
  const [mode, setMode] = useState<"new" | "link">("new");
  const [number, setNumber] = useState("");
  const [supplier, setSupplier] = useState(job.supplier ?? "");
  const [date, setDate] = useState(today());
  const [productId, setProductId] = useState(job.lines[0]?.productId ?? "");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("t");
  const [allocated, setAllocated] = useState("");
  const [cost, setCost] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const products = useMemo(() => Array.from(new Map(job.lines.map(l => [l.productId, l.productSnapshot.name])).entries()), [job.lines]);
  const { data: found = [] } = useQuery({ queryKey: ["/api/dockets", q], queryFn: () => jobsApi.dockets(q), enabled: mode === "link" });
  const save = async () => {
    if (!number.trim()) return toast.error("Enter the docket number");
    setSaving(true);
    try {
      const j = await jobsApi.addDocket(job.id, {
        number: number.trim(), supplier: supplier || null, docketDate: date || null, productId: productId || null,
        productName: products.find(([id]) => id === productId)?.[1] ?? null, quantity: quantity === "" ? null : Number(quantity), unit,
        cost: cost === "" ? null : Number(cost), allocated: allocated === "" ? null : Number(allocated),
      }, files);
      toast.success("Docket attached");
      onDone(j);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex gap-3 text-sm">
        <label className="flex items-center gap-1"><input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />New docket</label>
        <label className="flex items-center gap-1"><input type="radio" checked={mode === "link"} onChange={() => setMode("link")} />One already entered</label>
      </div>
      {mode === "new" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Input value={number} onChange={e => setNumber(e.target.value)} placeholder="Docket number" aria-label="Docket number" />
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Docket date" />
            <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier" aria-label="Supplier" className="col-span-2" />
            <select className={selectClass + " col-span-2"} value={productId} onChange={e => setProductId(e.target.value)} aria-label="Product">
              {products.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <div className="flex gap-1 col-span-2">
              <Input type="number" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Quantity delivered" aria-label="Quantity delivered" />
              <select className="h-9 rounded-md border bg-background px-1 text-sm" value={unit} onChange={e => setUnit(e.target.value)} aria-label="Unit">{["t", "kg", "L"].map(u => <option key={u}>{u}</option>)}</select>
            </div>
            <Input type="number" inputMode="decimal" value={allocated} onChange={e => setAllocated(e.target.value)} placeholder="Of which for this job (if split)" aria-label="For this job" className="col-span-2" />
            <Input type="number" inputMode="decimal" value={cost} onChange={e => setCost(e.target.value)} placeholder="Cost ($)" aria-label="Cost" />
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-1 px-3 py-2 rounded-md border text-sm cursor-pointer bg-pulse-forest text-white"><Camera className="h-4 w-4" />Photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { setFiles(f => [...f, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} /></label>
            <label className="inline-flex items-center gap-1 px-3 py-2 rounded-md border text-sm cursor-pointer hover:bg-muted"><Paperclip className="h-4 w-4" />PDF or file
              <input type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={e => { setFiles(f => [...f, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} /></label>
          </div>
          {files.length > 0 && <p className="text-xs">{files.map(f => f.name).join(", ")}</p>}
          <div className="flex gap-2"><Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Attach"}</Button><Button size="sm" variant="outline" onClick={() => onDone()}>Cancel</Button></div>
        </>
      ) : (
        <>
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search docket number or supplier" aria-label="Search dockets" />
          <ul className="max-h-40 overflow-y-auto divide-y rounded border text-sm">
            {found.map(d => (
              <li key={d.id} className="flex items-center gap-2 px-2 py-1">
                <span className="flex-1">#{d.number} · {[d.supplier, d.docketDate, d.productName, d.quantity != null ? `${d.quantity} ${d.unit ?? ""}` : null].filter(Boolean).join(" · ")}{d.jobs ? ` · on ${d.jobs} job(s)` : ""}</span>
                <Button size="sm" variant="outline" onClick={async () => { try { onDone(await jobsApi.linkDocket(job.id, d.id, allocated === "" ? null : Number(allocated))); toast.success("Docket linked"); } catch (e: any) { toast.error(e.message); } }}><Link2 className="h-4 w-4" /></Button>
              </li>
            ))}
            {found.length === 0 && <li className="px-2 py-1 text-muted-foreground">No dockets found.</li>}
          </ul>
          <Input type="number" inputMode="decimal" value={allocated} onChange={e => setAllocated(e.target.value)} placeholder="Of which for this job (if split)" aria-label="For this job" />
          <Button size="sm" variant="outline" onClick={() => onDone()}>Cancel</Button>
        </>
      )}
    </div>
  );
}

// ===== Lists and map =====

export function JobsSection({ jobs, onOpen, onNew, canRecord }: { jobs: JobSummary[]; onOpen: (id: string) => void; onNew: () => void; canRecord: boolean }) {
  const [status, setStatus] = useState("open");
  const list = jobs.filter(j => status === "all" || (status === "open" ? ["draft", "planned", "in_progress"].includes(j.status) : j.status === status));
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Fertiliser jobs</h2>
        <select className="h-7 rounded border bg-background px-1 text-xs" value={status} onChange={e => setStatus(e.target.value)} aria-label="Job status">
          <option value="open">Not done</option><option value="completed">Completed</option><option value="all">All</option>
        </select>
      </div>
      {list.length === 0 ? <p className="text-xs text-muted-foreground">None in these dates.</p> : (
        <ul className="divide-y rounded-md border text-sm max-h-64 overflow-y-auto">
          {list.map(j => (
            <li key={j.id}>
              <button className="w-full text-left px-2 py-1.5 hover:bg-muted" onClick={() => onOpen(j.id)}>
                <div className="flex justify-between gap-2"><span className="truncate">{j.title || j.products}</span><span className={cn("text-xs", j.status === "completed" ? "text-green-700" : "text-amber-700")}>{JOB_STATUSES.find(s => s.key === j.status)?.label}</span></div>
                <div className="text-xs text-muted-foreground">{(j.completedAt ?? j.plannedOn ?? "").slice(0, 10)} · {j.netHa != null ? `${j.netHa.toFixed(2)} ha` : ""}{j.dockets ? ` · ${j.dockets} docket${j.dockets === 1 ? "" : "s"}` : ""}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {canRecord && <Button size="sm" variant="outline" onClick={onNew}><Plus className="h-4 w-4 mr-1" />New fertiliser job</Button>}
    </section>
  );
}

/**
 * Jobs on the fertiliser layer: planned dashed, completed solid
 */
export function jobOverlays(jobs: JobSummary[], layer: MapState["layers"][number] | undefined): Overlay[] {
  if (!layer) return [];
  const out: Overlay[] = [];
  for (const j of jobs) {
    if (j.status === "cancelled") continue;
    for (const l of j.lines ?? []) {
      const done = j.status === "completed";
      out.push({
        key: `job-${j.id}-${l.id}`, geometry: l.geometry, layerId: layer.id, rank: 3,
        sel: { type: "job", id: j.id },
        pickLabel: `${done ? "Fertiliser" : "Planned"}: ${l.product} ${l.rate ?? ""} ${l.rateUnit} · ${(j.completedAt ?? j.plannedOn ?? "").slice(0, 10)}`,
        style: done
          ? { color: layer.style.color, weight: layer.style.weight, fillColor: layer.style.fillColor, fillOpacity: layer.style.fillOpacity }
          : { color: layer.style.color, weight: 2, dashArray: "6 6", fillColor: layer.style.fillColor, fillOpacity: layer.style.fillOpacity / 3 },
      });
    }
  }
  return out;
}
