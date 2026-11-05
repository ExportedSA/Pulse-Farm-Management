import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as turf from "@turf/turf";
import {
  ArrowDown, ArrowUp, Circle as CircleIcon, CloudOff, Download, Eye, EyeOff, Layers, Lock, MapPin, Merge, Minus, Pencil, Plus,
  Redo2, Ruler, Save, Scissors, Search, Spline, Square, Trash2, Undo2, Unlock, Upload, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useFarm } from "@/lib/farm-context";
import { openNewRecord } from "@/components/records/RecordFab";
import { currentSeason, previousSeasons } from "@/components/records/SeasonPanel";
import { recordTypeDef } from "@/lib/records";
import {
  BASEMAPS, FARM_MAP_KEY, LAYER_RECORD_TYPES, download, farmMap, readMapFile, toKml, toKmz,
  type BoundaryVersion, type ImportItem, type MapLayer, type MapState,
} from "@/lib/farm-map";
import {
  FarmMapCanvas, type DrawShape, type Drawn, type Focus, type Measurement, type Mode, type Overlay, type RecordShape, type Selection,
} from "@/components/farm-map/FarmMapCanvas";
import {
  AreaBreakdownPanel, ExclusionEditor, ExclusionStart, ExclusionsSection, NewPlanForm, PlanEditor, PlansSection,
  exclusionOverlays, exclusionPreview, planOverlays, type ExclusionDraft,
} from "@/components/farm-map/PlanningPanels";
import type { RatePlan } from "@/lib/farm-map";
import { JobsSection, NewJobForm, jobOverlays, JOBS_KEY, type JobDraft } from "@/components/farm-map/JobPanels";
import { JobPanel, NewSprayForm, RestrictionWarning, restrictionOverlays } from "@/components/farm-map/SprayPanels";
import { NewWorkForm, footprintOverlays, runPreview } from "@/components/farm-map/WorkPanels";
import { useApplicationOutbox } from "@/lib/application-outbox";
import { ACTIVITY_LABELS, WORK_ACTIVITIES, jobsApi, type Activity, type Job, type JobSummary } from "@/lib/jobs";

const DRAFT_KEY = "pulse-farm-map-draft";
const JOB_DRAFT_KEY = "pulse-farm-map-job-draft";
const PREFS_KEY = "pulse-farm-map-prefs";

// forPaddockId: the outline for a paddock that has none yet
type Pending = Drawn & { target: "paddock" | "feature"; forPaddockId?: string };
interface EditSession { target: Selection; original: GeoJSON.Geometry; originalRadius: number | null; history: { g: GeoJSON.Geometry; r: number | null }[]; index: number }
type SaveState = "saved" | "unsaved" | "saving" | "offline";

const readJson = <T,>(key: string): T | null => { try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; } };
const writeJson = (key: string, value: unknown) => { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };

const fmtHa = (ha: number | null | undefined) => (ha == null ? "—" : `${ha >= 10 ? ha.toFixed(1) : ha.toFixed(2)} ha`);
const fmtM = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);

function seasonRange(season: string) {
  const start = Number(season.slice(0, 4));
  return { from: `${start}-06-01`, to: `${start + 1}-05-31` };
}

/**
 * The farm map: paddocks and layers drawn over aerial imagery, saved permanently
 */
