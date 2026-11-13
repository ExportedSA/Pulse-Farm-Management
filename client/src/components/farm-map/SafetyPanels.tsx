import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, CheckCircle2, MapPin, Pencil, Printer, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FARM_MAP_KEY, type MapHazard, type MapState } from "@/lib/farm-map";
import { HAZARD_CATEGORIES, HAZARD_STATUSES, HAZARDS_KEY, hazardCategoryLabel, riskColour, riskText, safety, type HazardInput } from "@/lib/safety";
import type { Drawn, Overlay } from "./FarmMapCanvas";

// Hazards on the farm map: they come from the hazard register, so a hazard drawn here is the
// same one listed under Health & Safety, and changing it in either place changes both.

const RISKS = [1, 2, 3, 4, 5];

/**
 * The register's hazards that have a place on the map, coloured by risk
 */
export function hazardOverlays(state: MapState): Overlay[] {
  const layerId = state.layers.find(l => l.key === "hazards")?.id;
  return (state.hazards ?? []).filter(h => h.geometry).map(h => {
    const colour = riskColour(h.riskLevel);
    const g = h.geometry!;
    return {
      key: `hazard-${h.id}`,
      geometry: g,
      layerId,
      sel: { type: "hazard", id: h.id },
      label: h.title,
      labelWithToggle: true,
      pickLabel: `${h.title} · hazard`,
      rank: g.type === "Point" ? 0 : g.type.includes("LineString") ? 1 : 5,
      radiusM: h.radiusM,
      marker: g.type === "Point" ? { text: "!", colour, hazard: true } : undefined,
      style: { color: colour, weight: g.type.includes("LineString") ? 4 : 2, dashArray: h.status === "monitoring" ? "6 4" : undefined, fillColor: colour, fillOpacity: 0.25 },
    } satisfies Overlay;
  });
}

export function HazardFields({ v, set, disabled }: { v: HazardInput; set: (p: Partial<HazardInput>) => void; disabled?: boolean }) {
  return (
    <>
      <div className="space-y-1"><Label htmlFor="hz-title">What's the hazard?</Label><Input id="hz-title" disabled={disabled} value={v.title} onChange={e => set({ title: e.target.value })} placeholder="e.g. Steep bank above the creek" /></div>
      <div className="space-y-1">
        <Label htmlFor="hz-type">Kind</Label>
        <select id="hz-type" disabled={disabled} className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={v.type} onChange={e => set({ type: e.target.value })}>
          {HAZARD_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          {!HAZARD_CATEGORIES.some(c => c.key === v.type) && <option value={v.type}>{hazardCategoryLabel(v.type)}</option>}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="hz-risk">Risk</Label>
        <select id="hz-risk" disabled={disabled} className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={v.riskLevel} onChange={e => set({ riskLevel: Number(e.target.value) })}>
          {RISKS.map(r => <option key={r} value={r}>{r}{r === 1 ? " (lowest)" : r === 5 ? " (highest)" : ""}</option>)}
        </select>
        <p className="text-xs text-muted-foreground">How likely someone is to be hurt, and how badly, before the controls below.</p>
      </div>
      <div className="space-y-1"><Label htmlFor="hz-controls">Controls (how the risk is managed)</Label><Textarea id="hz-controls" disabled={disabled} rows={3} value={v.controls ?? ""} onChange={e => set({ controls: e.target.value })} placeholder="e.g. Fenced off, sign at the gate, no quad bikes past the trough" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor="hz-review">Review by</Label><Input id="hz-review" disabled={disabled} type="date" value={v.reviewDue ?? ""} onChange={e => set({ reviewDue: e.target.value || null })} /></div>
        <div className="space-y-1"><Label htmlFor="hz-where">Where (in words)</Label><Input id="hz-where" disabled={disabled} value={v.location ?? ""} onChange={e => set({ location: e.target.value })} placeholder="e.g. Back of paddock 12" /></div>
      </div>
    </>
  );
}

/**
 * A hazard just drawn on the map, being described before it goes in the register
 */
export function HazardForm({ pending, onSaved, onDiscard }: { pending: Drawn; onSaved: (id: string) => void; onDiscard: () => void }) {
  const queryClient = useQueryClient();
  const [v, setV] = useState<HazardInput>({ title: "", type: "terrain", riskLevel: 3, controls: "", reviewDue: null, location: "" });
  const [saving, setSaving] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault();
      if (!v.title.trim()) return toast.error("Say what the hazard is");
      setSaving(true);
      try {
        const { id } = await safety.createHazard({ ...v, title: v.title.trim(), geometry: pending.geometry, radiusM: pending.kind === "circle" ? pending.radiusM ?? null : null });
        await Promise.all([queryClient.invalidateQueries({ queryKey: FARM_MAP_KEY }), queryClient.invalidateQueries({ queryKey: HAZARDS_KEY })]);
        toast.success("Hazard added to the register");
        onSaved(id);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setSaving(false);
      }
    }}>
      <h2 className="font-semibold flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-red-600" />New hazard</h2>
      <HazardFields v={v} set={p => setV(x => ({ ...x, ...p }))} />
      <div className="flex gap-2">
        <Button type="submit" className="bg-pulse-forest hover:bg-pulse-forest-dark" disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Add to register"}</Button>
        <Button type="button" variant="outline" onClick={onDiscard}>Discard</Button>
      </div>
    </form>
  );
}

/**
 * A hazard picked on the map (or opened from the register): its details, controls and photos
 */
export function HazardPanel({ hazard, canManage, canReport, onEditShape, onPlace, onClosed }: {
  hazard: MapHazard; canManage: boolean; canReport: boolean; onEditShape: () => void; onPlace: () => void; onClosed: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: full } = useQuery({ queryKey: [...HAZARDS_KEY, hazard.id], queryFn: () => safety.hazard(hazard.id) });
  const [v, setV] = useState<HazardInput & { description?: string | null; status?: any }>({ title: hazard.title, type: hazard.type, riskLevel: hazard.riskLevel ?? 3 });
  useEffect(() => {
    if (full) setV({ title: full.title, type: full.type, riskLevel: full.riskLevel ?? 3, controls: full.controls, reviewDue: full.reviewDue, location: full.location, description: full.description, status: full.status });
  }, [full?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: FARM_MAP_KEY }), queryClient.invalidateQueries({ queryKey: HAZARDS_KEY })]);
  const act = async (work: () => Promise<unknown>, done: string) => {
    setSaving(true);
    try { await work(); await refresh(); toast.success(done); return true; } catch (err: any) { toast.error(err.message); return false; } finally { setSaving(false); }
  };
  const overdue = v.reviewDue && v.reviewDue < new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Hazard · {hazardCategoryLabel(hazard.type)}</p>
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: riskColour(hazard.riskLevel) }} />
        <span className="text-sm font-medium">{riskText(hazard.riskLevel)}</span>
        {overdue && <span className="text-xs rounded px-1.5 py-0.5 bg-red-100 text-red-800">Review overdue</span>}
      </div>
      <HazardFields v={v} set={p => setV(x => ({ ...x, ...p }))} disabled={!canManage} />
      {canManage && (
        <div className="space-y-1">
          <Label htmlFor="hz-status">Status</Label>
          <select id="hz-status" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={v.status ?? "active"} onChange={e => setV(x => ({ ...x, status: e.target.value as HazardInput["status"] }))}>
            {HAZARD_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      )}
      {full?.reportedByName && <p className="text-xs text-muted-foreground">Reported by {full.reportedByName}{full.createdAt ? ` on ${new Date(full.createdAt).toLocaleDateString()}` : ""}</p>}
      {(full?.photos?.length ?? 0) > 0 && (
        <div className="grid grid-cols-3 gap-1">
          {full!.photos!.map(p => <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.fileName ?? "Hazard photo"} className="h-20 w-full object-cover rounded" /></a>)}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {canManage && (
          <Button size="sm" disabled={saving} onClick={async () => {
            if (!v.title.trim()) return toast.error("Say what the hazard is");
            const ok = await act(() => safety.updateHazard(hazard.id, { ...v, title: v.title.trim() }), "Hazard saved");
            if (ok && v.status === "resolved") onClosed();
          }}><Save className="h-4 w-4 mr-1" />Save</Button>
        )}
        {canManage && (hazard.geometry
          ? <Button size="sm" variant="outline" onClick={onEditShape}><Pencil className="h-4 w-4 mr-1" />Move or reshape</Button>
          : <Button size="sm" variant="outline" onClick={onPlace}><MapPin className="h-4 w-4 mr-1" />Place on map</Button>)}
        {canReport && (
          <>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4 mr-1" />Photo</Button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={async e => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length) await act(() => safety.addHazardPhotos(hazard.id, files).then(() => queryClient.invalidateQueries({ queryKey: [...HAZARDS_KEY, hazard.id] })), "Photo added");
            }} />
          </>
        )}
        {canManage && (
          <Button size="sm" variant="ghost" className="text-green-800" disabled={saving} onClick={async () => {
            if (!window.confirm(`Mark "${hazard.title}" resolved? It leaves the map but stays in the register's history.`)) return;
            if (await act(() => safety.resolveHazard(hazard.id), "Hazard resolved")) onClosed();
          }}><CheckCircle2 className="h-4 w-4 mr-1" />Resolved</Button>
        )}
      </div>
      <Link href="/app/compliance" className="text-sm underline text-pulse-forest">Open the hazard register</Link>
    </div>
  );
}

/**
 * Left panel list: the farm's hazards, those not yet on the map first
 */
export function HazardsSection({ hazards, canManage, onSelect }: { hazards: MapHazard[]; canManage: boolean; onSelect: (id: string) => void }) {
  const unmapped = hazards.filter(h => !h.geometry);
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-red-600" />Hazards</h2>
        <Button asChild size="sm" variant="ghost" className="h-7"><Link href="/app/farm-map/hazards/print"><Printer className="h-3.5 w-3.5 mr-1" />Hazard map</Link></Button>
      </div>
      {hazards.length === 0 ? (
        <p className="text-xs text-muted-foreground">No open hazards. Use <strong>Hazard</strong> on the toolbar to draw one where it is.</p>
      ) : (
        <ul className="max-h-56 overflow-y-auto divide-y rounded-md border text-sm">
          {hazards.map(h => (
            <li key={h.id}>
              <button className="w-full text-left px-2 py-1.5 hover:bg-muted flex items-center gap-2" onClick={() => onSelect(h.id)}>
                <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: riskColour(h.riskLevel) }} />
                <span className="flex-1 truncate">{h.title}</span>
                {!h.geometry && <span className="text-[10px] text-amber-800">{canManage ? "place on map" : "not on map"}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {unmapped.length > 0 && canManage && <p className="text-xs text-muted-foreground">{unmapped.length} hazard{unmapped.length === 1 ? " isn't" : "s aren't"} on the map yet. Open one and tap <strong>Place on map</strong>.</p>}
    </section>
  );
}