export default function FarmMapPage() {
  const queryClient = useQueryClient();
  const { currentFarm } = useFarm();
  const canEdit = currentFarm?.role === "owner" || currentFarm?.role === "manager";
  const canRecord = !!currentFarm?.role && currentFarm.role !== "viewer";
  // Contractors record the work on jobs shared with them; only farm staff start jobs
  const canCreate = canRecord && currentFarm?.role !== "contractor";
  const isContractor = currentFarm?.role === "contractor";
  const { data: state, isLoading, error } = useQuery({ queryKey: FARM_MAP_KEY, queryFn: farmMap.state });

  // Per-person settings kept on this device: basemap and which layers are shown
  const prefs = useMemo(() => readJson<{ basemap?: string; visible?: Record<string, boolean> }>(`${PREFS_KEY}:${currentFarm?.id}`) ?? {}, [currentFarm?.id]);
  const [basemap, setBasemap] = useState(prefs.basemap ?? "esri");
  const [visible, setVisible] = useState<Record<string, boolean>>(prefs.visible ?? {});
  useEffect(() => {
    if (!state) return;
    setVisible(v => Object.fromEntries(state.layers.map(l => [l.id, v[l.id] ?? l.visible])));
  }, [state]);
  useEffect(() => { writeJson(`${PREFS_KEY}:${currentFarm?.id}`, { basemap, visible }); }, [basemap, visible, currentFarm?.id]);

  const [season, setSeason] = useState(currentSeason);
  const [range, setRange] = useState(() => seasonRange(currentSeason()));
  useEffect(() => setRange(seasonRange(season)), [season]);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const [pending, setPending] = useState<Pending | null>(null);
  const [edit, setEdit] = useState<EditSession | null>(null);
  const [editRevision, setEditRevision] = useState(0);
  const [measure, setMeasure] = useState<Measurement | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [mapView, setMapView] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [attribution, setAttribution] = useState("");
  const [saveState, setSaveState] = useState<SaveState>(navigator.onLine ? "saved" : "offline");
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState<"left" | "right" | null>(null);
  const [drawTarget, setDrawTarget] = useState<"paddock" | "feature" | "exclusion" | "zone" | "job" | "run">("paddock");
  // Exclusions and rate plans
  const [exclusionStart, setExclusionStart] = useState(false);
  const [exclusionDraft, setExclusionDraft] = useState<ExclusionDraft | null>(null);
  const [preview, setPreview] = useState<GeoJSON.Geometry | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [newPlan, setNewPlan] = useState(false);
  const [openPlan, setOpenPlan] = useState<RatePlan | undefined>();
  const [drawFor, setDrawFor] = useState<string | null>(null);
  // Fertiliser jobs: the one being set up, or the one open
  const [jobDraft, setJobDraft] = useState<JobDraft | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobDraftSaved, setJobDraftSaved] = useState<JobDraft | null>(() => readJson<JobDraft>(JOB_DRAFT_KEY));
  // Kept while the job is being set up; cleared once it's saved or cancelled
  const hadJobDraft = useRef(false);
  useEffect(() => {
    if (jobDraft) { writeJson(JOB_DRAFT_KEY, jobDraft); hadJobDraft.current = true; }
    else if (hadJobDraft.current) { writeJson(JOB_DRAFT_KEY, null); setJobDraftSaved(null); hadJobDraft.current = false; }
  }, [jobDraft]);
  const outbox = useApplicationOutbox(() => { queryClient.invalidateQueries({ queryKey: JOBS_KEY }); toast.success("Saved work uploaded"); });
  const [openJob, setOpenJob] = useState<Job | undefined>();

  const dirty = !!pending || (!!edit && edit.index > 0);
  useEffect(() => {
    const online = () => setSaveState(dirty ? "unsaved" : "saved");
    const offline = () => setSaveState("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, [dirty]);
  useEffect(() => {
    if (saveState !== "saving" && saveState !== "offline") setSaveState(dirty ? "unsaved" : "saved");
  }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Unsaved drawing is kept on this device, so a closed tab or flat battery doesn't lose it
  useEffect(() => {
    if (pending) writeJson(DRAFT_KEY, { kind: "pending", pending, at: new Date().toISOString() });
    else if (edit && edit.index > 0) writeJson(DRAFT_KEY, { kind: "edit", target: edit.target, geometry: edit.history[edit.index].g, radius: edit.history[edit.index].r, at: new Date().toISOString() });
    else writeJson(DRAFT_KEY, null);
  }, [pending, edit]);
  const [draft, setDraft] = useState(() => readJson<any>(DRAFT_KEY));

  // Activity records for the season, shown on their layers
  const recordTypes = Object.values(LAYER_RECORD_TYPES).flat().join(",");
  const { data: recordData } = useQuery<{ features: RecordShape[] }>({
    queryKey: ["/api/records", "map", recordTypes, range.from, range.to],
    queryFn: async () => {
      const res = await fetch(`/api/records/map?type=${recordTypes}&from=${new Date(range.from).toISOString()}&to=${new Date(`${range.to}T23:59:59`).toISOString()}`, { credentials: "include" });
      if (!res.ok) return { features: [] };
      return res.json();
    },
  });
  // Records made by a job are shown as the job, not twice
  const records = useMemo(() => (recordData?.features ?? []).filter((f: any) => !f.properties.applicationId)
    .map((f: any) => ({ id: f.id ?? f.properties.id, geometry: f.geometry, properties: f.properties })), [recordData]);
  const { data: jobs = [] } = useQuery<JobSummary[]>({
    queryKey: [...JOBS_KEY, "map", range.from, range.to],
    queryFn: () => jobsApi.list({ from: range.from, to: range.to }),
  });

  // Exclusions (on their layer), the open plan's zones, gaps and overlaps, and the exclusion being set up
  const overlays = useMemo<Overlay[]>(() => {
    if (!state) return [];
    const out = [...exclusionOverlays(state), ...planOverlays(openPlan), ...(jobDraft ? [] : jobOverlays(jobs, state.layers)), ...restrictionOverlays(jobs, state.layers), ...footprintOverlays(openJob), ...runPreview(jobDraft),
      ...(openJob?.gps ? [{ key: "gps", geometry: openJob.gps.geometry, rank: 7, label: "GPS evidence", style: { color: "#111111", weight: 3, fillColor: "#111111", fillOpacity: 0.15 } }] : [])];
    for (const l of jobDraft?.lines ?? []) {
      const g = l.geometry ?? state.paddocks.find(p => p.id === l.pastureId)?.geometry;
      if (g) out.push({ key: `jobline-${l.key}`, geometry: g, rank: 8, style: { color: "#ffd43b", weight: 3, fillColor: "#ffd43b", fillOpacity: 0.35 } });
    }
    const draftShape = exclusionDraft ? (preview ?? exclusionPreview(state, exclusionDraft, 0) ?? exclusionDraft.geometry ?? null) : preview;
    if (draftShape) out.push({ key: "preview", geometry: draftShape, rank: 9, style: { color: "#e03131", weight: 2, dashArray: "6 4", fillColor: "#e03131", fillOpacity: 0.3 } });
    return out;
  }, [state, openPlan, exclusionDraft, preview, jobs, jobDraft, openJob]);

  // Frame the farm the first time the map loads
  const framed = useRef(false);
  useEffect(() => {
    if (!state || framed.current) return;
    const shapes = state.paddocks.filter(p => p.geometry).map(p => turf.feature(p.geometry!));
    if (shapes.length > 0) {
      framed.current = true;
      setFocus({ rev: Date.now(), bounds: turf.bbox(turf.featureCollection(shapes)) as [number, number, number, number] });
    }
  }, [state]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: FARM_MAP_KEY });
  const run = async <T,>(work: () => Promise<T>, success?: string): Promise<T | undefined> => {
    setSaveState("saving");
    try {
      const result = await work();
      await refresh();
      if (success) toast.success(success);
      setSaveState("saved");
      return result;
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't save");
      setSaveState(navigator.onLine ? "unsaved" : "offline");
      return undefined;
    }
  };

  const layers = state?.layers ?? [];
  const layerByKey = (key: string) => layers.find(l => l.key === key);
  const selectedPaddock = selection?.type === "paddock" ? state?.paddocks.find(p => p.id === selection.id) : undefined;
  const selectedFeature = selection?.type === "feature" ? state?.features.find(f => f.id === selection.id) : undefined;
  const selectedRecord = selection?.type === "record" ? records.find(r => r.id === selection.id) : undefined;
  const paddocksLocked = !!layerByKey("paddocks")?.locked;

  // ----- Tools -----

  const cancelAll = () => {
    setMode({ kind: "view" });
    setPending(null);
    setEdit(null);
    setMeasure(null);
    setExclusionStart(false);
    setExclusionDraft(null);
    setPreview(null);
    setNewPlan(false);
    setJobDraft(null);
  };
  const lineFor = (pastureId: string) => ({ key: crypto.randomUUID(), pastureId, rateUnit: "kg/ha" });
  const startJob = (d: JobDraft) => {
    if (!canCreate) return toast.error(isContractor ? "Contractors work on the jobs shared with them" : "Viewers can look but not record");
    cancelAll();
    setPlanId(null);
    setJobId(null);
    setSelection(null);
    setJobDraft(d);
    setMode({ kind: "pick" });
    setPanel("right");
  };

  const startDraw = (target: "paddock" | "feature" | "exclusion" | "zone" | "job" | "run", shape: DrawShape, forPaddockId?: string) => {
    if (!canEdit && target !== "job" && target !== "run") return toast.error("Only owners and managers can change the farm map");
    if (target === "paddock" && paddocksLocked) return toast.error("The paddocks layer is locked. Unlock it in Layers first.");
    if (target !== "zone" && target !== "job" && target !== "run") cancelAll(); else { setMode({ kind: "view" }); setPending(null); setEdit(null); }
    setDrawTarget(target);
    setDrawFor(forPaddockId ?? null);
    if (!forPaddockId && target !== "zone" && target !== "job" && target !== "run") setSelection(null);
    setMode({ kind: "draw", shape });
    setPanel("right");
  };

  const onDrawn = useCallback(async (shape: Drawn) => {
    setMode({ kind: "view" });
    if (drawTarget === "run") {
      setMode({ kind: "pick" });
      if (shape.geometry.type !== "LineString") return toast.error("Draw the run as a line");
      setJobDraft(d => d && ({ ...d, run: shape.geometry as GeoJSON.LineString }));
      return;
    }
    if (drawTarget === "job") {
      setMode({ kind: "pick" });
      if (shape.kind !== "polygon") return toast.error("Draw the treated area as a closed shape");
      // The paddock it's in, for the paddock history
      const centre = turf.pointOnFeature(shape.geometry as any);
      const pd = state?.paddocks.find(p => p.geometry && turf.booleanPointInPolygon(centre, p.geometry as any));
      setJobDraft(d => d && ({ ...d, lines: [...d.lines, { key: crypto.randomUUID(), pastureId: pd?.id ?? null, geometry: shape.geometry, name: pd ? `${pd.name} (part)` : "Drawn area", rateUnit: "kg/ha" }] }));
      return;
    }
    if (drawTarget === "exclusion") {
      setExclusionStart(false);
      setExclusionDraft({ sourceKind: shape.kind === "polygon" ? "area" : "around", geometry: shape.geometry });
      return;
    }
    if (drawTarget === "zone" && planId) {
      if (shape.kind !== "polygon") return toast.error("A zone needs to be a closed area");
      const last = openPlan?.zones[openPlan.zones.length - 1];
      await run(() => farmMap.addZone(planId, { geometry: shape.geometry, productName: last?.productName ?? null, productId: last?.productId ?? null, rateUnit: last?.rateUnit }), "Zone added. Set its rate.");
      await queryClient.invalidateQueries({ queryKey: ["/api/farm-map/plans", planId] });
      return;
    }
    const target = shape.kind === "polygon" && (drawTarget === "paddock" || drawTarget === "feature") ? drawTarget : "feature";
    setPending({ ...shape, target, forPaddockId: target === "paddock" ? drawFor ?? undefined : undefined });
  }, [drawTarget, drawFor, planId, openPlan, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = (target: Selection) => {
    if (!state || !canEdit) return;
    const geometry = target.type === "paddock" ? state.paddocks.find(p => p.id === target.id)?.geometry : state.features.find(f => f.id === target.id)?.geometry;
    const radius = target.type === "feature" ? state.features.find(f => f.id === target.id)?.radiusM ?? null : null;
    if (!geometry) return toast.error("This has no shape to edit yet");
    setEdit({ target, original: geometry, originalRadius: radius, history: [{ g: geometry, r: radius }], index: 0 });
    setMode({ kind: "edit", target });
    setEditRevision(r => r + 1);
  };

  const onEditChange = useCallback((g: GeoJSON.Geometry, r: number | null) => {
    setEdit(e => {
      if (!e) return e;
      // One drag can report the same change twice; keep a single undo step
      const last = e.history[e.index];
      if (last.r === r && JSON.stringify(last.g) === JSON.stringify(g)) return e;
      return { ...e, history: [...e.history.slice(0, e.index + 1), { g, r }], index: e.index + 1 };
    });
  }, []);

  const undo = () => {
    if (!edit || edit.index === 0) return;
    setEdit({ ...edit, index: edit.index - 1 });
    setEditRevision(r => r + 1);
  };
  const redo = () => {
    if (!edit || edit.index >= edit.history.length - 1) return;
    setEdit({ ...edit, index: edit.index + 1 });
    setEditRevision(r => r + 1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !edit) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const [editNote, setEditNote] = useState("");
  const saveEdit = async () => {
    if (!edit) return;
    const current = edit.history[edit.index];
    const ok = edit.target.type === "paddock"
      ? await run(() => farmMap.setBoundary(edit.target.id, { geometry: current.g, note: editNote || "Boundary edited" }), "Boundary saved. Earlier records keep the old one.")
      : await run(() => farmMap.updateFeature(edit.target.id, { geometry: current.g, radiusM: current.r, version: state?.features.find(f => f.id === edit.target.id)?.version }), "Shape saved");
    if (ok !== undefined) {
      setEdit(null);
      setEditNote("");
      setMode({ kind: "view" });
    }
  };

  const onSplitLine = useCallback(async (line: GeoJSON.LineString) => {
    if (mode.kind !== "split") return;
    const paddock = state?.paddocks.find(p => p.id === mode.paddockId);
    const newName = window.prompt("Name for the new paddock", `${paddock?.name ?? "Paddock"} B`);
    setMode({ kind: "view" });
    if (!newName) return;
    const result = await run(() => farmMap.split(mode.paddockId, line, newName.trim()));
    if (result) toast.success(`Split: ${fmtHa(result.kept.areaHa)} kept, ${result.created.name} ${fmtHa(result.created.areaHa)}`);
  }, [mode, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = useCallback((sel: Selection | null) => {
    if (mode.kind === "merge") {
      if (!sel || sel.type !== "paddock" || sel.id === mode.keepId) return;
      setMode({ ...mode, picks: mode.picks.includes(sel.id) ? mode.picks.filter(i => i !== sel.id) : [...mode.picks, sel.id] });
      return;
    }
    if (mode.kind === "pick") {
      if (!sel || sel.type !== "paddock") return;
      if (!state?.paddocks.find(p => p.id === sel.id)?.geometry) return toast.error("That paddock has no boundary yet. Draw the treated area instead.");
      setJobDraft(d => d && ({
        ...d, lines: d.lines.some(l => l.pastureId === sel.id && !l.geometry) ? d.lines.filter(l => !(l.pastureId === sel.id && !l.geometry)) : [...d.lines, lineFor(sel.id)],
      }));
      return;
    }
    setSelection(sel);
    if (sel?.type === "job") { setPlanId(null); setJobId(sel.id); } else setJobId(null);
    if (sel) setPanel("right");
  }, [mode, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (geometry: GeoJSON.Geometry | null | undefined) => {
    if (!geometry) return;
    setFocus({ rev: Date.now(), bounds: turf.bbox(geometry) as [number, number, number, number] });
  };

  // ----- Search -----
  const q = search.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!state || !q) return [];
    return [
      ...state.paddocks.filter(p => p.name.toLowerCase().includes(q) || String(p.paddockNumber ?? "") === q)
        .map(p => ({ sel: { type: "paddock" as const, id: p.id }, label: `Paddock ${p.paddockNumber ?? ""} ${p.name}`, geometry: p.geometry })),
      ...state.features.filter(f => (f.name ?? "").toLowerCase().includes(q))
        .map(f => ({ sel: { type: "feature" as const, id: f.id }, label: `${f.name} · ${layers.find(l => l.id === f.layerId)?.name}`, geometry: f.geometry })),
      ...records.filter(r => `${r.properties.title} ${r.properties.label}`.toLowerCase().includes(q))
        .map(r => ({ sel: { type: "record" as const, id: r.id }, label: `${r.properties.title} · ${r.properties.occurredAt.slice(0, 10)}`, geometry: r.geometry })),
    ].slice(0, 12);
  }, [q, state, records, layers]);

  if (isLoading || !state) {
    return <div className="p-6 text-sm text-muted-foreground">{error ? (error as Error).message : "Loading the farm map…"}</div>;
  }

  const statusLabel = { saved: "All changes saved", unsaved: "Unsaved changes", saving: "Saving…", offline: "Offline: map changes need a connection" }[saveState];
  const mappedTotal = state.paddocks.reduce((s, p) => s + (p.areaHa ?? 0), 0);
  const basemapDef = BASEMAPS.find(b => b.key === basemap) ?? BASEMAPS[0];

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] min-h-[480px]">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2">
        <h1 className="text-lg font-bold text-pulse-forest mr-2">Farm map</h1>
        <div className="relative flex-1 min-w-[160px] max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Paddock, feature, product, docket…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search the map" />
          {matches.length > 0 && (
            <ul className="absolute z-[1000] mt-1 w-full rounded-md border bg-popover shadow-lg max-h-72 overflow-y-auto">
              {matches.map(m => (
                <li key={`${m.sel.type}-${m.sel.id}`}>
                  <button className="w-full text-left text-sm px-3 py-2 hover:bg-muted" onClick={() => { onPick(m.sel); goTo(m.geometry); setSearch(""); }}>{m.label}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={season} onChange={e => setSeason(e.target.value)} aria-label="Season">
          {previousSeasons(5).map(s => <option key={s} value={s}>Season {s}</option>)}
        </select>
        <Input type="date" className="h-9 w-[9.5rem]" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} aria-label="From" />
        <Input type="date" className="h-9 w-[9.5rem]" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} aria-label="To" />
        <span className={cn("text-xs px-2 py-1 rounded-full border flex items-center gap-1",
          saveState === "saved" && "text-green-800 bg-green-50 border-green-200",
          saveState === "unsaved" && "text-amber-800 bg-amber-50 border-amber-300",
          saveState === "saving" && "text-blue-800 bg-blue-50 border-blue-200",
          saveState === "offline" && "text-red-800 bg-red-50 border-red-200")} role="status">
          {saveState === "offline" && <CloudOff className="h-3.5 w-3.5" />}{statusLabel}
        </span>
        {outbox.pending.length > 0 && (
          <span className="text-xs px-2 py-1 rounded-full border text-blue-800 bg-blue-50 border-blue-200" role="status">
            {outbox.pending.length} job change{outbox.pending.length === 1 ? "" : "s"} waiting to upload
          </span>
        )}
        {!isContractor && canRecord && <Button asChild variant="outline" className="h-9"><Link href="/app/farm-map/reports">Reports</Link></Button>}
        {canCreate && (
          <AddActivityMenu
            onJob={(activity: Activity) => startJob({ activity, lines: selectedPaddock?.geometry ? [lineFor(selectedPaddock.id)] : [] })}
            onOther={() => openNewRecord({ type: "feed_out", pastureIds: selectedPaddock ? [selectedPaddock.id] : [] })} />
        )}
      </div>

      {outbox.problems.length > 0 && (
        <div className="border-b bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm space-y-1" role="alert">
          {outbox.problems.map(i => (
            <div key={i.id} className="flex flex-wrap items-center gap-2">
              <span><strong>{i.label}</strong> saved on this device {new Date(i.createdAt).toLocaleString()} wasn't uploaded: {i.state === "conflict" ? "the job was changed by someone else since. Open the job, check it, and enter the change again if it's still needed." : i.error}</span>
              <Button size="sm" variant="ghost" onClick={() => outbox.discard(i.id)}>Dismiss</Button>
            </div>
          ))}
        </div>
      )}
      {jobDraftSaved && !jobDraft && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm">
          Unsaved {jobDraftSaved.activity ?? "fertiliser"} job ({jobDraftSaved.lines.length} area{jobDraftSaved.lines.length === 1 ? "" : "s"}) from this device.
          <Button size="sm" variant="outline" onClick={() => { startJob(jobDraftSaved); }}>Carry on</Button>
          <Button size="sm" variant="ghost" onClick={() => { writeJson(JOB_DRAFT_KEY, null); setJobDraftSaved(null); }}>Discard</Button>
        </div>
      )}
      {draft && !dirty && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm">
          Unsaved {draft.kind === "pending" ? "drawing" : "boundary edit"} from {new Date(draft.at).toLocaleString()}.
          <Button size="sm" variant="outline" onClick={() => {
            if (draft.kind === "pending") setPending(draft.pending);
            else {
              startEdit(draft.target);
              setEdit(e => (e ? { ...e, history: [...e.history, { g: draft.geometry, r: draft.radius }], index: 1 } : e));
              setEditRevision(r => r + 1);
            }
            setDraft(null);
          }}>Restore it</Button>
          <Button size="sm" variant="ghost" onClick={() => { writeJson(DRAFT_KEY, null); setDraft(null); }}>Discard</Button>
        </div>
      )}

      <div className="relative flex-1 grid md:grid-cols-[280px_1fr_320px] min-h-0">
        {/* Left panel: layers, paddocks, saved views */}
        <aside className={cn("bg-background border-r overflow-y-auto z-[600]",
          "absolute inset-y-0 left-0 w-[85%] max-w-xs md:static md:w-auto md:max-w-none",
          panel === "left" ? "block" : "hidden md:block")}>
          <LeftPanel
            state={state} canEdit={canEdit} visible={visible} setVisible={setVisible}
            onSelectPaddock={id => { const p = state.paddocks.find(x => x.id === id); onPick({ type: "paddock", id }); goTo(p?.geometry); }}
            mapView={mapView} basemap={basemap}
            onApplyView={v => { setBasemap(v.basemap); setVisible(prev => ({ ...prev, ...v.layers })); setFocus({ rev: Date.now(), lat: v.lat, lng: v.lng, zoom: v.zoom }); }}
            run={run}
            onSelectExclusion={id => { cancelAll(); setPlanId(null); onPick({ type: "exclusion", id }); goTo(state.exclusions.find(e => e.id === id)?.geometry); }}
            onAddExclusion={() => { if (!canEdit) return; cancelAll(); setPlanId(null); setSelection(null); setExclusionStart(true); setPanel("right"); }}
            onOpenPlan={id => { cancelAll(); setPlanId(id); setPanel("right"); }}
            onNewPlan={() => { cancelAll(); setPlanId(null); setNewPlan(true); setPanel("right"); }}
            jobs={jobs} canRecord={canCreate}
            onOpenJob={id => { cancelAll(); setPlanId(null); setJobId(id); setSelection({ type: "job", id }); setPanel("right"); goTo(jobs.find(j => j.id === id)?.lines?.[0]?.geometry); }}
            onNewJob={activity => startJob({ activity, lines: [] })}
          />
        </aside>

        {/* Map */}
        <div className="relative min-h-0">
          <FarmMapCanvas
            state={state} visible={visible} records={records} basemap={basemap} selection={selection} mode={mode}
            editGeometry={edit ? edit.history[edit.index].g : null}
            pending={pending}
            overlays={overlays}
            editRadius={edit ? edit.history[edit.index].r : null}
            editRevision={editRevision} focus={focus}
            onPick={onPick} onDrawn={onDrawn} onEditChange={onEditChange} onMeasure={setMeasure}
            onSplitLine={onSplitLine} onMove={setMapView} onAttribution={setAttribution}
          />
          {/* Toolbar */}
          <div className="absolute left-14 top-2 z-[500] flex flex-wrap gap-1 rounded-lg bg-background/95 p-1 shadow-md max-w-[calc(100%-4.5rem)]">
            <Button size="sm" variant="ghost" className="md:hidden" onClick={() => setPanel(panel === "left" ? null : "left")} aria-label="Layers and paddocks"><Layers className="h-4 w-4" /></Button>
            {canEdit && (
              <>
                <Button size="sm" variant={mode.kind === "draw" && drawTarget === "paddock" ? "default" : "ghost"} onClick={() => startDraw("paddock", "Polygon")} title="Draw a paddock"><Square className="h-4 w-4 mr-1" />Paddock</Button>
                <ToolMenu disabled={!canEdit} active={mode.kind === "draw" && drawTarget === "feature"} onPick={shape => startDraw("feature", shape)} />
              </>
            )}
            <Button size="sm" variant={mode.kind === "measure" ? "default" : "ghost"} onClick={() => { if (mode.kind === "measure") { setMode({ kind: "view" }); setMeasure(null); } else { cancelAll(); setMode({ kind: "measure" }); setPanel("right"); } }} title="Measure distance and area">
              <Ruler className="h-4 w-4 mr-1" />Measure
            </Button>
            {edit && (
              <>
                <Button size="sm" variant="ghost" onClick={undo} disabled={edit.index === 0} title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={redo} disabled={edit.index >= edit.history.length - 1} title="Redo (Ctrl+Y)"><Redo2 className="h-4 w-4" /></Button>
              </>
            )}
            {mode.kind !== "view" && mode.kind !== "pick" && <Button size="sm" variant="ghost" onClick={() => (mode.kind === "draw" && drawTarget === "job" ? setMode({ kind: "pick" }) : cancelAll())}><X className="h-4 w-4 mr-1" />Cancel</Button>}
            <select className="h-8 rounded-md border bg-background px-1 text-xs" value={basemap} onChange={e => setBasemap(e.target.value)} aria-label="Aerial imagery">
              {BASEMAPS.map(b => <option key={b.key} value={b.key} disabled={!b.available}>{b.label}{b.available ? "" : " (needs key)"}</option>)}
            </select>
          </div>
          {mode.kind === "pick" && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] rounded-md bg-background/95 px-3 py-2 text-sm shadow">Tap paddocks to add them to the job. Tap again to remove.</div>
          )}
          {(mode.kind === "draw" || mode.kind === "split") && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] rounded-md bg-background/95 px-3 py-2 text-sm shadow">
              {mode.kind === "draw" && drawTarget === "run" ? "Tap along the irrigator run. Tap the last point again to finish."
                : mode.kind === "draw" && drawTarget === "job" ? `Draw the area that was (or will be) ${jobDraft?.activity === "spray" ? "sprayed" : "spread"}. Tap the first corner to finish. Exclusions are taken off on save.`
                : mode.kind === "draw" && drawTarget === "zone" ? "Draw the zone. Corners snap to the paddock edge and other zones. Tap the first corner to finish."
                : mode.kind === "split" ? "Draw a line across the paddock, from outside one edge to outside the other. Tap the last point again to finish."
                : mode.shape === "Polygon" ? "Tap each corner. Tap the first corner to close the shape. Corners snap to nearby paddocks."
                : mode.shape === "Line" ? "Tap each point along the line. Tap the last point again to finish."
                : mode.shape === "Circle" ? "Tap the centre, then drag out the radius."
                : "Tap where it goes."}
            </div>
          )}
          <div className="absolute bottom-0 left-0 z-[400] bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground max-w-[70%] truncate" title={basemapDef.captureNote}>
            {attribution} · {basemapDef.captureNote}
          </div>
        </div>

        {/* Right panel: what's selected, being drawn, edited or measured */}
        <aside className={cn("bg-background border-l overflow-y-auto z-[600] p-3 space-y-3",
          "absolute inset-x-0 bottom-0 max-h-[55%] border-t md:static md:max-h-none md:border-t-0",
          panel === "right" || pending || edit || mode.kind !== "view" || exclusionStart || exclusionDraft || planId || newPlan || jobDraft || jobId ? "block" : "hidden md:block")}>
          <button className="md:hidden absolute right-2 top-2" onClick={() => setPanel(null)} aria-label="Close panel"><X className="h-4 w-4" /></button>

          {pending ? (
            <PendingForm
              pending={pending} layers={layers} canEdit={canEdit}
              onDiscard={() => setPending(null)}
              onSave={async (input) => {
                const ok = pending.target === "paddock" && pending.kind === "polygon"
                  ? await run(() => farmMap.createPaddock({ name: input.name, paddockNumber: input.paddockNumber, geometry: pending.geometry }), `${input.name} saved`)
                  : await run(() => farmMap.createFeature({ layerId: input.layerId!, kind: pending.kind, name: input.name || null, notes: input.notes || null, geometry: pending.geometry, radiusM: pending.radiusM ?? null }), "Saved to the map");
                if (ok) setPending(null);
              }}
            />
          ) : edit ? (
            <div className="space-y-3">
              <h2 className="font-semibold">Editing {edit.target.type === "paddock" ? state.paddocks.find(p => p.id === edit.target.id)?.name : state.features.find(f => f.id === edit.target.id)?.name ?? "shape"}</h2>
              <p className="text-sm text-muted-foreground">Drag corners to move them. Tap a small midpoint to add a corner. Right-click (or long-press) a corner to remove it. Corners snap to neighbouring paddocks.</p>
              <EditMeasure geometry={edit.history[edit.index].g} radius={edit.history[edit.index].r} />
              {edit.target.type === "paddock" && (
                <div className="space-y-1">
                  <Label htmlFor="edit-note">Why it changed (optional)</Label>
                  <Input id="edit-note" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="e.g. new fence along the race" />
                  <p className="text-xs text-muted-foreground">The old boundary is kept. Records already saved keep the area they had.</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={saveEdit} disabled={edit.index === 0}><Save className="h-4 w-4 mr-1" />Save</Button>
                <Button variant="outline" onClick={cancelAll}>Cancel</Button>
              </div>
            </div>
          ) : mode.kind === "measure" ? (
            <div className="space-y-2">
              <h2 className="font-semibold">Measure</h2>
              <p className="text-sm text-muted-foreground">Tap points on the map. Three or more points also give an area.</p>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Distance</dt><dd className="font-semibold tabular-nums">{measure ? fmtM(measure.lengthM) : "—"}</dd>
                <dt className="text-muted-foreground">Area</dt><dd className="font-semibold tabular-nums">{measure?.areaHa != null ? `${measure.areaHa.toFixed(3)} ha` : "—"}</dd>
              </dl>
              <Button size="sm" variant="outline" onClick={() => setEditRevision(r => r + 1)}>Start again</Button>
            </div>
          ) : mode.kind === "merge" ? (
            <div className="space-y-2">
              <h2 className="font-semibold">Merge into {state.paddocks.find(p => p.id === mode.keepId)?.name}</h2>
              <p className="text-sm text-muted-foreground">Tap the paddocks to join to it. They're archived; their records keep their history.</p>
              <ul className="text-sm list-disc pl-5">{mode.picks.map(id => <li key={id}>{state.paddocks.find(p => p.id === id)?.name}</li>)}</ul>
              <div className="flex gap-2">
                <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" disabled={mode.picks.length === 0} onClick={async () => {
                  if (!window.confirm(`Merge ${mode.picks.length} paddock(s) into ${state.paddocks.find(p => p.id === mode.keepId)?.name}? This can't be undone here, but the old boundaries stay in the history.`)) return;
                  const r = await run(() => farmMap.merge(mode.keepId, mode.picks));
                  if (r) { toast.success(`Merged: ${fmtHa(r.areaHa)}`); setMode({ kind: "view" }); }
                }}><Merge className="h-4 w-4 mr-1" />Merge</Button>
                <Button variant="outline" onClick={cancelAll}>Cancel</Button>
              </div>
            </div>
          ) : exclusionStart ? (
            <ExclusionStart state={state} onCancel={cancelAll}
              onDraw={shape => startDraw("exclusion", shape)}
              onPick={d => { setExclusionStart(false); setExclusionDraft(d); }} />
          ) : exclusionDraft ? (
            <ExclusionEditor key={JSON.stringify(exclusionDraft).slice(0, 80)} state={state} draft={exclusionDraft} canEdit={canEdit} run={run}
              onPreview={setPreview} onDone={() => { setExclusionDraft(null); setPreview(null); }} />
          ) : jobDraft?.activity && WORK_ACTIVITIES.includes(jobDraft.activity) ? (
            <NewWorkForm key={jobDraft.activity} activity={jobDraft.activity} state={state} draft={jobDraft} setDraft={fn => setJobDraft(d => (d ? fn(d) : d))} jobs={jobs}
              onDrawPart={() => startDraw("job", "Polygon")} onDrawRun={() => startDraw("run", "Line")}
              onCreated={job => { setJobDraft(null); setMode({ kind: "view" }); setJobId(job.id); setSelection({ type: "job", id: job.id }); }}
              onCancel={() => { setJobDraft(null); setMode({ kind: "view" }); }} />
          ) : jobDraft?.activity === "spray" ? (
            <NewSprayForm state={state} draft={jobDraft} setDraft={fn => setJobDraft(d => (d ? fn(d) : d))}
              onDrawPart={() => startDraw("job", "Polygon")}
              onCreated={job => { setJobDraft(null); setMode({ kind: "view" }); setJobId(job.id); setSelection({ type: "job", id: job.id }); }}
              onCancel={() => { setJobDraft(null); setMode({ kind: "view" }); }} />
          ) : jobDraft ? (
            <NewJobForm state={state} draft={jobDraft} setDraft={fn => setJobDraft(d => (d ? fn(d) : d))}
              onDrawPart={() => startDraw("job", "Polygon")}
              onCreated={job => { setJobDraft(null); setMode({ kind: "view" }); setJobId(job.id); setSelection({ type: "job", id: job.id }); }}
              onCancel={() => { setJobDraft(null); setMode({ kind: "view" }); }} />
          ) : jobId ? (
            <JobPanel key={jobId} jobId={jobId} canEdit={canRecord} role={currentFarm?.role} onClose={() => { setJobId(null); setSelection(null); }}
              onJob={setOpenJob} onOpenJob={id => { setJobId(id); setSelection({ type: "job", id }); }} />
          ) : newPlan ? (
            <NewPlanForm state={state} selectedPaddockId={selectedPaddock?.id} run={run}
              onCreated={id => { setNewPlan(false); setPlanId(id); }} onCancel={() => setNewPlan(false)} />
          ) : planId ? (
            <PlanEditor planId={planId} state={state} canEdit={canEdit} run={run} onPlan={setOpenPlan}
              selectedZoneId={selection?.type === "zone" ? selection.id : undefined}
              onDrawZone={() => startDraw("zone", "Polygon")}
              onClose={() => { setPlanId(null); setOpenPlan(undefined); }}
              onOpenPlan={id => setPlanId(id)}
              onCreateJob={p => startJob({
                planId: p.id, title: p.name,
                lines: p.zones.map(z => ({ key: crypto.randomUUID(), pastureId: z.pastureId, geometry: z.geometry, name: z.name ?? null, productId: z.productId, rate: z.rate, rateUnit: z.rateUnit })),
              })} />
          ) : selection?.type === "exclusion" && state.exclusions.find(e => e.id === selection.id) ? (
            <ExclusionEditor key={selection.id} state={state} exclusion={state.exclusions.find(e => e.id === selection.id)} canEdit={canEdit} run={run}
              onPreview={setPreview} onDone={() => { setSelection(null); setPreview(null); }} />
          ) : selectedPaddock ? (
            <PaddockPanel
              paddock={selectedPaddock} canEdit={canEdit} locked={paddocksLocked} range={range}
              onEdit={() => startEdit({ type: "paddock", id: selectedPaddock.id })}
              onSplit={() => { setMode({ kind: "split", paddockId: selectedPaddock.id }); }}
              onMerge={() => setMode({ kind: "merge", keepId: selectedPaddock.id, picks: [] })}
              onDraw={() => startDraw("paddock", "Polygon", selectedPaddock.id)}
              run={run}
              onArchived={() => setSelection(null)}
              canRecord={canCreate}
              onAddJob={activity => startJob({ activity, lines: selectedPaddock.geometry ? [lineFor(selectedPaddock.id)] : [] })}
              onOpenJob={id => { setJobId(id); setSelection({ type: "job", id }); }}
            />
          ) : selectedFeature ? (
            <FeaturePanel feature={selectedFeature} layers={layers} canEdit={canEdit} onEdit={() => startEdit({ type: "feature", id: selectedFeature.id })} run={run} onDeleted={() => setSelection(null)} />
          ) : selectedRecord ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{recordTypeDef(selectedRecord.properties.type as any).label} record</p>
              <h2 className="font-semibold">{selectedRecord.properties.title}</h2>
              <p className="text-sm">{new Date(selectedRecord.properties.occurredAt).toLocaleString()}</p>
              {selectedRecord.properties.label && <p className="text-sm">{selectedRecord.properties.label}</p>}
              {selectedRecord.properties.withholdingActive && <p className="text-sm font-medium text-red-700">Still in grazing withholding</p>}
              <p className="text-xs text-muted-foreground">Drawn area from the record (manually recorded, not GPS evidence).</p>
              <Button asChild size="sm" variant="outline"><Link href="/app/records">Open Records</Link></Button>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <h2 className="font-semibold">{currentFarm?.name ?? "Farm"}</h2>
              <p>{state.paddocks.filter(p => p.geometry).length} of {state.paddocks.length} paddocks mapped · {fmtHa(mappedTotal)} mapped</p>
              {canEdit ? (
                <p className="text-muted-foreground">Tap <strong>Paddock</strong> to draw a paddock over the aerial photo, or tap a paddock to see its history, edit, split or merge it. Everything saves to the farm, not this device.</p>
              ) : (
                <p className="text-muted-foreground">Tap a paddock to see its activity. Owners and managers can change the map.</p>
              )}
              {state.paddocks.some(p => !p.geometry) && canEdit && (
                <div className="space-y-1">
                  <p className="font-medium">Not drawn yet</p>
                  <ul className="space-y-1">
                    {state.paddocks.filter(p => !p.geometry).map(p => (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <span>{p.name}</span>
                        <Button size="sm" variant="outline" onClick={() => { setSelection({ type: "paddock", id: p.id }); startDraw("paddock", "Polygon", p.id); }}>Draw</Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function AddActivityMenu({ onJob, onOther }: { onJob: (a: Activity) => void; onOther: () => void }) {
  const [open, setOpen] = useState(false);
  const pick = (f: () => void) => { setOpen(false); f(); };
  return (
    <div className="relative ml-auto">
      <Button className="bg-pulse-forest hover:bg-pulse-forest-dark h-10" onClick={() => setOpen(o => !o)} aria-expanded={open}><Plus className="h-4 w-4 mr-1" />Add activity</Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-md border bg-popover shadow-lg z-[1000]">
          {(Object.keys(ACTIVITY_LABELS) as Activity[]).map(a => (
            <button key={a} className="w-full text-left text-sm px-3 py-2 hover:bg-muted" onClick={() => pick(() => onJob(a))}>{ACTIVITY_LABELS[a]}</button>
          ))}
          <button className="w-full text-left text-sm px-3 py-2 hover:bg-muted border-t" onClick={() => pick(onOther)}>Grazing or other record</button>
        </div>
      )}
    </div>
  );
}

/**
 * Who changed the map and when (managers): paddocks, boundaries, exclusions, layers, plans
 */
function MapHistory() {
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery<{ id: string; entityType: string; action: string; at: string; by: string | null; name: string | null; note: string | null }[]>({
    queryKey: ["/api/farm-map/audit"], enabled: open,
    queryFn: async () => { const r = await fetch("/api/farm-map/audit?limit=100", { credentials: "include" }); return r.ok ? r.json() : []; },
  });
  return (
    <details className="text-sm" onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer font-semibold">Map edit history</summary>
      <ul className="mt-1 max-h-64 overflow-y-auto divide-y rounded-md border text-xs">
        {data.map(r => (
          <li key={r.id} className="px-2 py-1">
            <div className="flex justify-between gap-2"><span>{r.entityType.replace(/_/g, " ")} {r.action.replace(/_/g, " ")}{r.name ? `: ${r.name}` : ""}</span></div>
            <div className="text-muted-foreground">{new Date(r.at).toLocaleString()} · {r.by ?? "—"}{r.note ? ` · ${r.note}` : ""}</div>
          </li>
        ))}
        {open && data.length === 0 && <li className="px-2 py-1 text-muted-foreground">No changes recorded yet.</li>}
      </ul>
    </details>
  );
}

function ToolMenu({ active, disabled, onPick }: { active: boolean; disabled: boolean; onPick: (s: DrawShape) => void }) {
  const [open, setOpen] = useState(false);
  const tools: { shape: DrawShape; label: string; icon: any }[] = [
    { shape: "Polygon", label: "Area (polygon)", icon: Square },
    { shape: "Rectangle", label: "Rectangle", icon: Square },
    { shape: "Line", label: "Line", icon: Spline },
    { shape: "Marker", label: "Point", icon: MapPin },
    { shape: "Circle", label: "Circle", icon: CircleIcon },
  ];
  return (
    <div className="relative">
      <Button size="sm" variant={active ? "default" : "ghost"} disabled={disabled} onClick={() => setOpen(o => !o)}><Pencil className="h-4 w-4 mr-1" />Draw</Button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-44 rounded-md border bg-popover shadow-lg z-[700]">
          {tools.map(t => (
            <button key={t.shape} className="w-full text-left text-sm px-3 py-2 hover:bg-muted flex items-center gap-2" onClick={() => { setOpen(false); onPick(t.shape); }}>
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EditMeasure({ geometry, radius }: { geometry: GeoJSON.Geometry; radius: number | null }) {
  const text = radius ? `${Math.round(radius)} m radius · ${(Math.PI * radius * radius / 10000).toFixed(3)} ha`
    : geometry.type.includes("Polygon") ? `${(turf.area(geometry as any) / 10000).toFixed(3)} ha (saved area is worked out on the server)`
    : geometry.type.includes("LineString") ? fmtM(turf.length(turf.feature(geometry as any), { units: "meters" }))
    : "";
  return text ? <p className="text-sm font-medium tabular-nums">{text}</p> : null;
}

function PendingForm({ pending, layers, canEdit, onSave, onDiscard }: {
  pending: Pending; layers: MapLayer[]; canEdit: boolean;
  onSave: (v: { name: string; paddockNumber: number | null; layerId?: string; notes?: string }) => void; onDiscard: () => void;
}) {
  const asPaddock = pending.target === "paddock" && pending.kind === "polygon";
  const usable = layers.filter(l => !["paddocks", "exclusions", "variable_rate", "restrictions"].includes(l.key) && !l.locked);
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [layerId, setLayerId] = useState(() => usable.find(l => l.key === (pending.kind === "polygon" ? "fertiliser" : "features"))?.id ?? usable[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const target = pending.forPaddockId;
  const area = pending.kind === "polygon" ? turf.area(pending.geometry as any) / 10000 : pending.kind === "circle" ? Math.PI * (pending.radiusM ?? 0) ** 2 / 10000 : null;
  const length = pending.kind === "line" ? turf.length(turf.feature(pending.geometry as any), { units: "meters" }) : null;
  const queryClient = useQueryClient();
  return (
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault();
      if (!canEdit) return;
      setSaving(true);
      try {
        if (asPaddock && target) {
          // Outline for an existing paddock that had none
          await farmMap.setBoundary(target, { geometry: pending.geometry, note: "First drawn" });
          await queryClient.invalidateQueries({ queryKey: FARM_MAP_KEY });
          toast.success("Paddock outline saved");
          onDiscard();
          return;
        }
        if (asPaddock && !name.trim()) { toast.error("Give the paddock a name"); return; }
        if (!asPaddock && !layerId) { toast.error("Choose a layer"); return; }
        await onSave({ name: name.trim(), paddockNumber: num === "" ? null : Number(num), layerId, notes });
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setSaving(false);
      }
    }}>
      <h2 className="font-semibold">{asPaddock ? (target ? "Outline for this paddock" : "New paddock") : `New ${pending.kind}`}</h2>
      <p className="text-sm tabular-nums">{area != null ? `${area.toFixed(3)} ha` : length != null ? fmtM(length) : ""}{pending.kind === "circle" ? ` · ${Math.round(pending.radiusM ?? 0)} m radius` : ""}</p>
      {asPaddock && !target ? (
        <>
          <div className="space-y-1"><Label htmlFor="pd-name">Paddock name</Label><Input id="pd-name" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Back flat" /></div>
          <div className="space-y-1"><Label htmlFor="pd-num">Number</Label><Input id="pd-num" type="number" inputMode="numeric" value={num} onChange={e => setNum(e.target.value)} /></div>
        </>
      ) : !asPaddock ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="ft-layer">Layer</Label>
            <select id="ft-layer" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={layerId} onChange={e => setLayerId(e.target.value)}>
              {usable.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label htmlFor="ft-name">Name</Label><Input id="ft-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bore 2, Race to shed" /></div>
          <div className="space-y-1"><Label htmlFor="ft-notes">Notes</Label><Textarea id="ft-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" className="bg-pulse-forest hover:bg-pulse-forest-dark" disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="outline" onClick={onDiscard}>Discard</Button>
      </div>
    </form>
  );
}

function PaddockPanel({ paddock, canEdit, locked, range, onEdit, onSplit, onMerge, onDraw, run, onArchived, canRecord, onAddJob, onOpenJob }: {
  paddock: MapState["paddocks"][number]; canEdit: boolean; locked: boolean; range: { from: string; to: string };
  onEdit: () => void; onSplit: () => void; onMerge: () => void; onDraw: () => void;
  run: <T>(w: () => Promise<T>, s?: string) => Promise<T | undefined>; onArchived: () => void;
  canRecord: boolean; onAddJob: (activity: Activity) => void; onOpenJob: (id: string) => void;
}) {
  const { data: paddockJobs = [] } = useQuery<JobSummary[]>({
    queryKey: [...JOBS_KEY, "paddock", paddock.id, range.from, range.to],
    queryFn: () => jobsApi.list({ pastureId: paddock.id, from: range.from, to: range.to }),
  });
  // Filter the paddock's history by activity, or by product, contractor or target
  const [jobFilter, setJobFilter] = useState<{ activity: string; text: string }>({ activity: "", text: "" });
  const shownJobs = paddockJobs.filter(j => (!jobFilter.activity || j.activity === jobFilter.activity)
    && (!jobFilter.text || `${j.products ?? ""} ${j.contractor ?? ""} ${j.target ?? ""} ${j.title ?? ""}`.toLowerCase().includes(jobFilter.text.toLowerCase())));
  // Totals for the paddock over these dates (staff only: the report isn't shared with contractors)
  const { data: totals } = useQuery({
    queryKey: ["/api/activity-reports", "paddock", paddock.id, range.from, range.to],
    queryFn: () => jobsApi.report({ from: range.from, to: range.to, pastureId: paddock.id }),
    enabled: canRecord,
  });
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(paddock.name);
  const [num, setNum] = useState(paddock.paddockNumber != null ? String(paddock.paddockNumber) : "");
  useEffect(() => { setName(paddock.name); setNum(paddock.paddockNumber != null ? String(paddock.paddockNumber) : ""); setRenaming(false); }, [paddock.id, paddock.name, paddock.paddockNumber]);
  const { data: history = [] } = useQuery<BoundaryVersion[]>({ queryKey: ["/api/farm-map/history", paddock.id, paddock.boundaryId], queryFn: () => farmMap.history(paddock.id) });
  const { data: activity = [] } = useQuery<any[]>({
    queryKey: ["/api/records", "paddock", paddock.id, range.from, range.to],
    queryFn: async () => {
      const res = await fetch(`/api/records?pastureId=${paddock.id}&from=${new Date(range.from).toISOString()}&to=${new Date(`${range.to}T23:59:59`).toISOString()}&limit=50`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });
  const editable = canEdit && !locked;
  return (
    <div className="space-y-3">
      {renaming ? (
        <form className="space-y-2" onSubmit={async e => {
          e.preventDefault();
          const ok = await run(() => farmMap.updatePaddock(paddock.id, { name: name.trim(), paddockNumber: num === "" ? null : Number(num) }), "Paddock renamed");
          if (ok !== undefined) setRenaming(false);
        }}>
          <Input value={name} onChange={e => setName(e.target.value)} aria-label="Paddock name" />
          <Input type="number" value={num} onChange={e => setNum(e.target.value)} placeholder="Number" aria-label="Paddock number" />
          <div className="flex gap-2"><Button type="submit" size="sm">Save</Button><Button type="button" size="sm" variant="outline" onClick={() => setRenaming(false)}>Cancel</Button></div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Paddock {paddock.paddockNumber ?? ""}</p>
            <h2 className="text-lg font-semibold">{paddock.name}</h2>
          </div>
          {canEdit && <Button size="sm" variant="ghost" onClick={() => setRenaming(true)} aria-label="Rename"><Pencil className="h-4 w-4" /></Button>}
        </div>
      )}
      <RestrictionWarning pastureIds={[paddock.id]} kind="grazing,harvest" compact />
      <AreaBreakdownPanel pastureId={paddock.id} hasBoundary={!!paddock.geometry} />
      <dl className="grid grid-cols-2 gap-1 text-sm">
        <dt className="text-muted-foreground">Mapped area</dt><dd className="font-semibold tabular-nums">{fmtHa(paddock.areaHa)}</dd>
        <dt className="text-muted-foreground">Recorded area</dt><dd className="tabular-nums">{fmtHa(paddock.recordedAreaHa)}</dd>
      </dl>
      {editable && (
        <div className="flex flex-wrap gap-2">
          {paddock.geometry ? (
            <>
              <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-4 w-4 mr-1" />Edit boundary</Button>
              <Button size="sm" variant="outline" onClick={onSplit}><Scissors className="h-4 w-4 mr-1" />Split</Button>
              <Button size="sm" variant="outline" onClick={onMerge}><Merge className="h-4 w-4 mr-1" />Merge</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={onDraw}><Square className="h-4 w-4 mr-1" />Draw outline</Button>
          )}
          <Button size="sm" variant="ghost" className="text-red-700" onClick={async () => {
            if (!window.confirm(`Archive ${paddock.name}? It leaves the map, but its records and boundary history are kept.`)) return;
            const ok = await run(() => farmMap.archivePaddock(paddock.id), `${paddock.name} archived`);
            if (ok !== undefined) onArchived();
          }}><Trash2 className="h-4 w-4 mr-1" />Archive</Button>
        </div>
      )}
      {canEdit && locked && <p className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" />Paddocks are locked. Unlock the layer to change them.</p>}
      {canRecord && (
        <div className="flex flex-wrap gap-2">
          <select className="h-9 rounded-md border bg-pulse-forest text-white px-2 text-sm" value="" aria-label="Add a job here" onChange={e => { if (e.target.value) onAddJob(e.target.value as Activity); }}>
            <option value="">+ Job here…</option>
            {(Object.keys(ACTIVITY_LABELS) as Activity[]).map(a => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={() => openNewRecord({ type: "feed_out", pastureIds: [paddock.id] })}>Other record</Button>
        </div>
      )}

      <section className="space-y-1">
        <h3 className="text-sm font-semibold">Jobs</h3>
        {totals && (totals.nutrients.length > 0 || totals.harvest.length > 0 || totals.totals.cost > 0) && (
          <div className="rounded-md border p-2 text-xs space-y-0.5 tabular-nums">
            {totals.nutrients.map((n: any) => (
              <p key={n.paddock}>Nutrients applied: {Object.entries(n.kg).filter(([, v]) => (v as number) > 0).map(([k, v]) => `${k} ${v} kg${n.perHa ? ` (${n.perHa[k]} kg/ha)` : ""}`).join(" · ") || "none counted"}
                {n.notCounted.length > 0 && <span className="text-amber-800"> · not counted: {n.notCounted.join("; ")}</span>}</p>
            ))}
            {totals.harvest.length > 0 && <p>Harvested: {totals.harvest.map((h: any) => `${h.activity} ${h.freshT ?? "?"} t fresh / ${h.dmT ?? "?"} t DM${h.dmBasis === "estimated" || h.freshBasis === "estimated" ? " (est.)" : ""}`).join("; ")}</p>}
            {totals.totals.cost > 0 && <p>Costs (this paddock's share): ${totals.totals.cost.toLocaleString()}</p>}
          </div>
        )}
        {paddockJobs.length > 0 && (
          <div className="grid grid-cols-[7rem_1fr] gap-1">
            <select className="h-8 rounded-md border bg-background px-1 text-xs" value={jobFilter.activity} onChange={e => setJobFilter(f => ({ ...f, activity: e.target.value }))} aria-label="Filter by activity">
              <option value="">All activities</option>
              {(Object.keys(ACTIVITY_LABELS) as Activity[]).map(a => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
            </select>
            <Input className="h-8 text-xs" value={jobFilter.text} onChange={e => setJobFilter(f => ({ ...f, text: e.target.value }))} placeholder="Product, contractor or target" aria-label="Filter jobs" />
          </div>
        )}
        {shownJobs.length === 0 ? <p className="text-sm text-muted-foreground">{paddockJobs.length ? "No jobs match." : "None in these dates."}</p> : (
          <ul className="divide-y rounded-md border text-sm">
            {shownJobs.map(j => {
              const mine = (j.lines ?? []).filter(l => l.pastureId === paddock.id);
              return (
                <li key={j.id}>
                  <button className="w-full text-left px-2 py-1.5 hover:bg-muted" onClick={() => onOpenJob(j.id)}>
                    <div className="flex justify-between gap-2"><span className="font-medium">{j.activity === "fertiliser" ? mine.map(l => `${l.product} ${l.rate ?? ""} ${l.rateUnit}`).join(", ") || j.products : `${ACTIVITY_LABELS[j.activity as Activity] ?? j.activity}${j.products ? `: ${j.products}` : ""}`}</span><span className="text-xs text-muted-foreground">{(j.completedAt ?? j.plannedOn ?? "").slice(0, 10)}</span></div>
                    <div className="text-xs text-muted-foreground">{j.status === "completed" ? "Done" : j.status === "cancelled" ? "Cancelled" : "Planned"}{j.target ? ` · for ${j.target}` : ""}{j.contractor ? ` · ${j.contractor}` : ""}{j.dockets ? ` · ${j.dockets} docket${j.dockets === 1 ? "" : "s"}` : ""}
                      {j.restriction?.grazing?.state === "unresolved" && <span className="text-red-700"> · restriction unresolved</span>}
                      {j.restriction?.grazing?.state === "active" && <span className="text-orange-700"> · no grazing until {new Date(j.restriction.grazing.until!).toLocaleDateString()}</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-1">
        <h3 className="text-sm font-semibold">Other activity ({range.from} to {range.to})</h3>
        {activity.filter(r => !r.details?.applicationId).length === 0 ? <p className="text-sm text-muted-foreground">Nothing else recorded in these dates.</p> : (
          <ul className="divide-y rounded-md border text-sm">
            {activity.filter(r => !r.details?.applicationId).map(r => (
              <li key={r.id} className="px-2 py-1.5">
                <div className="flex justify-between gap-2"><span className="font-medium">{r.title}</span><span className="text-xs text-muted-foreground">{r.occurredAt.slice(0, 10)}</span></div>
                <div className="text-xs text-muted-foreground">{recordTypeDef(r.type).label}{r.attachments?.length ? ` · ${r.attachments.length} file${r.attachments.length === 1 ? "" : "s"}` : ""}</div>
                {r.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.attachments.map((a: any) => (
                      <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="text-xs underline">{a.fileName ?? a.kind}</a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-1">
        <h3 className="text-sm font-semibold">Boundary history</h3>
        {history.length === 0 ? <p className="text-sm text-muted-foreground">Not drawn yet.</p> : (
          <ul className="space-y-1 text-xs">
            {history.map(h => (
              <li key={h.id} className={cn("rounded border px-2 py-1", !h.validTo && "border-green-300 bg-green-50 dark:bg-green-950/30")}>
                <span className="font-medium tabular-nums">{fmtHa(h.areaHa)}</span> · {new Date(h.validFrom).toLocaleDateString()}{h.validTo ? ` to ${new Date(h.validTo).toLocaleDateString()}` : " (current)"}
                <div className="text-muted-foreground">{h.note}{h.by ? ` · ${h.by}` : ""}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FeaturePanel({ feature, layers, canEdit, onEdit, run, onDeleted }: {
  feature: MapState["features"][number]; layers: MapLayer[]; canEdit: boolean; onEdit: () => void;
  run: <T>(w: () => Promise<T>, s?: string) => Promise<T | undefined>; onDeleted: () => void;
}) {
  const layer = layers.find(l => l.id === feature.layerId);
  const [name, setName] = useState(feature.name ?? "");
  const [notes, setNotes] = useState(feature.notes ?? "");
  const [layerId, setLayerId] = useState(feature.layerId);
  useEffect(() => { setName(feature.name ?? ""); setNotes(feature.notes ?? ""); setLayerId(feature.layerId); }, [feature.id, feature.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const editable = canEdit && !layer?.locked;
  const changed = name !== (feature.name ?? "") || notes !== (feature.notes ?? "") || layerId !== feature.layerId;
  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{layer?.name} · {feature.kind}</p>
      <p className="text-sm font-medium tabular-nums">
        {feature.areaHa != null ? `${Number(feature.areaHa).toFixed(3)} ha` : feature.lengthM != null ? fmtM(Number(feature.lengthM)) : ""}
        {feature.kind === "circle" && feature.radiusM ? ` · ${Math.round(feature.radiusM)} m radius` : ""}
      </p>
      <div className="space-y-1"><Label htmlFor="f-name">Name</Label><Input id="f-name" value={name} disabled={!editable} onChange={e => setName(e.target.value)} /></div>
      <div className="space-y-1">
        <Label htmlFor="f-layer">Layer</Label>
        <select id="f-layer" disabled={!editable} className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={layerId} onChange={e => setLayerId(e.target.value)}>
          {layers.filter(l => l.key !== "paddocks").map(l => <option key={l.id} value={l.id} disabled={l.locked}>{l.name}</option>)}
        </select>
      </div>
      <div className="space-y-1"><Label htmlFor="f-notes">Notes</Label><Textarea id="f-notes" rows={3} value={notes} disabled={!editable} onChange={e => setNotes(e.target.value)} /></div>
      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!changed} onClick={() => run(() => farmMap.updateFeature(feature.id, { name: name || null, notes: notes || null, layerId, version: feature.version }), "Saved")}><Save className="h-4 w-4 mr-1" />Save</Button>
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-4 w-4 mr-1" />Edit shape</Button>
          <Button size="sm" variant="ghost" className="text-red-700" onClick={async () => {
            if (!window.confirm(`Delete ${feature.name || "this shape"}?`)) return;
            const ok = await run(() => farmMap.deleteFeature(feature.id), "Deleted");
            if (ok !== undefined) onDeleted();
          }}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
        </div>
      )}
      {canEdit && layer?.locked && <p className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" />{layer.name} is locked.</p>}
    </div>
  );
}

function LeftPanel({ state, canEdit, visible, setVisible, onSelectPaddock, mapView, basemap, onApplyView, run, onSelectExclusion, onAddExclusion, onOpenPlan, onNewPlan, jobs, canRecord, onOpenJob, onNewJob }: {
  state: MapState; canEdit: boolean; visible: Record<string, boolean>; setVisible: (fn: (v: Record<string, boolean>) => Record<string, boolean>) => void;
  onSelectPaddock: (id: string) => void; mapView: { lat: number; lng: number; zoom: number } | null; basemap: string;
  onApplyView: (v: MapState["views"][number]) => void; run: <T>(w: () => Promise<T>, s?: string) => Promise<T | undefined>;
  onSelectExclusion: (id: string) => void; onAddExclusion: () => void; onOpenPlan: (id: string) => void; onNewPlan: () => void;
  jobs: JobSummary[]; canRecord: boolean; onOpenJob: (id: string) => void; onNewJob: (activity: Activity) => void;
}) {
  const [styling, setStyling] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newLayer, setNewLayer] = useState("");
  const [filter, setFilter] = useState("");
  const [importing, setImporting] = useState<ImportItem[] | null>(null);
  const [shownOnly, setShownOnly] = useState(true);
  // What goes in an export: everything, or only the layers shown now
  const exportOpts = () => {
    if (!shownOnly) return undefined;
    const byKey = (k: string) => state.layers.find(l => l.key === k);
    return {
      layers: state.layers.filter(l => visible[l.id]).map(l => l.id),
      paddocks: !!visible[byKey("paddocks")?.id ?? ""],
      exclusions: !!visible[byKey("exclusions")?.id ?? ""],
    };
  };
  const fileRef = useRef<HTMLInputElement | null>(null);
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    state.features.forEach(f => c.set(f.layerId, (c.get(f.layerId) ?? 0) + 1));
    return c;
  }, [state.features]);
  const layers = state.layers;
  const move = (i: number, dir: -1 | 1) => {
    const a = layers[i], b = layers[i + dir];
    if (!a || !b) return;
    run(async () => {
      await farmMap.updateLayer(a.id, { sortOrder: b.sortOrder });
      await farmMap.updateLayer(b.id, { sortOrder: a.sortOrder === b.sortOrder ? a.sortOrder + dir : a.sortOrder });
    });
  };
  return (
    <div className="p-3 space-y-5">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-1"><Layers className="h-4 w-4" />Layers</h2>
        <ul className="space-y-1">
          {layers.map((l, i) => (
            <li key={l.id} className="rounded-md border">
              <div className="flex items-center gap-1 px-1.5 py-1">
                <button className="p-1" onClick={() => setVisible(v => ({ ...v, [l.id]: !v[l.id] }))} aria-label={visible[l.id] ? `Hide ${l.name}` : `Show ${l.name}`} aria-pressed={!!visible[l.id]}>
                  {visible[l.id] ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                </button>
                <button className="h-4 w-4 rounded-sm border shrink-0" style={{ backgroundColor: l.style.fillColor, borderColor: l.style.color }} onClick={() => canEdit && setStyling(styling === l.id ? null : l.id)} aria-label={`Style for ${l.name}`} />
                {renaming === l.id ? (
                  <form className="flex-1" onSubmit={async e => { e.preventDefault(); const v = new FormData(e.currentTarget).get("n") as string; await run(() => farmMap.updateLayer(l.id, { name: v }), "Layer renamed"); setRenaming(null); }}>
                    <Input name="n" defaultValue={l.name} className="h-7 text-sm" autoFocus onBlur={() => setRenaming(null)} />
                  </form>
                ) : (
                  <span className={cn("flex-1 text-sm truncate", !visible[l.id] && "text-muted-foreground")} onDoubleClick={() => canEdit && setRenaming(l.id)}>
                    {l.name}{counts.get(l.id) ? <span className="text-xs text-muted-foreground"> ({counts.get(l.id)})</span> : null}
                  </span>
                )}
                {canEdit && (
                  <>
                    <button className="p-1" onClick={() => run(() => farmMap.updateLayer(l.id, { locked: !l.locked }), l.locked ? `${l.name} unlocked` : `${l.name} locked`)} aria-label={l.locked ? `Unlock ${l.name}` : `Lock ${l.name}`}>
                      {l.locked ? <Lock className="h-3.5 w-3.5 text-amber-700" /> : <Unlock className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    <button className="p-0.5" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${l.name} up`}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button className="p-0.5" onClick={() => move(i, 1)} disabled={i === layers.length - 1} aria-label={`Move ${l.name} down`}><ArrowDown className="h-3.5 w-3.5" /></button>
                  </>
                )}
              </div>
              {styling === l.id && canEdit && (
                <div className="border-t px-2 py-2 space-y-2 text-xs">
                  <label className="flex items-center justify-between gap-2">Outline <input type="color" value={l.style.color} onChange={e => run(() => farmMap.updateLayer(l.id, { style: { color: e.target.value } }))} /></label>
                  <label className="flex items-center justify-between gap-2">Fill <input type="color" value={l.style.fillColor} onChange={e => run(() => farmMap.updateLayer(l.id, { style: { fillColor: e.target.value } }))} /></label>
                  <label className="flex items-center justify-between gap-2">See-through
                    <input type="range" min={0} max={1} step={0.05} defaultValue={l.style.fillOpacity} onMouseUp={e => run(() => farmMap.updateLayer(l.id, { style: { fillOpacity: Number((e.target as HTMLInputElement).value) } }))} onTouchEnd={e => run(() => farmMap.updateLayer(l.id, { style: { fillOpacity: Number((e.target as HTMLInputElement).value) } }))} />
                  </label>
                  <label className="flex items-center justify-between gap-2">Outline width
                    <select value={l.style.weight} onChange={e => run(() => farmMap.updateLayer(l.id, { style: { weight: Number(e.target.value) } }))} className="border rounded px-1">{[1, 2, 3, 4, 6].map(w => <option key={w} value={w}>{w}</option>)}</select>
                  </label>
                  <label className="flex items-center justify-between gap-2">Dashed
                    <input type="checkbox" checked={!!l.style.dashArray} onChange={e => run(() => farmMap.updateLayer(l.id, { style: { dashArray: e.target.checked ? "6 4" : null } }))} />
                  </label>
                  <div className="flex gap-2">
                    <button className="underline" onClick={() => setRenaming(l.id)}>Rename</button>
                    {l.kind === "custom" && <button className="underline text-red-700" onClick={() => window.confirm(`Remove ${l.name}?`) && run(() => farmMap.deleteLayer(l.id), "Layer removed")}>Remove</button>}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <form className="flex gap-1" onSubmit={async e => { e.preventDefault(); if (!newLayer.trim()) return; await run(() => farmMap.createLayer({ name: newLayer.trim() }), "Layer added"); setNewLayer(""); }}>
            <Input className="h-8 text-sm" placeholder="New layer name" value={newLayer} onChange={e => setNewLayer(e.target.value)} />
            <Button size="sm" type="submit" variant="outline"><Plus className="h-4 w-4" /></Button>
          </form>
        )}
        <p className="text-xs text-muted-foreground">Showing and hiding is just for you. Activity layers show records from the dates above.</p>
      </section>

      <ExclusionsSection exclusions={state.exclusions} canEdit={canEdit} onSelect={onSelectExclusion} onAdd={onAddExclusion} />

      <JobsSection jobs={jobs} onOpen={onOpenJob} onNew={onNewJob} canRecord={canRecord} />
      <PlansSection plans={state.plans} canEdit={canEdit} onOpen={onOpenPlan} onNew={onNewPlan} />
      {canEdit && <MapHistory />}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Paddocks</h2>
        <Input className="h-8 text-sm" placeholder="Filter paddocks" value={filter} onChange={e => setFilter(e.target.value)} />
        <ul className="max-h-64 overflow-y-auto divide-y rounded-md border text-sm">
          {state.paddocks.filter(p => !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || String(p.paddockNumber ?? "") === filter).map(p => (
            <li key={p.id}>
              <button className="w-full text-left px-2 py-1.5 hover:bg-muted flex justify-between gap-2" onClick={() => onSelectPaddock(p.id)}>
                <span>{p.paddockNumber != null ? `${p.paddockNumber} · ` : ""}{p.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{p.geometry ? fmtHa(p.areaHa) : "not drawn"}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Saved views</h2>
        {state.views.length === 0 && <p className="text-xs text-muted-foreground">Save where the map is and which layers are on, e.g. "Effluent block".</p>}
        <ul className="space-y-1">
          {state.views.map(v => (
            <li key={v.id} className="flex items-center gap-1">
              <button className="flex-1 text-left text-sm underline" onClick={() => onApplyView(v)}>{v.name}</button>
              <button className="p-1" onClick={() => window.confirm(`Delete view "${v.name}"?`) && run(() => farmMap.deleteView(v.id), "View deleted")} aria-label={`Delete view ${v.name}`}><Minus className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="outline" disabled={!mapView} onClick={() => {
          const name = window.prompt("Name for this view");
          if (!name || !mapView) return;
          run(() => farmMap.saveView({ name: name.trim(), lat: mapView.lat, lng: mapView.lng, zoom: mapView.zoom, basemap, layers: visible }), "View saved");
        }}><Save className="h-4 w-4 mr-1" />Save this view</Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Import and export</h2>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={async () => download(new Blob([JSON.stringify(await farmMap.exportGeoJSON(exportOpts()))], { type: "application/geo+json" }), "farm-map.geojson")}><Download className="h-4 w-4 mr-1" />GeoJSON</Button>
          <Button size="sm" variant="outline" onClick={async () => download(new Blob([toKml(await farmMap.exportGeoJSON(exportOpts()), "Farm map")], { type: "application/vnd.google-earth.kml+xml" }), "farm-map.kml")}><Download className="h-4 w-4 mr-1" />KML</Button>
          <Button size="sm" variant="outline" onClick={async () => download(await toKmz(await farmMap.exportGeoJSON(exportOpts()), "Farm map"), "farm-map.kmz")}><Download className="h-4 w-4 mr-1" />KMZ</Button>
          {canEdit && (
            <>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" />Import</Button>
              <input ref={fileRef} type="file" accept=".kml,.kmz,.geojson,.json" className="sr-only" onChange={async e => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try { setImporting(await readMapFile(file)); } catch (err: any) { toast.error(err.message); }
              }} />
            </>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={shownOnly} onChange={e => setShownOnly(e.target.checked)} />Only the layers shown now</label>
        <p className="text-xs text-muted-foreground">Exports are your own boundaries, exclusions and shapes, not the aerial imagery.</p>
        {importing && <ImportPanel items={importing} layers={layers} onDone={() => setImporting(null)} run={run} />}
      </section>
    </div>
  );
}

function ImportPanel({ items, layers, onDone, run }: { items: ImportItem[]; layers: MapLayer[]; onDone: () => void; run: <T>(w: () => Promise<T>, s?: string) => Promise<T | undefined> }) {
  const polygons = items.filter(i => i.geometry.type.includes("Polygon"));
  const [as, setAs] = useState<"paddocks" | "layer">(polygons.length > 0 ? "paddocks" : "layer");
  const [layerId, setLayerId] = useState(layers.find(l => l.key === "features")?.id ?? "");
  const outside = items.some(i => {
    const [w, s, e, n] = turf.bbox(i.geometry as any);
    return w < 165 || e > 180 || s < -48 || n < -33;
  });
  const chosen = as === "paddocks" ? polygons : items;
  return (
    <div className="rounded-md border p-2 space-y-2 text-sm">
      <p>{items.length} shape{items.length === 1 ? "" : "s"} found ({polygons.length} area{polygons.length === 1 ? "" : "s"}).</p>
      {outside && <p className="text-amber-800 text-xs">Some shapes are outside New Zealand. Check the file's coordinates.</p>}
      <label className="flex items-center gap-2"><input type="radio" checked={as === "paddocks"} disabled={polygons.length === 0} onChange={() => setAs("paddocks")} />As paddocks (areas only)</label>
      <label className="flex items-center gap-2"><input type="radio" checked={as === "layer"} onChange={() => setAs("layer")} />Onto a layer</label>
      {as === "layer" && (
        <select className="h-8 w-full rounded-md border bg-background px-2" value={layerId} onChange={e => setLayerId(e.target.value)}>
          {layers.filter(l => l.key !== "paddocks").map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      )}
      <ul className="max-h-32 overflow-y-auto text-xs text-muted-foreground">{chosen.slice(0, 50).map((i, n) => <li key={n}>{i.name ?? `(no name) ${i.geometry.type}`}</li>)}</ul>
      <div className="flex gap-2">
        <Button size="sm" onClick={async () => {
          const r = await run(() => farmMap.importShapes({ as, layerId: as === "layer" ? layerId : undefined, items: chosen }));
          if (r) {
            toast.success(`Imported ${r.created}${r.skipped.length ? `, skipped ${r.skipped.length}` : ""}`);
            r.skipped.slice(0, 3).forEach(s => toast.error(`${s.name ?? "A shape"}: ${s.reason}`));
            onDone();
          }
        }}>Import {chosen.length}</Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}
